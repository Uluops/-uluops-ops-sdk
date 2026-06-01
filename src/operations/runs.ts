import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { OpsHttpClient } from '../http/http-client.js';
import { toApiQuery } from '../http/http-client.js';
import type {
  Run,
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
  ProjectAnalysisQuery,
  AnalysisRecordsQuery,
  AgentRunsAnalysisQuery,
} from '../types/runs.js';
import type { DeleteResult } from '../types/responses.js';
import {
  RunResponseSchema,
  RunSummaryResponseSchema,
  SaveRunResponseSchema,
  ValidateRunResponseSchema,
  RunDiffResultResponseSchema,
  ArchiveRunsResultResponseSchema,
  DeleteResultResponseSchema,
  RunDetailsResponseSchema,
  RunAnalysisResponseSchema,
  ProjectAnalysisListResponseSchema,
  AnalysisRecordsListResponseSchema,
  AgentRunsAnalysisResponseSchema,
} from '../types/response-schemas.js';
import {
  validateSaveRunInput,
  validateArchiveRunsInput,
  validateUpdateRunInput,
} from '../config/validators.js';

/**
 * Save an execution run with agent scores and recommendations.
 * Input is validated client-side via Zod before the network request.
 *
 * @param client - HTTP client instance
 * @param input - Run data (project, workflowType, agents, recommendations required)
 * @returns Save result with run metadata and issue correlation (new/recurring/regressions)
 * @throws {InputValidationError} If input fails client-side Zod validation
 * @throws {ConflictError} If idempotencyKey was already used
 * @example
 * ```typescript
 * const result = await client.runs.save({
 *   project: 'my-project',
 *   workflowType: 'post-implementation',
 *   agents: [{ name: 'code-validator', score: 85, decision: 'PASS' }],
 *   recommendations: [{ agent: 'code-validator', title: 'Missing null check', priority: 'suggested', failureCode: 'SEM-VAL/M' }],
 * });
 * console.log(result.run.runNumber, result.correlation.newIssues);
 * ```
 */
// Client-side validation is a convenience guarantee, not a security boundary.
// Pre-validated callers (MCP, autosave hooks) skip it to avoid redundant work —
// the server always validates regardless. This is an intentional escape hatch,
// not a contradiction of the validation commitment.
export async function save(
  client: OpsHttpClient,
  input: SaveRunInput,
  options?: { _skipClientValidation?: boolean }
): Promise<SaveRunResponse> {
  if (!options?._skipClientValidation) validateSaveRunInput(input);
  // Generate idempotency key if not provided — prevents duplicate runs on retry
  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  return SaveRunResponseSchema.parse(await client.post<unknown>('/runs', {
    project: input.project,
    workflowType: input.workflowType,
    agents: input.agents,
    recommendations: input.recommendations,
    timestamp: input.timestamp,
    rawMarkdown: input.rawMarkdown,
    summary: input.summary,
    idempotencyKey,
    definitionType: input.definitionType,
    definitionName: input.definitionName,
    definitionVersion: input.definitionVersion,
    definitionHash: input.definitionHash,
    definitionMinSubscription: input.definitionMinSubscription,
    definitionId: input.definitionId,
    analysisRecords: input.analysisRecords,
    analysisSummary: input.analysisSummary,
  }, { retryMutations: true }));
}

/**
 * Preview what a save would produce without persisting. Returns projected
 * issue correlation (what would be created, updated, regressed).
 *
 * @param client - HTTP client instance
 * @param input - Same shape as save() input
 * @returns Preview with projected new/recurring/regression counts
 * @throws {InputValidationError} If input fails client-side Zod validation
 * @example
 * ```typescript
 * const preview = await client.runs.validate({
 *   project: 'my-project',
 *   workflowType: 'post-implementation',
 *   agents: [{ name: 'code-validator', score: 85, decision: 'PASS' }],
 * });
 * console.log(preview.correlation); // { newIssues: 3, recurringIssues: 1, regressions: 0 }
 * ```
 */
export async function validate(
  client: OpsHttpClient,
  input: SaveRunInput,
  options?: { _skipClientValidation?: boolean }
): Promise<ValidateRunResponse> {
  if (!options?._skipClientValidation) validateSaveRunInput(input);
  return ValidateRunResponseSchema.parse(await client.post<unknown>('/runs/validate', {
    project: input.project,
    workflowType: input.workflowType,
    agents: input.agents,
    recommendations: input.recommendations,
  }));
}

/**
 * Compare two runs to see fixed, new, and unchanged issues.
 *
 * @param client - HTTP client instance
 * @param query - Diff parameters: project, baseRun number, compareRun number
 * @returns Diff result with fixed/new/unchanged issues and agent score changes
 */
