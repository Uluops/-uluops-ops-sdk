/**
 * Error classes re-exported from @uluops/sdk-core
 *
 * OpsApiError is an alias for SdkApiError to preserve the public API.
 */
export {
  SdkApiError as OpsApiError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
  UnprocessableError,
  RateLimitError,
  ServiceUnavailableError,
  NetworkError,
  RedirectError,
  TimeoutError,
  isSdkApiError as isOpsApiError,
  isValidationError,
  isNotFoundError,
  isConflictError,
  isUnprocessableError,
  isRateLimitError,
  isUnauthorizedError,
  isForbiddenError,
  isPayloadTooLargeError,
  isServiceUnavailableError,
  isNetworkError,
  isRedirectError,
  isTimeoutError,
} from '@uluops/sdk-core/errors';

/**
 * @internal Not part of the public API. Internal factory that maps an HTTP
 * status code to the matching typed error; used by the request layer. Consumers
 * should catch the typed error classes (e.g. {@link NotFoundError}) instead.
 */
export { createErrorFromStatus } from '@uluops/sdk-core/errors';

// SDK-specific errors
export { InputValidationError } from '../config/validators.js';

/**
 * The §3.9 skew alarm (ops-uluops-api update-run replacement-semantics spec):
 * thrown when an analysis-bearing update response carries no `analysisWrite`
 * echo, when the echoed `recordMode` differs from the mode THIS CALL sent
 * (defaulted 'replace'), or — 'preview-mode-mismatch' — when the PREVIEW
 * echoes a different mode than requested. The primary real-world cause at 1b
 * is a server BEHIND the SDK: pre-1b servers strip `record_write_mode` and
 * execute replace, so a merge send retires the named agents' records that
 * were not in the payload — the mode-mismatch message leads with that data
 * consequence, not the version story. Narrow by design: it verifies the MODE
 * string, not that the counts are sane — a zero supersede on an enrichment
 * you expected to replace rows is visible on `analysisWrite.supersededRecords`
 * (use the with-echo methods to see it on success; the server logs
 * `run.analysis_write.superseded_zero` for that class under replace).
 *
 * IMPORTANT for 'missing-echo'/'mode-mismatch': the update HAS been applied
 * server-side when this throws — the HTTP call succeeded. `run` carries the
 * updated run so catching callers can act without re-reading. Do NOT retry: a
 * retry re-applies the write. For 'preview-mode-mismatch' NOTHING was written
 * (`run` is null) — the preview modeled the wrong semantics; fix the version
 * skew before writing. Not an `OpsApiError` (no HTTP failure occurred);
 * branch on `reason`, never on the message string.
 */
export class AnalysisEchoMismatchError extends Error {
  /** Which condition fired. 'preview-mode-mismatch' = read-only, nothing written. */
  readonly reason: 'missing-echo' | 'mode-mismatch' | 'preview-mode-mismatch';
  /** The mode THIS CALL sent, defaulted to 'replace' — not a fixed SDK constant. */
  readonly expectedRecordMode: string;
  /** The mode the server echoed; null when the echo was absent entirely. */
  readonly actualRecordMode: string | null;
  /** The updated run from the response — the write that already landed. */
  readonly run: unknown;
  /** The observed echo; null when absent (the 'missing-echo' case). */
  readonly analysisWrite: unknown;

  constructor(message: string, details: {
    reason: 'missing-echo' | 'mode-mismatch' | 'preview-mode-mismatch';
    expectedRecordMode: string;
    actualRecordMode: string | null;
    run: unknown;
    analysisWrite: unknown;
  }) {
    super(message);
    this.name = 'AnalysisEchoMismatchError';
    this.reason = details.reason;
    this.expectedRecordMode = details.expectedRecordMode;
    this.actualRecordMode = details.actualRecordMode;
    this.run = details.run;
    this.analysisWrite = details.analysisWrite;
  }
}

// ---------------------------------------------------------------------------
// Org routing (project-org-routing-and-rehome spec, 6.2.0)
// ---------------------------------------------------------------------------

import { SdkApiError as _SdkApiError } from '@uluops/sdk-core/errors';

/**
 * 403 — the caller is a member of the org but below the write floor
 * (`publisher`). On tracker writes the API rewrites the body: `details.applied`
 * is `false` and the message forbids retrying without `org`. DO NOT retry the
 * same call without an org: an org-less retry does not "fall back", it files
 * the work in the caller's PERSONAL org (spec §3.1, S6).
 */
