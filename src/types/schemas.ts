import { z } from 'zod';
import {
  PRIORITIES,
  STATUSES,
  SEVERITIES,
  ISSUE_TYPES,
  NOTE_TYPES,
  AVATAR_MIME_TYPES,
  FAILURE_CODE_PATTERN,
} from './enums.js';

// ============================================
// SHARED SCHEMAS
// ============================================

export const UuidSchema = z.string().uuid();

/**
 * Max length of the agent-local analysis `recordId`.
 *
 * `recordId` is an agent-local identifier (e.g. `foundations-api-aristotle-20260626`),
 * not a key or correlation spine. Widened 20→100 to match the namespaced, dated IDs
 * agents naturally produce; mirrors the API column (migration 058) and the API/MCP
 * request schemas. Client-side cap only — response schemas do not constrain it.
 */
export const ANALYSIS_RECORD_ID_MAX_LENGTH = 100;

/**
 * Max length of a status-change `reason` — matches status_history.reason
 * varchar(1000) (API migration 062) and the API request schemas. Widened
 * 500→1000: dispositions citing root cause + evidence + trust model did not
 * fit 500. Deliberately bounded (a reason is a summary, not a document).
 * Consumed by MCP tool schemas to prevent drift. Does NOT govern the
 * run-archive `archiveReason` field, which stays at 500 on a different column.
 */
export const STATUS_REASON_MAX_LENGTH = 1000;

export const PrioritySchema = z.enum(PRIORITIES);
export const StatusSchema = z.enum(STATUSES);
export const SeveritySchema = z.enum(SEVERITIES);
export const FailureDomainSchema = z.string().regex(/^[A-Z]{3}$/, {
  message: 'Failure domain must be a 3-letter uppercase code (e.g., STR, SEM, PRA, EPI)',
});
export const IssueTypeSchema = z.enum(ISSUE_TYPES);
export const NoteTypeSchema = z.enum(NOTE_TYPES);
export const AvatarMimeTypeSchema = z.enum(AVATAR_MIME_TYPES);

export const FailureCodeSchema = z.string().regex(FAILURE_CODE_PATTERN, {
  message: 'Invalid failure code format. Expected: DOMAIN-MODE/SEVERITY (e.g., STR-OMI/H)',
});

// ============================================
// AUTH SCHEMAS
// ============================================

const PasswordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

export const RegisterInputSchema = z.object({
  email: z.string().email().max(255),
  password: PasswordSchema,
});

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().max(128),
});

export const SetPasswordInputSchema = z.object({
  password: PasswordSchema,
});

