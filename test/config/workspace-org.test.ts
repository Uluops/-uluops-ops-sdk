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
    write(root, { something: 'else' });
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

  it('findWorkspaceOrgFile / readWorkspaceOrgFile are exposed for tooling that wants to explain the answer', () => {
    const p = write(root, { org: 'ws' });
    expect(findWorkspaceOrgFile(join(root, 'a', 'b'), root)).toBe(p);
    expect(readWorkspaceOrgFile(p)).toBe('ws');
    write(root, { org: PERSONAL_ORG_SENTINEL });
    expect(readWorkspaceOrgFile(p)).toBe(PERSONAL_ORG_SENTINEL);
  });
});
