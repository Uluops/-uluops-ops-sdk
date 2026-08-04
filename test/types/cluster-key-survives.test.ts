/**
 * `clusterKey` survives the recommendation schema (tracker migration 076).
 *
 * ## Why this test exists rather than a type assertion
 *
 * `RecommendationInputSchema` is a plain `z.object()`, and Zod's default for an
 * undeclared key is **strip, not error**. So while `clusterKey` was undeclared,
 * an orchestrator that set it saw:
 *
 *   - no type error (the object was a superset of a valid input),
 *   - no validation error (strip is silent),
 *   - no runtime error (the request succeeded),
 *   - and a tracker row with `convergence_cluster_id = NULL`.
 *
 * The tracker documents NULL as *"no adjudicating stage"* and a per-run count of
 * `0` as *"a stage was declared and silently stopped working"*. A transport-layer
 * strip would therefore have produced the tracker's **collapsing-pipeline
 * signature** for a merge stage that was working correctly, and the instrument
 * would have pointed the blame at the pipeline rather than at this schema.
 *
 * The assertion is on the **parse output**, not on the type: a type-level check
 * passes whether or not Zod keeps the value at runtime, and runtime retention is
 * the entire claim.
 *
 * @see uluops-specifications regression-detection-restoration §5.4b, §8.2, §8.3
 */
import { describe, it, expect } from 'vitest';
import { RecommendationInputSchema } from '../../src/types/schemas.js';

const base = {
  agent: 'security-analyst',
  title: 'Unbounded query in the export path',
  priority: 'critical' as const,
};

describe('RecommendationInputSchema — clusterKey', () => {
  it('retains clusterKey through parse', () => {
    const parsed = RecommendationInputSchema.parse({ ...base, clusterKey: 'cluster-alpha' });

    // Positive form. `not.toBeUndefined()` would also pass on a schema that threw
    // before reaching here, and asserting the input object is meaningless — the
    // claim is about what comes OUT of parse.
    expect(parsed.clusterKey).toBe('cluster-alpha');
  });

  it('keeps distinct cluster keys distinct rather than collapsing them', () => {
    const a = RecommendationInputSchema.parse({ ...base, clusterKey: 'cluster-alpha' });
    const b = RecommendationInputSchema.parse({ ...base, clusterKey: 'cluster-beta' });
    expect(a.clusterKey).not.toBe(b.clusterKey);
  });

  it('omits the key when absent, rather than defaulting it', () => {
    // Absent must stay absent. A default here would tell the tracker that a
    // pipeline with no adjudicating stage had declared one.
    const parsed = RecommendationInputSchema.parse(base);
    expect(parsed.clusterKey).toBeUndefined();
  });

  it('rejects a key longer than the tracker column, instead of silently truncating', () => {
    // varchar(64) on the tracker side. Truncation would produce a *different*
    // cluster id that still looks valid, silently splitting one adjudicated
    // defect into two clusters.
    expect(() =>
      RecommendationInputSchema.parse({ ...base, clusterKey: 'x'.repeat(65) }),
    ).toThrow();
    expect(RecommendationInputSchema.parse({ ...base, clusterKey: 'x'.repeat(64) }).clusterKey)
      .toHaveLength(64);
  });

  it('rejects an empty string, which would be a cluster id that groups nothing', () => {
    expect(() => RecommendationInputSchema.parse({ ...base, clusterKey: '' })).toThrow();
  });
});
