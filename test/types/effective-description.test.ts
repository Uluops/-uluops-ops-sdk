import { describe, it, expect } from 'vitest';
import { IssueResponseSchema } from '../../src/types/response-schemas.js';
import { createMockIssue } from '../contract-helpers.js';

describe('effectiveDescription compatibility', () => {
  it.each(['remediation narrative', null, undefined])('retains the detail narrative %s and occurrence description', effectiveDescription => {
    const issue = createMockIssue({ description: 'latest occurrence', ...(effectiveDescription !== undefined ? { effectiveDescription } : {}) });
    const parsed = IssueResponseSchema.parse(issue);
    expect(parsed.description).toBe('latest occurrence');
    expect(parsed.effectiveDescription).toBe(effectiveDescription);
    if (effectiveDescription === undefined) expect(parsed).not.toHaveProperty('effectiveDescription');
  });
  it('rejects malformed narratives', () => {
    expect(IssueResponseSchema.safeParse({ ...createMockIssue(), effectiveDescription: 42 }).success).toBe(false);
  });
});