export const INSUFFICIENT_ORG_ROLE = 'INSUFFICIENT_ORG_ROLE' as const;
/** 403 — the caller is not a member of the org named by `org` / `orgSlug`, or the key is bound to a different org. */
export const ORG_ACCESS_DENIED = 'ORG_ACCESS_DENIED' as const;
/**
 * 410 — the project this name once denoted in this org has been RE-HOMED to
 * another org (spec D14). `details.target_org.slug` is where it lives now:
 * pass it as `org` and the same call succeeds. Do not create a new project
 * at the old address — the tombstone exists precisely to refuse that fork.
 */
export const PROJECT_REHOMED = 'PROJECT_REHOMED' as const;

/** `details` on an `INSUFFICIENT_ORG_ROLE` rejection from a tracker write. */
export interface InsufficientOrgRoleDetails {
  currentRole?: string;
  requiredRole?: string;
  /** Present on tracker writes: the org the write was refused in. */
  orgSlug?: string | null;
  /** Present on tracker writes: always `false` — nothing was applied. */
  applied?: boolean;
}

/** `details` on a `PROJECT_REHOMED` rejection (spec §4.4a). */
export interface ProjectRehomedDetails {
  project_id: string;
  target_org: { id: string; slug: string };
  rehomed_at?: string;
  reason?: string | null;
}

function hasCode(err: unknown, code: string): err is _SdkApiError {
  return err instanceof _SdkApiError && err.code === code;
}

/** Type guard: the org write floor refused this call (403 `INSUFFICIENT_ORG_ROLE`). Terminal — do not retry without `org`. */
export function isInsufficientOrgRoleError(err: unknown): err is _SdkApiError & { details?: InsufficientOrgRoleDetails } {
  return hasCode(err, INSUFFICIENT_ORG_ROLE);
}

/** Type guard: not a member of the named org, or the key is bound elsewhere (403 `ORG_ACCESS_DENIED`). Terminal. */
export function isOrgAccessDeniedError(err: unknown): err is _SdkApiError {
  return hasCode(err, ORG_ACCESS_DENIED);
}

/** Type guard: the project was re-homed; `err.details.target_org.slug` is the org to pass (410 `PROJECT_REHOMED`). */
export function isProjectRehomedError(err: unknown): err is _SdkApiError & { details: ProjectRehomedDetails } {
  if (!hasCode(err, PROJECT_REHOMED)) return false;
  const d = err.details as Partial<ProjectRehomedDetails> | undefined;
  return typeof d?.target_org?.slug === 'string' && typeof d.project_id === 'string';
}

// ---------------------------------------------------------------------------
// Re-home surfaces (spec §4, 6.4.0)
// ---------------------------------------------------------------------------

/**
 * 403 — the route is session-only (D20): platform-admin writes that mint or
 * re-point identity, and the two cross-tenant project moves, refuse a `ulr_`
 * key even when its user is a platform admin. Terminal for a key-authenticated
 * client: log in (`OpsClient.login`, completing MFA with `loginWithTotp` if
 * challenged) and retry with the session — never by minting another key.
 */
export const SESSION_REQUIRED = 'SESSION_REQUIRED' as const;
/** 403 — the caller lacks the PLATFORM role (`users.role`) the admin path requires; distinct from the org-role codes above. */
export const INSUFFICIENT_ROLE = 'INSUFFICIENT_ROLE' as const;

/** Type guard: session-only route refused an API key (403 `SESSION_REQUIRED`). Terminal for key auth. */
export function isSessionRequiredError(err: unknown): err is _SdkApiError {
  return hasCode(err, SESSION_REQUIRED);
}

/** Type guard: the caller's PLATFORM role is below what the admin path requires (403 `INSUFFICIENT_ROLE`). Terminal — no org argument changes it. */
export function isInsufficientRoleError(err: unknown): err is _SdkApiError {
  return hasCode(err, INSUFFICIENT_ROLE);
}

/**
 * The refusal reasons a re-home can answer with, as `details.reason` on a
 * 400 (`VALIDATION_ERROR`) or 409 (`CONFLICT`). Enumerated here because the
 * Phase 4 runbook (spec §4.7 item 3) assigns each a disposition, and a script
 * that switches on a string it typed itself will misspell one:
 *
 * - `same_org` — already there. Idempotent re-run over a finished row; count as done.
 * - `moved_during_request` / `deadlock_retry` / `concurrent_modification` — re-read and retry once.
 * - `name_collision` / `soft_deleted_conflict` / `rehomed_away_conflict` — skip and report.
 * - `export_in_progress` — an export job holds either org; wait, then retry.
 * - `project_soft_deleted` / `project_has_no_org` — the source row is not movable as-is; stop and look.
 */