export async function diff(
  client: OpsHttpClient,
  query: RunDiffQuery
): Promise<RunDiffResult> {
  return RunDiffResultResponseSchema.parse(await client.get<unknown>('/runs/diff', toApiQuery({
    project: query.project,
    baseRun: query.baseRun,
    compareRun: query.compareRun,
  })));
}

/**
 * Archive old runs by run number, date, or retention count.
 *
 * @param client - HTTP client instance
 * @param input - Archive criteria: project (required), plus beforeRunNumber, beforeDate, keepLast, reason
 * @returns Archive result with count of archived runs
 * @throws {InputValidationError} If input fails client-side Zod validation
 */
export async function archive(
  client: OpsHttpClient,
  input: ArchiveRunsInput
): Promise<ArchiveRunsResult> {
  validateArchiveRunsInput(input);
  return ArchiveRunsResultResponseSchema.parse(await client.post<unknown>('/runs/archive', {
    project: input.project,
    beforeRunNumber: input.beforeRunNumber,
    beforeDate: input.beforeDate,
    keepLast: input.keepLast,
    reason: input.reason,
  }));
}

/** Build the shared update payload from an UpdateRunInput */
function buildUpdatePayload(input: UpdateRunInput) {
  return {
    workflowType: input.workflowType,
    allGatesPassed: input.allGatesPassed,
    averageScore: input.averageScore,
    rawMarkdown: input.rawMarkdown,
    archivedAt: input.archivedAt,
    archiveReason: input.archiveReason,
    agents: input.agents,
    recommendations: input.recommendations,
    analysisRecords: input.analysisRecords,
    analysisSummary: input.analysisSummary,
  };
}

/**
 * Update run metadata by project and run number. Supports post-hoc
 * enrichment with analysis records and summaries.
 *
 * @param client - HTTP client instance
 * @param input - Update payload with project + runNumber identifier
 * @returns Updated run
 */
export async function update(
  client: OpsHttpClient,
  input: UpdateRunByNumberInput,
  options?: { _skipClientValidation?: boolean }
): Promise<Run> {
  if (!options?._skipClientValidation) validateUpdateRunInput(input);
  return RunResponseSchema.parse(await client.patch<unknown>('/runs/update', {
    project: input.project,
    runNumber: input.runNumber,
    ...buildUpdatePayload(input),
  }));
}

/**
 * List runs for a project with optional filters.
 *
 * @param client - HTTP client instance
 * @param projectId - Project ID or name
 * @param query - Optional filters: workflowType, limit, offset
 * @returns Array of run summaries
 */
export async function listByProject(
  client: OpsHttpClient,
  projectId: string,
  query?: ListRunsQuery
): Promise<z.infer<typeof RunSummaryResponseSchema>[]> {
  return (z.array(RunSummaryResponseSchema)).parse(await client.get<unknown>(
    `/runs/project/${encodeURIComponent(projectId)}`,
    toApiQuery(query)
  ));
}

/**
 * Get the most recent run for a project, optionally filtered by workflow type.
 *
 * @param client - HTTP client instance
 * @param projectId - Project ID or name
 * @param workflowType - Optional workflow type filter (e.g. 'post-implementation')
 * @returns Latest run
 * @throws {NotFoundError} If no runs exist for the project/workflow
 */
export async function getLatest(
  client: OpsHttpClient,
  projectId: string,
  workflowType?: string
): Promise<Run> {
  return RunResponseSchema.parse(await client.get<unknown>(
    `/runs/project/${encodeURIComponent(projectId)}/latest`,
    workflowType ? toApiQuery({ workflowType }) : undefined
  ));
}

/**
 * Get full run details including agents, recommendations, and analysis data.
 *
 * @param client - HTTP client instance
 * @param projectId - Project ID or name
 * @param runNumber - Specific run number (omit for latest)
 * @returns Run details with nested agents and recommendations arrays
 */
export async function getDetails(
  client: OpsHttpClient,
  projectId: string,
  runNumber?: number
): Promise<RunDetails> {
  return RunDetailsResponseSchema.parse(await client.get<unknown>(
    `/runs/project/${encodeURIComponent(projectId)}/details`,
    runNumber !== undefined ? toApiQuery({ runNumber }) : undefined
  ));
}

/**
 * Get a run by its UUID.
 *
 * @param client - HTTP client instance
 * @param runId - Run UUID
 * @returns Run record
 * @throws {NotFoundError} If run does not exist
 */
export async function get(client: OpsHttpClient, runId: string): Promise<Run> {
  return RunResponseSchema.parse(await client.get<unknown>(`/runs/${encodeURIComponent(runId)}`, undefined));
}

