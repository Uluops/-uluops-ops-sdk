import { z } from 'zod';

const count = z.number().int().nonnegative();
const ratio = z.number().min(0).max(1).nullable();
const summary = z.object({
  pricedCost: count.nullable(), pricedCostDisplay: z.string().nullable(),
  runCount: count, pricedRunCount: count, unpricedRunCount: count,
  snapshotCount: count, pricedSnapshotCount: count, unpricedSnapshotCount: count,
  totalTokens: count, totalInputTokens: count, totalOutputTokens: count,
  pricedTokens: count, unpricedTokens: count,
  coverage: z.object({ runs: ratio, snapshots: ratio, tokens: ratio, unit: z.literal('ratio') }).passthrough(),
}).passthrough();

/** Opt-in cost schema; additive server fields are retained. Legacy reads are unchanged. */
export const CostCoverageResponseSchema = summary.extend({
  pricingContract: z.literal('coverage-v1'), costUnit: z.literal('microdollars'),
  pricing: z.object({ source: z.string(), lastVerified: z.string(), basis: z.literal('configured-rate-table') }).passthrough(),
  byModel: z.array(summary.extend({ model: z.string().nullable(), pricingStatus: z.enum(['priced', 'unpriced']) })),
  byAgent: z.array(summary.extend({ agent: z.string() })),
  byProject: z.array(summary.extend({ project: z.string() })),
  byWorkflow: z.array(summary.extend({ workflowType: z.string() })),
  costTrend: z.array(summary.extend({ date: z.string() })),
  estimate: z.object({
    estimatedCost: count, assumedModel: z.enum(['haiku', 'sonnet', 'opus']),
    inputRate: count, outputRate: count, rateUnit: z.literal('microdollars-per-million-tokens'),
    source: z.string(), lastVerified: z.string(), scope: z.literal('unpriced-snapshots-only'),
  }).passthrough().optional(),
});

/** Priced amounts use the disclosed configured table, not a provider billing record. */
export type CostCoverageResult = z.infer<typeof CostCoverageResponseSchema>;
