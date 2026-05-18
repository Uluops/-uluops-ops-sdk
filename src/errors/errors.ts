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
  createErrorFromStatus,
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

// SDK-specific errors
export { InputValidationError } from '../config/validators.js';
