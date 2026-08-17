/**
 * Shared query parameter builder for issue listing endpoints.
 * Used by both issues.listByProject and projects.listIssues.
 */

import { toApiQuery } from '../http/http-client.js';
import type { QueryParams } from '../http/http-client.js';

interface IssueListQuery {
  status?: string;
  priority?: string;
  severity?: string;
  failureDomain?: string;
  /**
   * Kept in step with `ListProjectIssuesQuery` and `ListIssuesQuery`. Structural
   * assignability means an absent field here still reaches the wire — `toApiQuery`
   * converts whatever the object carries — so omitting it would not have broken a
   * caller, only made this builder's declared contract say the filter does not
   * exist. That is the exact shape of the defect this field was added to fix.
   */
  failureMode?: string;
  agent?: string;
  limit?: number;
  offset?: number;
  includeResolved?: boolean;
  minTimesSeen?: number;
  dateStart?: string;
  dateEnd?: string;
}

/**
 * Build snake_case API query params from an issue-list filter object.
 * Shared by `issues.listByProject` and `projects.listIssues`.
 *
 * @param query - Optional camelCase filters (status, priority, severity, agent,
 *   pagination, date range). Keys are converted to snake_case; `undefined`/empty
 *   inputs yield `undefined` so the caller omits the query string entirely.
 * @returns {@link QueryParams} ready for the request layer, or `undefined` when
 *   no filters are present.
 */
export function buildIssueListParams(query?: IssueListQuery): QueryParams | undefined {
  if (!query) return undefined;
  return toApiQuery(query);
}
