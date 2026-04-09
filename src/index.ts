/**
 * @uluops/ops-sdk — Public API surface
 *
 * - OpsClient: High-level client with namespaced operations (runs, projects, issues, analytics, taxonomy)
 * - OpsHttpClient: Low-level HTTP client for advanced/custom usage
 * - Errors: Typed error hierarchy (NotFoundError, RateLimitError, etc.) with type guards
 * - Types: All domain interfaces (Run, Issue, AgentInput, SaveRunInput, etc.)
 * - Config: Credential loading and environment variable helpers
 */

// Main client — the primary entry point for most consumers
export { OpsClient, type OpsClientConfig } from './client.js';

// HTTP client — for consumers who need direct HTTP access or custom auth strategies
export { OpsHttpClient, type HttpClientConfig, type QueryParams, type QueryParamValue } from './http/http-client.js';
export { ApiKeyAuth, JwtSessionAuth, createAuthStrategy, type AuthStrategy, type AuthConfig } from './http/auth-strategy.js';

// Errors — typed error classes and type guards for precise error handling
export * from './errors/errors.js';

// Types — all domain interfaces, input/output shapes, and enums
export * from './types/index.js';

// Config — credential loading from env vars, .env files, and ~/.uluops/credentials.json
export { loadCredentials, loadConfig, loadEnvFiles, type Credentials, type SdkConfig } from './config/loaders.js';
export { DEFAULT_BASE_URL, API_KEY_PREFIX, ENV_VARS } from './config/constants.js';
