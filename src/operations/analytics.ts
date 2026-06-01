import { z } from 'zod';
import type { OpsHttpClient } from '../http/http-client.js';
import { toApiQuery } from '../http/http-client.js';
import { InputValidationError } from '../errors/errors.js';
import type {
  AnalyticsQuery,
  AgentInfo,
  AgentLifecycleEntry,
  AgentPerformance,
  AgentReliabilityQuery,
  AgentMatrixQuery,
  BurndownQuery,
  DiscoveryQuery,
  TrendSummary,
  VelocityQuery,
} from '../types/analytics.js';
import {
  AgentPerformanceResponseSchema,
  AgentLifecycleEntryResponseSchema,
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
} from '../types/response-schemas.js';

/**
 * Get agent performance metrics (scores, pass rates, issue counts).
 *
 * @param client - HTTP client instance
 * @param query - Optional filters: project, days (default 30), limit
 * @returns Array of agent performance records with name, averageScore, passRate, totalRuns
 */
export async function getAgentPerformance(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<AgentPerformance[]> {
  return (z.array(AgentPerformanceResponseSchema)).parse(await client.get<unknown>(
    '/analytics/agents/performance',
    toApiQuery(query)
  ));
}

/**
 * Get agent reliability statistics (false positive rates, resolution rates).
 *
 * @param client - HTTP client instance
 * @param query - Optional filters: agent name, days (default 90)
 * @returns `{ agents: AgentReliability[] }` with reliabilityScore per agent
 */
export async function getAgentReliability(
  client: OpsHttpClient,
  query?: AgentReliabilityQuery
): Promise<z.infer<typeof AgentReliabilityResultResponseSchema>> {
  return AgentReliabilityResultResponseSchema.parse(await client.get<unknown>(
    '/analytics/agents/reliability',
    toApiQuery(query)
  ));
}

/**
 * Get agent lifecycle trajectory — version history with performance per version.
 *
 * @param client - HTTP client instance
 * @param agentName - Agent name (e.g. 'code-validator')
 * @param query - Optional filters: project, days
 * @returns Array of lifecycle entries with definitionVersion, firstSeenAt, runs, avgScore, passRate
 */
export async function getAgentLifecycle(
  client: OpsHttpClient,
  agentName: string,
  query?: AnalyticsQuery,
): Promise<AgentLifecycleEntry[]> {
  return (z.array(AgentLifecycleEntryResponseSchema)).parse(await client.get<unknown>(
    `/agents/${encodeURIComponent(agentName)}/lifecycle`,
    toApiQuery(query)
  ));
}

/**
 * Get issue resolution rates by project.
 *
 * @param client - HTTP client instance
 * @param query - Optional filters: project, days (default 30)
 * @returns Array of `{ project, resolved, total, rate }` records
 */
export async function getResolutionRates(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<z.infer<typeof ResolutionRateResponseSchema>[]> {
  return (z.array(ResolutionRateResponseSchema)).parse(await client.get<unknown>(
    '/analytics/projects/resolution-rates',
    toApiQuery(query)
  ));
}

/**
 * Get files with most issues (hotspots).
 *
 * @param client - HTTP client instance
 * @param query - Optional filters: project, days, limit
 * @returns Array of `{ filePath, issueCount, failureDomains }` ordered by issueCount desc
 */
export async function getFileHotspots(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<z.infer<typeof FileHotspotResponseSchema>[]> {
  return (z.array(FileHotspotResponseSchema)).parse(await client.get<unknown>(
    '/analytics/files/hotspots',
    toApiQuery(query)
  ));
}

/**
 * Get basic taxonomy distribution (issue counts by failure domain and mode).
 *
 * @param client - HTTP client instance
 * @param query - Optional filters: project, days
 * @returns Array of `{ domain, mode, count }` records
 */
export async function getTaxonomyDistribution(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<z.infer<typeof TaxonomyDistributionResponseSchema>[]> {
  return (z.array(TaxonomyDistributionResponseSchema)).parse(await client.get<unknown>(
    '/analytics/taxonomy/distribution',
    toApiQuery(query)
  ));
}

/**
 * Get comprehensive taxonomy analytics with all aggregations.
 * Returns unwrapped data directly (HttpClient auto-strips the `{ data }` envelope).
 *
 * @param client - HTTP client instance
 * @param query - Optional filters: project, days
 * @returns FullTaxonomyAnalytics with byDomain, byMode, bySeverity, topFailureCodes, heatmap, period
 */
export async function getFullTaxonomy(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<z.infer<typeof FullTaxonomyAnalyticsResponseSchema>> {
  return FullTaxonomyAnalyticsResponseSchema.parse(await client.get<unknown>(
    '/analytics/taxonomy/full',
    toApiQuery(query)
  ));
}

/**
 * Get taxonomy burndown time series by failure domain.
 *
 * @param client - HTTP client instance
 * @param query - Optional: project, days (default 30), granularity ('daily' | 'weekly')
 * @returns `{ timeSeries, trends }` — trends keyed by domain with trend direction and avgDailyChange
 */
export async function getBurndown(
  client: OpsHttpClient,
  query?: BurndownQuery
): Promise<z.infer<typeof BurndownResultResponseSchema>> {
  return BurndownResultResponseSchema.parse(await client.get<unknown>(
    '/analytics/taxonomy/burndown',
    toApiQuery(query)
  ));
}

/**
 * Get taxonomy velocity — rate of change per failure mode.
 *
 * @param client - HTTP client instance
 * @param query - Optional: project, days, alertThreshold (10-500, default 50)
 * @returns `{ items: VelocityItem[], summary: VelocitySummary, period }` — items have velocityPercent and alert flag
 */
export async function getVelocity(
  client: OpsHttpClient,
  query?: VelocityQuery
): Promise<z.infer<typeof VelocityResultResponseSchema>> {
  return VelocityResultResponseSchema.parse(await client.get<unknown>(
    '/analytics/taxonomy/velocity',
    toApiQuery(query)
  ));
}

/**
 * Get discovery timeline — new vs recurring issues over time.
 *
 * @param client - HTTP client instance
 * @param query - Optional filters: project, days, granularity ('daily' | 'weekly')
 * @returns `{ timeSeries, summary }` — summary includes newRate, recurringRate, totalNew, totalRecurring
 */
export async function getDiscovery(
  client: OpsHttpClient,
  query?: DiscoveryQuery
): Promise<z.infer<typeof DiscoveryResultResponseSchema>> {
  return DiscoveryResultResponseSchema.parse(await client.get<unknown>(
    '/analytics/taxonomy/discovery',
    toApiQuery(query)
  ));
}

/**
 * Get agent-taxonomy coverage matrix showing which agents detect which failure modes.
 *
 * @param client - HTTP client instance
 * @param query - Optional: project, days (default 90), minIssues (default 5)
 * @returns `{ matrix: AgentMatrixRow[], analysis: { blindSpots, singlePoints, highOverlap } }`
 */
export async function getAgentMatrix(
  client: OpsHttpClient,
  query?: AgentMatrixQuery
): Promise<z.infer<typeof AgentMatrixResultResponseSchema>> {
  return AgentMatrixResultResponseSchema.parse(await client.get<unknown>(
    '/analytics/taxonomy/agent-matrix',
    toApiQuery(query)
  ));
}

/**
 * Get weekly trend summary with new issues, resolved issues, regressions, and average scores.
 *
 * @param client - HTTP client instance
 * @param query - Optional: project, days
 * @returns Array of TrendSummary entries with period, newIssues, resolvedIssues, regressions, averageScore
 */
export async function getTrendSummary(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<TrendSummary[]> {
  return (z.array(TrendSummaryResponseSchema)).parse(await client.get<unknown>(
    '/analytics/trends/summary',
    toApiQuery(query)
  ));
}

/**
 * List agents with summary info (derived from performance data).
 * Calls `getAgentPerformance` internally — O(n) where n = total agent records.
 *
 * @param client - HTTP client instance
 * @param query - Optional filters: project, days, limit
 * @returns Array of `{ name, totalRuns, averageScore }` agent summaries
 */
export async function listAgents(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<AgentInfo[]> {
  const perf = await getAgentPerformance(client, query);
  return perf.map(v => ({
    name: v.name,
    totalRuns: v.totalRuns,
    averageScore: v.averageScore,
    passRate: v.passRate,
  }));
}

/**
 * Valid metric names for {@link getByMetric}.
 *
 * @example
 * ```typescript
 * import { ANALYTICS_METRICS, isValidMetric } from '@uluops/ops-sdk';
 *
 * console.log(ANALYTICS_METRICS); // all valid metric names
 * if (isValidMetric(userInput)) {
 *   const data = await client.analytics.getByMetric(userInput);
 * }
 * ```
 */
export const ANALYTICS_METRICS = [
  'agent_performance',
  'resolution_rates',
  'cross_project_patterns',
  'file_hotspots',
  'regression_analysis',
  'trend_summary',
  'cost_analysis',
  'taxonomy_distribution',
] as const;

export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];

/**
 * Check if a string is a valid analytics metric.
 *
 * @param metric - String to check
 * @returns Type-narrowed `true` if metric is a valid `AnalyticsMetric`
 * @example
 * ```typescript
 * if (isValidMetric(userInput)) {
 *   const data = await client.analytics.getByMetric(userInput);
 * }
 * ```
 */
export function isValidMetric(metric: string): metric is AnalyticsMetric {
  return ANALYTICS_METRICS.includes(metric as AnalyticsMetric);
}

/**
 * Get analytics by metric name via the generic `/:metric` endpoint.
 * Response is untyped (`unknown`) — prefer the typed methods for validated responses.
 *
 * @param client - HTTP client instance
 * @param metric - One of: agent_performance, resolution_rates, cross_project_patterns, file_hotspots, regression_analysis, trend_summary, cost_analysis, taxonomy_distribution
 * @param query - Optional: project, days
 * @returns Unvalidated response data
 * @throws {Error} If metric is not in ANALYTICS_METRICS
 */
export async function getByMetric(
  client: OpsHttpClient,
  metric: AnalyticsMetric,
  query?: AnalyticsQuery
): Promise<unknown> {
  if (!isValidMetric(metric)) {
    throw new InputValidationError(
      `Invalid analytics metric: "${metric}". Valid metrics: ${ANALYTICS_METRICS.join(', ')}`,
      [{ code: 'custom', path: ['metric'], message: `must be one of: ${ANALYTICS_METRICS.join(', ')}` }]
    );
  }
  return client.get(
    `/analytics/${metric}`,
    toApiQuery(query)
  );
}
