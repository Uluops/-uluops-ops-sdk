import { z } from 'zod';
import type { OpsHttpClient } from '../http/http-client.js';
import type {
  Issue,
  CreateUserIssueInput,
  UpdateIssueInput,
  UpdateIssueStatusInput,
  CreateIssueNoteInput,
  IssueNote,
  IssueDetails,
  IssueSearchQuery,
  ListIssuesQuery,
  BulkStatusUpdateItem,
  StatusUpdateResult,
} from '../types/issues.js';
import type { DeleteResult } from '../types/responses.js';
import {
  IssueResponseSchema,
  IssueDetailsResponseSchema,
  IssueNoteResponseSchema,
  StatusHistoryResponseSchema,
  StatusUpdateResultResponseSchema,
  BulkStatusUpdateResultResponseSchema,
  DeleteResultResponseSchema,
} from '../types/response-schemas.js';
import {
  validateCreateUserIssueInput,
  validateUpdateIssueInput,
  validateUpdateIssueStatusInput,
  validateCreateIssueNoteInput,
  validateBulkStatusUpdateInput,
} from '../config/validators.js';
import { toApiQuery } from '../http/http-client.js';
import { buildIssueListParams } from './query-utils.js';

/**
 * Create a user-submitted issue in a project.
 *
 * @param client - HTTP client instance
 * @param input - Issue data with required project, title, priority
 * @returns Created issue with generated fingerprint and UUID
 * @throws {InputValidationError} If input fails client-side Zod validation
 */
export async function create(
  client: OpsHttpClient,
  input: CreateUserIssueInput
): Promise<Issue> {
  validateCreateUserIssueInput(input);
  return IssueResponseSchema.parse(await client.post<unknown>('/issues', {
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
    agent: input.agent,
    type: input.type,
  }));
}

/**
 * Search issues across projects with full-text query and filters.
 *
 * @param client - HTTP client instance
 * @param query - Search parameters: query string, projects, agents, status, priority, severities, failureDomains
 * @returns Array of matching issues
 */
export async function search(
  client: OpsHttpClient,
  query: IssueSearchQuery
): Promise<Issue[]> {
  return (z.array(IssueResponseSchema)).parse(await client.get<unknown>('/issues/search', toApiQuery(query)));
}

/**
 * Get an issue by its SHA-256 fingerprint hash.
 *
 * @param client - HTTP client instance
 * @param fingerprint - Issue fingerprint (SHA-256 hash)
 * @param project - Project name or ID
 * @returns Issue matching the fingerprint
 * @throws {NotFoundError} If no issue matches the fingerprint in the project
 */
export async function getByFingerprint(
  client: OpsHttpClient,
  fingerprint: string,
  project: string
): Promise<Issue> {
  return IssueResponseSchema.parse(await client.get<unknown>(`/issues/by-fingerprint/${encodeURIComponent(fingerprint)}`, { project }));
}

/**
 * Update an issue's status using its fingerprint hash.
 *
 * @param client - HTTP client instance
 * @param fingerprint - Issue fingerprint (SHA-256 hash)
 * @param project - Project name or ID
 * @param input - Status update with new status and optional reason
 * @returns Status update result with previous and new status
 */
export async function updateStatusByFingerprint(
  client: OpsHttpClient,
  fingerprint: string,
  project: string,
  input: UpdateIssueStatusInput
): Promise<StatusUpdateResult> {
  return StatusUpdateResultResponseSchema.parse(await client.patch<unknown>(
    `/issues/by-fingerprint/${encodeURIComponent(fingerprint)}/status`,
    { status: input.status, reason: input.reason },
    { params: { project } }
  ));
}

/**
 * Get an issue by its UUID.
 *
 * @param client - HTTP client instance
 * @param issueId - Issue UUID
 * @returns Issue record
 * @throws {NotFoundError} If issue does not exist
 */
export async function get(client: OpsHttpClient, issueId: string): Promise<Issue> {
  return IssueResponseSchema.parse(await client.get<unknown>(`/issues/${encodeURIComponent(issueId)}`, undefined));
}

/**
 * Get full issue details including occurrences, notes, and status history.
 *
 * @param client - HTTP client instance
 * @param issueId - Issue UUID
 * @returns Issue details with nested occurrences, notes, and history arrays
 */
export async function getDetails(
  client: OpsHttpClient,
  issueId: string
): Promise<IssueDetails> {
  return IssueDetailsResponseSchema.parse(await client.get<unknown>(`/issues/${encodeURIComponent(issueId)}/details`, undefined));
}

/**
 * Get status change history for an issue. Each entry has oldStatus, newStatus,
 * reason, and changedAt timestamp.
 *
 * @param client - HTTP client instance
 * @param issueId - Issue UUID
 * @returns Array of status history entries (newest first)
 */
export async function getHistory(
  client: OpsHttpClient,
  issueId: string
): Promise<z.infer<typeof StatusHistoryResponseSchema>[]> {
  return (z.array(StatusHistoryResponseSchema)).parse(await client.get<unknown>(`/issues/${encodeURIComponent(issueId)}/history`, undefined));
}

