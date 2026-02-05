import type { OpsHttpClient } from '../http/http-client.js';
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  DeleteProjectInput,
  RenameProjectInput,
  ProjectSummary,
  TrendDataPoint,
  ProjectTrendsQuery,
  ListProjectIssuesQuery,
  BulkIssueStatusUpdate,
  BulkIssueStatusResult,
  MergeIssuesInput,
  MergeIssuesResult,
} from '../types/projects.js';
import type { Issue } from '../types/issues.js';
import {
  validateCreateProjectInput,
  validateDeleteProjectInput,
  validateRenameProjectInput,
} from '../config/validators.js';

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
    confirmation_phrase: input.confirmationPhrase,
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
    confirmation_phrase: input.confirmationPhrase,
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
    old_name: input.oldName,
    new_name: input.newName,
  });
}

/**
 * Get project summary statistics
 */
export async function getSummary(
  client: OpsHttpClient,
  idOrName: string
): Promise<ProjectSummary> {
  return client.get<ProjectSummary>(`/projects/${encodeURIComponent(idOrName)}/summary`);
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
    query
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
  const params = query
    ? {
        status: query.status,
        priority: query.priority,
        severity: query.severity,
        failure_domain: query.failureDomain,
        validator: query.validator,
        limit: query.limit,
        offset: query.offset,
        include_resolved: query.includeResolved,
        min_times_seen: query.minTimesSeen,
        date_start: query.dateStart,
        date_end: query.dateEnd,
      }
    : undefined;

  return client.get<Issue[]>(
    `/projects/${encodeURIComponent(idOrName)}/issues`,
    params
  );
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
      target_issue_id: input.targetIssueId,
      source_issue_ids: input.sourceIssueIds,
      strategy: input.strategy,
    }
  );
}
