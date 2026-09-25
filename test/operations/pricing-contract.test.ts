import { describe, expect, it } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import { getByMetric } from '../../src/operations/analytics.js';
import { CostCoverageResponseSchema } from '../../src/types/cost-coverage.js';
import { BASE_URL, TEST_API_KEY } from '../setup.js';

const client = () => new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
const coverage = {
  pricingContract: 'coverage-v1', costUnit: 'microdollars', pricedCost: null, pricedCostDisplay: null,
  runCount: 1, pricedRunCount: 0, unpricedRunCount: 1, snapshotCount: 1, pricedSnapshotCount: 0,
  unpricedSnapshotCount: 1, totalTokens: 100, totalInputTokens: 100, totalOutputTokens: 0,
  pricedTokens: 0, unpricedTokens: 100, coverage: { runs: 0, snapshots: 0, tokens: 0, unit: 'ratio' },
  pricing: { source: 'configured table', lastVerified: '2025-03-27', basis: 'configured-rate-table' },
  byModel: [], byAgent: [], byProject: [], byWorkflow: [], costTrend: [],
};

describe('pricing contract', () => {
  it('negotiates independently for concurrent org-scoped operations', async () => {
    const http = client();
    nock(BASE_URL, { reqheaders: { 'x-org-slug': 'org-a' } }).get('/capabilities')
      .reply(200, { contracts: { pricing: ['coverage-v1'] } });
    nock(BASE_URL, { reqheaders: { 'x-org-slug': 'org-a' } }).get('/analytics/cost_analysis')
      .query({ pricingContract: 'coverage-v1' }).reply(200, { data: coverage });
    nock(BASE_URL, { reqheaders: { 'x-org-slug': 'org-b' } }).get('/capabilities')
      .reply(200, { contracts: {} });
    const results = await Promise.allSettled(['org-a', 'org-b'].map(org =>
      getByMetric(http.withOrg(org), 'cost_analysis', { pricingContract: 'coverage-v1' })));
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: { pricedCost: null } });
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { code: 'UNSUPPORTED_CONTRACT' } });
  });
  it('negotiates each operation and preserves nullable data, estimates, and camelCase query options', async () => {
    const http = client();
    for (const estimateModel of [undefined, 'sonnet'] as const) {
      nock(BASE_URL).get('/capabilities').reply(200, { contracts: { pricing: ['coverage-v1'] } });
      const data = { ...coverage, futureField: true, ...(estimateModel && { estimate: {
        estimatedCost: 300, assumedModel: 'sonnet', inputRate: 3000000, outputRate: 15000000,
        rateUnit: 'microdollars-per-million-tokens', source: 'configured table', lastVerified: '2025-03-27',
        scope: 'unpriced-snapshots-only',
      } }) };
      nock(BASE_URL).get('/analytics/cost_analysis')
        .query({ project: 'pricing', pricingContract: 'coverage-v1', ...(estimateModel && { estimateModel }) })
        .reply(200, { data });
      expect(await getByMetric(http, 'cost_analysis', { project: 'pricing', pricingContract: 'coverage-v1', estimateModel })).toEqual(data);
    }
    expect(nock.isDone()).toBe(true);
  });

  it.each([404, 200])('refuses absent capability (%s) without requesting legacy cost', async status => {
    nock(BASE_URL).get('/capabilities').reply(status, status === 404 ? { error: { code: 'NOT_FOUND' } } : { contracts: {} });
    await expect(getByMetric(client(), 'cost_analysis', { pricingContract: 'coverage-v1' }))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_CONTRACT', family: 'pricing' });
  });

  it('preserves authentication errors', async () => {
    nock(BASE_URL).get('/capabilities').reply(403, { error: { code: 'FORBIDDEN', message: 'Org denied' } });
    await expect(getByMetric(client(), 'cost_analysis', { pricingContract: 'coverage-v1' }))
      .rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('rejects invalid selections before making requests', async () => {
    await expect(getByMetric(client(), 'cost_analysis', { estimateModel: 'sonnet' })).rejects.toMatchObject({ name: 'InputValidationError' });
    await expect(getByMetric(client(), 'agent_performance', { pricingContract: 'coverage-v1' })).rejects.toMatchObject({ name: 'InputValidationError' });
  });

  it('requires the selected response contract; an old numeric response is not coverage', async () => {
    nock(BASE_URL).get('/capabilities').reply(200, { contracts: { pricing: ['coverage-v1'] } });
    nock(BASE_URL).get('/analytics/cost_analysis').query(true).reply(200, { data: { totalCostMicrodollars: 100 } });
    await expect(getByMetric(client(), 'cost_analysis', { pricingContract: 'coverage-v1' })).rejects.toThrow();
    expect(CostCoverageResponseSchema.parse({ ...coverage, pricedCost: 0, pricedCostDisplay: '$0.00' }).pricedCost).toBe(0);
  });

  it('preserves a legacy cost object without capability requests', async () => {
    const data = { totalCostMicrodollars: 0, totalCostDisplay: '$0.00', totalTokens: 0,
      totalInputTokens: 0, totalOutputTokens: 0, runCount: 0, averageCostPerRun: 0,
      averageCostDisplay: '$0.00', byModel: {}, costTrend: [], topCostAgents: [], byAgent: [], byProject: [], byWorkflow: [] };
    nock(BASE_URL).get('/analytics/cost_analysis').reply(200, { data });
    expect(await getByMetric(client(), 'cost_analysis')).toEqual(data);
  });
});
