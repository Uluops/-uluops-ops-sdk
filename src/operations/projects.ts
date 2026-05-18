import { z } from 'zod';
import type { OpsHttpClient } from '../http/http-client.js';
import { toApiQuery } from '../http/http-client.js';
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  DeleteProjectInput,
  RenameProjectInput,
  ProjectSummaryResponse,
  ProjectTrends,
  ProjectTrendsQuery,
  ListProjectIssuesQuery,
  BulkIssueStatusUpdate,
  BulkIssueStatusResult,
  MergeIssuesInput,
  MergeIssuesResult,
  PaginatedIssues,
} from '../types/projects.js';
import type { Issue } from '../types/issues.js';
import type { DeleteResult } from '../types/responses.js';
import {
  ProjectResponseSchema,
  ProjectSummaryResponseSchema,
  ProjectTrendsResponseSchema,
  IssueResponseSchema,
  BulkStatusUpdateResultResponseSchema,
  MergeIssuesResultResponseSchema,
} from '../types/response-schemas.js';
import {
  validateCreateProjectInput,
  validateDeleteProjectInput,
  validateRenameProjectInput,
} from '../config/validators.js';
import { buildIssueListParams } from './query-utils.js';

/**
 * List all projects accessible to the current user.
 *
 * @param client - HTTP client instance
 * @returns Array of projects with metadata (runCount, issueCount, etc.)
 */
export async function list(client: OpsHttpClient): Promise<Project[]> {
  return client.get('/projects', undefined, { schema: z.array(ProjectResponseSchema) });
}

/**
 * Get a project by UUID or name.
 *
 * @param client - HTTP client instance
 * @param idOrName - Project UUID or name string
 * @returns Project record
 * @throws {NotFoundError} If project does not exist
 */
export async function get(
  client: OpsHttpClient,
  idOrName: string
): Promise<Project> {
  return client.get(`/projects/${encodeURIComponent(idOrName)}`, undefined, { schema: ProjectResponseSchema });
}

/**
 * Create a new project.
 *
 * @param client - HTTP client instance
 * @param input - Project data: `{ name: string }` (1-200 chars, unique)
 * @returns Created project
 * @throws {InputValidationError} If name is empty or exceeds 200 chars
 * @throws {ConflictError} If a project with that name already exists
 */
export async function create(
  client: OpsHttpClient,
  input: CreateProjectInput
): Promise<Project> {
  validateCreateProjectInput(input);
  return client.post('/projects', input, { schema: ProjectResponseSchema });
}

/**
 * Update a project
 */
export async function update(
  client: OpsHttpClient,
  idOrName: string,
  input: UpdateProjectInput
): Promise<Project> {
  return client.patch(`/projects/${encodeURIComponent(idOrName)}`, input, { schema: ProjectResponseSchema });
}

/**
 * Permanently delete a project. Irreversible — use softDelete for recoverable removal.
 *
 * @param client - HTTP client instance
 * @param idOrName - Project UUID or name
 * @param input - Confirmation: `{ confirm: true, confirmationPhrase: string }`
 * @returns `{ deleted: true }`
 * @throws {InputValidationError} If confirm is not `true` or phrase is missing
 */
export async function deleteProject(
  client: OpsHttpClient,
  idOrName: string,
  input: DeleteProjectInput
): Promise<DeleteResult> {
  validateDeleteProjectInput(input);
  await client.delete(`/projects/${encodeURIComponent(idOrName)}`, {
    confirm: input.confirm,
    confirmationPhrase: input.confirmationPhrase,
  });
  return { deleted: true };
}

/**
 * Soft delete a project. Can be restored via `restore()`.
 *
 * @param client - HTTP client instance
 * @param idOrName - Project UUID or name
 * @param input - Confirmation: `{ confirm: true, confirmationPhrase: string }`
 * @returns `{ deleted: true }`
 * @throws {InputValidationError} If confirm is not `true` or phrase is missing
 */
export async function softDelete(
  client: OpsHttpClient,
  idOrName: string,
  input: DeleteProjectInput
): Promise<DeleteResult> {
  validateDeleteProjectInput(input);
  await client.delete(`/projects/${encodeURIComponent(idOrName)}/soft`, {
    confirm: input.confirm,
    confirmationPhrase: input.confirmationPhrase,
  });
  return { deleted: true };
}

