import type { OpsHttpClient } from '../http/http-client.js';
import type {
  AnalyticsQuery,
  ValidatorPerformance,
  ValidatorReliability,
  ValidatorReliabilityQuery,
  ResolutionRate,
  FileHotspot,
  TaxonomyDistribution,
  FullTaxonomyAnalytics,
  BurndownResult,
  BurndownQuery,
  VelocityResult,
  VelocityQuery,
  DiscoveryResult,
  DiscoveryQuery,
  ValidatorMatrixResult,
  ValidatorMatrixQuery,
  TrendSummary,
} from '../types/analytics.js';

/**
 * Get validator performance metrics
 */
export async function getValidatorPerformance(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<ValidatorPerformance[]> {
  return client.get<ValidatorPerformance[]>(
    '/analytics/validators/performance',
    query
  );
}

/**
 * Get validator reliability stats
 */
export async function getValidatorReliability(
  client: OpsHttpClient,
  query?: ValidatorReliabilityQuery
): Promise<{ validators: ValidatorReliability[] }> {
  return client.get<{ validators: ValidatorReliability[] }>(
    '/analytics/validators/reliability',
    query
  );
}

/**
 * Get issue resolution rates by project
 */
export async function getResolutionRates(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<ResolutionRate[]> {
  return client.get<ResolutionRate[]>(
    '/analytics/projects/resolution-rates',
    query
  );
}

/**
 * Get files with most issues (hotspots)
 */
export async function getFileHotspots(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<FileHotspot[]> {
  return client.get<FileHotspot[]>(
    '/analytics/files/hotspots',
    query
  );
}

/**
 * Get basic taxonomy distribution
 */
export async function getTaxonomyDistribution(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<TaxonomyDistribution[]> {
  return client.get<TaxonomyDistribution[]>(
    '/analytics/taxonomy/distribution',
    query
  );
}

/**
 * Get full taxonomy analytics with all aggregations
 */
export async function getFullTaxonomy(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<{ data: FullTaxonomyAnalytics; computedAt: string }> {
  return client.get<{ data: FullTaxonomyAnalytics; computedAt: string }>(
    '/analytics/taxonomy/full',
    query
  );
}

/**
 * Get taxonomy burndown time series
 */
export async function getBurndown(
  client: OpsHttpClient,
  query?: BurndownQuery
): Promise<BurndownResult> {
  return client.get<BurndownResult>(
    '/analytics/taxonomy/burndown',
    query
  );
}

/**
 * Get taxonomy velocity (rate of change per failure mode)
 */
export async function getVelocity(
  client: OpsHttpClient,
  query?: VelocityQuery
): Promise<VelocityResult> {
  return client.get<VelocityResult>('/analytics/taxonomy/velocity', {
    project: query?.project,
    days: query?.days,
    alertThreshold: query?.alertThreshold,
  });
}

/**
 * Get discovery timeline (new vs recurring issues)
 */
export async function getDiscovery(
  client: OpsHttpClient,
  query?: DiscoveryQuery
): Promise<DiscoveryResult> {
  return client.get<DiscoveryResult>('/analytics/taxonomy/discovery', {
    project: query?.project,
    days: query?.days,
    groupBy: query?.groupBy,
  });
}

/**
 * Get validator-taxonomy coverage matrix
 */
export async function getValidatorMatrix(
  client: OpsHttpClient,
  query?: ValidatorMatrixQuery
): Promise<ValidatorMatrixResult> {
  return client.get<ValidatorMatrixResult>('/analytics/taxonomy/validator-matrix', {
    project: query?.project,
    days: query?.days,
    minIssues: query?.minIssues,
  });
}

/**
 * Get general trend summary
 */
export async function getTrendSummary(
  client: OpsHttpClient,
  query?: AnalyticsQuery
): Promise<TrendSummary[]> {
  return client.get<TrendSummary[]>(
    '/analytics/trends/summary',
    query
  );
}

/**
 * Valid metric names for getByMetric
 */
export const ANALYTICS_METRICS = [
  'validator_performance',
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
 * Get analytics by metric name (generic endpoint)
 * @throws Error if metric is not a valid analytics metric
 */
export async function getByMetric(
  client: OpsHttpClient,
  metric: AnalyticsMetric,
  query?: AnalyticsQuery
): Promise<unknown> {
  // Runtime validation for string inputs that bypass type checking
  if (!isValidMetric(metric)) {
    throw new Error(
      `Invalid analytics metric: "${metric}". Valid metrics: ${ANALYTICS_METRICS.join(', ')}`
    );
  }
  return client.get<unknown>(
    `/analytics/${metric}`,
    query
  );
}
