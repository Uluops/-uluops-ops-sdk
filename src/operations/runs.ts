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
  UpdateRunPreviewInput,
  UpdateRunPreviewByNumberInput,
  RunUpdatePreview,
  UpdateRunWithEchoResult,
  ListRunsQuery,
  RunDetails,
  ProjectAnalysisQuery,
  AnalysisRecordsQuery,
  AgentRunsAnalysisQuery,
} from '../types/runs.js';
import type { DeleteResult } from '../types/responses.js';
import {
  RunResponseSchema,
  UpdateRunEnvelopeSchema,
  RunUpdatePreviewResponseSchema,
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
  validateUpdateRunPreviewInput,
} from '../config/validators.js';
import { AnalysisEchoMismatchError, OpsApiError } from '../errors/errors.js';

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
 *   recommendations: [{ agent: 'code-validator', title: 'Missing null check', priority: 'suggested', failureCode: 'SEM-COM/M' }],
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
 *   recommendations: [],
 * });
 * console.log(preview.wouldCreate, preview.wouldUpdate, preview.wouldRegress); // e.g. 3 1 0
 * ```
 */
export async function validate(
  client: OpsHttpClient,
  input: SaveRunInput,
  options?: { _skipClientValidation?: boolean }
): Promise<ValidateRunResponse> {
  if (!options?._skipClientValidation) validateSaveRunInput(input);
  // Forward analysis_* so dry-run reflects the full set of side effects
  // `saveRun` would produce (API v1.4.1+ supports this; older versions
  // safely ignore the extra fields via Zod .strip()).
  return ValidateRunResponseSchema.parse(await client.post<unknown>('/runs/validate', {
    project: input.project,
    workflowType: input.workflowType,
    agents: input.agents,
    recommendations: input.recommendations,
    ...(input.analysisRecords && { analysisRecords: input.analysisRecords }),
    ...(input.analysisSummary && { analysisSummary: input.analysisSummary }),
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

/**
 * Build the shared update payload from an UpdateRunInput.
 *
 * `workflowType` is deliberately NOT sent: both API update schemas omit it
 * (ADR-005 — structural identity is immutable), so sending it was a silent
 * strip-and-200, the same defect class as the `archiveReason` key below.
 */
function buildUpdatePayload(input: UpdateRunInput) {
  return {
    allGatesPassed: input.allGatesPassed,
    averageScore: input.averageScore,
    rawMarkdown: input.rawMarkdown,
    archivedAt: input.archivedAt,
    // Wire key is `archivedReason` (the API's UpdateRunSchema key); the input
    // field stays `archiveReason` to match the Run response field. Sending
    // `archiveReason` was silently stripped by the API (tracker d21e0a57).
    archivedReason: input.archiveReason,
    // 1b (spec §3.2): the load-bearing allow-list entry — type edits alone
    // ship nothing through this hand-written gate (pipeline A1).
    recordWriteMode: input.recordWriteMode,
    agents: input.agents,
    recommendations: input.recommendations,
    analysisRecords: input.analysisRecords,
    analysisSummary: input.analysisSummary,
  };
}

/** The record-write modes this SDK version implements (API 1b). */
const DEFAULT_RECORD_MODE = 'replace';

/**
 * Mirror of the API's ECHO-EMISSION condition — NOT of its full `hasAnalysis`
 * predicate, and the difference is deliberate (anxiety F10 corrected the
 * earlier comment, which vouched for a mirror that 1b broke): as of 1b the
 * API's hasAnalysis carries a third disjunct (`recordWriteMode !== undefined`)
 * that routes exclusively to the mode-without-records 400 — a path that emits
 * an ERROR, never an echo. What this predicate must match is "the server will
 * emit analysisWrite on a 200": entries present, `length > 0` (spec's
 * hasAnalysis minus the 400-only branch). A broader client predicate fires
 * the alarm falsely on healthy servers (`analysisRecords: []`); a narrower
 * one skips the assertion where an echo exists. Cross-boundary predicate,
 * hand-written on both sides; the empty-array boundary is test-pinned.
 */
function isAnalysisBearing(input: UpdateRunInput): boolean {
  const hasRecords = (input.analysisRecords?.length ?? 0) > 0;
  const hasSummaries = input.analysisSummary !== undefined &&
    (!Array.isArray(input.analysisSummary) || input.analysisSummary.length > 0);
  return hasRecords || hasSummaries;
}

/**
 * §3.9 skew alarm. An analysis-bearing update must come back with the
 * server's `analysisWrite` echo, and its `recordMode` must equal the mode
 * this SDK's types document. Absence or mismatch throws
 * {@link AnalysisEchoMismatchError} — the write HAS landed server-side at
 * that point; the alarm is about its semantics, not its delivery. The thrown
 * error carries the updated run and the observed echo so callers can act
 * without re-reading.
 */
function assertAnalysisWriteEcho(
  input: UpdateRunInput,
  envelope: z.infer<typeof UpdateRunEnvelopeSchema>
): void {
  if (!isAnalysisBearing(input)) return;
  // 1b: the expected mode is the mode THIS CALL sent (defaulted). A server
  // that strips the field (pre-1b) echoes 'replace' for a merge send — the
  // mismatch below is exactly the silent-strip skew the assertion exists for.
  const expectedMode = input.recordWriteMode ?? DEFAULT_RECORD_MODE;
  const echo = envelope.analysisWrite;
  if (!echo) {
    throw new AnalysisEchoMismatchError(
      'analysis-bearing update returned no analysisWrite echo — the server predates ' +
      'per-agent replace semantics (update-run spec §3.9); this SDK version cannot ' +
      'verify what the write superseded. The update was applied; the error carries the run.',
      { reason: 'missing-echo', expectedRecordMode: expectedMode, actualRecordMode: null, run: envelope.data, analysisWrite: null }
    );
  }
  if (echo.recordMode !== expectedMode) {
    // Lead with the DATA consequence, not the version story: a merge sent to
    // a server that stripped the mode executed REPLACE — retiring every live
    // record the named agents had that this payload did not restate. Merge
    // callers hold partial sets by selection, so those are exactly the rows
    // they cannot resend (anxiety run F1/F2: the version-skew framing read
    // as an upgrade problem while being a loss notice).
    const consequence = expectedMode === 'merge' && echo.recordMode === 'replace'
      ? `RECORDS MAY HAVE BEEN RETIRED: the server executed replace, so the named agents' live records ` +
        `NOT in this payload were superseded (supersededRecords: ${String(echo.supersededRecords)} vs ` +
        `createdRecords: ${String(echo.createdRecords)}). Superseded rows are invisible to normal reads; ` +
        `the dataset export with include_superseded is the surface that still shows them. `
      : '';
    throw new AnalysisEchoMismatchError(
      consequence +
      `analysisWrite.recordMode '${echo.recordMode}' differs from the '${expectedMode}' this call sent ` +
      '(pre-1b servers STRIP record_write_mode and execute replace). ' +
      'The update was applied under the server\'s mode; the error carries the run and echo. Do not retry.',
      { reason: 'mode-mismatch', expectedRecordMode: expectedMode, actualRecordMode: echo.recordMode, run: envelope.data, analysisWrite: echo }
    );
  }
}

