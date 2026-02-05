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
- Runtime input validators using Zod schemas
- Granular package.json exports for tree-shaking (`/types`, `/errors`, `/config`)
- Comprehensive test suite with 314+ tests

### Changed
- Migrated HTTP layer from axios to native fetch (zero runtime HTTP dependencies)
- Extracted CLI to dedicated `@uluops/cli` package
- Retry logic now only retries idempotent methods (GET/PUT/DELETE)

### Fixed
- Safe JSON parsing on success-path responses (handles empty/non-JSON bodies)
- Token refresh errors now logged instead of silently swallowed
- Login response validated before destructuring to prevent undefined values
- `getAvatar()` uses binary response handling instead of JSON parsing
- `Error.captureStackTrace` guarded for non-V8 runtimes
- `encodeURIComponent` applied to all URL path parameters
- Debug logging for credential loading errors
