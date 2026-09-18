/**
 * Response Zod schemas — runtime contract validation
 *
 * These schemas serve two roles:
 * 1. **Test contract**: ensure mock data matches the actual API shape
 * 2. **Runtime parsing**: every API response is parsed via `schema.parse()`,
 *    which strips unknown fields (Zod's default behavior). This means new
 *    API fields are silently dropped until the schema is updated — the SDK
 *    won't break, but consumers won't see new fields either.
 *
 * Schemas using `.passthrough()` (e.g., ExplorationSectionResponseSchema)
 * preserve unknown fields for extensible data structures.
 */
import { z } from 'zod';
import {
  PRIORITIES,
  STATUSES,
  SEVERITIES,
  // FAILURE_DOMAINS removed — response schemas use permissive string validation
  ISSUE_TYPES,
  NOTE_TYPES,
  USER_ROLES,
  SUBSCRIPTION_TIERS,
  FAILURE_CODE_PATTERN,
} from './enums.js';

// ============================================
// SHARED RESPONSE SCHEMAS
// ============================================

export const DateTimeStringSchema = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/));
export const NullableDateTimeSchema = DateTimeStringSchema.nullable();

export const PriorityResponseSchema = z.enum(PRIORITIES);
export const StatusResponseSchema = z.enum(STATUSES);
export const SeverityResponseSchema = z.enum(SEVERITIES);
export const FailureDomainResponseSchema = z.string().regex(/^[A-Z]{3}$/);

/**
 * Conflict kinds emitted by `POST /projects/merge`.
 *
 * **Documentation, not validation.** The schema below deliberately does not close over
 * this list — see {@link MergeConflictKindResponseSchema}. Exported so consumers can
 * switch on the known set and so a new kind has one obvious place to be recorded.
 *
 * - `fingerprint_dedup` — source issue absorbed into a colliding live target issue.
 * - `semantic_fingerprint_dedup` — same, matched on the semantic fingerprint.
 * - `fingerprint_blocked_by_deleted` — the target project holds a SOFT-DELETED issue
 *   owning that fingerprint. `uk_project_fingerprint` does not include `deleted_at`, so
 *   the hidden row still owns the key and the source issue cannot be moved onto it. The
 *   source issue is left in the source project — and because a successful merge
 *   soft-deletes that project, it becomes hidden with it. Restore the target's deleted
 *   issue and re-run.
 * - `run_number_collision` — RESERVED, never emitted; run re-keying uses a
 *   collision-free global offset.
 */
export const MERGE_PROJECT_CONFLICT_KINDS = [
  'fingerprint_dedup',
  'run_number_collision',
  'semantic_fingerprint_dedup',
  'fingerprint_blocked_by_deleted',
] as const;

/**
 * A merge conflict kind. Known values are documented above; unknown values are
 * preserved verbatim rather than rejected.
 *
 * `(string & {})` keeps autocomplete for the known set while still admitting any
 * string — the TypeScript idiom for an open union.
 */
export type MergeProjectConflictKind =
  | (typeof MERGE_PROJECT_CONFLICT_KINDS)[number]
  | (string & {});

/**
 * Shape validation, NOT a closed value list — the same call this file already made for
 * `FailureDomainResponseSchema`, and for the same reason.
 *
 * `kind` is server-controlled and additive: the API gains conflict kinds without a
 * breaking change on its side. A `z.enum` here turns every such addition into a client
 * outage, because `MergeProjectsResultResponseSchema` is consumed via `.parse()`, which
 * THROWS on an unknown enum member. The failure is particularly bad for merge: the
 * merge SUCCEEDS server-side and the SDK then throws on the response, so the caller sees
 * an error for work that actually completed and may retry a non-idempotent operation.
 *
 * Recorded because it happened. `fingerprint_blocked_by_deleted` (registry-api tracker
 * `642595bb`) could not ship until this line changed — verified against this schema:
 * the same payload parsed clean with `fingerprint_dedup` and failed on
 * `conflicts.0.kind` with the new value. The regex keeps the wire format honest
 * (lower-snake identifier) without asserting knowledge of the value set.
 */
export const MergeConflictKindResponseSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);
export const IssueTypeResponseSchema = z.enum(ISSUE_TYPES);
export const NoteTypeResponseSchema = z.enum(NOTE_TYPES);
export const UserRoleResponseSchema = z.enum(USER_ROLES);
export const SubscriptionTierResponseSchema = z.enum(SUBSCRIPTION_TIERS);

export const FailureCodeResponseSchema = z.string().regex(FAILURE_CODE_PATTERN).nullable();
export const FailureSeverityCodeResponseSchema = z.enum(['C', 'H', 'M', 'L', 'I']).nullable();

// ============================================
// AUTH RESPONSE SCHEMAS
// ============================================

export const AuthUserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: UserRoleResponseSchema,
  subscriptionTier: SubscriptionTierResponseSchema,
  username: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const PublicUserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: UserRoleResponseSchema,
  subscriptionTier: SubscriptionTierResponseSchema,
  username: z.string().nullable(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  timezone: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  avatarMimeType: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp']).nullable(),
  isActive: z.boolean(),
  hasAvatar: z.boolean(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

/**
 * Login response schema.
 * The API returns `sessionToken` (preferred) but legacy clients may use `token`.
 * Both are accepted for backward compatibility; the SDK normalizes to `sessionToken`.
 */
export const LoginResponseSchema = z.object({
  user: AuthUserResponseSchema,
  sessionToken: z.string(),
  token: z.string().optional(),              // Legacy field
  expiresAt: DateTimeStringSchema,
});

/**
 * What `POST /auth/login` answers — with 200 — for an account that has TOTP or
 * a passkey enrolled: a challenge, and NO session. Snake_case on the wire
 * (`password-auth-service.ts` builds it so). The SDK turns it into an
 * `MfaRequiredError`; until 6.4.0 it hit `LoginResponseSchema` and surfaced as
 * a ZodError on `sessionToken`.
 */
export const MfaChallengeResponseSchema = z.object({
  mfa_required: z.literal(true),
  mfa_challenge_token: z.string().min(1),
  expires_at: DateTimeStringSchema,
  mfa_methods: z.array(z.string()),
});

/**
 * Register response schema — identical to {@link LoginResponseSchema}, because
 * `POST /auth/register` performs an auto-login and returns the same payload
 * (`password-auth-controller.ts` register and login return byte-identical
 * `{user, sessionToken, expiresAt}` bodies).
 *
 * **This schema previously declared a flat shape** — required `id`, `email`,
 * `isActive`, `role`, `subscriptionTier`, `createdAt`, `updatedAt` at the top
 * level, with `user` optional. The API has never returned that shape, so
 * `auth.register()` threw a raw `ZodError` with seven issues on every single
 * call, on a successful HTTP 201, after the account had already been created
 * server-side. The correct schema was sitting twelve lines above this one the
 * whole time.
 *
 * It survived because the tests asserted against hand-written mock factories
 * built from this schema rather than from a real response — the mock and the
 * schema agreed with each other and neither agreed with the server. Any future
 * change here should be checked against a live `/auth/register` call, not
 * against a fixture derived from the schema it is meant to validate.
 */
export const RegisterResponseSchema = z.object({
  user: AuthUserResponseSchema,
  sessionToken: z.string(),
  token: z.string().optional(), // Legacy field, mirrors LoginResponseSchema
  expiresAt: DateTimeStringSchema,
});

export const PublicApiKeyResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  prefix: z.string().optional(),
  lastUsedAt: NullableDateTimeSchema,
  expiresAt: NullableDateTimeSchema,
  createdAt: DateTimeStringSchema,
  // Per-key scope (@uluops/platform v1.27.0). Raw string, not an enum: the
  // platform read surface is deliberately tolerant of an out-of-enum stored
  // value, and the SDK must not throw on one it faithfully relays.
  scope: z.string().optional(),
});
// NOT .strict() — deliberately (per-key-scopes review, 2026-08-22). The real
// silent-strip the spec worried about is fixed by DECLARING `scope` above;
// that is the whole fix. Making this response schema strict was the wrong
// tool: on a response PARSE, an undeclared field means the PLATFORM added one,
// and dropping it is correct forward-compatible resilient-client behavior (see
// this file's header). Strict would instead THROW for every consumer the first
// time platform adds any key-response field — and worse on createApiKey, which
// throws AFTER the key is minted, losing a returned-once secret. This exact
// anti-pattern is scarred twice in this file: RegisterResponseSchema (threw on
// every real 201, hidden by schema-derived mocks) and MergeConflictKindResponseSchema
// (chose a regex over an enum precisely so a server-side success is never
// undone by a client parse throw). Correctness of the field set is a
// live-contract-test job, not a runtime-strict job.

