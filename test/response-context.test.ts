import { describe, it, expect, vi } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../src/http/http-client.js';
import { OpsClient } from '../src/client.js';
import { BASE_URL, TEST_API_KEY } from './setup.js';
import { createMockRun } from './contract-helpers.js';
const headers = (orgSlug = 'team-a') => ({ 'X-UluOps-Context-Version': '1', 'X-UluOps-Org-Slug': orgSlug, 'X-UluOps-Org-Source': 'bound-key' });
const client = () => new OpsClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY, retries: 0 });
const input = { project: 'context', workflowType: 'explore', agents: [{ name: 'explorer', decision: 'TRACED' }], recommendations: [] };
const result = () => ({ data: { run: createMockRun(), agents: [], correlation: null, deduplicated: false } });

describe('F13 scoped operation response context', () => {
  it('shares refresh and rate-limit state through unscoped capture views', async () => {
    const root = new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY, retries: 2 });
    const refreshed = { getAuthorizationHeader: () => 'Bearer new', canRefresh: () => false, isAuthenticated: () => true, getType: () => 'session' as const };
    const refresh = vi.fn(async () => { await new Promise(resolve => setTimeout(resolve, 20)); root.setAuthStrategy(refreshed); });
    root.setAuthStrategy({ ...refreshed, getAuthorizationHeader: () => 'Bearer old', canRefresh: () => true, refresh });
    for (const path of ['/one', '/two']) {
      nock(BASE_URL).get(path).reply(401, { error: { message: 'expired' } });
      nock(BASE_URL).get(path).reply(200, { data: [] }, { ...headers(), 'x-ratelimit-limit': '100', 'x-ratelimit-remaining': '5', 'x-ratelimit-reset': '60' });
    }
    const a = root.withResponseCapture(() => {});
    const b = root.withResponseCapture(() => {});
    await Promise.all([a.get('/one'), b.get('/two')]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(root.getRateLimitInfo()?.remaining).toBe(5);
    expect(b.getAuthStrategy()).toBe(refreshed);
    a.setAuthStrategy({ ...refreshed, getAuthorizationHeader: () => 'Bearer replacement' });
    expect(root.getAuthStrategy().getAuthorizationHeader()).toBe('Bearer replacement');
  });
  it('keeps concurrent orgs isolated and preserves the transformed data shape', async () => {
    nock(BASE_URL, { reqheaders: { 'X-Org-Slug': 'team-a' } }).get('/projects').delay(30).reply(200, { data: [], total: 0 }, headers('team-a'));
    nock(BASE_URL, { reqheaders: { 'X-Org-Slug': 'team-b' } }).get('/projects').reply(200, { data: [], total: 0 }, headers('team-b'));
    const c = client();
    const [a,b] = await Promise.all([c.projects.list({ org: 'team-a', withResponseContext: true }), c.projects.list({ org: 'team-b', withResponseContext: true })]);
    expect(a).toEqual({ data: { data: [], total: 0 }, context: { version: 1, orgSlug: 'team-a', source: 'bound-key' } });
    expect(b.context?.orgSlug).toBe('team-b');
  });
  it('reports a bound key org even when the caller omitted org', async () => {
    nock(BASE_URL).post('/runs').reply(201, result(), headers());
    expect((await client().runs.save(input, { withResponseContext: true })).context?.orgSlug).toBe('team-a');
  });
  it('uses the final write context, never stale preflight context', async () => {
    nock(BASE_URL).get('/capabilities').reply(200, { contracts: { idempotency: ['report-v2'] } }, headers('preflight'))
      .post('/runs').reply(201, result());
    const saved = await client().runs.save({ ...input, idempotencyContract: 'report-v2' }, { withResponseContext: true });
    expect(saved.context).toBeNull();
    expect(saved.data.run.id).toBeTruthy();
  });
  it('does not attach preflight context to a subsequent network error', async () => {
    nock(BASE_URL).get('/capabilities').reply(200, { contracts: { idempotency: ['report-v2'] } }, headers())
      .post('/runs').replyWithError('Connection lost');
    await expect(client().runs.save({ ...input, idempotencyContract: 'report-v2' }, { withResponseContext: true })).rejects.toMatchObject({ responseContext: null });
  });
  it('attaches context to post-write parsing failures', async () => {
    nock(BASE_URL).post('/runs').reply(201, { data: { unexpected: true } }, headers());
    await expect(client().runs.save(input, { withResponseContext: true })).rejects.toMatchObject({ name: 'ZodError', responseContext: { orgSlug: 'team-a' } });
  });
  it('keeps old-server data usable with null context and preserves the default result', async () => {
    nock(BASE_URL).get('/projects').twice().reply(200, { data: [], total: 0 });
    expect(await client().projects.list({ withResponseContext: true })).toEqual({ data: { data: [], total: 0 }, context: null });
    expect(await client().projects.list()).toEqual({ data: [], total: 0 });
  });
});