export const UpdateProfileInputSchema = z
  .object({
    // Canonical username / personal-org slug: 1-40 chars, lowercase
    // alphanumeric with internal hyphens or underscores, start/end
    // alphanumeric (GitHub/npm slug conventions). Hyphens are required for URL
    // slugs (orgs/ulu-labs/...); the prior letter-start underscore-only rule
    // rejected valid slugs client-side before they reached the API.
    username: z
      .string()
      .regex(/^[a-z0-9](?:[a-z0-9_-]{0,38}[a-z0-9])?$/)
      .nullish(),
    name: z.string().max(100).nullish(),
    bio: z.string().max(500).nullish(),
    timezone: z.string().nullish(),
    websiteUrl: z.string().url().max(500).nullish(),
    avatar: z.string().max(2_000_000).nullish(), // base64
    avatarMimeType: AvatarMimeTypeSchema.nullish(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string(),
  newPassword: PasswordSchema,
});

export const ResetPasswordInputSchema = z.object({
  token: z.string(),
  password: PasswordSchema,
});

export const CreateApiKeyInputSchema = z.object({
  name: z.string().max(100).optional(),
  expiresAt: z.string().datetime().optional(),
  // Per-key scope (@uluops/platform v1.27.0). Closed enum on the MINT
  // direction — a bad scope is rejected client-side before the request
  // leaves. (The op sends the raw input, not this schema's output, so this
  // gates without stripping — validateCreateApiKeyInput discards its return.)
  scope: z.enum(['read', 'write']).optional(),
});

// ============================================
// PROJECT SCHEMAS
// ============================================

export const CreateProjectInputSchema = z.object({
  name: z.string().min(1).max(200),
});

export const UpdateProjectInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export const DeleteProjectInputSchema = z.object({
  confirm: z.literal(true),
  confirmationPhrase: z.string(),
});

export const RenameProjectInputSchema = z.object({
  oldName: z.string().min(1),
  newName: z.string().min(1).max(200),
});

export const MergeProjectsInputSchema = z.object({
  source: z.string().min(1).max(200),
  target: z.string().min(1).max(200),
  dryRun: z.boolean().optional(),
  deleteSource: z.boolean().optional(),
  confirmCrossOrg: z.boolean().optional(),
}).refine((v) => v.source !== v.target, {
  message: 'source and target must be different projects',
  path: ['target'],
});

/**
 * Re-home input (project-org-routing-and-rehome spec §4.1). The slug pattern
 * is the server's (`ORG_SLUG_PATTERN`); `reason` is trimmed and bounded like
 * the server does so a 400 is caught before the round-trip. The admin variant
 * makes `reason` mandatory — the target org's only standing on that path.
 */
export const RehomeProjectInputSchema = z.object({
  targetOrg: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/, 'targetOrg must be an org slug (1–100 chars: alphanumeric, hyphen, underscore)'),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const AdminRehomeProjectInputSchema = RehomeProjectInputSchema.extend({
  // A hand-authored message, not `.required()`'s "expected nonoptional": on the
  // admin path the reason is the target org's only standing, and the error
  // should say that rather than leak Zod's vocabulary.
  reason: z.string({ error: 'reason is required on the admin path — it is the target org\'s only standing for the move' }).trim().min(1, 'reason is required on the admin path').max(500),
});

/** TOTP completion of an MFA-challenged login (`POST /auth/totp/login`). */
export const TotpLoginInputSchema = z.object({
  mfaChallengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'code must be exactly 6 digits'),
  rememberMe: z.boolean().optional(),
});

// ============================================
// RUN SCHEMAS
// ============================================

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheCreationTokens: z.number().int().nonnegative().optional(),
  cacheReadTokens: z.number().int().nonnegative().optional(),
  cachedInputTokens: z.number().int().nonnegative().optional(),
  reasoningOutputTokens: z.number().int().nonnegative().optional(),
  thinkingTokens: z.number().int().nonnegative().optional(),
  toolTokens: z.number().int().nonnegative().optional(),
  totalEffectiveTokens: z.number().int().nonnegative().optional(),
});

export const AgentInputSchema = z.object({
  name: z.string().min(1).max(100),
  score: z.number().min(0).max(100).optional().nullable(),
  maxScore: z.number().min(0).max(100).optional().nullable(),
  decision: z.string().min(1).max(50),
  summary: z.string().max(2000).optional(),
  model: z.string().max(50).optional(),
  // Free string at the wire (matches `model`); canonical set claude-code|codex|opencode|gemini-cli|uluops-core. v5.2.0.
  harness: z.string().max(32).optional(),
  tokens: TokenUsageSchema.optional(),
  durationMs: z.number().int().nonnegative().optional(),
  definitionVersion: z.string().max(50).optional(),
  // Harness transcript/agent provenance id (v5.5.0), e.g. agent-metrics "a4f35bf2cacc5f3ac".
  agentId: z.string().max(50).optional(),
});

