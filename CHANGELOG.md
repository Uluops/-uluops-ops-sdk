# Changelog

All notable changes to `@uluops/ops-sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.7.0] - 2026-04-08

### Added
- `archivedAt` and `archiveReason` fields on `UpdateRunInput` — enables archive/unarchive via the standard update endpoint
- `updateById()` now forwards `archivedAt` and `archiveReason` to the API
- `update()` (by project+number) now forwards `archivedAt` and `archiveReason` to the API
- `orgSlug` constructor option on `OpsClient` for multi-tenancy (sets `X-Org-Slug` header)

### Fixed
- **Breaking:** `AgentInput.decision` and `AgentSnapshot.decision` now match Zod schemas — previously the TypeScript interfaces used `decision` while `AgentInputSchema` and `AgentSnapshotResponseSchema` used `status`, causing runtime validation failures for consumers following the TypeScript types
- `SDK_VERSION` constant synced to `0.7.0`

### Removed
- Admin operations (`client.admin.*`) — removed from public SDK surface. Use the dashboard or direct API for admin tasks.
- Dead admin test suites (16 tests referencing removed operations)

### Docs
- README: removed 165-line Admin Operations section documenting removed `client.admin.*`
- README: Quick Start examples use `decision` (not `status`) and `inputTokens` (not `input_tokens`)
- README: fixed stale type import (`SaveFeaturesListInput` → `SaveRunInput`)
- README: version badge updated from 0.3.1 to 0.7.0
- README: documented `orgSlug` constructor option

## [0.6.0] - 2026-04-06

### Added
- `ULUOPS_SESSION_TOKEN` environment variable support for session-based auth

## [0.4.0] - 2026-03-15

### Removed
- Admin operations removed from public SDK surface (moved to dashboard-only)

### Changed
- Bumped version to reflect breaking change

## [0.2.0] - 2026-03-01

### Added
- Analysis operations: `getAnalysis()`, `getProjectAnalysis()`, `queryAnalysisRecords()`
- `AnalysisRecord` and `AnalysisSummary` types for structured analysis data
- `definitionType`, `definitionName`, `definitionVersion`, `definitionHash` fields on `SaveRunInput`

## [0.1.5] - 2026-02-15

### Fixed
- `getVelocity`, `getDiscovery`, `getValidatorMatrix` now use `toApiQuery()` for consistent snake_case query parameter conversion (was manually constructing query objects, bypassing conversion)

### Improved
- `OpsClient` class JSDoc with authentication mode examples and usage patterns
- `login()` JSDoc clarifies relationship with `auth.login()` (install-session vs raw-token)
- `listValidators()` JSDoc documents O(n) complexity note
- README: `updateProfile` documents "at least one field required" constraint
- README: `getByMetric` lists all available metric names
- README: low-level HTTP client section warns to prefer `OpsClient`

## [0.1.4] - 2026-02-15

### Fixed
- Query parameters now sent as snake_case to match API expectations (`failureDomain` → `failure_domain`, `includeResolved` → `include_resolved`, etc.)
- `priority=all` filter value stripped before sending (API rejects it; omitting means "all")
- `lineNumber` field now accepts `null` in `RecommendationInputSchema` and `CreateUserIssueInputSchema` (`.optional()` → `.nullish()`)
- `deepMerge` utility now guards against prototype pollution (`__proto__`, `constructor`, `prototype` keys)
- `formatDate` now throws `RangeError` on invalid date strings instead of returning `"Invalid Date"`

### Added
- `toApiQuery()` utility for centralized camelCase→snake_case query parameter conversion
- JSDoc descriptions on all 7 operation group properties in `OpsClient`
- Documented `requestRaw` tradeoff in `listIssuesWithCount` (no retry/refresh for envelope access)

### Changed
- `RegisterResponseSchema` now requires `id`, `email`, `isActive`, `role`, `createdAt`, `updatedAt` (were optional)
- `LoginResponseSchema` documented `sessionToken`/`token` backward compatibility

## [0.1.3] - 2026-02-15

### Added
- `normalizeKeys<T>()` — recursive snake_case→camelCase key conversion with mapped types
- `getFlexibleProperty()` — dual-case property access for mixed API responses
- `retryMutations` option on `runs.save()` for idempotent retry safety
- `loadEnvFiles()` — loads `.env` from cwd and `~/.uluops/.env`
- `listIssuesWithCount()` — paginated issue listing preserving API envelope count
- `listValidators()` — derived validator list from performance data
- `updateById()` — update a run by UUID (vs by project+runNumber)
- `updateStatusByFingerprint()` — update issue status by fingerprint hash

### Fixed
- Error guards on all SDK error classes (missing `instanceof` checks)
- Delete operations now return `{ deleted: true }` result type

## [0.1.2] - 2026-02-08

### Added
- `readFileOption` helper for CLI file argument parsing
- `parseIntOption`/`parseFloatOption` for safe CLI numeric parsing
- Global `unhandledRejection` handler in CLI entry point
- `--timeout` flag for CLI commands
- 503 `Retry-After` header support in retry logic
- `retryMutations` option for POST requests that are safe to retry
- EACCES error handling for config file writes

### Fixed
- Retry logic respects `Retry-After` header from 503/429 responses
- Config directory creation handles permission errors gracefully

## [0.1.1] - 2026-02-07

### Changed
- SDK core extraction: shared HTTP client, auth strategies, and utilities moved to `@uluops/sdk-core`
- Aligned SDK types with actual API response shapes

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
