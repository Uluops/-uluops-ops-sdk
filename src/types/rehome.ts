/**
 * Project re-home types (project-org-routing-and-rehome spec §4, D14/D19/D21).
 *
 * Three surfaces, three audiences, deliberately NOT one namespace:
 *
 * - `projects.rehome()` — the MEMBER path. Moves one project out of the
 *   caller's org context (the `org` option, or the client `orgSlug`) into
 *   another org the caller administers. This is the product capability.
 * - `orgs.getVisibleAuditLog()` — the D19 FEED. Any member of an org can
 *   read the rows its writers marked org-visible; today that is a project
 *   leaving the org for someone's personal org.
 * - `admin.*` — the platform-admin surface behind D20: session-only writes
 *   (a `ulr_` key gets `403 SESSION_REQUIRED`), plus the two key-readable
 *   ledgers. The Phase 4 migration script is the intended caller; an MCP tool
 *   deliberately does not exist for these.
 *
 * Wire casing is mixed BY CONTRACT and the schemas below pin it rather than
 * normalise it: the re-home block (`from_org`, `to_org`, `audit_ids`) and the
 * audit-row `details` are snake_case (spec §4.1 declares them so, and the
 * details are written by the API as an opaque JSON blob the platform stores
 * verbatim); the tombstone and ledger rows are camelCase business objects like
 * every other read in this SDK. Normalising one side would make the SDK's
 * types disagree with the curl a reader uses to check them.
 */

import { z } from 'zod';
import { ProjectResponseSchema, DateTimeStringSchema } from './response-schemas.js';

// ============================================
// INPUTS
// ============================================

/** Member path input. `targetOrg` is the slug; `reason` is optional here and REQUIRED on the admin path. */
export interface RehomeProjectInput {
  /** Slug of the org the project should live in after the move. */
  targetOrg: string;
  /** Operator-authored free text, ≤ 500 chars. Stored on the tombstone; never rendered into an error. */
  reason?: string;
}

/** Admin path input — same body, `reason` mandatory (spec §4.1, ratified 2026-09-13). */
export interface AdminRehomeProjectInput {
  targetOrg: string;
  /** Required: on the admin path the target org's only standing is the audit row plus this text. */
  reason: string;
}

/** Filters for the reservation listing and the ledger. `org` accepts a UUID OR a slug (the API resolves either). */
export interface ProjectRehomeListQuery {
  projectId?: string;
  org?: string;
  /** ISO 8601 lower bound on `createdAt`. */
  since?: string;
  /** 1–500. The API clamps; the reservation listing defaults to its own page size, the ledger to 100. */
  limit?: number;
}

/** Ledger filters add the event kind and the `seq` cursor (pass `nextCursor` back verbatim). */
export interface ProjectRehomeEventListQuery extends ProjectRehomeListQuery {
  event?: ProjectRehomeEventKind;
  cursor?: string;
}

/** D19 feed paging. `cursor` is opaque — pass a prior page's `nextCursor` back verbatim. */
export interface OrgAuditFeedQuery {
  cursor?: string;
  /** 1–100. The API does NOT clamp: a value outside the range is a 400 (`OrgVisibleAuditLogQuery`, `.min(1).max(100)`). */
  limit?: number;
}

// ============================================
// RESPONSE SCHEMAS
// ============================================

/** `{ id, slug }` — both, because slugs retire on org deletion and ids are opaque to a reader (spec §4.1). */
export const OrgRefSchema = z.object({
  id: z.string(),
  slug: z.string(),
});
export type OrgRef = z.infer<typeof OrgRefSchema>;

/**
 * `POST /projects/:id/rehome` and its admin twin. The project read projection
 * after the move (its `orgId` is the target) plus the re-home block.
 *
 * `audit_ids` is `[]` today: the platform ACL's `writeAuditLog` returns void,
 * so there are no ids to hand back, and the API reports the field empty rather
 * than omitting it because it is in the contract. The durable record is the
 * ledger (`admin.listProjectRehomeEvents`), not this array.
 */
export const RehomeResponseSchema = ProjectResponseSchema.extend({
  rehome: z.object({
    from_org: OrgRefSchema,
    to_org: OrgRefSchema,
    audit_ids: z.array(z.string()),
  }),
});
export type RehomeResponse = z.infer<typeof RehomeResponseSchema>;

/**
 * A reservation (tombstone) row — `GET /admin/projects/rehomes`. One per
 * vacated `(sourceOrgId, name)` address, pointing at where the project lives
 * now. A reversal ANNIHILATES (A→B→A leaves no row), a release deletes; this
 * listing is therefore the current redirect table, not the history — the
 * history is {@link ProjectRehomeEventSchema}.
 */
export const ProjectRehomeSchema = z.object({
  id: z.string(),
  sourceOrgId: z.string(),
  /** The project's name AT THE TIME OF THE MOVE — a later rename does not move the tombstone. */
  name: z.string(),
  projectId: z.string(),
  targetOrgId: z.string(),
  /** Null for a system-actor move. */
  actorId: z.string().nullable(),
  reason: z.string().nullable(),
  createdAt: DateTimeStringSchema,
});
export type ProjectRehome = z.infer<typeof ProjectRehomeSchema>;

