# Changelog

All notable changes to `@uluops/ops-sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [2.0.0] - 2026-05-21

### Breaking

- **`score` is now `number | null` on response types** — `AgentSnapshotResponseSchema.score` and `AnalysisSummaryResponseSchema.score` accept `null`. Callers reading `agent.score` must now handle null (e.g., `if (agent.score != null)`). This affects any code that performs arithmetic on scores without a null check.

### Changed

- **`AgentInput.score` is now optional and nullable** — generator/executor agents that do not produce scores can omit the field entirely or pass `null`. Existing callers that always provide a numeric score are unaffected.
- **`AnalysisSummaryInput.score` is now optional and nullable** — same semantics as AgentInput.
- **`AgentInputSchema` and `AnalysisSummaryEntrySchema`** — Zod schemas updated to `.optional().nullable()` on score field.

### Migration Guide

- If you always provide a score: **no change needed**
- If you read `agent.score`: add a null check (`if (agent.score != null)`)
- Generator/executor agents: simply omit the `score` field

## [1.9.0] - 2026-05-20

### Added
- **`onRetry` callback** — new client config option fires before each retry attempt with `{ attempt, maxAttempts, error, delayMs }`. Eliminates silent retry windows — consumers can log progress, update UI, or implement custom throttling during backoff.
- **`onRateLimitApproaching` callback** — fires when rate limit remaining drops below threshold (default: 10%). Includes `rateLimitThreshold` option.

### Dependencies
- `@uluops/sdk-core` bumped to `^0.9.0` (onRetry callback)

## [1.8.10] - 2026-05-19

### Fixed
- Pinned `@uluops/sdk-core` to `^0.5.8` — fixes `ValidationError` (400) on tracker dashboard login. The v0.5.4 JWT structural validation rejected the tracker API's opaque `base64url` session tokens. Now accepts any non-empty string as a session token.
- SDK_VERSION constant synced to 1.8.10 (was 1.8.8 at time of 1.8.9 publish)
- Constructor logs resolved `baseUrl` at debug level — aids diagnosing `NODE_ENV` misconfiguration
- No-credential warning now lists all 4 credential sources checked (constructor, env var, .env, credentials.json)
- `FailureDomain` JSDoc links to canonical taxonomy spec and `client.taxonomy.get()`
- `auth-strategy.ts` JSDoc cross-references sdk-core key behaviors (retry, token refresh, credential lifecycle)
- 10 named analytics type aliases (`AgentReliabilityResult`, `BurndownResultResponse`, etc.) replace `z.infer<>` in client.ts — improves AI/IDE discoverability

## [1.8.9] - 2026-05-19

### Added
- `_skipClientValidation` option on `runs.save()`, `runs.validate()`, `runs.update()`, and `runs.updateById()` — pass `{ _skipClientValidation: true }` as the second (or third) argument to bypass client-side Zod validation. Designed for MCP and other pre-validated callers that already validate input before reaching the SDK, avoiding redundant double validation.

## [1.8.8] - 2026-05-19

### Fixed
- `listIssuesWithCount` now uses `request()` with `rawEnvelope` instead of `requestRaw()` — gains automatic retry on transient errors (502/503/504) and token refresh on 401. Previously, paginating through issues would silently fail on token expiry while all other methods auto-refreshed.
- Pinned `@uluops/sdk-core` to `^0.5.6` — picks up `rawEnvelope` option on `request()`
- Test tokens updated to pass sdk-core 0.5.4+ JWT structural validation

## [1.8.7] - 2026-05-19

### Fixed
- `explorationMaps` outer array now capped at 50 entries; metadata strings (`explorerName`, `framework`) capped at 100 chars, `artifactPath` at 500
- `categoryScores` array capped at 50 entries with `name` capped at 100 chars (both single-object and array variants of `analysisSummary`)
- `analysisRecords.recordType` capped at 50 chars, `taxonomyVersion` capped at 50 chars
- `OpsHttpClient` now validates `orgSlug` against `/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/` — rejects CRLF, spaces, and non-slug characters to prevent header injection

## [1.8.6] - 2026-05-18

### Fixed
- `AgentPerformance` type now derived from `z.infer<typeof AgentPerformanceResponseSchema>` — removes phantom `minScore`, `maxScore`, `avgDurationMs` fields that didn't exist at runtime
- README examples: `avgScore` → `averageScore` in `getAgentPerformance` and `listAgents` examples, `failure_code` → `failureCode` in `validate` and `save` JSDoc examples
- `validatePositiveInt` now populates `errors[]` with structured Zod-compatible issue (was empty `[]`)
- Restored missing changelog entries for 0.3.0–0.3.2 and 0.5.0–0.5.1

### Added
- `isValidMetric()` and `ANALYTICS_METRICS` now exported from root `@uluops/ops-sdk` — previously only accessible via internal path
- JSDoc enriched on 9 auth operations: `forgotPassword`, `resetPassword`, `getMe`, `getProfile`, `deleteAvatar`, `listApiKeys`, `revokeApiKey`, `listSessions`, `revokeSession`

## [1.8.5] - 2026-05-18

### Fixed
- All 16 exported `validate*` functions now have explicit `z.infer<typeof Schema>` return types — prevents silent contract drift when schemas evolve
- `BulkStatusUpdateItemSchema` now requires at least one of `issueId` or `id` via `.refine()` — previously both were optional with no enforcement
- `deleteProject`/`softDelete` now validate server response via `DeleteResultResponseSchema` instead of hardcoding `{ deleted: true }`
- `rawMarkdown` capped at 500,000 chars and `avatar` at 2,000,000 chars in Zod input schemas — prevents accidentally large payloads
- Pinned `@uluops/sdk-core` to `^0.5.3` — picks up CWE-316 credential clear fix (password zeroed in `finally` block)

## [1.8.4] - 2026-05-18

### Fixed
- **Breaking (type only):** `AgentPerformance.avgScore` and `AgentInfo.avgScore` renamed to `averageScore` — aligns with `AgentPerformanceResponseSchema` field name. Callers accessing `.avgScore` must update to `.averageScore`
- `SaveRunInputSchema` now validates `definitionId` (UUID format) — was accepted by TypeScript interface but bypassed Zod client-side validation
- `AgentInputSchema` now validates `definitionVersion` — field was silently stripped by Zod on save
- `runs.save()` auto-generates idempotency key via `randomUUID()` when caller does not provide one — prevents duplicate runs on retry
- Broken README import paths: `SaveRunInput` from `types/runs` (was `types/schemas`), `Credentials` from `config` (was `types/auth`)
- Debug-mode unauthenticated warning no longer fires when email/password login is planned
- `deleteProject`/`softDelete` deduplicated via private `deleteWithConfirmation` helper
- `buildIssueListParams` widening cast removed — `QueryParams` assignable to `object` directly
- `listIssuesWithCount` JSDoc upgraded to `@remarks` with full reliability caveat documentation
- `toApiQuery` JSDoc now documents the `'all'` stripping convention with `StatusFilter`/`PriorityFilter` context
- Ghost `dist/operations/admin.*` artifacts cleaned; build script now runs `rm -rf dist` before `tsc`
- `response-schemas.ts` barrel removed from public `@uluops/ops-sdk/types` export (semver protection)
- `getByMetric` now throws `InputValidationError` instead of bare `Error`
- `validateUuid`/`validateRequiredString` now populate `errors[]` with synthetic Zod-compatible issues
- `npm audit` gate added to `prepublishOnly` script

### Added
- `npm audit --audit-level=high` in `prepublishOnly` — blocks publish on high-severity vulnerabilities
- SDK_VERSION sync test — asserts `constants.ts` matches `package.json` via `createRequire`
- Tests for `getAgentRunsAnalysis`, `getAgentLifecycle`, `getAvatar` (3 previously untested public functions)
- Response validation tests for `listByProject` and `getLatest` operations
- `redactSensitive` boundary test at length=5
- README: exports table expanded to 12 rows, sign-up URL, `AnalyticsMetric` type example, analysis output shapes
- CHANGELOG: `[Unreleased]` section, missing `[1.7.0]` entry restored
- JSDoc enriched on 6 analytics/project operations, `runs.save()` `@example`, `isValidMetric()` `@example`

## [1.8.3] - 2026-05-18

### Fixed
- `TaxonomySchema` type alias renamed to `TaxonomyResponse` — "Schema" suffix was inconsistent with codebase convention where it means Zod runtime object. Deprecated `TaxonomySchema` alias preserved for backward compatibility.
- `diff()`, `getLatest()`, `getDetails()` now route query parameters through `toApiQuery()` for consistent camelCase→snake_case conversion, matching all other operations
- `InputValidationError` now exported from `@uluops/ops-sdk/errors` barrel — previously only accessible via `@uluops/ops-sdk/config`
- JSDoc on `AgentInput`, `RecommendationInput`, `RunSummaryInput` updated from stale `save_features_list` references to `save_run`
- Removed `category_performance` from `ANALYTICS_METRICS` — API does not support this metric

## [1.8.2] - 2026-05-18

### Added
- `client.auth.getAvatar()` — was implemented in `operations/auth.ts` but missing from the `OpsClient.auth` namespace

### Fixed
- `SDK_VERSION` constant synced to match `package.json` (was stuck at `1.4.0`)

### Removed
- Deprecated `validateSaveFeaturesListInput` alias — use `validateSaveRunInput` directly

## [1.8.1] - 2026-05-12

### Changed
- `SaveRunInputSchema.analysisSummary` now accepts single object (backward compat) or per-agent array — enables per-agent analysis summaries on pipeline saves without requiring `update_run` enrichment
- `SaveRunInput.analysisSummary` type widened to `AnalysisSummaryInput | AnalysisSummaryInput[]`

## [1.8.0] - 2026-05-11

### Added
- `explorationMaps` field on `AnalysisSummaryInput` and `AnalysisSummaryResponseSchema` — captures structural mappings from Explorer-class agents (level maps, atomic inventories, relational topologies, claim extractions, inquiry agendas)
- `ExplorationMap` interface with typed `sections` array supporting 8 section types: `inventory`, `topology`, `landscape`, `classification`, `mapping`, `synthesis`, `limitation`, `agenda`
- `ExplorationMapResponseSchema` Zod schema for response validation
- Section type interfaces: `InventorySection`, `TopologySection`, `LandscapeSection`, `ClassificationSection`, `MappingSection`, `SynthesisSection`, `LimitationSection`, `AgendaSection`

## [1.7.3] - 2026-05-11

### Fixed
- `AgentRunsAnalysisResponseSchema` now uses `{ items, total }` shape matching SDK envelope unwrap convention
- Removed `runStatus` field from `AgentRunSummaryResponseSchema` (column does not exist on pipeline_runs)

## [1.7.2] - 2026-05-11

### Added
- `getAgentRunsAnalysis(agentName, query)` operation on `runs` namespace — fetches analysis summaries with run context (run number, timestamp, workflow type, snapshot score) for a specific agent
- `AgentRunSummary` type — analysis summary extended with run metadata
- `AgentRunsAnalysisQuery` type — query options (project, decision, limit, offset)
- `AgentRunSummaryResponseSchema` and `AgentRunsAnalysisResponseSchema` Zod schemas

## [1.7.1] - 2026-05-10

### Added
- `agentName` field on `AnalysisRecordInput` and `AnalysisSummaryInput` — per-item agent attribution, overrides run-level default
- `analysisSummary` on `UpdateRunInput` accepts single object or array of per-agent summaries

## [1.7.0] - 2026-05-10

### Added
- `analysisRecords` and `analysisSummary` fields on `UpdateRunInput` — enables post-hoc enrichment of runs with structured analysis data (replace semantics)

## [1.6.0] - 2026-05-06

### Added
- `'high'` priority level — new value in `Priority` const and `PRIORITIES` array, sorted between `critical` and `suggested`

## [1.4.0] - 2026-04-16

### Added
- `summary` field on `AgentInput` — optional per-agent human-readable summary, stored in tracker's `agent_snapshots` table
- `summary` field on `AgentSnapshotResponseSchema` — surfaces stored summaries on the read path
- `definitionVersion` field on `AgentSnapshotResponseSchema` — was missing since DB migration 031

## [1.3.0] - 2026-04-14

### Changed
- **Breaking:** `ClassifiedBy.Validator` renamed to `ClassifiedBy.Agent` — aligns with DB migration 034 (`classified_by_validator` → `classified_by_agent`)

### Added
- `statuses` and `failureCodePattern` fields on `TaxonomyResponseSchema`

### Fixed
- `TrendSummary` response schema corrected to match API response shape
- Removed dead `UserRoleSchema` and `SubscriptionTierSchema`

## [1.2.0] - 2026-04-10

### Added
- `observation` status support — new `Observation` value in `Status` const and `STATUSES` array
- `observed` field in `CorrelationResultResponseSchema` (optional for backward compatibility with older API versions)

## [1.1.0] - 2026-04-09

### Fixed
- Package description updated to reflect full SDK scope (tracker, analytics, auth, org management)
- `issues.search()` refactored to use `toApiQuery()` instead of manual query serialization
- `normalizeKeys()` now guards against prototype pollution (`__proto__`, `constructor`, `prototype` keys) — matches `deepMerge()` behavior
- README version updated from 0.7.0 to 1.0.1
- README Quick Start base URL comment corrected (defaults to production, not localhost)
- JSDoc on `OpsClientConfig.baseUrl` corrected to document NODE_ENV-conditional default
- `files` field in package.json now includes README.md and CHANGELOG.md in published tarball

## [1.0.0] - 2026-04-08

### Changed
- **Breaking:** All response types now derived from Zod schemas via `z.infer<>` — hand-written interfaces removed. Type shapes are identical but provenance changed. Consumers importing types may see different IDE hover text.
- `SDK_VERSION` constant synced to `1.0.0`

### Added
- Phase 6: Response types derived from Zod schemas — single source of truth for all domain types (Run, Issue, Project, Auth, Analytics)

## [0.10.1] - 2026-04-08

### Fixed
- `deleteProject` and `softDelete` return 204 no-content handling

## [0.10.0] - 2026-04-08

### Added
- Phase 5: Response schemas wired into all analytics operations — runtime validation on all 14 analytics endpoints

## [0.9.4] - 2026-04-08

### Fixed
- `ValidateRunResponse.preview` contains arrays not counts

## [0.9.3] - 2026-04-08

### Fixed
- `ValidateRunResponse` and `ProjectTrends` schemas aligned to API reality

## [0.9.2] - 2026-04-08

### Fixed
- `Issue.deletedAt` stripped by API `issueToPublic` — removed from schema

## [0.9.1] - 2026-04-08

### Fixed
- `Project` and `ProjectSummary` schemas aligned to API reality

## [0.9.0] - 2026-04-08

### Added
- Phase 4: Response schemas wired into issue, project, and auth operations

## [0.8.2] - 2026-04-08

### Fixed
- `ArchiveRunsResult` schema aligned to API reality

## [0.8.1] - 2026-04-08

### Fixed
- `RunDetailsResponseSchema` aligned to API reality

## [0.8.0] - 2026-04-08

### Added
- Phase 3: Response schemas wired into all run operations — runtime Zod validation on every runs endpoint
- Phase 1: All response schemas aligned to API reality (optional→required where API guarantees, missing fields added)
- `@uluops/sdk-core` bumped to 0.3.0 (adds `patch()` schema support and `ResponseValidationError`)

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

## [0.5.1] - 2026-04-01

### Changed
- Bumped `@uluops/sdk-core` dependency (patch fixes)

## [0.5.0] - 2026-03-28

### Changed
- Bumped `@uluops/sdk-core` to ^0.5.0

## [0.4.0] - 2026-03-15

### Removed
- Admin operations removed from public SDK surface (moved to dashboard-only)

### Changed
- Bumped version to reflect breaking change

## [0.3.2] - 2026-03-12

### Changed
- Bumped version for dependency update

## [0.3.1] - 2026-03-10

### Fixed
- Analysis methods wired to `OpsClient.runs` facade — `getAnalysis`, `getProjectAnalysis`, `queryAnalysisRecords` were accessible via operations module but not from the client class

## [0.3.0] - 2026-03-08

### Added
- Analysis storage support — `analysisRecords` and `analysisSummary` fields on `SaveRunInput`

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