export const RecommendationInputSchema = z.object({
  agent: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  priority: PrioritySchema,
  type: IssueTypeSchema.optional(),
  severity: SeveritySchema.optional(),
  failureCode: FailureCodeSchema.optional(),
  failureDomain: FailureDomainSchema.optional(),
  failureMode: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  filePath: z.string().max(1000).optional(),
  lineNumber: z.number().int().nonnegative().nullish(),
  description: z.string().max(10000).optional(),
  classificationConfidence: z.enum(['high', 'medium', 'low']).optional(),
  classifiedBy: z.enum(['agent', 'classifier', 'human']).optional(),
  secondaryFailureCodes: z.array(z.string().max(20)).max(20).optional(),
  taxonomyVersion: z.string().max(50).optional(),
  /**
   * Orchestrator-declared convergence cluster (tracker migration 076).
   * **Within-run only.**
   *
   * Recommendations sharing a `clusterKey` in one run are the same adjudicated
   * defect reported by different agents. Set it from a merge or falsification
   * stage instead of collapsing the findings before submission.
   *
   * **This field existing here is load-bearing, not cosmetic.** This schema is a
   * plain `z.object()`, so Zod *strips* unknown keys rather than erroring. While
   * `clusterKey` was undeclared, an orchestrator that set it had the key deleted
   * in transit and the tracker recorded NULL — which it documents as "a stage was
   * declared and silently stopped working". A transport-layer strip would have
   * produced the tracker's collapsing-pipeline signature and pointed the blame at
   * the merge stage. Do not remove this as unused before the producer ships.
   *
   * @see test/types/cluster-key-survives.test.ts — asserts the parse OUTPUT, since
   *      a type-level check passes whether or not Zod keeps the value at runtime.
   */
  clusterKey: z.string().min(1).max(64).optional(),
});

/** Single analysis summary entry — shared base for single-object and per-agent array variants */
export const AnalysisSummaryEntrySchema = z.object({
  agentName: z.string().max(100).optional(),
  decision: z.string().min(1).max(50),
  score: z.number().min(0).max(100).optional().nullable(),
  decisionVocabulary: z.string().max(100).nullish(),
  // Agent's COGNITIVE measurements — counts, levels, categorical indicators
  // (values: number | boolean | string ≤100 chars). Execution telemetry
  // (tokens/model/duration) belongs in agents[], not here. The ops-api ingest
  // normalizes value shapes (objects/arrays stripped, `_` keys reserved);
  // the SERVER is authoritative — do NOT encode the floor here client-side
  // (system-metrics-contract spec v0.1.2 D3: one normalizer, no drift).
  systemMetrics: z.record(z.string(), z.unknown()).nullish(),
  categoryScores: z.array(z.object({
    name: z.string().max(100),
    weight: z.number().min(1),
    score: z.number().min(0),
  })).max(50).nullish(),
  epistemicAssessment: z.record(z.string(), z.unknown()).nullish(),
  auditImplications: z.array(z.string().max(500)).max(50).nullish(),
  explorationMaps: z.array(z.object({
    metadata: z.object({
      explorerName: z.string().max(100),
      framework: z.string().max(100),
      artifactPath: z.string().max(500).optional(),
    }),
    sections: z.array(z.object({
      type: z.string().max(50),
      label: z.string().max(200),
      summary: z.string().max(2000).optional(),
    }).passthrough()).max(100),
  })).max(50).nullish(),
});

