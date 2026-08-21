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
