import { describe, it, expect } from 'vitest';
import nock from 'nock';
import { ProjectResponseSchema } from '../src/types/response-schemas.js';
import { OpsClient } from '../src/client.js';
import { BASE_URL, TEST_API_KEY, TEST_UUID, createMockProject } from './setup.js';

const client = () => new OpsClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY, retries: 0 });
const emptyPage = { data: [], total: 0, limit: 50, offset: 0, hasMore: false };
const capabilities = { contracts: { discovery: ['page-v1'] } };
const headers = (org: string) => ({ 'X-UluOps-Context-Version': '1', 'X-UluOps-Org-Slug': org, 'X-UluOps-Org-Source': 'bound-key' });

describe('discovery page-v1 contract', () => {
  it.each([
    ['projects', '/projects', (c: OpsClient) => c.discovery.listProjects()],
    ['issues', '/projects/a%2Fb/issues', (c: OpsClient) => c.discovery.queryIssues('a/b')],
    ['search', '/issues/search', (c: OpsClient) => c.discovery.searchIssues({ query: 'needle' })],
    ['runs', '/runs/project/a%2Fb', (c: OpsClient) => c.discovery.listRuns('a/b')],
    ['records', '/analysis/records', (c: OpsClient) => c.discovery.queryAnalysisRecords()],
    ['project analysis', '/projects/a%2Fb/analysis', (c: OpsClient) => c.discovery.getProjectAnalysis('a/b')],
    ['agent analysis', '/agents/a%2Fb/runs-analysis', (c: OpsClient) => c.discovery.getAgentRunsAnalysis('a/b', { project: 'p' })],
  ] as const)('negotiates and returns metadata for %s', async (name, path, invoke) => {
    nock(BASE_URL).get('/capabilities').reply(200, capabilities);
    nock(BASE_URL).get(path).query({ format: 'page', ...(name === 'search' ? { query: 'needle' } : {}), ...(name === 'agent analysis' ? { project: 'p' } : {}) }).reply(200, emptyPage);
    expect(await invoke(client())).toEqual(emptyPage);
  });

  it.each([{}, { contracts: { discovery: [] } }, { contracts: { discovery: ['future'] } }])('refuses an absent selector without a list request: %j', async body => {
    nock(BASE_URL).get('/capabilities').reply(200, body);
    await expect(client().discovery.listProjects()).rejects.toMatchObject({ name: 'UnsupportedContractError' });
  });
  it('refuses a missing capabilities endpoint without falling back', async () => {
    nock(BASE_URL).get('/capabilities').reply(404, { error: { code: 'NOT_FOUND', message: 'missing' } });
    await expect(client().discovery.listProjects()).rejects.toMatchObject({ name: 'UnsupportedContractError' });
  });
  it.each([401, 403])('preserves capability authorization failure %s', async status => {
    nock(BASE_URL).get('/capabilities').reply(status, { error: { code: 'FORBIDDEN', message: 'denied' } });
    await expect(client().discovery.listProjects()).rejects.toMatchObject({ statusCode: status, message: expect.stringContaining('denied') });
  });
  it('preserves a masked authorization 404 instead of calling it unsupported', async () => {
    nock(BASE_URL).get('/capabilities').reply(404, { error: { code: 'ORG_ACCESS_DENIED', message: 'scope denied' } });
    await expect(client().discovery.listProjects()).rejects.toMatchObject({ statusCode: 404, code: 'ORG_ACCESS_DENIED' });
  });
  it('negotiates separately per org and returns final context, not capability context', async () => {
    const c = client();
    for (const org of ['team-a', 'team-b']) {
      nock(BASE_URL, { reqheaders: { 'X-Org-Slug': org } }).get('/capabilities').reply(200, capabilities, headers('preflight'))
        .get('/projects').query({ format: 'page' }).reply(200, emptyPage, org === 'team-a' ? headers(org) : {});
      expect(await c.discovery.listProjects({}, { org, withResponseContext: true })).toEqual({ data: emptyPage, context: org === 'team-a' ? { version: 1, orgSlug: org, source: 'bound-key' } : null });
    }
  });
  it('maps archive visibility and other query controls to exact camelCase wire keys', async () => {
    nock(BASE_URL).get('/capabilities').reply(200, capabilities);
    nock(BASE_URL).get('/runs/project/p').query({ format: 'page', showArchived: true, workflowType: 'audit', sortBy: 'runNumber', sortOrder: 'asc', limit: 2, offset: 3, fields: 'id' }).reply(200, { ...emptyPage, limit: 2, offset: 3 });
    expect(await client().discovery.listRuns('p', { includeArchived: true, workflowType: 'audit', sortBy: 'runNumber', sortOrder: 'asc', limit: 2, offset: 3, fields: ['id'] })).toEqual({ ...emptyPage, limit: 2, offset: 3 });
  });
  it('forwards scope and issue filters without snake_case conversion', async () => {
    nock(BASE_URL).get('/capabilities').reply(200, capabilities);
    nock(BASE_URL).get('/projects/p/issues').query({ format: 'page', workflowType: 'audit', classified: false, failureMode: 'missing', includeResolved: true, offset: 10 }).reply(200, { ...emptyPage, offset: 10 });
    await client().discovery.queryIssues('p', { workflowType: 'audit', classified: false, failureMode: 'missing', includeResolved: true, offset: 10 });
  });
  it('retains identity and metadata while projecting public fields', async () => {
    nock(BASE_URL).get('/capabilities').reply(200, capabilities);
    nock(BASE_URL).get('/projects').query({ format: 'page', fields: 'name' }).reply(200, { data: [{ id: TEST_UUID, name: 'p', ownerId: 'hidden' }], total: 2, limit: 1, offset: 0, hasMore: true });
    expect(await client().discovery.listProjects({ fields: ['name'] })).toEqual({ data: [{ id: TEST_UUID, name: 'p' }], total: 2, limit: 1, offset: 0, hasMore: true });
  });
  it.each(['privateSecret', '__proto__', 'toString'])('rejects invalid projection field %s before HTTP', async field => {
    await expect(client().discovery.listProjects({ fields: [field] })).rejects.toMatchObject({ name: 'ZodError' });
  });
  it.each([
    { ...emptyPage, total: -1 }, { ...emptyPage, hasMore: true }, { ...emptyPage, limit: 101 },
    { ...emptyPage, data: [{ name: 'missing id' }], total: 1 },
    { ...emptyPage, data: [{ id: TEST_UUID, name: 42 }], total: 1 },
  ])('rejects malformed page %j', async page => {
    nock(BASE_URL).get('/capabilities').reply(200, capabilities);
    nock(BASE_URL).get('/projects').query({ format: 'page', fields: 'name' }).reply(200, page);
    await expect(client().discovery.listProjects({ fields: ['name'] })).rejects.toMatchObject({ name: 'ZodError' });
  });
  it('accepts public run highCount projection', async () => {
    const result = { ...emptyPage, data: [{ id: TEST_UUID, highCount: 3 }], total: 1 };
    nock(BASE_URL).get('/capabilities').reply(200, capabilities);
    nock(BASE_URL).get('/runs/project/p').query({ format: 'page', fields: 'highCount' }).reply(200, result);
    expect(await client().discovery.listRuns('p', { fields: ['highCount'] })).toEqual(result);
  });
  it('accepts public issue attribution and semantic identity fields', async () => {
    const result = { ...emptyPage, data: [{ id: TEST_UUID, authorId: TEST_UUID, semanticFingerprint: 'fingerprint' }], total: 1 };
    nock(BASE_URL).get('/capabilities').reply(200, capabilities);
    nock(BASE_URL).get('/projects/p/issues').query({ format: 'page', fields: 'authorId,semanticFingerprint' }).reply(200, result);
    expect(await client().discovery.queryIssues('p', { fields: ['authorId', 'semanticFingerprint'] })).toEqual(result);
  });
  it('rejects non-public run detail fields before negotiation', async () => {
    await expect(client().discovery.listRuns('p', { fields: ['deletedAt'] })).rejects.toMatchObject({ name: 'ZodError' });
  });
  it('preserves legacy list output without capability negotiation', async () => {
    const project = createMockProject();
    nock(BASE_URL).get('/projects').reply(200, { data: [project], total: 1 });
    expect(await client().projects.list()).toEqual({ data: [ProjectResponseSchema.parse(project)], total: 1 });
  });
});
