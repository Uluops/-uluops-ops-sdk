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
  validator?: string;
  limit?: number;
  offset?: number;
  includeResolved?: boolean;
  minTimesSeen?: number;
  dateStart?: string;
  dateEnd?: string;
}

export function buildIssueListParams(query?: IssueListQuery): QueryParams | undefined {
  if (!query) return undefined;
  return toApiQuery(query);
}
