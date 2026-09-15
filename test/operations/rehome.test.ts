/**
 * Re-home surfaces (project-org-routing-and-rehome spec §4, 6.4.0):
 * `projects.rehome` (member path), `orgs.getVisibleAuditLog` (D19 feed),
 * `admin.*` (D8/D20/D21), and the MFA branch of login.
 *
 * Every assertion is on the OUTGOING REQUEST as nock sees it (path, body,
 * query, org header) or on a VALUE that survived the parse — never on a mock
 * that agrees with the code. Controls: `badheaders` proves "no org header";
 * a strict body matcher proves `reason` is OMITTED, not sent as null.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { ZodError } from 'zod';
import { OpsClient } from '../../src/client.js';
import { OpsHttpClient, ORG_SLUG_HEADER } from '../../src/http/http-client.js';
import * as projectOps from '../../src/operations/projects.js';
import * as adminOps from '../../src/operations/admin.js';
import * as orgOps from '../../src/operations/orgs.js';
import * as authOps from '../../src/operations/auth.js';
import {
  MfaRequiredError,
  isMfaRequiredError,
  isSessionRequiredError,
  rehomeRefusalReason,
  SESSION_REQUIRED,
} from '../../src/errors/errors.js';
import { InputValidationError } from '../../src/config/validators.js';
import { readRehomeAuditDetails } from '../../src/types/rehome.js';
import { BASE_URL, TEST_API_KEY } from '../setup.js';
import { TEST_IDS, createMockProject, createMockAuthUser, resetMockIds } from '../contract-helpers.js';

const ORG_A = { id: '0b0c3d3e-1111-4a4a-8b8b-000000000001', slug: 'acme' };
const ORG_B = { id: '0b0c3d3e-2222-4a4a-8b8b-000000000002', slug: 'ulu-labs' };

function rehomedProject(overrides: Record<string, unknown> = {}) {
  return {
    ...createMockProject({ id: TEST_IDS.proj1, name: 'billing' }),
    orgId: ORG_B.id,
    rehome: { from_org: ORG_A, to_org: ORG_B, audit_ids: [] },
    ...overrides,
  };
}

describe('projects.rehome — member path', () => {
  let client: OpsHttpClient;
  beforeEach(() => {
    resetMockIds();
    client = new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
  });
  afterEach(() => nock.cleanAll());

  it('POSTs {target_org} only when reason is absent (strict body — the API body is .strict())', async () => {
    nock(BASE_URL)
      .post(`/projects/${TEST_IDS.proj1}/rehome`, (body) => JSON.stringify(body) === JSON.stringify({ target_org: 'ulu-labs' }))
      .reply(200, { data: rehomedProject() });

    const result = await projectOps.rehome(client, TEST_IDS.proj1, { targetOrg: 'ulu-labs' });

    expect(result.orgId).toBe(ORG_B.id);
    expect(result.rehome.from_org.slug).toBe('acme');
    expect(result.rehome.to_org.slug).toBe('ulu-labs');
    expect(result.rehome.audit_ids).toEqual([]);
  });

  it('carries reason when given, and encodes a project NAME in the path', async () => {
    nock(BASE_URL)
      .post('/projects/my%20project/rehome', { target_org: 'ulu-labs', reason: 'OQ-4 row 7' })
      .reply(200, { data: rehomedProject() });

    await expect(projectOps.rehome(client, 'my project', { targetOrg: 'ulu-labs', reason: 'OQ-4 row 7' })).resolves.toBeDefined();
  });

  it('sends the SOURCE org as X-Org-Slug via the per-call option (root client sends none — badheaders control)', async () => {
    const ops = new OpsClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
    nock(BASE_URL).matchHeader(ORG_SLUG_HEADER, 'acme')
      .post(`/projects/${TEST_IDS.proj1}/rehome`).reply(200, { data: rehomedProject() });
    await ops.projects.rehome(TEST_IDS.proj1, { targetOrg: 'ulu-labs' }, { org: 'acme' });

    nock(BASE_URL, { badheaders: [ORG_SLUG_HEADER] })
      .post(`/projects/${TEST_IDS.proj1}/rehome`).reply(200, { data: rehomedProject() });
    await ops.projects.rehome(TEST_IDS.proj1, { targetOrg: 'ulu-labs' });
    expect(nock.isDone()).toBe(true);
  });

  it('rejects a malformed slug and an over-long reason client-side (no request made)', async () => {
    const scope = nock(BASE_URL).post(/.*/).reply(200, {});
    await expect(projectOps.rehome(client, TEST_IDS.proj1, { targetOrg: 'not a slug!' })).rejects.toBeInstanceOf(InputValidationError);
    await expect(projectOps.rehome(client, TEST_IDS.proj1, { targetOrg: 'ok', reason: 'x'.repeat(501) })).rejects.toBeInstanceOf(InputValidationError);
    expect(scope.isDone()).toBe(false);
    nock.cleanAll();
  });

  it('rejects a response missing the rehome block — the contract is the block, not a bare project', async () => {
    nock(BASE_URL).post(`/projects/${TEST_IDS.proj1}/rehome`).reply(200, { data: createMockProject() });
    await expect(projectOps.rehome(client, TEST_IDS.proj1, { targetOrg: 'ulu-labs' })).rejects.toBeInstanceOf(ZodError);
  });

  it('rehomeRefusalReason reads details.reason on 400/409 and returns null for anything else', async () => {
    nock(BASE_URL).post(`/projects/${TEST_IDS.proj1}/rehome`)
      .reply(409, { error: { code: 'CONFLICT', message: 'name taken', details: { reason: 'name_collision' } } });
    const conflict = await projectOps.rehome(client, TEST_IDS.proj1, { targetOrg: 'ulu-labs' }).catch((e: unknown) => e);
    expect(rehomeRefusalReason(conflict)).toBe('name_collision');

    nock(BASE_URL).post(`/projects/${TEST_IDS.proj1}/rehome`)
      .reply(400, { error: { code: 'VALIDATION_ERROR', message: 'already there', details: { reason: 'same_org' } } });
    const same = await projectOps.rehome(client, TEST_IDS.proj1, { targetOrg: 'ulu-labs' }).catch((e: unknown) => e);
    expect(rehomeRefusalReason(same)).toBe('same_org');

    // Controls: an unknown reason string and a non-rehome 403 both read as null.
    nock(BASE_URL).post(`/projects/${TEST_IDS.proj1}/rehome`)
      .reply(409, { error: { code: 'CONFLICT', message: 'x', details: { reason: 'brand_new_server_reason' } } });
    const unknown = await projectOps.rehome(client, TEST_IDS.proj1, { targetOrg: 'ulu-labs' }).catch((e: unknown) => e);
    expect(rehomeRefusalReason(unknown)).toBeNull();
    expect(rehomeRefusalReason(new Error('network'))).toBeNull();
  });
});

