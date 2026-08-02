import { describe, it, expect } from 'vitest';
import { IssueResponseSchema } from '../../src/types/response-schemas.js';
import { createMockIssue } from '../contract-helpers.js';

// `issues.resolution_run_id` is dropped by ops-uluops-api migration 075 (tracker
// 83eeac77): it encoded resolution-by-run, which the tracker never implemented, and was
// NULL on all 18,192 production rows.
//
// This schema is RUNTIME-PARSED — every response goes through `.parse()`. So a required
// key the API stops sending does not surface as `null`; it throws a ZodError on every
// issue read. Marking the field optional here, and releasing that BEFORE the API drops
// it, is what lets the two deploy independently. These tests assert both halves of that
// tolerance, because a release that only proves one half proves nothing about ordering.
describe('IssueResponseSchema tolerates an absent resolutionRunId', () => {
  it('accepts a response with resolutionRunId OMITTED (post-migration-075 API)', () => {
    const { resolutionRunId: _dropped, ...withoutField } = createMockIssue();
    expect(Object.hasOwn(withoutField, 'resolutionRunId')).toBe(false); // fixture guard

    const result = IssueResponseSchema.safeParse(withoutField);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.resolutionRunId).toBeUndefined();
  });

  it('still accepts resolutionRunId: null (any API older than migration 075)', () => {
    const result = IssueResponseSchema.safeParse(createMockIssue({ resolutionRunId: null }));
    expect(result.success).toBe(true);
  });

  it('still accepts a uuid value, so no historical response shape is rejected', () => {
    const uuid = '3f2b8c1a-0000-4000-8000-0b3d01212e24';
    const result = IssueResponseSchema.safeParse(createMockIssue({ resolutionRunId: uuid }));
    expect(result.success).toBe(true);
  });

  it('still rejects a malformed value — optional relaxed presence, not the type', () => {
    // Built by spreading a VALID fixture rather than passing the bad value as an
    // override: createMockIssue self-validates under STRICT_CONTRACTS and throws, so the
    // override form never reaches the assertion and the test passes for the wrong reason.
    const malformed = { ...createMockIssue(), resolutionRunId: 'not-a-uuid' };
    const result = IssueResponseSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });
});