export const ApiKeyCreatedResponseSchema = z.object({
  key: z.string(),
  apiKey: PublicApiKeyResponseSchema,
});

export const PublicSessionResponseSchema = z.object({
  id: z.string(),
  expiresAt: DateTimeStringSchema,
  createdAt: DateTimeStringSchema,
  lastActiveAt: DateTimeStringSchema,
  lastUsed: DateTimeStringSchema.optional(),  // Alternative field name
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
});

export const MessageResponseSchema = z.object({
  message: z.string(),
});

export const PaginationResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative().optional(),
});

// ============================================
// PROJECT RESPONSE SCHEMAS
// ============================================

export const ProjectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  domain: z.string().optional(),
  ownerId: z.string().uuid(),
  // The org the project lives in (6.4.0). The API has emitted this on every
  // project read since org scoping landed; `z.object()` was stripping it, so a
  // re-homed project's new org was invisible through the SDK. Nullable for
  // legacy rows created before migration 061 seeded orgs; optional so a
  // projection that omits it (diff refs) still parses.
  orgId: z.string().nullable().optional(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const ProjectSummaryStatsResponseSchema = z.object({
  totalRuns: z.number().int().nonnegative(),
  totalIssues: z.number().int().nonnegative(),
  openIssues: z.number().int().nonnegative(),
  criticalIssues: z.number().int().nonnegative(),
  latestRunNumber: z.number().int().positive().nullable(),
  latestRunDate: NullableDateTimeSchema,
});

export const ProjectSummaryResponseSchema = z.object({
  project: ProjectResponseSchema,
  stats: ProjectSummaryStatsResponseSchema,
});

export const DailyIssueCountsResponseSchema = z.object({
  date: z.string(),
  total: z.number().int().nonnegative(),
  critical: z.number().int().nonnegative(),
  new: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
});

export const TrendsSummaryResponseSchema = z.object({
  averageNew: z.number(),
  averageResolved: z.number(),
  netChange: z.number(),
  trendDirection: z.enum(['improving', 'stable', 'worsening']),
});

export const ProjectTrendsResponseSchema = z.object({
  project: ProjectResponseSchema,
  days: z.number().int().positive(),
  daily: z.array(DailyIssueCountsResponseSchema),
  summary: TrendsSummaryResponseSchema,
});

// ============================================
// ISSUE RESPONSE SCHEMAS
// ============================================

// Defensive string-length ceilings on issue-domain response fields (CWE-20).
// Untrusted server responses are materialized by Zod before any consumer-side
// gate can run, so an unbounded z.string() lets a degenerate or malicious server
// force a large heap allocation on the calling host (worst case: a list endpoint
// returning many rows of oversized strings). Each ceiling is set at-or-above the
// server-side DB column size (tracker schema, verified against prod 2026-06-16)
// so a compliant server is never rejected; only oversized payloads convert from
// silent memory pressure into a loud ZodError at parse time. Margins guard
// against future column widenings (cf. failure_mode varchar(10) -> varchar(50)
// in ops-uluops-api migration 040). Reused by the history-event schemas below.
const MAX_TITLE = 500; // issues.title varchar(500)
const MAX_FINGERPRINT = 128; // issues.fingerprint varchar(64) — sha256 hex is 64; margin for re-encoding
const MAX_FAILURE_MODE = 50; // issues.failure_mode varchar(50)
const MAX_CATEGORY = 200; // issues.category varchar(100)
const MAX_FILE_PATH = 1_000; // issues/occurrences.file_path varchar(1000)
const MAX_AGENT_NAME = 255; // issues.agent / occurrences agent_name varchar(100)
const MAX_DESCRIPTION = 10_000; // occurrences.description text
const MAX_NOTE_CONTENT = 10_000; // issue_notes.content text
const MAX_REASON = 2_000; // headroom above status_history.reason varchar(1000) (migration 062)
const MAX_CREATED_BY = 200; // issue_notes.created_by varchar(200)

export const IssueResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  fingerprint: z.string().max(MAX_FINGERPRINT),
  title: z.string().max(MAX_TITLE),
  status: StatusResponseSchema,
  priority: PriorityResponseSchema,
  severity: SeverityResponseSchema.nullable(),
  failureCode: FailureCodeResponseSchema,
  failureDomain: FailureDomainResponseSchema.nullable(),
  failureMode: z.string().max(MAX_FAILURE_MODE).nullable(),
  failureSeverityCode: FailureSeverityCodeResponseSchema,
  category: z.string().max(MAX_CATEGORY).nullable(),
  agent: z.string().max(MAX_AGENT_NAME).nullable(),
  type: IssueTypeResponseSchema.nullable(),
  filePath: z.string().max(MAX_FILE_PATH).nullable(),
  lineNumber: z.number().int().nonnegative().nullable(),
  timesSeen: z.number().int().positive(),
  firstSeenRunId: z.string().uuid(),
  lastSeenRunId: z.string().uuid(),
  resolvedAt: NullableDateTimeSchema,
  /**
   * @deprecated Always absent from ops-uluops-api once migration 075 deploys, and
   * `null` on every response before that. Do not read it; it will be removed in the
   * next major.
   *
   * **Optional, not removed, and that ordering is load-bearing.** This schema is
   * runtime-parsed (see the file header) — a required key that the API stops sending
   * makes `.parse()` throw a ZodError on *every* issue read, not return null. Removing
   * the key here in the same release the API drops it would strand every consumer still
   * on an older SDK. Marking it optional accepts both shapes, so this release can go out
   * ahead of the API and consumers can upgrade at their own pace.
   *
   * The field encoded resolution-by-run, which the tracker never implemented: runs
   * detect, humans and agents resolve, and no run is in scope at a resolving transition.
   * It was NULL on all 18,192 production rows. ops-uluops-api tracker `83eeac77`.
   */
  resolutionRunId: z.string().uuid().nullable().optional(),
  // Merge provenance (merge-projects v0.3.4, ops-api mig 069); null = never merged.
  mergedFromProjectId: z.string().uuid().nullable().optional(),
  /**
   * The issue this one was merged INTO by `POST /issues/merge` (ops-api mig 078).
   * `null` = not a merge source.
   *
   * **Optional because the API has been emitting it since before this SDK release.**
   * The key has existed on the wire since mig 078 shipped; `z.object()` strips unknown
   * keys rather than erroring, so older SDKs silently dropped it — additive on the wire,
   * invisible to every consumer. Marking it optional (rather than required) keeps this
   * release parseable against an API that predates 078, which matters because the SDK
   * and the API deploy independently.
   *
   * **Why it is worth carrying.** Without it there is no way to answer "where did this
   * issue go" from any client. `status` reads `merged` and the trail ends: MCP, the CLI
   * and the dashboard all showed a dead end, and the fallbacks were parsing
   * `status_history` prose (`Merged into issue <id>`) or querying the database directly
   * — and production's DB is reachable only from EC2. During an incident that is the
   * difference between one lookup and no answer at all.
   *
   * An IDENTITY relation, not a visibility filter: it stays true when the target is
   * soft-deleted. Correlation follows it; the by-fingerprint endpoints deliberately do
   * not. Read-only — the API refuses to set it through any update path.
   */
  mergedIntoIssueId: z.string().uuid().nullable().optional(),
  /**
   * The latest occurrence's description — the agent's account of the sighting,
   * as opposed to the issue's `title`.
   *
   * **Not a column on `issues`.** It lives on `occurrences`; the API derives it
   * per issue with a correlated subquery, and only on the read paths that ask
   * for it. `GET /projects/:id/issues` carries it; the by-id and by-fingerprint
   * lookups do not.
   *
   * **Optional, and that is load-bearing in both directions.** A required key
   * makes `.parse()` throw on every issue read against an API that predates it,
   * and this SDK deploys independently of the API — the same reasoning recorded
   * on `mergedIntoIssueId` above. Absent means "this read path does not supply
   * it"; `null` means "this issue's latest occurrence has no description".
   *
   * **Why it is worth carrying.** `z.object()` strips undeclared keys and
   * returns a clean 200, so before this field existed the listing was
   * indistinguishable from findings that genuinely had no description — and
   * consumers read the omission as an absence. A remediation pass over
   * ops-uluops-api spent a full iteration re-investigating seven findings whose
   * descriptions each said "FIXED IN RUN", one call away on get_issue_details
   * (tracker `fc862289`). Same mechanism as `issueStatus` / `659d061d` below.
   */
  description: z.string().max(MAX_DESCRIPTION).nullable().optional(),
  deletedAt: NullableDateTimeSchema.optional(),  // Stripped by issueToPublic
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const OccurrenceResponseSchema = z.object({
  id: z.string().uuid(),
  issueId: z.string().uuid(),
  runId: z.string().uuid(),
  agentName: z.string().max(MAX_AGENT_NAME),
  description: z.string().max(MAX_DESCRIPTION).nullable(),
  filePath: z.string().max(MAX_FILE_PATH).nullable(),
  lineNumber: z.number().int().nonnegative().nullable(),
  classificationConfidence: z.enum(['high', 'medium', 'low']).nullable(),
  classifiedBy: z.enum(['agent', 'classifier', 'human']).nullable(),
  createdAt: DateTimeStringSchema,
});

export const IssueNoteResponseSchema = z.object({
  id: z.string().uuid(),
  issueId: z.string().uuid(),
  content: z.string().max(MAX_NOTE_CONTENT),
  noteType: NoteTypeResponseSchema,
  createdBy: z.string().max(MAX_CREATED_BY).nullable(),
  createdAt: DateTimeStringSchema,
});

/**
 * Tombstone discriminator on status_history rows.
 *
 * - `'change'`: deliberate status transition (default for new rows).
 * - `'undo'`: tombstone marking that a prior change was reverted via
 *   undoLastChange. Paired with `revertedChangeId` pointing at the row
 *   being tombstoned. The original change row is preserved (no destructive
 *   delete) so the audit trail is monotonic.
 * - `null`: pre-migration rows. Consumers MUST treat null ≡ 'change' (legacy
 *   rows are functionally deliberate transitions).
 *
 * See live-tests T2 spec §3.1 Bug B for the design rationale.
 */
export const TransitionTypeResponseSchema = z.enum(['change', 'undo']);

export const StatusHistoryResponseSchema = z.object({
  id: z.string().uuid(),
  issueId: z.string().uuid(),
  oldStatus: StatusResponseSchema.nullable(),
  from: StatusResponseSchema.nullable().optional(), // Alternative field name
  newStatus: StatusResponseSchema,
  to: StatusResponseSchema.optional(),              // Alternative field name
  reason: z.string().max(MAX_REASON).nullable(),
  changedAt: DateTimeStringSchema,
  timestamp: DateTimeStringSchema.optional(),       // Alternative field name
  // Live-tests T2 §3.1 Bug B (migration 055 in ops-uluops-api):
  // Nullable + optional so the schema parses cleanly against pre-migration
  // server responses that don't carry these fields.
  transitionType: TransitionTypeResponseSchema.nullable().optional(),
  revertedChangeId: z.string().uuid().nullable().optional(),
});

export const IssueDetailsResponseSchema = z.object({
  issue: IssueResponseSchema,
  occurrences: z.array(OccurrenceResponseSchema),
  notes: z.array(IssueNoteResponseSchema),
  history: z.array(StatusHistoryResponseSchema),
});

// ─────────────────────────────────────────────────────────────────
// Issue history envelope (live-tests T2 §3.1 — F10)
//
// Before F10: GET /issues/:id/history returned a bare `StatusHistory[]`
// (status transitions only) and undoLastChange destroyed the row it reverted.
// The audit trail was both incomplete and non-monotonic.
//
// After F10: the endpoint returns an envelope that merges three sources
// (occurrences | status | notes) into a single timestamp-sorted stream.
// Status events carry transitionType/revertedChangeId for tombstone-aware
// timeline reconstruction.
// ─────────────────────────────────────────────────────────────────

// The history-event field ceilings reuse the MAX_* constants defined above the
// issue-domain schemas (CWE-20 defensive bounds). At the 1000-event ceiling an
// unbounded description/content would otherwise allow a ~1 GB allocation on the
// calling host; the bounds convert that into a loud ZodError instead.

/** Per-run sighting of an issue, projected as a history event. */
export const HistoryOccurrenceEventSchema = z.object({
  type: z.literal('occurrence'),
  timestamp: DateTimeStringSchema,
  runId: z.string().uuid(),
  agentName: z.string().max(MAX_AGENT_NAME),
  description: z.string().max(MAX_DESCRIPTION).nullable(),
});

/** Deliberate status transition or undo tombstone, projected as a history event. */
export const HistoryStatusEventSchema = z.object({
  type: z.literal('status'),
  timestamp: DateTimeStringSchema,
  oldStatus: StatusResponseSchema.nullable(),
  newStatus: StatusResponseSchema,
  reason: z.string().max(MAX_REASON).nullable(),
  // Live-tests T2 §3.1 Bug B: tombstone fields are nullable AND optional to
  // match StatusHistoryResponseSchema above — some pre-migration server
  // responses may omit the columns entirely rather than serializing explicit
  // nulls. Today's live tracker emits explicit nulls (verified 2026-06-08),
  // but `.optional()` defends against deployment-window cases where a
  // non-current server (rollback, blue/green, MySQL driver quirk, upstream
  // proxy stripping nulls) sends pre-migration shape.
  transitionType: TransitionTypeResponseSchema.nullable().optional(),
  revertedChangeId: z.string().uuid().nullable().optional(),
});

/** User-added note, projected as a history event. */
export const HistoryNoteEventSchema = z.object({
  type: z.literal('note'),
  timestamp: DateTimeStringSchema,
  noteId: z.string().uuid(),
  content: z.string().max(MAX_NOTE_CONTENT),
  noteType: NoteTypeResponseSchema,
  createdBy: z.string().max(MAX_CREATED_BY).nullable(),
});

/** Discriminated union of the three history-event shapes. */
export const HistoryEventSchema = z.discriminatedUnion('type', [
  HistoryOccurrenceEventSchema,
  HistoryStatusEventSchema,
  HistoryNoteEventSchema,
]);

/** Envelope returned by GET /issues/:id/history. */
export const IssueHistoryEnvelopeSchema = z.object({
  issueId: z.string().uuid(),
  events: z.array(HistoryEventSchema),
  totalEvents: z.number().int().nonnegative(),
  /** True when totalEvents > 1000 (the post-merge ceiling); oldest events were dropped. */
  truncated: z.boolean(),
});

export const StatusUpdateResultResponseSchema = z.object({
  id: z.string().uuid(),
  issueId: z.string().uuid().optional(),
  fingerprint: z.string(),
  previousStatus: StatusResponseSchema,
  newStatus: StatusResponseSchema,
  updatedAt: DateTimeStringSchema,
  success: z.boolean().optional(),
});

// ============================================
// RUN RESPONSE SCHEMAS
// ============================================

/**
 * Run READ projection (API 2.0.0, tool-sweep T10) — the 14-key shape
 * `GET /runs/:id` and `GET /runs/project/:id/latest` return, and the shape
 * embedded as diff refs (T11). Strictly pinned: SDK 6.0.0 closed the Train A
 * tolerance window; pre-2.0.0 raw rows no longer parse (see
 * test/types/tolerance-window.test.ts).
 */
export const RunReadResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  runNumber: z.number().int().positive(),
  workflowType: z.string(),
  timestamp: DateTimeStringSchema,
  // Nullable: null = NOT_A_GATE — the run carried no gate-bearing agents (lens-only
  // runs); distinct from false (a gate ran and failed). See ops-uluops-api
  // save-run-decision-semantics spec v0.2.1 (D1/D5).
  allGatesPassed: z.boolean().nullable(),
  averageScore: z.number().nullable(),
  archivedAt: NullableDateTimeSchema,
  archiveReason: z.string().nullable(),
  // Merge provenance (merge-projects v0.3.4, ops-api mig 069); null = never merged.
  mergedFromProjectId: z.string().uuid().nullable(),
  mergedFromRunNumber: z.number().int().nullable(),
  mergedFromIdempotencyKey: z.string().nullable(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
  // Dashboard URL slugs — included on get_run (context join); optional
  // because get_latest_run and diff refs do not carry them.
  projectSlug: z.string().optional(),
  orgSlug: z.string().nullable().optional(),
});

