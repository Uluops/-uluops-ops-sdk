// Main client
export { OpsClient, type OpsClientConfig } from './client.js';

// HTTP client (for advanced usage)
export { OpsHttpClient, type HttpClientConfig, type QueryParams, type QueryParamValue } from './http/http-client.js';
export { ApiKeyAuth, JwtSessionAuth, createAuthStrategy, type AuthStrategy, type AuthConfig } from './http/auth-strategy.js';

// Errors
export * from './errors/errors.js';

// All types
export * from './types/index.js';

// Config utilities
export { loadCredentials, loadConfig, type Credentials, type SdkConfig } from './config/loaders.js';
export { DEFAULT_BASE_URL, API_KEY_PREFIX, ENV_VARS } from './config/constants.js';
