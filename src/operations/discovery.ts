import { z } from 'zod';
import type { OpsHttpClient, QueryParams } from '../http/http-client.js';
import { OpsApiError, UnsupportedContractError } from '../errors/errors.js';
import {
  ProjectResponseSchema, IssueResponseSchema, RunSummaryResponseSchema,
  AnalysisRecordResponseSchema, AnalysisSummaryResponseSchema, AgentRunSummaryResponseSchema,
} from '../types/response-schemas.js';
import type { ListProjectIssuesQuery } from '../types/projects.js';
import type { IssueSearchQuery } from '../types/issues.js';
import type { ListRunsQuery, AnalysisRecordsQuery, ProjectAnalysisQuery, AgentRunsAnalysisQuery } from '../types/runs.js';

/** Offset pages describe a fixed filtered dataset; concurrent writes are not snapshot-isolated. */
export interface DiscoveryPage<T> {
  data: (Partial<T> & { id: string })[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Output field names are camelCase. Identity is always retained. */
export interface DiscoveryQuery {
  limit?: number;
  offset?: number;
  fields?: string[];
}
export interface ProjectDiscoveryQuery extends DiscoveryQuery {
  search?: string;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
export type IssueDiscoveryQuery = DiscoveryQuery & ListProjectIssuesQuery & {
  sortBy?: 'createdAt' | 'priority'; sortOrder?: 'asc' | 'desc';
};
export type IssueSearchPageQuery = DiscoveryQuery & IssueSearchQuery & {
  sortBy?: 'createdAt' | 'priority'; sortOrder?: 'asc' | 'desc';
};
export type RunDiscoveryQuery = DiscoveryQuery & ListRunsQuery & {
  includeArchived?: boolean; sortBy?: 'runNumber'; sortOrder?: 'asc' | 'desc';
};
export type AnalysisDiscoveryQuery = DiscoveryQuery & AnalysisRecordsQuery & { project?: string; runId?: string };

/** Negotiate on the scoped client for each operation; never cache across orgs or credentials. */
async function requireDiscovery(client: OpsHttpClient): Promise<void> {
  let body: unknown;
  try {
    body = await client.request<unknown>('GET', '/capabilities', undefined, { rawEnvelope: true });
  } catch (error) {
    if (!(error instanceof OpsApiError) || error.statusCode !== 404 || (error.code && error.code !== 'NOT_FOUND')) throw error;
    throw new UnsupportedContractError('discovery', 'page-v1');
  }
  const parsed = z.object({ contracts: z.object({ discovery: z.array(z.string()) }) }).safeParse(body);
  if (!parsed.success || !parsed.data.contracts.discovery.includes('page-v1')) {
    throw new UnsupportedContractError('discovery', 'page-v1');
  }
}

/** Discovery endpoints explicitly accept camelCase query keys, including showArchived. */
async function page<S extends z.ZodRawShape>(
  client: OpsHttpClient, path: string, schema: z.ZodObject<S>, query: DiscoveryQuery & object,
): Promise<DiscoveryPage<z.infer<typeof schema>>> {
  z.object({ limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional() }).parse(query);
  const shape: { -readonly [K in keyof z.ZodRawShape]: z.ZodRawShape[K] } = { id: z.string().uuid() };
  if (query.fields) {
    for (const key of query.fields) {
      if (!Object.hasOwn(schema.shape, key)) throw new z.ZodError([{ code: 'custom', path: ['fields'], message: `Unknown or unauthorized field: ${key}` }]);
      shape[key] = schema.shape[key]!;
    }
  }
  const rowSchema = query.fields ? z.object(shape) : schema;
  await requireDiscovery(client);
  const params: QueryParams = { format: 'page' };
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params[key === 'includeArchived' ? 'showArchived' : key] = Array.isArray(value) ? value.join(',') : value;
  }
  const result = z.object({
    data: z.array(rowSchema), total: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(100), offset: z.number().int().nonnegative(), hasMore: z.boolean(),
  }).parse(await client.request<unknown>('GET', path, params, { rawEnvelope: true }));
  if (result.hasMore !== (result.offset + result.data.length < result.total)) {
    throw new z.ZodError([{ code: 'custom', path: ['hasMore'], message: 'Inconsistent discovery page metadata' }]);
  }
  return result as DiscoveryPage<z.infer<typeof schema>>;
}

export const listProjects = (client: OpsHttpClient, query: ProjectDiscoveryQuery = {}) => page(client, '/projects', ProjectResponseSchema, query);
export const queryIssues = (client: OpsHttpClient, project: string, query: IssueDiscoveryQuery = {}) => page(client, `/projects/${encodeURIComponent(project)}/issues`, IssueResponseSchema.omit({ deletedAt: true }), query);
export const searchIssues = (client: OpsHttpClient, query: IssueSearchPageQuery) => page(client, '/issues/search', IssueResponseSchema.omit({ deletedAt: true }), query);
export const listRuns = (client: OpsHttpClient, project: string, query: RunDiscoveryQuery = {}) => page(client, `/runs/project/${encodeURIComponent(project)}`, RunSummaryResponseSchema.omit({ rawMarkdown: true, idempotencyKey: true, updatedAt: true, mergedFromProjectId: true, mergedFromRunNumber: true }), query);
export const queryAnalysisRecords = (client: OpsHttpClient, query: AnalysisDiscoveryQuery = {}) => page(client, '/analysis/records', AnalysisRecordResponseSchema, query);
export const getProjectAnalysis = (client: OpsHttpClient, project: string, query: DiscoveryQuery & ProjectAnalysisQuery = {}) => page(client, `/projects/${encodeURIComponent(project)}/analysis`, AnalysisSummaryResponseSchema, query);
export const getAgentRunsAnalysis = (client: OpsHttpClient, agent: string, query: DiscoveryQuery & AgentRunsAnalysisQuery) => page(client, `/agents/${encodeURIComponent(agent)}/runs-analysis`, AgentRunSummaryResponseSchema, query);
