/**
 * Workspace org resolution — D13 of the project-org-routing-and-rehome spec.
 *
 * "Where you are" decides which org a tracker call lands in. The unit that
 * distinguishes personal work from work-org work on one machine is the
 * CHECKOUT, not the process or the person: an env var or a profile leaks the
 * last-set org into whatever repo is opened next (spec §2.0 S3/S7). So the
 * default comes from a file in the tree, found by walking upward from `cwd`
 * to the nearest `.uluops.json` — the way `.npmrc` and `.gitignore` are found.
 *
 * Precedence, highest first:
 *   1. `explicit`  — a per-call / per-invocation value (`--org`, an MCP tool's
 *                    `org` argument);
 *   2. the nearest `.uluops.json` above `cwd` whose `org` is set — including
 *                    the reserved value `"personal"`, which STOPS the walk and
 *                    resolves to no org (a personal repo cloned under a work
 *                    tree carries it so the outer file does not win);
 *   3. `ULUOPS_ORG_SLUG` in `env` — kept as the lowest fall-through for
 *                    headless environments with no checkout;
 *   4. undefined     — no header; the API key holder's personal org.
 *
 * The file may carry ONLY `org`. Credentials, base URLs and profiles are
 * refused, not ignored: a `.env` in cwd once retargeted the CLI's base URL,
 * and the one thing that keeps that footgun from transferring is that this
 * file cannot name a target or an identity. An org slug is server-relative —
 * the same file against a different base URL names a different org or none —
 * so callers that print "where it landed" should print the base URL beside
 * the org.
 *
 * Runtime-agnostic: reads are synchronous `fs` calls, no `process.cwd()` is
 * consulted unless the caller passes none, and `env` is injectable so tests
 * never touch the real environment.
 */
import { existsSync, readFileSync, statSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve, relative, isAbsolute } from 'path';
import { InputValidationError } from './validators.js';
import { ENV_VARS } from './constants.js';

/** The workspace file name, found by walking upward from cwd. */
export const WORKSPACE_ORG_FILE = '.uluops.json';

/** Reserved `org` value: stop the walk here and use the personal org. */
export const PERSONAL_ORG_SENTINEL = 'personal';

/** Same pattern as `OpsHttpClient`'s `orgSlug` — it is a header value. */
const ORG_SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;

/**
 * The ONLY keys a workspace file may carry. An allowlist, not a denylist:
 * until 6.3.1 this was a list of ten forbidden names while the error message
 * said "may carry only org" — `baseURL`, `apikey`, `token` and anything
 * unlisted passed (security audit run #187, agentic-security-analyst F10).
 * Inert then (only `org` was ever read), but the stated invariant must be
 * the enforced one. `$schema` is allowed for editor tooling.
 */
const ALLOWED_KEYS = new Set(['org', '$schema']);

export type WorkspaceOrgSource = 'explicit' | 'workspace' | 'env' | 'personal';

export interface WorkspaceOrgResolution {
  /** The org slug to send, or `undefined` for the personal org (no header). */
  org: string | undefined;
  /** Which rung answered. `'personal'` also covers a workspace file that says `"personal"`. */
  source: WorkspaceOrgSource;
  /** The workspace file that answered, when `source` is `'workspace'` or a `"personal"` stop. */
  path?: string;
}

export interface ResolveWorkspaceOrgOptions {
  /** A per-call / per-invocation value; wins over everything when set. */
  explicit?: string;
  /** Directory to walk upward from. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Environment to read `ULUOPS_ORG_SLUG` from. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /**
   * Directory at which the walk stops (inclusive). Defaults to the running
   * user's home directory when `cwd` is under it (a file at `/` or `/Users`
   * can never answer), else the filesystem root. Tests pass a temp dir so a
   * real `.uluops.json` above it cannot leak in.
   */
  stopAt?: string;
  /** Home directory used for the default `stopAt`. Defaults to `os.homedir()`. Injectable for tests. */
  home?: string;
  /**
   * Numeric uid the answering file must be owned by. Defaults to
   * `process.getuid()`; `undefined` on platforms without uids (Windows)
   * disables the check. Injectable for tests (chown is not available to them).
   */
  uid?: number;
}

function assertSlug(value: unknown, where: string): string {
  if (typeof value !== 'string' || !ORG_SLUG_PATTERN.test(value)) {
    throw new InputValidationError(
      `Invalid org in ${where}: must be 1-100 alphanumeric characters, hyphens, or underscores`,
      [{ code: 'custom', path: ['org'], message: 'must be 1-100 alphanumeric characters, hyphens, or underscores' }]
    );
  }
  return value;
}

