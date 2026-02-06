/**
 * Shared query parameter builder for issue listing endpoints.
 * Used by both issues.listByProject and projects.listIssues.
 */

interface IssueListQuery {
  status?: string;
  priority?: string;
  severity?: string;
  failureDomain?: string;
  validator?: string;
  limit?: number;
  offset?: number;
  includeResolved?: boolean;
  minTimesSeen?: number;
  dateStart?: string;
  dateEnd?: string;
}

export function buildIssueListParams(query?: IssueListQuery): Record<string, string | number | boolean | undefined> | undefined {
  if (!query) return undefined;

  return {
    status: query.status,
    priority: query.priority,
    severity: query.severity,
    failureDomain: query.failureDomain,
    validator: query.validator,
    limit: query.limit,
    offset: query.offset,
    includeResolved: query.includeResolved,
    minTimesSeen: query.minTimesSeen,
    dateStart: query.dateStart,
    dateEnd: query.dateEnd,
  };
}
