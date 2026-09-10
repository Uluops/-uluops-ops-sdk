import { describe, it, expect } from 'vitest';
import { IssueResponseSchema, RunDetailsResponseSchema } from '../../src/types/response-schemas.js';
import { createMockIssue } from '../contract-helpers.js';

// `description` lives on `occurrences`, never on `issues`. It reaches the issue
// listing as a derived value (ops-uluops-api computes the latest occurrence's
// description with a correlated subquery in `findByProject`) and reaches run
// details directly, because `findByRun` already selects full occurrence rows.
//
// This is the SAME SHAPE as the mergedIntoIssueId case next door, and for the
// same reason worth its own suite: the failure mode of an undeclared field is
// not an error, it is SILENCE. `z.object()` strips unknown keys and returns a
// clean 200, so a listing that omits `description` is indistinguishable from
// findings that genuinely have none — and consumers read the omission as an
// absence. A remediation pass over ops-uluops-api did exactly that, spending a
// whole iteration re-investigating seven findings whose descriptions each said
// "FIXED IN RUN", one call away on get_issue_details (tracker `fc862289`).
//
// Optional in both directions: this SDK must parse a response from an API that
// predates the change, and must not require the field on the read paths that
// legitimately do not supply it (by-id, by-fingerprint).
describe('IssueResponseSchema carries the occurrence description', () => {
  const DESC = 'Guard was inverted on the error path. FIXED IN RUN.';

  it('accepts and PRESERVES the value — the whole point of the change', () => {
    const result = IssueResponseSchema.safeParse(createMockIssue({ description: DESC }));
    expect(result.success).toBe(true);
    // The load-bearing assertion. Before the field was declared the schema still
    // parsed successfully and dropped the key, so `success: true` alone passes
    // against the broken state. Asserting the VALUE survives is what makes this
    // test discriminate — and it is precisely the check whose absence let the
    // field go missing unnoticed in the first place.
    if (result.success) expect(result.data.description).toBe(DESC);
  });

  it('accepts description: null — an occurrence that recorded none', () => {
    const result = IssueResponseSchema.safeParse(createMockIssue({ description: null }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeNull();
  });

  it('accepts the key OMITTED, so a read path that does not derive it still parses', () => {
    const { description: _absent, ...withoutField } = createMockIssue({ description: DESC });
    expect(Object.hasOwn(withoutField, 'description')).toBe(false); // fixture guard

    const result = IssueResponseSchema.safeParse(withoutField);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeUndefined();
  });

  it('still rejects a wrong-typed value — optional relaxed presence, not the type', () => {
    // Spread a VALID fixture rather than passing the bad value as an override:
    // createMockIssue self-validates under STRICT_CONTRACTS and would throw
    // before the assertion is reached, passing for the wrong reason. Same trap
    // the resolutionRunId and mergedIntoIssueId suites document.
    const malformed = { ...createMockIssue(), description: 42 };
    expect(IssueResponseSchema.safeParse(malformed).success).toBe(false);
  });

  it('rejects a description beyond MAX_DESCRIPTION rather than truncating it', () => {
    // occurrences.description is TEXT; the 10k ceiling is the SDK's own bound.
    // Refusing is right — a silently truncated forensic record is worse than a
    // loud parse failure, which is the entire lesson of this field's history.
    const tooLong = { ...createMockIssue(), description: 'x'.repeat(10_001) };
    expect(IssueResponseSchema.safeParse(tooLong).success).toBe(false);
  });
});

describe('RunDetailsResponseSchema carries description on recommendations', () => {
  const DESC = 'Census guard passed green with a hidden secret column. FIXED IN RUN.';

  // Reach the inline per-recommendation schema directly rather than building a
  // whole valid run-details payload around it. The `run` branch requires a full
  // RunDetailRunResponseSchema fixture that has nothing to do with this field —
  // hand-building one would make the test fail for reasons unrelated to what it
  // claims to check, and rot every time that schema gains a required key.
  const recSchema = RunDetailsResponseSchema.shape.recommendations.element;

  const baseRec = {
    issueId: '6f1c2a82-0000-4000-8000-0b3d01212e24',
    title: 'Census guard fail-open',
    priority: 'critical',
    agent: 'hostile-reader',
    status: 'new',
    issueStatus: 'open',
  };

  it('PRESERVES the description on a recommendation', () => {
    const result = recSchema.safeParse({ ...baseRec, description: DESC });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe(DESC);
  });

  it('accepts the key omitted, so a pre-change API still parses', () => {
    const result = recSchema.safeParse(baseRec);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeUndefined();
  });

  it('accepts null', () => {
    const result = recSchema.safeParse({ ...baseRec, description: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeNull();
  });

  it('guard: the base fixture is itself valid, so the checks above test the field', () => {
    // Without this, a baseRec that failed for an unrelated reason would make the
    // omitted-key test pass for the wrong reason.
    expect(recSchema.safeParse(baseRec).success).toBe(true);
  });
});