/** Details-surface run (get_run_details): read projection + rawMarkdown + the
 * definition trio — human provenance stays on the details surface (T10). */
export const RunDetailRunResponseSchema = RunReadResponseSchema.extend({
  rawMarkdown: z.string().nullable(),
  definitionType: z.string().nullable(),
  definitionName: z.string().nullable(),
  definitionVersion: z.string().nullable(),
});

/**
 * Full run row as echoed by the WRITE surfaces (save_run / update_run) —
 * unchanged by T10: the write echo confirms exactly what was persisted.
 * Split from the read schemas in 6.0.0 so slimming the reads could not
 * silently slim the echoes.
 */
export const RunWriteEchoResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),               // Always present (NOT NULL in DB)
  authorId: z.string().uuid().nullable(),      // User who created the run; null for system/API-key runs
  runNumber: z.number().int().positive(),
  workflowType: z.string(),
  timestamp: DateTimeStringSchema,
  allGatesPassed: z.boolean().nullable(),
  averageScore: z.number().nullable(),
  rawMarkdown: z.string().nullable(),
  archivedAt: NullableDateTimeSchema,
  archiveReason: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  payloadHash: z.string().nullable(),
  definitionType: z.string().nullable(),
  definitionName: z.string().nullable(),
  definitionVersion: z.string().nullable(),
  definitionHash: z.string().nullable(),
  definitionId: z.string().uuid().nullable(),
  registrySyncedAt: NullableDateTimeSchema,
  mergedFromProjectId: z.string().uuid().nullable().optional(),
  mergedFromRunNumber: z.number().int().nullable().optional(),
  mergedFromIdempotencyKey: z.string().nullable().optional(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
  projectSlug: z.string().optional(),
  orgSlug: z.string().nullable().optional(),
});

