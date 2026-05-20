import { z } from 'zod';
import type {
  Priority,
  Status,
  StatusFilter,
  Severity,
  FailureDomain,
  IssueType,
  NoteType,
} from './enums.js';
import {
  IssueResponseSchema,
  IssueDetailsResponseSchema,
  IssueNoteResponseSchema,
  StatusHistoryResponseSchema,
  OccurrenceResponseSchema,
  StatusUpdateResultResponseSchema,
} from './response-schemas.js';

// ───────────────────────────────────────────────��─────────────────
// Response types (derived from Zod schemas — single source of truth)
// ─────────────────────────────────────────────────────────────────

/** Issue entity */
export type Issue = z.infer<typeof IssueResponseSchema>;

/** Issue occurrence */
export type Occurrence = z.infer<typeof OccurrenceResponseSchema>;

/** Issue note */
export type IssueNote = z.infer<typeof IssueNoteResponseSchema>;

/** Status history entry */
export type StatusHistory = z.infer<typeof StatusHistoryResponseSchema>;

/** Full issue details (with related data) */
export type IssueDetails = z.infer<typeof IssueDetailsResponseSchema>;

/** Status update result */
export type StatusUpdateResult = z.infer<typeof StatusUpdateResultResponseSchema>;

/** Public issue (without deletedAt) */
export type PublicIssue = Issue;

// ─────────────────────────────────────────────────────────────────
// Input types (hand-written — not API responses)
// ─────────────────────────────────────────────────────────────────

/**
 * Shared fields between recommendations and user-created issues.
 *
 * A recommendation is an issue-in-transit: it enters via `runs.save()`,
 * the server correlates it against the issue store, and it produces
 * the same `Issue` entity as `issues.create()`. This base captures
 * the shared identity; context-specific fields (project, agent
 * optionality, classification metadata) live on the extending types.
 */
export interface IssueFieldsBase {
  title: string;
  priority: Priority;
  severity?: Severity;
  category?: string;
  description?: string;
  filePath?: string;
  lineNumber?: number;
  failureCode?: string;
  failureDomain?: FailureDomain;
  failureMode?: string;
  type?: IssueType;
}

/**
 * Create user-submitted issue input.
 * Standalone issue — project and agent are specified directly.
 */
export interface CreateUserIssueInput extends IssueFieldsBase {
  project: string;
  agent?: string;
}

/**
 * Update issue input
 */
export interface UpdateIssueInput {
  title?: string;
  status?: Status;
  priority?: Priority;
  severity?: Severity | null;
  failureCode?: string | null;
  failureDomain?: FailureDomain | null;
  failureMode?: string | null;
  category?: string | null;
  type?: IssueType | null;
  filePath?: string | null;
  lineNumber?: number | null;
  lastSeenRunId?: string;
  timesSeen?: number;
  resolvedAt?: string | null;
  resolutionRunId?: string | null;
}

/**
 * Update issue status input
 */
export interface UpdateIssueStatusInput {
  status: Status;
  reason?: string;
}

/**
 * Create issue note input
 */
export interface CreateIssueNoteInput {
  content: string;
  noteType?: NoteType;
  createdBy?: string;
}

/**
 * Issue search query options
 */
export interface IssueSearchQuery {
  query?: string;
  projects?: string[];
  agents?: string[];
  status?: Status | 'all';
  priority?: Priority | 'all';
  severities?: Severity[];
  failureDomains?: FailureDomain[];
  limit?: number;
}

/**
 * List issues query options
 */
export interface ListIssuesQuery {
  status?: StatusFilter;
  priority?: Priority;
  severity?: Severity;
  failureDomain?: FailureDomain;
  agent?: string;
  limit?: number;
  offset?: number;
  includeResolved?: boolean;
  minTimesSeen?: number;
  dateStart?: string;
  dateEnd?: string;
}

/**
 * Bulk status update item
 */
export interface BulkStatusUpdateItem {
  issueId?: string;
  id?: string;
  status: Status;
  reason?: string;
}
