import { z } from 'zod';
import type {
  ClassificationConfidence,
  ClassifiedBy,
  SubscriptionTier,
} from './enums.js';
import type { IssueFieldsBase } from './issues.js';
import {
  RunReadResponseSchema,
  RunWriteEchoResponseSchema,
  AgentSnapshotResponseSchema,
  CorrelationResultResponseSchema,
  SaveRunResponseSchema,
  ValidateRunResponseSchema,
  ValidateRunPreviewSchema,
  DiffIssueRefResponseSchema,
  AgentChangeResponseSchema,
  RunDiffResultResponseSchema,
  ArchiveRunsResultResponseSchema,
  RunDetailsResponseSchema,
  RunSummaryResponseSchema,
  AnalysisRecordResponseSchema,
  AnalysisSummaryResponseSchema,
  RunAnalysisResponseSchema,
  AgentRunSummaryResponseSchema,
  ProjectAnalysisListResponseSchema,
  AnalysisRecordsListResponseSchema,
  AgentRunsAnalysisResponseSchema,
} from './response-schemas.js';

// ─────────────────────────────────────────────────────────────────
// Response types (derived from Zod schemas — single source of truth)
// ─────────────────────────────────────────────────────────────────

/** Run entity — an execution record from any agent, workflow, or pipeline */
/** Run as returned by the READ surfaces (get/getLatest, diff refs) — the
 * 14-key projection (API 2.0.0, T10). Write echoes carry the full row: see
 * RunWriteEcho. In 5.x this type was the full row; consumers reading dropped
 * fields must switch to getDetails (rawMarkdown, definition trio) or stop
 * (internals). */
export type Run = z.infer<typeof RunReadResponseSchema>;
/** Full run row echoed by save_run/update_run (unchanged by T10). */
export type RunWriteEcho = z.infer<typeof RunWriteEchoResponseSchema>;

/** Enriched run for list endpoints (aggregate fields, no detail-only fields) */
export type RunSummary = z.infer<typeof RunSummaryResponseSchema>;

/** Agent snapshot (results from a single agent in a run) */
export type AgentSnapshot = z.infer<typeof AgentSnapshotResponseSchema>;

/** Correlation result (new/recurring/regression detection) */
export type CorrelationResult = z.infer<typeof CorrelationResultResponseSchema>;

/** Save run response */
export type SaveRunResponse = z.infer<typeof SaveRunResponseSchema>;

/**
 * save() return: the response fields plus the analysisWrite confirmation
 * (tool-sweep T21). `analysisWrite` is null when the payload carried no
 * analysis data or the save deduplicated (a replay writes nothing).
 */
export type SaveRunResponseWithEcho = SaveRunResponse & { analysisWrite: AnalysisWriteEcho | null };

/** Validate run response (preview without saving) */
export type ValidateRunResponse = z.infer<typeof ValidateRunResponseSchema>;

/** Validate run preview detail */
export type ValidateRunPreview = z.infer<typeof ValidateRunPreviewSchema>;

/** Issue reference in a run diff */
export type DiffIssueRef = z.infer<typeof DiffIssueRefResponseSchema>;

/** Agent score change between two runs */
export type AgentChange = z.infer<typeof AgentChangeResponseSchema>;

/** Run diff result */
export type RunDiffResult = z.infer<typeof RunDiffResultResponseSchema>;

/** Archive runs result */
export type ArchiveRunsResult = z.infer<typeof ArchiveRunsResultResponseSchema>;

/** Run details (with recommendations and agent snapshots) */
export type RunDetails = z.infer<typeof RunDetailsResponseSchema>;

/** Analysis record returned from API */
export type AnalysisRecord = z.infer<typeof AnalysisRecordResponseSchema>;

/** Analysis summary returned from API */
export type AnalysisSummary = z.infer<typeof AnalysisSummaryResponseSchema>;

