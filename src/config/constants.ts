/**
 * Constants for @uluops/ops-sdk
 *
 * Shared constants are re-exported from @uluops/sdk-core.
 * SDK-specific constants are defined here.
 */

// Re-export public constants from sdk-core
export { API_KEY_PREFIX } from '@uluops/sdk-core/config';

// ---- SDK-specific constants ----

/**
 * Production base URL for the ops-uluops-api
 */
export const DEFAULT_PROD_URL = 'https://api.uluops.ai/api/v1/ops';

/**
 * Development base URL for local ops-uluops-api
 */
export const DEFAULT_DEV_URL = 'http://localhost:3100/api/v1';

/**
 * Resolve the default base URL based on NODE_ENV.
 * - NODE_ENV=development -> localhost
 * - Otherwise (production, test, undefined) -> production
 */
export const DEFAULT_BASE_URL =
  process.env.NODE_ENV === 'development' ? DEFAULT_DEV_URL : DEFAULT_PROD_URL;

/**
 * Environment variable names
 */
export const ENV_VARS = {
  API_KEY: 'ULUOPS_API_KEY',
  EMAIL: 'ULUOPS_EMAIL',
  PASSWORD: 'ULUOPS_PASSWORD',
  SESSION_TOKEN: 'ULUOPS_SESSION_TOKEN',
  BASE_URL: 'ULUOPS_BASE_URL',
  DEBUG: 'ULUOPS_DEBUG',
} as const;

// Re-export version from build-generated file (no manual sync needed)
import { SDK_VERSION } from './generated-version.js';
export { SDK_VERSION };

/**
 * User agent string for requests
 */
export const USER_AGENT = `@uluops/ops-sdk/${SDK_VERSION}`;