/**
 * Update an issue's status with optional reason.
 *
 * @param client - HTTP client instance
 * @param issueId - Issue UUID
 * @param input - New status and optional reason
 * @returns Updated issue
 * @throws {InputValidationError} If status is not a valid enum value
 */
export async function updateStatus(
  client: OpsHttpClient,
  issueId: string,
  input: UpdateIssueStatusInput
): Promise<Issue> {
  validateUpdateIssueStatusInput(input);
  return IssueResponseSchema.parse(await client.patch<unknown>(`/issues/${encodeURIComponent(issueId)}/status`, {
    status: input.status,
    reason: input.reason,
  }));
}

/**
 * Update issue metadata (title, severity, file path, failure code, etc.).
 *
 * @param client - HTTP client instance
 * @param issueId - Issue UUID
 * @param input - Fields to update (all optional)
 * @returns Updated issue
 * @throws {InputValidationError} If any provided field violates constraints
 */
export async function update(
  client: OpsHttpClient,
  issueId: string,
  input: UpdateIssueInput
): Promise<Issue> {
  validateUpdateIssueInput(input);
  return IssueResponseSchema.parse(await client.patch<unknown>(`/issues/${encodeURIComponent(issueId)}`, {
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
  }));
}

/**
 * Add a note to an issue (context, resolution, or blocker).
 *
 * @param client - HTTP client instance
 * @param issueId - Issue UUID
 * @param input - Note content (1-10000 chars), optional noteType and createdBy
 * @returns Created note
 * @throws {InputValidationError} If content is empty or exceeds limits
 */
export async function addNote(
  client: OpsHttpClient,
  issueId: string,
  input: CreateIssueNoteInput
): Promise<IssueNote> {
  validateCreateIssueNoteInput(input);
  return IssueNoteResponseSchema.parse(await client.post<unknown>(`/issues/${encodeURIComponent(issueId)}/notes`, {
    content: input.content,
    noteType: input.noteType,
    createdBy: input.createdBy,
  }));
}

/**
 * Restore a soft-deleted issue.
 *
 * @param client - HTTP client instance
 * @param issueId - Issue UUID
 * @returns Restored issue
 */
export async function restore(
  client: OpsHttpClient,
  issueId: string
): Promise<Issue> {
  return IssueResponseSchema.parse(await client.post<unknown>(`/issues/${encodeURIComponent(issueId)}/restore`, undefined));
}

/**
 * Soft-delete an active issue. Reversible via `restore()`.
 *
 * @param client - HTTP client instance
 * @param issueId - Issue UUID
 * @returns `{ deleted: true }`
 */
export async function softDelete(
  client: OpsHttpClient,
  issueId: string
): Promise<DeleteResult> {
  // API returns 204 No Content on success; sdk-core's HttpClient returns
  // undefined for 204. Synthesize the documented `{deleted: true}` shape.
  // Mirrors the project softDelete handling.
  const response = await client.delete<unknown>(`/issues/${encodeURIComponent(issueId)}/soft`);
  return response === undefined ? { deleted: true } : DeleteResultResponseSchema.parse(response);
}

/**
 * Undo the last status change on an issue. Must be within 24 hours.
 *
 * @param client - HTTP client instance
 * @param issueId - Issue UUID
 * @returns Issue with previous status restored
 */
export async function undoLastChange(
  client: OpsHttpClient,
  issueId: string
): Promise<Issue> {
  return IssueResponseSchema.parse(await client.post<unknown>(`/issues/${encodeURIComponent(issueId)}/undo`, undefined));
}

/**
 * Bulk update issue statuses. Max 100 items per request. Each item may
 * succeed or fail independently — check per-item results.
 *
 * @param client - HTTP client instance
 * @param updates - Array of `{ issueId, status, reason? }` (1-100 items)
 * @returns Per-item results with success/failure status
 * @throws {InputValidationError} If updates array is empty or exceeds 100 items
 */
export async function bulkUpdateStatus(
  client: OpsHttpClient,
  updates: BulkStatusUpdateItem[]
): Promise<z.infer<typeof BulkStatusUpdateResultResponseSchema>> {
  validateBulkStatusUpdateInput({ updates });
  return BulkStatusUpdateResultResponseSchema.parse(await client.post<unknown>('/issues/bulk-status', {
    updates: updates.map((u) => ({
      issueId: u.issueId,
      id: u.id,
      status: u.status,
      reason: u.reason,
    })),
  }));
}

/**
 * List issues for a project with optional filters.
 *
 * @param client - HTTP client instance
 * @param projectId - Project ID or name
 * @param query - Optional filters: status, priority, severity, agent, limit, offset
 * @returns Array of issues
 */
export async function listByProject(
  client: OpsHttpClient,
  projectId: string,
  query?: ListIssuesQuery
): Promise<Issue[]> {
  return (z.array(IssueResponseSchema)).parse(await client.get<unknown>(
    `/projects/${encodeURIComponent(projectId)}/issues`,
    buildIssueListParams(query)
  ));
}