/** Analysis data for a run */
export type RunAnalysis = z.infer<typeof RunAnalysisResponseSchema>;

/** Analysis summary with run context */
export type AgentRunSummary = z.infer<typeof AgentRunSummaryResponseSchema>;

/** Paginated project analysis list */
export type ProjectAnalysisList = z.infer<typeof ProjectAnalysisListResponseSchema>;

/** Paginated analysis records list */
export type AnalysisRecordsList = z.infer<typeof AnalysisRecordsListResponseSchema>;

/** Agent runs analysis response */
export type AgentRunsAnalysis = z.infer<typeof AgentRunsAnalysisResponseSchema>;

// ─────────────────────────────────────────────────────────────────
// Input types (hand-written — not API responses)
//
// These interfaces are the TypeScript source of truth for input shapes.
// Corresponding Zod schemas in schemas.ts validate at runtime. The two
// must be kept in sync manually — a trade-off for ergonomic interfaces
// over Zod-inferred types. Tests verify alignment via contract helpers.
// ─────────────────────────────────────────────────────────────────

/**
 * Token usage metrics
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  /** Input tokens served from cache (v5.2.0). OpenAI/Google report gross input; subtracted in canonical total_effective. 0 for Anthropic/OpenCode. */
  cachedInputTokens?: number;
  /** Reasoning tokens (OpenAI o-series) (v5.2.0). Subset of gross outputTokens — stored, never added to total_effective. */
  reasoningOutputTokens?: number;
  /** Thinking tokens (Google / Anthropic extended thinking) (v5.2.0). Subset of gross outputTokens — stored, never added to total_effective. */
  thinkingTokens?: number;
  /** Tool-call tokens reported as a component of output (v5.2.0). Subset of gross outputTokens — stored, never added to total_effective. */
  toolTokens?: number;
  totalEffectiveTokens?: number;
}

/**
 * Agent execution snapshot — the results of a single agent within a run.
 *
 * "Agent" appears in five projections across the SDK, each viewing the
 * same underlying entity from a different angle:
 * - **AgentInput** (here): a scored executor that ran and produced findings
 * - **AgentPerformance**: a statistical entity with pass rates across runs
 * - **AgentLifecycleEntry**: a versioned entity with trajectory over time
 * - **AgentMatrixRow**: a coverage vector across failure domains
 * - **AgentReliability**: a quality entity with false-positive and resolution rates
 *
 * All projections share `name` as the identity key, except `AgentMatrixRow`
 * which uses `agent` (mirroring the API's matrix endpoint field name).
 */
export interface AgentInput {
  name: string;
  definitionVersion?: string;
  score?: number | null;
  maxScore?: number | null;
  decision: string;
  summary?: string;
  model?: string;
  /** Producing CLI/runtime (v5.2.0). Free string at the wire (matches `model`); canonical set: claude-code|codex|opencode|gemini-cli|uluops-core. */
  harness?: string;
  tokens?: TokenUsage;
  durationMs?: number;
  /** Harness transcript/agent provenance id (v5.5.0). Joins this row to its agent-metrics buffer entry and transcript. */
  agentId?: string;
}

/**
 * Agent update input for update_run.
 * Uses flat token fields (not nested TokenUsage) because the update API
 * accepts individual token field patches rather than a complete snapshot.
 */
export interface UpdateAgentInput {
  name: string;
  score?: number;
  decision?: string;
  model?: string;
  /** Producing CLI/runtime (v5.2.0). See {@link AgentInput.harness}. */
  harness?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  cachedInputTokens?: number;
  reasoningOutputTokens?: number;
  thinkingTokens?: number;
  toolTokens?: number;
  totalEffectiveTokens?: number;
  durationMs?: number;
  /** Harness transcript/agent provenance id (v5.5.0). See {@link AgentInput.agentId}. */
  agentId?: string;
}

