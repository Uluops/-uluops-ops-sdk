/**
 * Config/credential loading for @uluops/ops-sdk
 *
 * Wrappers around @uluops/sdk-core that inject ops-sdk ENV_VARS.
 */

import {
  loadConfig as coreLoadConfig,
  loadCredentials as coreLoadCredentials,
  type EnvVarConfig,
  type Credentials as CoreCredentials,
} from '@uluops/sdk-core/config';

// `loadEnvFiles` and the `Credentials` type are part of the documented public
// surface (re-exported from the package root). The remaining helpers below are
// low-level plumbing exposed only via the `@uluops/ops-sdk/config` subpath for
// advanced/tooling consumers — they are not covered by semver guarantees.
export {
  loadEnvFiles,
  type Credentials,
} from '@uluops/sdk-core/config';

/**
 * @internal Not part of the public API. Filesystem/auth plumbing re-exported
 * from `@uluops/sdk-core` for advanced consumers. May change without a major bump.
 */
export {
  getGlobalConfigDir,
  getCredentialsPath,
  loadStoredCredentials,
  isApiKey,
  validateCredentials,
} from '@uluops/sdk-core/config';

import { ENV_VARS, DEFAULT_BASE_URL } from './constants.js';

/**
 * Ops-sdk ENV_VARS mapping for sdk-core
 */
const OPS_ENV_VARS: EnvVarConfig = {
  apiKey: ENV_VARS.API_KEY,
  email: ENV_VARS.EMAIL,
  password: ENV_VARS.PASSWORD,
  sessionToken: ENV_VARS.SESSION_TOKEN,
  baseUrl: ENV_VARS.BASE_URL,
  debug: ENV_VARS.DEBUG,
};

/**
 * Full SDK configuration
 */
export interface SdkConfig {
  baseUrl: string;
  credentials: CoreCredentials;
  debug: boolean;
  timeout?: number;
  retries?: number;
}

/**
 * Load credentials from the priority chain: explicit options > env vars > stored credentials file.
 * The first source in that order that yields a usable credential wins.
 *
 * @param options - Optional overrides. Any field provided here takes precedence over env/file.
 * @param options.apiKey - API key (e.g. `ulr_...`); short-circuits the chain when present.
 * @param options.email - Email for session-based auth (paired with `password`).
 * @param options.password - Password for session-based auth (paired with `email`).
 * @param options.sessionToken - Pre-existing session token to use directly.
 * @param options.profile - Profile name to read from `~/.uluops/credentials.json` (default: `'default'`).
 * @returns The resolved {@link CoreCredentials} for whichever auth method matched first in the chain.
 */
export function loadCredentials(options: {
  apiKey?: string;
  email?: string;
  password?: string;
  sessionToken?: string;
  profile?: string;
} = {}): CoreCredentials {
  return coreLoadCredentials({ ...options, envVars: OPS_ENV_VARS });
}

/**
 * Load the full SDK configuration — credentials plus connection settings —
 * resolving each value from the chain: explicit options > env vars > defaults.
 *
 * @param options - Optional overrides for any config field.
 * @param options.apiKey - API key for authentication (preferred auth method).
 * @param options.email - Email for session-based auth (paired with `password`).
 * @param options.password - Password for session-based auth (paired with `email`).
 * @param options.sessionToken - Pre-existing session token to use directly.
 * @param options.baseUrl - API base URL override (default: {@link DEFAULT_BASE_URL}).
 * @param options.profile - Credentials profile name (default: `'default'`).
 * @param options.debug - Enable debug logging.
 * @param options.timeout - Request timeout in milliseconds.
 * @param options.retries - Number of retries for transient errors.
 * @returns The fully resolved {@link SdkConfig} (baseUrl, credentials, debug, and optional timeout/retries).
 */
export function loadConfig(options: {
  apiKey?: string;
  email?: string;
  password?: string;
  sessionToken?: string;
  baseUrl?: string;
  profile?: string;
  debug?: boolean;
  timeout?: number;
  retries?: number;
} = {}): SdkConfig {
  const coreConfig = coreLoadConfig({
    ...options,
    envVars: OPS_ENV_VARS,
    defaults: { baseUrl: DEFAULT_BASE_URL },
  });

  return {
    baseUrl: coreConfig.baseUrl,
    credentials: coreConfig.credentials,
    debug: coreConfig.debug,
    timeout: coreConfig.timeout,
    retries: coreConfig.retries,
  };
}