describe('admin.* — platform path', () => {
  let client: OpsHttpClient;
  beforeEach(() => {
    resetMockIds();
    client = new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
  });
  afterEach(() => nock.cleanAll());

  it('rehomeProject POSTs /admin/projects/:id/rehome with reason REQUIRED (missing reason never leaves the client)', async () => {
    const scope = nock(BASE_URL)
      .post(`/admin/projects/${TEST_IDS.proj1}/rehome`, { target_org: 'ulu-labs', reason: 'OQ-4 row 1' })
      .reply(200, { data: rehomedProject(), message: 'Project re-homed successfully' });

    await expect(adminOps.rehomeProject(client, TEST_IDS.proj1, { targetOrg: 'ulu-labs' } as never))
      .rejects.toBeInstanceOf(InputValidationError);
    expect(scope.isDone()).toBe(false);

    const result = await adminOps.rehomeProject(client, TEST_IDS.proj1, { targetOrg: 'ulu-labs', reason: 'OQ-4 row 1' });
    expect(result.rehome.to_org.slug).toBe('ulu-labs');
  });

  it('a key on the session-only route surfaces as SESSION_REQUIRED (isSessionRequiredError)', async () => {
    nock(BASE_URL).post(`/admin/projects/${TEST_IDS.proj1}/rehome`)
      .reply(403, { error: { code: SESSION_REQUIRED, message: 'This action requires a signed-in session' } });
    const err = await adminOps.rehomeProject(client, TEST_IDS.proj1, { targetOrg: 'ulu-labs', reason: 'r' }).catch((e: unknown) => e);
    expect(isSessionRequiredError(err)).toBe(true);
    // Control: an org-role 403 is not a session refusal.
    nock(BASE_URL).post(`/admin/projects/${TEST_IDS.proj1}/rehome`)
      .reply(403, { error: { code: 'INSUFFICIENT_ROLE', message: 'admin required' } });
    const other = await adminOps.rehomeProject(client, TEST_IDS.proj1, { targetOrg: 'ulu-labs', reason: 'r' }).catch((e: unknown) => e);
    expect(isSessionRequiredError(other)).toBe(false);
  });

  it('listProjectRehomes serialises filters snake_case and surfaces total ≠ returned', async () => {
    const row = {
      id: TEST_IDS.issue1, sourceOrgId: ORG_A.id, name: 'billing', projectId: TEST_IDS.proj1,
      targetOrgId: ORG_B.id, actorId: TEST_IDS.user1, reason: 'OQ-4 row 1', createdAt: '2026-09-15T10:00:00.000Z',
    };
    nock(BASE_URL).get('/admin/projects/rehomes')
      .query({ project_id: TEST_IDS.proj1, org: 'ulu-labs', since: '2026-09-01T00:00:00.000Z', limit: '1' })
      .reply(200, { data: [row], total: 134, returned: 1 });

    const result = await adminOps.listProjectRehomes(client, {
      projectId: TEST_IDS.proj1, org: 'ulu-labs', since: '2026-09-01T00:00:00.000Z', limit: 1,
    });
    expect(result.total).toBe(134);
    expect(result.returned).toBe(1);
    expect(result.data[0]?.name).toBe('billing');
    expect(result.data[0]?.targetOrgId).toBe(ORG_B.id);
  });

  it('listProjectRehomeEvents pages by seq, keeps an unknown event kind verbatim, and passes cursor back', async () => {
    const ev = (seq: number, event: string) => ({
      id: TEST_IDS.issue1, seq, event, projectId: TEST_IDS.proj1, projectName: 'billing',
      fromOrgId: ORG_A.id, toOrgId: ORG_B.id, addressName: 'billing', tombstoneId: null, actorId: null,
      viaAdminPath: true, reason: 'OQ-4 row 1', cause: null, createdAt: '2026-09-15T10:00:00.000Z',
    });
    nock(BASE_URL).get('/admin/projects/rehome-events')
      .query({ event: 'moved', cursor: '900' })
      .reply(200, { data: [ev(899, 'moved'), ev(898, 'some_future_event')], total: 2, returned: 2, hasMore: true, nextCursor: '898' });

    const result = await adminOps.listProjectRehomeEvents(client, { event: 'moved', cursor: '900' });
    expect(result.nextCursor).toBe('898');
    expect(result.hasMore).toBe(true);
    expect(result.data[1]?.event).toBe('some_future_event');
    expect(result.data[0]?.viaAdminPath).toBe(true);
  });

  it('releaseProjectRehome DELETEs and refuses a 200 that does not say released:true (ZodError, like every shape failure)', async () => {
    nock(BASE_URL).delete(`/admin/projects/rehomes/${TEST_IDS.issue1}`).reply(200, { data: { released: true }, message: 'ok' });
    await expect(adminOps.releaseProjectRehome(client, TEST_IDS.issue1)).resolves.toEqual({ released: true });

    nock(BASE_URL).delete(`/admin/projects/rehomes/${TEST_IDS.issue1}`).reply(200, { data: { ok: true } });
    await expect(adminOps.releaseProjectRehome(client, TEST_IDS.issue1)).rejects.toBeInstanceOf(ZodError);
  });
});

