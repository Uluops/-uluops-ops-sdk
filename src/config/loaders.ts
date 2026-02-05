import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { config as loadDotenv } from 'dotenv';
import { ENV_VARS, CONFIG_PATHS, DEFAULT_BASE_URL, API_KEY_PREFIX } from './constants.js';

/**
 * Credentials for authentication
 */
export interface Credentials {
  apiKey?: string;
  email?: string;
  password?: string;
  sessionToken?: string;
}

/**
 * Full SDK configuration
 */
export interface SdkConfig {
  baseUrl: string;
  credentials: Credentials;
  debug: boolean;
  timeout?: number;
  retries?: number;
}

/**
 * Stored credentials in credentials.json
 */
interface StoredCredentials {
  default?: {
    type: 'api_key' | 'session';
    apiKey?: string;
    sessionToken?: string;
    expiresAt?: string;
    email?: string;
  };
  [profile: string]: {
    type: 'api_key' | 'session';
    apiKey?: string;
    sessionToken?: string;
    expiresAt?: string;
    email?: string;
  } | undefined;
}

/**
 * Get the global config directory
 */
export function getGlobalConfigDir(): string {
  return join(homedir(), CONFIG_PATHS.GLOBAL_DIR);
}

/**
 * Get path to credentials file
 */
export function getCredentialsPath(): string {
  return join(homedir(), CONFIG_PATHS.CREDENTIALS);
}

/**
 * Load environment variables from .env files
 * Priority: local .env > global ~/.uluops/.env
 */
export function loadEnvFiles(): void {
  // Load local .env first (lower priority, will be overwritten)
  const localEnvPath = CONFIG_PATHS.LOCAL_ENV;
  if (existsSync(localEnvPath)) {
    loadDotenv({ path: localEnvPath, override: false });
  }

  // Load global .env (even lower priority)
  const globalEnvPath = join(homedir(), CONFIG_PATHS.GLOBAL_ENV);
  if (existsSync(globalEnvPath)) {
    loadDotenv({ path: globalEnvPath, override: false });
  }
}

/**
 * Load stored credentials from credentials.json
 */
export function loadStoredCredentials(profile = 'default'): Partial<Credentials> | null {
  const credPath = getCredentialsPath();

  if (!existsSync(credPath)) {
    return null;
  }

  try {
    const content = readFileSync(credPath, 'utf-8');
    const stored = JSON.parse(content) as StoredCredentials;
    const profileCreds = stored[profile];

    if (!profileCreds) {
      return null;
    }

    // Check if session token is expired
    if (profileCreds.type === 'session' && profileCreds.expiresAt) {
      const expiresAt = new Date(profileCreds.expiresAt);
      if (expiresAt <= new Date()) {
        return null; // Token expired
      }
    }

    return {
      apiKey: profileCreds.apiKey,
      sessionToken: profileCreds.sessionToken,
      email: profileCreds.email,
    };
  } catch {
    return null;
  }
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
} = {}): Credentials {
  // Load env files first
  loadEnvFiles();

  // Priority 1: Explicit parameters
  if (options.apiKey) {
    return { apiKey: options.apiKey };
  }

  if (options.email && options.password) {
    return { email: options.email, password: options.password };
  }

  // Priority 2: Environment variables
  const envApiKey = process.env[ENV_VARS.API_KEY];
  if (envApiKey) {
    return { apiKey: envApiKey };
  }

  const envEmail = process.env[ENV_VARS.EMAIL];
  const envPassword = process.env[ENV_VARS.PASSWORD];
  if (envEmail && envPassword) {
    return { email: envEmail, password: envPassword };
  }

  // Priority 3: Stored credentials
  const stored = loadStoredCredentials(options.profile);
  if (stored?.apiKey) {
    return { apiKey: stored.apiKey };
  }
  if (stored?.sessionToken) {
    return { sessionToken: stored.sessionToken, email: stored.email };
  }

  // No credentials found
  return {};
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
  // Load env files
  loadEnvFiles();

  // Determine base URL
  const baseUrl = options.baseUrl || process.env[ENV_VARS.BASE_URL] || DEFAULT_BASE_URL;

  // Determine debug mode
  const debug = options.debug ?? process.env[ENV_VARS.DEBUG] === 'true';

  // Load credentials
  const credentials = loadCredentials({
    apiKey: options.apiKey,
    email: options.email,
    password: options.password,
    profile: options.profile,
  });

  return {
    baseUrl,
    credentials,
    debug,
    timeout: options.timeout,
    retries: options.retries,
  };
}

/**
 * Check if credentials look like an API key
 */
export function isApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX);
}

/**
 * Validate that required credentials are present
 */
export function validateCredentials(credentials: Credentials): void {
  const hasApiKey = !!credentials.apiKey;
  const hasSession = !!credentials.sessionToken;
  const hasPassword = !!credentials.email && !!credentials.password;

  if (!hasApiKey && !hasSession && !hasPassword) {
    throw new Error(
      `No credentials found. Set ${ENV_VARS.API_KEY} environment variable, ` +
        `provide apiKey in constructor, or use email/password.`
    );
  }
}
