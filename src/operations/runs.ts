import type { OpsHttpClient } from '../http/http-client.js';
import { toApiQuery } from '../http/http-client.js';
import type {
  Run,
  RunSummary,
  SaveRunInput,
  SaveRunResponse,
  ValidateRunResponse,
  RunDiffQuery,
  RunDiffResult,
  ArchiveRunsInput,
  ArchiveRunsResult,
  UpdateRunInput,
  UpdateRunByNumberInput,
  ListRunsQuery,
  RunDetails,
  RunAnalysis,
  AnalysisSummary,
  AnalysisRecord,
  ProjectAnalysisQuery,
  AnalysisRecordsQuery,
} from '../types/runs.js';
import type { DeleteResult } from '../types/responses.js';
import {
  validateSaveRunInput,
  validateArchiveRunsInput,
} from '../config/validators.js';

/**
 * Save validation run results (save_run)
 *
 * Sends SDK input directly in camelCase. The API accepts both
 * camelCase and snake_case via normalizeKeys().
 */
export async function save(
  client: OpsHttpClient,
  input: SaveRunInput
): Promise<SaveRunResponse> {
  validateSaveRunInput(input);
  return client.post<SaveRunResponse>('/runs', {
    project: input.project,
    workflowType: input.workflowType,
    agents: input.agents,
    recommendations: input.recommendations,
    timestamp: input.timestamp,
    rawMarkdown: input.rawMarkdown,
    summary: input.summary,
    idempotencyKey: input.idempotencyKey,
    definitionType: input.definitionType,
    definitionName: input.definitionName,
    definitionVersion: input.definitionVersion,
    definitionHash: input.definitionHash,
    analysisRecords: input.analysisRecords,
    analysisSummary: input.analysisSummary,
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
  input: SaveRunInput
): Promise<ValidateRunResponse> {
  validateSaveRunInput(input);
  return client.post<ValidateRunResponse>('/runs/validate', {
    project: input.project,
    workflowType: input.workflowType,
    agents: input.agents,
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
    agents: input.agents,
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
    agents: input.agents,
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

// ─────────────────────────────────────────────────────────────────
// Analysis Operations (v1.4.0)
// ─────────────────────────────────────────────────────────────────

/**
 * Get analysis records and summaries for a specific run
 */
export async function getAnalysis(
  client: OpsHttpClient,
  runId: string
): Promise<RunAnalysis> {
  return client.get<RunAnalysis>(`/runs/${encodeURIComponent(runId)}/analysis`);
}

/**
 * Get analysis summaries for a project over time
 */
export async function getProjectAnalysis(
  client: OpsHttpClient,
  projectId: string,
  query?: ProjectAnalysisQuery
): Promise<{ data: AnalysisSummary[]; total: number }> {
  return client.get<{ data: AnalysisSummary[]; total: number }>(
    `/projects/${encodeURIComponent(projectId)}/analysis`,
    toApiQuery(query)
  );
}

/**
 * Query analysis records across projects with filters
 */
export async function queryAnalysisRecords(
  client: OpsHttpClient,
  query?: AnalysisRecordsQuery
): Promise<{ data: AnalysisRecord[]; total: number }> {
  return client.get<{ data: AnalysisRecord[]; total: number }>(
    '/analysis/records',
    toApiQuery(query)
  );
}