describe('orgs.getVisibleAuditLog — D19 feed', () => {
  let client: OpsHttpClient;
  beforeEach(() => { client = new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY }); });
  afterEach(() => nock.cleanAll());

  const rehomeEntry = {
    id: TEST_IDS.issue1, actorId: TEST_IDS.user1, action: 'org.updated', createdAt: '2026-09-15T10:00:00.000Z',
    details: {
      source: 'project_rehome', action: 'project.rehome_out', project_id: TEST_IDS.proj1, project_name: 'billing',
      from_org: ORG_A, to_org: { id: ORG_B.id, slug: 'alexself2' }, actor: TEST_IDS.user1, reason: null,
      via_admin_path: false, to_personal_org: true, visibility: 'org',
    },
  };
  const otherEntry = { id: TEST_IDS.issue2, actorId: null, action: 'org.updated', createdAt: '2026-09-15T09:00:00.000Z', details: { visibility: 'org', note: 'something else' } };

  it('GETs /orgs/:slug/audit-log/global with cursor+limit and returns the envelope', async () => {
    nock(BASE_URL).get('/orgs/acme/audit-log/global').query({ cursor: '2026-09-15T10:00:00.000Z|abc', limit: '50' })
      .reply(200, { data: { entries: [rehomeEntry, otherEntry] }, count: 2, hasMore: false, nextCursor: null });

    const feed = await orgOps.getVisibleAuditLog(client, 'acme', { cursor: '2026-09-15T10:00:00.000Z|abc', limit: 50 });
    expect(feed.count).toBe(2);
    expect(feed.data.entries).toHaveLength(2);
    expect(feed.nextCursor).toBeNull();
  });

  it('the path carries the slug and the client-level orgSlug header rides along untouched (server precedence for :slug is verified live, not here)', async () => {
    const ops = new OpsClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY, orgSlug: 'other-org' });
    nock(BASE_URL).get('/orgs/acme/audit-log/global').reply(200, { data: { entries: [] }, count: 0, hasMore: false, nextCursor: null });
    const feed = await ops.orgs.getVisibleAuditLog('acme');
    expect(feed.data.entries).toEqual([]);
  });

  it('readRehomeAuditDetails narrows the re-home writer\'s rows and returns null for other org-visible rows', () => {
    const d = readRehomeAuditDetails(rehomeEntry);
    expect(d).not.toBeNull();
    expect(d?.action).toBe('project.rehome_out');
    expect(d?.to_org.slug).toBe('alexself2');
    expect(d?.to_personal_org).toBe(true);
    expect(readRehomeAuditDetails(otherEntry)).toBeNull();
  });
});

