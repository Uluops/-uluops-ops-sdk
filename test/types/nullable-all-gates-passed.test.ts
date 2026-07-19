import { describe, it, expect } from 'vitest';
import {
  RunResponseSchema,
  RunSummaryResponseSchema,
  SaveRunResponseSchema,
} from '../../src/types/response-schemas.js';
import { createMockRun, createMockRunSummary, createMockAgentSnapshot } from '../contract-helpers.js';

// null = NOT_A_GATE: the run carried no gate-bearing agents (lens-only runs).
// Distinct from false (a gate ran and failed). Widened in the Phase-A cascade of
// save-run-decision-semantics spec v0.2.1 — the API emits null only after this
// schema shape is consumed everywhere (deploy gate C7).
describe('nullable allGatesPassed schemas', () => {
  describe('RunResponseSchema', () => {
    it('accepts allGatesPassed: null (NOT_A_GATE lens-only run)', () => {
      const result = RunResponseSchema.safeParse(createMockRun({ allGatesPassed: null }));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allGatesPassed).toBeNull();
      }
    });

    it('still accepts boolean values (regression)', () => {
      expect(RunResponseSchema.safeParse(createMockRun({ allGatesPassed: true })).success).toBe(true);
      expect(RunResponseSchema.safeParse(createMockRun({ allGatesPassed: false })).success).toBe(true);
    });

    it('rejects a missing allGatesPassed field (nullable, not optional)', () => {
      const { allGatesPassed: _omitted, ...rest } = createMockRun();
      const result = RunResponseSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('RunSummaryResponseSchema', () => {
    it('accepts allGatesPassed: null on the list shape', () => {
      const result = RunSummaryResponseSchema.safeParse(
        createMockRunSummary({ allGatesPassed: null })
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allGatesPassed).toBeNull();
      }
    });

    it('still accepts boolean values (regression)', () => {
      expect(
        RunSummaryResponseSchema.safeParse(createMockRunSummary({ allGatesPassed: false })).success
      ).toBe(true);
    });
  });

  describe('SaveRunResponseSchema (embeds RunResponseSchema)', () => {
    it('does not throw parsing the response of a save that produced a null-gate run', () => {
      const result = SaveRunResponseSchema.safeParse({
        run: createMockRun({ allGatesPassed: null }),
        agents: [createMockAgentSnapshot({ decision: 'EXPLORED', score: 88 })],
        correlation: { newIssues: 0, recurringIssues: 0, regressions: 0, observed: 0 },
        deduplicated: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.run.allGatesPassed).toBeNull();
      }
    });
  });
});
