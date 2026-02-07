/**
 * Config/credential loading for @uluops/ops-sdk
 *
 * Thin wrappers around @uluops/sdk-core that inject ops-sdk ENV_VARS.
 */

import {
  loadConfig as coreLoadConfig,
  loadCredentials as coreLoadCredentials,
  type EnvVarConfig,
  type Credentials as CoreCredentials,
} from '@uluops/sdk-core/config';

export {
  getGlobalConfigDir,
  getCredentialsPath,
  loadEnvFiles,
  loadStoredCredentials,
  isApiKey,
  validateCredentials,
  type Credentials,
} from '@uluops/sdk-core/config';

import { ENV_VARS, DEFAULT_BASE_URL } from './constants.js';

/**
 * Ops-sdk ENV_VARS mapping for sdk-core
 */
const OPS_ENV_VARS: EnvVarConfig = {
  apiKey: ENV_VARS.API_KEY,
  email: ENV_VARS.EMAIL,
  password: ENV_VARS.PASSWORD,
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
 * Load credentials with priority chain
 * Priority: explicit params > env vars > stored credentials
 */
export function loadCredentials(options: {
  apiKey?: string;
  email?: string;
  password?: string;
  profile?: string;
} = {}): CoreCredentials {
  return coreLoadCredentials({ ...options, envVars: OPS_ENV_VARS });
}

/**
 * Load full SDK configuration
 */
export function loadConfig(options: {
  apiKey?: string;
  email?: string;
  password?: string;
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