/**
 * The PREVIEW half of the mode guard (anxiety run F8): the write path has
 * assertAnalysisWriteEcho, but the preview is the surface a caller uses to
 * DECIDE whether to write — a server that strips record_write_mode previews
 * replace while the caller plans a merge, and its `would_retire_record_ids`
 * then reports retirements that will not happen (or, worse, its merge answer
 * omits retirements that WILL). Nothing has been written when this throws.
 */
function assertPreviewMode(sentMode: 'replace' | 'merge' | undefined, plan: RunUpdatePreview): void {
  const expected = sentMode ?? DEFAULT_RECORD_MODE;
  if (plan.recordMode !== expected) {
    throw new AnalysisEchoMismatchError(
      `preview recordMode '${plan.recordMode}' differs from the '${expected}' this call sent — ` +
      'the server does not speak this mode (pre-1b servers STRIP record_write_mode), so this preview ' +
      'models the WRONG semantics and must not be used to justify the write. Nothing was written.',
      { reason: 'preview-mode-mismatch', expectedRecordMode: expected, actualRecordMode: plan.recordMode, run: null, analysisWrite: null }
    );
  }
}

/**
 * Guard the raw envelope before Zod field validation, restoring the named
 * format error the default unwrap path threw (`rawEnvelope` skips sdk-core's
 * `isDataEnvelope` check). Without this, a 204/empty body or a non-envelope
 * 2xx JSON body (gateway page, proxy error object) surfaces as an anonymous
 * ZodError listing missing run fields — worst on exactly the path where
 * knowing WHICH half-succeeded call failed matters most.
 */
