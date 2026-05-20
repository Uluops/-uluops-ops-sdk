/**
 * Auth strategies re-exported from @uluops/sdk-core.
 *
 * All auth logic (API key validation, JWT session management, token refresh,
 * credential loading) is implemented in `@uluops/sdk-core/http`. This SDK
 * re-exports the configuration layer; see sdk-core source for:
 * - Token refresh lifecycle and `clearCredentialsAfterLogin` behavior
 * - Retry logic, backoff, and rate limit handling
 * - `requestRaw` / `requestBinary` methods (no retry/refresh — by design)
 */
export {
  ApiKeyAuth,
  JwtSessionAuth,
  createAuthStrategy,
  type AuthStrategy,
  type AuthConfig,
} from '@uluops/sdk-core/http';
