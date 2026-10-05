import { describe, it, expect } from 'vitest';
import { RunReadResponseSchema, RunDetailRunResponseSchema, RunWriteEchoResponseSchema } from '../../src/types/response-schemas.js';
import type { RunEditCapabilities } from '../../src/index.js';
import { createMockRun } from '../contract-helpers.js';

const capabilities: RunEditCapabilities = {
  canUpdate: true,
  mutableFields: ['agents', 'analysisRecords'],
  immutableFields: [{ field: 'averageScore', reason: 'FINALIZED_RUN_FIELD_IMMUTABLE' }],
  unchangedOnlyFields: ['averageScore'],
  byIdOnlyFields: ['archivedAt', 'archivedReason'],
  requiredRole: 'publisher', denialReason: null, previewScope: 'analysis-only',
};

describe('actor-scoped run edit capabilities', () => {
  it.each([RunReadResponseSchema, RunDetailRunResponseSchema])('preserves capabilities on authorized read projections', schema => {
    expect(schema.parse({ ...createMockRun(), editCapabilities: capabilities }).editCapabilities).toEqual(capabilities);
  });
  it('keeps absence unknown on older producer reads and diff refs', () => {
    expect(RunReadResponseSchema.parse(createMockRun())).not.toHaveProperty('editCapabilities');
  });
  it.each(['INSUFFICIENT_ORG_ROLE', 'INSUFFICIENT_SCOPE'])('preserves a denied actor (%s) instead of inferring permission', denialReason => {
    const denied = { ...capabilities, canUpdate: false, mutableFields: [], unchangedOnlyFields: [], byIdOnlyFields: [], denialReason };
    expect(RunReadResponseSchema.parse({ ...createMockRun(), editCapabilities: denied }).editCapabilities).toEqual(denied);
  });
  it('rejects malformed capabilities instead of treating them as permission', () => {
    expect(() => RunReadResponseSchema.parse({ ...createMockRun(), editCapabilities: { ...capabilities, canUpdate: 'yes' } })).toThrow();
  });
  it('does not add capabilities to write echoes', () => {
    expect(RunWriteEchoResponseSchema.parse(createMockRun())).not.toHaveProperty('editCapabilities');
  });
});