/**
 * Recommendation input for save_run.
 * A recommendation is an issue-in-transit — it shares the same core fields
 * as {@link IssueFieldsBase} and adds classification metadata specific to
 * agent-generated findings. The server correlates recommendations against
 * the issue store, producing Issue entities.
 */
export interface RecommendationInput extends IssueFieldsBase {
  agent: string;
  classificationConfidence?: ClassificationConfidence;
  classifiedBy?: ClassifiedBy;
  secondaryFailureCodes?: string[];
  taxonomyVersion?: string;
  /**
   * Orchestrator-declared convergence cluster, within-run only (tracker
   * migration 076). Recommendations sharing this in one run are the same
   * adjudicated defect seen by different agents. Omit when the pipeline has no
   * adjudicating stage. @see RecommendationInputSchema for why it must not be
   * removed as unused.
   */
  clusterKey?: string;
}

/**
 * Summary input for save_run
 */
export interface RunSummaryInput {
  allGatesPassed?: boolean;
  averageScore?: number;
}

/**
 * Save run input (main run submission)
 */
export interface SaveRunInput {
  project: string;
  workflowType: string;
  agents: AgentInput[];
  recommendations: RecommendationInput[];
  timestamp?: string;
  rawMarkdown?: string;
  summary?: RunSummaryInput;
  idempotencyKey?: string;
  definitionType?: string;
  definitionName?: string;
  definitionVersion?: string;
  definitionHash?: string;
  /** Minimum subscription tier required for this definition (for tier validation on submission) */
  definitionMinSubscription?: SubscriptionTier;
  /** Registry definition UUID — enables direct identity linkage */
  definitionId?: string;
  /** Structured analysis records (v1.4.0 — optional) */
  analysisRecords?: AnalysisRecordInput[];
  /** Analysis summaries — single or per-agent array (v1.8.0). */
  analysisSummary?: AnalysisSummaryInput | AnalysisSummaryInput[];
}

/**
 * Run diff query
 */
export interface RunDiffQuery {
  project: string;
  baseRun: number;
  compareRun: number;
}

/**
 * Archive runs input
 */
export interface ArchiveRunsInput {
  project: string;
  beforeRunNumber?: number;
  beforeDate?: string;
  keepLast?: number;
  reason?: string;
}

/**
 * Update run input
 */
export interface UpdateRunInput {
  /**
   * @deprecated Never updatable: the API deliberately omits `workflowType`
   * from both update schemas (ADR-005 — structural identity is immutable).
   * Earlier SDK versions sent it and the server silently stripped it; as of
   * 5.18.0 it is not sent at all. Set it at save time.
   */
  workflowType?: string;
  allGatesPassed?: boolean;
  averageScore?: number | null;
  rawMarkdown?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  recommendations?: RecommendationInput[];
  agents?: UpdateAgentInput[];
  /**
   * Structured analysis records (v1.4.0) — per-agent scoped write (API 1a/1b).
   * Under the default `replace` (spec §3.4): for each agent named in this
   * array, that agent's existing records are superseded and these rows
   * written; agents not named are untouched; omitting a record an agent
   * previously had retires it. Under `merge` (see {@link recordWriteMode}):
   * upsert on (agent_name, record_id) — nothing is retired.
   */
  analysisRecords?: AnalysisRecordInput[];
  /**
   * Records-only write mode (API 1b, spec §3.2; default 'replace').
   * `merge` upserts on (agent_name, record_id): matched live rows are
   * superseded (all matches — prior duplicates collapse to one, visible in
   * the echo's supersededRecords), unmatched keys are pure appends, and
   * nothing is ever retired. Summaries have no mode — always per-agent
   * replace. Sending the mode without analysisRecords is a named 400.
   * Requires an API with 1b (2026-08-21+); older servers strip the field —
   * the echo assertion converts that skew into AnalysisEchoMismatchError.
   */
  recordWriteMode?: 'replace' | 'merge';
  /**
   * Analysis summary/summaries (v1.7.0) — single or per-agent array. Per-agent
   * scoped REPLACE (API 1a, spec §3.6): each named agent's existing summary is
   * superseded by its entry here; other agents' summaries are untouched.
   */
  analysisSummary?: AnalysisSummaryInput | AnalysisSummaryInput[];
}

