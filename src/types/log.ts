/**
 * `ulu log` — the project's second history (ulu log spec v0.1.13 §3.2 D2/D10/D12,
 * §3.3 D3/D13/D14, §3.6 D6/D15/D16; checklist Phase 3).
 *
 * Three reads: `projects.getLog` (the stream — runs and decisions interleaved
 * newest first, keyset-paged), `projects.getLogStat` (the rollup) and
 * `orgs.getLogStat` (the same rollup org-wide plus a per-project table). The
 * shapes here are the API's business objects (`ops-uluops-api`
 * `src/business-objects/project-log.ts`) parsed strictly at the boundary — a
 * field the server adds is dropped, a field it removes fails the parse.
 *
 * Three ledger facts every consumer must keep (spec §2): `reason` is optional
 * and `null` means *no reason recorded*; `source` is `'agent'` or `null`, and
 * `null` is *unattributed*, never *human*; a `regression` event is a row a RUN
 * re-detected, while a `resolved → open` decision without a run is *reopened
 * by decision* (D12) — the SDK types both and does not collapse them.
 */
import { z } from 'zod';

// ============================================
// QUERIES
// ============================================

/** Event kinds the stream can carry; `kind` filters to a subset. */
export const LOG_EVENT_KINDS = ['run', 'decision', 'regression'] as const;
export type LogEventKind = (typeof LOG_EVENT_KINDS)[number];

/**
 * Query for `projects.getLog`. Keys go to the wire AS NAMED (`workflowType`,
 * `includeArchived`) — the API's schema is camelCase and would silently ignore a
 * snake_cased key, so this query deliberately does not pass through the
 * SDK's generic `toApiQuery` (which snake_cases).
 */
export interface ProjectLogQuery {
  /** ISO 8601; `since <= until` or the API answers 400. */
  since?: string;
  until?: string;
  /** 1–500, default 50. Outside the range is a 400 (the API does not clamp). */
  limit?: number;
  /** Opaque — pass back a `nextCursor` verbatim. Anything else is a 400. */
  cursor?: string;
  /** Subset of event kinds; default all three. */
  kind?: LogEventKind[];
  /** Filters `run` events only — a ledger row has no workflow. */
  workflowType?: string;
  /** Two-sided: runs by snapshot agent name, ledger rows by `issues.agent`. */
  agent?: string;
  /** Archived runs are excluded unless this is `true`. */
  includeArchived?: boolean;
}

/** Window for either rollup (§3.3): two frames on two clocks; no window means all time. */
export interface LogStatQuery {
  since?: string;
  until?: string;
}

// ============================================
// STREAM (§3.2)
// ============================================

const nullableString = z.string().nullable();

export const LogRunEventSchema = z.object({
  type: z.literal('run'),
  runNumber: z.number().int(),
  /** As reported by the saving client — `pipeline_runs.timestamp` (1 s precision). */
  at: z.string(),
  workflowType: z.string(),
  definitionType: nullableString,
  definitionName: nullableString,
  definitionVersion: nullableString,
  averageScore: z.number().nullable(),
  allGatesPassed: z.boolean().nullable(),
  /** `null` on runs saved before migration 065 — stays `null`, never zeros. */
  counts: z.object({
    new: z.number().int(),
    recurring: z.number().int(),
    regressions: z.number().int(),
    observed: z.number().int(),
  }).nullable(),
  occurrenceCounts: z.object({
    new: z.number().int().nonnegative(),
    recurring: z.number().int().nonnegative(),
    regressions: z.number().int().nonnegative(),
    observed: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative(),
  }).optional(),
  agents: z.array(z.string()),
});
export type LogRunEvent = z.infer<typeof LogRunEventSchema>;

export const LogDecisionEventSchema = z.object({
  type: z.literal('decision'),
  issueId: z.string(),
  /** 12-char prefix — what the `issues history` picker prints. */
  fingerprint: z.string(),
  title: z.string(),
  from: nullableString,
  to: z.string(),
  /** `null` = no reason recorded. */
  reason: nullableString,
  /** `'agent'` or `null`; `null` is unattributed, never "human". */
  source: z.literal('agent').nullable(),
  /** Server clock — `status_history.changed_at` (ms precision). */
  at: z.string(),
  /** Insertion order within a second for post-080 rows; frozen-arbitrary before. Never chronology. */
  seq: z.number().int(),
});
export type LogDecisionEvent = z.infer<typeof LogDecisionEventSchema>;

export const LogRegressionEventSchema = z.object({
  type: z.literal('regression'),
  issueId: z.string(),
  fingerprint: z.string(),
  title: z.string(),
  /** `null` when the detecting run is archived or otherwise unresolvable — render *via run ?*. */
  viaRunNumber: z.number().int().nullable(),
  source: z.literal('agent').nullable(),
  at: z.string(),
  seq: z.number().int(),
});
export type LogRegressionEvent = z.infer<typeof LogRegressionEventSchema>;

