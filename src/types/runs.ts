import type {
  Priority,
  Severity,
  FailureDomain,
  IssueType,
  ClassificationConfidence,
  ClassifiedBy,
} from './enums.js';

/**
 * Validation run entity
 */
export interface Run {
  id: string;
  projectId: string;
  runNumber: number;
  workflowType: string;
  timestamp: string;
  allGatesPassed: boolean;
  averageScore: number | null;
  rawMarkdown: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Validator snapshot (results from a single validator in a run)
 */
export interface ValidatorSnapshot {
  id: string;
  runId: string;
  name: string;
  score: number;
  maxScore: number;
  status: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  totalEffectiveTokens: number | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

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
 * Validator input for save_features_list
 */
export interface ValidatorInput {
  name: string;
  score: number;
  maxScore?: number;
  status: string;
  model?: string;
  tokens?: TokenUsage;
  durationMs?: number;
}

/**
 * Recommendation/issue input for save_features_list
 */
export interface RecommendationInput {
  validator: string;
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
 * Summary input for save_features_list
 */
export interface RunSummaryInput {
  allGatesPassed?: boolean;
  averageScore?: number;
}

/**
 * Save features list input (main run submission)
 */
export interface SaveFeaturesListInput {
  project: string;
  workflowType: string;
  validators: ValidatorInput[];
  recommendations: RecommendationInput[];
  timestamp?: string;
  rawMarkdown?: string;
  summary?: RunSummaryInput;
  idempotencyKey?: string;
}

/**
 * Correlation result (new/recurring/regression detection)
 */
export interface CorrelationResult {
  newIssues: number;
  recurringIssues: number;
  regressions: number;
}

/**
 * Save features list response
 */
export interface SaveFeaturesListResponse {
  run: Run;
  validators: ValidatorSnapshot[];
  correlation: CorrelationResult;
  deduplicated: boolean;
}

/**
 * Validate features list response (preview without saving)
 */
export interface ValidateFeaturesListResponse {
  wouldCreate: boolean;
  wouldUpdate: boolean;
  wouldRegress: boolean;
  validationErrors: string[];
  preview: CorrelationResult;
}

/**
 * Issue reference in a run diff (API returns issueId + title only)
 */
export interface DiffIssueRef {
  issueId: string;
  title: string;
}

/**
 * Validator score change between two runs
 */
export interface ValidatorChange {
  name: string;
  baseScore: number;
  compareScore: number;
  change: number;
}

/**
 * Run diff result
 */
export interface RunDiffResult {
  baseRun: Run;
  compareRun: Run;
  fixed: DiffIssueRef[];
  new: DiffIssueRef[];
  unchanged: DiffIssueRef[];
  validatorChanges: ValidatorChange[];
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
 * Archive runs result
 */
export interface ArchiveRunsResult {
  archivedCount: number;
}

/**
 * Update run input
 */
export interface UpdateRunInput {
  workflowType?: string;
  allGatesPassed?: boolean;
  averageScore?: number | null;
  rawMarkdown?: string | null;
  validators?: Array<{
    name: string;
    score?: number;
    status?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    totalEffectiveTokens?: number;
    durationMs?: number;
  }>;
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

/**
 * Run details (with recommendations and validator snapshots)
 */
export interface RunDetails {
  run: Run;
  validators: ValidatorSnapshot[];
  recommendations: Array<{
    id: string;
    title: string;
    priority: Priority;
    severity: Severity | null;
    validator: string;
    status: string;
    correlation: 'new' | 'recurring' | 'regression';
  }>;
}
