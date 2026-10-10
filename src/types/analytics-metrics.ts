import { z } from 'zod';
import { AgentPerformanceResponseSchema, ResolutionRateResponseSchema, FileHotspotResponseSchema, TaxonomyDistributionResponseSchema, TrendSummaryResponseSchema } from './response-schemas.js';

const count = z.number().int().nonnegative();
const model = z.object({ runCount: count, totalCost: z.number(), costDisplay: z.string(), percentage: z.number() }).passthrough();
const byModel = z.record(z.string(), model);
const group = z.object({ totalCost: z.number(), costDisplay: z.string(), tokens: count, runs: count, percentage: z.number(), byModel }).passthrough();
const agent = z.object({ agent: z.string(), totalCost: z.number(), costDisplay: z.string(), tokens: count, runs: count }).passthrough();

/** Generic metrics preserve unknown producer metadata while validating known fields. */
export const AnalyticsListSchemas = {
  agent_performance: AgentPerformanceResponseSchema.passthrough(),
  resolution_rates: ResolutionRateResponseSchema.passthrough(),
  cross_project_patterns: z.unknown(),
  file_hotspots: FileHotspotResponseSchema.passthrough(),
  trend_summary: TrendSummaryResponseSchema.passthrough(),
  taxonomy_distribution: TaxonomyDistributionResponseSchema.passthrough(),
};
export type AnalyticsListMetric = keyof typeof AnalyticsListSchemas;
export const RegressionMetricSchema = z.object({
  regressionRate: z.number().nullable(), totalRegressions: count, recurringCount: count, totalResolved: count,
  regressionHazardPer1000IssueDays: z.number().nullable().optional(), transitionsObserved: count.optional(), agentRegressions: count.optional(),
}).passthrough();
export const LegacyCostMetricSchema = z.object({
  totalCostMicrodollars: z.number(), totalCostDisplay: z.string(), totalTokens: count, totalInputTokens: count, totalOutputTokens: count,
  runCount: count, averageCostPerRun: z.number(), averageCostDisplay: z.string(), byModel,
  costTrend: z.array(z.object({ date: z.string(), costMicrodollars: z.number(), tokens: count, runs: count }).passthrough()),
  topCostAgents: z.array(agent), byAgent: z.array(group.extend({ agent: z.string() })),
  byProject: z.array(group.extend({ project: z.string() })), byWorkflow: z.array(group.extend({ workflowType: z.string() })),
}).passthrough();

/**
 * A list metric read with `format: 'page'` (see `getByMetric`): one offset-paged slice of the
 * metric's rows. `implemented: false` (with `reason`) marks a metric the server does not page
 * yet — `data` is then empty and is not evidence of no rows. Unknown keys are passed through.
 */
export interface AnalyticsPage<T = unknown> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  implemented: boolean;
  reason?: string;
  [key: string]: unknown;
}

export function parseAnalyticsMetric(metric: string, body: unknown, page: boolean, requested?: { limit: number; offset: number }): unknown {
  if (metric === 'regression_analysis') return RegressionMetricSchema.parse(body);
  if (metric === 'cost_analysis') return LegacyCostMetricSchema.parse(body);
  const row = AnalyticsListSchemas[metric as AnalyticsListMetric];
  if (page) {
    return z.object({
      data: z.array(row), total: count, limit: z.number().int().min(1).max(100),
      offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), hasMore: z.boolean(),
      implemented: z.boolean(), reason: z.string().trim().min(1).optional(),
    }).passthrough().superRefine((value, ctx) => {
      if (!value.implemented && !value.reason) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Unimplemented metrics require a reason' });
      if (!value.implemented && (value.data.length !== 0 || value.total !== 0)) ctx.addIssue({ code: 'custom', path: ['implemented'], message: 'Unimplemented metrics cannot report results' });
      if (requested && (value.limit !== requested.limit || value.offset !== requested.offset)) ctx.addIssue({ code: 'custom', path: ['offset'], message: 'Analytics page controls differ from the request' });
      if (value.data.length > value.total || (value.data.length > 0 && value.offset + value.data.length > value.total)) ctx.addIssue({ code: 'custom', path: ['total'], message: 'Analytics rows exceed total' });
      if (value.hasMore && value.data.length === 0) ctx.addIssue({ code: 'custom', path: ['data'], message: 'Analytics page made no progress' });
      if (value.data.length > value.limit || value.hasMore !== (value.offset + value.data.length < value.total)) ctx.addIssue({ code: 'custom', path: ['hasMore'], message: 'Inconsistent analytics page metadata' });
    }).parse(body);
  }
  return metric === 'agent_performance' || metric === 'taxonomy_distribution'
    ? z.object({ data: z.array(row), total: count }).passthrough().parse(body)
    : z.array(row).parse(body);
}
