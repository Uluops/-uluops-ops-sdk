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
 * echo (the server predates the per-agent replace semantics this SDK
 * documents) or echoes a `recordMode` other than the one this SDK implements
 * (the server has moved past them). Converts silent client/server semantics
 * skew into a loud, named failure. Narrow by design: it verifies the MODE
 * string, not that the counts are sane — a zero supersede on an enrichment
 * you expected to replace rows is visible on `analysisWrite.supersededRecords`
 * (carried here on the mode-mismatch case, and returned to no one on success;
 * the server logs `run.analysis_write.superseded_zero` for that class).
 *
 * IMPORTANT: the update HAS been applied server-side when this throws — the
 * HTTP call succeeded. `run` carries the updated run from the response, so
 * catching callers can act on it without re-reading. Do NOT retry: a retry
 * re-applies the write. Not an `OpsApiError` (no HTTP failure occurred);
 * branch on `reason`, never on the message string.
 */
export class AnalysisEchoMismatchError extends Error {
  /** Which §3.9 condition fired. */
  readonly reason: 'missing-echo' | 'mode-mismatch';
  /** The mode this SDK implements ('replace'). */
  readonly expectedRecordMode: string;
  /** The mode the server echoed; null when the echo was absent entirely. */
  readonly actualRecordMode: string | null;
  /** The updated run from the response — the write that already landed. */
  readonly run: unknown;
  /** The observed echo; null when absent (the 'missing-echo' case). */
  readonly analysisWrite: unknown;

  constructor(message: string, details: {
    reason: 'missing-echo' | 'mode-mismatch';
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