export const REHOME_REFUSAL_REASONS = [
  'same_org',
  'moved_during_request',
  'deadlock_retry',
  'concurrent_modification',
  'name_collision',
  'soft_deleted_conflict',
  'rehomed_away_conflict',
  'export_in_progress',
  'project_soft_deleted',
  'project_has_no_org',
] as const;
export type RehomeRefusalReason = (typeof REHOME_REFUSAL_REASONS)[number];

/**
 * The re-home refusal reason carried by a rejection, or `null` when the error
 * is not one of the enumerated re-home refusals (a 403 org code, a 402
 * `PROJECT_LIMIT`, a network failure). Reads `details.reason`; an unknown
 * reason string returns null rather than a widened type — a new server reason
 * should reach the caller as "not one I know", not as a silently-handled case.
 *
 * `null` therefore means "not a re-home refusal I can name", NOT "safe to
 * retry": a `TimeoutError` / `NetworkError` after the server committed the
 * move also reads `null`, and a blind retry on the admin path answers
 * `same_org` (fine) while on the member path it answers 404 (see
 * `projects.rehome`). Branch on `isTimeoutError` / `isNetworkError` first.
 */
export function rehomeRefusalReason(err: unknown): RehomeRefusalReason | null {
  if (!(err instanceof _SdkApiError)) return null;
  const reason = (err.details as { reason?: unknown } | undefined)?.reason;
  return typeof reason === 'string' && (REHOME_REFUSAL_REASONS as readonly string[]).includes(reason)
    ? (reason as RehomeRefusalReason)
    : null;
}

/**
 * Thrown by `OpsClient.login` / `auth.login` when the account has MFA enabled:
 * the API answers `200 { mfa_required: true, mfa_challenge_token, ... }` and no
 * session. Until 6.4.0 this surfaced as a raw `ZodError` on `sessionToken`,
 * which made the SDK unable to log in ANY MFA account. Complete the login with
 * `OpsClient.loginWithTotp(err.mfaChallengeToken, code)` before the challenge
 * expires (`expiresAt`). WebAuthn completion is not offered by this SDK.
 *
 * **The token is single-use and is consumed before the code is verified** —
 * a mistyped code burns it; do not loop on `loginWithTotp` with the same
 * token, call `login()` again for a new challenge. And this error is raised
 * only by `login()` / `auth.login()`: a client constructed with
 * `{ email, password }` (or autoloaded credentials) logs in inside sdk-core,
 * which cannot see the challenge and surfaces a generic `UnauthorizedError`
 * — MFA accounts must use the two-step `login()` → `loginWithTotp()` path.
 */
export class MfaRequiredError extends Error {
  override readonly name = 'MfaRequiredError';
  readonly mfaChallengeToken: string;
  readonly expiresAt: string;
  readonly mfaMethods: readonly string[];

  constructor(challenge: { mfaChallengeToken: string; expiresAt: string; mfaMethods: readonly string[] }) {
    super(
      `Login requires a second factor (${challenge.mfaMethods.join(', ') || 'unknown method'}); ` +
      'complete it with loginWithTotp(mfaChallengeToken, code) before the challenge expires',
    );
    this.mfaChallengeToken = challenge.mfaChallengeToken;
    this.expiresAt = challenge.expiresAt;
    this.mfaMethods = challenge.mfaMethods;
  }
}

/** Type guard for {@link MfaRequiredError}. */
export function isMfaRequiredError(err: unknown): err is MfaRequiredError {
  return err instanceof MfaRequiredError;
}

/** Requested semantics are unavailable; the write was never attempted. */
export class UnsupportedContractError extends Error {
  readonly code = 'UNSUPPORTED_CONTRACT';
  readonly applicationState = 'not_applied';
  constructor(readonly family: string, readonly selector: string) {
    super(`Server does not advertise ${family} contract ${selector}; no write was attempted`);
    this.name = 'UnsupportedContractError';
  }
}

export function isUnsupportedContractError(error: unknown): error is UnsupportedContractError {
  return error instanceof UnsupportedContractError;
}
