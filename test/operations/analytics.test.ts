import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as analyticsOps from '../../src/operations/analytics.js';
import { BASE_URL, TEST_API_KEY } from '../setup.js';
import {
  mockValidatedListEndpoint,
  mockValidatedEndpoint,
  AgentPerformanceResponseSchema,
  AgentReliabilityResultResponseSchema,
  ResolutionRateResponseSchema,
  FileHotspotResponseSchema,
  TaxonomyDistributionResponseSchema,
  FullTaxonomyAnalyticsResponseSchema,
  BurndownResultResponseSchema,
  VelocityResultResponseSchema,
  DiscoveryResultResponseSchema,
  AgentMatrixResultResponseSchema,
  TrendSummaryResponseSchema,
} from '../contract-helpers.js';

describe('Analytics Operations', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: TEST_API_KEY,
    });
  });

  describe('getAgentPerformance', () => {
    it('should get validator performance metrics', async () => {
      mockValidatedListEndpoint(
        BASE_URL, 'get', '/analytics/agents/performance',
        [
          { name: 'code-validator', totalRuns: 100, averageScore: 85.5, passRate: 92, totalIssuesFound: 250 },
          { name: 'test-architect', totalRuns: 80, averageScore: 78.2, passRate: 85, totalIssuesFound: 180 },
        ],
        AgentPerformanceResponseSchema,
      );

      const perf = await analyticsOps.getAgentPerformance(client);

      expect(perf).toHaveLength(2);
      expect(perf[0].name).toBe('code-validator');
      expect(perf[0].averageScore).toBe(85.5);
      expect(perf[0].totalRuns).toBe(100);
      expect(perf[0].passRate).toBe(92);
    });

    it('should filter by project', async () => {
      nock(BASE_URL)
        .get('/analytics/agents/performance')
        .query({ project: 'proj-1' })
        .reply(200, {
          data: [{ name: 'code-validator', totalRuns: 50, averageScore: 90, passRate: 96, totalIssuesFound: 100 }],
        });

      const perf = await analyticsOps.getAgentPerformance(client, { project: 'proj-1' });

      expect(perf).toHaveLength(1);
    });
  });

  describe('getAgentReliability', () => {
    it('should get agent reliability stats', async () => {
      mockValidatedEndpoint(
        BASE_URL, 'get', '/analytics/agents/reliability',
        {
          agents: [
            {
              name: 'code-validator',
              totalIssues: 250,
              falsePositiveRate: 5,
              resolutionRate: 75,
              avgTimeToResolveDays: 1.5,
              reliabilityScore: 82,
            },
          ],
        },
        AgentReliabilityResultResponseSchema,
      );

      const result = await analyticsOps.getAgentReliability(client);

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe('code-validator');
      expect(result.agents[0].falsePositiveRate).toBe(5);
      expect(result.agents[0].reliabilityScore).toBe(82);
    });

    it('should filter by agent name', async () => {
      nock(BASE_URL)
        .get('/analytics/agents/reliability')
        .query({ agent: 'test-architect' })
        .reply(200, {
          data: {
            agents: [{
              name: 'test-architect',
              totalIssues: 180,
              falsePositiveRate: 3,
              resolutionRate: 80,
              avgTimeToResolveDays: null,
              reliabilityScore: 88,
            }],
          },
        });

      const result = await analyticsOps.getAgentReliability(client, { agent: 'test-architect' });

      expect(result.agents[0].name).toBe('test-architect');
    });
  });

  describe('getResolutionRates', () => {
    it('should get resolution rates by project', async () => {
      mockValidatedListEndpoint(
        BASE_URL, 'get', '/analytics/projects/resolution-rates',
        [
          { project: 'proj-1', totalIssues: 100, resolvedIssues: 50, resolutionRate: 50, averageTimeToResolve: null },
          { project: 'proj-2', totalIssues: 100, resolvedIssues: 80, resolutionRate: 80, averageTimeToResolve: null },
        ],
        ResolutionRateResponseSchema,
      );

      const rates = await analyticsOps.getResolutionRates(client);

      expect(rates).toHaveLength(2);
      expect(rates[0].project).toBe('proj-1');
      expect(rates[0].resolutionRate).toBe(50);
      expect(rates[1].resolutionRate).toBe(80);
    });
  });

  describe('getFileHotspots', () => {
    it('should get files with most issues', async () => {
      mockValidatedListEndpoint(
        BASE_URL, 'get', '/analytics/files/hotspots',
        [
          { filePath: 'src/auth.ts', totalIssues: 15, openIssues: 5, resolvedIssues: 10, topAgents: ['code-validator'] },
          { filePath: 'src/api/client.ts', totalIssues: 10, openIssues: 3, resolvedIssues: 7, topAgents: ['test-architect'] },
        ],
        FileHotspotResponseSchema,
      );

      const hotspots = await analyticsOps.getFileHotspots(client);

      expect(hotspots).toHaveLength(2);
      expect(hotspots[0].filePath).toBe('src/auth.ts');
      expect(hotspots[0].totalIssues).toBe(15);
    });

    it('should filter by days', async () => {
      nock(BASE_URL)
        .get('/analytics/files/hotspots')
        .query({ days: 7 })
        .reply(200, {
          data: [{ filePath: 'src/recent.ts', totalIssues: 5, openIssues: 2, resolvedIssues: 3, topAgents: [] }],
        });

      const hotspots = await analyticsOps.getFileHotspots(client, { days: 7 });

      expect(hotspots).toHaveLength(1);
    });
  });

  describe('getTaxonomyDistribution', () => {
    it('should get basic taxonomy distribution', async () => {
      mockValidatedListEndpoint(
        BASE_URL, 'get', '/analytics/taxonomy/distribution',
        [
          { domain: 'STR', count: 50, percentage: 28 },
          { domain: 'SEM', count: 80, percentage: 44 },
          { domain: 'PRA', count: 30, percentage: 17 },
          { domain: 'EPI', count: 20, percentage: 11 },
        ],
        TaxonomyDistributionResponseSchema,
      );

      const dist = await analyticsOps.getTaxonomyDistribution(client);

      expect(dist).toHaveLength(4);
      expect(dist.find((d) => d.domain === 'SEM')?.count).toBe(80);
    });
  });

  describe('getFullTaxonomy', () => {
    it('should get full taxonomy analytics', async () => {
      mockValidatedEndpoint(
        BASE_URL, 'get', '/analytics/taxonomy/full',
        {
          byDomain: [{ domain: 'STR', label: 'Structural', count: 50, percentage: 28 }],
          byMode: [{ mode: 'STR-OMI', label: 'Omission', domain: 'STR', domainLabel: 'Structural', count: 20, percentage: 11 }],
          bySeverity: [{ severity: 'M', label: 'Medium', count: 40, percentage: 22 }],
          topCodes: [{ code: 'STR-OMI/M', domain: 'STR', mode: 'STR-OMI', severity: 'M', label: 'Omission (Medium)', count: 15, percentage: 8 }],
          heatmapData: [{ domain: 'STR', domainLabel: 'Structural', mode: 'STR-OMI', modeLabel: 'Omission', count: 20, percentage: 11, intensity: 1 }],
          totals: { totalIssues: 180, classifiedIssues: 150, unclassifiedIssues: 30, classificationRate: 83.3 },
          period: { start: '2024-01-01T00:00:00Z', end: '2024-01-31T00:00:00Z', days: 30 },
        },
        FullTaxonomyAnalyticsResponseSchema,
      );

      const result = await analyticsOps.getFullTaxonomy(client);

      expect(result.byDomain).toHaveLength(1);
      expect(result.byDomain[0].domain).toBe('STR');
      expect(result.totals.totalIssues).toBe(180);
      expect(result.period.days).toBe(30);
    });
  });

  describe('getBurndown', () => {
    it('should get burndown time series', async () => {
      mockValidatedEndpoint(
        BASE_URL, 'get', '/analytics/taxonomy/burndown',
        {
          timeSeries: [
            { date: '2024-01-01', STR: 50, SEM: 80, PRA: 30, EPI: 20, total: 180 },
            { date: '2024-01-08', STR: 45, SEM: 70, PRA: 25, EPI: 18, total: 158 },
          ],
          trends: {
            STR: { netChange: -5, trend: 'improving', avgDailyChange: -0.7, confidence: 'high', sampleSize: 7, rSquared: 0.85, standardError: 0.3, confidenceInterval: [-1.2, -0.2], outliers: [], diagnostics: null, ciReliable: true, warnings: [], weeklyPatternDetected: false },
            SEM: { netChange: -10, trend: 'improving', avgDailyChange: -1.4, confidence: 'high', sampleSize: 7, rSquared: 0.9, standardError: 0.2, confidenceInterval: [-2, -0.8], outliers: [], diagnostics: null, ciReliable: true, warnings: [], weeklyPatternDetected: false },
            PRA: { netChange: -5, trend: 'improving', avgDailyChange: -0.7, confidence: 'medium', sampleSize: 7, rSquared: 0.6, standardError: 0.5, confidenceInterval: [-1.5, 0.1], outliers: [], diagnostics: null, ciReliable: true, warnings: [], weeklyPatternDetected: false },
            EPI: { netChange: -2, trend: 'stable', avgDailyChange: -0.3, confidence: 'low', sampleSize: 7, rSquared: 0.3, standardError: 0.4, confidenceInterval: [-1, 0.4], outliers: [], diagnostics: null, ciReliable: false, warnings: ['Insufficient data'], weeklyPatternDetected: false },
          },
        },
        BurndownResultResponseSchema,
      );

      const burndown = await analyticsOps.getBurndown(client);

      expect(burndown.timeSeries).toHaveLength(2);
      expect(burndown.timeSeries[0].STR).toBe(50);
      expect(burndown.trends.STR.trend).toBe('improving');
      expect(burndown.trends.SEM.avgDailyChange).toBe(-1.4);
    });

    it('should accept query parameters', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/burndown')
        .query({ project: 'proj-1', days: 30 })
        .reply(200, {
          data: {
            timeSeries: [],
            trends: {
              STR: { netChange: 0, trend: 'stable', avgDailyChange: 0, confidence: 'low', sampleSize: 0, rSquared: 0, standardError: 0, confidenceInterval: [0, 0], outliers: [], diagnostics: null, ciReliable: false, warnings: [], weeklyPatternDetected: false },
              SEM: { netChange: 0, trend: 'stable', avgDailyChange: 0, confidence: 'low', sampleSize: 0, rSquared: 0, standardError: 0, confidenceInterval: [0, 0], outliers: [], diagnostics: null, ciReliable: false, warnings: [], weeklyPatternDetected: false },
              PRA: { netChange: 0, trend: 'stable', avgDailyChange: 0, confidence: 'low', sampleSize: 0, rSquared: 0, standardError: 0, confidenceInterval: [0, 0], outliers: [], diagnostics: null, ciReliable: false, warnings: [], weeklyPatternDetected: false },
              EPI: { netChange: 0, trend: 'stable', avgDailyChange: 0, confidence: 'low', sampleSize: 0, rSquared: 0, standardError: 0, confidenceInterval: [0, 0], outliers: [], diagnostics: null, ciReliable: false, warnings: [], weeklyPatternDetected: false },
            },
          },
        });

      await analyticsOps.getBurndown(client, { project: 'proj-1', days: 30 });
    });
  });

  describe('getVelocity', () => {
    it('should get velocity per failure mode', async () => {
      mockValidatedEndpoint(
        BASE_URL, 'get', '/analytics/taxonomy/velocity',
        {
          items: [
            { domain: 'STR', mode: 'OMI', failureCode: 'STR-OMI', currentCount: 5, previousCount: 10, velocityPercent: -50, alert: false, sparkline: [10, 8, 6, 5], trendReliability: 'high' },
            { domain: 'SEM', mode: 'VAL', failureCode: 'SEM-VAL', currentCount: 8, previousCount: 5, velocityPercent: 60, alert: true, sparkline: [5, 6, 7, 8], trendReliability: 'medium' },
          ],
          summary: { improving: ['STR-OMI'], stable: [], degrading: ['SEM-VAL'], mostImproved: 'STR-OMI', mostConcerning: 'SEM-VAL' },
        },
        VelocityResultResponseSchema,
      );

      const velocity = await analyticsOps.getVelocity(client);

      expect(velocity.items).toHaveLength(2);
      expect(velocity.items[0].failureCode).toBe('STR-OMI');
      expect(velocity.items[0].velocityPercent).toBe(-50);
      expect(velocity.summary.mostConcerning).toBe('SEM-VAL');
    });

    it('should accept alert threshold', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/velocity')
        .query({ alert_threshold: 10 })
        .reply(200, {
          data: { items: [], summary: { improving: [], stable: [], degrading: [], mostImproved: null, mostConcerning: null } },
        });

      await analyticsOps.getVelocity(client, { alertThreshold: 10 });
    });
  });

  describe('getDiscovery', () => {
    it('should get discovery timeline', async () => {
      mockValidatedEndpoint(
        BASE_URL, 'get', '/analytics/taxonomy/discovery',
        {
          timeline: [
            { period: '2024-01-01', newIssues: 5, recurringIssues: 10, domains: { STR: { new: 2, recurring: 3 }, SEM: { new: 3, recurring: 7 }, PRA: { new: 0, recurring: 0 }, EPI: { new: 0, recurring: 0 } } },
          ],
          summary: { totalNew: 5, totalRecurring: 10, newToRecurringRatio: 0.5, peakNewPeriod: { period: '2024-01-01', count: 5 } },
        },
        DiscoveryResultResponseSchema,
      );

      const discovery = await analyticsOps.getDiscovery(client);

      expect(discovery.timeline).toHaveLength(1);
      expect(discovery.timeline[0].newIssues).toBe(5);
      expect(discovery.summary.totalNew).toBe(5);
      expect(discovery.summary.newToRecurringRatio).toBe(0.5);
    });

    it('should group by week or month', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/discovery')
        .query({ group_by: 'week' })
        .reply(200, {
          data: {
            timeline: [{ period: '2024-W01', newIssues: 15, recurringIssues: 30, domains: {} }],
            summary: { totalNew: 15, totalRecurring: 30, newToRecurringRatio: 0.5, peakNewPeriod: null },
          },
        });

      await analyticsOps.getDiscovery(client, { groupBy: 'week' });
    });
  });

  describe('getAgentMatrix', () => {
    it('should get validator-taxonomy coverage matrix', async () => {
      mockValidatedEndpoint(
        BASE_URL, 'get', '/analytics/taxonomy/agent-matrix',
        {
          matrix: [
            { agent: 'code-validator', domains: { STR: 30, SEM: 50, PRA: 10, EPI: 5 }, total: 95, coverage: 4, coveragePercent: 100 },
            { agent: 'test-architect', domains: { STR: 5, SEM: 20, PRA: 40, EPI: 0 }, total: 65, coverage: 3, coveragePercent: 75 },
          ],
          analysis: {
            blindSpots: [{ agent: 'test-architect', missingDomains: ['EPI'] }],
            singlePoints: [{ domain: 'STR', mode: 'OMI', onlyAgent: 'code-validator' }],
            highOverlap: [{ mode: 'SEM-VAL', agentCount: 3, agents: ['code-validator', 'test-architect', 'type-safety'] }],
          },
        },
        AgentMatrixResultResponseSchema,
      );

      const result = await analyticsOps.getAgentMatrix(client);

      expect(result.matrix).toHaveLength(2);
      expect(result.matrix[0].agent).toBe('code-validator');
      expect(result.matrix[0].domains.STR).toBe(30);
      expect(result.analysis.blindSpots).toHaveLength(1);
      expect(result.analysis.singlePoints).toHaveLength(1);
    });

    it('should filter by minimum issues', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/agent-matrix')
        .query({ min_issues: 10 })
        .reply(200, {
          data: { matrix: [], analysis: { blindSpots: [], singlePoints: [], highOverlap: [] } },
        });

      await analyticsOps.getAgentMatrix(client, { minIssues: 10 });
    });
  });

  describe('getTrendSummary', () => {
    it('should get general trend summary', async () => {
      mockValidatedListEndpoint(
        BASE_URL, 'get', '/analytics/trends/summary',
        [
          { period: 'Week 1', newIssues: 10, resolvedIssues: 5, regressions: 1, averageScore: 85 },
          { period: 'Week 2', newIssues: 8, resolvedIssues: 12, regressions: 0, averageScore: 88 },
        ],
        TrendSummaryResponseSchema,
      );

      const trends = await analyticsOps.getTrendSummary(client);

      expect(trends).toHaveLength(2);
      expect(trends[0].period).toBe('Week 1');
      expect(trends[0].newIssues).toBe(10);
      expect(trends[0].resolvedIssues).toBe(5);
      expect(trends[0].averageScore).toBe(85);
    });
  });

  describe('getByMetric', () => {
    it('should get analytics by metric name', async () => {
      nock(BASE_URL)
        .get('/analytics/cost_analysis')
        .reply(200, {
          data: [{ name: 'code-validator', totalRuns: 10, totalInputTokens: 5000, totalOutputTokens: 2000, totalEffectiveTokens: 7000, estimatedCost: 0.15 }],
        });

      const result = await analyticsOps.getByMetric(client, 'cost_analysis');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should pass query parameters', async () => {
      nock(BASE_URL)
        .get('/analytics/regression_analysis')
        .query({ project: 'proj-1', days: 30 })
        .reply(200, {
          data: [],
        });

      await analyticsOps.getByMetric(client, 'regression_analysis', {
        project: 'proj-1',
        days: 30,
      });
    });

    it('should throw error for invalid metric', async () => {
      const invalidMetric = 'invalid_metric' as analyticsOps.AnalyticsMetric;

      await expect(analyticsOps.getByMetric(client, invalidMetric)).rejects.toThrow(
        'Invalid analytics metric: "invalid_metric"'
      );
    });
  });

  describe('isValidMetric', () => {
    it('should return true for valid metrics', () => {
      expect(analyticsOps.isValidMetric('agent_performance')).toBe(true);
      expect(analyticsOps.isValidMetric('resolution_rates')).toBe(true);
      expect(analyticsOps.isValidMetric('cost_analysis')).toBe(true);
    });

    it('should return false for invalid metrics', () => {
      expect(analyticsOps.isValidMetric('invalid')).toBe(false);
      expect(analyticsOps.isValidMetric('')).toBe(false);
      expect(analyticsOps.isValidMetric('VALIDATOR_PERFORMANCE')).toBe(false);
    });
  });

  describe('listAgents', () => {
    it('should return simplified validator info', async () => {
      mockValidatedListEndpoint(
        BASE_URL, 'get', '/analytics/agents/performance',
        [
          { name: 'code-validator', totalRuns: 100, averageScore: 85.5, passRate: 92, totalIssuesFound: 250 },
          { name: 'test-architect', totalRuns: 80, averageScore: 78.2, passRate: 85, totalIssuesFound: 180 },
        ],
        AgentPerformanceResponseSchema,
      );

      const agents = await analyticsOps.listAgents(client);

      expect(agents).toHaveLength(2);
      expect(agents[0]).toEqual({
        name: 'code-validator',
        totalRuns: 100,
        avgScore: 85.5,
        passRate: 92,
      });
      expect(agents[1]).toEqual({
        name: 'test-architect',
        totalRuns: 80,
        avgScore: 78.2,
        passRate: 85,
      });
    });

    it('should pass query parameters through', async () => {
      nock(BASE_URL)
        .get('/analytics/agents/performance')
        .query({ project: 'proj-1' })
        .reply(200, {
          data: [{ name: 'code-validator', totalRuns: 50, averageScore: 90, passRate: 96, totalIssuesFound: 100 }],
        });

      const agents = await analyticsOps.listAgents(client, { project: 'proj-1' });

      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('code-validator');
    });
  });

  describe('ANALYTICS_METRICS', () => {
    it('should contain all expected metrics', () => {
      expect(analyticsOps.ANALYTICS_METRICS).toContain('agent_performance');
      expect(analyticsOps.ANALYTICS_METRICS).toContain('resolution_rates');
      expect(analyticsOps.ANALYTICS_METRICS).toContain('file_hotspots');
      expect(analyticsOps.ANALYTICS_METRICS).toContain('trend_summary');
      expect(analyticsOps.ANALYTICS_METRICS).toContain('cost_analysis');
      expect(analyticsOps.ANALYTICS_METRICS).toHaveLength(8);
    });
  });
});
