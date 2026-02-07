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
import {
  validateCreateUserIssueInput,
  validateUpdateIssueInput,
  validateUpdateIssueStatusInput,
  validateCreateIssueNoteInput,
  validateBulkStatusUpdateInput,
} from '../config/validators.js';
import { buildIssueListParams } from './query-utils.js';

/**
 * Create a user-submitted issue
 */
export async function create(
  client: OpsHttpClient,
  input: CreateUserIssueInput
): Promise<Issue> {
  validateCreateUserIssueInput(input);
  return client.post<Issue>('/issues', {
    project: input.project,
    title: input.title,
    priority: input.priority,
    severity: input.severity,
    category: input.category,
    description: input.description,
    filePath: input.filePath,
    lineNumber: input.lineNumber,
    failureCode: input.failureCode,
    failureDomain: input.failureDomain,
    failureMode: input.failureMode,
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
    failureDomains: query.failureDomains?.join(','),
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
    `/issues/by-fingerprint/${encodeURIComponent(fingerprint)}/status`,
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
  return client.get<IssueDetails>(`/issues/${encodeURIComponent(issueId)}/details`);
}

/**
 * Get issue status history
 */
export async function getHistory(
  client: OpsHttpClient,
  issueId: string
): Promise<StatusHistory[]> {
  return client.get<StatusHistory[]>(`/issues/${encodeURIComponent(issueId)}/history`);
}

/**
 * Update issue status
 */
export async function updateStatus(
  client: OpsHttpClient,
  issueId: string,
  input: UpdateIssueStatusInput
): Promise<Issue> {
  validateUpdateIssueStatusInput(input);
  return client.patch<Issue>(`/issues/${encodeURIComponent(issueId)}/status`, {
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
  validateUpdateIssueInput(input);
  return client.patch<Issue>(`/issues/${encodeURIComponent(issueId)}`, {
    title: input.title,
    status: input.status,
    priority: input.priority,
    severity: input.severity,
    failureCode: input.failureCode,
    failureDomain: input.failureDomain,
    failureMode: input.failureMode,
    category: input.category,
    type: input.type,
    filePath: input.filePath,
    lineNumber: input.lineNumber,
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
  validateCreateIssueNoteInput(input);
  return client.post<IssueNote>(`/issues/${encodeURIComponent(issueId)}/notes`, {
    content: input.content,
    noteType: input.noteType,
    createdBy: input.createdBy,
  });
}

/**
 * Restore a deleted issue
 */
export async function restore(
  client: OpsHttpClient,
  issueId: string
): Promise<Issue> {
  return client.post<Issue>(`/issues/${encodeURIComponent(issueId)}/restore`);
}

/**
 * Undo the last status change (within 24 hours)
 */
export async function undoLastChange(
  client: OpsHttpClient,
  issueId: string
): Promise<Issue> {
  return client.post<Issue>(`/issues/${encodeURIComponent(issueId)}/undo`);
}

/**
 * Bulk update issue statuses
 */
export async function bulkUpdateStatus(
  client: OpsHttpClient,
  updates: BulkStatusUpdateItem[]
): Promise<StatusUpdateResult[]> {
  validateBulkStatusUpdateInput({ updates });
  return client.post<StatusUpdateResult[]>('/issues/bulk-status', {
    updates: updates.map((u) => ({
      issueId: u.issueId,
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
  return client.get<Issue[]>(
    `/projects/${encodeURIComponent(projectId)}/issues`,
    buildIssueListParams(query)
  );
}