export const SaveRunInputSchema = z.object({
  project: z.string().min(1).max(200),
  workflowType: z.string().min(1).max(100),
  agents: z.array(AgentInputSchema).min(1).max(100),
  recommendations: z.array(RecommendationInputSchema).max(500),
  timestamp: z.string().datetime().optional(),
  rawMarkdown: z.string().max(500_000).optional(),
  summary: z
    .object({
      allGatesPassed: z.boolean().optional(),
      averageScore: z.number().min(0).max(100).optional(),
    })
    .optional(),
  idempotencyKey: z.string().max(100).optional(),
  definitionType: z.string().max(20).optional(),
  definitionName: z.string().max(100).optional(),
  definitionVersion: z.string().max(50).optional(),
  definitionHash: z.string().max(64).optional(),
  definitionId: z.string().uuid().optional(),
  definitionMinSubscription: z.enum(['free', 'hobbyist', 'plus', 'pro', 'enterprise']).optional(),
  analysisRecords: z.array(z.object({
    /**
     * Agent that produced this record — overrides the run-level default.
     *
     * **The same load-bearing-declaration case as `clusterKey` above, and it had
     * already happened.** This is a plain `z.object()`, so an undeclared key is
     * *stripped, not rejected*. `AnalysisRecordInput` in `./runs.ts` has declared
     * `agentName` the whole time, so a caller setting it saw no type error, no
     * validation error, and a successful request.
     *
     * It reached the wire regardless — but only by accident: `save()` discards
     * `validateSaveRunInput`'s return value and transmits the raw `input`
     * (`operations/runs.ts`). The declared contract and the transmitted contract
     * were different objects, and the moment anyone sends the *parsed* value —
     * the natural refactor when adding client-side normalization — every record
     * loses its agent.
     *
     * Where `clusterKey` degraded to NULL, this degrades to something worse than
     * absent: the tracker falls back to `definitionName ?? agents[0].name ??
     * 'unknown'` and then infers `agentType` from that string, so the row reads
     * as confidently attributed to the wrong agent. NULL announces itself; a
     * plausible wrong name does not. Observed on tracker run #4 (2026-08-09) via
     * the MCP path, which omitted the field for the same reason: 32 records from
     * two analysts stored under a definition name, all typed `validator`.
     *
     * @see test/types/agent-name-survives.test.ts — asserts the parse OUTPUT, for
     *      the same reason the clusterKey test does.
     */
    agentName: z.string().min(1).max(100).optional(),
    recordType: z.string().min(1).max(50),
    recordId: z.string().min(1).max(ANALYSIS_RECORD_ID_MAX_LENGTH),
    title: z.string().min(1).max(500),
    classification: z.string().max(50).nullish(),
    severity: SeveritySchema.nullish(),
    data: z.record(z.string(), z.unknown()),
  })).max(100).optional(),
  analysisSummary: z.union([
    AnalysisSummaryEntrySchema,
    z.array(AnalysisSummaryEntrySchema).max(20),
  ]).optional(),
});

export const UpdateRunInputSchema = SaveRunInputSchema.pick({
  analysisRecords: true,
  analysisSummary: true,
}).extend({
  workflowType: z.string().min(1).optional(),
  allGatesPassed: z.boolean().optional(),
  averageScore: z.number().min(0).max(100).nullish(),
  rawMarkdown: z.string().nullish(),
  archivedAt: z.string().datetime().nullish(),
  archiveReason: z.string().max(500).nullish(),
  // Records-only write mode (API 1b, spec §3.2). Unknown values fail here
  // with a named issue instead of reaching the server.
  recordWriteMode: z.enum(['replace', 'merge']).optional(),
});

/**
 * Update-preview input: analysis concerns ONLY (spec §4 scope rule). The API
 * rejects non-analysis update fields with a named 400, but the SDK builds the
 * request body from the analysis fields alone, so that 400 is unreachable
 * through the SDK — a spread-in update input would otherwise be silently
 * narrowed. `validateUpdateRunPreviewInput` therefore re-implements the
 * API's rejection client-side against UPDATE_PREVIEW_FORBIDDEN_INPUT_KEYS;
 * this schema alone (a non-strict pick) does NOT enforce the scope rule.
 */
export const UpdateRunPreviewInputSchema = SaveRunInputSchema.pick({
  analysisRecords: true,
  analysisSummary: true,
}).extend({
  // The preview MUST carry the mode (spec §4): previewing replace while the
  // write merges is the strip-and-execute divergence the endpoint exists to
  // prevent.
  recordWriteMode: z.enum(['replace', 'merge']).optional(),
});

/**
 * Mirror of the API's UPDATE_PREVIEW_FORBIDDEN_KEYS
 * (ops-uluops-api run-transformers.ts), plus `archiveReason` — the SDK-side
 * input spelling of the API's `archivedReason` wire key.
 */
export const UPDATE_PREVIEW_FORBIDDEN_INPUT_KEYS = [
  'agents',
  'recommendations',
  'allGatesPassed',
  'averageScore',
  'rawMarkdown',
  'archivedAt',
  'archivedReason',
  'archiveReason',
  'workflowType',
] as const;

export const ArchiveRunsInputSchema = z.object({
  project: z.string().min(1),
  beforeRunNumber: z.number().int().positive().optional(),
  beforeDate: z.string().datetime().optional(),
  keepLast: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
});

// ============================================
// ISSUE SCHEMAS
// ============================================

