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
} from '../types/runs.js';

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
  // Transform validators: camelCase -> snake_case, flatten token fields
  return client.post<SaveFeaturesListResponse>('/runs', {
    project: input.project,
    workflow_type: input.workflowType,
    validators: input.validators.map((v) => ({
      name: v.name,
      score: v.score,
      max_score: v.maxScore,
      status: v.status,
      model: v.model,
      tokens: v.tokens
        ? {
            input_tokens: v.tokens.inputTokens,
            output_tokens: v.tokens.outputTokens,
            cache_creation_tokens: v.tokens.cacheCreationTokens,
            cache_read_tokens: v.tokens.cacheReadTokens,
            total_effective_tokens: v.tokens.totalEffectiveTokens,
          }
        : undefined,
      duration_ms: v.durationMs,
    })),
    // Transform recommendations: camelCase -> snake_case for all taxonomy fields
    recommendations: input.recommendations.map((r) => ({
      validator: r.validator,
      title: r.title,
      priority: r.priority,
      type: r.type,
      severity: r.severity,
      failure_code: r.failureCode,
      failure_domain: r.failureDomain,
      failure_mode: r.failureMode,
      category: r.category,
      file_path: r.filePath,
      line_number: r.lineNumber,
      description: r.description,
      classification_confidence: r.classificationConfidence,
      classified_by: r.classifiedBy,
      secondary_failure_codes: r.secondaryFailureCodes,
      taxonomy_version: r.taxonomyVersion,
    })),
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
  // Minimal transformation - only required fields for validation
  return client.post<ValidateFeaturesListResponse>('/runs/validate', {
    project: input.project,
    workflow_type: input.workflowType,
    validators: input.validators.map((v) => ({
      name: v.name,
      score: v.score,
      max_score: v.maxScore,
      status: v.status,
      model: v.model,
      tokens: v.tokens
        ? {
            input_tokens: v.tokens.inputTokens,
            output_tokens: v.tokens.outputTokens,
          }
        : undefined,
      duration_ms: v.durationMs,
    })),
    recommendations: input.recommendations.map((r) => ({
      validator: r.validator,
      title: r.title,
      priority: r.priority,
      severity: r.severity,
      failure_code: r.failureCode,
      failure_domain: r.failureDomain,
      file_path: r.filePath,
    })),
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
    query as Record<string, unknown>
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
  return client.get<Run>(`/runs/${runId}`);
}

/**
 * Update a run by ID
 */
export async function updateById(
  client: OpsHttpClient,
  runId: string,
  input: UpdateRunInput
): Promise<Run> {
  return client.patch<Run>(`/runs/${runId}`, {
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
  await client.request('DELETE', `/runs/${runId}`, undefined, {
    headers: { 'X-Confirm-Delete': runId },
  });
}
