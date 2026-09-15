import type { OpsHttpClient } from '../http/http-client.js';
import type {
  AdminRehomeProjectInput,
  RehomeResponse,
  ProjectRehomeList,
  ProjectRehomeListQuery,
  ProjectRehomeEventList,
  ProjectRehomeEventListQuery,
} from '../types/rehome.js';
import {
  RehomeResponseSchema,
  ProjectRehomeListResponseSchema,
  ProjectRehomeEventListResponseSchema,
} from '../types/rehome.js';
import { validateAdminRehomeProjectInput } from '../config/validators.js';

/**
 * Platform-admin project re-home surface (project-org-routing-and-rehome spec
 * §4.1 D8, §4.7, D20, D21). Every call here requires `users.role = 'admin'` —
 * a PLATFORM role, not an org role — and the two writes additionally require
 * a login-issued SESSION (D20): a `ulr_` key, even an admin's, gets
 * `403 SESSION_REQUIRED` (`isSessionRequiredError`). Log in with
 * `OpsClient.login` (completing MFA via `loginWithTotp` if challenged) and the
 * session bearer is what these calls send. There is deliberately no MCP tool
 * for any of this.
 *
 * `admin.` is a namespace, not an escalation: the same client, the same auth
 * strategy. If the credential cannot do it the server says so.
 */

/**
 * Move ANY project between ANY two orgs — `POST /admin/projects/:id/rehome`.
 * No source-membership and no target-membership requirement (the platform role
 * is the authority), so `reason` is REQUIRED: on this path the target org's
 * only standing is the `rehome_in` audit row plus that text. Resolves the
 * project by id UNSCOPED (the admin router has no org context) — pass the
 * UUID; a name would be looked up in nobody's org.
 *
 * Session-only (D20). Phase 4 of the spec runs this once per row of the OQ-4
 * table, sequentially, with the row reference as `reason` and `same_org` read
 * as "already done" (`rehomeRefusalReason`).
 *
 * @param client - HTTP client instance carrying a SESSION
 * @param projectId - Project UUID
 * @param input - `{ targetOrg, reason }`
 */
export async function rehomeProject(
  client: OpsHttpClient,
  projectId: string,
  input: AdminRehomeProjectInput
): Promise<RehomeResponse> {
  const valid = validateAdminRehomeProjectInput(input);
  return RehomeResponseSchema.parse(await client.post<unknown>(
    `/admin/projects/${encodeURIComponent(projectId)}/rehome`,
    { target_org: valid.targetOrg, reason: valid.reason },
  ));
}

/**
 * The reservation table — `GET /admin/projects/rehomes`: every vacated
 * `(org, name)` address and where it redirects. Key-readable. This is the
 * CURRENT redirect state, not the history — a reversal annihilates its row and
 * a release deletes it; for "what happened" read {@link listProjectRehomeEvents}.
 *
 * `org` takes a UUID or a slug; `total` is the matching count, `returned` the page.
 */
export async function listProjectRehomes(
  client: OpsHttpClient,
  query: ProjectRehomeListQuery = {}
): Promise<ProjectRehomeList> {
  return ProjectRehomeListResponseSchema.parse(await client.request<unknown>(
    'GET',
    '/admin/projects/rehomes',
    rehomeListParams(query),
    { rawEnvelope: true },
  ));
}

/**
 * The append-only ledger (D21) — `GET /admin/projects/rehome-events`: every
 * move, re-point, annihilation, degenerate drop, release and hard-delete
 * release, written in the same transaction as the change; nothing the API
 * offers removes a row. Key-readable. Pages by `seq` (insertion order) —
 * `nextCursor` is the `seq` to continue strictly below; pass it back verbatim.
 * This, not the reservation listing and not a script's own log, is what a
 * migration reconciles against (spec §4.7 item 4).
 */
export async function listProjectRehomeEvents(
  client: OpsHttpClient,
  query: ProjectRehomeEventListQuery = {}
): Promise<ProjectRehomeEventList> {
  const params = rehomeListParams(query);
  if (query.event !== undefined) params['event'] = query.event;
  if (query.cursor !== undefined) params['cursor'] = query.cursor;
  return ProjectRehomeEventListResponseSchema.parse(await client.request<unknown>(
    'GET',
    '/admin/projects/rehome-events',
    params,
    { rawEnvelope: true },
  ));
}

/**
 * Release a vacated address — `DELETE /admin/projects/rehomes/:id`. After
 * this the old `(org, name)` is creatable again: a by-name writer there gets a
 * NEW project instead of `410 PROJECT_REHOMED`. Deliberate, audited (`released`
 * ledger row), never done by time. Session-only (D20): release is the step that
 * empties the queryable record.
 *
 * @param client - HTTP client instance carrying a SESSION
 * @param rehomeId - The reservation row id (from {@link listProjectRehomes})
 */
export async function releaseProjectRehome(
  client: OpsHttpClient,
  rehomeId: string
): Promise<{ released: true }> {
  const body = await client.delete<unknown>(`/admin/projects/rehomes/${encodeURIComponent(rehomeId)}`);
  if (typeof body !== 'object' || body === null || (body as { released?: unknown }).released !== true) {
    // A 200 whose body does not say `released: true` is not a release — surface it.
    throw new Error(`Unexpected release response: ${JSON.stringify(body)}`);
  }
  return { released: true };
}

/** Shared filter serialisation for the two listings — snake_case on the wire (`project_id`), strings throughout. */
function rehomeListParams(query: ProjectRehomeListQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.projectId !== undefined) params['project_id'] = query.projectId;
  if (query.org !== undefined) params['org'] = query.org;
  if (query.since !== undefined) params['since'] = query.since;
  if (query.limit !== undefined) params['limit'] = String(query.limit);
  return params;
}
