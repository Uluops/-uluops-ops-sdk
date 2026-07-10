import { z } from 'zod';
import type { Priority, Status, StatusFilter, Severity, FailureDomain } from './enums.js';
import {
  ProjectResponseSchema,
  ProjectSummaryResponseSchema,
  ProjectSummaryStatsResponseSchema,
  ProjectTrendsResponseSchema,
  DailyIssueCountsResponseSchema,
  TrendsSummaryResponseSchema,
  MergeIssuesResultResponseSchema,
  MergeProjectsResultResponseSchema,
  BulkStatusUpdateResultResponseSchema,
} from './response-schemas.js';
import type { Issue } from './issues.js';

// ─────────────────────────────────────────────────────────────────
// Response types (derived from Zod schemas — single source of truth)
// ─────────────────────────────────────────────────────────────────

/** Project entity */
export type Project = z.infer<typeof ProjectResponseSchema>;

/** Project summary statistics */
export type ProjectSummaryStats = z.infer<typeof ProjectSummaryStatsResponseSchema>;

/** Full project summary response (nested structure matching API) */
export type ProjectSummaryResponse = z.infer<typeof ProjectSummaryResponseSchema>;

/** Daily issue counts for trend data */
export type DailyIssueCounts = z.infer<typeof DailyIssueCountsResponseSchema>;

/** Trend summary statistics */
export type TrendsSummary = z.infer<typeof TrendsSummaryResponseSchema>;

/** Full project trends response */
export type ProjectTrends = z.infer<typeof ProjectTrendsResponseSchema>;

/** Merge issues result */
export type MergeIssuesResult = z.infer<typeof MergeIssuesResultResponseSchema>;

/** Merge projects result (merge-projects spec v0.3.4 §5 — snake_case by contract) */
export type MergeProjectsResult = z.infer<typeof MergeProjectsResultResponseSchema>;

/** Bulk issue status update result */
export type BulkIssueStatusResult = z.infer<typeof BulkStatusUpdateResultResponseSchema>;

// ─────────────────────────────────────────────────────────────────
// Input types (hand-written — not API responses)
// ──────────────────────────────────────────────────��──────────────

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
 * Merge issues input
 */
export interface MergeIssuesInput {
  targetIssueId: string;
  sourceIssueIds: string[];
  strategy?: 'keep_target' | 'keep_highest_priority';
}

/**
 * Merge projects input (merge-projects spec v0.3.4). Pairwise by contract —
 * multi-source merges are out of scope; chain pairwise calls instead.
 */
export interface MergeProjectsInput {
  /** Source project name or UUID (consumed by the merge) */
  source: string;
  /** Target project name or UUID (survives, absorbs the source) */
  target: string;
  /** Preview only — the merge transaction is rolled back. Default false. */
  dryRun?: boolean;
  /** Soft-delete the source after the merge. Default true. */
  deleteSource?: boolean;
  /**
   * Required true for system-actor cross-org merges (Q15). No-op for human
   * callers — human cross-org merges are always rejected with CROSS_ORG_MERGE.
   */
  confirmCrossOrg?: boolean;
}
