# Changelog

All notable changes to `@uluops/ops-sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-02-05

### Added
- Initial SDK for UluOps validation tracker API
- `OpsClient` with namespaced operations: auth, projects, runs, issues, analytics, taxonomy, admin
- `OpsHttpClient` with native fetch, retry logic, timeout handling, and exponential backoff
- JWT session auth and API key auth strategies with automatic token refresh
- Typed error classes: `ValidationError`, `UnauthorizedError`, `NotFoundError`, `RateLimitError`, etc.
- Configuration loading from environment variables, `.env` files, and `~/.uluops/credentials.json`
- Runtime input validators using Zod schemas wired into all 5 operation modules
- Granular package.json exports for tree-shaking (`/types`, `/errors`, `/config`)
- ESLint with typescript-eslint flat config (ESLint 9)
- Password schema with complexity requirements (lowercase, uppercase, digit)
- Typed generic overloads for `analytics.getByMetric()` via `AnalyticsMetricResultMap`
- Token refresh race condition protection with promise deduplication
- Credential sanitization in `OpsApiError.toJSON()` via `sanitizeForDisplay()`
- `QueryParams`/`QueryParamValue` types for HTTP client methods
- Shared `buildIssueListParams()` utility for issue listing endpoints
- JSDoc `@param`/`@returns` on all exported helpers
- Comprehensive test suite with 467 tests across 16 files

### Changed
- Migrated HTTP layer from axios to native fetch (zero runtime HTTP dependencies)
- Extracted CLI to dedicated `@uluops/cli` package
- Retry logic now only retries idempotent methods (GET/PUT/DELETE)
- SDK sends camelCase directly to API (removed snake_case conversion layer)
- Restricted barrel exports: `config/index.ts` exposes consumer-facing constants only; `utils/index.ts` exposes `createLogger` and `Logger` type only
- Removed 14 unnecessary `as Record<string, unknown>` type casts across operation files

### Fixed
- Safe JSON parsing on success-path responses (handles empty/non-JSON bodies)
- Token refresh errors now logged instead of silently swallowed
- Login response validated before destructuring to prevent undefined values
- `getAvatar()` uses binary response handling instead of JSON parsing
- `Error.captureStackTrace` guarded for non-V8 runtimes
- `encodeURIComponent` applied to all URL path parameters
- Debug logging for credential loading errors
- Admin/analytics endpoints receiving snake_case when they expected camelCase
- Test data corrected by validators: invalid role enums, non-UUID IDs, wrong field names

### Testing
- 467 tests across 16 test files (up from 314)
- Schema-validated mock factories with contract helpers for all response types
- Nock interceptor leak detection in test setup (unconsumed = implicit assertion)
- Return value verification on all 18 validator test suites (mutation resistance)
- Error path inspection on validation failures (message content, error paths, statusCode)
- Explicit `nock.isDone()` assertions on retry logic tests
- Shared test constants (`TEST_API_KEY`, `TEST_UUID`) eliminating magic strings
- 52 error constructor edge case tests
- HTTP timeout boundary tests
- `query-utils.test.ts` with full branch coverage