/**
 * The additive `analysisWrite` block on analysis-bearing update responses
 * (ops-uluops-api update-run replacement-semantics spec §3.9, live since 1a).
 * `recordMode` is deliberately a plain string, not a literal: the update path
 * asserts equality with the mode it implements (see assertAnalysisWriteEcho in
 * operations/runs.ts), so a future server mode surfaces as a loud named
 * mismatch instead of an anonymous parse failure.
 */
export const AnalysisWriteEchoSchema = z.object({
  recordMode: z.string(),
  supersededRecords: z.number().int().nonnegative(),
  supersededSummaries: z.number().int().nonnegative(),
  createdRecords: z.number().int().nonnegative(),
  createdSummaries: z.number().int().nonnegative(),
});

/**
 * Full update-response envelope. The update paths read the body with
 * sdk-core's `rawEnvelope` option instead of the default `{ data }` unwrap,
 * because `analysisWrite` is a SIBLING of `data` and the unwrap discards
 * siblings (the exact gap that made the §3.9 echo unreachable from SDKs
 * pinned to sdk-core ≤0.15.0).
 */
export const UpdateRunEnvelopeSchema = z.object({
  data: RunWriteEchoResponseSchema,
  analysisWrite: AnalysisWriteEchoSchema.optional(),
});

/** Per-agent plan block of an update preview (spec §4). */
export const AgentWritePlanResponseSchema = z.object({
  wouldSupersedeRecords: z.number().int().nonnegative(),
  wouldSupersedeSummaries: z.number().int().nonnegative(),
  wouldCreateRecords: z.number().int().nonnegative(),
  wouldCreateSummaries: z.number().int().nonnegative(),
  /**
   * Live record_ids for the agent absent from the payload — what a replace
   * write would retire by omission. A non-empty list on a preview is the
   * signal the write would destroy rows the caller did not resend.
   */
  wouldRetireRecordIds: z.array(z.string()),
});