export const LogEventSchema = z.discriminatedUnion('type', [LogRunEventSchema, LogDecisionEventSchema, LogRegressionEventSchema]);
export type LogEvent = z.infer<typeof LogEventSchema>;

/** One page of the stream. The envelope IS the page (no `data` wrapper outside `data[]`). */
export const ProjectLogPageSchema = z.object({
  data: z.array(LogEventSchema),
  count: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});
export type ProjectLogPage = z.infer<typeof ProjectLogPageSchema>;

// ============================================
// ROLLUP (§3.3) — shared body, project and org heads
// ============================================

const nullableIso = z.string().nullable();

/** D14: fixed over all seven statuses; `merged` normally 0; `open` counts transitions INTO open (reopens). */
export const LogByStatusSchema = z.object({
  open: z.number().int(),
  completed: z.number().int(),
  deferred: z.number().int(),
  wontfix: z.number().int(),
  merged: z.number().int(),
  'false-positive': z.number().int(),
  observation: z.number().int(),
});

/** Fixed over the five non-open statuses. */
export const LogWithReasonSchema = z.object({
  completed: z.number().int(),
  deferred: z.number().int(),
  wontfix: z.number().int(),
  'false-positive': z.number().int(),
  observation: z.number().int(),
});

export const LogStatBodySchema = z.object({
  window: z.object({ since: nullableIso, until: nullableIso }),
  /** Cohort frame — run clock. */
  examined: z.object({
    runs: z.number().int(),
    first: nullableIso,
    last: nullableIso,
    byWorkflow: z.array(z.object({ workflowType: z.string(), runs: z.number().int() })),
    /** Distinct definitions; (name, version) fallback for NULL ids. Not additive across projects. */
    definitions: z.number().int(),
  }),
  found: z.object({ issues: z.number().int() }),
  /** CURRENT status of each found issue — sums to `found.issues`; not "decisions in the window". */
  decided: z.object({
    completed: z.number().int(),
    deferred: z.number().int(),
    wontfix: z.number().int(),
    'false-positive': z.number().int(),
    observation: z.number().int(),
    open: z.number().int(),
    withReason: LogWithReasonSchema,
  }),
  /** D12: distinct issues, with the row count beside each. */
  cameBack: z.object({
    /** A run re-detected it (`run_id IS NOT NULL`). */
    detected: z.number().int(),
    detectedEvents: z.number().int(),
    /** Reopened by decision (no run). Never "by hand". */
    reopened: z.number().int(),
    reopenedEvents: z.number().int(),
    /** ANY window, by definition. */
    lastDetectedAtAllTime: nullableIso,
  }),
  /** Activity frame — ledger clock. */
  activity: z.object({
    decisions: z.number().int(),
    byStatus: LogByStatusSchema,
    /** D13: re-stated dispositions (self-transitions) — counted, never listed. */
    restated: z.number().int(),
    /** Runs in the window with correlation counts recorded (saved after migration 065). */
    runsWithCorrelation: z.number().int(),
  }),
});
export type LogStatBody = z.infer<typeof LogStatBodySchema>;

export const ProjectLogStatSchema = LogStatBodySchema.extend({ projectId: z.string() });
export type ProjectLogStat = z.infer<typeof ProjectLogStatSchema>;

/** One row of the org rollup's table (D15): each column is that project's own rollup measure. */
export const OrgLogProjectSummarySchema = z.object({
  name: z.string(),
  /** = `examined.runs` */
  runs: z.number().int(),
  /** = `found.issues` */
  issues: z.number().int(),
  /** = `decided.completed` */
  fixed: z.number().int(),
  /** = `cameBack.detected` — run-caught only, not reopens by decision. */
  regressions: z.number().int(),
  /** The sort key (last run in the window, desc); `null` sorts last, by name. */
  lastRunAt: nullableIso,
});
export type OrgLogProjectSummary = z.infer<typeof OrgLogProjectSummarySchema>;

export const OrgLogStatSchema = LogStatBodySchema.extend({
  /** The org slug the call named. */
  org: z.string(),
  /**
   * When these numbers were computed. The org rollup is served from a 60 s TTL
   * cache per (org, window) (D16) — a response can be that old, and this says how old.
   */
  computedAt: z.string(),
  /** Live projects of the org, last run desc then name; at most 100 — `hasMoreProjects` says when the cap bit. */
  projects: z.array(OrgLogProjectSummarySchema),
  hasMoreProjects: z.boolean(),
});
export type OrgLogStat = z.infer<typeof OrgLogStatSchema>;

// ============================================
// ORG LIST (`GET /orgs`) — what `ulu log --orgs` iterates
// ============================================

export const OrgListEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  isPersonal: z.boolean(),
  role: z.string(),
  memberCount: z.number().int().nonnegative(),
  subscriptionTier: z.string(),
  paymentStatus: z.string().nullable(),
  suspendedAt: z.string().nullable(),
});
export type OrgListEntry = z.infer<typeof OrgListEntrySchema>;

export const OrgListResponseSchema = z.object({ organizations: z.array(OrgListEntrySchema) });