/**
 * Update run by project+number input
 */
export interface UpdateRunByNumberInput extends UpdateRunInput {
  project: string;
  runNumber: number;
}

/**
 * Input for the read-only update preview (POST /runs/:id/update-preview).
 * Analysis concerns ONLY (spec §4 scope rule) — the SDK rejects any other
 * update field client-side with a named `InputValidationError` (the request
 * body is built from the analysis fields alone, so nothing else can reach
 * the server through this path).
 */
export interface UpdateRunPreviewInput {
  analysisRecords?: AnalysisRecordInput[];
  analysisSummary?: AnalysisSummaryInput | AnalysisSummaryInput[];
  /** Preview under this mode (default 'replace') — see {@link UpdateRunInput.recordWriteMode}. The preview forwarding the mode is load-bearing: a stripped mode would preview replace while the write merges. */
  recordWriteMode?: 'replace' | 'merge';
}

/** By-project sibling of {@link UpdateRunPreviewInput} (POST /runs/update-preview). */
export interface UpdateRunPreviewByNumberInput extends UpdateRunPreviewInput {
  project: string;
  runNumber: number;
}

/**
 * The additive `analysisWrite` block echoed on analysis-bearing update
 * responses (API 1a, spec §3.9). The SDK asserts `recordMode` equals the mode
 * it implements before returning; consumers normally never see a mismatch —
 * it surfaces as {@link AnalysisEchoMismatchError}.
 */
export interface AnalysisWriteEcho {
  recordMode: string;
  supersededRecords: number;
  supersededSummaries: number;
  createdRecords: number;
  createdSummaries: number;
}

/** Per-agent block of an update preview (spec §4). */
export interface AgentWritePlan {
  wouldSupersedeRecords: number;
  wouldSupersedeSummaries: number;
  wouldCreateRecords: number;
  wouldCreateSummaries: number;
  /**
   * Live record_ids for the agent absent from the payload — what a replace
   * write would retire by omission. Non-empty means the write would destroy
   * rows the caller did not resend.
   */
  wouldRetireRecordIds: string[];
}

/** Result of the read-only update preview endpoints. */
export interface RunUpdatePreview {
  preview: true;
  recordMode: string;
  byAgent: Record<string, AgentWritePlan>;
}

/**
 * Result of {@link updateWithEcho}/{@link updateByIdWithEcho}: the updated
 * run PLUS the server's §3.9 analysis-write echo, so success-path callers
 * can see what the write actually superseded — `supersededRecords: 0` on an
 * enrichment that expected to replace is the only caller-visible symptom of
 * old-attribution rows accumulating beside the insert (the server logs it
 * as `run.analysis_write.superseded_zero`, but that log never reaches SDK
 * callers). `analysisWrite` is null when the update carried no analysis
 * concerns (the server emits no echo for those).
 */
export interface UpdateRunWithEchoResult {
  /** Full write echo (6.0.0: distinct from the slim read `Run`). */
  run: RunWriteEcho;
  analysisWrite: AnalysisWriteEcho | null;
}

/**
 * List runs query options
 */
export interface ListRunsQuery {
  workflowType?: string;
  limit?: number; // 1-100
}

// ─────────────────────────────────────────────────────────────────
// Exploration Map Types (v1.8.0)
// ─────────────────────────────────────────────────────────────────

/**
 * Structural mapping produced by Explorer-class agents.
 * Captures level maps, atomic inventories, relational topologies,
 * claim extractions, inquiry agendas, and other structural output.
 */
export interface ExplorationMap {
  metadata: {
    explorerName: string;
    framework: string;
    artifactPath?: string;
  };
  sections: ExplorationSection[];
}

