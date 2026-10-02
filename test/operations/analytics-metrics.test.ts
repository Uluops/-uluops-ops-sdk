import { describe, it, expect } from 'vitest';
import nock from 'nock';
import { OpsClient } from '../../src/client.js';
import { ANALYTICS_METRICS } from '../../src/operations/analytics.js';
import { BASE_URL, TEST_API_KEY } from '../setup.js';

const client = () => new OpsClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
const rows = {
  agent_performance: { name: 'lens', totalRuns: 1, averageScore: null, passRate: null, totalIssuesFound: 0, runtime: { future: true } },
  resolution_rates: { project: 'p', totalIssues: 1, resolvedIssues: 0, resolutionRate: 0, averageTimeToResolve: null, future: true },
  file_hotspots: { filePath: 'a.ts', issueCount: 1, projects: ['p'], future: true },
  trend_summary: { period: '2026-10-01', newIssues: 1, resolvedIssues: 0, regressions: 0, averageScore: null, future: true },
  taxonomy_distribution: { domain: 'STR', count: 1, percentage: 100, future: true },
  cross_project_patterns: undefined,
};
const cost = (populated: boolean) => ({
  totalCostMicrodollars: populated ? 10 : 0, totalCostDisplay: '$0', totalTokens: populated ? 1 : 0,
  totalInputTokens: populated ? 1 : 0, totalOutputTokens: 0, runCount: populated ? 1 : 0,
  averageCostPerRun: 0, averageCostDisplay: '$0', byModel: { sonnet: { runCount: populated ? 1 : 0, totalCost: 0, costDisplay: '$0', percentage: 0, future: true } },
  costTrend: [], topCostAgents: [], byAgent: [], byProject: [], byWorkflow: [], future: true,
});
const regression = (populated: boolean) => ({ regressionRate: populated ? 50 : null, totalRegressions: populated ? 1 : 0, recurringCount: 0, totalResolved: populated ? 2 : 0, transitionsObserved: 0, agentRegressions: 0, regressionHazardPer1000IssueDays: null, future: true });
const capability = () => nock(BASE_URL).get('/capabilities').reply(200, { contracts: { analytics: ['page-v1'] } });

describe('generic analytics response contracts', () => {
  for (const metric of ANALYTICS_METRICS) for (const populated of [false, true]) {
    it(`${metric} preserves its legacy shape and metadata (${populated ? 'populated' : 'empty'})`, async () => {
      let data: unknown;
      if (metric === 'cost_analysis') data = cost(populated);
      else if (metric === 'regression_analysis') data = regression(populated);
      else {
        const list = populated && rows[metric] ? [rows[metric]] : [];
        data = metric === 'agent_performance' || metric === 'taxonomy_distribution' ? { data: list, total: list.length, future: true } : list;
      }
      nock(BASE_URL).get(`/analytics/${metric}`).reply(200, { data });
      expect(await client().analytics.getByMetric(metric)).toEqual(data);
    });
  }
  for (const metric of Object.keys(rows) as Array<keyof typeof rows>) for (const populated of [false, true]) {
    it(`${metric} parses negotiated ${populated ? 'populated' : 'empty'} pages`, async () => {
      capability();
      const data = populated && rows[metric] ? [rows[metric]] : [];
      const page = { data, total: data.length, limit: 50, offset: 0, hasMore: false,
        implemented: metric !== 'cross_project_patterns', ...(metric === 'cross_project_patterns' && { reason: 'Not implemented' }), future: true };
      nock(BASE_URL).get(`/analytics/${metric}`).query({ format: 'page', limit: 50, offset: 0 }).reply(200, { data: page });
      expect(await client().analytics.getByMetric(metric, { format: 'page' })).toEqual(page);
    });
  }
  it('preserves the true total on a past-end empty page', async () => {
    capability();
    const page = { data: [], total: 3, limit: 1, offset: 10, hasMore: false, implemented: true };
    nock(BASE_URL).get('/analytics/file_hotspots').query({ format: 'page', limit: 1, offset: 10, project: 'p' }).reply(200, { data: page });
    expect(await client().analytics.getByMetric('file_hotspots', { format: 'page', limit: 1, offset: 10, project: 'p' })).toEqual(page);
  });
  for (const metric of ['cost_analysis', 'regression_analysis'] as const) it(`rejects page for ${metric} without HTTP`, async () => {
    await expect(client().analytics.getByMetric(metric, { format: 'page' })).rejects.toMatchObject({ name: 'InputValidationError' });
  });
  for (const query of [{ offset: 0 }, { format: 'page', limit: 101 }, { format: 'page', offset: -1 }, { format: 'page', offset: 0.5 }] as const) it(`rejects invalid query ${JSON.stringify(query)}`, async () => {
    await expect(client().analytics.getByMetric('file_hotspots', query)).rejects.toThrow();
  });
  for (const body of [{ contracts: {} }, { contracts: { analytics: [] } }]) it('refuses an absent capability', async () => {
    nock(BASE_URL).get('/capabilities').reply(200, body);
    await expect(client().analytics.getByMetric('file_hotspots', { format: 'page' })).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTRACT' });
  });
  it('maps a missing capabilities endpoint to unsupported', async () => {
    nock(BASE_URL).get('/capabilities').reply(404, { error: { code: 'NOT_FOUND', message: 'missing' } });
    await expect(client().analytics.getByMetric('file_hotspots', { format: 'page' })).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTRACT' });
  });
  it('preserves capability authorization errors', async () => {
    nock(BASE_URL).get('/capabilities').reply(403, { error: { code: 'FORBIDDEN', message: 'denied' } });
    await expect(client().analytics.getByMetric('file_hotspots', { format: 'page' })).rejects.toMatchObject({ statusCode: 403 });
  });
  it('negotiates independently across scoped organizations', async () => {
    const sdk = client();
    for (const org of ['alpha', 'beta']) {
      nock(BASE_URL, { reqheaders: { 'x-org-slug': org } }).get('/capabilities').reply(200, { contracts: {} });
      await expect(sdk.analytics.getByMetric('file_hotspots', { format: 'page' }, { org })).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTRACT' });
    }
  });
  for (const change of [{ implemented: false }, { hasMore: true }, { total: '1' }, { data: [{}] }]) it(`rejects malformed page ${JSON.stringify(change)}`, async () => {
    capability();
    nock(BASE_URL).get('/analytics/file_hotspots').query(true).reply(200, { data: { data: [], total: 0, limit: 50, offset: 0, hasMore: false, implemented: true, ...change } });
    await expect(client().analytics.getByMetric('file_hotspots', { format: 'page' })).rejects.toThrow();
  });
  it('rejects malformed legacy rows', async () => {
    nock(BASE_URL).get('/analytics/file_hotspots').reply(200, { data: [{ issueCount: 'bad' }] });
    await expect(client().analytics.getByMetric('file_hotspots')).rejects.toThrow();
  });
});
