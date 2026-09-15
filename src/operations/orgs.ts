import type { OpsHttpClient } from '../http/http-client.js';
import type { OrgAuditFeed, OrgAuditFeedQuery } from '../types/rehome.js';
import { OrgAuditFeedResponseSchema } from '../types/rehome.js';

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
 * @param slug - Org slug
 * @param query - `{ cursor?, limit? }`
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
