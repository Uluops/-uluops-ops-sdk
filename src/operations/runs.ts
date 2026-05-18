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
} from '../config/validators.js';

/**
 * Save a validation run with agent scores and recommendations.
 * Input is validated client-side via Zod before the network request.
 *
 * @param client - HTTP client instance
 * @param input - Run data (project, workflowType, agents, recommendations required)
 * @returns Save result with run metadata and issue correlation (new/recurring/regressions)
 * @throws {InputValidationError} If input fails client-side Zod validation
 * @throws {ConflictError} If idempotencyKey was already used
 */
export async function save(
  client: OpsHttpClient,
  input: SaveRunInput
): Promise<SaveRunResponse> {
  validateSaveRunInput(input);
  return client.post('/runs', {
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
    definitionMinSubscription: input.definitionMinSubscription,
    definitionId: input.definitionId,
    analysisRecords: input.analysisRecords,
    analysisSummary: input.analysisSummary,
  }, { retryMutations: true, schema: SaveRunResponseSchema });
}

/**
 * Preview what a save would produce without persisting. Returns projected
 * issue correlation (what would be created, updated, regressed).
 *
 * @param client - HTTP client instance
 * @param input - Same shape as save() input
 * @returns Preview with projected new/recurring/regression counts
 * @throws {InputValidationError} If input fails client-side Zod validation
 */
export async function validate(
  client: OpsHttpClient,
  input: SaveRunInput
): Promise<ValidateRunResponse> {
  validateSaveRunInput(input);
  return client.post('/runs/validate', {
    project: input.project,
    workflowType: input.workflowType,
    agents: input.agents,
    recommendations: input.recommendations,
  }, { schema: ValidateRunResponseSchema });
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
  return client.get('/runs/diff', toApiQuery({
    project: query.project,
    baseRun: query.baseRun,
    compareRun: query.compareRun,
  }), { schema: RunDiffResultResponseSchema });
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
  return client.post('/runs/archive', {
    project: input.project,
    beforeRunNumber: input.beforeRunNumber,
    beforeDate: input.beforeDate,
    keepLast: input.keepLast,
    reason: input.reason,
  }, { schema: ArchiveRunsResultResponseSchema });
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
  input: UpdateRunByNumberInput
): Promise<Run> {
  return client.patch('/runs/update', {
    project: input.project,
    runNumber: input.runNumber,
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
  }, { schema: RunResponseSchema });
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
  return client.get(
    `/runs/project/${encodeURIComponent(projectId)}`,
    toApiQuery(query),
    { schema: z.array(RunSummaryResponseSchema) }
  );
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
  return client.get(
    `/runs/project/${encodeURIComponent(projectId)}/latest`,
    workflowType ? toApiQuery({ workflowType }) : undefined,
    { schema: RunResponseSchema }
  );
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
  return client.get(
    `/runs/project/${encodeURIComponent(projectId)}/details`,
    runNumber !== undefined ? toApiQuery({ runNumber }) : undefined,
    { schema: RunDetailsResponseSchema }
  );
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
  return client.get(`/runs/${encodeURIComponent(runId)}`, undefined, { schema: RunResponseSchema });
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
  input: UpdateRunInput
): Promise<Run> {
  return client.patch(`/runs/${encodeURIComponent(runId)}`, {
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
  }, { schema: RunResponseSchema });
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
  return client.request('DELETE', `/runs/${encodeURIComponent(runId)}`, undefined, {
    headers: { 'X-Confirm-Delete': runId },
    schema: DeleteResultResponseSchema,
  });
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
  return client.get(`/runs/${encodeURIComponent(runId)}/analysis`, undefined, { schema: RunAnalysisResponseSchema });
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
  return client.get(
    `/projects/${encodeURIComponent(projectId)}/analysis`,
    toApiQuery(query),
    { schema: ProjectAnalysisListResponseSchema }
  );
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
  return client.get(
    '/analysis/records',
    toApiQuery(query),
    { schema: AnalysisRecordsListResponseSchema }
  );
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
  return client.get(
    `/agents/${encodeURIComponent(agentName)}/runs-analysis`,
    toApiQuery(query),
    { schema: AgentRunsAnalysisResponseSchema },
  );
}
