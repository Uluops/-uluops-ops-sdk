import type { OpsHttpClient } from '../http/http-client.js';
import { toApiQuery } from '../http/http-client.js';
import type {
  Run,
  RunSummary,
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
import type { DeleteResult } from '../types/responses.js';
import {
  validateSaveFeaturesListInput,
  validateArchiveRunsInput,
} from '../config/validators.js';

/**
 * Save validation run results (save_features_list)
 *
 * Sends SDK input directly in camelCase. The API accepts both
 * camelCase and snake_case via normalizeKeys().
 */
export async function save(
  client: OpsHttpClient,
  input: SaveFeaturesListInput
): Promise<SaveFeaturesListResponse> {
  validateSaveFeaturesListInput(input);
  return client.post<SaveFeaturesListResponse>('/runs', {
    project: input.project,
    workflowType: input.workflowType,
    validators: input.validators,
    recommendations: input.recommendations,
    timestamp: input.timestamp,
    rawMarkdown: input.rawMarkdown,
    summary: input.summary,
    idempotencyKey: input.idempotencyKey,
  }, { retryMutations: true });
}

/**
 * Validate run data without saving (preview)
 *
 * Similar to save() but the API validates data and returns what
 * would be created/updated without actually persisting anything.
 */
export async function validate(
  client: OpsHttpClient,
  input: SaveFeaturesListInput
): Promise<ValidateFeaturesListResponse> {
  validateSaveFeaturesListInput(input);
  return client.post<ValidateFeaturesListResponse>('/runs/validate', {
    project: input.project,
    workflowType: input.workflowType,
    validators: input.validators,
    recommendations: input.recommendations,
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
    baseRun: query.baseRun,
    compareRun: query.compareRun,
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
    beforeRunNumber: input.beforeRunNumber,
    beforeDate: input.beforeDate,
    keepLast: input.keepLast,
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
    runNumber: input.runNumber,
    workflowType: input.workflowType,
    allGatesPassed: input.allGatesPassed,
    averageScore: input.averageScore,
    rawMarkdown: input.rawMarkdown,
    validators: input.validators,
  });
}

/**
 * List runs for a project
 */
export async function listByProject(
  client: OpsHttpClient,
  projectId: string,
  query?: ListRunsQuery
): Promise<RunSummary[]> {
  return client.get<RunSummary[]>(
    `/runs/project/${encodeURIComponent(projectId)}`,
    toApiQuery(query)
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
    workflowType ? { workflowType } : undefined
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
    runNumber !== undefined ? { runNumber } : undefined
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
    workflowType: input.workflowType,
    allGatesPassed: input.allGatesPassed,
    averageScore: input.averageScore,
    rawMarkdown: input.rawMarkdown,
    validators: input.validators,
  });
}

/**
 * Delete a run (requires confirmation header)
 */
export async function deleteRun(
  client: OpsHttpClient,
  runId: string
): Promise<DeleteResult> {
  await client.request('DELETE', `/runs/${encodeURIComponent(runId)}`, undefined, {
    headers: { 'X-Confirm-Delete': runId },
  });
  return { deleted: true };
}