/** True when `child` is `parent` or lies beneath it. */
function isUnder(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Find the nearest `.uluops.json` at or above `cwd`, stopping at `stopAt`.
 * With no `stopAt`, the walk is bounded by `home` (default `os.homedir()`)
 * when `cwd` is under it: security audit run #187 (all four agents) — an
 * unbounded walk makes a file at `/`, `/Users` or a container image root
 * the silent default for every checkout beneath it, which is the
 * single-default leak D13 exists to remove, one layer down. Outside the
 * home directory the walk still reaches the filesystem root; the ownership
 * check in `readWorkspaceOrgFile` is the guard there.
 */
export function findWorkspaceOrgFile(cwd: string, stopAt?: string, home: string = homedir()): string | undefined {
  let dir = resolve(cwd);
  const homeAbs = resolve(home);
  const stop = stopAt !== undefined ? resolve(stopAt) : isUnder(dir, homeAbs) ? homeAbs : undefined;
  for (;;) {
    const candidate = join(dir, WORKSPACE_ORG_FILE);
    if (existsSync(candidate)) return candidate;
    if (stop !== undefined && dir === stop) return undefined;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Read one workspace file. Returns the `org` it declares (`"personal"` is
 * returned verbatim — the caller decides what it means), or `undefined` when
 * the file exists but declares no `org`.
 *
 * A file not owned by `uid` (default: the running user) is REFUSED, not
 * skipped: a shared parent directory another user can write to is the
 * planting vector (run #187, circumvention A2), and a silently skipped file
 * is a silently wrong org. Pass `uid: undefined` explicitly only on
 * platforms with no uids.
 *
 * @throws {InputValidationError} on unreadable JSON, a non-object body, a
 *   key other than `org`/`$schema`, a file owned by another user, or an
 *   `org` that is not a valid slug (other than the sentinel).
 */
export function readWorkspaceOrgFile(path: string, uid: number | undefined = process.getuid?.()): string | undefined {
  if (uid !== undefined) {
    let ownerUid: number;
    try {
      ownerUid = statSync(path).uid;
    } catch (err) {
      throw new InputValidationError(
        `Unreadable ${WORKSPACE_ORG_FILE} at ${path}: ${err instanceof Error ? err.message : String(err)}`,
        [{ code: 'custom', path: [], message: 'cannot stat' }]
      );
    }
    if (ownerUid !== uid) {
      throw new InputValidationError(
        `Refusing ${WORKSPACE_ORG_FILE} at ${path}: owned by uid ${String(ownerUid)}, not you (uid ${String(uid)}). ` +
        'A workspace file decides which org your writes land in; only your own may answer.',
        [{ code: 'custom', path: [], message: 'not owned by the running user' }]
      );
    }
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (err) {
    throw new InputValidationError(
      `Unreadable ${WORKSPACE_ORG_FILE} at ${path}: ${err instanceof Error ? err.message : String(err)}`,
      [{ code: 'custom', path: [], message: 'invalid JSON' }]
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InputValidationError(
      `Invalid ${WORKSPACE_ORG_FILE} at ${path}: expected an object`,
      [{ code: 'custom', path: [], message: 'expected an object' }]
    );
  }
  const body = parsed as Record<string, unknown>;
  const forbidden = Object.keys(body).filter((k) => !ALLOWED_KEYS.has(k));
  if (forbidden.length > 0) {
    throw new InputValidationError(
      `Refusing ${WORKSPACE_ORG_FILE} at ${path}: it may carry only "org"; found ${forbidden.map((k) => `"${k}"`).join(', ')}. ` +
      'Credentials and targets belong in ~/.uluops/credentials.json or the environment, never in the checkout.',
      forbidden.map((k) => ({ code: 'custom' as const, path: [k], message: 'forbidden in the workspace file' }))
    );
  }
  if (!('org' in body) || body['org'] === undefined || body['org'] === null) return undefined;
  if (body['org'] === PERSONAL_ORG_SENTINEL) return PERSONAL_ORG_SENTINEL;
  return assertSlug(body['org'], `${WORKSPACE_ORG_FILE} at ${path}`);
}

/**
 * Resolve the org for a call: explicit > nearest workspace file > env > personal.
 *
 * Never returns the sentinel — a `"personal"` file yields `{ org: undefined,
 * source: 'personal', path }`. Never consults a cache; the walk is a handful
 * of `existsSync` calls and a resolver that remembered would reintroduce the
 * process-level default the spec rejects.
 *
 * @throws {InputValidationError} for an invalid `explicit` slug, or a
 *   malformed / forbidden workspace file (loud on purpose: a silently ignored
 *   file is a silently wrong org).
 */
export function resolveWorkspaceOrg(options: ResolveWorkspaceOrgOptions = {}): WorkspaceOrgResolution {
  if (options.explicit !== undefined) {
    // The sentinel is honoured on the explicit path too (6.3.1, run #187
    // circumvention A3): a caller told "omit org for your personal org" will
    // sometimes write `org: personal`, and until now that went to the wire
    // as a slug (404, or a real org if anyone registers the name).
    if (options.explicit === PERSONAL_ORG_SENTINEL) return { org: undefined, source: 'explicit' };
    return { org: assertSlug(options.explicit, 'explicit org'), source: 'explicit' };
  }
  const cwd = options.cwd ?? process.cwd();
  const path = findWorkspaceOrgFile(cwd, options.stopAt, options.home);
  if (path !== undefined) {
    const declared = readWorkspaceOrgFile(path, 'uid' in options ? options.uid : process.getuid?.());
    if (declared === PERSONAL_ORG_SENTINEL) return { org: undefined, source: 'personal', path };
    if (declared !== undefined) return { org: declared, source: 'workspace', path };
    // A file with no `org` is not an answer; keep walking would be surprising
    // ("the nearest file wins" is the rule), so fall through to env.
  }
  const env = options.env ?? process.env;
  const fromEnv = env[ENV_VARS.ORG_SLUG];
  if (fromEnv !== undefined && fromEnv !== '') {
    return { org: assertSlug(fromEnv, `env ${ENV_VARS.ORG_SLUG}`), source: 'env' };
  }
  return { org: undefined, source: 'personal' };
}