export const CreateUserIssueInputSchema = z.object({
  project: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  priority: PrioritySchema,
  severity: SeveritySchema.optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(10000).optional(),
  filePath: z.string().max(1000).optional(),
  lineNumber: z.number().int().nonnegative().nullish(),
  failureCode: FailureCodeSchema.optional(),
  failureDomain: FailureDomainSchema.optional(),
  failureMode: z.string().max(50).optional(),
  agent: z.string().min(1).max(100).optional(),
  type: IssueTypeSchema.optional(),
});

export const UpdateIssueInputSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  /**
   * @deprecated Rejected by the server on `PATCH /issues/:id` (tracker `ff0f3d8a`);
   * use `updateStatus`. Kept in the schema so this SDK still validates the same
   * shape against an OLDER tracker that accepts it — see the note on
   * `UpdateIssueInput.status`.
   */
  status: StatusSchema.optional(),
  priority: PrioritySchema.optional(),
  severity: SeveritySchema.nullish(),
  failureCode: FailureCodeSchema.nullish(),
  failureDomain: FailureDomainSchema.nullish(),
  failureMode: z.string().max(50).nullish(),
  category: z.string().max(100).nullish(),
  type: IssueTypeSchema.nullish(),
  filePath: z.string().max(1000).nullish(),
  lineNumber: z.number().int().nonnegative().nullish(),
});

export const UpdateIssueStatusInputSchema = z.object({
  status: StatusSchema,
  reason: z.string().max(STATUS_REASON_MAX_LENGTH).optional(),
});

export const CreateIssueNoteInputSchema = z.object({
  content: z.string().min(1).max(10000),
  noteType: NoteTypeSchema.optional(),
  createdBy: z.string().max(200).optional(),
});

export const BulkStatusUpdateItemSchema = z.object({
  issueId: UuidSchema.optional(),
  id: UuidSchema.optional(),
  status: StatusSchema,
  reason: z.string().max(STATUS_REASON_MAX_LENGTH).optional(),
}).refine(
  (item) => item.issueId || item.id,
  { message: 'Either issueId or id must be provided', path: ['issueId'] }
);

export const BulkStatusUpdateInputSchema = z.object({
  updates: z.array(BulkStatusUpdateItemSchema).min(1).max(100),
});

// ============================================
// QUERY SCHEMAS
// ============================================

export const ListIssuesQuerySchema = z.object({
  status: StatusSchema.optional(),
  priority: PrioritySchema.optional(),
  severity: SeveritySchema.optional(),
  failureDomain: FailureDomainSchema.optional(),
  agent: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  includeResolved: z.coerce.boolean().optional(),
  minTimesSeen: z.coerce.number().int().positive().optional(),
  dateStart: z.string().datetime().optional(),
  dateEnd: z.string().datetime().optional(),
});

export const IssueSearchQuerySchema = z.object({
  query: z.string().optional(),
  projects: z.array(z.string()).optional(),
  agents: z.array(z.string()).optional(),
  status: z.union([StatusSchema, z.literal('all')]).optional(),
  priority: z.union([PrioritySchema, z.literal('all')]).optional(),
  severities: z.array(SeveritySchema).optional(),
  failureDomains: z.array(FailureDomainSchema).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const AnalyticsQuerySchema = z.object({
  project: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const BurndownQuerySchema = AnalyticsQuerySchema.extend({
  granularity: z.enum(['daily', 'weekly']).optional(),
});

export const VelocityQuerySchema = AnalyticsQuerySchema.extend({
  alertThreshold: z.coerce.number().int().min(10).max(500).optional(),
});

export const DiscoveryQuerySchema = AnalyticsQuerySchema.extend({
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

export const AgentMatrixQuerySchema = AnalyticsQuerySchema.extend({
  minIssues: z.coerce.number().int().min(1).max(1000).optional(),
});


// NOTE: Inferred input types are exported from their respective domain files
// (e.g., RegisterInput from auth.ts, SaveRunInput from runs.ts).
// Do NOT re-export types here with the same name as the schema consts —
// it creates consumer confusion between value and type imports.