describe('login — MFA branch', () => {
  let client: OpsHttpClient;
  beforeEach(() => { resetMockIds(); client = new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY }); });
  afterEach(() => nock.cleanAll());

  const challenge = { mfa_required: true, mfa_challenge_token: 'chal-123', expires_at: '2026-09-15T10:05:00.000Z', mfa_methods: ['totp'] };
  const session = () => ({ user: createMockAuthUser({ id: TEST_IDS.user1 }), sessionToken: 'sess-xyz', expiresAt: '2026-09-16T10:00:00.000Z' });

  it('a 200 challenge body throws MfaRequiredError carrying the token (was a ZodError on sessionToken)', async () => {
    nock(BASE_URL).post('/auth/login').reply(200, { data: challenge });
    const err = await authOps.login(client, { email: 'a@b.co', password: 'pw' }).catch((e: unknown) => e);
    expect(isMfaRequiredError(err)).toBe(true);
    expect((err as MfaRequiredError).mfaChallengeToken).toBe('chal-123');
    expect((err as MfaRequiredError).mfaMethods).toEqual(['totp']);
    expect(err).not.toBeInstanceOf(ZodError);
  });

  it('a session body still parses (control: the challenge branch does not swallow normal logins)', async () => {
    nock(BASE_URL).post('/auth/login').reply(200, { data: session() });
    const res = await authOps.login(client, { email: 'a@b.co', password: 'pw' });
    expect(res.sessionToken).toBe('sess-xyz');
  });

  it('totpLogin POSTs snake_case challenge token + code and rejects a non-six-digit code client-side', async () => {
    nock(BASE_URL).post('/auth/totp/login', { mfa_challenge_token: 'chal-123', code: '123456' }).reply(200, { data: session() });
    const res = await authOps.totpLogin(client, { mfaChallengeToken: 'chal-123', code: '123456' });
    expect(res.sessionToken).toBe('sess-xyz');
    await expect(authOps.totpLogin(client, { mfaChallengeToken: 'chal-123', code: '12345' })).rejects.toBeInstanceOf(InputValidationError);
  });

  it('OpsClient.loginWithTotp installs the session so the next request carries it as Bearer', async () => {
    const ops = new OpsClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
    nock(BASE_URL).post('/auth/totp/login').reply(200, { data: session() });
    await ops.loginWithTotp('chal-123', '123456');
    expect(ops.getAuthType()).toBe('session');
    nock(BASE_URL).matchHeader('authorization', 'Bearer sess-xyz').get('/projects').reply(200, { data: [], total: 0, count: 0 });
    await expect(ops.projects.list()).resolves.toEqual({ data: [], total: 0 });
  });
});