/**
 * Restore a soft-deleted project
 */
export async function restore(
  client: OpsHttpClient,
  idOrName: string
): Promise<Project> {
  return client.post(`/projects/${encodeURIComponent(idOrName)}/restore`, undefined, { schema: ProjectResponseSchema });
}

/**
 * Rename a project by name.
 *
 * @param client - HTTP client instance
 * @param input - `{ oldName: string, newName: string }` (newName 1-200 chars)
 * @returns Renamed project
 * @throws {InputValidationError} If names are empty or newName exceeds 200 chars
 */
export async function rename(
  client: OpsHttpClient,
  input: RenameProjectInput
): Promise<Project> {
  validateRenameProjectInput(input);
  return client.post('/projects/rename', {
    oldName: input.oldName,
    newName: input.newName,
  }, { schema: ProjectResponseSchema });
}

/**
 * Get project summary statistics
 */
export async function getSummary(
  client: OpsHttpClient,
  idOrName: string
): Promise<ProjectSummaryResponse> {
  return client.get(`/projects/${encodeURIComponent(idOrName)}/summary`, undefined, { schema: ProjectSummaryResponseSchema });
}

/**
 * Get project trend data over time
 */
export async function getTrends(
  client: OpsHttpClient,
  idOrName: string,
  query?: ProjectTrendsQuery
): Promise<ProjectTrends> {
  return client.get(
    `/projects/${encodeURIComponent(idOrName)}/trends`,
    toApiQuery(query),
    { schema: ProjectTrendsResponseSchema }
  );
}

/**
 * List issues in a project with filtering
 */
export async function listIssues(
  client: OpsHttpClient,
  idOrName: string,
  query?: ListProjectIssuesQuery
): Promise<Issue[]> {
  return client.get(
    `/projects/${encodeURIComponent(idOrName)}/issues`,
    buildIssueListParams(query),
    { schema: z.array(IssueResponseSchema) }
  );
}

/**
 * List issues in a project with count (preserves pagination count from API envelope).
 *
 * Uses `requestRaw` to access the `count` field outside the `data` envelope.
 * Note: `requestRaw` does not include automatic retry or token refresh.
 * For retry-safe access without count, use {@link listIssues}.
 */
export async function listIssuesWithCount(
  client: OpsHttpClient,
  idOrName: string,
  query?: ListProjectIssuesQuery
): Promise<PaginatedIssues> {
  const response = await client.requestRaw<{ data: Issue[]; count: number }>(
    'GET',
    `/projects/${encodeURIComponent(idOrName)}/issues`,
    buildIssueListParams(query) as object | undefined
  );
  if (!response) {
    return { issues: [], count: 0 };
  }
  return { issues: response.data ?? [], count: response.count ?? response.data?.length ?? 0 };
}

/**
 * Bulk update issue statuses within a project. Each item may succeed or fail independently.
 *
 * @param client - HTTP client instance
 * @param idOrName - Project UUID or name
 * @param updates - Array of `{ issueId, status, reason? }`
 * @returns Per-item results with success/failure status
 */
export async function bulkUpdateIssueStatus(
  client: OpsHttpClient,
  idOrName: string,
  updates: BulkIssueStatusUpdate[]
): Promise<BulkIssueStatusResult> {
  return client.patch(
    `/projects/${encodeURIComponent(idOrName)}/issues/status`,
    { updates },
    { schema: BulkStatusUpdateResultResponseSchema }
  );
}

/**
 * Merge duplicate issues into a target issue. Source issues are closed.
 *
 * @param client - HTTP client instance
 * @param idOrName - Project UUID or name
 * @param input - `{ targetIssueId, sourceIssueIds, strategy? }` — strategy: 'keep_target' or 'keep_highest_priority'
 * @returns Merge result with counts
 */
export async function mergeIssues(
  client: OpsHttpClient,
  idOrName: string,
  input: MergeIssuesInput
): Promise<MergeIssuesResult> {
  return client.post(
    `/projects/${encodeURIComponent(idOrName)}/issues/merge`,
    {
      targetIssueId: input.targetIssueId,
      sourceIssueIds: input.sourceIssueIds,
      strategy: input.strategy,
    },
    { schema: MergeIssuesResultResponseSchema }
  );
}
