import { z } from 'zod';
import type { OpsHttpClient } from '../http/http-client.js';
import { toApiQuery } from '../http/http-client.js';
import type {
  AnalyticsQuery,
  AgentInfo,
  AgentReliabilityQuery,
  BurndownQuery,
  VelocityQuery,
  DiscoveryQuery,
  AgentMatrixQuery,
} from '../types/analytics.js';
import {
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
} from '../types/response-schemas.js';

/**
 * Get agent performance metrics
 */
export async function getAgentPerformance(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<z.infer<typeof AgentPerformanceResponseSchema>[]> {
  return client.get(
    '/analytics/agents/performance',
    toApiQuery(query),
    { schema: z.array(AgentPerformanceResponseSchema) }
  );
}

/**
 * Get agent reliability stats
 */
export async function getAgentReliability(
  client: OpsHttpClient,
  query?: AgentReliabilityQuery
): Promise<z.infer<typeof AgentReliabilityResultResponseSchema>> {
  return client.get(
    '/analytics/agents/reliability',
    toApiQuery(query),
    { schema: AgentReliabilityResultResponseSchema }
  );
}

/**
 * Get agent lifecycle trajectory across versions
 */
export async function getAgentLifecycle(
  client: OpsHttpClient,
  agentName: string,
  query?: AnalyticsQuery,
): Promise<unknown> {
  return client.get(
    `/agents/${encodeURIComponent(agentName)}/lifecycle`,
    toApiQuery(query),
  );
}

/**
 * Get issue resolution rates by project
 */
export async function getResolutionRates(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<z.infer<typeof ResolutionRateResponseSchema>[]> {
  return client.get(
    '/analytics/projects/resolution-rates',
    toApiQuery(query),
    { schema: z.array(ResolutionRateResponseSchema) }
  );
}

/**
 * Get files with most issues (hotspots)
 */
export async function getFileHotspots(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<z.infer<typeof FileHotspotResponseSchema>[]> {
  return client.get(
    '/analytics/files/hotspots',
    toApiQuery(query),
    { schema: z.array(FileHotspotResponseSchema) }
  );
}

/**
 * Get basic taxonomy distribution
 */
export async function getTaxonomyDistribution(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<z.infer<typeof TaxonomyDistributionResponseSchema>[]> {
  return client.get(
    '/analytics/taxonomy/distribution',
    toApiQuery(query),
    { schema: z.array(TaxonomyDistributionResponseSchema) }
  );
}

/**
 * Get full taxonomy analytics with all aggregations.
 *
 * Returns the unwrapped taxonomy data (HttpClient auto-strips the { data } envelope).
 * Includes domain/mode/severity distributions, top failure codes, heatmap data,
 * classification totals, and time period metadata.
 */
export async function getFullTaxonomy(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<z.infer<typeof FullTaxonomyAnalyticsResponseSchema>> {
  return client.get(
    '/analytics/taxonomy/full',
    toApiQuery(query),
    { schema: FullTaxonomyAnalyticsResponseSchema }
  );
}

/**
 * Get taxonomy burndown time series
 */
export async function getBurndown(
  client: OpsHttpClient,
  query?: BurndownQuery
): Promise<z.infer<typeof BurndownResultResponseSchema>> {
  return client.get(
    '/analytics/taxonomy/burndown',
    toApiQuery(query),
    { schema: BurndownResultResponseSchema }
  );
}

/**
 * Get taxonomy velocity (rate of change per failure mode)
 */
export async function getVelocity(
  client: OpsHttpClient,
  query?: VelocityQuery
): Promise<z.infer<typeof VelocityResultResponseSchema>> {
  return client.get(
    '/analytics/taxonomy/velocity',
    toApiQuery(query),
    { schema: VelocityResultResponseSchema }
  );
}

/**
 * Get discovery timeline (new vs recurring issues)
 */
export async function getDiscovery(
  client: OpsHttpClient,
  query?: DiscoveryQuery
): Promise<z.infer<typeof DiscoveryResultResponseSchema>> {
  return client.get(
    '/analytics/taxonomy/discovery',
    toApiQuery(query),
    { schema: DiscoveryResultResponseSchema }
  );
}

/**
 * Get agent-taxonomy coverage matrix
 */
export async function getAgentMatrix(
  client: OpsHttpClient,
  query?: AgentMatrixQuery
): Promise<z.infer<typeof AgentMatrixResultResponseSchema>> {
  return client.get(
    '/analytics/taxonomy/agent-matrix',
    toApiQuery(query),
    { schema: AgentMatrixResultResponseSchema }
  );
}

/**
 * Get general trend summary
 */
export async function getTrendSummary(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<z.infer<typeof TrendSummaryResponseSchema>[]> {
  return client.get(
    '/analytics/trends/summary',
    toApiQuery(query),
    { schema: z.array(TrendSummaryResponseSchema) }
  );
}

/**
 * List agents with summary info (derived from performance data).
 */
export async function listAgents(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<AgentInfo[]> {
  const perf = await getAgentPerformance(client, query);
  return perf.map(v => ({
    name: v.name,
    totalRuns: v.totalRuns,
    avgScore: v.averageScore,
    passRate: v.passRate,
  }));
}

/**
 * Valid metric names for getByMetric
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
  'category_performance',
] as const;

export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];

/**
 * Check if a string is a valid analytics metric
 */
export function isValidMetric(metric: string): metric is AnalyticsMetric {
  return ANALYTICS_METRICS.includes(metric as AnalyticsMetric);
}

/**
 * Get analytics by metric name (generic endpoint).
 * Note: Response validation is not applied to this generic endpoint.
 * Use the typed methods (getAgentPerformance, getBurndown, etc.) for validated responses.
 */
export async function getByMetric(
  client: OpsHttpClient,
  metric: AnalyticsMetric,
  query?: AnalyticsQuery
): Promise<unknown> {
  if (!isValidMetric(metric)) {
    throw new Error(
      `Invalid analytics metric: "${metric}". Valid metrics: ${ANALYTICS_METRICS.join(', ')}`
    );
  }
  return client.get(
    `/analytics/${metric}`,
    toApiQuery(query)
  );
}

// Backwards-compatible aliases
/** @deprecated Use getAgentPerformance instead */
export const getValidatorPerformance = getAgentPerformance;
/** @deprecated Use getAgentReliability instead */
export const getValidatorReliability = getAgentReliability;
/** @deprecated Use getAgentMatrix instead */
export const getValidatorMatrix = getAgentMatrix;
/** @deprecated Use listAgents instead */
export const listValidators = listAgents;
