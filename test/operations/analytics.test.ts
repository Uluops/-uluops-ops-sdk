import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as analyticsOps from '../../src/operations/analytics.js';
import { BASE_URL } from '../setup.js';

describe('Analytics Operations', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: 'ulr_test-api-key-12345',
    });
  });

  describe('getValidatorPerformance', () => {
    it('should get validator performance metrics', async () => {
      nock(BASE_URL)
        .get('/analytics/validators/performance')
        .reply(200, {
          data: [
            { validator: 'code-validator', avgScore: 85.5, runCount: 100, passRate: 0.92 },
            { validator: 'test-architect', avgScore: 78.2, runCount: 80, passRate: 0.85 },
          ],
        });

      const perf = await analyticsOps.getValidatorPerformance(client);

      expect(perf).toHaveLength(2);
      expect(perf[0].validator).toBe('code-validator');
      expect(perf[0].avgScore).toBe(85.5);
    });

    it('should filter by project', async () => {
      nock(BASE_URL)
        .get('/analytics/validators/performance')
        .query({ project: 'proj-1' })
        .reply(200, {
          data: [{ validator: 'code-validator', avgScore: 90, runCount: 50 }],
        });

      const perf = await analyticsOps.getValidatorPerformance(client, { project: 'proj-1' });

      expect(perf).toHaveLength(1);
    });
  });

  describe('getValidatorReliability', () => {
    it('should get validator reliability stats', async () => {
      nock(BASE_URL)
        .get('/analytics/validators/reliability')
        .reply(200, {
          data: {
            validators: [
              {
                validator: 'code-validator',
                falsePositiveRate: 0.05,
                resolutionRate: 0.75,
                reliabilityScore: 0.92,
              },
            ],
          },
        });

      const result = await analyticsOps.getValidatorReliability(client);

      expect(result.validators).toHaveLength(1);
      expect(result.validators[0].reliabilityScore).toBe(0.92);
    });

    it('should filter by validator name', async () => {
      nock(BASE_URL)
        .get('/analytics/validators/reliability')
        .query({ validator: 'test-architect' })
        .reply(200, {
          data: {
            validators: [{ validator: 'test-architect', reliabilityScore: 0.88 }],
          },
        });

      const result = await analyticsOps.getValidatorReliability(client, {
        validator: 'test-architect',
      });

      expect(result.validators[0].validator).toBe('test-architect');
    });
  });

  describe('getResolutionRates', () => {
    it('should get resolution rates by project', async () => {
      nock(BASE_URL)
        .get('/analytics/projects/resolution-rates')
        .reply(200, {
          data: [
            { project: 'proj-1', resolvedCount: 50, totalCount: 100, rate: 0.5 },
            { project: 'proj-2', resolvedCount: 80, totalCount: 100, rate: 0.8 },
          ],
        });

      const rates = await analyticsOps.getResolutionRates(client);

      expect(rates).toHaveLength(2);
      expect(rates[0].rate).toBe(0.5);
    });
  });

  describe('getFileHotspots', () => {
    it('should get files with most issues', async () => {
      nock(BASE_URL)
        .get('/analytics/files/hotspots')
        .reply(200, {
          data: [
            { filePath: 'src/auth.ts', issueCount: 15, severity: 'high' },
            { filePath: 'src/api/client.ts', issueCount: 10, severity: 'medium' },
          ],
        });

      const hotspots = await analyticsOps.getFileHotspots(client);

      expect(hotspots).toHaveLength(2);
      expect(hotspots[0].filePath).toBe('src/auth.ts');
      expect(hotspots[0].issueCount).toBe(15);
    });

    it('should filter by days', async () => {
      nock(BASE_URL)
        .get('/analytics/files/hotspots')
        .query({ days: 7 })
        .reply(200, {
          data: [{ filePath: 'src/recent.ts', issueCount: 5 }],
        });

      const hotspots = await analyticsOps.getFileHotspots(client, { days: 7 });

      expect(hotspots).toHaveLength(1);
    });
  });

  describe('getTaxonomyDistribution', () => {
    it('should get basic taxonomy distribution', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/distribution')
        .reply(200, {
          data: [
            { domain: 'STR', count: 50 },
            { domain: 'SEM', count: 80 },
            { domain: 'PRA', count: 30 },
            { domain: 'EPI', count: 20 },
          ],
        });

      const dist = await analyticsOps.getTaxonomyDistribution(client);

      expect(dist).toHaveLength(4);
      expect(dist.find((d) => d.domain === 'SEM')?.count).toBe(80);
    });
  });

  describe('getFullTaxonomy', () => {
    it('should get full taxonomy analytics', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/full')
        .reply(200, {
          data: {
            data: {
              byDomain: [
                { domain: 'STR', count: 50, percentage: 0.28 },
                { domain: 'SEM', count: 80, percentage: 0.44 },
              ],
              byMode: [
                { mode: 'STR-OMI', count: 20 },
                { mode: 'SEM-VAL', count: 30 },
              ],
              bySeverity: [
                { severity: 'critical', count: 10 },
                { severity: 'high', count: 40 },
              ],
            },
            computedAt: '2024-01-15T12:00:00Z',
          },
        });

      const result = await analyticsOps.getFullTaxonomy(client);

      expect(result.data.byDomain).toHaveLength(2);
      expect(result.computedAt).toBe('2024-01-15T12:00:00Z');
    });
  });

  describe('getBurndown', () => {
    it('should get burndown time series', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/burndown')
        .reply(200, {
          data: {
            timeSeries: [
              { date: '2024-01-01', STR: 50, SEM: 80, PRA: 30, EPI: 20 },
              { date: '2024-01-08', STR: 45, SEM: 70, PRA: 25, EPI: 18 },
            ],
            trends: {
              STR: { direction: 'declining', rate: -0.05 },
              SEM: { direction: 'declining', rate: -0.08 },
            },
            diagnostics: { dataPoints: 2, reliability: 'medium' },
          },
        });

      const burndown = await analyticsOps.getBurndown(client);

      expect(burndown.timeSeries).toHaveLength(2);
      expect(burndown.trends.STR.direction).toBe('declining');
    });

    it('should accept query parameters', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/burndown')
        .query({ project: 'proj-1', days: 30 })
        .reply(200, {
          data: {
            timeSeries: [],
            trends: {},
          },
        });

      await analyticsOps.getBurndown(client, { project: 'proj-1', days: 30 });
    });
  });

  describe('getVelocity', () => {
    it('should get velocity per failure mode', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/velocity')
        .reply(200, {
          data: {
            modes: [
              { mode: 'STR-OMI', velocity: -5, trend: 'improving', sparkline: [10, 8, 6, 5] },
              { mode: 'SEM-VAL', velocity: 3, trend: 'degrading', sparkline: [5, 6, 7, 8] },
            ],
            alerts: [{ mode: 'SEM-VAL', message: 'Velocity exceeds threshold' }],
          },
        });

      const velocity = await analyticsOps.getVelocity(client);

      expect(velocity.modes).toHaveLength(2);
      expect(velocity.modes[0].trend).toBe('improving');
    });

    it('should accept alert threshold', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/velocity')
        .query({ alert_threshold: 10 })
        .reply(200, {
          data: { modes: [], alerts: [] },
        });

      await analyticsOps.getVelocity(client, { alertThreshold: 10 });
    });
  });

  describe('getDiscovery', () => {
    it('should get discovery timeline', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/discovery')
        .reply(200, {
          data: {
            timeline: [
              { date: '2024-01-01', new: 5, recurring: 10 },
              { date: '2024-01-02', new: 3, recurring: 12 },
            ],
            summary: {
              totalNew: 8,
              totalRecurring: 22,
              newRate: 0.27,
            },
          },
        });

      const discovery = await analyticsOps.getDiscovery(client);

      expect(discovery.timeline).toHaveLength(2);
      expect(discovery.summary.newRate).toBe(0.27);
    });

    it('should group by week or month', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/discovery')
        .query({ group_by: 'week' })
        .reply(200, {
          data: {
            timeline: [{ date: '2024-W01', new: 15, recurring: 30 }],
            summary: {},
          },
        });

      await analyticsOps.getDiscovery(client, { groupBy: 'week' });
    });
  });

  describe('getValidatorMatrix', () => {
    it('should get validator-taxonomy coverage matrix', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/validator-matrix')
        .reply(200, {
          data: {
            matrix: {
              'code-validator': { STR: 30, SEM: 50, PRA: 10, EPI: 5 },
              'test-architect': { STR: 5, SEM: 20, PRA: 40, EPI: 0 },
            },
            blindSpots: ['EPI'],
            singlePoints: ['STR-OMI'],
            highOverlap: ['SEM-VAL'],
          },
        });

      const matrix = await analyticsOps.getValidatorMatrix(client);

      expect(matrix.matrix['code-validator'].STR).toBe(30);
      expect(matrix.blindSpots).toContain('EPI');
    });

    it('should filter by minimum issues', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/validator-matrix')
        .query({ min_issues: 10 })
        .reply(200, {
          data: { matrix: {}, blindSpots: [], singlePoints: [], highOverlap: [] },
        });

      await analyticsOps.getValidatorMatrix(client, { minIssues: 10 });
    });
  });

  describe('getTrendSummary', () => {
    it('should get general trend summary', async () => {
      nock(BASE_URL)
        .get('/analytics/trends/summary')
        .reply(200, {
          data: [
            { metric: 'total_issues', value: 180, change: -10, trend: 'improving' },
            { metric: 'avg_score', value: 85, change: 5, trend: 'improving' },
          ],
        });

      const trends = await analyticsOps.getTrendSummary(client);

      expect(trends).toHaveLength(2);
      expect(trends[0].trend).toBe('improving');
    });
  });

  describe('getByMetric', () => {
    it('should get analytics by metric name', async () => {
      nock(BASE_URL)
        .get('/analytics/cost_analysis')
        .reply(200, {
          data: {
            totalCost: 150.25,
            byValidator: [
              { validator: 'code-validator', cost: 75.10 },
            ],
          },
        });

      const result = await analyticsOps.getByMetric(client, 'cost_analysis');

      expect((result as { totalCost: number }).totalCost).toBe(150.25);
    });

    it('should pass query parameters', async () => {
      nock(BASE_URL)
        .get('/analytics/regression_analysis')
        .query({ project: 'proj-1', days: 30 })
        .reply(200, {
          data: { regressions: [] },
        });

      await analyticsOps.getByMetric(client, 'regression_analysis', {
        project: 'proj-1',
        days: 30,
      });
    });

    it('should throw error for invalid metric', async () => {
      // Use type assertion to test runtime validation for string inputs that bypass TypeScript
      const invalidMetric = 'invalid_metric' as analyticsOps.AnalyticsMetric;

      await expect(analyticsOps.getByMetric(client, invalidMetric)).rejects.toThrow(
        'Invalid analytics metric: "invalid_metric"'
      );
    });
  });

  describe('isValidMetric', () => {
    it('should return true for valid metrics', () => {
      expect(analyticsOps.isValidMetric('validator_performance')).toBe(true);
      expect(analyticsOps.isValidMetric('resolution_rates')).toBe(true);
      expect(analyticsOps.isValidMetric('cost_analysis')).toBe(true);
    });

    it('should return false for invalid metrics', () => {
      expect(analyticsOps.isValidMetric('invalid')).toBe(false);
      expect(analyticsOps.isValidMetric('')).toBe(false);
      expect(analyticsOps.isValidMetric('VALIDATOR_PERFORMANCE')).toBe(false);
    });
  });

  describe('ANALYTICS_METRICS', () => {
    it('should contain all expected metrics', () => {
      expect(analyticsOps.ANALYTICS_METRICS).toContain('validator_performance');
      expect(analyticsOps.ANALYTICS_METRICS).toContain('resolution_rates');
      expect(analyticsOps.ANALYTICS_METRICS).toContain('file_hotspots');
      expect(analyticsOps.ANALYTICS_METRICS).toContain('trend_summary');
      expect(analyticsOps.ANALYTICS_METRICS).toContain('cost_analysis');
      expect(analyticsOps.ANALYTICS_METRICS).toHaveLength(9);
    });
  });
});