/**
 * Ledger event kinds (D21). Server-controlled and additive, so the schema
 * accepts any string — the six known values are exported for callers that
 * branch, and a seventh must not turn a successful read into a client outage
 * (the `mergeProjects` conflict-kind lesson).
 */
export const PROJECT_REHOME_EVENT_KINDS = [
  'moved',
  'repointed',
  'annihilated',
  'degenerate_dropped',
  'released',
  'hard_deleted',
] as const;
export type ProjectRehomeEventKind = (typeof PROJECT_REHOME_EVENT_KINDS)[number];

/** An append-only ledger row — `GET /admin/projects/rehome-events`. Nothing the API offers removes one. */
export const ProjectRehomeEventSchema = z.object({
  id: z.string(),
  /** Insertion order — the sort key and paging cursor. Never page this by time. */
  seq: z.number().int().nonnegative(),
  event: z.string().min(1),
  projectId: z.string(),
  projectName: z.string(),
  fromOrgId: z.string().nullable(),
  toOrgId: z.string().nullable(),
  addressName: z.string().nullable(),
  tombstoneId: z.string().nullable(),
  actorId: z.string().nullable(),
  viaAdminPath: z.boolean(),
  reason: z.string().nullable(),
  cause: z.string().nullable(),
  createdAt: DateTimeStringSchema,
});
export type ProjectRehomeEvent = z.infer<typeof ProjectRehomeEventSchema>;

/** Reservation listing envelope. `total` is the MATCHING count, `returned` the page — they differ once paged. */
export const ProjectRehomeListResponseSchema = z.object({
  data: z.array(ProjectRehomeSchema),
  total: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
});
export type ProjectRehomeList = z.infer<typeof ProjectRehomeListResponseSchema>;

/** Ledger envelope — keyset-paged by `seq`; `nextCursor` is null on the last page. */
export const ProjectRehomeEventListResponseSchema = ProjectRehomeListResponseSchema.extend({
  data: z.array(ProjectRehomeEventSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
});
export type ProjectRehomeEventList = z.infer<typeof ProjectRehomeEventListResponseSchema>;

/**
 * One row of the D19 feed (`GET /orgs/:slug/audit-log/global`). `action` is
 * the platform's closed ENUM (`org.updated` for every re-home fact); the real
 * event is `details.action` — see {@link RehomeAuditDetails} for the shape the
 * re-home writer produces. `details` is typed loosely on purpose: other
 * writers may mark rows org-visible with other shapes.
 */
export const OrgAuditEntrySchema = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  action: z.string(),
  details: z.record(z.string(), z.unknown()),
  createdAt: DateTimeStringSchema,
});
export type OrgAuditEntry = z.infer<typeof OrgAuditEntrySchema>;

export const OrgAuditFeedResponseSchema = z.object({
  data: z.object({ entries: z.array(OrgAuditEntrySchema) }),
  count: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
});
export type OrgAuditFeed = z.infer<typeof OrgAuditFeedResponseSchema>;

/**
 * The `details` blob the re-home writer puts on its audit rows (both the
 * `rehome_out` row on the source org and the `rehome_in` row on the target).
 * Read it with {@link readRehomeAuditDetails}, which returns `null` for rows
 * written by anything else.
 */
export interface RehomeAuditDetails {
  source: 'project_rehome';
  action: 'project.rehome_out' | 'project.rehome_in' | (string & {});
  project_id: string;
  project_name: string;
  from_org: OrgRef;
  to_org: OrgRef;
  actor: string | null;
  reason: string | null;
  via_admin_path: boolean;
  to_personal_org: boolean;
  visibility: 'org' | 'admin' | (string & {});
}

const RehomeAuditDetailsSchema = z.object({
  source: z.literal('project_rehome'),
  action: z.string(),
  project_id: z.string(),
  project_name: z.string(),
  from_org: OrgRefSchema,
  to_org: OrgRefSchema,
  actor: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  via_admin_path: z.boolean().optional(),
  to_personal_org: z.boolean().optional(),
  visibility: z.string().optional(),
});

/**
 * Narrow a feed entry's `details` to the re-home writer's shape, or `null`.
 * A renderer branches on this: a non-null result is a project move it can
 * describe in one line; null is some other org-visible fact to print raw.
 */
export function readRehomeAuditDetails(entry: Pick<OrgAuditEntry, 'details'>): RehomeAuditDetails | null {
  const parsed = RehomeAuditDetailsSchema.safeParse(entry.details);
  if (!parsed.success) return null;
  const d = parsed.data;
  return {
    source: d.source,
    action: d.action,
    project_id: d.project_id,
    project_name: d.project_name,
    from_org: d.from_org,
    to_org: d.to_org,
    actor: d.actor ?? null,
    reason: d.reason ?? null,
    via_admin_path: d.via_admin_path ?? false,
    to_personal_org: d.to_personal_org ?? false,
    visibility: d.visibility ?? 'admin',
  };
}
