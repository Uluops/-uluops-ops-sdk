import { describe, it, expect } from 'vitest';
import {
  AgentMatrixResultResponseSchema,
} from '../../src/types/response-schemas.js';

/**
 * `shadowModes` survives the agent-matrix response schema.
 *
 * ## The third in this family, and the first on a read path
 *
 * `cluster-key-survives.test.ts` and `agent-name-survives.test.ts` guard the same
 * mechanism on **request** schemas: a plain `z.object()` strips undeclared keys rather
 * than rejecting them, so a field the schema omits is a field the caller cannot send.
 *
 * This one is the mirror image. `getAgentMatrix` returns
 * `AgentMatrixResultResponseSchema.parse(...)` (`src/operations/analytics.ts`), so an
 * undeclared key is a field the caller cannot *receive*. `ops-uluops-api` began returning
 * `shadowModes` in `7ada3b0`; until this schema declared it, the SDK parsed the response
 * successfully, returned `['matrix','analysis']`, and dropped the field with no error and
 * no type complaint. Both MCP packages call `opsClient.analytics.getAgentMatrix`, so
 * `get_agent_matrix` — the tool whose output surfaced the original shadow-mode bug — could
 * not see the fix for it.
 *
 * ## Why the field is optional rather than defaulted
 *
 * `shadowModes` exists because an exclusion that leaves no trace cannot be told apart from
 * an exclusion of nothing. `.default([])` would rebuild that ambiguity here: a server too
 * old to compute the residue would look identical to one reporting a clean one. So
 * `undefined` and `[]` are load-bearing and different, and the tests below assert the
 * difference rather than treating either as "empty".
 *
 * Assertions are on the **parse output**, not the type, for the same reason as the
 * siblings: a type-level check passes whether or not Zod keeps the value at runtime, and
 * runtime retention is the entire claim.
 */

const BASE = {
  matrix: [],
  analysis: { blindSpots: [], singlePoints: [], highOverlap: [] },
};

describe('shadowModes survives AgentMatrixResultResponseSchema', () => {
  it('is retained through parse, with its fields intact', () => {
    const parsed = AgentMatrixResultResponseSchema.parse({
      ...BASE,
      shadowModes: [{ mode: 'EPI-OMI', issueCount: 7, agentCount: 3 }],
    });

    expect(parsed.shadowModes).toEqual([{ mode: 'EPI-OMI', issueCount: 7, agentCount: 3 }]);
  });

  it('CONTROL — an undeclared key IS stripped, so the assertion above is not vacuous', () => {
    // This is the mechanism the whole test family exists for. If Zod ever stopped
    // stripping, the test above would pass for the wrong reason and this one would fail,
    // telling us so.
    const parsed = AgentMatrixResultResponseSchema.parse({
      ...BASE,
      shadowModes: [],
      notADeclaredKey: 'should not survive',
    });

    expect(Object.hasOwn(parsed, 'notADeclaredKey')).toBe(false);
    // And the declared sibling in the same payload did survive — so this is about
    // declaration, not about the parser discarding everything.
    expect(Object.hasOwn(parsed, 'shadowModes')).toBe(true);
  });

  it('is undefined when the server omits it — NOT defaulted to an empty array', () => {
    // A pre-7ada3b0 API sends no such key. Coercing that to `[]` would report "no shadow
    // modes found" for a server that never looked.
    const parsed = AgentMatrixResultResponseSchema.parse(BASE);

    expect(parsed.shadowModes).toBeUndefined();
  });

  it('distinguishes "none found" from "not reported"', () => {
    const reportedEmpty = AgentMatrixResultResponseSchema.parse({ ...BASE, shadowModes: [] });
    const notReported = AgentMatrixResultResponseSchema.parse(BASE);

    expect(reportedEmpty.shadowModes).toEqual([]);
    expect(notReported.shadowModes).toBeUndefined();
    // The two must not collapse — this inequality is the field's reason for existing.
    expect(reportedEmpty.shadowModes).not.toEqual(notReported.shadowModes);
  });

  it('rejects a malformed entry rather than silently dropping it', () => {
    const result = AgentMatrixResultResponseSchema.safeParse({
      ...BASE,
      shadowModes: [{ mode: 'EPI-OMI', issueCount: 'seven', agentCount: 3 }],
    });

    expect(result.success).toBe(false);
  });
});
