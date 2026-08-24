/**
 * Tolerance-window fixtures (tool-sweep breaking train, Train A).
 *
 * SDK 5.23.0 must parse BOTH the pre-flip (API < 2.0.0) and post-flip
 * (API 2.0.0) wire shapes for every surface the flip changes. Each fixture
 * pair below is the contract:
 *   - in 5.23.x: OLD and NEW must both parse (this file).
 *   - in 6.0.0: NEW must parse, OLD must FAIL — flip the old-wire
 *     assertions to `safeParse(...).success === false` and keep the file.
 */
import { describe, it, expect } from 'vitest';
import {
  RunResponseSchema,
  RunAnalysisResponseSchema,
  AgentRunsAnalysisEnvelopeSchema,
  MergeProjectsResultResponseSchema,
  AgentPerformanceResponseSchema,
  AgentLifecycleEntryResponseSchema,
} from '../../src/types/response-schemas.js';

// ── Run reads (T10/T11) ─────────────────────────────────────────────────────

const RUN_CORE = {
  id: '3f1d3f1d-0000-4000-8000-000000000001',
  projectId: '3f1d3f1d-0000-4000-8000-000000000002',
  runNumber: 12,
  workflowType: 'consumer-validate',
  timestamp: '2026-08-24T00:00:00.000Z',
  allGatesPassed: true,
  averageScore: 88.5,
  archivedAt: null,
  archiveReason: null,
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
};

/** Pre-flip: the full 28-field raw row. */
const RUN_OLD_WIRE = {
  ...RUN_CORE,
  authorId: null,
  rawMarkdown: '# report',
  idempotencyKey: 'abc',
  payloadHash: 'deadbeef',
  definitionType: 'pipeline',
  definitionName: 'consumer-validate',
  definitionVersion: '1.0.1',
  definitionHash: 'cafe',
  definitionId: null,
  registrySyncedAt: null,
  mergedFromProjectId: null,
  mergedFromRunNumber: null,
  mergedFromIdempotencyKey: null,
};

/** Post-flip: the slim read projection (T10 drops the ten). */
const RUN_NEW_WIRE = {
  ...RUN_CORE,
  mergedFromProjectId: null,
  mergedFromRunNumber: null,
  mergedFromIdempotencyKey: null,
};

describe('tolerance window: RunResponseSchema (T10)', () => {
  it('parses the pre-flip full raw row (old wire)', () => {
    expect(RunResponseSchema.safeParse(RUN_OLD_WIRE).success).toBe(true);
  });

  it('parses the post-flip slim read projection (new wire)', () => {
    expect(RunResponseSchema.safeParse(RUN_NEW_WIRE).success).toBe(true);
  });

  it('control: still rejects a row missing a genuinely required field', () => {
    const { runNumber: _dropped, ...broken } = RUN_NEW_WIRE;
    expect(RunResponseSchema.safeParse(broken).success).toBe(false);
  });
});

// ── Run analysis totals (T22) ───────────────────────────────────────────────

describe('tolerance window: RunAnalysisResponseSchema (T22)', () => {
  it('parses the pre-flip {records, summaries, total} (old wire)', () => {
    expect(
      RunAnalysisResponseSchema.safeParse({ records: [], summaries: [], total: 0 }).success,
    ).toBe(true);
  });

  it('parses the post-flip split totals (new wire)', () => {
    expect(
      RunAnalysisResponseSchema.safeParse({
        records: [],
        summaries: [],
        recordsTotal: 0,
        summariesTotal: 1,
      }).success,
    ).toBe(true);
  });
});

// ── Agent runs analysis envelope (T22) ──────────────────────────────────────

describe('tolerance window: AgentRunsAnalysisEnvelopeSchema (T22)', () => {
  it('parses the pre-flip nested {data: {items, total}} (old wire)', () => {
    expect(
      AgentRunsAnalysisEnvelopeSchema.safeParse({ data: { items: [], total: 0 } }).success,
    ).toBe(true);
  });

  it('parses the post-flip flat {data: [...], total} (new wire)', () => {
    expect(
      AgentRunsAnalysisEnvelopeSchema.safeParse({ data: [], total: 0 }).success,
    ).toBe(true);
  });
});

