/**
 * Per-call org scoping (project-org-routing-and-rehome spec §3.2, 6.2.0).
 *
 * Every assertion here is on the OUTGOING REQUEST as nock sees it — never on
 * a mock that agrees with the code. `badheaders` makes nock refuse a match
 * when the header is present, which is how "no header" is proven rather
 * than assumed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { OpsHttpClient, ORG_SLUG_HEADER } from '../src/http/http-client.js';
import { OpsClient } from '../src/client.js';
import { InputValidationError } from '../src/errors/errors.js';
import * as projectOps from '../src/operations/projects.js';
import * as runOps from '../src/operations/runs.js';
import { BASE_URL, TEST_API_KEY, createMockProject, createMockRun, createMockAgentSnapshot, createMockIssue } from './setup.js';

const project = (): object => ({ data: createMockProject({ name: 'p' }) });
const list = (): object => ({ data: [], total: 0, count: 0 });

describe('per-call org scope', () => {
  afterEach(() => {
    expect(nock.isDone(), `unmatched: ${nock.pendingMocks().join(', ')}`).toBe(true);
    nock.cleanAll();
  });

  describe('OpsHttpClient.withOrg', () => {
    let root: OpsHttpClient;
    beforeEach(() => {
      root = new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
    });

    // Ship run #48 (code-auditor): a view is Object.create(root), so sdk-core's
    // instance fields written through `this` (refreshPromise, lastRateLimitInfo,
    // rateLimitWarningFired) used to land on the VIEW as own properties — N
    // concurrent scoped 401s each started a re-login, and rate-limit state
    // recorded through a view was invisible on the root. The root-client dedup
    // test in http-client.test.ts never went through withOrg, so this passed.
    describe('views share the root client\'s resilience state', () => {
      it('concurrent 401s through org-scoped views refresh ONCE', async () => {
        const sessionClient = new OpsHttpClient({ baseUrl: BASE_URL, email: 'user@test.com', password: 'pass123', retries: 2 });
        const refreshSpy = vi.fn().mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));
        sessionClient.setAuthStrategy({
          getAuthorizationHeader: () => 'Bearer mock-token',
          canRefresh: () => true,
          refresh: refreshSpy,
          isAuthenticated: () => true,
          getType: () => 'session' as const,
        });
        for (const path of ['/race1', '/race2', '/race3']) {
          nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'acme').get(path).reply(401, { error: { message: 'Token expired' } });
          nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'acme').get(path).reply(200, { data: { ok: path } });
        }
        // One view per call, as OpsClient.scope() mints them.
        await Promise.all(['/race1', '/race2', '/race3'].map((path) => sessionClient.withOrg('acme').get(path)));
        expect(refreshSpy).toHaveBeenCalledTimes(1);
      });

      it('rate-limit info recorded through a view is visible on the root', async () => {
        nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'acme').get('/projects')
          .reply(200, list(), { 'x-ratelimit-limit': '100', 'x-ratelimit-remaining': '5', 'x-ratelimit-reset': '60' });
        await projectOps.list(root.withOrg('acme'));
        expect(root.getRateLimitInfo()?.remaining).toBe(5);
      });

      it('a view minted from a view forwards to the same root', async () => {
        const inner = root.withOrg('a').withOrg('b');
        nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'b').get('/projects')
          .reply(200, list(), { 'x-ratelimit-limit': '100', 'x-ratelimit-remaining': '7', 'x-ratelimit-reset': '60' });
        await projectOps.list(inner);
        expect(root.getRateLimitInfo()?.remaining).toBe(7);
      });
    });

    it('sets X-Org-Slug on the view\'s request', async () => {
      nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'acme').get('/projects').reply(200, list());
      await projectOps.list(root.withOrg('acme'));
    });

    it('leaves the root client untouched — no header on its requests (badheaders control)', async () => {
      root.withOrg('acme'); // minting a view must not mutate the root
      nock(BASE_URL, { badheaders: [ORG_SLUG_HEADER] }).get('/projects').reply(200, list());
      await projectOps.list(root);
    });

    it('per-call org WINS over the constructor orgSlug (per-request headers spread last in sdk-core)', async () => {
      const client = new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY, orgSlug: 'ctor-org' });
      nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'per-call').get('/projects').reply(200, list());
      await projectOps.list(client.withOrg('per-call'));
      // and the root of that client still sends the constructor org
      nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'ctor-org').get('/projects').reply(200, list());
      await projectOps.list(client);
    });

    it('covers the verb helpers too (post/patch/delete delegate to request)', async () => {
      const view = root.withOrg('acme');
      nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'acme').post('/projects', { name: 'p' }).reply(201, project());
      await projectOps.create(view, { name: 'p' });
      nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'acme').post('/projects/p/restore').reply(200, project());
      await projectOps.restore(view, 'p');
    });

    it('does not clobber a per-request header the operation itself sets (X-Confirm-Delete on run delete)', async () => {
      nock(BASE_URL)
        .matchHeader(ORG_SLUG_HEADER, 'acme')
        .matchHeader('X-Confirm-Delete', '11111111-1111-4111-8111-111111111111')
        .delete('/runs/11111111-1111-4111-8111-111111111111')
        .reply(200, { data: { deleted: true } });
      await runOps.deleteRun(root.withOrg('acme'), '11111111-1111-4111-8111-111111111111');
    });

    it('a slug that could carry a header injection REJECTS on the first request — nothing reaches the wire', async () => {
      nock(BASE_URL).get('/projects').reply(200, list()); // must stay pending
      for (const bad of ['', 'acme\r\nX-Evil: 1', 'a b', '-leading', 'x'.repeat(101)]) {
        await expect(projectOps.list(root.withOrg(bad)), JSON.stringify(bad)).rejects.toThrow(InputValidationError);
      }
      expect(nock.isDone()).toBe(false); // the control: no request was made
      nock.cleanAll();
    });

    it('6.3.1: the per-call org is set LAST — a caller-supplied unrelated header survives, an org header is refused before any request', async () => {
      nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'acme').matchHeader('X-Trace', 't1').get('/projects').reply(200, list());
      await root.withOrg('acme').request('GET', '/projects', undefined, { headers: { 'X-Trace': 't1' } });
      nock(BASE_URL).get('/projects').reply(200, list()); // must stay pending
      for (const h of ['X-Org-Slug', 'x-org-id']) {
        await expect(root.withOrg('acme').request('GET', '/projects', undefined, { headers: { [h]: 'other' } }), h).rejects.toThrow(InputValidationError);
      }
      expect(nock.isDone()).toBe(false);
      nock.cleanAll();
    });

    it('6.3.1: withOrg("personal") is the root client — no header on the wire (badheaders control)', async () => {
      nock(BASE_URL, { badheaders: [ORG_SLUG_HEADER] }).get('/projects').reply(200, list());
      await projectOps.list(root.withOrg('personal'));
      expect(root.withOrg('personal').scopedOrg).toBeUndefined();
    });

    it('exposes the scoped org for diagnostics', () => {
      expect(root.scopedOrg).toBeUndefined();
      expect(root.withOrg('acme').scopedOrg).toBe('acme');
      nock.cleanAll();
    });

    it('shares the root\'s auth strategy (a session installed on the root is honoured by the view)', () => {
      const view = root.withOrg('acme');
      expect(view.getAuthStrategy()).toBe(root.getAuthStrategy());
      nock.cleanAll();
    });
  });

  describe('OpsClient — options.org on the public surface', () => {
    let client: OpsClient;
    beforeEach(() => {
      client = new OpsClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
    });

    it('projects.list({ org })', async () => {
      nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'acme').get('/projects').reply(200, list());
      await client.projects.list({ org: 'acme' });
    });

    it('projects.list() with no org sends no header (badheaders control)', async () => {
      nock(BASE_URL, { badheaders: [ORG_SLUG_HEADER] }).get('/projects').reply(200, list());
      await client.projects.list();
    });

    it('runs.save({...}, { org }) — the write the whole spec is about', async () => {
      const mockRun = createMockRun({ runNumber: 1 });
      nock(BASE_URL)
        .matchHeader(ORG_SLUG_HEADER, 'ulu-labs')
        .post('/runs')
        .reply(201, {
          data: {
            run: { ...mockRun, orgSlug: 'ulu-labs' },
            agents: [createMockAgentSnapshot({ runId: mockRun.id })],
            correlation: { newIssues: 0, recurringIssues: 0, regressions: 0 },
            deduplicated: false,
          },
        });
      const saved = await client.runs.save(
        { project: 'p', workflowType: 'ship', agents: [{ name: 'a', decision: 'PASS', score: 90 }], recommendations: [] },
        { org: 'ulu-labs', _skipClientValidation: true },
      );
      expect(saved.run.orgSlug).toBe('ulu-labs');
    });

    it('analytics.getAgentPerformance(q, { org }) — reads take it too (D12)', async () => {
      nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'acme').get('/analytics/agents/performance').reply(200, { data: [] });
      await client.analytics.getAgentPerformance(undefined, { org: 'acme' });
    });

    it('issues.get(id, { org }) sends X-Org-Slug (D12)', async () => {
      // Was asserted by the previous test's NAME only — the body never called
      // issues.get (ship run #48, test-architect). Control: the shared
      // afterEach fails on any unconsumed nock, so the matchHeader scope must
      // be hit by exactly this call.
      const issue = createMockIssue();
      nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'acme').get(`/issues/${issue.id}`).reply(200, { data: issue });
      const got = await client.issues.get(issue.id, { org: 'acme' });
      expect(got.id).toBe(issue.id);
    });

    it('an invalid org is rejected before any request is made', async () => {
      await expect(client.projects.list({ org: 'bad slug' })).rejects.toThrow(InputValidationError);
      nock.cleanAll();
    });
  });
});
