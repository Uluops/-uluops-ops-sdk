import type { Priority, Status, StatusFilter, Severity, FailureDomain } from './enums.js';
import type { Issue } from './issues.js';

/**
 * Project entity
 */
export interface Project {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Public project (without deletedAt)
 */
export type PublicProject = Omit<Project, 'deletedAt'>;

/**
 * Create project input
 */
export interface CreateProjectInput {
  name: string;
}

/**
 * Update project input
 */
export interface UpdateProjectInput {
  name?: string;
}

/**
 * Delete project input (requires confirmation)
 */
export interface DeleteProjectInput {
  confirm: true;
  confirmationPhrase: string;
}

/**
 * Rename project input
 */
export interface RenameProjectInput {
  oldName: string;
  newName: string;
}

/**
 * Project summary statistics returned by the API
 */
export interface ProjectSummaryStats {
  totalIssues: number;
  openIssues: number;
  completedIssues: number;
  deferredIssues: number;
  wontfixIssues: number;
  totalRuns: number;
  lastRunAt: string | null;
  averageScore: number | null;
}

/**
 * Full project summary response (nested structure matching API)
 */
export interface ProjectSummaryResponse {
  project: PublicProject;
  stats: ProjectSummaryStats;
}

/** @deprecated Use ProjectSummaryResponse */
export type ProjectSummary = ProjectSummaryResponse;

/**
 * Single trend data point
 */
export interface TrendDataPoint {
  date: string;
  openIssues: number;
  completedIssues: number;
  newIssues: number;
  resolvedIssues: number;
}

/**
 * Project trends query options
 */
export interface ProjectTrendsQuery {
  days?: number; // 1-365, default 30
}

/**
 * List issues in project query options
 */
export interface ListProjectIssuesQuery {
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
 * Paginated issues response preserving count from API envelope
 */
export interface PaginatedIssues {
  issues: Issue[];
  count: number;
}

/**
 * Bulk issue status update input
 */
export interface BulkIssueStatusUpdate {
  issueId?: string;
  id?: string;
  status: Status;
  reason?: string;
}

/**
 * Bulk issue status update result
 */
export interface BulkIssueStatusResult {
  id: string;
  previousStatus: Status;
  newStatus: Status;
  updatedAt: string;
}

/**
 * Merge issues input
 */
export interface MergeIssuesInput {
  targetIssueId: string;
  sourceIssueIds: string[];
  strategy?: 'keep_target' | 'keep_highest_priority';
}

/**
 * Merge issues result
 */
export interface MergeIssuesResult {
  targetIssueId: string;
  mergedCount: number;
  migratedOccurrences: number;
}
