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
import { z } from 'zod';
import { validateAdminRehomeProjectInput, validateUuid } from '../config/validators.js';

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
 * project by id UNSCOPED (the admin router has no org context) — the route
 * takes a UUID and answers 400 to anything else, so unlike `projects.*` a
 * NAME is refused here, client-side, before the request.
 *
 * Session-only (D20). Phase 4 of the spec runs this once per row of the OQ-4
 * table, sequentially, with the row reference as `reason`. On THIS path a
 * re-run over a finished row answers `same_org` (the lookup is by id, so the
 * moved project is found wherever it is) — read it as "already done" via
 * `rehomeRefusalReason`. That is not true of the member path, whose lookup is
 * source-scoped (see `projects.rehome`).
 *
 * @param client - HTTP client instance carrying a SESSION
 * @param projectId - Project UUID (a name is an `InputValidationError`)
 * @param input - `{ targetOrg, reason }` — both required
 * @returns The project after the move (`orgId` is the target) plus the `rehome` block
 * @throws {InputValidationError} If `projectId` is not a UUID, `targetOrg` is not a slug, or `reason` is missing
 * @example
 * ```typescript
 * await client.login(email, password); // or loginWithTotp after an MfaRequiredError
 * const moved = await client.admin.rehomeProject(projectId, { targetOrg: 'ulu-labs', reason: 'OQ-4 row 7' });
 * moved.rehome.to_org.slug; // 'ulu-labs'
 * ```
 */
export async function rehomeProject(
  client: OpsHttpClient,
  projectId: string,
  input: AdminRehomeProjectInput
): Promise<RehomeResponse> {
  validateUuid(projectId, 'projectId');
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
 *
 * @param client - HTTP client instance (a platform-admin key suffices)
 * @param query - `{ projectId?, org?, since?, limit? }`
 * @returns `{ data, total, returned }` — reservation rows, camelCase
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
 *
 * @param client - HTTP client instance (a platform-admin key suffices)
 * @param query - `{ projectId?, org?, event?, since?, cursor?, limit? }`
 * @returns `{ data, total, returned, hasMore, nextCursor }` — ledger rows, camelCase, newest `seq` first
 * @example
 * ```typescript
 * let cursor: string | undefined;
 * do {
 *   const page = await client.admin.listProjectRehomeEvents({ org: 'ulu-labs', event: 'moved', cursor });
 *   for (const ev of page.data) console.log(ev.seq, ev.projectName, ev.fromOrgId, '→', ev.toOrgId);
 *   cursor = page.nextCursor ?? undefined;
 * } while (cursor);
 * ```
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
 * @param rehomeId - The reservation row id (from {@link listProjectRehomes}); a non-UUID is refused client-side
 * @returns `{ released: true }`
 * @throws {InputValidationError} If `rehomeId` is not a UUID
 * @throws {ZodError} If the 200 body does not say `released: true` — the same signal every other
 *   shape mismatch in this SDK gives. Note the server sends 200 AFTER the row is gone, so a
 *   shape failure here means the release most likely HAPPENED; re-read `listProjectRehomes`
 *   before retrying (a retry answers 404).
 */
export async function releaseProjectRehome(
  client: OpsHttpClient,
  rehomeId: string
): Promise<{ released: true }> {
  validateUuid(rehomeId, 'rehomeId');
  return ReleaseResponseSchema.parse(await client.delete<unknown>(`/admin/projects/rehomes/${encodeURIComponent(rehomeId)}`));
}

/** `DELETE /admin/projects/rehomes/:id` answers `{ data: { released: true } }`; anything else is a contract break. */
const ReleaseResponseSchema = z.object({ released: z.literal(true) });

/** Shared filter serialisation for the two listings — snake_case on the wire (`project_id`), strings throughout. */
function rehomeListParams(query: ProjectRehomeListQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.projectId !== undefined) params['project_id'] = query.projectId;
  if (query.org !== undefined) params['org'] = query.org;
  if (query.since !== undefined) params['since'] = query.since;
  if (query.limit !== undefined) params['limit'] = String(query.limit);
  return params;
}