/**
 * Update run metadata by UUID. Supports post-hoc enrichment with
 * analysis records, summaries, and exploration maps.
 *
 * @param client - HTTP client instance
 * @param runId - Run UUID
 * @param input - Fields to update (all optional except identifier)
 * @returns Updated run
 */
export async function updateById(
  client: OpsHttpClient,
  runId: string,
  input: UpdateRunInput,
  options?: { _skipClientValidation?: boolean }
): Promise<Run> {
  if (!options?._skipClientValidation) validateUpdateRunInput(input);
  return RunResponseSchema.parse(await client.patch<unknown>(`/runs/${encodeURIComponent(runId)}`, buildUpdatePayload(input)));
}

/**
 * Permanently delete a run. Requires the run ID as a confirmation header.
 *
 * @param client - HTTP client instance
 * @param runId - Run UUID (also sent as X-Confirm-Delete header)
 * @returns `{ deleted: true }` on success
 */
export async function deleteRun(
  client: OpsHttpClient,
  runId: string
): Promise<DeleteResult> {
  return DeleteResultResponseSchema.parse(await client.request<unknown>('DELETE', `/runs/${encodeURIComponent(runId)}`, undefined, { headers: { 'X-Confirm-Delete': runId }, }));
}

// ─────────────────────────────────────────────────────────────────
// Analysis Operations (v1.4.0)
// ─────────────────────────────────────────────────────────────────

/**
 * Get structured analysis records and summaries for a specific run.
 * Includes convention inventories, tension maps, decay vectors, exploration maps, etc.
 *
 * @param client - HTTP client instance
 * @param runId - Run UUID
 * @returns Analysis data with records and summaries arrays
 */
export async function getAnalysis(
  client: OpsHttpClient,
  runId: string
): Promise<z.infer<typeof RunAnalysisResponseSchema>> {
  return RunAnalysisResponseSchema.parse(await client.get<unknown>(`/runs/${encodeURIComponent(runId)}/analysis`, undefined));
}

/**
 * Get analysis summaries for a project over time. Filter by agent name,
 * agent type, or decision to track specific analytical trajectories.
 *
 * @param client - HTTP client instance
 * @param projectId - Project ID or name
 * @param query - Optional filters: agentName, agentType, decision, limit, offset
 * @returns Paginated analysis summaries with `{ data, total }`
 */
export async function getProjectAnalysis(
  client: OpsHttpClient,
  projectId: string,
  query?: ProjectAnalysisQuery
): Promise<z.infer<typeof ProjectAnalysisListResponseSchema>> {
  // Uses `rawEnvelope` because the response carries the pagination shape
  // `{ data, total, limit, offset }` directly — the HttpClient's default
  // envelope unwrap collides with the `data` field of the pagination payload.
  return ProjectAnalysisListResponseSchema.parse(await client.request<unknown>(
    'GET',
    `/projects/${encodeURIComponent(projectId)}/analysis`,
    toApiQuery(query),
    { rawEnvelope: true }
  ));
}

/**
 * Query analysis records across projects. Filter by record type
 * (convention, tension, decay_vector), classification, agent, or severity.
 *
 * @param client - HTTP client instance
 * @param query - Optional filters: recordType, classification, agentName, severity, limit, offset
 * @returns Paginated analysis records with `{ data, total }`
 */
export async function queryAnalysisRecords(
  client: OpsHttpClient,
  query?: AnalysisRecordsQuery
): Promise<z.infer<typeof AnalysisRecordsListResponseSchema>> {
  // Uses `rawEnvelope` — see getProjectAnalysis above for the rationale.
  return AnalysisRecordsListResponseSchema.parse(await client.request<unknown>(
    'GET',
    '/analysis/records',
    toApiQuery(query),
    { rawEnvelope: true }
  ));
}

/**
 * Get analysis summaries with run context for a specific agent.
 * Returns decision, score, category scores alongside run metadata
 * (run number, timestamp, workflow type, snapshot score).
 *
 * @param client - HTTP client instance
 * @param agentName - Agent name (e.g. 'epictetus-validator')
 * @param query - Query with required `project`, optional `decision`, `limit`, `offset`
 * @returns `{ items: AgentRunSummary[], total: number }`
 */
export async function getAgentRunsAnalysis(
  client: OpsHttpClient,
  agentName: string,
  query: AgentRunsAnalysisQuery
): Promise<z.infer<typeof AgentRunsAnalysisResponseSchema>> {
  return AgentRunsAnalysisResponseSchema.parse(await client.get<unknown>(
    `/agents/${encodeURIComponent(agentName)}/runs-analysis`,
    toApiQuery(query),
  ));
}