function parseUpdateEnvelope(body: unknown, endpoint: string): z.infer<typeof UpdateRunEnvelopeSchema> {
  if (body === null || typeof body !== 'object' || !('data' in body)) {
    // Status is 2xx by construction (non-2xx threw in sdk-core before parsing);
    // the raw path does not surface the exact code, so report the family.
    throw new OpsApiError(
      200,
      `Unexpected API response format from PATCH ${endpoint}: expected { data: ... } envelope but received ` +
      (body === null ? 'null' : Array.isArray(body) ? 'array' : typeof body)
    );
  }
  return UpdateRunEnvelopeSchema.parse(body);
}

/**
 * Update run metadata by project and run number. Supports post-hoc
 * enrichment with analysis records and summaries (per-agent scoped replace —
 * see {@link UpdateRunInput}).
 *
 * @param client - HTTP client instance
 * @param input - Update payload with project + runNumber identifier
 * @returns Updated run
 * @throws {InputValidationError} If input fails client-side Zod validation
 * @throws {AnalysisEchoMismatchError} If an analysis-bearing update's response
 *   carries no `analysisWrite` echo or a foreign `recordMode` — the write has
 *   ALREADY been applied when this throws; the error carries the run. Do not retry.
 */
async function updateEnvelope(
  client: OpsHttpClient,
  input: UpdateRunByNumberInput,
  options?: { _skipClientValidation?: boolean }
): Promise<z.infer<typeof UpdateRunEnvelopeSchema>> {
  if (!options?._skipClientValidation) validateUpdateRunInput(input);
  // rawEnvelope: `analysisWrite` is a sibling of `data`; the default unwrap
  // would discard it and with it the §3.9 skew alarm.
  const envelope = parseUpdateEnvelope(await client.request<unknown>(
    'PATCH',
    '/runs/update',
    {
      project: input.project,
      runNumber: input.runNumber,
      ...buildUpdatePayload(input),
    },
    { rawEnvelope: true }
  ), '/runs/update');
  assertAnalysisWriteEcho(input, envelope);
  return envelope;
}

/**
 * Update run metadata by project and run number (per-agent analysis writes —
 * see {@link UpdateRunInput}).
 *
 * NOTE: this method DISCARDS the server's analysis-write echo — the
 * superseded/created counts a caller needs to see what the write actually
 * did. Use {@link updateWithEcho} for success-path visibility.
 *
 * @throws {InputValidationError} If input fails client-side Zod validation
 * @throws {AnalysisEchoMismatchError} On echo absence or mode mismatch — the
 *   write has ALREADY been applied when this throws; the error carries the
 *   run and echo. Do not retry.
 */
export async function update(
  client: OpsHttpClient,
  input: UpdateRunByNumberInput,
  options?: { _skipClientValidation?: boolean }
): Promise<Run> {
  return (await updateEnvelope(client, input, options)).data;
}

/**
 * Update by project + run number, returning the run AND the server's §3.9
 * analysis-write echo (F17): success-path visibility of what the write
 * actually superseded. `analysisWrite` is null on updates that carried no
 * analysis concerns. The echo assertion runs identically to {@link update} —
 * this method changes what SUCCESS returns, not what failure means.
 *
 * @throws {AnalysisEchoMismatchError} Same contract as {@link update}.
 */
