/**
 * D13 workspace org resolution. Every case builds its own temp tree and passes
 * `stopAt` so a real `.uluops.json` above the temp dir can never leak in —
 * the resolver walks to the filesystem root by default, and this repo's
 * workspace WILL carry one.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  resolveWorkspaceOrg,
  findWorkspaceOrgFile,
  readWorkspaceOrgFile,
  readWorkspaceFile,
  WORKSPACE_ORG_FILE,
  PERSONAL_ORG_SENTINEL,
} from '../../src/config/workspace-org.js';
import { InputValidationError } from '../../src/config/validators.js';

describe('resolveWorkspaceOrg (D13)', () => {
  let root: string;
  const write = (dir: string, body: unknown): string => {
    mkdirSync(dir, { recursive: true });
    const p = join(dir, WORKSPACE_ORG_FILE);
    writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body));
    return p;
  };

  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'ulu-ws-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('no file, no env → personal (undefined org)', () => {
    expect(resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root })).toEqual({ org: undefined, source: 'personal' });
  });

  it('nearest file wins, walking upward (S8: a sub-repo under the work root inherits the work org)', () => {
    const p = write(root, { org: 'ulu-labs' });
    const deep = join(root, 'packages', 'x', 'src');
    mkdirSync(deep, { recursive: true });
    expect(resolveWorkspaceOrg({ cwd: deep, env: {}, stopAt: root })).toEqual({ org: 'ulu-labs', source: 'workspace', path: p });
  });

  it('"personal" in a nested file STOPS the walk (a personal repo cloned under a work tree)', () => {
    write(root, { org: 'ulu-labs' });
    const personal = join(root, 'personal-repo');
    const p = write(personal, { org: PERSONAL_ORG_SENTINEL });
    expect(resolveWorkspaceOrg({ cwd: join(personal, 'src'), env: { ULUOPS_ORG_SLUG: 'from-env' }, stopAt: root }))
      .toEqual({ org: undefined, source: 'personal', path: p });
  });

  it('workspace file beats env; env beats nothing', () => {
    write(root, { org: 'ws' });
    expect(resolveWorkspaceOrg({ cwd: root, env: { ULUOPS_ORG_SLUG: 'env-org' }, stopAt: root }).org).toBe('ws');
    const bare = mkdtempSync(join(tmpdir(), 'ulu-ws-bare-'));
    try {
      expect(resolveWorkspaceOrg({ cwd: bare, env: { ULUOPS_ORG_SLUG: 'env-org' }, stopAt: bare })).toEqual({ org: 'env-org', source: 'env' });
      expect(resolveWorkspaceOrg({ cwd: bare, env: { ULUOPS_ORG_SLUG: '' }, stopAt: bare }).source).toBe('personal');
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it('explicit beats everything, including a "personal" file', () => {
    write(root, { org: PERSONAL_ORG_SENTINEL });
    expect(resolveWorkspaceOrg({ explicit: 'acme', cwd: root, env: { ULUOPS_ORG_SLUG: 'env-org' }, stopAt: root }))
      .toEqual({ org: 'acme', source: 'explicit' });
  });

  it('a file with no `org` key is not an answer — falls through to env', () => {
    write(root, {}); // an unknown key is now refused (allowlist); an EMPTY file is the no-answer case
    expect(resolveWorkspaceOrg({ cwd: root, env: { ULUOPS_ORG_SLUG: 'env-org' }, stopAt: root }).source).toBe('env');
  });

  it('stopAt bounds the walk (the control that keeps these tests hermetic)', () => {
    write(root, { org: 'above' });
    const inner = join(root, 'inner');
    mkdirSync(inner);
    expect(resolveWorkspaceOrg({ cwd: inner, env: {}, stopAt: inner }).source).toBe('personal');
    expect(resolveWorkspaceOrg({ cwd: inner, env: {}, stopAt: root }).org).toBe('above');
  });

  describe('refusals are loud (a silently ignored file is a silently wrong org)', () => {
    it('forbidden keys — the .env-in-cwd footgun may not transfer', () => {
      for (const body of [{ org: 'x', apiKey: 'ulr_secret' }, { org: 'x', baseUrl: 'http://evil' }, { org: 'x', profile: 'prod' }, { credentials: {} }]) {
        write(root, body);
        expect(() => resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root }), JSON.stringify(body)).toThrow(InputValidationError);
        expect(() => resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root })).toThrow(/may carry only "org"/);
      }
    });

    it('invalid slug in the file', () => {
      write(root, { org: 'bad slug\r\nX: 1' });
      expect(() => resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root })).toThrow(InputValidationError);
    });

    it('invalid JSON, non-object body', () => {
      write(root, '{ not json');
      expect(() => resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root })).toThrow(/Unreadable/);
      write(root, '[1,2]');
      expect(() => resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root })).toThrow(/expected an object/);
    });

    it('invalid explicit slug and invalid env slug', () => {
      expect(() => resolveWorkspaceOrg({ explicit: 'a b', cwd: root, env: {}, stopAt: root })).toThrow(InputValidationError);
      expect(() => resolveWorkspaceOrg({ cwd: root, env: { ULUOPS_ORG_SLUG: 'a b' }, stopAt: root })).toThrow(InputValidationError);
    });
  });

  describe('run #187 hardening (6.3.1)', () => {
    it('explicit "personal" is the sentinel, not a slug (source: explicit, no org)', () => {
      write(root, { org: 'ulu-labs' });
      expect(resolveWorkspaceOrg({ explicit: PERSONAL_ORG_SENTINEL, cwd: root, env: { ULUOPS_ORG_SLUG: 'env-org' }, stopAt: root }))
        .toEqual({ org: undefined, source: 'explicit' });
    });

    it('the walk stops at HOME (inclusive): a file ABOVE home never answers; a file AT home does', () => {
      const home = join(root, 'home', 'me');
      const project = join(home, 'work', 'repo');
      mkdirSync(project, { recursive: true });
      write(root, { org: 'planted-above-home' });
      expect(resolveWorkspaceOrg({ cwd: project, env: {}, home }).source).toBe('personal');
      const p = write(home, { org: 'at-home' });
      expect(resolveWorkspaceOrg({ cwd: project, env: {}, home })).toEqual({ org: 'at-home', source: 'workspace', path: p });
    });

    it('CONTROL: outside home the walk still reaches the root (stopAt undefined, cwd not under home)', () => {
      const p = write(root, { org: 'outside' });
      const deep = join(root, 'a', 'b');
      mkdirSync(deep, { recursive: true });
      expect(resolveWorkspaceOrg({ cwd: deep, env: {}, home: join(root, 'elsewhere') })).toEqual({ org: 'outside', source: 'workspace', path: p });
    });

    it('a file owned by another uid is REFUSED loudly, not skipped', () => {
      write(root, { org: 'x' });
      expect(() => resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root, uid: 424242 })).toThrow(/owned by uid/);
      expect(() => resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root, uid: 424242 })).toThrow(InputValidationError);
      // control: the running user's own file is accepted; an explicit `uid: undefined` disables the check
      expect(resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root }).org).toBe('x');
      expect(resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root, uid: undefined }).org).toBe('x');
    });

    it('allowlist: any key other than org/$schema is refused — the denylist let baseURL/apikey/token through', () => {
      for (const body of [{ org: 'x', baseURL: 'http://evil' }, { org: 'x', apikey: 'k' }, { org: 'x', token: 't' }, { org: 'x', registry: 'r' }]) {
        write(root, body);
        expect(() => resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root }), JSON.stringify(body)).toThrow(/may carry only "org"/);
      }
      write(root, { $schema: 'https://uluops.ai/schemas/workspace.json', org: 'ok' });
      expect(resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root }).org).toBe('ok');
    });
  });

  it('findWorkspaceOrgFile / readWorkspaceOrgFile are exposed for tooling that wants to explain the answer', () => {
    const p = write(root, { org: 'ws' });
    expect(findWorkspaceOrgFile(join(root, 'a', 'b'), root)).toBe(p);
    expect(readWorkspaceOrgFile(p)).toBe('ws');
    write(root, { org: PERSONAL_ORG_SENTINEL });
    expect(readWorkspaceOrgFile(p)).toBe(PERSONAL_ORG_SENTINEL);
  });

  describe('the `project` key (ulu log D5, 6.5.0) — readWorkspaceFile beside readWorkspaceOrgFile', () => {
    it('{org, project} reads both; readWorkspaceOrgFile on the same file returns the org and NO LONGER throws (semantics without signature)', () => {
      const p = write(root, { org: 'ulu-labs', project: 'ops-uluops-api' });
      expect(readWorkspaceFile(p, undefined)).toEqual({ org: 'ulu-labs', project: 'ops-uluops-api' });
      expect(readWorkspaceOrgFile(p, undefined)).toBe('ulu-labs');
      // and the resolver is unchanged: the file still answers org
      expect(resolveWorkspaceOrg({ cwd: root, env: {}, stopAt: root, uid: undefined })).toEqual({ org: 'ulu-labs', source: 'workspace', path: p });
    });

    it('{"org":"personal","project":"y"} → org is the sentinel verbatim, project y; the resolver stops at personal', () => {
      const p = write(root, { org: PERSONAL_ORG_SENTINEL, project: 'y' });
      expect(readWorkspaceFile(p, undefined)).toEqual({ org: PERSONAL_ORG_SENTINEL, project: 'y' });
      expect(resolveWorkspaceOrg({ cwd: root, env: { ULUOPS_ORG_SLUG: 'outer' }, stopAt: root, uid: undefined })).toEqual({ org: undefined, source: 'personal', path: p });
    });

    it('{"project":"y"} alone THROWS with the allowlist error\'s shape — trigger it and read the message', () => {
      const p = write(root, { project: 'y' });
      let caught: unknown;
      try { readWorkspaceFile(p, undefined); } catch (err) { caught = err; }
      expect(caught).toBeInstanceOf(InputValidationError);
      expect((caught as Error).message).toMatch(/"project" requires "org"; use "personal" for no org/);
      // the old reader delegates, so it refuses the same file the same way
      expect(() => readWorkspaceOrgFile(p, undefined)).toThrow(/"project" requires "org"/);
      // and the resolver, which reads through it, stops loudly rather than falling to env
      expect(() => resolveWorkspaceOrg({ cwd: root, env: { ULUOPS_ORG_SLUG: 'outer' }, stopAt: root, uid: undefined })).toThrow(/"project" requires "org"/);
    });

    it('{"org":"x","project":"y","baseUrl":"http://evil"} is still refused — the allowlist message now names the three keys', () => {
      const p = write(root, { org: 'x', project: 'y', baseUrl: 'http://evil' });
      expect(() => readWorkspaceFile(p, undefined)).toThrow(/may carry only "org", "project" and "\$schema"; found "baseUrl"/);
    });

    it('a file with neither org nor project ({} or {$schema}) → undefined, as before', () => {
      expect(readWorkspaceFile(write(root, {}), undefined)).toBeUndefined();
      expect(readWorkspaceFile(write(root, { $schema: 'https://uluops.ai/schemas/workspace.json' }), undefined)).toBeUndefined();
      expect(readWorkspaceFile(write(root, { org: null, project: null }), undefined)).toBeUndefined();
    });

    it('project is validated like the API validates a name (1–200, no control chars) and is NOT trimmed', () => {
      expect(() => readWorkspaceFile(write(root, { org: 'x', project: '' }), undefined)).toThrow(/Invalid project/);
      expect(() => readWorkspaceFile(write(root, { org: 'x', project: 'a\u0007b' }), undefined)).toThrow(/Invalid project/);
      expect(() => readWorkspaceFile(write(root, { org: 'x', project: 'p'.repeat(201) }), undefined)).toThrow(/Invalid project/);
      expect(() => readWorkspaceFile(write(root, { org: 'x', project: 42 }), undefined)).toThrow(/Invalid project/);
      expect(readWorkspaceFile(write(root, { org: 'x', project: ' spaced ' }), undefined)?.project).toBe(' spaced ');
    });

    it('nesting: {org:a, project:y} under an outer {org:b} → the nearest file answers both (nearest-file rule unchanged)', () => {
      write(root, { org: 'b' });
      const inner = join(root, 'inner');
      const p = write(inner, { org: 'a', project: 'y' });
      expect(findWorkspaceOrgFile(inner, root)).toBe(p);
      expect(readWorkspaceFile(p, undefined)).toEqual({ org: 'a', project: 'y' });
      expect(resolveWorkspaceOrg({ cwd: inner, env: {}, stopAt: root, uid: undefined }).org).toBe('a');
    });

    it('nesting: {org:personal} under an outer {org:b, project:y} → nearest resolves org=personal and project UNDEFINED (the outer project does not leak in)', () => {
      write(root, { org: 'b', project: 'y' });
      const inner = join(root, 'inner');
      const p = write(inner, { org: PERSONAL_ORG_SENTINEL });
      expect(findWorkspaceOrgFile(inner, root)).toBe(p);
      expect(readWorkspaceFile(p, undefined)).toEqual({ org: PERSONAL_ORG_SENTINEL });
      expect(readWorkspaceFile(p, undefined)?.project).toBeUndefined();
      expect(resolveWorkspaceOrg({ cwd: inner, env: {}, stopAt: root, uid: undefined })).toEqual({ org: undefined, source: 'personal', path: p });
    });

    it('the ownership refusal applies to reads of the full file too', () => {
      const p = write(root, { org: 'x', project: 'y' });
      expect(() => readWorkspaceFile(p, 424242)).toThrow(/owned by uid/);
    });
  });
});
