/**
 * `agentName` survives the analysis-record schema.
 *
 * ## Why this test exists rather than a type assertion
 *
 * This is the sibling of `cluster-key-survives.test.ts`, and the same reasoning
 * applies verbatim: `SaveRunInputSchema` is a plain `z.object()`, and Zod's default
 * for an undeclared key is **strip, not error**. `AnalysisRecordInput` in
 * `src/types/runs.ts` has declared `agentName` all along, so a caller setting it saw
 * no type error, no validation error, and a successful request.
 *
 * ## What made this one harder to see than `clusterKey`
 *
 * The value reached the wire anyway — but by accident, not by contract. `save()`
 * discards `validateSaveRunInput`'s return value and transmits the raw `input`, so
 * the *declared* contract and the *transmitted* contract were different objects that
 * happened to agree. The failure was latent: the first refactor to send the parsed
 * value — the natural move when adding client-side normalization — would have
 * deleted `agentName` from every record with nothing anywhere reporting it.
 *
 * The degradation is also worse than `clusterKey`'s. That one became NULL, which
 * announces itself. This one becomes the tracker's fallback chain
 * (`definitionName ?? agents[0].name ?? 'unknown'`), after which `agentType` is
 * inferred from that string — so the row reads as confidently attributed to an agent
 * that never produced it. Observed on tracker run #4 (2026-08-09) through the MCP
 * path, which omitted the field for the same reason: 32 records from two analysts
 * stored under a definition name, every one typed `validator`.
 *
 * Assertions are on the **parse output**, not the type: a type-level check passes
 * whether or not Zod keeps the value at runtime, and runtime retention is the claim.
 */
import { describe, it, expect } from 'vitest';
import { SaveRunInputSchema, UpdateRunInputSchema } from '../../src/types/schemas.js';

const record = {
  recordType: 'fear',
  recordId: 'F1',
  title: 'Non-string recordType becomes a storable fabricated type',
  data: { register: 'tactical' },
};

const base = {
  project: 'uluops-core',
  workflowType: 'post-implementation',
  agents: [{ name: 'anxiety-reader', decision: 'FRAGILITY_MASKED' }],
  // Required by SaveRunInputSchema (the API defaults it; the SDK does not). Omitting
  // it made every throw-assertion below pass for the wrong reason — a parse that dies
  // on a missing envelope field proves nothing about agentName.
  recommendations: [],
};

/** Parse a full save-run input and return the first analysis record as parsed. */
function parseRecord(overrides: Record<string, unknown>) {
  const parsed = SaveRunInputSchema.parse({
    ...base,
    analysisRecords: [{ ...record, ...overrides }],
  });
  return parsed.analysisRecords?.[0];
}

describe('SaveRunInputSchema — analysisRecords[].agentName', () => {
  it('retains agentName through parse', () => {
    // Positive form. `not.toBeUndefined()` would also pass on a schema that threw
    // before reaching here, and asserting on the input object is meaningless — the
    // claim is about what comes OUT of parse.
    expect(parseRecord({ agentName: 'anxiety-reader' })?.agentName).toBe('anxiety-reader');
  });

  it('keeps per-record agents distinct rather than collapsing them onto one', () => {
    // The exact shape of the observed defect: a multi-agent run whose records all
    // ended up under a single name.
    const parsed = SaveRunInputSchema.parse({
      ...base,
      analysisRecords: [
        { ...record, recordId: 'F1', agentName: 'anxiety-reader' },
        { ...record, recordId: 'B1', agentName: 'operators-eye' },
      ],
    });
    expect(parsed.analysisRecords?.map((r) => r.agentName)).toEqual([
      'anxiety-reader',
      'operators-eye',
    ]);
  });

  it('omits the key when absent, rather than defaulting it', () => {
    // Absent must stay absent. The tracker's run-level fallback is the CORRECT
    // behaviour for a single-agent run; defaulting here would pre-empt it with a
    // guess made at the wrong layer.
    expect(parseRecord({})?.agentName).toBeUndefined();
  });

  // Until 7.3.0 the two tests below asserted that the SAVE schema throws on `''` and on a
  // 101-character name. The reasons were real (`''` defeated the tracker's
  // `agentName ?? default` fallback; a long name would truncate into a different agent),
  // and the server now owns both on the save path (ops-api R2): `''` and whitespace count
  // as absent (A4), and an unreadable name becomes its own rejected unit. A client throw
  // there would cost the whole run for one agent's name, the failure R3 removes. The
  // UPDATE path stays strict (spec §3.7), so the assertions move there.
  it('save: leaves an empty or over-long agentName to the server (envelope only, 7.3.0)', () => {
    expect(parseRecord({ agentName: '' })?.agentName).toBe('');
    expect(parseRecord({ agentName: 'a'.repeat(101) })?.agentName).toHaveLength(101);
  });

  it('update: rejects an empty agentName instead of storing a nameless record', () => {
    expect(UpdateRunInputSchema.safeParse({ analysisRecords: [{ ...record, agentName: '' }] }).success).toBe(false);
  });

  it('update: rejects a name longer than the tracker column instead of silently truncating', () => {
    expect(UpdateRunInputSchema.safeParse({ analysisRecords: [{ ...record, agentName: 'a'.repeat(101) }] }).success).toBe(false);
    const ok = UpdateRunInputSchema.parse({ analysisRecords: [{ ...record, agentName: 'a'.repeat(100) }] });
    expect(ok.analysisRecords?.[0]?.agentName).toHaveLength(100);
  });
});
