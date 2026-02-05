/**
 * Default base URL for the ops-uluops-api
 */
export const DEFAULT_BASE_URL = 'http://localhost:3100/api/v1';

/**
 * Default request timeout in milliseconds
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * Default retry count for transient errors
 */
export const DEFAULT_RETRY_COUNT = 3;

/**
 * Base delay for exponential backoff (in ms)
 */
export const BACKOFF_BASE_MS = 1000;

/**
 * Maximum backoff delay (in ms)
 */
export const MAX_BACKOFF_MS = 30000;

/**
 * Jitter range for backoff calculation (10-20% of delay)
 */
export const JITTER_MIN = 0.1;
export const JITTER_MAX = 0.2;

/**
 * API key prefix
 */
export const API_KEY_PREFIX = 'ulr_';

/**
 * Environment variable names
 */
export const ENV_VARS = {
  API_KEY: 'ULUOPS_API_KEY',
  EMAIL: 'ULUOPS_EMAIL',
  PASSWORD: 'ULUOPS_PASSWORD',
  BASE_URL: 'ULUOPS_BASE_URL',
  DEBUG: 'ULUOPS_DEBUG',
} as const;

/**
 * Config file paths
 */
export const CONFIG_PATHS = {
  LOCAL_ENV: '.env',
  GLOBAL_DIR: '.uluops',
  GLOBAL_ENV: '.uluops/.env',
  CREDENTIALS: '.uluops/credentials.json',
  PROFILES: '.uluops/profiles.json',
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/**
 * Retryable HTTP status codes
 */
export const RETRYABLE_STATUS_CODES = new Set([
  HTTP_STATUS.BAD_GATEWAY,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
  HTTP_STATUS.GATEWAY_TIMEOUT,
  HTTP_STATUS.TOO_MANY_REQUESTS,
]);

/**
 * Error codes
 */
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN',
} as const;

/**
 * SDK version (should match package.json)
 */
export const SDK_VERSION = '0.1.0';

/**
 * User agent string for requests
 */
export const USER_AGENT = `@uluops/ops-sdk/${SDK_VERSION}`;