/** Response of POST /runs/:id/update-preview and POST /runs/update-preview. */
export const RunUpdatePreviewResponseSchema = z.object({
  preview: z.literal(true),
  recordMode: z.string(),
  byAgent: z.record(z.string(), AgentWritePlanResponseSchema),
});

/** Run summary schema for list endpoints — enriched with aggregate fields, omits detail-only fields */
export const RunSummaryResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  runNumber: z.number().int().positive(),
  workflowType: z.string(),
  timestamp: DateTimeStringSchema,
  // Nullable: null = NOT_A_GATE (no gate-bearing agents on the run) — see RunReadResponseSchema.
  allGatesPassed: z.boolean().nullable(),
  averageScore: z.number().nullable().optional(),
  rawMarkdown: z.string().nullable().optional(),
  archivedAt: NullableDateTimeSchema.optional(),
  archiveReason: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema.optional(),
  // Aggregate fields computed by getRunsSummary query
  totalRecommendations: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  suggestedCount: z.number().int().nonnegative(),
  backlogCount: z.number().int().nonnegative(),
  agentScores: z.record(z.string(), z.number().nullable()),
  // Merge provenance (v0.3.4, mig 069) — present only if the summary query selects them.
  mergedFromProjectId: z.string().uuid().nullable().optional(),
  mergedFromRunNumber: z.number().int().nullable().optional(),
});

export const AgentSnapshotResponseSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  name: z.string(),
  definitionVersion: z.string().nullable().optional(),
  registryDefinitionId: z.string().uuid().nullable().optional(),
  score: z.number().min(0).max(100).nullable(),
  maxScore: z.number().min(0).max(100).nullable(),
  decision: z.string(),
  summary: z.string().nullable().optional(),
  model: z.string().nullable(),
  // Exact reported model before API normalization; absent on older responses.
  modelRaw: z.string().nullable().optional(),
  // Producing CLI/runtime (v5.2.0). Optional: absent from responses until the API §3.5 columns ship.
  harness: z.string().nullable().optional(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  cacheCreationTokens: z.number().int().nonnegative().nullable(),
  cacheReadTokens: z.number().int().nonnegative().nullable(),
  // Token components (v5.2.0). Optional: NULL/absent for historical rows and until the API §3.5 columns ship.
  cachedInputTokens: z.number().int().nonnegative().nullable().optional(),
  reasoningOutputTokens: z.number().int().nonnegative().nullable().optional(),
  thinkingTokens: z.number().int().nonnegative().nullable().optional(),
  toolTokens: z.number().int().nonnegative().nullable().optional(),
  totalEffectiveTokens: z.number().int().nonnegative().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  // Harness transcript/agent provenance id (v5.5.1). Optional: absent from
  // pre-1.66 API responses; NULL for rows saved before the column existed.
  agentId: z.string().nullable().optional(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const CrossAgentMatchSchema = z.object({
  issueId: z.string(),
  agent: z.string(),
  title: z.string(),
  status: z.string(),
});

export const CrossAgentItemSchema = z.object({
  issueId: z.string(),
  title: z.string(),
  agent: z.string(),
  crossAgentMatches: z.array(CrossAgentMatchSchema),
});

export const CorrelationResultResponseSchema = z.object({
  newIssues: z.number().int().nonnegative(),
  recurringIssues: z.number().int().nonnegative(),
  regressions: z.number().int().nonnegative(),
  observed: z.number().int().nonnegative().optional(),
  crossAgentMatches: z.array(CrossAgentItemSchema).optional(),
});

export const SaveRunResponseSchema = z.object({
  run: RunWriteEchoResponseSchema,
  agents: z.array(AgentSnapshotResponseSchema),
  // Nullable: on an idempotent replay of a pre-correlation-persistence run the
  // API returns `correlation: null` (the original counts were never stored, and
  // are not fabricated). Fresh saves and post-migration replays are non-null.
  correlation: CorrelationResultResponseSchema.nullable(),
  deduplicated: z.boolean(),
  analysisRecords: z.lazy(() => z.array(AnalysisRecordResponseSchema)).optional(),
  analysisSummary: z.lazy(() => AnalysisSummaryResponseSchema).optional(),
});

/**
 * Full save-response envelope (tool-sweep T21). `analysisWrite` is a SIBLING
 * of `data` — the same placement as the update envelope — so both paths read
 * the body with `rawEnvelope` and one pattern. `recordMode` is 'initial' on
 * this path (no supersede semantics on first write).
 */
export const SaveRunEnvelopeSchema = z.object({
  data: SaveRunResponseSchema,
  analysisWrite: AnalysisWriteEchoSchema.optional(),
});

export const DiffIssueRefResponseSchema = z.object({
  issueId: z.string().uuid(),
  title: z.string(),
});

export const AgentChangeResponseSchema = z.object({
  name: z.string(),
  // baseScore is null when the agent only exists in the compare run; compareScore
  // is null when the agent only exists in the base run; change is null whenever
  // either side is null (no meaningful delta). Cross-workflow diffs commonly
  // produce these nulls because agent rosters differ between workflow types.
  baseScore: z.number().nullable(),
  compareScore: z.number().nullable(),
  change: z.number().nullable(),
});

export const RunDiffResultResponseSchema = z.object({
  // T11 (API 2.0.0): diff sides are the READ projection — a diff identifies
  // its runs, it does not carry them.
  baseRun: RunReadResponseSchema,
  compareRun: RunReadResponseSchema,
  fixed: z.array(DiffIssueRefResponseSchema),
  new: z.array(DiffIssueRefResponseSchema),
  unchanged: z.array(DiffIssueRefResponseSchema),
  agentChanges: z.array(AgentChangeResponseSchema),
});

export const RunDetailsResponseSchema = z.object({
  run: RunDetailRunResponseSchema,
  agents: z.array(AgentSnapshotResponseSchema),
  recommendations: z.array(z.object({
    issueId: z.string().uuid(),
    title: z.string(),
    priority: PriorityResponseSchema,
    agent: z.string(),
    /**
     * Correlation status against the issue's history (new/recurring/
     * regression/observed). Frozen at run time — does NOT change when the
     * issue is later closed. For lifecycle, read `issueStatus`.
     */
    status: z.string(),
    /**
     * Lifecycle status of the linked issue (open/completed/deferred/…).
     * Optional: absent when talking to a pre-1.69 API. z.object() strips
     * unknown keys on parse, so this MUST be declared here for the field
     * to survive the SDK boundary (issue 659d061d).
     */
    issueStatus: z.string().optional(),
    /**
     * The occurrence's own description for this sighting. Optional for the same
     * reason as `issueStatus`: absent when talking to an API that predates it,
     * and `z.object()` strips unknown keys on parse, so it MUST be declared
     * here to survive the SDK boundary at all.
     *
     * Cheap on the API side — `findByRun` already selects full occurrence rows,
     * so this was fetched and discarded at the response-building step rather
     * than being missing from the query (tracker `fc862289`).
     */
    description: z.string().max(MAX_DESCRIPTION).nullable().optional(),
  })),
});

export const ValidateRunPreviewSchema = z.object({
  newIssues: z.array(z.object({ title: z.string(), agent: z.string() })),
  recurringIssues: z.array(z.object({ id: z.string(), title: z.string(), timesSeen: z.number() })),
  regressions: z.array(z.object({ id: z.string(), title: z.string(), lastStatus: z.string() })),
  observations: z.array(z.object({ id: z.string(), title: z.string() })).optional(),
  // Analysis-record / analysis-summary echoes (API v1.4.1+).
  analysisRecords: z.array(z.object({
    recordId: z.string(),
    recordType: z.string(),
    title: z.string(),
  })).optional(),
  analysisSummaries: z.array(z.object({
    agentName: z.string().optional(),
    decision: z.string(),
  })).optional(),
});

export const ValidateRunResponseSchema = z.object({
  wouldCreate: z.number().int().nonnegative(),
  wouldUpdate: z.number().int().nonnegative(),
  wouldRegress: z.number().int().nonnegative(),
  wouldObserve: z.number().int().nonnegative().optional(),
  // Counts of analysis records / summaries that saveRun would persist
  // (API v1.4.1+). Optional for backwards compatibility with older API
  // versions that do not return these fields.
  wouldCreateAnalysisRecords: z.number().int().nonnegative().optional(),
  wouldCreateAnalysisSummaries: z.number().int().nonnegative().optional(),
  validationErrors: z.array(z.string()),
  preview: ValidateRunPreviewSchema,
});

export const ArchiveRunsResultResponseSchema = z.object({
  archived: z.number().int().nonnegative(),
});

export const DeleteResultResponseSchema = z.object({
  deleted: z.literal(true),
});

/** Analysis record returned by getAnalysis / queryAnalysisRecords */
export const AnalysisRecordResponseSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  agentName: z.string(),
  agentType: z.string(),
  recordType: z.string(),
  recordId: z.string(),
  title: z.string(),
  classification: z.string().nullable(),
  severity: z.string().nullable(),
  recordData: z.record(z.string(), z.unknown()),
  createdAt: DateTimeStringSchema,
});