/**
 * Typed section within an exploration map.
 * The `type` discriminator determines the section's structure.
 */
export type ExplorationSection =
  | InventorySection
  | TopologySection
  | LandscapeSection
  | ClassificationSection
  | MappingSection
  | SynthesisSection
  | LimitationSection
  | AgendaSection;

interface SectionBase {
  type: string;
  label: string;
  summary?: string;
}

export interface InventorySection extends SectionBase {
  type: 'inventory';
  items: Record<string, unknown>[];
  gaps?: string[];
}

export interface TopologySection extends SectionBase {
  type: 'topology';
  entities: Record<string, unknown>[];
  relationships: Record<string, unknown>[];
  clusters?: Record<string, unknown>[];
}

export interface LandscapeSection extends SectionBase {
  type: 'landscape';
  dimensions: string[];
  findings: Record<string, unknown>[];
}

export interface ClassificationSection extends SectionBase {
  type: 'classification';
  hierarchy: Record<string, unknown>[];
}

export interface MappingSection extends SectionBase {
  type: 'mapping';
  sourceDomain?: string;
  targetDomain?: string;
  translations: Record<string, unknown>[];
}

export interface SynthesisSection extends SectionBase {
  type: 'synthesis';
  patterns: Record<string, unknown>[];
  archetypes?: Record<string, unknown>[];
}

export interface LimitationSection extends SectionBase {
  type: 'limitation';
  blindSpots: Record<string, unknown>[];
}

export interface AgendaSection extends SectionBase {
  type: 'agenda';
  questions: Record<string, unknown>[];
}

// ─────────────────────────────────────────────────────────────────
// Analysis Input Types (v1.4.0)
// ─────────────────────────────────────────────────────────────────

/**
 * Analysis record input for structured analytical output.
 *
 * The `data` field is intentionally typed as `Record<string, unknown>` —
 * analysis record types are unbounded (conventions, tensions, decay vectors,
 * etc.) and their schemas are defined by individual agents, not the SDK.
 * The SDK validates the container; the server validates domain-specific content.
 */
export type AnalysisAgentType = 'validator' | 'analyst' | 'explorer' | 'forecaster' | 'executor' | 'generator';

export interface AnalysisRecordInput {
  /** Explicit type for an unregistered agent; must agree with an exact registry match. */
  agentType?: AnalysisAgentType | null;
  /** Agent name — overrides run-level default when provided */
  agentName?: string;
  recordType: string;
  recordId: string;
  title: string;
  classification?: string | null;
  severity?: string | null;
  data: Record<string, unknown>;
}

/**
 * Category score breakdown
 */
export interface CategoryScore {
  name: string;
  weight: number;
  score: number;
}

/**
 * Analysis summary input for system-level metrics
 */
export interface AnalysisSummaryInput {
  /** Explicit type for an unregistered agent; must agree with an exact registry match. */
  agentType?: AnalysisAgentType | null;
  /** Agent name — overrides run-level default when provided */
  agentName?: string;
  decision: string;
  score?: number | null;
  decisionVocabulary?: string | null;
  systemMetrics?: Record<string, unknown> | null;
  categoryScores?: CategoryScore[] | null;
  epistemicAssessment?: Record<string, unknown> | null;
  auditImplications?: string[] | null;
  explorationMaps?: ExplorationMap[] | null;
}

/**
 * Project analysis query options
 */
export interface ProjectAnalysisQuery {
  agentName?: string;
  agentType?: string;
  decision?: string;
  limit?: number;
  offset?: number;
}

/**
 * Analysis records query options (cross-project)
 */
export interface AnalysisRecordsQuery {
  recordType?: string;
  classification?: string;
  agentName?: string;
  agentType?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}

/**
 * Agent runs analysis query options
 */
export interface AgentRunsAnalysisQuery {
  project: string;
  decision?: string;
  limit?: number;
  offset?: number;
}
