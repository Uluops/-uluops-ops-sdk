import { z } from 'zod';
import type {
  Priority,
  Severity,
  FailureDomain,
  IssueType,
  ClassificationConfidence,
  ClassifiedBy,
  SubscriptionTier,
} from './enums.js';
import {
  RunResponseSchema,
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
} from './response-schemas.js';

// ─────────────────────────────────────────────────────────────────
// Response types (derived from Zod schemas — single source of truth)
// ─────────────────────────────────────────────────────────────────

/** Validation run entity */
export type Run = z.infer<typeof RunResponseSchema>;

/** Enriched run for list endpoints (aggregate fields, no detail-only fields) */
export type RunSummary = z.infer<typeof RunSummaryResponseSchema>;

/** Agent snapshot (results from a single agent in a run) */
export type AgentSnapshot = z.infer<typeof AgentSnapshotResponseSchema>;

/** Correlation result (new/recurring/regression detection) */
export type CorrelationResult = z.infer<typeof CorrelationResultResponseSchema>;

/** Save run response */
export type SaveRunResponse = z.infer<typeof SaveRunResponseSchema>;

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

// ─────────────────────────────────────────────────────────────────
// Input types (hand-written — not API responses)
// ─────────────────────────────────────────────────────────────────

/**
 * Token usage metrics
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalEffectiveTokens?: number;
}

/**
 * Agent input for save_run
 */
export interface AgentInput {
  name: string;
  definitionVersion?: string;
  score: number;
  maxScore?: number;
  decision: string;
  summary?: string;
  model?: string;
  tokens?: TokenUsage;
  durationMs?: number;
}

/**
 * Recommendation/issue input for save_run
 */
export interface RecommendationInput {
  agent: string;
  title: string;
  priority: Priority;
  type?: IssueType;
  severity?: Severity;
  failureCode?: string;
  failureDomain?: FailureDomain;
  failureMode?: string;
  category?: string;
  filePath?: string;
  lineNumber?: number;
  description?: string;
  classificationConfidence?: ClassificationConfidence;
  classifiedBy?: ClassifiedBy;
  secondaryFailureCodes?: string[];
  taxonomyVersion?: string;
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
  workflowType?: string;
  allGatesPassed?: boolean;
  averageScore?: number | null;
  rawMarkdown?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  recommendations?: RecommendationInput[];
  agents?: Array<{
    name: string;
    score?: number;
    decision?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    totalEffectiveTokens?: number;
    durationMs?: number;
  }>;
  /** Structured analysis records (v1.4.0) — replaces existing records if present */
  analysisRecords?: AnalysisRecordInput[];
  /** Analysis summary/summaries (v1.7.0) — single or per-agent array. Replaces existing. */
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
 * Analysis record input for structured analytical output
 */
export interface AnalysisRecordInput {
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
  /** Agent name — overrides run-level default when provided */
  agentName?: string;
  decision: string;
  score: number;
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

/** @deprecated Use AgentSnapshot instead */
export type ValidatorSnapshot = AgentSnapshot;
/** @deprecated Use AgentInput instead */
export type ValidatorInput = AgentInput;
/** @deprecated Use AgentChange instead */
export type ValidatorChange = AgentChange;