/** Exploration section within an exploration map */
const ExplorationSectionResponseSchema = z.object({
  type: z.string(),
  label: z.string(),
  summary: z.string().optional(),
}).passthrough();

/** Exploration map produced by Explorer-class agents */
export const ExplorationMapResponseSchema = z.object({
  metadata: z.object({
    explorerName: z.string(),
    framework: z.string(),
    artifactPath: z.string().optional(),
  }),
  sections: z.array(ExplorationSectionResponseSchema),
});

/** Analysis summary returned by getProjectAnalysis */
export const AnalysisSummaryResponseSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  agentName: z.string(),
  agentType: z.string(),
  decision: z.string(),
  score: z.number().min(0).max(100).nullable(),
  decisionVocabulary: z.string().nullable(),
  systemMetrics: z.record(z.string(), z.unknown()).nullable(),
  categoryScores: z.array(z.object({
    name: z.string(),
    weight: z.number(),
    score: z.number(),
  })).nullable(),
  epistemicAssessment: z.record(z.string(), z.unknown()).nullable(),
  auditImplications: z.array(z.string()).nullable(),
  explorationMaps: z.array(ExplorationMapResponseSchema).nullable(),
  createdAt: DateTimeStringSchema,
});

/** Full analysis response for a single run (API 2.0.0, T22): split totals —
 * `recordsTotal`/`summariesTotal` replaced the records-only `total` that made
 * summaries-only runs read as empty. Strictly pinned since 6.0.0. */
export const RunAnalysisResponseSchema = z.object({
  records: z.array(AnalysisRecordResponseSchema),
  summaries: z.array(AnalysisSummaryResponseSchema),
  recordsTotal: z.number().int().nonnegative(),
  summariesTotal: z.number().int().nonnegative(),
});

/** Paginated analysis summaries response (getProjectAnalysis) */
export const ProjectAnalysisListResponseSchema = z.object({
  data: z.array(AnalysisSummaryResponseSchema),
  total: z.number().int().nonnegative(),
});

/** Paginated analysis records response (queryAnalysisRecords) */
export const AnalysisRecordsListResponseSchema = z.object({
  data: z.array(AnalysisRecordResponseSchema),
  total: z.number().int().nonnegative(),
});

/** Analysis summary with run context (getAgentRunsAnalysis) */
export const AgentRunSummaryResponseSchema = AnalysisSummaryResponseSchema.extend({
  runNumber: z.number().int(),
  runTimestamp: DateTimeStringSchema,
  workflowType: z.string(),
  snapshotScore: z.number().nullable(),
});

/** Agent runs analysis response (API 2.0.0, T22): the family list envelope
 * `{data, total}` — the pre-2.0.0 nested `{data: {items, total}}` wire no
 * longer parses (tolerance window closed in 6.0.0). */
export const AgentRunsAnalysisResponseSchema = z.object({
  data: z.array(AgentRunSummaryResponseSchema),
  total: z.number().int().nonnegative(),
});

// ============================================
// MERGE ISSUES RESPONSE SCHEMA
// ============================================

export const MergeIssuesResultResponseSchema = z.object({
  targetIssue: IssueResponseSchema.optional(),
  targetIssueId: z.string().uuid(),
  mergedCount: z.number().int().nonnegative(),
  migratedOccurrences: z.number().int().nonnegative(),
  sourceIssues: z.array(z.string().uuid()).optional(),
});

// ============================================
// MERGE PROJECTS RESPONSE SCHEMA
// ============================================

/**
 * POST /projects/merge result (merge-projects spec v0.3.4 §5).
 * Field names are snake_case by contract — the spec's §5 shape is the pinned
 * authoritative HTTP surface (error-code stability policy), unlike the
 * camelCase business-object responses elsewhere in this API.
 */
/**
 * Merge result (spec 0.3.5 — camelCase; API 2.0.0, T23). The pre-flip
 * snake_case wire no longer parses: the tolerance window closed in 6.0.0.
 */
export const MergeProjectsResultResponseSchema = z.object({
  source: z.object({
    id: z.string().uuid(),
    name: z.string(),
    runCount: z.number().int().nonnegative(),
    issueCount: z.number().int().nonnegative(),
    statusAfter: z.enum(['soft-deleted', 'retained', 'dry-run']),
  }),
  target: z.object({
    id: z.string().uuid(),
    name: z.string(),
    runCountBefore: z.number().int().nonnegative(),
    issueCountBefore: z.number().int().nonnegative(),
    runCountAfter: z.number().int().nonnegative(),
    issueCountAfter: z.number().int().nonnegative(),
  }),
  moved: z.object({
    runs: z.number().int().nonnegative(),
    issues: z.number().int().nonnegative(),
    issueDedupes: z.number().int().nonnegative(),
    occurrencesReparented: z.number().int().nonnegative(),
    issueNotesReparented: z.number().int().nonnegative(),
    statusHistoryReparented: z.number().int().nonnegative(),
  }),
  conflicts: z.array(z.object({
    kind: MergeConflictKindResponseSchema,
    sourceId: z.string().uuid(),
    targetId: z.string().uuid(),
    resolution: z.string(),
  })),
  audit: z.object({
    // Empty string for the P5 idempotent no-op; unpersisted UUID for dry-run.
    mergeId: z.string(),
    timestamp: DateTimeStringSchema,
    // User UUID, or the literal 'system' for system-actor merges.
    actorId: z.string(),
    dryRun: z.boolean(),
  }),
});

