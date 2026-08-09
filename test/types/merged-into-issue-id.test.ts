import { describe, it, expect } from 'vitest';
import { IssueResponseSchema } from '../../src/types/response-schemas.js';
import { createMockIssue } from '../contract-helpers.js';

// `issues.merged_into_issue_id` is added by ops-uluops-api migration 078 (tracker
// a5639db7). It records which issue absorbed a merge source, so correlation can forward
// a re-detected finding to the surviving issue instead of reattaching it to the
// merged-away row.
//
// This is the MIRROR IMAGE of the resolutionRunId case in the sibling test file, and the
// asymmetry is the point. There, a field was leaving the wire and had to be made optional
// BEFORE the API dropped it. Here, a field arrived on the wire FIRST and this SDK is
// catching up — `z.object()` strips unknown keys rather than erroring, so every SDK
// release before this one silently discarded the value. That is why the field went
// unnoticed: the failure mode of a late-added field is not an error, it is silence.
//
// Optional, not required, for the same independent-deploy reason in the other direction:
// this SDK must still parse a response from an API that predates 078.
describe('IssueResponseSchema carries mergedIntoIssueId', () => {
  const TARGET = '7c1d4e90-0000-4000-8000-0b3d01212e24';

  it('accepts and PRESERVES a uuid value — the whole point of the change', () => {
    const result = IssueResponseSchema.safeParse(
      createMockIssue({ mergedIntoIssueId: TARGET }),
    );
    expect(result.success).toBe(true);
    // The load-bearing assertion. Before this field was declared, the schema still
    // parsed successfully and simply dropped the key — so `success: true` alone would
    // have passed against the broken state. Asserting the VALUE survives is what makes
    // this test discriminate.
    if (result.success) expect(result.data.mergedIntoIssueId).toBe(TARGET);
  });

  it('accepts mergedIntoIssueId: null — an issue that was never merged', () => {
    const result = IssueResponseSchema.safeParse(
      createMockIssue({ mergedIntoIssueId: null }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mergedIntoIssueId).toBeNull();
  });

  it('accepts the key OMITTED, so an API older than migration 078 still parses', () => {
    const { mergedIntoIssueId: _absent, ...withoutField } = createMockIssue({
      mergedIntoIssueId: TARGET,
    });
    expect(Object.hasOwn(withoutField, 'mergedIntoIssueId')).toBe(false); // fixture guard

    const result = IssueResponseSchema.safeParse(withoutField);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mergedIntoIssueId).toBeUndefined();
  });

  it('still rejects a malformed value — optional relaxed presence, not the type', () => {
    // Spread a VALID fixture rather than passing the bad value as an override:
    // createMockIssue self-validates under STRICT_CONTRACTS and would throw before the
    // assertion is reached, passing the test for the wrong reason. Same trap the
    // resolutionRunId suite documents.
    const malformed = { ...createMockIssue(), mergedIntoIssueId: 'not-a-uuid' };
    const result = IssueResponseSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });
});
