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
