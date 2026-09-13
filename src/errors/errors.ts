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