// ── Merge projects casing (T23) ─────────────────────────────────────────────

const MERGE_SNAKE = {
  source: { id: '3f1d3f1d-0000-4000-8000-000000000003', name: 'src', run_count: 2, issue_count: 3, status_after: 'soft-deleted' },
  target: {
    id: '3f1d3f1d-0000-4000-8000-000000000004', name: 'tgt',
    run_count_before: 1, issue_count_before: 1, run_count_after: 3, issue_count_after: 4,
  },
  moved: { runs: 2, issues: 3, issue_dedupes: 0, occurrences_reparented: 0, issue_notes_reparented: 0, status_history_reparented: 0 },
  conflicts: [{ kind: 'fingerprint_dedup', source_id: '3f1d3f1d-0000-4000-8000-000000000005', target_id: '3f1d3f1d-0000-4000-8000-000000000006', resolution: 'merged' }],
  audit: { merge_id: 'm1', timestamp: '2026-08-24T00:00:00.000Z', actor_id: 'system', dry_run: false },
};

const MERGE_CAMEL = {
  source: { id: '3f1d3f1d-0000-4000-8000-000000000003', name: 'src', runCount: 2, issueCount: 3, statusAfter: 'soft-deleted' },
  target: {
    id: '3f1d3f1d-0000-4000-8000-000000000004', name: 'tgt',
    runCountBefore: 1, issueCountBefore: 1, runCountAfter: 3, issueCountAfter: 4,
  },
  moved: { runs: 2, issues: 3, issueDedupes: 0, occurrencesReparented: 0, issueNotesReparented: 0, statusHistoryReparented: 0 },
  conflicts: [{ kind: 'fingerprint_dedup', sourceId: '3f1d3f1d-0000-4000-8000-000000000005', targetId: '3f1d3f1d-0000-4000-8000-000000000006', resolution: 'merged' }],
  audit: { mergeId: 'm1', timestamp: '2026-08-24T00:00:00.000Z', actorId: 'system', dryRun: false },
};

describe('tolerance window: MergeProjectsResultResponseSchema (T23)', () => {
  it('parses the pre-flip spec-§5 snake_case (old wire)', () => {
    expect(MergeProjectsResultResponseSchema.safeParse(MERGE_SNAKE).success).toBe(true);
  });

  it('parses the post-flip spec-0.3.5 camelCase (new wire)', () => {
    expect(MergeProjectsResultResponseSchema.safeParse(MERGE_CAMEL).success).toBe(true);
  });

  it('control: rejects a mixed-case body missing either arm', () => {
    const mixed = { ...MERGE_CAMEL, moved: MERGE_SNAKE.moved };
    expect(MergeProjectsResultResponseSchema.safeParse(mixed).success).toBe(false);
  });
});

// ── Nullable aggregate scores (found live, Train A E2E) ─────────────────────
// An agent with no scored runs aggregates averageScore/passRate to NULL —
// the API's own types say `number | null`; the SDK asserted non-null and
// threw on real prod rows (list_agents was broken in prod when found).

describe('nullable aggregate scores (agent analytics)', () => {
  it('AgentPerformanceResponseSchema parses null score/passRate rows', () => {
    expect(
      AgentPerformanceResponseSchema.safeParse({
        name: 'foucault-explorer', totalRuns: 3, averageScore: null, passRate: null, totalIssuesFound: 0,
      }).success,
    ).toBe(true);
  });

  it('AgentLifecycleEntryResponseSchema parses null avgScore/passRate rows', () => {
    expect(
      AgentLifecycleEntryResponseSchema.safeParse({
        name: 'foucault-explorer', definitionVersion: '1.0.0', firstSeenAt: '2026-08-19T00:00:00.000Z',
        runs: 3, avgScore: null, passRate: null,
      }).success,
    ).toBe(true);
  });

  it('control: non-numeric junk still rejects', () => {
    expect(
      AgentPerformanceResponseSchema.safeParse({
        name: 'x', totalRuns: 1, averageScore: 'high', passRate: null, totalIssuesFound: 0,
      }).success,
    ).toBe(false);
  });
});
