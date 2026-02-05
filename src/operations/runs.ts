import type { OpsHttpClient } from '../http/http-client.js';
import type {
  Run,
  SaveFeaturesListInput,
  SaveFeaturesListResponse,
  ValidateFeaturesListResponse,
  RunDiffQuery,
  RunDiffResult,
  ArchiveRunsInput,
  ArchiveRunsResult,
  UpdateRunInput,
  UpdateRunByNumberInput,
  ListRunsQuery,
  RunDetails,
  ValidatorInput,
  RecommendationInput,
} from '../types/runs.js';
import {
  validateSaveFeaturesListInput,
  validateArchiveRunsInput,
} from '../config/validators.js';

/**
 * Options for validator transformation
 */
interface TransformValidatorOptions {
  /** Include all token fields (for save). If false, only input/output tokens (for validate). */
  includeAllTokens?: boolean;
}

/**
 * Transform a validator from SDK format (camelCase) to API format (snake_case)
 */
function transformValidator(
  v: ValidatorInput,
  options: TransformValidatorOptions = {}
): Record<string, unknown> {
  const { includeAllTokens = true } = options;

  const result: Record<string, unknown> = {
    name: v.name,
    score: v.score,
    max_score: v.maxScore,
    status: v.status,
    model: v.model,
    duration_ms: v.durationMs,
  };

  if (v.tokens) {
    result.tokens = includeAllTokens
      ? {
          input_tokens: v.tokens.inputTokens,
          output_tokens: v.tokens.outputTokens,
          cache_creation_tokens: v.tokens.cacheCreationTokens,
          cache_read_tokens: v.tokens.cacheReadTokens,
          total_effective_tokens: v.tokens.totalEffectiveTokens,
        }
      : {
          input_tokens: v.tokens.inputTokens,
          output_tokens: v.tokens.outputTokens,
        };
  }

  return result;
}

/**
 * Options for recommendation transformation
 */
interface TransformRecommendationOptions {
  /** Include all taxonomy fields (for save). If false, only essential fields (for validate). */
  includeAllFields?: boolean;
}

/**
 * Transform a recommendation from SDK format (camelCase) to API format (snake_case)
 */
function transformRecommendation(
  r: RecommendationInput,
  options: TransformRecommendationOptions = {}
): Record<string, unknown> {
  const { includeAllFields = true } = options;

  // Essential fields always included
  const result: Record<string, unknown> = {
    validator: r.validator,
    title: r.title,
    priority: r.priority,
    severity: r.severity,
    failure_code: r.failureCode,
    failure_domain: r.failureDomain,
    file_path: r.filePath,
  };

  // Additional fields for full save
  if (includeAllFields) {
    result.type = r.type;
    result.failure_mode = r.failureMode;
    result.category = r.category;
    result.line_number = r.lineNumber;
    result.description = r.description;
    result.classification_confidence = r.classificationConfidence;
    result.classified_by = r.classifiedBy;
    result.secondary_failure_codes = r.secondaryFailureCodes;
    result.taxonomy_version = r.taxonomyVersion;
  }

  return result;
}

/**
 * Save validation run results (save_features_list)
 *
 * Transforms SDK input (camelCase) to API format (snake_case).
 * The API expects validators with nested token metrics and
 * recommendations with taxonomy fields.
 */
export async function save(
  client: OpsHttpClient,
  input: SaveFeaturesListInput
): Promise<SaveFeaturesListResponse> {
  validateSaveFeaturesListInput(input);
  return client.post<SaveFeaturesListResponse>('/runs', {
    project: input.project,
    workflow_type: input.workflowType,
    validators: input.validators.map((v) => transformValidator(v, { includeAllTokens: true })),
    recommendations: input.recommendations.map((r) => transformRecommendation(r, { includeAllFields: true })),
    timestamp: input.timestamp,
    raw_markdown: input.rawMarkdown,
    summary: input.summary
      ? {
          all_gates_passed: input.summary.allGatesPassed,
          average_score: input.summary.averageScore,
        }
      : undefined,
    idempotency_key: input.idempotencyKey,
  });
}

/**
 * Validate run data without saving (preview)
 *
 * Similar to save() but sends minimal fields for validation.
 * The API validates the data and returns what would be created/updated
 * without actually persisting anything.
 */
