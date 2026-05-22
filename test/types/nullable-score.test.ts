import { describe, it, expect } from 'vitest';
import { AgentInputSchema, AnalysisSummaryEntrySchema } from '../../src/types/schemas.js';
import { AgentSnapshotResponseSchema } from '../../src/types/response-schemas.js';

describe('nullable score schemas', () => {
  describe('AgentInputSchema', () => {
    it('accepts input without score field', () => {
      const result = AgentInputSchema.safeParse({
        name: 'aristotle-generator',
        decision: 'ACTUALIZED',
      });
      expect(result.success).toBe(true);
    });

    it('accepts input with score: null', () => {
      const result = AgentInputSchema.safeParse({
        name: 'aristotle-generator',
        score: null,
        decision: 'ACTUALIZED',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBeNull();
      }
    });

    it('accepts input with numeric score (regression)', () => {
      const result = AgentInputSchema.safeParse({
        name: 'code-validator',
        score: 85,
        decision: 'PASS',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBe(85);
      }
    });

    it('rejects score outside range', () => {
      const result = AgentInputSchema.safeParse({
        name: 'code-validator',
        score: 150,
        decision: 'PASS',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('AnalysisSummaryEntrySchema', () => {
    it('accepts summary without score', () => {
      const result = AnalysisSummaryEntrySchema.safeParse({
        decision: 'ACTUALIZED',
      });
      expect(result.success).toBe(true);
    });

    it('accepts summary with score: null', () => {
      const result = AnalysisSummaryEntrySchema.safeParse({
        decision: 'ACTUALIZED',
        score: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('AgentSnapshotResponseSchema', () => {
    it('accepts response with score: null', () => {
      const result = AgentSnapshotResponseSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        runId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'aristotle-generator',
        definitionVersion: '0.1.0',
        score: null,
        maxScore: 100,
        decision: 'ACTUALIZED',
        summary: null,
        model: null,
        inputTokens: null,
        outputTokens: null,
        cacheCreationTokens: null,
        cacheReadTokens: null,
        totalEffectiveTokens: null,
        durationMs: null,
        createdAt: '2026-05-22T00:00:00.000Z',
        updatedAt: '2026-05-22T00:00:00.000Z',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBeNull();
      }
    });
  });
});
