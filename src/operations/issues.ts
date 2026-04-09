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
import {
  IssueResponseSchema,
  IssueDetailsResponseSchema,
  IssueNoteResponseSchema,
  StatusHistoryResponseSchema,
  StatusUpdateResultResponseSchema,
  BulkStatusUpdateResultResponseSchema,
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
 * Create a user-submitted issue
 */
export async function create(
  client: OpsHttpClient,
  input: CreateUserIssueInput
): Promise<Issue> {
  validateCreateUserIssueInput(input);
  return client.post('/issues', {
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
  }, { schema: IssueResponseSchema });
}

/**
 * Search issues across projects
 */
export async function search(
  client: OpsHttpClient,
  query: IssueSearchQuery
): Promise<Issue[]> {
  return client.get('/issues/search', toApiQuery(query), { schema: z.array(IssueResponseSchema) });
}

/**
 * Get an issue by its fingerprint
 */
export async function getByFingerprint(
  client: OpsHttpClient,
  fingerprint: string,
  project: string
): Promise<Issue> {
  return client.get(`/issues/by-fingerprint/${encodeURIComponent(fingerprint)}`, { project }, { schema: IssueResponseSchema });
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
  return client.patch(
    `/issues/by-fingerprint/${encodeURIComponent(fingerprint)}/status`,
    { status: input.status, reason: input.reason },
    { params: { project }, schema: StatusUpdateResultResponseSchema }
  );
}

/**
 * Get an issue by ID
 */
export async function get(client: OpsHttpClient, issueId: string): Promise<Issue> {
  return client.get(`/issues/${encodeURIComponent(issueId)}`, undefined, { schema: IssueResponseSchema });
}

/**
 * Get full issue details with occurrences, notes, and history
 */
export async function getDetails(
  client: OpsHttpClient,
  issueId: string
): Promise<IssueDetails> {
  return client.get(`/issues/${encodeURIComponent(issueId)}/details`, undefined, { schema: IssueDetailsResponseSchema });
}

/**
 * Get issue status history
 */
export async function getHistory(
  client: OpsHttpClient,
  issueId: string
): Promise<z.infer<typeof StatusHistoryResponseSchema>[]> {
  return client.get(`/issues/${encodeURIComponent(issueId)}/history`, undefined, { schema: z.array(StatusHistoryResponseSchema) });
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
  return client.patch(`/issues/${encodeURIComponent(issueId)}/status`, {
    status: input.status,
    reason: input.reason,
  }, { schema: IssueResponseSchema });
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
  return client.patch(`/issues/${encodeURIComponent(issueId)}`, {
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
  }, { schema: IssueResponseSchema });
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
  return client.post(`/issues/${encodeURIComponent(issueId)}/notes`, {
    content: input.content,
    noteType: input.noteType,
    createdBy: input.createdBy,
  }, { schema: IssueNoteResponseSchema });
}

/**
 * Restore a deleted issue
 */
export async function restore(
  client: OpsHttpClient,
  issueId: string
): Promise<Issue> {
  return client.post(`/issues/${encodeURIComponent(issueId)}/restore`, undefined, { schema: IssueResponseSchema });
}

/**
 * Undo the last status change (within 24 hours)
 */
export async function undoLastChange(
  client: OpsHttpClient,
  issueId: string
): Promise<Issue> {
  return client.post(`/issues/${encodeURIComponent(issueId)}/undo`, undefined, { schema: IssueResponseSchema });
}

/**
 * Bulk update issue statuses
 */
export async function bulkUpdateStatus(
  client: OpsHttpClient,
  updates: BulkStatusUpdateItem[]
): Promise<z.infer<typeof BulkStatusUpdateResultResponseSchema>> {
  validateBulkStatusUpdateInput({ updates });
  return client.post('/issues/bulk-status', {
    updates: updates.map((u) => ({
      issueId: u.issueId,
      id: u.id,
      status: u.status,
      reason: u.reason,
    })),
  }, { schema: BulkStatusUpdateResultResponseSchema });
}

/**
 * List issues in a project with filtering
 */
export async function listByProject(
  client: OpsHttpClient,
  projectId: string,
  query?: ListIssuesQuery
): Promise<Issue[]> {
  return client.get(
    `/projects/${encodeURIComponent(projectId)}/issues`,
    buildIssueListParams(query),
    { schema: z.array(IssueResponseSchema) }
  );
}
