import type { OpsHttpClient } from '../http/http-client.js';
import type { OrgAuditFeed, OrgAuditFeedQuery } from '../types/rehome.js';
import { OrgAuditFeedResponseSchema } from '../types/rehome.js';
import { OrgListResponseSchema, OrgLogStatSchema, type LogStatQuery, type OrgListEntry, type OrgLogStat } from '../types/log.js';
import { logStatQueryParams } from './projects.js';

/**
 * The org-visible audit feed (project-org-routing-and-rehome spec D19) —
 * `GET /orgs/:slug/audit-log/global`. Any MEMBER of the org may read it; the
 * full audit log stays admin+ and is not wrapped here.
 *
 * What lands in it: rows whose writer marked `details.visibility = 'org'`.
 * Today that is one class — a project leaving this org for someone's personal
 * org (an org admin may do that, and the org's owner could not see it before
 * D19). The re-home writer's `details` shape is `RehomeAuditDetails`; use
 * `readRehomeAuditDetails(entry)` to narrow, and print anything else raw.
 *
 * Paging: keyset `(createdAt, id)` on `@uluops/platform` ≥ 1.28.4 — `nextCursor`
 * is `<iso>|<uuid>`, opaque to callers; pass it back verbatim. `count` is the
 * page size, not the total (the platform reader has no count).
 *
 * The slug in the PATH is the org; a client-level `orgSlug` header does not
 * redirect this read (`orgContext` resolves `:slug` first).
 *
 * @param client - HTTP client instance
 * @param slug - Org slug (the org whose feed to read — you must be a member)
 * @param query - `{ cursor?, limit? }`; `limit` is 1–100 and the API answers 400 outside that range (it does not clamp)
 * @returns `{ data: { entries }, count, hasMore, nextCursor }`
 */
export async function getVisibleAuditLog(
  client: OpsHttpClient,
  slug: string,
  query: OrgAuditFeedQuery = {}
): Promise<OrgAuditFeed> {
  const params: Record<string, string> = {};
  if (query.cursor !== undefined) params['cursor'] = query.cursor;
  if (query.limit !== undefined) params['limit'] = String(query.limit);
  // On GET the third argument IS the query (sdk-core `buildRequestUrl`).
  return OrgAuditFeedResponseSchema.parse(await client.request<unknown>(
    'GET',
    `/orgs/${encodeURIComponent(slug)}/audit-log/global`,
    params,
    { rawEnvelope: true },
  ));
}

/**
 * The orgs the caller belongs to — `GET /orgs`. Personal org included
 * (`isPersonal: true`). What `ulu log --orgs` iterates (spec §3.6, OQ1: API
 * keys reach this). A key bound to one org still lists every org its holder
 * belongs to; the binding governs what it may READ, not what it may see listed.
 */
export async function list(client: OpsHttpClient): Promise<OrgListEntry[]> {
  return OrgListResponseSchema.parse(await client.get<unknown>('/orgs')).organizations;
}

/**
 * The org rollup — `GET /orgs/:slug/log/stat` (spec §3.6 D6/D15/D16): the
 * §3.3 body over the org's live projects plus `projects[]` (the summary shape,
 * last run desc, capped at 100 with `hasMoreProjects`). Any member can read
 * it. Served from a 60 s TTL cache per (org, window) — `computedAt` says how
 * old the numbers are. Unknown slug → 404 `ORG_NOT_FOUND`; a key bound to
 * another org → 403 `ORG_ACCESS_DENIED`. The slug in the PATH is the org; a
 * client-level `orgSlug` does not redirect this read.
 */
export async function getLogStat(
  client: OpsHttpClient,
  slug: string,
  query: LogStatQuery = {}
): Promise<OrgLogStat> {
  return OrgLogStatSchema.parse(await client.get<unknown>(
    `/orgs/${encodeURIComponent(slug)}/log/stat`,
    logStatQueryParams(query)
  ));
}
