import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';

/**
 * Base API error class
 */
export class OpsApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = ERROR_CODES.UNKNOWN,
    public readonly details?: Record<string, unknown>,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = 'OpsApiError';
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    return (
      this.statusCode === HTTP_STATUS.BAD_GATEWAY ||
      this.statusCode === HTTP_STATUS.SERVICE_UNAVAILABLE ||
      this.statusCode === HTTP_STATUS.GATEWAY_TIMEOUT ||
      this.statusCode === HTTP_STATUS.TOO_MANY_REQUESTS
    );
  }

  /**
   * Convert to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
      requestId: this.requestId,
    };
  }
}

/**
 * 400 Bad Request - Validation errors
 */
export class ValidationError extends OpsApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(HTTP_STATUS.BAD_REQUEST, message, ERROR_CODES.VALIDATION_ERROR, details);
    this.name = 'ValidationError';
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends OpsApiError {
  constructor(message = 'Authentication required') {
    super(HTTP_STATUS.UNAUTHORIZED, message, ERROR_CODES.UNAUTHORIZED);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 Forbidden - Access denied
 */
export class ForbiddenError extends OpsApiError {
  constructor(message = 'Access denied') {
    super(HTTP_STATUS.FORBIDDEN, message, ERROR_CODES.FORBIDDEN);
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends OpsApiError {
  constructor(resource: string, identifier?: string) {
    const message = identifier ? `${resource} '${identifier}' not found` : `${resource} not found`;
    super(HTTP_STATUS.NOT_FOUND, message, ERROR_CODES.NOT_FOUND, identifier ? { id: identifier } : undefined);
    this.name = 'NotFoundError';
  }
}

/**
 * 409 Conflict - Resource already exists
 */
export class ConflictError extends OpsApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(HTTP_STATUS.CONFLICT, message, ERROR_CODES.CONFLICT, details);
    this.name = 'ConflictError';
  }
}

/**
 * 429 Too Many Requests - Rate limited
 */
export class RateLimitError extends OpsApiError {
  constructor(retryAfter?: number) {
    const message = retryAfter
      ? `Rate limit exceeded. Retry after ${retryAfter} seconds`
      : 'Rate limit exceeded';
    super(HTTP_STATUS.TOO_MANY_REQUESTS, message, ERROR_CODES.RATE_LIMITED, { retryAfter });
    this.name = 'RateLimitError';
  }
}

/**
 * 503 Service Unavailable - Server error
 */
export class ServiceUnavailableError extends OpsApiError {
  constructor(message = 'Service temporarily unavailable') {
    super(HTTP_STATUS.SERVICE_UNAVAILABLE, message, ERROR_CODES.SERVICE_UNAVAILABLE);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Network/connection error
 */
export class NetworkError extends OpsApiError {
  constructor(message: string) {
    super(0, message, ERROR_CODES.NETWORK_ERROR);
    this.name = 'NetworkError';
  }
}

/**
 * Request timeout error
 */
export class TimeoutError extends OpsApiError {
  constructor(timeoutMs: number) {
    super(0, `Request timed out after ${timeoutMs}ms`, ERROR_CODES.TIMEOUT, { timeoutMs });
    this.name = 'TimeoutError';
  }
}

/**
 * Create appropriate error from HTTP status code
 */
export function createErrorFromStatus(
  statusCode: number,
  message: string,
  code?: string,
  details?: Record<string, unknown>,
  requestId?: string
): OpsApiError {
  switch (statusCode) {
    case HTTP_STATUS.BAD_REQUEST:
      return new ValidationError(message, details);
    case HTTP_STATUS.UNAUTHORIZED:
      return new UnauthorizedError(message);
    case HTTP_STATUS.FORBIDDEN:
      return new ForbiddenError(message);
    case HTTP_STATUS.NOT_FOUND:
      return new NotFoundError(message);
    case HTTP_STATUS.CONFLICT:
      return new ConflictError(message, details);
    case HTTP_STATUS.TOO_MANY_REQUESTS: {
      const retryAfter = typeof details?.retryAfter === 'number' ? details.retryAfter : undefined;
      return new RateLimitError(retryAfter);
    }
    case HTTP_STATUS.SERVICE_UNAVAILABLE:
    case HTTP_STATUS.BAD_GATEWAY:
    case HTTP_STATUS.GATEWAY_TIMEOUT:
      return new ServiceUnavailableError(message);
    default:
      return new OpsApiError(statusCode, message, code, details, requestId);
  }
}

/**
 * Check if an error is an OpsApiError
 */
export function isOpsApiError(error: unknown): error is OpsApiError {
  return error instanceof OpsApiError;
}
