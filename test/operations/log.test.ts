/**
 * ulu log (spec v0.1.13; checklist Phase 3): `projects.getLog`,
 * `projects.getLogStat`, `orgs.list`, `orgs.getLogStat`.
 *
 * Every assertion is on the OUTGOING REQUEST as nock sees it or on a VALUE
 * that survived the Zod parse. The load-bearing control is the query casing:
 * the API's log schema is camelCase and non-strict, so a snake_cased key
 * (`workflow_type`) is silently dropped with a 200 — the filter just
 * vanishes. The nock matcher below is exact on `workflowType` /
 * `includeArchived`, and a control asserts the generic snake_casing path
 * would NOT have matched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { ZodError } from 'zod';
import { OpsClient } from '../../src/client.js';
import { OpsHttpClient, ORG_SLUG_HEADER, toApiQuery } from '../../src/http/http-client.js';
import * as projectOps from '../../src/operations/projects.js';
import * as orgOps from '../../src/operations/orgs.js';
import { BASE_URL, TEST_API_KEY } from '../setup.js';
import { TEST_IDS } from '../contract-helpers.js';

const runEvent = {
  type: 'run', runNumber: 47, at: '2026-09-13T10:00:00.000Z', workflowType: 'ship',
  definitionType: 'workflow', definitionName: 'ship', definitionVersion: '1.2.0',
  averageScore: 88.5, allGatesPassed: true, counts: { new: 1, recurring: 3, regressions: 0, observed: 2 }, agents: ['code-validator'],
};
const oldRunEvent = { ...runEvent, runNumber: 3, at: '2026-05-01T10:00:00.000Z', counts: null, definitionType: null, definitionName: null, definitionVersion: null, averageScore: null, allGatesPassed: null, agents: [] };
const decisionEvent = {
  type: 'decision', issueId: TEST_IDS.issue1, fingerprint: 'abcdef123456', title: 'Missing null check',
  from: 'open', to: 'completed', reason: null, source: null, at: '2026-09-13T09:59:59.123Z', seq: 1042,
};
const regressionEvent = {
  type: 'regression', issueId: TEST_IDS.issue2, fingerprint: '0123456789ab', title: 'Race in cache',
  viaRunNumber: null, source: 'agent', at: '2026-09-13T09:59:58.000Z', seq: 1041,
};

const statBody = {
  window: { since: null, until: null },
  examined: { runs: 47, first: '2026-01-12T00:00:00.000Z', last: '2026-09-13T10:00:00.000Z', byWorkflow: [{ workflowType: 'ship', runs: 41 }, { workflowType: 'security-audit', runs: 6 }], definitions: 9 },
  found: { issues: 41 },
  decided: { completed: 24, deferred: 6, wontfix: 3, 'false-positive': 2, observation: 3, open: 3, withReason: { completed: 22, deferred: 6, wontfix: 3, 'false-positive': 2, observation: 2 } },
  cameBack: { detected: 2, detectedEvents: 3, reopened: 4, reopenedEvents: 4, lastDetectedAtAllTime: '2026-05-04T00:00:00.000Z' },
  activity: { decisions: 122, byStatus: { completed: 90, deferred: 12, wontfix: 9, 'false-positive': 4, observation: 3, open: 4, merged: 0 }, restated: 7, runsWithCorrelation: 47 },
};

describe('projects.getLog — the stream (§3.2)', () => {
  let client: OpsHttpClient;
  beforeEach(() => { client = new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY }); });
  afterEach(() => nock.cleanAll());

  it('GETs /projects/:id/log and returns the page envelope with all three event kinds parsed', async () => {
    nock(BASE_URL).get('/projects/billing/log').reply(200, { data: [runEvent, decisionEvent, regressionEvent, oldRunEvent], count: 4, hasMore: true, nextCursor: 'eyJhdCI6...' });
    const page = await projectOps.getLog(client, 'billing');
    expect(page.count).toBe(4);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('eyJhdCI6...');
    expect(page.data.map((e) => e.type)).toEqual(['run', 'decision', 'regression', 'run']);
    const [run, decision, regression, old] = page.data;
    if (run?.type !== 'run' || decision?.type !== 'decision' || regression?.type !== 'regression' || old?.type !== 'run') throw new Error('narrowing failed');
    expect(run.counts).toEqual({ new: 1, recurring: 3, regressions: 0, observed: 2 });
    expect(old.counts).toBeNull();            // pre-065 run: null, not zeros
    expect(decision.reason).toBeNull();       // no reason recorded
    expect(decision.source).toBeNull();       // unattributed, not "human"
    expect(regression.viaRunNumber).toBeNull();
    expect(regression.source).toBe('agent');
  });

  it('sends the query keys AS NAMED — workflowType / includeArchived — with kind comma-joined (exact matcher)', async () => {
    nock(BASE_URL)
      .get('/projects/billing/log')
      .query({ since: '2026-09-01T00:00:00Z', until: '2026-09-15T00:00:00Z', limit: '25', cursor: 'c1', kind: 'run,regression', workflowType: 'ship', agent: 'code-validator', includeArchived: 'true' })
      .reply(200, { data: [], count: 0, hasMore: false });
    const page = await projectOps.getLog(client, 'billing', {
      since: '2026-09-01T00:00:00Z', until: '2026-09-15T00:00:00Z', limit: 25, cursor: 'c1', kind: ['run', 'regression'], workflowType: 'ship', agent: 'code-validator', includeArchived: true,
    });
    expect(page.data).toEqual([]);
    expect(nock.isDone()).toBe(true);
  });

  it('CONTROL: the generic snake_casing path would have sent workflow_type — which the API ignores — so it is not what getLog uses', () => {
    const generic = toApiQuery({ workflowType: 'ship', includeArchived: true });
    expect(generic).toHaveProperty('workflow_type', 'ship');
    expect(generic).not.toHaveProperty('workflowType');
    const ours = projectOps.logQueryParams({ workflowType: 'ship', includeArchived: true, kind: [] });
    expect(ours).toEqual({ workflowType: 'ship', includeArchived: 'true' }); // empty kind omitted, boolean stringified
  });

  it('URL-encodes the project name and carries the per-call org header', async () => {
    nock(BASE_URL, { reqheaders: { [ORG_SLUG_HEADER]: 'acme' } }).get('/projects/my%20project/log').reply(200, { data: [], count: 0, hasMore: false });
    const ops = new OpsClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
    const page = await ops.projects.getLog('my project', undefined, { org: 'acme' });
    expect(page.count).toBe(0);
    expect(nock.isDone()).toBe(true);
  });

  it('rejects a page whose event has an unknown type (the union is closed)', async () => {
    nock(BASE_URL).get('/projects/billing/log').reply(200, { data: [{ ...runEvent, type: 'merge' }], count: 1, hasMore: false });
    await expect(projectOps.getLog(client, 'billing')).rejects.toBeInstanceOf(ZodError);
  });
});

describe('projects.getLogStat / orgs.getLogStat — the rollup (§3.3, §3.6)', () => {
  let client: OpsHttpClient;
  beforeEach(() => { client = new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY }); });
  afterEach(() => nock.cleanAll());

  it('project: GETs /projects/:id/log/stat with the window and unwraps {data}', async () => {
    nock(BASE_URL).get('/projects/billing/log/stat').query({ since: '2026-01-01T00:00:00Z' }).reply(200, { data: { projectId: TEST_IDS.proj1, ...statBody } });
    const stat = await projectOps.getLogStat(client, 'billing', { since: '2026-01-01T00:00:00Z' });
    expect(stat.projectId).toBe(TEST_IDS.proj1);
    expect(stat.decided.withReason.completed).toBe(22);
    expect(stat.activity.byStatus.merged).toBe(0);
    expect(stat.cameBack.lastDetectedAtAllTime).toBe('2026-05-04T00:00:00.000Z');
  });

  it('org: GETs /orgs/:slug/log/stat and parses projects[], hasMoreProjects and computedAt', async () => {
    const body = {
      org: 'ulu-labs', computedAt: '2026-09-15T21:44:44.938Z', ...statBody,
      projects: [
        { name: 'ops-uluops-api', runs: 47, issues: 41, fixed: 24, regressions: 2, lastRunAt: '2026-09-13T10:00:00.000Z' },
        { name: 'quiet', runs: 0, issues: 0, fixed: 0, regressions: 0, lastRunAt: null },
      ],
      hasMoreProjects: false,
    };
    nock(BASE_URL).get('/orgs/ulu-labs/log/stat').reply(200, { data: body });
    const stat = await orgOps.getLogStat(client, 'ulu-labs');
    expect(stat.org).toBe('ulu-labs');
    expect(stat.computedAt).toBe('2026-09-15T21:44:44.938Z');
    expect(stat.projects[1]?.lastRunAt).toBeNull();
    expect(stat.hasMoreProjects).toBe(false);
    expect((stat as Record<string, unknown>)['projectId']).toBeUndefined();
  });

  it('org: a body missing computedAt fails the parse (the field is required since D16)', async () => {
    nock(BASE_URL).get('/orgs/ulu-labs/log/stat').reply(200, { data: { org: 'ulu-labs', ...statBody, projects: [], hasMoreProjects: false } });
    await expect(orgOps.getLogStat(client, 'ulu-labs')).rejects.toBeInstanceOf(ZodError);
  });

  it('org: the slug is URL-encoded and the read carries NO org header from a scoped client view', async () => {
    nock(BASE_URL, { badheaders: [ORG_SLUG_HEADER] }).get('/orgs/a%2Fb/log/stat').reply(200, { data: { org: 'a/b', computedAt: '2026-09-15T00:00:00.000Z', ...statBody, projects: [], hasMoreProjects: false } });
    const ops = new OpsClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
    const stat = await ops.orgs.getLogStat('a/b');
    expect(stat.org).toBe('a/b');
    expect(nock.isDone()).toBe(true);
  });
});

describe('orgs.list — GET /orgs', () => {
  afterEach(() => nock.cleanAll());

  it('returns the organizations array from {data:{organizations}}, personal org included', async () => {
    const rows = [
      { id: TEST_IDS.user1, name: 'alexself2', slug: 'alexself2', isPersonal: true, role: 'owner', memberCount: 1, subscriptionTier: 'enterprise', paymentStatus: 'none', suspendedAt: null },
      { id: TEST_IDS.proj1, name: 'Ulu Labs', slug: 'ulu-labs', isPersonal: false, role: 'admin', memberCount: 3, subscriptionTier: 'enterprise', paymentStatus: 'none', suspendedAt: null },
    ];
    nock(BASE_URL).get('/orgs').reply(200, { data: { organizations: rows } });
    const ops = new OpsClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
    const orgs = await ops.orgs.list();
    expect(orgs.map((o) => `${o.slug}:${o.role}:${String(o.isPersonal)}`)).toEqual(['alexself2:owner:true', 'ulu-labs:admin:false']);
  });
});
