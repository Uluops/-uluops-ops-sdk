import type { OpsHttpClient } from '../http/http-client.js';
import { toQuery } from '../http/http-client.js';
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  DeleteProjectInput,
  RenameProjectInput,
  ProjectSummaryResponse,
  TrendDataPoint,
  ProjectTrendsQuery,
  ListProjectIssuesQuery,
  BulkIssueStatusUpdate,
  BulkIssueStatusResult,
  MergeIssuesInput,
  MergeIssuesResult,
  PaginatedIssues,
} from '../types/projects.js';
import type { Issue } from '../types/issues.js';
import {
  validateCreateProjectInput,
  validateDeleteProjectInput,
  validateRenameProjectInput,
} from '../config/validators.js';
import { buildIssueListParams } from './query-utils.js';

/**
 * List all projects for the current user
 */
export async function list(client: OpsHttpClient): Promise<Project[]> {
  return client.get<Project[]>('/projects');
}

/**
 * Get a single project by ID or name
 */
export async function get(
  client: OpsHttpClient,
  idOrName: string
): Promise<Project> {
  return client.get<Project>(`/projects/${encodeURIComponent(idOrName)}`);
}

/**
 * Create a new project
 */
export async function create(
  client: OpsHttpClient,
  input: CreateProjectInput
): Promise<Project> {
  validateCreateProjectInput(input);
  return client.post<Project>('/projects', input);
}

/**
 * Update a project
 */
export async function update(
  client: OpsHttpClient,
  idOrName: string,
  input: UpdateProjectInput
): Promise<Project> {
  return client.patch<Project>(`/projects/${encodeURIComponent(idOrName)}`, input);
}

/**
 * Hard delete a project (requires confirmation)
 */
export async function deleteProject(
  client: OpsHttpClient,
  idOrName: string,
  input: DeleteProjectInput
): Promise<void> {
  validateDeleteProjectInput(input);
  await client.delete(`/projects/${encodeURIComponent(idOrName)}`, {
    confirm: input.confirm,
    confirmationPhrase: input.confirmationPhrase,
  });
}

/**
 * Soft delete a project (can be restored)
 */
export async function softDelete(
  client: OpsHttpClient,
  idOrName: string,
  input: DeleteProjectInput
): Promise<void> {
  validateDeleteProjectInput(input);
  await client.delete(`/projects/${encodeURIComponent(idOrName)}/soft`, {
    confirm: input.confirm,
    confirmationPhrase: input.confirmationPhrase,
  });
}

/**
 * Restore a soft-deleted project
 */
export async function restore(
  client: OpsHttpClient,
  idOrName: string
): Promise<Project> {
  return client.post<Project>(`/projects/${encodeURIComponent(idOrName)}/restore`);
}

/**
 * Rename a project by name
 */
export async function rename(
  client: OpsHttpClient,
  input: RenameProjectInput
): Promise<Project> {
  validateRenameProjectInput(input);
  return client.post<Project>('/projects/rename', {
    oldName: input.oldName,
    newName: input.newName,
  });
}

/**
 * Get project summary statistics
 */
export async function getSummary(
  client: OpsHttpClient,
  idOrName: string
): Promise<ProjectSummaryResponse> {
  return client.get<ProjectSummaryResponse>(`/projects/${encodeURIComponent(idOrName)}/summary`);
}

/**
 * Get project trend data over time
 */
export async function getTrends(
  client: OpsHttpClient,
  idOrName: string,
  query?: ProjectTrendsQuery
): Promise<TrendDataPoint[]> {
  return client.get<TrendDataPoint[]>(
    `/projects/${encodeURIComponent(idOrName)}/trends`,
    toQuery(query)
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
  return client.get<Issue[]>(
    `/projects/${encodeURIComponent(idOrName)}/issues`,
    buildIssueListParams(query)
  );
}

/**
 * List issues in a project with count (preserves pagination count from API envelope)
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
  return { issues: response.data, count: response.count ?? response.data.length };
}

/**
 * Bulk update issue statuses in a project
 */
export async function bulkUpdateIssueStatus(
  client: OpsHttpClient,
  idOrName: string,
  updates: BulkIssueStatusUpdate[]
): Promise<BulkIssueStatusResult[]> {
  return client.patch<BulkIssueStatusResult[]>(
    `/projects/${encodeURIComponent(idOrName)}/issues/status`,
    { updates }
  );
}

/**
 * Merge multiple issues into one
 */
export async function mergeIssues(
  client: OpsHttpClient,
  idOrName: string,
  input: MergeIssuesInput
): Promise<MergeIssuesResult> {
  return client.post<MergeIssuesResult>(
    `/projects/${encodeURIComponent(idOrName)}/issues/merge`,
    {
      targetIssueId: input.targetIssueId,
      sourceIssueIds: input.sourceIssueIds,
      strategy: input.strategy,
    }
  );
}