describe('review fixes (runs #1 on the three repos, 2026-09-15)', () => {
  let client: OpsHttpClient;
  beforeEach(() => { resetMockIds(); client = new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY }); });
  afterEach(() => nock.cleanAll());

  it('admin.rehomeProject / releaseProjectRehome refuse a project NAME client-side — the route is UUID-only (dx-validator)', async () => {
    const scope = nock(BASE_URL).post(/.*/).reply(200, {}).delete(/.*/).reply(200, {});
    const err = await adminOps.rehomeProject(client, 'billing', { targetOrg: 'ulu-labs', reason: 'r' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InputValidationError);
    expect(String((err as Error).message)).toMatch(/projectId.*UUID/);
    await expect(adminOps.releaseProjectRehome(client, 'not-a-uuid')).rejects.toBeInstanceOf(InputValidationError);
    expect(scope.isDone()).toBe(false);
    nock.cleanAll();
  });

  it('a missing admin reason says WHY it is required, not "expected nonoptional" (dx-validator)', async () => {
    const err = await adminOps.rehomeProject(client, TEST_IDS.proj1, { targetOrg: 'ulu-labs' } as never).catch((e: unknown) => e);
    expect(String((err as Error).message)).toMatch(/target org's only standing/);
    expect(String((err as Error).message)).not.toMatch(/nonoptional/);
  });

  it('releaseProjectRehome: a 200 without released:true is a ZodError like every other shape failure, not a bare Error (code-auditor)', async () => {
    nock(BASE_URL).delete(`/admin/projects/rehomes/${TEST_IDS.issue1}`).reply(200, { data: { ok: true } });
    const err = await adminOps.releaseProjectRehome(client, TEST_IDS.issue1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ZodError);
  });

  it('isInsufficientRoleError pairs the fifth 403 code with a guard (docs-validator)', async () => {
    const { isInsufficientRoleError } = await import('../../src/errors/errors.js');
    nock(BASE_URL).get('/admin/projects/rehomes').reply(403, { error: { code: 'INSUFFICIENT_ROLE', message: 'admin required' } });
    const err = await adminOps.listProjectRehomes(client).catch((e: unknown) => e);
    expect(isInsufficientRoleError(err)).toBe(true);
    expect(isSessionRequiredError(err)).toBe(false);
  });

  it('login({ autoRefresh: false }) installs a session that does NOT re-login on 401 — the 401 surfaces untouched (anxiety-reader F1)', async () => {
    const session = { user: createMockAuthUser({ id: TEST_IDS.user1 }), sessionToken: 'sess-1', expiresAt: '2026-09-16T10:00:00.000Z' };
    const ops = new OpsClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
    nock(BASE_URL).post('/auth/login').reply(200, { data: session });
    await ops.login('a@b.co', 'pw', { autoRefresh: false });
    // A 401 on a write: with credentials sdk-core would POST /auth/login again (and, under a
    // single-session API, kill the operator's other sessions). Here there must be exactly ONE
    // request — the write — and no second login.
    let loginAttempts = 0;
    nock(BASE_URL).post('/auth/login').times(5).reply(200, () => { loginAttempts += 1; return { data: session }; });
    nock(BASE_URL).post(`/admin/projects/${TEST_IDS.proj1}/rehome`).reply(401, { error: { code: 'UNAUTHORIZED', message: 'session revoked' } });
    const err = await ops.admin.rehomeProject(TEST_IDS.proj1, { targetOrg: 'ulu-labs', reason: 'r' }).catch((e: unknown) => e);
    expect((err as { statusCode?: number }).statusCode).toBe(401);
    expect(loginAttempts).toBe(0);

    // Control: the default (autoRefresh true) DOES re-login on the 401 — that is the behaviour the option exists to switch off.
    nock.cleanAll();
    const ops2 = new OpsClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
    nock(BASE_URL).post('/auth/login').reply(200, { data: session });
    await ops2.login('a@b.co', 'pw');
    let relogins = 0;
    nock(BASE_URL).post('/auth/login').times(5).reply(200, () => { relogins += 1; return { data: session }; });
    nock(BASE_URL).post(`/admin/projects/${TEST_IDS.proj1}/rehome`).reply(401, { error: { code: 'UNAUTHORIZED', message: 'session revoked' } });
    await ops2.admin.rehomeProject(TEST_IDS.proj1, { targetOrg: 'ulu-labs', reason: 'r' }).catch(() => undefined);
    expect(relogins).toBe(1);
  });
});