// ============================================
// BULK UPDATE RESPONSE SCHEMAS
// ============================================

export const BulkStatusUpdateResultResponseSchema = z.object({
  updated: z.number().int().nonnegative(),
  failed: z.array(z.string()),
});

// ============================================
// ANALYTICS RESPONSE SCHEMAS
// ============================================

export const AgentPerformanceResponseSchema = z.object({
  name: z.string(),
  totalRuns: z.number().int().nonnegative(),
  // Nullable: an agent whose runs carry no scores (lens/explorer runs, or no
  // gate-bearing snapshots) aggregates to NULL server-side — the API's own
  // type declares `avgScore: number | null` (agent-analytics.ts). Asserting
  // non-null here made list_agents/get_analytics throw on real prod rows
  // (found live 2026-08-24; the nullable-score class one ring out from the
  // run schemas, which were fixed earlier).
  averageScore: z.number().nullable(),
  passRate: z.number().nullable(),
  totalIssuesFound: z.number().int().nonnegative(),
});

export const AgentLifecycleEntryResponseSchema = z.object({
  name: z.string(),
  definitionVersion: z.string(),
  firstSeenAt: z.string(),
  runs: z.number().int().nonnegative(),
  // Same nullable-aggregate class as AgentPerformanceResponseSchema above.
  avgScore: z.number().nullable(),
  passRate: z.number().nullable(),
});

export const AgentReliabilityResponseSchema = z.object({
  name: z.string(),
  totalIssues: z.number().int().nonnegative(),
  falsePositiveRate: z.number(),
  resolutionRate: z.number(),
  avgTimeToResolveDays: z.number().nullable(),
  reliabilityScore: z.number(),
});

export const AgentReliabilityResultResponseSchema = z.object({
  agents: z.array(AgentReliabilityResponseSchema),
});

export const ResolutionRateResponseSchema = z.object({
  project: z.string(),
  totalIssues: z.number().int().nonnegative(),
  resolvedIssues: z.number().int().nonnegative(),
  resolutionRate: z.number(),
  averageTimeToResolve: z.number().nullable(),
});

export const FileHotspotResponseSchema = z.object({
  filePath: z.string(),
  issueCount: z.number().int().nonnegative(),
  projects: z.array(z.string()),
});

export const TaxonomyDistributionResponseSchema = z.object({
  domain: z.string(),
  count: z.number().int().nonnegative(),
  percentage: z.number(),
});

export const OutlierPointResponseSchema = z.object({
  date: z.string(),
  value: z.number(),
  direction: z.enum(['high', 'low']),
});

export const ResidualDiagnosticsResponseSchema = z.object({
  durbinWatson: z.number(),
  autocorrelation: z.enum(['none', 'positive', 'negative', 'inconclusive']),
  varianceRatio: z.number().nullable(),
  heteroscedasticity: z.enum(['constant', 'increasing', 'decreasing', 'inconclusive']),
  skewness: z.number(),
  runsTestZ: z.number(),
  assumptionScore: z.number(),
  warnings: z.array(z.string()),
});

export const DomainTrendResponseSchema = z.object({
  netChange: z.number(),
  trend: z.string(),
  avgDailyChange: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
  sampleSize: z.number().int(),
  rSquared: z.number(),
  standardError: z.number(),
  confidenceInterval: z.tuple([z.number(), z.number()]),
  outliers: z.array(OutlierPointResponseSchema),
  diagnostics: ResidualDiagnosticsResponseSchema.nullable(),
  ciReliable: z.boolean(),
  warnings: z.array(z.string()),
  weeklyPatternDetected: z.boolean(),
});

export const BurndownDataPointResponseSchema = z.object({
  date: z.string(),
  total: z.number().int().nonnegative(),
}).catchall(z.number().int().nonnegative());

export const BurndownResultResponseSchema = z.object({
  timeSeries: z.array(BurndownDataPointResponseSchema),
  trends: z.record(z.string(), DomainTrendResponseSchema),
});

export const VelocityItemResponseSchema = z.object({
  domain: z.string(),
  mode: z.string(),
  failureCode: z.string(),
  currentCount: z.number().int().nonnegative(),
  previousCount: z.number().int().nonnegative(),
  velocityPercent: z.number(),
  alert: z.boolean(),
  sparkline: z.array(z.number()),
  trendReliability: z.enum(['high', 'medium', 'low']),
});

export const VelocitySummaryResponseSchema = z.object({
  improving: z.array(z.string()),
  stable: z.array(z.string()),
  degrading: z.array(z.string()),
  mostImproved: z.string().nullable(),
  mostConcerning: z.string().nullable(),
});

export const VelocityResultResponseSchema = z.object({
  items: z.array(VelocityItemResponseSchema),
  summary: VelocitySummaryResponseSchema,
});

export const DiscoveryDomainBreakdownSchema = z.object({
  new: z.number().int().nonnegative(),
  recurring: z.number().int().nonnegative(),
});

export const DiscoveryTimelinePointResponseSchema = z.object({
  period: z.string(),
  newIssues: z.number().int().nonnegative(),
  recurringIssues: z.number().int().nonnegative(),
  domains: z.record(z.string(), DiscoveryDomainBreakdownSchema),
});

export const DiscoverySummaryResponseSchema = z.object({
  totalNew: z.number().int().nonnegative(),
  totalRecurring: z.number().int().nonnegative(),
  newToRecurringRatio: z.number().nullable(),
  peakNewPeriod: z.object({ period: z.string(), count: z.number() }).nullable(),
});

export const DiscoveryResultResponseSchema = z.object({
  timeline: z.array(DiscoveryTimelinePointResponseSchema),
  summary: DiscoverySummaryResponseSchema,
});

export const AgentMatrixRowResponseSchema = z.object({
  agent: z.string(),
  domains: z.record(z.string(), z.number()),
  total: z.number().int().nonnegative(),
  coverage: z.number().int().nonnegative(),
  coveragePercent: z.number(),
});

export const BlindSpotResponseSchema = z.object({
  agent: z.string(),
  missingDomains: z.array(z.string()),
});

export const SinglePointFailureResponseSchema = z.object({
  domain: z.string(),
  mode: z.string(),
  onlyAgent: z.string(),
});

export const HighOverlapResponseSchema = z.object({
  mode: z.string(),
  agentCount: z.number(),
  agents: z.array(z.string()),
});

export const MatrixAnalysisResponseSchema = z.object({
  blindSpots: z.array(BlindSpotResponseSchema),
  singlePoints: z.array(SinglePointFailureResponseSchema),
  highOverlap: z.array(HighOverlapResponseSchema),
});

/**
 * A failure code in use that the canonical taxonomy does not contain.
 *
 * `issues.failure_domain` / `failure_mode` are free strings server-side — `failure_taxonomy`
 * has no FK or CHECK against them and no write path rejects an off-catalog value — so issues
 * can carry well-formed `DDD-MMM` pairs naming no catalogued mode, either invented
 * (`STR-CON`) or borrowed across domains (`SEM-VAL`, `EPI-OMI`).
 */
export const ShadowModeResponseSchema = z.object({
  mode: z.string(),
  issueCount: z.number().int().nonnegative(),
  agentCount: z.number().int().nonnegative(),
});

