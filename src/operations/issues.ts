import type { OpsHttpClient } from '../http/http-client.js';
import type {
  Issue,
  CreateUserIssueInput,
  UpdateIssueInput,
  UpdateIssueStatusInput,
  CreateIssueNoteInput,
  IssueNote,
  StatusHistory,
  IssueDetails,
  IssueSearchQuery,
  ListIssuesQuery,
  BulkStatusUpdateItem,
  StatusUpdateResult,
} from '../types/issues.js';

/**
 * Create a user-submitted issue
 */
export async function create(
  client: OpsHttpClient,
  input: CreateUserIssueInput
): Promise<Issue> {
  return client.post<Issue>('/issues', {
    project: input.project,
    title: input.title,
    priority: input.priority,
    severity: input.severity,
    category: input.category,
    description: input.description,
    file_path: input.filePath,
    line_number: input.lineNumber,
    failure_code: input.failureCode,
    failure_domain: input.failureDomain,
    failure_mode: input.failureMode,
    validator: input.validator,
    type: input.type,
  });
}

/**
 * Search issues across projects
 */
export async function search(
  client: OpsHttpClient,
  query: IssueSearchQuery
): Promise<Issue[]> {
  return client.get<Issue[]>('/issues/search', {
    query: query.query,
    projects: query.projects?.join(','),
    validators: query.validators?.join(','),
    status: query.status,
    priority: query.priority,
    severities: query.severities?.join(','),
    failure_domains: query.failureDomains?.join(','),
    limit: query.limit,
  });
}

/**
 * Get an issue by its fingerprint
 */
export async function getByFingerprint(
  client: OpsHttpClient,
  fingerprint: string,
  project: string
): Promise<Issue> {
  return client.get<Issue>(`/issues/by-fingerprint/${encodeURIComponent(fingerprint)}`, { project });
}

/**
 * Update issue status by fingerprint
 */
export async function updateStatusByFingerprint(
  client: OpsHttpClient,
  fingerprint: string,
  project: string,
  input: UpdateIssueStatusInput
): Promise<StatusUpdateResult> {
  return client.patch<StatusUpdateResult>(
    `/issues/by-fingerprint/${fingerprint}/status`,
    { status: input.status, reason: input.reason },
    { params: { project } }
  );
}

/**
 * Get an issue by ID
 */
export async function get(client: OpsHttpClient, issueId: string): Promise<Issue> {
  return client.get<Issue>(`/issues/${encodeURIComponent(issueId)}`);
}

/**
 * Get full issue details with occurrences, notes, and history
 */
export async function getDetails(
  client: OpsHttpClient,
  issueId: string
): Promise<IssueDetails> {
  return client.get<IssueDetails>(`/issues/${issueId}/details`);
}

/**
 * Get issue status history
 */
export async function getHistory(
  client: OpsHttpClient,
  issueId: string
): Promise<StatusHistory[]> {
  return client.get<StatusHistory[]>(`/issues/${issueId}/history`);
}

/**
 * Update issue status
 */
export async function updateStatus(
  client: OpsHttpClient,
  issueId: string,
  input: UpdateIssueStatusInput
): Promise<Issue> {
  return client.patch<Issue>(`/issues/${issueId}/status`, {
    status: input.status,
    reason: input.reason,
  });
}

/**
 * Edit issue metadata
 */
export async function edit(
  client: OpsHttpClient,
  issueId: string,
  input: UpdateIssueInput
): Promise<Issue> {
  return client.patch<Issue>(`/issues/${encodeURIComponent(issueId)}`, {
    title: input.title,
    status: input.status,
    priority: input.priority,
    severity: input.severity,
    failure_code: input.failureCode,
    failure_domain: input.failureDomain,
    failure_mode: input.failureMode,
    category: input.category,
    type: input.type,
    file_path: input.filePath,
    line_number: input.lineNumber,
  });
}

/**
 * Add a note to an issue
 */
export async function addNote(
  client: OpsHttpClient,
  issueId: string,
  input: CreateIssueNoteInput
): Promise<IssueNote> {
  return client.post<IssueNote>(`/issues/${issueId}/notes`, {
    content: input.content,
    note_type: input.noteType,
    created_by: input.createdBy,
  });
}

/**
 * Restore a deleted issue
 */
export async function restore(
  client: OpsHttpClient,
  issueId: string
): Promise<Issue> {
  return client.post<Issue>(`/issues/${issueId}/restore`);
}

/**
 * Undo the last status change (within 24 hours)
 */
export async function undoLastChange(
  client: OpsHttpClient,
  issueId: string
): Promise<Issue> {
  return client.post<Issue>(`/issues/${issueId}/undo`);
}

/**
 * Bulk update issue statuses
 */
export async function bulkUpdateStatus(
  client: OpsHttpClient,
  updates: BulkStatusUpdateItem[]
): Promise<StatusUpdateResult[]> {
  return client.post<StatusUpdateResult[]>('/issues/bulk-status', {
    updates: updates.map((u) => ({
      issue_id: u.issueId,
      id: u.id,
      status: u.status,
      reason: u.reason,
    })),
  });
}

/**
 * List issues in a project with filtering
 */
export async function listByProject(
  client: OpsHttpClient,
  projectId: string,
  query?: ListIssuesQuery
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
    `/projects/${encodeURIComponent(projectId)}/issues`,
    params
  );
}
