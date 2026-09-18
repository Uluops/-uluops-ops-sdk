import { describe, it, expect } from 'vitest';
import { DiscoveryResultResponseSchema } from '../../src/types/response-schemas.js';
import { LogRunEventSchema } from '../../src/types/log.js';

describe('F01 event facts survive response parsing', () => {
  it('retains discovery unknown and regression counts alongside the recurring rollup', () => {
    const result = DiscoveryResultResponseSchema.parse({
      timeline: [{ period: '2026-09-18', newIssues: 1, recurringIssues: 2,
        regressionIssues: 1, observedIssues: 0, unknownIssues: 3,
        domains: { STR: { new: 1, recurring: 2, regression: 1, observed: 0, unknown: 3 } } }],
      summary: { totalNew: 1, totalRecurring: 2, totalRegressions: 1, totalObserved: 0,
        totalUnknown: 3, newToRecurringRatio: 0.5, peakNewPeriod: { period: '2026-09-18', count: 1 } },
    });
    expect(result.summary.totalUnknown).toBe(3);
    expect(result.timeline[0].domains.STR.regression).toBe(1);
    expect(result.timeline[0].unknownIssues).toBe(3);
  });
  it('does not fabricate event capture on an older API', () => {
    const result = DiscoveryResultResponseSchema.parse({ timeline: [], summary: {
      totalNew: 0, totalRecurring: 0, newToRecurringRatio: 0, peakNewPeriod: null,
    } });
    expect(result.summary).not.toHaveProperty('totalUnknown');
  });
  it('keeps log occurrence facts separate from original run aggregate counts', () => {
    const result = LogRunEventSchema.parse({ type: 'run', runNumber: 1, at: '2026-09-18',
      workflowType: 'ship', definitionType: null, definitionName: null, definitionVersion: null,
      averageScore: null, allGatesPassed: null, counts: null, agents: [],
      occurrenceCounts: { new: 0, recurring: 0, regressions: 0, observed: 0, unknown: 2 } });
    expect(result.counts).toBeNull();
    expect(result.occurrenceCounts?.unknown).toBe(2);
  });
});