export const AgentMatrixResultResponseSchema = z.object({
  /** Absent on older servers; never infer the applied threshold from the request. */
  effectiveMinIssues: z.number().int().min(1).max(1000).optional(),
  eligibility: z.object({
    matrix: z.literal('agent-total-qualifying-issues'),
    singlePoints: z.literal('canonical-modes-before-min-issues'),
    highOverlap: z.literal('canonical-modes-before-min-issues'),
    candidateAgentCount: z.number().int().nonnegative(),
    includedAgentCount: z.number().int().nonnegative(),
    excludedAgentCount: z.number().int().nonnegative(),
    singlePointAgentsExcludedFromMatrix: z.number().int().nonnegative(),
  }).optional(),
  matrix: z.array(AgentMatrixRowResponseSchema),
  analysis: MatrixAnalysisResponseSchema,
  /**
   * Non-canonical codes excluded from `analysis`, in the same window and scope.
   *
   * **`.optional()`, deliberately — not `.default([])`.** This whole field exists because an
   * exclusion that leaves no trace cannot be told apart from an exclusion of nothing.
   * Defaulting to `[]` would recreate exactly that ambiguity at the SDK boundary: a server
   * too old to compute the residue would be indistinguishable from a server reporting a
   * clean one. `undefined` means "this API does not report shadow modes"; `[]` means "it
   * does, and found none".
   *
   * Consumers must therefore handle `undefined` rather than assuming an array. That cost is
   * the point.
   *
   * Added in 5.15.0 against `ops-uluops-api` `7ada3b0`. Before that release the field was
   * absent from the response, which is why it cannot be required here — requiring it would
   * make this SDK throw against every currently-deployed older API.
   */
  shadowModes: z.array(ShadowModeResponseSchema).optional(),
});

export const TrendSummaryResponseSchema = z.object({
  period: z.string(),
  newIssues: z.number().int().nonnegative(),
  resolvedIssues: z.number().int().nonnegative(),
  regressions: z.number().int().nonnegative(),
  averageScore: z.number().nullable(),
});

export const PeriodResponseSchema = z.object({
  start: z.string(),
  end: z.string(),
  days: z.number().int().positive(),
});

export const FullTaxonomyAnalyticsResponseSchema = z.object({
  byDomain: z.array(z.object({
    domain: z.string(),
    label: z.string(),
    count: z.number().int().nonnegative(),
    percentage: z.number(),
  })),
  bySeverity: z.array(z.object({
    severity: z.string(),
    label: z.string(),
    count: z.number().int().nonnegative(),
    percentage: z.number(),
  })),
  byMode: z.array(z.object({
    mode: z.string(),
    label: z.string(),
    domain: z.string(),
    domainLabel: z.string(),
    count: z.number().int().nonnegative(),
    percentage: z.number(),
  })),
  topCodes: z.array(z.object({
    code: z.string(),
    domain: z.string(),
    mode: z.string(),
    severity: z.string(),
    label: z.string(),
    count: z.number().int().nonnegative(),
    percentage: z.number(),
  })),
  heatmapData: z.array(z.object({
    domain: z.string(),
    domainLabel: z.string(),
    mode: z.string(),
    modeLabel: z.string(),
    count: z.number().int().nonnegative(),
    percentage: z.number(),
    intensity: z.number(),
  })),
  totals: z.object({
    totalIssues: z.number().int().nonnegative(),
    classifiedIssues: z.number().int().nonnegative(),
    unclassifiedIssues: z.number().int().nonnegative(),
    classificationRate: z.number(),
  }),
  period: PeriodResponseSchema,
});

// ============================================
// ERROR RESPONSE SCHEMAS
// ============================================

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

// ============================================
// WRAPPED RESPONSE SCHEMAS
// ============================================

/**
 * Generic API response wrapper
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    message: z.string().optional(),
  });
}

/**
 * Generic list response wrapper
 */
export function createListResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    count: z.number().int().nonnegative().optional(),
  });
}

// Pre-built wrapped schemas for common responses
export const ProjectListResponseSchema = createListResponseSchema(ProjectResponseSchema);
export const IssueListResponseSchema = createListResponseSchema(IssueResponseSchema);
export const TrendListResponseSchema = createListResponseSchema(DailyIssueCountsResponseSchema);
export const BulkStatusUpdateListResponseSchema = createListResponseSchema(BulkStatusUpdateResultResponseSchema);
export const StatusHistoryListResponseSchema = createListResponseSchema(StatusHistoryResponseSchema);

export const ProjectApiResponseSchema = createApiResponseSchema(ProjectResponseSchema);
export const IssueApiResponseSchema = createApiResponseSchema(IssueResponseSchema);
export const IssueDetailsApiResponseSchema = createApiResponseSchema(IssueDetailsResponseSchema);
export const IssueNoteApiResponseSchema = createApiResponseSchema(IssueNoteResponseSchema);
export const ProjectSummaryApiResponseSchema = createApiResponseSchema(ProjectSummaryResponseSchema);
export const MergeIssuesApiResponseSchema = createApiResponseSchema(MergeIssuesResultResponseSchema);
export const StatusUpdateApiResponseSchema = createApiResponseSchema(StatusUpdateResultResponseSchema);

// ============================================
// TAXONOMY RESPONSE SCHEMA
// ============================================

const TaxonomyModeSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
});

const TaxonomyDomainSchema = z.object({
  code: FailureDomainResponseSchema,
  name: z.string(),
  description: z.string(),
  modes: z.array(TaxonomyModeSchema),
});

const TaxonomySeveritySchema = z.object({
  code: z.string(),
  name: z.string(),
  weight: z.number(),
});

const FailureCodePatternSchema = z.object({
  pattern: z.string(),
  format: z.string(),
  example: z.string(),
});

export const TaxonomyResponseSchema = z.object({
  domains: z.array(TaxonomyDomainSchema),
  severities: z.array(TaxonomySeveritySchema),
  priorities: z.array(z.string()),
  statuses: z.array(z.string()),
  failureCodePattern: FailureCodePatternSchema,
});

// Type exports
export type TaxonomyResponse = z.infer<typeof TaxonomyResponseSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type IssueResponse = z.infer<typeof IssueResponseSchema>;
export type RunResponse = z.infer<typeof RunReadResponseSchema>;
export type RunWriteEchoResponse = z.infer<typeof RunWriteEchoResponseSchema>;
export type AgentSnapshotResponse = z.infer<typeof AgentSnapshotResponseSchema>;
export type OccurrenceResponse = z.infer<typeof OccurrenceResponseSchema>;
export type IssueNoteResponse = z.infer<typeof IssueNoteResponseSchema>;
export type StatusHistoryResponse = z.infer<typeof StatusHistoryResponseSchema>;
export type AuthUserResponse = z.infer<typeof AuthUserResponseSchema>;
export type PublicUserResponse = z.infer<typeof PublicUserResponseSchema>;
export type LoginResponseData = z.infer<typeof LoginResponseSchema>;
export type RegisterResponseData = z.infer<typeof RegisterResponseSchema>;
export type PublicApiKeyResponse = z.infer<typeof PublicApiKeyResponseSchema>;
export type PublicSessionResponse = z.infer<typeof PublicSessionResponseSchema>;