export async function updateWithEcho(
  client: OpsHttpClient,
  input: UpdateRunByNumberInput,
  options?: { _skipClientValidation?: boolean }
): Promise<UpdateRunWithEchoResult> {
  const envelope = await updateEnvelope(client, input, options);
  return { run: envelope.data, analysisWrite: envelope.analysisWrite ?? null };
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
 * analysis records, summaries, and exploration maps (per-agent scoped
 * replace — see {@link UpdateRunInput}).
 *
 * @param client - HTTP client instance
 * @param runId - Run UUID
 * @param input - Fields to update (all optional except identifier)
 * @returns Updated run
 * @throws {InputValidationError} If input fails client-side Zod validation
 * @throws {AnalysisEchoMismatchError} If an analysis-bearing update's response
 *   carries no `analysisWrite` echo or a foreign `recordMode` — the write has
 *   ALREADY been applied when this throws; the error carries the run. Do not retry.
 */
async function updateByIdEnvelope(
  client: OpsHttpClient,
  runId: string,
  input: UpdateRunInput,
  options?: { _skipClientValidation?: boolean }
): Promise<z.infer<typeof UpdateRunEnvelopeSchema>> {
  if (!options?._skipClientValidation) validateUpdateRunInput(input);
  // rawEnvelope: see updateEnvelope() — the echo is a sibling of `data`.
  const endpoint = `/runs/${encodeURIComponent(runId)}`;
  const envelope = parseUpdateEnvelope(await client.request<unknown>(
    'PATCH',
    endpoint,
    buildUpdatePayload(input),
    { rawEnvelope: true }
  ), endpoint);
  assertAnalysisWriteEcho(input, envelope);
  return envelope;
}

/**
 * Update run metadata by UUID (per-agent analysis writes). DISCARDS the
 * analysis-write echo — use {@link updateByIdWithEcho} to see it.
 *
 * @throws {InputValidationError} If input fails client-side Zod validation
 * @throws {AnalysisEchoMismatchError} On echo absence or mode mismatch —
 *   thrown AFTER the write landed; carries the run and echo. Do not retry.
 */
export async function updateById(
  client: OpsHttpClient,
  runId: string,
  input: UpdateRunInput,
  options?: { _skipClientValidation?: boolean }
): Promise<Run> {
  return (await updateByIdEnvelope(client, runId, input, options)).data;
}

/** By-id sibling of {@link updateWithEcho} (F17). */
export async function updateByIdWithEcho(
  client: OpsHttpClient,
  runId: string,
  input: UpdateRunInput,
  options?: { _skipClientValidation?: boolean }
): Promise<UpdateRunWithEchoResult> {
  const envelope = await updateByIdEnvelope(client, runId, input, options);
  return { run: envelope.data, analysisWrite: envelope.analysisWrite ?? null };
}

/**
 * Read-only preview of an analysis-bearing update, by project + run number.
 * Returns, per agent named in the payload, what a replace-mode write would
 * supersede, create, and retire-by-omission — without writing anything.
 * Analysis concerns only: any other update field is rejected with a named 400
 * (spec §4 scope rule).
 *
 * @param client - HTTP client instance
 * @param input - project + runNumber plus analysisRecords / analysisSummary
 * @returns The write plan: `{ preview: true, recordMode, byAgent }`
 * @throws {InputValidationError} If input fails client-side Zod validation
 * @throws {NotFoundError} If project or run does not exist
 */
export async function previewUpdate(
  client: OpsHttpClient,
  input: UpdateRunPreviewByNumberInput,
  options?: { _skipClientValidation?: boolean }
): Promise<RunUpdatePreview> {
  if (!options?._skipClientValidation) validateUpdateRunPreviewInput(input);
  const plan = RunUpdatePreviewResponseSchema.parse(await client.post<unknown>('/runs/update-preview', {
    project: input.project,
    runNumber: input.runNumber,
    analysisRecords: input.analysisRecords,
    analysisSummary: input.analysisSummary,
    recordWriteMode: input.recordWriteMode,
  }));
  assertPreviewMode(input.recordWriteMode, plan);
  return plan;
}

/**
 * Read-only preview of an analysis-bearing update, by run UUID.
 * See {@link previewUpdate} for semantics.
 *
 * @param client - HTTP client instance
 * @param runId - Run UUID
 * @param input - analysisRecords / analysisSummary (analysis concerns only)
 * @returns The write plan: `{ preview: true, recordMode, byAgent }`
 * @throws {InputValidationError} If input fails client-side Zod validation
 * @throws {NotFoundError} If run does not exist
 */
export async function previewUpdateById(
  client: OpsHttpClient,
  runId: string,
  input: UpdateRunPreviewInput,
  options?: { _skipClientValidation?: boolean }
): Promise<RunUpdatePreview> {
  if (!options?._skipClientValidation) validateUpdateRunPreviewInput(input);
  const plan = RunUpdatePreviewResponseSchema.parse(await client.post<unknown>(
    `/runs/${encodeURIComponent(runId)}/update-preview`,
    {
      analysisRecords: input.analysisRecords,
      analysisSummary: input.analysisSummary,
      recordWriteMode: input.recordWriteMode,
    }
  ));
  assertPreviewMode(input.recordWriteMode, plan);
  return plan;
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
