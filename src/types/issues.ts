import type {
  Priority,
  Status,
  StatusFilter,
  Severity,
  FailureDomain,
  FailureSeverityCode,
  IssueType,
  NoteType,
  ClassificationConfidence,
  ClassifiedBy,
} from './enums.js';

/**
 * Issue entity
 */
export interface Issue {
  id: string;
  projectId: string;
  fingerprint: string;
  title: string;
  status: Status;
  priority: Priority;
  severity: Severity | null;
  failureCode: string | null;
  failureDomain: FailureDomain | null;
  failureMode: string | null;
  failureSeverityCode: FailureSeverityCode | null;
  category: string | null;
  agent: string | null;
  type: IssueType | null;
  filePath: string | null;
  lineNumber: number | null;
  timesSeen: number;
  firstSeenRunId: string;
  lastSeenRunId: string;
  resolvedAt: string | null;
  resolutionRunId: string | null;
  deletedAt?: string | null;  // Stripped by API's issueToPublic
  createdAt: string;
  updatedAt: string;
}

/**
 * Public issue (without deletedAt)
 */
export type PublicIssue = Omit<Issue, 'deletedAt'>;

/**
 * Create user-submitted issue input
 */
export interface CreateUserIssueInput {
  project: string;
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
  agent?: string;
  type?: IssueType;
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
 * Issue occurrence
 */
export interface Occurrence {
  id: string;
  issueId: string;
  runId: string;
  agentName: string;
  description: string | null;
  filePath: string | null;
  lineNumber: number | null;
  classificationConfidence: ClassificationConfidence | null;
  classifiedBy: ClassifiedBy | null;
  createdAt: string;
}

/**
 * Issue note
 */
export interface IssueNote {
  id: string;
  issueId: string;
  content: string;
  noteType: NoteType;
  createdBy: string | null;
  createdAt: string;
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
 * Status history entry
 */
export interface StatusHistory {
  id: string;
  issueId: string;
  oldStatus: Status | null;
  newStatus: Status;
  reason: string | null;
  changedAt: string;
}

/**
 * Full issue details (with related data)
 */
export interface IssueDetails {
  issue: Issue;
  occurrences: Occurrence[];
  notes: IssueNote[];
  history: StatusHistory[];
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

/**
 * Status update result
 */
export interface StatusUpdateResult {
  id: string;
  fingerprint: string;
  previousStatus: Status;
  newStatus: Status;
  updatedAt: string;
}