export async function validate(
  client: OpsHttpClient,
  input: SaveFeaturesListInput
): Promise<ValidateFeaturesListResponse> {
  validateSaveFeaturesListInput(input);
  return client.post<ValidateFeaturesListResponse>('/runs/validate', {
    project: input.project,
    workflow_type: input.workflowType,
    validators: input.validators.map((v) => transformValidator(v, { includeAllTokens: false })),
    recommendations: input.recommendations.map((r) => transformRecommendation(r, { includeAllFields: false })),
  });
}

/**
 * Compare two runs (diff)
 */
export async function diff(
  client: OpsHttpClient,
  query: RunDiffQuery
): Promise<RunDiffResult> {
  return client.get<RunDiffResult>('/runs/diff', {
    project: query.project,
    base_run: query.baseRun,
    compare_run: query.compareRun,
  });
}

/**
 * Archive old runs
 */
export async function archive(
  client: OpsHttpClient,
  input: ArchiveRunsInput
): Promise<ArchiveRunsResult> {
  validateArchiveRunsInput(input);
  return client.post<ArchiveRunsResult>('/runs/archive', {
    project: input.project,
    before_run_number: input.beforeRunNumber,
    before_date: input.beforeDate,
    keep_last: input.keepLast,
    reason: input.reason,
  });
}

/**
 * Update run metadata by project and run number
 */
export async function update(
  client: OpsHttpClient,
  input: UpdateRunByNumberInput
): Promise<Run> {
  return client.patch<Run>('/runs/update', {
    project: input.project,
    run_number: input.runNumber,
    workflow_type: input.workflowType,
    all_gates_passed: input.allGatesPassed,
    average_score: input.averageScore,
    raw_markdown: input.rawMarkdown,
    validators: input.validators?.map((v) => ({
      name: v.name,
      score: v.score,
      status: v.status,
      model: v.model,
      input_tokens: v.inputTokens,
      output_tokens: v.outputTokens,
      cache_creation_tokens: v.cacheCreationTokens,
      cache_read_tokens: v.cacheReadTokens,
      total_effective_tokens: v.totalEffectiveTokens,
      duration_ms: v.durationMs,
    })),
  });
}

/**
 * List runs for a project
 */
export async function listByProject(
  client: OpsHttpClient,
  projectId: string,
  query?: ListRunsQuery
): Promise<Run[]> {
  return client.get<Run[]>(
    `/runs/project/${encodeURIComponent(projectId)}`,
    query
  );
}

/**
 * Get the latest run for a project
 */
export async function getLatest(
  client: OpsHttpClient,
  projectId: string,
  workflowType?: string
): Promise<Run> {
  return client.get<Run>(
    `/runs/project/${encodeURIComponent(projectId)}/latest`,
    workflowType ? { workflow_type: workflowType } : undefined
  );
}

/**
 * Get full run details with recommendations
 */
export async function getDetails(
  client: OpsHttpClient,
  projectId: string,
  runNumber?: number
): Promise<RunDetails> {
  return client.get<RunDetails>(
    `/runs/project/${encodeURIComponent(projectId)}/details`,
    runNumber ? { run_number: runNumber } : undefined
  );
}

/**
 * Get a run by ID
 */
export async function get(client: OpsHttpClient, runId: string): Promise<Run> {
  return client.get<Run>(`/runs/${encodeURIComponent(runId)}`);
}

/**
 * Update a run by ID
 */
export async function updateById(
  client: OpsHttpClient,
  runId: string,
  input: UpdateRunInput
): Promise<Run> {
  return client.patch<Run>(`/runs/${encodeURIComponent(runId)}`, {
    workflow_type: input.workflowType,
    all_gates_passed: input.allGatesPassed,
    average_score: input.averageScore,
    raw_markdown: input.rawMarkdown,
    validators: input.validators?.map((v) => ({
      name: v.name,
      score: v.score,
      status: v.status,
      model: v.model,
      input_tokens: v.inputTokens,
      output_tokens: v.outputTokens,
      cache_creation_tokens: v.cacheCreationTokens,
      cache_read_tokens: v.cacheReadTokens,
      total_effective_tokens: v.totalEffectiveTokens,
      duration_ms: v.durationMs,
    })),
  });
}

/**
 * Delete a run (requires confirmation header)
 */
export async function deleteRun(
  client: OpsHttpClient,
  runId: string
): Promise<void> {
  await client.request('DELETE', `/runs/${encodeURIComponent(runId)}`, undefined, {
    headers: { 'X-Confirm-Delete': runId },
  });
}
