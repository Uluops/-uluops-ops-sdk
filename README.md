**[UluOps](https://uluops.ai)** · The operations layer for agentic work

---

# @uluops/ops-sdk

[![npm version](https://img.shields.io/npm/v/@uluops/ops-sdk.svg)](https://www.npmjs.com/package/@uluops/ops-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20.3+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

Official TypeScript SDK with Zod runtime validation for the UluOps platform API. Track execution runs, manage issues, analyze trends, and integrate agent pipelines into your workflow.

See the [Changelog](./CHANGELOG.md) for the current version and release history.

## Quick Start

### Programmatic Usage

```typescript
import { OpsClient } from '@uluops/ops-sdk';

// Auto-loads credentials from ULUOPS_API_KEY env var, .env file, or ~/.uluops/credentials.json
const client = new OpsClient();

// Or pass an API key explicitly
// const client = new OpsClient({ apiKey: 'ulr_your-api-key-here' });

// Save an execution run
const result = await client.runs.save({
  project: 'my-project',
  workflowType: 'post-implementation',
  agents: [
    { name: 'code-validator', score: 85, decision: 'PASS' },
    { name: 'test-architect', score: 72, decision: 'APPROVED' },
  ],
  recommendations: [
    {
      agent: 'code-validator',
      title: 'Missing error handling',
      priority: 'suggested',
      filePath: 'src/api/client.ts',
      lineNumber: 42,
    },
  ],
});

// `correlation` is null on an idempotent replay of a run saved before correlation persistence
console.log(`Run #${result.run.runNumber} saved: ${result.correlation?.newIssues ?? 'n/a'} new issues`);
```

### Search Issues

```typescript
const issues = await client.issues.search({
  query: 'authentication',
  status: 'open',
  priority: 'critical',
});

for (const issue of issues) {
  console.log(`[${issue.severity}] ${issue.title} — ${issue.filePath}:${issue.lineNumber}`);
}
```

### Project Analytics

```typescript
const burndown = await client.analytics.getBurndown({
  project: 'my-project',
  days: 30,
});

for (const [domain, trend] of Object.entries(burndown.trends)) {
  console.log(`${domain}: ${trend.trend} (avg daily change: ${trend.avgDailyChange})`);
}
```

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Authentication](#authentication)
- [TypeScript Support](#typescript-support)
- [API Reference](#api-reference)
  - [Auth Operations](#auth-operations)
  - [Project Operations](#project-operations)
  - [Run Operations](#run-operations)
  - [Issue Operations](#issue-operations)
  - [Analytics Operations](#analytics-operations)
  - [Taxonomy Operations](#taxonomy-operations)
  - [Org Operations](#org-operations)
  - [Admin Operations](#admin-operations)
  - [Health Check](#health-check)
- [Environment Variables](#environment-variables)
- [Error Handling](#error-handling)
- [Advanced Usage](#advanced-usage)
- [CLI](#cli)
- [Input Validation](#input-validation)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

The UluOps SDK provides programmatic access to the UluOps platform API, enabling you to:

- **Track Execution Runs**: Save agent, workflow, and pipeline results with scores, recommendations, and analysis
- **Manage Issues**: Create, search, update, and track issues across projects
- **Analyze Trends**: Get burndown charts, velocity metrics, and taxonomy distribution analytics
- **Automate Workflows**: Integrate execution tracking into CI/CD and agent pipelines

The SDK covers the full platform API surface across 8 operation domains with full TypeScript support.

## Features

- **Full API Coverage**: auth, projects, runs, issues, analytics, taxonomy, orgs, and admin domains
- **Type-Safe**: Complete TypeScript definitions; every response is Zod-parsed before it is returned. Write inputs are Zod-validated as a gate (the raw input is what goes to the wire, and the primary writers may pass `_skipClientValidation`) — see [Runs Operations](#runs-operations) for which fields each write validates
- **Dual Authentication**: API key (preferred) and JWT session support
- **Automatic Retries**: Exponential backoff for transient errors (502, 503, 504, 429, network failures)
- **Error Hierarchy**: Typed errors for precise error handling
- **Subpath Exports**: Import only what you need (`@uluops/ops-sdk/types`, `@uluops/ops-sdk/errors`)

## Installation

```bash
# npm
npm install @uluops/ops-sdk

# yarn
yarn add @uluops/ops-sdk

# pnpm
pnpm add @uluops/ops-sdk

# bun
bun add @uluops/ops-sdk
```

**Requirements:**
- Node.js 20.3.0 or higher (enforced by `engines` in `package.json`)
- TypeScript 5.0+ (for TypeScript users)

**Dependencies:**
- [`@uluops/sdk-core`](https://www.npmjs.com/package/@uluops/sdk-core) — Shared HTTP client, auth strategies, and utilities (installed automatically)
- [`zod`](https://www.npmjs.com/package/zod) — Runtime schema validation (installed automatically)

## Authentication

The SDK supports two authentication methods. To get an API key, visit the [UluOps Dashboard](https://app.uluops.ai) or create one programmatically via `client.auth.createApiKey()`.

### API Key Authentication (Recommended)

API keys provide persistent authentication without session management. Keys must start with the `ulr_` prefix.

```typescript
import { OpsClient } from '@uluops/ops-sdk';

const client = new OpsClient({
  apiKey: 'ulr_your-api-key-here',
});

// Check authentication status
console.log(client.isAuthenticated()); // true
console.log(client.getAuthType()); // 'api_key'
```

### Session-Based Authentication

For interactive applications, use `client.login()` which installs the session and, by default, re-logs in on a 401:

```typescript
import { OpsClient } from '@uluops/ops-sdk';

const client = new OpsClient();

// Login — installs session auth with automatic token refresh
const { sessionToken, user } = await client.login(
  'user@example.com',
  'your-password',
);

// Client is now authenticated — subsequent requests use the session token
const { data: projects } = await client.projects.list();

// Logout when done
await client.logout();
```

> **Note:** Prefer `client.login()` over `client.auth.login()`. The latter only returns the token without installing it, requiring manual client construction.

**Accounts with MFA (6.4.0).** For an account with TOTP or a passkey enrolled, `POST /auth/login`
answers a *challenge*, not a session, and `client.login()` throws `MfaRequiredError` carrying
`mfaChallengeToken`, `expiresAt` and `mfaMethods`. Complete it with the current code:

```typescript
import { isMfaRequiredError } from '@uluops/ops-sdk';

try {
  await client.login(email, password);
} catch (err) {
  if (!isMfaRequiredError(err)) throw err;
  await client.loginWithTotp(err.mfaChallengeToken, '123456'); // installs the session
}
```

**The challenge token is single-use and is consumed before the code is checked** — a mistyped
code burns it; do not loop on `loginWithTotp` with the same token, call `login()` again for a fresh
challenge. A TOTP-installed session has no password to re-login with, so it is **not**
auto-refreshed: when it expires, requests fail `401` and you log in again. (Before 6.4.0 an MFA
account could not log in through `login()` at all — the challenge body failed the session schema
with a `ZodError`.) `MfaRequiredError` is raised by `login()` / `auth.login()` **only**: a client
constructed with `{ email, password }` (or autoloaded credentials) logs in inside sdk-core, which
cannot see the challenge and surfaces a generic `UnauthorizedError` — MFA accounts must use the
two-step path. WebAuthn completion is not offered here.

**What "auto-refresh" does — read before scripting against a session.** With the default
`login()`, the password is kept so sdk-core can re-login when a request answers 401. That refresh
is a *fresh login*: under the API's default single-session policy it **revokes the user's other
sessions** (your dashboard tab); **mutations are not retried** afterwards (the POST that hit the 401
still throws it); and the budget is **one** (the password is cleared after the first re-login).
For a script — the Phase 4 migration, anything that shares the account with a dashboard — pass
`{ autoRefresh: false }` so a 401 means *stop*, untouched:

```typescript
await client.login(email, password, { autoRefresh: false }); // session without a password → no re-login
```

### Credential Priority Chain

The SDK loads credentials in the following order:

1. **Constructor arguments**: `apiKey`, `sessionToken`, `email`/`password`
2. **Environment variables**: `ULUOPS_API_KEY`, `ULUOPS_EMAIL`, `ULUOPS_PASSWORD`
3. **Local `.env` file**: In the current working directory
4. **Global credentials**: `~/.uluops/credentials.json`

## TypeScript Support

The SDK is written in TypeScript with full type definitions. Import types directly:

```typescript
// Main client
import { OpsClient, type OpsClientConfig } from '@uluops/ops-sdk';

// Types only
import type {
  Project,
  Issue,
  Run,
  AgentPerformance,
  Priority,
  Status,
  Severity,
  // Issue history envelope (added in 3.2.0 — see CHANGELOG)
  IssueHistoryEnvelope,
  HistoryEvent,
  HistoryOccurrenceEvent,
  HistoryStatusEvent,
  HistoryNoteEvent,
  TransitionType,
} from '@uluops/ops-sdk/types';

// Errors only
import {
  OpsApiError,
  ValidationError,
  NotFoundError,
  RateLimitError,
} from '@uluops/ops-sdk/errors';

// Config utilities (also re-exported from the package root)
import {
  loadCredentials,   // resolve credentials from options > env > credentials.json
  loadConfig,        // resolve full config (credentials + connection settings)
  loadEnvFiles,      // load .env files into process.env before reading config
  DEFAULT_BASE_URL,  // default API base URL
  ENV_VARS,          // map of the env var names the SDK reads
  API_KEY_PREFIX,    // expected API key prefix ('ulr_')
} from '@uluops/ops-sdk/config';
```

### Package Exports

| Export Path | Contents |
|------------|----------|
| `@uluops/ops-sdk` | Main `OpsClient`, `OpsHttpClient`, auth strategies, config helpers, all types |
| `@uluops/ops-sdk/types` | All TypeScript types and Zod input schemas |
| `@uluops/ops-sdk/types/projects` | Project types only |
| `@uluops/ops-sdk/types/issues` | Issue types only |
| `@uluops/ops-sdk/types/runs` | Run types only |
| `@uluops/ops-sdk/types/analytics` | Analytics types only |
| `@uluops/ops-sdk/types/enums` | Priority, Status, Severity enums + failure-code helpers (`parseFailureCode`, `buildFailureCode`, `severityFromCode`) |
| `@uluops/ops-sdk/types/responses` | API response types |
| `@uluops/ops-sdk/types/schemas` | Zod input validation schemas |
| `@uluops/ops-sdk/types/auth` | Auth/credential types |
| `@uluops/ops-sdk/errors` | Error classes and utilities |
| `@uluops/ops-sdk/config` | Configuration loaders, constants, and input validators |

#### Granular Type Imports

For minimal bundle size, import only the type modules you need:

```typescript
import type { Project } from '@uluops/ops-sdk/types/projects';
import type { Issue } from '@uluops/ops-sdk/types/issues';
import type { Run, SaveRunInput } from '@uluops/ops-sdk/types/runs';
import type { BurndownResult } from '@uluops/ops-sdk/types/analytics';
import type { Priority, Status, Severity } from '@uluops/ops-sdk/types/enums';
import type { ApiResponse } from '@uluops/ops-sdk/types/responses';
import type { Credentials } from '@uluops/ops-sdk/config';
```

#### Failure Code Utilities

The `types/enums` subpath also ships runtime helpers for working with failure codes (the `DOMAIN-MODE/SEVERITY` taxonomy on recommendations):

```typescript
import { parseFailureCode, buildFailureCode, severityFromCode } from '@uluops/ops-sdk/types/enums';

parseFailureCode('SEM-INC/H'); // { domain: 'SEM', mode: 'INC', severityCode: 'H' } — or null if malformed
buildFailureCode('SEM', 'INC', 'H'); // 'SEM-INC/H'
severityFromCode('H'); // 'high' — or null if the code is unknown
```

## API Reference

### Client Configuration

```typescript
const client = new OpsClient({
  // Authentication (choose one)
  apiKey: 'ulr_...',           // API key (preferred)
  sessionToken: 'jwt-token',   // Existing session token
  email: 'user@example.com',   // Email for login
  password: 'password',        // Password for login

  // Connection settings (baseUrl defaults to https://api.uluops.ai/api/v1)
  timeout: 30000,              // Request timeout in ms (default: 30000)
  retries: 3,                  // Retry count for transient errors (default: 3)
  debug: false,                // Enable debug logging

  // Multi-tenancy
  orgSlug: 'my-org',           // Org slug (sets X-Org-Slug header on all requests);
                               // any method's trailing `{ org }` overrides it per call

  // Callbacks
  onTokenRefresh: (token) => { /* handle token refresh */ },
  onRateLimitApproaching: (info) => {
    console.warn(`Rate limit: ${info.remaining}/${info.limit} remaining, resets ${info.reset}`);
  },
  onRetry: ({ attempt, maxAttempts, error, delayMs }) => {
    console.warn(`Retry ${attempt}/${maxAttempts} after ${delayMs}ms: ${error.message}`);
  },
  onSecurityEvent: (event) => { /* route to telemetry — see "Security Events" */ },
});
```

#### Org routing — which org a call lands in

Every project, run, issue and analytics method takes a trailing `options` with `org?: string`
(run writes: `RunCallOptions`, which also carries `_skipClientValidation`). It becomes the
`X-Org-Slug` header on that one request.

```typescript
await client.runs.save(input, { org: 'ulu-labs' });          // this call → ulu-labs
await client.projects.list({ org: 'ulu-labs' });               // reads take it too
await client.projects.list();                                  // → constructor orgSlug, else your personal org
```

**Precedence on the wire, lowest to highest:** personal org (no header) < constructor `orgSlug`
< per-call `org`. An API key **bound** to an org ignores both headers and answers
`403 ORG_ACCESS_DENIED` if they name a different org. The API never infers an org from a project
name: a call that names no org creates or targets the *personal* project of that name, even when
a work org has one by the same name (spec D2). Name the org.

These org-routing errors are worth branching on (all exported with type guards):

| Code | Status | Guard | What to do |
|---|---|---|---|
| `INSUFFICIENT_ORG_ROLE` | 403 | `isInsufficientOrgRoleError` | Your role in that org is below `publisher`. **Do not retry without `org`** — an org-less retry files the work in your personal org; the API says so in the body (`details.applied: false`). |
| `ORG_ACCESS_DENIED` | 403 | `isOrgAccessDeniedError` | Not a member of that org, or your key is bound to a different one. Terminal. |
| `PROJECT_REHOMED` | 410 | `isProjectRehomedError` | The project moved orgs. `err.details.target_org.slug` is where it lives — pass it as `org` and retry the same call. |
| `SESSION_REQUIRED` | 403 | `isSessionRequiredError` | A session-only admin route refused an API key (D20). Log in; never mint another key to get past it. |
| `INSUFFICIENT_ROLE` | 403 | `isInsufficientRoleError` | The admin path needs the *platform* role (`users.role = admin`); no `org` argument changes it. Terminal. |

Low-level: `new OpsHttpClient(cfg).withOrg('acme')` returns a view of the client scoped to that org.

**Where does the default come from?** For tools that run inside a checkout (the CLI, the tracker
MCP), `resolveWorkspaceOrg({ explicit, cwd })` implements the spec's D13 rule: an explicit value
wins; else the nearest `.uluops.json` above `cwd` (`{ "org": "ulu-labs" }`, or `{ "org": "personal" }`
to stop the walk in a personal repo nested under a work tree); else `ULUOPS_ORG_SLUG`; else your
personal org. The file may carry only `org`, `project` and `$schema` — any other key is refused, not ignored.
**`project` (6.5.0, ulu log D5)** is the project name a *read* command resolves when given none —
`ulu log` today; it governs reads only (no write path consumes it; `ulu exec` keeps flag → env →
inferred basename). Read it with `readWorkspaceFile(path)` → `{ org?, project? }`; a file carrying
`project` **must** carry `org` (`"personal"` allowed) or the reader throws, so a project-only file can
never shadow an outer org. `readWorkspaceOrgFile(path)` keeps its signature and now returns the org
of such a file instead of refusing it. **Do not write `project` into a checkout until every installed
`@uluops/ops-sdk` in that tree is ≥ 6.5.0** — older readers throw on the key, for every command.
Two more refusals since 6.3.1 (security audit run #187): the walk never rises above your home
directory (a file at `/` or `/Users` cannot become everyone's default), and a file owned by another
user is refused (a shared parent directory is the planting vector). `"personal"` is also honoured as
an explicit value — `{ org: 'personal' }` sends no header. On a scoped call the per-call org header
is set last and an `X-Org-Slug`/`X-Org-Id` in `options.headers` is refused.

The pieces it is built from are exported too: `findWorkspaceOrgFile(cwd)` (the bounded upward walk, returning the path of the `.uluops.json` that answered), `WORKSPACE_ORG_FILE` (the file name, `.uluops.json`) and `PERSONAL_ORG_SENTINEL` (`"personal"`, the value that stops the walk and means "no org"). Reach for them when a tool wants to report *which* file answered, as the CLI does.

---

### Security Events

Since `@uluops/sdk-core@0.14.0`, the client exposes a structured security-event channel. Pass `onSecurityEvent` to route the security-relevant events the client already observes to your telemetry sink, instead of scraping logs or classifying thrown errors. The handler is forwarded to the underlying sdk-core client; delivery is best-effort and fire-and-forget (a throwing handler is caught and logged, never propagated into request flow).

```typescript
import { OpsClient, type SecurityEvent } from '@uluops/ops-sdk';

const client = new OpsClient({
  apiKey: 'ulr_...',
  onSecurityEvent: (event: SecurityEvent) => {
    switch (event.type) {
      case 'auth_failure':           siem.alert('auth_rejected', { authType: event.authType, requestId: event.requestId }); break;
      case 'redirect_rejected':      siem.alert('redirect_blocked', { origin: event.baseUrl }); break;
      case 'token_refresh_failed':   siem.alert('session_refresh_failed', {}); break;
      case 'auth_strategy_replaced': siem.alert('credential_swapped', { from: event.previousType, to: event.newType }); break;
    }
  },
});
```

| Event `type` | Fires when |
|--------------|-----------|
| `auth_failure` | A sent credential is rejected with 401 (and not transparently refreshed) |
| `redirect_rejected` | The configured origin returns a 3xx the SDK refuses to follow |
| `token_refresh_failed` | A session token refresh (re-login) is rejected |
| `auth_strategy_replaced` | The live credential is swapped via `setAuthStrategy` |

Related: a blocked redirect throws **`RedirectError`** (re-exported, non-retryable — catch it with `isRedirectError(e)` where you previously caught `NetworkError` for a redirect). The `SecurityEvent` union and its member types are exported from the package root.

---

### Auth Operations

Manage user authentication, API keys, and sessions.

#### `client.auth.register(input)`

Register a new user account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | `string` | Yes | User email address |
| `password` | `string` | Yes | User password |

```typescript
const { user, token } = await client.auth.register({
  email: 'newuser@example.com',
  password: 'securePassword123',
});
```

#### `client.auth.login(input)`

Login with email and password.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | `string` | Yes | User email address |
| `password` | `string` | Yes | User password |

```typescript
const { user, sessionToken } = await client.auth.login({
  email: 'user@example.com',
  password: 'password123',
});
```

#### `client.auth.totpLogin(input)`

Complete an MFA challenge with a TOTP code. Returns the session **without installing it** on the
client — use the top-level [`client.loginWithTotp()`](#authentication) wrapper when you want the
session installed. The challenge token is single-use and is consumed before the code is checked.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mfaChallengeToken` | `string` | Yes | From the `MfaRequiredError` thrown by `login()` |
| `code` | `string` | Yes | Six-digit TOTP code |
| `rememberMe` | `boolean` | No | Long-lived session |

```typescript
const { sessionToken, expiresAt } = await client.auth.totpLogin({
  mfaChallengeToken: err.mfaChallengeToken,
  code: '123456',
});
```

#### `client.auth.logoutAll()`

Revoke all active sessions for the current user.

```typescript
const { sessionsRevoked } = await client.auth.logoutAll();
console.log(`Revoked ${sessionsRevoked} sessions`);
```

#### `client.auth.getMe()`

Get the current authenticated user.

```typescript
const user = await client.auth.getMe();
console.log(user.email, user.role);
```

#### `client.auth.getProfile()`

Get detailed user profile.

```typescript
const { user } = await client.auth.getProfile();
```

#### `client.auth.updateProfile(input)`

Update user profile information.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | `string` | No | Username (lowercase, 3-30 chars) |
| `name` | `string` | No | Display name |
| `bio` | `string` | No | User bio |
| `avatar` | `string` | No | Avatar image (base64 encoded) |
| `avatarMimeType` | `string` | No | Avatar MIME type (e.g., `image/png`) |

> **Note:** At least one field must be provided.

```typescript
const { user } = await client.auth.updateProfile({
  name: 'John Doe',
  bio: 'Software Engineer',
});
```

#### `client.auth.changePassword(input)`

Change the current user's password.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `currentPassword` | `string` | Yes | Current password |
| `newPassword` | `string` | Yes | New password |

```typescript
await client.auth.changePassword({
  currentPassword: 'oldPassword',
  newPassword: 'newSecurePassword',
});
```

#### `client.auth.setPassword(password)`

Set password for accounts created without one (e.g., OAuth or admin-created).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `password` | `string` | Yes | New password |

```typescript
await client.auth.setPassword('newSecurePassword');
```

#### `client.auth.forgotPassword(email)`

Request a password reset email.

```typescript
await client.auth.forgotPassword('user@example.com');
```

#### `client.auth.resetPassword(input)`

Reset password using a reset token.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | `string` | Yes | Reset token from email |
| `password` | `string` | Yes | New password |

```typescript
await client.auth.resetPassword({
  token: 'reset-token-from-email',
  password: 'newSecurePassword',
});
```

#### `client.auth.getAvatar()`

Get the current user's avatar as binary data.

```typescript
const { data, contentType } = await client.auth.getAvatar();
// data: ArrayBuffer, contentType: e.g. 'image/png'
```

#### `client.auth.deleteAvatar()`

Delete the current user's avatar.

```typescript
await client.auth.deleteAvatar();
```

#### `client.auth.listApiKeys()`

List all API keys for the current user.

```typescript
const keys = await client.auth.listApiKeys();
for (const key of keys) {
  console.log(key.name, key.prefix, key.createdAt);
}
```

#### `client.auth.createApiKey(input)`

Create a new API key.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | No | Key name/description |
| `scope` | `'read' \| 'write'` | No | Per-key scope (v5.21.0 / platform v1.27.0). Omitted ⇒ `'write'` server-side. A `read` key gets `403 INSUFFICIENT_SCOPE` on any non-GET/HEAD request. |

```typescript
// A read-only key — cannot write (close/delete/merge), only read
const { id, name, key } = await client.auth.createApiKey({ name: 'CI Pipeline', scope: 'read' });
console.log('Save this key:', key); // Only shown once!
// Listed keys carry their scope:
const keys = await client.auth.listApiKeys();
keys.forEach((k) => console.log(k.name, k.scope)); // 'CI Pipeline' 'read'
```

#### `client.auth.revokeApiKey(keyId)`

Revoke an API key.

```typescript
await client.auth.revokeApiKey('key-id-123');
```

#### `client.auth.listSessions()`

List all active sessions.

```typescript
const sessions = await client.auth.listSessions();
for (const session of sessions) {
  console.log(session.userAgent, session.createdAt);
}
```

#### `client.auth.revokeSession(sessionId)`

Revoke a specific session.

```typescript
await client.auth.revokeSession('session-id-123');
```

---

### Project Operations

Manage projects.

#### `client.projects.list()`

List all projects.

```typescript
const { data: projects, total } = await client.projects.list();
for (const project of projects) {
  console.log(project.id, project.name, project.createdAt);
}
```

#### `client.projects.get(idOrName)`

Get a project by ID or name.

```typescript
const project = await client.projects.get('my-project');
console.log(project.name, project.runCount, project.issueCount);
```

#### `client.projects.create(input)`

Create a new project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Project name (unique) |

```typescript
const project = await client.projects.create({ name: 'new-project' });
```

#### `client.projects.update(idOrName, input)`

Update a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | No | New project name |

```typescript
const project = await client.projects.update('my-project', {
  name: 'renamed-project',
});
```

#### `client.projects.rename(input)`

Rename a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `oldName` | `string` | Yes | Current project name |
| `newName` | `string` | Yes | New project name |

```typescript
const project = await client.projects.rename({
  oldName: 'old-name',
  newName: 'new-name',
});
```

#### `client.projects.delete(idOrName, input)`

Permanently delete a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `confirm` | `boolean` | Yes | Must be `true` |
| `confirmationPhrase` | `string` | Yes | Must match project name |

```typescript
await client.projects.delete('my-project', {
  confirm: true,
  confirmationPhrase: 'my-project',
});
```

#### `client.projects.softDelete(idOrName, input)`

Soft delete a project (can be restored).

```typescript
await client.projects.softDelete('my-project', {
  confirm: true,
  confirmationPhrase: 'my-project',
});
```

#### `client.projects.restore(idOrName)`

Restore a soft-deleted project.

```typescript
const project = await client.projects.restore('my-project');
```

#### `client.projects.getSummary(idOrName)`

Get project summary with statistics.

```typescript
const summary = await client.projects.getSummary('my-project');
console.log(`Total runs: ${summary.totalRuns}`);
console.log(`Total issues: ${summary.totalIssues}`);
console.log(`Open issues: ${summary.openIssues}`);
```

#### `client.projects.getTrends(idOrName, query)`

Get issue trend data over time.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | `number` | No | Number of days (default: 30) |

```typescript
const trends = await client.projects.getTrends('my-project', { days: 30 });
for (const point of trends) {
  console.log(point.date, point.openIssues, point.closedIssues);
}
```

#### `client.projects.getLog(idOrName, query?, options?)` — the project log (ulu log §3.2)

The project's second history: `run` events (what was examined) and `decision` / `regression`
events (what was decided, with reasons — and what came back) interleaved newest first,
keyset-paged. Pass `nextCursor` back verbatim. Three things to keep straight when rendering:
`reason: null` is *no reason recorded*; `source: null` is *unattributed*, never *human*; a
`regression` is a row a **run** re-detected, while a `resolved → open` `decision` with no run is
*reopened by decision* (D12) — the SDK types both and does not collapse them. `counts` is `null`
on runs saved before migration 065.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `since` / `until` | `string` | No | ISO 8601 window; `since <= until` or 400 |
| `limit` | `number` | No | 1–500, default 50; outside the range is a 400 |
| `cursor` | `string` | No | A `nextCursor` from the previous page, verbatim |
| `kind` | `('run'\|'decision'\|'regression')[]` | No | Subset of event kinds |
| `workflowType` | `string` | No | Filters `run` events only |
| `agent` | `string` | No | Runs by snapshot agent name; ledger rows by `issues.agent` |
| `includeArchived` | `boolean` | No | Archived runs are excluded unless `true` |

Query keys go to the wire as named (`workflowType`, not `workflow_type`): the API's schema is
camelCase and silently ignores a snake_cased key, so this call does not use the SDK's generic
snake_casing.

```typescript
let cursor: string | undefined;
do {
  const page = await client.projects.getLog('my-project', { limit: 100, cursor }, { org: 'ulu-labs' });
  for (const e of page.data) {
    if (e.type === 'run') console.log(e.at, `run #${e.runNumber}`, e.workflowType, e.counts ?? '-');
    else if (e.type === 'decision') console.log(e.at, e.fingerprint, `${e.from} -> ${e.to}`, e.reason ?? 'no reason recorded');
    else console.log(e.at, e.fingerprint, 'regressed', e.viaRunNumber === null ? 'via run ?' : `via run #${e.viaRunNumber}`);
  }
  cursor = page.hasMore ? page.nextCursor : undefined;
} while (cursor);
```

#### `client.projects.getLogStat(idOrName, query?, options?)` — the rollup (§3.3)

`{ projectId, window, examined, found, decided, cameBack, activity }`. Two frames on two clocks:
the **cohort** frame (`examined`, `found`, `decided`) windows on run timestamps; the **activity**
frame (`activity`, `cameBack`) on ledger timestamps. `decided` is the *current* status of each
found issue and sums to `found.issues` — it is not "decisions made in the window"; that is
`activity.decisions`. `activity.byStatus.open` counts transitions **into** open (render it
*reopened*). `cameBack.detected` / `reopened` are distinct issues with the row counts beside
them; `lastDetectedAtAllTime` ignores the window by definition. `since` / `until` as above.

```typescript
const stat = await client.projects.getLogStat('my-project');
console.log(`${stat.examined.runs} runs, ${stat.found.issues} findings, ${stat.decided.completed} fixed, ${stat.cameBack.detected} regressions caught by re-running`);
```

#### `client.projects.listIssues(idOrName, query)`

List issues for a project with filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | `Status` | No | Filter by status |
| `priority` | `Priority` | No | Filter by priority |
| `severity` | `Severity` | No | Filter by severity |
| `failureDomain` | `FailureDomain` | No | Filter by taxonomy domain (`STR`/`SEM`/`PRA`/`EPI`) |
| `failureMode` | `string` | No | Filter by taxonomy mode — the `MODE` half of a `DOMAIN-MODE/SEVERITY` code, e.g. `OMI`. Three uppercase letters. Intentionally not restricted to the canonical mode set, so non-canonical rows remain findable. **Requires API ≥ the release carrying the mode-filter fix; against an older API this filter is silently ignored and you receive unfiltered results.** |
| `agent` | `string` | No | Filter by agent |
| `includeResolved` | `boolean` | No | Include `completed`/`wontfix`/`false-positive` issues |
| `minTimesSeen` | `number` | No | Only issues seen at least this many times |
| `dateStart` | `string` | No | ISO 8601 — issues created on or after |
| `dateEnd` | `string` | No | ISO 8601 — issues created on or before |
| `limit` | `number` | No | Max results (default: 50) |
| `offset` | `number` | No | Pagination offset |

> **Filter convention:** Passing `'all'` for any filter (e.g., `status: 'all'`) is equivalent to omitting the parameter — the SDK strips `'all'` values before sending the request. This applies to all query methods across the SDK.
>
> **The table above is the canonical filter set** for `projects.listIssues` and
> `issues.listByProject` — both take the same query shape. `issues.search` is the exception: it accepts `failureDomains` (an array)
> and **does not accept `failureMode` at all**, because the server-side search path has no
> mode predicate. If you need to filter by mode, use one of the two list methods.

```typescript
// {data, total} since 6.0.0 — `total` is the full matching count, for pagination
const { data: issues, total } = await client.projects.listIssues('my-project', {
  status: 'open',
  priority: 'critical',
  limit: 10,
});
console.log(`Showing ${issues.length} of ${total} open critical issues`);
```

#### `client.projects.bulkUpdateIssueStatus(idOrName, updates)`

Bulk update issue statuses.

```typescript
const results = await client.projects.bulkUpdateIssueStatus('my-project', [
  { issueId: 'issue-1', status: 'completed', reason: 'Fixed' },
  { issueId: 'issue-2', status: 'deferred', reason: 'Not a priority' },
]);
```

#### `client.projects.mergeIssues(idOrName, input)`

Merge duplicate issues.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `targetIssueId` | `string` | Yes | Issue to merge into |
| `sourceIssueIds` | `string[]` | Yes | Issues to merge from |
| `strategy` | `string` | No | `'keep_target'` or `'keep_highest_priority'` |

```typescript
const result = await client.projects.mergeIssues('my-project', {
  targetIssueId: 'issue-1',
  sourceIssueIds: ['issue-2', 'issue-3'],
  strategy: 'keep_target',
});
```

#### `client.projects.mergeProjects(input)`

Merge one project into another (merge-projects spec v0.3.4). The source's runs and issues are
re-keyed into the target inside one advisory-locked transaction; the source is soft-deleted by
default. Pairwise only — chain calls for multi-source merges. Dry-run first.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | `string` | Yes | Source project name or UUID (consumed by the merge) |
| `target` | `string` | Yes | Target project name or UUID (survives, absorbs the source) |
| `dryRun` | `boolean` | No | Preview only — the merge transaction is rolled back (default `false`) |
| `deleteSource` | `boolean` | No | Soft-delete the source after the merge (default `true`) |
| `confirmCrossOrg` | `boolean` | No | Required `true` for system-actor cross-org merges; human cross-org merges are always rejected |

```typescript
const preview = await client.projects.mergeProjects({
  source: 'old-project',
  target: 'my-project',
  dryRun: true,
});
console.log(`Would move ${preview.moved.runs} runs and ${preview.moved.issues} issues`);
if (preview.conflicts.length === 0) {
  const result = await client.projects.mergeProjects({ source: 'old-project', target: 'my-project' });
  console.log(result.source.statusAfter); // 'soft-deleted'
}
```

Returns `{ source, target, moved, conflicts }` — `source.statusAfter` is `'soft-deleted' | 'retained' | 'dry-run'`, `moved` counts runs, issues, dedupes and reparented occurrences/notes/history.

#### `client.projects.rehome(idOrName, input, options?)` — move a project to another org

Moves the project and its whole history (runs, issues, analytics) into another org
(project-org-routing-and-rehome spec §4.1, D14). **The source org is this call's org scope** —
pass `{ org: '<source>' }` (or set the client `orgSlug`) unless the project is in your personal
org; the project is looked up *there*, and an unscoped call for a work-org project is a 404. You
need `admin`/`owner` in both orgs; a personal org as *target* only when it is yours.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `targetOrg` | `string` | Yes | Slug of the destination org |
| `reason` | `string` | No | ≤ 500 chars; stored on the tombstone, never rendered into an error |

```typescript
const moved = await client.projects.rehome('billing', { targetOrg: 'ulu-labs', reason: 'team took it over' }, { org: 'acme' });
moved.orgId;               // the target org's id
moved.rehome.from_org;     // { id, slug: 'acme' }
moved.rehome.to_org;       // { id, slug: 'ulu-labs' }
moved.rehome.audit_ids;    // [] today — the ledger, not this array, is the durable record
```

After the move the old `(org, name)` address is a **tombstone**: an org-less *write* naming the
project there (a `save` or a `create`) gets `410 PROJECT_REHOMED` naming the target
(`isProjectRehomedError`) instead of silently forking a new project. Reads at the old address 404.
Moving back is an ordinary `rehome` the other way and annihilates the tombstone.

Refusals a caller branches on — `rehomeRefusalReason(err)` reads the enumerated
`details.reason` values and returns `null` for anything else:

| Answer | Meaning | Disposition |
|---|---|---|
| `400` `same_org` | already there | done (idempotent re-run) |
| `409` `moved_during_request` / `deadlock_retry` / `concurrent_modification` | lost a race | re-read, retry once |
| `409` `name_collision` / `soft_deleted_conflict` / `rehomed_away_conflict` | the name is taken in the target (live, soft-deleted, or reserved by another move) | skip and report |
| `409` `export_in_progress` | an export holds one of the orgs | wait, retry |
| `409` `project_soft_deleted` | the project is soft-deleted in the source | restore it there first, then move |
| `400` `project_has_no_org` | pre-org legacy row | stop; an operator repairs the row |
| `403` `INSUFFICIENT_ORG_ROLE` / `ORG_ACCESS_DENIED` / `ORG_SUSPENDED` | authority (source role, target membership or a personal target, C3) | stop |
| `402` `PROJECT_LIMIT` | target org at its project cap | stop |
| *no HTTP answer* (`isTimeoutError` / `isNetworkError`; `rehomeRefusalReason` → `null`) | the server may have committed the move before the response was lost | do **not** retry blind — read the project with `{ org: targetOrg }` (or the admin ledger); on the member path a blind retry is a 404, not `same_org` |

**Re-runs.** `same_org` is the idempotence signal of the **admin** path (lookup by id, unscoped).
On the member path the lookup is source-scoped, so the same call after the move answers **404**
(the source address is a tombstone) — not `same_org`. A member-path script that wants "already
done" checks the target org, not the refusal code.

---

### Run Operations

Save and manage execution runs.

#### `client.runs.save(input, options?)`

Save a new execution run. Pass `{ _skipClientValidation: true }` as the second argument to bypass client-side Zod validation (useful when input is already validated by an upstream layer like MCP).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | Yes | Project name or ID |
| `workflowType` | `string` | Yes | Workflow type (e.g., `'post-implementation'`) |
| `agents` | `AgentInput[]` | Yes | Array of agent results |
| `recommendations` | `Recommendation[]` | Yes | Array of issues/recommendations (use `[]` for empty). Multi-agent pipelines: see [Convergence clustering](#convergence-clustering-clusterkey) before collapsing findings |
| `summary` | `object` | No | Summary statistics |
| `rawMarkdown` | `string` | No | Raw markdown report |
| `idempotencyKey` | `string` | No | Key for duplicate prevention. When omitted, the SDK derives it from the payload content (sha256), so a byte-identical retry returns the original run (`deduplicated: true`) instead of creating a second one. The hash is over `JSON.stringify` of the payload, so it is key-order-sensitive inside caller-supplied objects (`agents[]`, `recommendations[]`, `analysisRecords[].data`): a retry that rebuilds those with a different insertion order is a different key and writes a second run. Pass an explicit key when the retry path does not preserve object shape; pass explicit distinct keys to deliberately save identical payloads twice |
| `definitionType` | `string` | No | Definition type (`'agent'`, `'command'`, `'workflow'`, `'pipeline'`) |
| `definitionName` | `string` | No | Definition name (e.g., `'code-validator'`) |
| `definitionVersion` | `string` | No | Definition version (e.g., `'1.2.0'`) |
| `definitionHash` | `string` | No | SHA-256 content hash of the definition |
| `definitionId` | `string` | No | Registry definition UUID for direct identity linkage |
| `timestamp` | `string` | No | ISO 8601 timestamp override (defaults to server time) |
| `definitionMinSubscription` | `SubscriptionTier` | No | Minimum subscription tier required for this definition |
| `analysisRecords` | `AnalysisRecordInput[]` | No | Structured analysis records (v1.4.0) |
| `analysisSummary` | `AnalysisSummaryInput \| AnalysisSummaryInput[]` | No | Single or per-agent array of analysis summaries (v1.8.1) |
| `analysisSummary.explorationMaps` | `ExplorationMap[]` | No | Structural maps from explorer agents (v1.8.0) |

#### Convergence clustering (`clusterKey`)

*(v5.12.0)* If your pipeline has a stage that adjudicates duplication — a merge,
falsification or synthesis stage that decides several agents reported **one** defect —
submit one recommendation **per agent** and tag them with a shared `clusterKey`, rather
than collapsing them into a single row before submission.

```typescript
recommendations: [
  { agent: 'security-analyst', title: 'Unbounded query in the export path', priority: 'critical', clusterKey: 'cluster-alpha' },
  { agent: 'code-auditor',     title: 'Unbounded query in the export path', priority: 'critical', clusterKey: 'cluster-alpha' },
]
```

- **Within-run only.** Two recommendations sharing a `clusterKey` are the same defect *in
  the same run*. The value carries no meaning across runs and is never joined across them.
- **Opaque.** The tracker stores it verbatim and never interprets or verifies it. Any
  stable string up to 64 chars works; a longer one is rejected rather than truncated,
  because a truncated key is a different cluster id that still looks valid.
- **Omit it if your pipeline has no adjudicating stage.** That is the normal case and is
  not a defect. Absent means "no stage declared", which the tracker distinguishes from a
  stage that has stopped clustering.
- Requires a tracker with migration 076. Against an older one the field is discarded.

Collapsing before submission is what this replaces: the merge result reaches the tracker
as single-agent rows and the fact that *n* agents converged is lost.

```typescript
const result = await client.runs.save({
  project: 'my-project',
  workflowType: 'post-implementation',
  agents: [
    {
      name: 'code-validator',
      score: 85,
      decision: 'PASS',
      summary: 'Code quality is strong — minor naming inconsistencies in utils/',
      model: 'sonnet',
      harness: 'claude-code', // producing CLI/runtime (v5.2.0) — free string; claude-code | codex | opencode | gemini-cli | uluops-core
      tokens: {
        inputTokens: 1000,
        outputTokens: 500,
        // Cross-harness components (v5.2.0, all optional). cachedInput is subtracted in
        // total_effective; reasoning/thinking/tool are subsets of gross output, never added.
        cachedInputTokens: 200,
        reasoningOutputTokens: 0,
      },
    },
    {
      name: 'test-architect',
      score: 72,
      decision: 'APPROVED',
      summary: 'Good coverage overall but edge cases missing in auth module',
    },
  ],
  recommendations: [
    {
      agent: 'code-validator',
      title: 'Missing error handling in API client',
      priority: 'suggested',
      severity: 'medium',
      filePath: 'src/api/client.ts',
      lineNumber: 42,
      description: 'Add try-catch for network errors',
      failureCode: 'PRA-FRA/M',
    },
  ],
  summary: {
    averageScore: 78.5,
    allGatesPassed: true,
  },
});

console.log(`Run #${result.run.runNumber} saved`);
console.log(`Issues: ${result.correlation?.newIssues} new, ${result.correlation?.recurringIssues} recurring`);
```

> `result.correlation` is `null` only when an idempotent replay returns a run
> that was saved before the API began persisting correlation counts — those
> counts were never stored and are not fabricated. Fresh saves and
> post-migration replays always carry a correlation object.

#### `client.runs.validate(input, options?)`

Preview what a save would do without persisting. Accepts same `{ _skipClientValidation: true }` option as `save()`. Since v3.2.2, also previews `analysisRecords` and `analysisSummary` persistence so the dry-run reflects the full set of side effects `save()` would produce (requires API v1.58.1+).

```typescript
const preview = await client.runs.validate({
  project: 'my-project',
  workflowType: 'post-implementation',
  agents: [{ name: 'code-validator', score: 90, decision: 'PASS' }],
  recommendations: [{ agent: 'code-validator', title: 'Unused import', priority: 'backlog', failureCode: 'STR-OMI/L' }],
  // Optional — same shape save() accepts
  analysisRecords: [
    { recordId: 'C-1', recordType: 'convergence', title: 'Lens convergence', data: { evidence: ['src/foo.ts:42'] } },
  ],
  analysisSummary: { decision: 'PASS', score: 88 },
});

console.log('Would create issues:', preview.wouldCreate);
console.log('Would update issues:', preview.wouldUpdate);
console.log('Would regress issues:', preview.wouldRegress);
console.log('Would observe issues:', preview.wouldObserve);

// v3.2.2+: optional analysis previews (present when API >= v1.58.1)
console.log('Would create analysis records:', preview.wouldCreateAnalysisRecords);
console.log('Would create analysis summaries:', preview.wouldCreateAnalysisSummaries);
console.log('Analysis records to be created:', preview.preview.analysisRecords);
```

> **`allGatesPassed` is `boolean | null` on all run *responses* (since v5.10.0).**
> `null` means **NOT_A_GATE** — the run carried no gate-bearing agents (e.g. a
> cognitive-lens-only run), which is distinct from `false` (a gate ran and failed).
> Render `null` as "N/A"/"—", and exclude null runs from pass-rate denominators.
> The *input* field `summary.allGatesPassed` is unchanged (`boolean | undefined`;
> `null` is never a valid input). The API begins emitting `null` only after its
> consumers resolve v5.10.0+ — older SDK versions throw `ZodError` on a null-gate
> response.

#### `client.runs.listByProject(projectId, query)`

List runs for a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowType` | `string` | No | Filter by workflow type |
| `limit` | `number` | No | Max results |
| `offset` | `number` | No | Pagination offset |

```typescript
// {data, total} since 6.0.0
const { data: runs, total } = await client.runs.listByProject('my-project', {
  workflowType: 'ship',
  limit: 10,
});
```

#### `client.runs.getLatest(projectId, workflowType)`

Get the latest run for a project.

```typescript
const latestRun = await client.runs.getLatest('my-project', 'post-implementation');
```

#### `client.runs.get(runId)`

Get a run by ID.

```typescript
const run = await client.runs.get('run-uuid-here');
```

#### `client.runs.getDetails(projectId, runNumber)`

Get detailed run information with recommendations.

```typescript
const details = await client.runs.getDetails('my-project', 5);
console.log(details.agents);
console.log(details.recommendations);
```

Agent snapshots returned by `runs.save` and `runs.getDetails` preserve both the
normalized `model` and optional, nullable `modelRaw` supplied by the API.
Use `modelRaw` to inspect the original model identity; older responses may omit
it, and records without a raw identity may return `null`.

#### `client.runs.diff(query)`

Compare two runs to see fixed/new issues.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | Yes | Project name or ID |
| `baseRun` | `number` | Yes | Base run number |
| `compareRun` | `number` | Yes | Compare run number |
| `workflowType` | `string` | No | Filter by workflow type |

```typescript
const diff = await client.runs.diff({
  project: 'my-project',
  baseRun: 1,
  compareRun: 5,
});

console.log('Fixed issues:', diff.fixed.length);
console.log('New issues:', diff.new.length);
console.log('Unchanged:', diff.unchanged.length);
```

#### `client.runs.archive(input)`

Archive old runs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | Yes | Project name or ID |
| `beforeRunNumber` | `number` | No | Archive runs before this number |
| `beforeDate` | `string` | No | Archive runs before this date |
| `keepLast` | `number` | No | Keep last N runs |
| `reason` | `string` | No | Archive reason |

```typescript
const result = await client.runs.archive({
  project: 'my-project',
  keepLast: 10,
  reason: 'Quarterly cleanup',
});
console.log(`Archived ${result.archived} runs`);
```

#### `client.runs.update(input, options?)`

Update run metadata (tokens, scores). Accepts `{ _skipClientValidation: true }` option.

```typescript
const run = await client.runs.update({
  project: 'my-project',
  runNumber: 5,
  agents: [
    // Token fields are FLAT on update (UpdateAgentInput) — a nested `tokens` object is not a field the update path sends
    { name: 'code-validator', score: 90, inputTokens: 1500 },
  ],
});
```

**Analysis writes are per-agent scoped** (API 1a/1b): for each agent named in
`analysisRecords` / `analysisSummary`, that agent's existing rows are affected; agents not
named are untouched. Under the default `recordWriteMode: 'replace'`, a named agent's set is
fully replaced — omitting a record it previously had retires it. Under `'merge'` (API 1b),
records upsert on `(agent_name, record_id)`: matched rows are superseded, unmatched keys
append, and nothing is retired; summaries have no mode. Preview with `previewUpdate` first
when unsure. The SDK asserts the server's `analysisWrite` echo on every analysis-bearing
update — the echoed `recordMode` must equal the mode this call sent, so a pre-1b server
that strips `recordWriteMode` (and executes replace on a merge send) throws a named
`AnalysisEchoMismatchError` instead of silently retiring records (the update has been
applied when this throws — re-read the run rather than retry). To see what a successful
write actually superseded, use `updateWithEcho` / `updateByIdWithEcho`, which return
`{ run, analysisWrite }` — `supersededRecords: 0` on an enrichment that expected to
replace means the named agents had no live rows (first enrichment, or attribution drift).

#### `client.runs.updateWithEcho(input, options?)` / `client.runs.updateByIdWithEcho(runId, input, options?)`

Same write as `update`/`updateById`, but returns `{ run, analysisWrite }` — the server's
superseded/created counts, the success path's only view of what the write actually did.
`analysisWrite` is `null` on non-analysis updates.

```typescript
const { run, analysisWrite } = await client.runs.updateWithEcho({
  project: 'my-project',
  runNumber: 5,
  recordWriteMode: 'merge',
  analysisRecords: [
    { agentName: 'epictetus-analyst', recordType: 'evidence_claim', recordId: 'EC-2',
      title: 'Follow-up claim', data: { claim: '...' } },
  ],
});
// analysisWrite -> { recordMode: 'merge', supersededRecords: 0, supersededSummaries: 0,
//                    createdRecords: 1, createdSummaries: 0 }
// supersededRecords > createdRecords under merge means prior duplicate rows
// sharing a key collapsed to one (lossy by design — check before merging into
// agents with a duplicate history).
```

#### `client.runs.previewUpdate(input, options?)` / `client.runs.previewUpdateById(runId, input, options?)`

Read-only preview of an analysis-bearing update under the requested `recordWriteMode`
(default `replace`): what the write would supersede, create, and — replace only, via
`wouldRetireRecordIds` — retire by omission (always `[]` under merge, which cannot
retire). The preview asserts the server echoed the mode you sent — a pre-1b server that
strips the mode throws `AnalysisEchoMismatchError` (`reason: 'preview-mode-mismatch'`,
nothing written) instead of returning a plan that models the wrong semantics. Accepts
analysis concerns only (`analysisRecords`, `analysisSummary`, `recordWriteMode`); any
other update field throws a named
`InputValidationError` client-side (the SDK builds the request body from the analysis
fields alone, so the server's own scope-rule 400 is unreachable through it — the
client-side check is what keeps a spread-in update input from being silently narrowed).

```typescript
const plan = await client.runs.previewUpdate({
  project: 'my-project',
  runNumber: 5,
  analysisRecords: [
    { agentName: 'epictetus-analyst', recordType: 'evidence_claim', recordId: 'EC-1',
      title: 'Registry overclaim', data: { claim: '...' } },
  ],
});
for (const [agent, p] of Object.entries(plan.byAgent)) {
  if (p.wouldRetireRecordIds.length > 0) {
    console.warn(`${agent}: write would retire ${p.wouldRetireRecordIds.join(', ')}`);
  }
}
```

#### `client.runs.updateById(runId, input, options?)`

Update run metadata by run UUID (alternative to `update` which uses project+runNumber). Supports post-hoc enrichment with structured analysis data (v1.7.0) under the same per-agent write semantics (`recordWriteMode` replace/merge) and echo assertion as `update` — and, like `update`, discards the echo on success; use `updateByIdWithEcho` to see it. Accepts `{ _skipClientValidation: true }` option.

```typescript
// Basic metadata update
const run = await client.runs.updateById('run-uuid-here', {
  agents: [{ name: 'code-validator', score: 92 }],
});

// Enrich with per-agent analysis summaries (v1.7.1)
const run = await client.runs.updateById('run-uuid-here', {
  analysisSummary: [
    { agentName: 'epictetus-analyst', decision: 'FACTUAL', score: 82,
      categoryScores: [{ name: 'Fact/Judgment Separation', weight: 30, score: 25 }] },
    { agentName: 'epictetus-validator', decision: 'ALIGNED', score: 82 },
  ],
  analysisRecords: [
    { agentName: 'epictetus-analyst', recordType: 'evidence_claim', recordId: 'EC-1',
      title: 'Registry overclaim', data: { claim: '...' } },
    { agentName: 'epictetus-forecaster', recordType: 'decay_vector', recordId: 'DV-1',
      title: 'Fail-open compounding', data: { timeline: '12-24 months' } },
  ],
});

// Enrich with explorer structural maps (v1.8.0)
const run = await client.runs.updateById('run-uuid-here', {
  analysisSummary: {
    agentName: 'bateson-explorer', decision: 'EXPLORED', score: 0,
    explorationMaps: [{
      metadata: { explorerName: 'bateson-explorer', framework: 'bateson' },
      sections: [
        { type: 'topology', label: 'Logical Level Map', entities: [...], relationships: [...] },
        { type: 'agenda', label: 'Inquiry Agenda', questions: [...] },
      ],
    }],
  },
});
```

#### `client.runs.delete(runId)`

Delete a run.

```typescript
await client.runs.delete('run-uuid-here');
```

#### `client.runs.getAnalysis(runId)`

Get structured analysis records and summaries for a specific run (v0.3.0).

```typescript
const analysis = await client.runs.getAnalysis('run-uuid-here');
console.log(analysis.records);   // Convention inventories, tension maps, decay vectors, etc.
console.log(analysis.summaries); // Per-agent system metrics, epistemic assessments
```

#### `client.runs.getProjectAnalysis(projectId, query)`

Get analysis summaries for a project over time (v0.3.0).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agentName` | `string` | No | Filter by agent (e.g., `'nietzsche-analyst'`) |
| `agentType` | `string` | No | Filter by type (`'analyst'`, `'validator'`, etc.) |
| `decision` | `string` | No | Filter by decision (`'VITAL'`, `'FLOWING'`, etc.) |
| `limit` | `number` | No | Max results |
| `offset` | `number` | No | Pagination offset |

```typescript
const { data, total } = await client.runs.getProjectAnalysis('my-project', {
  agentName: 'nietzsche-analyst',
  limit: 10,
});
// data[0]: { decision, score, categoryScores, systemMetrics, runNumber, runTimestamp, workflowType }
data.forEach(s => console.log(s.decision, s.systemMetrics));
```

#### `client.runs.queryAnalysisRecords(query)`

F02 analysis attribution: set `agentType` on each record or summary for an unregistered agent (for example, `{ agentName: 'local-map', agentType: 'explorer', decision: 'TRACED' }`). With multiple agents, name the agent explicitly. The API resolves registered agents at the saved execution version and rejects a conflicting declaration. Read `agentTypeSource` (`registry`, `declared`, `unresolved`, historical `inferred` or null) alongside `agentTypeDefinitionId` and `agentTypeDefinitionVersion`. Legacy inferred attribution reads as `unknown`; filter with `{ agentType: 'unknown' }` to find it. Later registry changes do not relabel saved analysis. These fields require the F02 API; final compatible package pins are part of the coordinated release.

Cross-project query for analysis records with filters (v0.3.0).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `recordType` | `string` | No | Filter by type (`'convention'`, `'tension'`, `'decay_vector'`) |
| `classification` | `string` | No | Filter by classification (`'CALCIFIED'`, `'IMMINENT'`) |
| `agentName` | `string` | No | Filter by agent name |
| `agentType` | `string` | No | Filter by agent type |
| `severity` | `string` | No | Filter by severity |

```typescript
// Find all calcified conventions across all projects
const { data, total } = await client.runs.queryAnalysisRecords({
  recordType: 'convention',
  classification: 'CALCIFIED',
});
// data[0]: { recordType, recordId, title, classification, severity, data: { ... } }
console.log(`Found ${total} records`);
```

#### `client.runs.getAgentRunsAnalysis(agentName, query)`

Get analysis summaries with run context for a specific agent. Returns analysis decision, score, category scores, system metrics alongside run metadata (number, timestamp, workflow type).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agentName` | `string` | Yes | Agent name |
| `query.project` | `string` | Yes | Project name or ID |
| `query.decision` | `string` | No | Filter by decision |
| `query.limit` | `number` | No | Max results (1-100, default 20) |
| `query.offset` | `number` | No | Pagination offset |

```typescript
const { data, total } = await client.runs.getAgentRunsAnalysis('epictetus-validator', {
  project: 'my-project',
  limit: 10,
});
// data[0]: { decision, score, categoryScores, runNumber, runTimestamp, workflowType, snapshotScore, ... }
```

---

### Issue Operations

Track and manage validation issues.

> **`resolutionRunId` is optional and deprecated on issue *responses* (since v5.11.0).**
> `ops-uluops-api` drops the underlying column in its migration 075: it encoded
> resolution-by-run, a model the tracker never implemented — runs *detect*, humans and
> agents *resolve*, and no run is in scope at a resolving transition. The column was
> `NULL` on every row, so every response this SDK has parsed carried `null` there. Do not
> read the field; it is removed in the next major.
>
> **Upgrade to v5.11.0 before that API deploys.** Responses are runtime-parsed, so a
> *required* key the API stops sending throws a `ZodError` on **every issue read** —
> `get`, `search`, `listByProject`, and every operation embedding an issue — rather than
> surfacing as `null`. v5.11.0 accepts the field present, `null`, or absent, so it parses
> both API shapes and can be adopted at any time ahead of the deploy.

> **`mergedIntoIssueId` is available on issue responses (since v5.13.0).** When an issue
> has been merged into another, this carries the surviving issue's UUID; `null` means it
> was never merged. Without it there is no way to answer *"where did this issue go"* from
> a client — `status` reads `merged` and the trail ends, leaving only `status_history`
> prose or direct database access, and production's database is not reachable from a
> workstation.
>
> The key has been on the wire since the API's migration 078. Earlier SDK versions
> **silently discarded it**: responses are parsed with `z.object()`, which strips unknown
> keys rather than erroring, so the value was dropped with no error and no warning. If
> you are on an older SDK you are not seeing a `null` — you are seeing nothing.
>
> The field is an *identity* relation and read-only: it stays populated when the target
> is soft-deleted, and the API refuses to set it through any update path. Correlation
> follows it; the by-fingerprint endpoints deliberately do not.

> **`description` is available on issue listings and run recommendations (since v6.1.0).**
> This is the occurrence's own account of a sighting — what the agent actually wrote —
> as opposed to the issue's `title`. It is what tells you a finding was already resolved:
> agents routinely end a description with *"FIXED IN RUN"*, and the title alone states
> the defect in the present tense regardless.
>
> **It is not a column on `issues`.** It lives on `occurrences`, and only the read paths
> that derive it carry it: `listIssues` (the API computes the latest occurrence's
> description per issue) and `runs.getDetails`'s `recommendations[]`. The by-id and
> by-fingerprint lookups do not supply it and report `undefined`. `get_issue_details`
> on the API side has always returned it via the occurrence record.
>
> The same silent-strip applies as above, and it has now cost real work: before v6.1.0
> the field was undeclared, so `z.object()` dropped it and a listing was
> **indistinguishable from findings that genuinely had no description**. A remediation
> pass read the omission as an absence and spent an entire iteration re-investigating
> seven findings whose descriptions each said they were already fixed. If you are on an
> older SDK you are not seeing `null` — you are seeing nothing.
>
> Requires a matching `ops-uluops-api`. Against an older API this parses cleanly and
> yields `undefined`; the field being *expressible* is the point, since `undefined`
> ("this path did not supply it") and `null` ("this occurrence recorded none") are now
> distinguishable where before neither was.

#### `client.issues.create(input)`

Create a user-submitted issue.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | Yes | Project name or ID |
| `title` | `string` | Yes | Issue title |
| `priority` | `Priority` | Yes | `'critical'`, `'high'`, `'suggested'`, `'backlog'` |
| `severity` | `Severity` | No | `'critical'`, `'high'`, `'medium'`, `'low'`, `'info'` |
| `type` | `IssueType` | No | `'bug'`, `'feature'`, `'refactor'`, etc. |
| `filePath` | `string` | No | File path where issue exists |
| `lineNumber` | `number` | No | Line number |
| `description` | `string` | No | Detailed description |
| `failureCode` | `string` | No | Taxonomy code (e.g., `'STR-OMI/H'`) |
| `agent` | `string` | No | Agent name (defaults to `'user-submitted'`) |

```typescript
const issue = await client.issues.create({
  project: 'my-project',
  title: 'Security vulnerability in auth module',
  priority: 'critical',
  severity: 'critical',
  type: 'security',
  filePath: 'src/auth/login.ts',
  lineNumber: 45,
  description: 'SQL injection vulnerability in login query',
  failureCode: 'SEM-INC/C',
});
```

#### `client.issues.search(query)`

Search issues across projects.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | No | Search query (omit for filter-only searches) |
| `projects` | `string[]` | No | Filter by projects |
| `agents` | `string[]` | No | Filter by agents |
| `status` | `Status` | No | Filter by status |
| `priority` | `Priority` | No | Filter by priority |
| `severities` | `Severity[]` | No | Filter by severities |
| `failureDomains` | `string[]` | No | Filter by domains (`'STR'`, `'SEM'`, `'PRA'`, `'EPI'`) |
| `limit` | `number` | No | Max results |

```typescript
const issues = await client.issues.search({
  query: 'authentication',
  status: 'open',
  priority: 'critical',
});
```

#### `client.issues.get(issueId)`

Get an issue by ID.

```typescript
const issue = await client.issues.get('issue-uuid-here');
```

#### `client.issues.getDetails(issueId)`

Get detailed issue information with occurrences and notes.

```typescript
const details = await client.issues.getDetails('issue-uuid-here');
console.log('Occurrences:', details.occurrences);
console.log('Notes:', details.notes);
console.log('History:', details.history);
```

#### `client.issues.getByFingerprint(fingerprint, project)`

Get an issue by its SHA-256 fingerprint.

```typescript
const issue = await client.issues.getByFingerprint('abc123...', 'my-project');
```

#### `client.issues.updateStatusByFingerprint(fingerprint, project, input)`

Update an issue's status using its fingerprint hash.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fingerprint` | `string` | Yes | SHA-256 fingerprint |
| `project` | `string` | Yes | Project name or ID |
| `status` | `Status` | Yes | New status |
| `reason` | `string` | No | Reason for change |

```typescript
const result = await client.issues.updateStatusByFingerprint(
  'abc123...', 'my-project', { status: 'completed', reason: 'Fixed' }
);
```

#### `client.issues.getHistory(issueId)`

Get the merged audit history for an issue (occurrences, status transitions including undo tombstones, and notes) as a single timestamp-sorted event stream.

> **BREAKING change in 3.2.0:** Return type changed from `StatusHistory[]` to `IssueHistoryEnvelope`. See the [CHANGELOG](./CHANGELOG.md#320---2026-06-08) for the migration path. Pre-3.2.0 code iterating `result` directly must now read `result.events` and narrow on each event's `type` discriminator (`'occurrence' | 'status' | 'note'`).

```typescript
const envelope = await client.issues.getHistory('issue-uuid');
// envelope: { issueId, events, totalEvents, truncated }
for (const event of envelope.events) {
  if (event.type === 'status') {
    const tag = event.transitionType === 'undo' ? '[undo] ' : '';
    console.log(`${tag}${event.oldStatus} -> ${event.newStatus} at ${event.timestamp}`);
  } else if (event.type === 'occurrence') {
    console.log(`occurrence: ${event.agentName} in run ${event.runId} at ${event.timestamp}`);
  } else if (event.type === 'note') {
    console.log(`note (${event.noteType}): ${event.content} at ${event.timestamp}`);
  }
}
if (envelope.truncated) {
  console.warn(`Truncated to most recent ${envelope.events.length} of ${envelope.totalEvents} events`);
}
```

#### `client.issues.updateStatus(issueId, input)`

Update an issue's status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | `Status` | Yes | New status |
| `reason` | `string` | No | Reason for change |

```typescript
const issue = await client.issues.updateStatus('issue-uuid', {
  status: 'completed',
  reason: 'Fixed in PR #123',
});
```

#### `client.issues.update(issueId, input)`

Update issue **metadata**. Not status — see the note below.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | `string` | No | New title |
| `priority` | `Priority` | No | New priority |
| `type` | `IssueType` | No | New issue type |
| `filePath` | `string` | No | New file path |
| `lineNumber` | `number` | No | New line number |
| `severity` | `Severity` | No | New severity |
| `category` | `string` | No | New category |
| `failureCode` | `string` | No | New failure code |
| `failureDomain` | `FailureDomain` | No | New failure domain |
| `failureMode` | `string` | No | New failure mode |
| ~~`status`~~ | `Status` | No | **Deprecated — the server returns `400`.** Use `updateStatus`. |

> **`status` no longer works on this method** *(deprecated in v5.14.0)*. `PATCH /issues/:id` records no
> `status_history` row and derives no `resolved_at`, so a status change made there
> bypassed the audit trail and the guards that keep `'merged'` reachable only through
> a real merge. The tracker refuses it with a `400` naming the right endpoint.
>
> It is still declared and still sent, deliberately: an older tracker accepts it, and
> this SDK does not enforce server policy client-side. Removing it in the next major.
>
> ```typescript
> await client.issues.updateStatus('issue-uuid', { status: 'completed', reason: '…' });
> ```

```typescript
const issue = await client.issues.update('issue-uuid', {
  title: 'Updated title',
  severity: 'high',
});
```

#### `client.issues.addNote(issueId, input)`

Add a note to an issue.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | `string` | Yes | Note content |
| `noteType` | `NoteType` | No | `'context'`, `'resolution'`, `'blocker'` |

```typescript
const note = await client.issues.addNote('issue-uuid', {
  content: 'Root cause identified: race condition in async handler',
  noteType: 'context',
});
```

#### `client.issues.restore(issueId)`

Restore a soft-deleted issue.

```typescript
const issue = await client.issues.restore('issue-uuid');
```

#### `client.issues.softDelete(issueId)`

Soft-delete an active issue. Reversible via `restore()`. Returns `{ deleted: true }`.

```typescript
await client.issues.softDelete('issue-uuid');
```

#### `client.issues.undoLastChange(issueId)`

Undo the last status change on an issue.

```typescript
const issue = await client.issues.undoLastChange('issue-uuid');
```

#### `client.issues.bulkUpdateStatus(updates)`

Bulk update issue statuses.

```typescript
const results = await client.issues.bulkUpdateStatus([
  { issueId: 'issue-1', status: 'completed' },
  { issueId: 'issue-2', status: 'deferred', reason: 'Not a priority' },
]);

// The result is an aggregate object — `updated` counts the successes and
// `failed` lists the issue IDs that could not be updated (e.g., not found
// or an invalid status transition).
console.log(`Updated ${results.updated} issue(s)`);
if (results.failed.length > 0) {
  console.warn('Failed issue IDs:', results.failed);
}
```

Maximum 100 items per bulk request. The SDK validates this limit client-side via Zod before sending.

#### `client.issues.listByProject(projectId, query)`

List issues for a specific project.

```typescript
const issues = await client.issues.listByProject('my-project', {
  status: 'open',
  limit: 20,
});
```

---

### Analytics Operations

Get insights and metrics about validation trends.

#### `client.analytics.getAgentPerformance(query)`

Get performance metrics by agent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | No | Filter by project |
| `days` | `number` | No | Time window (default: 30) |

```typescript
const performance = await client.analytics.getAgentPerformance({ days: 30 });
for (const agent of performance) {
  console.log(`${agent.name}: avg=${agent.averageScore}, pass=${agent.passRate}`);
}
```

#### `client.analytics.getAgentLifecycle(agentName, query)`

Get version trajectory for a specific agent across time.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agentName` | `string` | Yes | Agent name |
| `query.project` | `string` | No | Filter by project |
| `query.days` | `number` | No | Time window (default: 30) |

```typescript
const lifecycle = await client.analytics.getAgentLifecycle('code-validator', { days: 90 });
for (const entry of lifecycle) {
  console.log(`v${entry.definitionVersion}: avg=${entry.avgScore}, runs=${entry.runs}, pass=${entry.passRate}`);
}
```

#### `client.analytics.getAgentReliability(query)`

Get agent reliability statistics (false positive, declined and resolution rates).

`falsePositiveRate` counts `false-positive` only; `declinedRate` is the `wontfix` share — a
judgment not to act, in neither the resolution nor the false-positive numerator and never
scored (ops-api ≥ 262bc93, @uluops/analytics 0.11.0). Before that, `wontfix` was inside
`falsePositiveRate` — same field, same type, narrower meaning.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent` | `string` | No | Filter by agent |
| `days` | `number` | No | Time window (default: 90) |

```typescript
const { agents } = await client.analytics.getAgentReliability({ days: 90 });
for (const a of agents) {
  console.log(`${a.name}: reliability=${a.reliabilityScore} declined=${a.declinedRate}%`);
}
```

#### `client.analytics.getResolutionRates(query)`

Get issue resolution rates by project.

```typescript
const rates = await client.analytics.getResolutionRates();
for (const rate of rates) {
  console.log(`${rate.project}: ${rate.resolutionRate * 100}% resolved`);
}
```

#### `client.analytics.getFileHotspots(query)`

Get files with the most issues.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | No | Filter by project |
| `days` | `number` | No | Time window |
| `limit` | `number` | No | Max results |

```typescript
const hotspots = await client.analytics.getFileHotspots({ limit: 10 });
for (const hotspot of hotspots) {
  console.log(`${hotspot.filePath}: ${hotspot.totalIssues} issues`);
}
```

#### `client.analytics.getTaxonomyDistribution(query)`

Get issue distribution by failure domain.

```typescript
const distribution = await client.analytics.getTaxonomyDistribution();
for (const d of distribution) {
  console.log(`${d.domain}: ${d.count} issues`);
}
// Output: STR: 50, SEM: 80, PRA: 30, EPI: 20
```

#### `client.analytics.getFullTaxonomy(query)`

Get comprehensive taxonomy analytics.

```typescript
const taxonomy = await client.analytics.getFullTaxonomy();
console.log('By domain:', taxonomy.byDomain);
console.log('By mode:', taxonomy.byMode);
console.log('By severity:', taxonomy.bySeverity);
```

#### `client.analytics.getBurndown(query)`

Get burndown time series by failure domain.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | No | Filter by project |
| `days` | `number` | No | Time window (default: 30) |
| `granularity` | `string` | No | `'daily'` or `'weekly'` |

```typescript
const burndown = await client.analytics.getBurndown({ days: 30 });
console.log('Time series:', burndown.timeSeries);
console.log('Trends:', burndown.trends);
// { STR: { trend: 'declining', avgDailyChange: -0.05, netChange: -12, confidence: 'high' }, ... }
```

#### `client.analytics.getVelocity(query)`

Get velocity metrics per failure mode.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | No | Filter by project |
| `days` | `number` | No | Time window |
| `alertThreshold` | `number` | No | Velocity threshold for alerts |

```typescript
const velocity = await client.analytics.getVelocity({ alertThreshold: 10 });
for (const item of velocity.items) {
  console.log(`${item.failureCode}: velocity=${item.velocityPercent}%, alert=${item.alert}`);
}
console.log('Summary:', velocity.summary);
```

#### `client.analytics.getDiscovery(query)`

Get discovery timeline (new vs recurring issues).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | No | Filter by project |
| `days` | `number` | No | Time window |
| `groupBy` | `string` | No | `'day'`, `'week'`, `'month'` |

```typescript
const discovery = await client.analytics.getDiscovery({ groupBy: 'week' });
console.log('Timeline:', discovery.timeline);
console.log('Summary:', discovery.summary);
// { totalNew: 8, totalRecurring: 22, newRate: 0.27 }
```

#### `client.analytics.getAgentMatrix(query)`

Get agent-taxonomy coverage matrix.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | No | Filter by project |
| `days` | `number` | No | Time window (default: 90) |
| `minIssues` | `number` | No | Minimum total qualifying issues per agent across domains (1–1000, default 5) |

The SDK sends the API's canonical `minIssues` query key. The API also accepts
`min_issues` for older SDKs; conflicting aliases return a field validation error.
`effectiveMinIssues` echoes the applied threshold. `eligibility` reports candidate,
included and excluded agent counts and identifies single-point/overlap analysis as
canonical modes before threshold filtering. `singlePointAgentsExcludedFromMatrix`
counts distinct agents in single-point results that are absent from the matrix.
Matrix totals count qualifying issues in supported domains, not execution counts;
single-point/overlap analysis additionally requires canonical domain/mode pairs.
Both use the same authorized project and time window. Older servers may omit
`effectiveMinIssues` and `eligibility`; absence means unavailable, not zero.

```typescript
const matrix = await client.analytics.getAgentMatrix();
console.log('Coverage matrix:', matrix.matrix);
console.log('Blind spots:', matrix.analysis.blindSpots); // Domains not detected
console.log('Single points:', matrix.analysis.singlePoints); // Only one agent detects
console.log('High overlap:', matrix.analysis.highOverlap); // 3+ agents detect

// `analysis` is scoped to the CANONICAL taxonomy. Codes outside it come back separately
// (5.15.0+):
if (matrix.shadowModes === undefined) {
  // API predates the field — it did not look, which is not the same as finding none.
} else if (matrix.shadowModes.length > 0) {
  console.log('Non-canonical codes in use:', matrix.shadowModes);
  // → [{ mode: 'EPI-OMI', issueCount: 7, agentCount: 3 }]
}
```

> **`shadowModes` is `ShadowMode[] | undefined`, and the distinction matters.** `undefined`
> means the API does not report shadow modes (any release before `ops-uluops-api` `7ada3b0`);
> `[]` means it does and found none. The field exists precisely because an exclusion that
> leaves no trace is indistinguishable from an exclusion of nothing, so it is deliberately
> **not** defaulted to `[]` — that would rebuild the ambiguity at the SDK boundary. Handle
> `undefined` rather than assuming an array.

#### `client.analytics.getTrendSummary(query)`

Get general trend summary.

```typescript
const trends = await client.analytics.getTrendSummary();
for (const trend of trends) {
  console.log(`${trend.period}: ${trend.newIssues} new, ${trend.resolvedIssues} resolved`);
}
```

#### `client.analytics.getByMetric(metric, query)`

Get analytics by specific metric name.

Available metrics: `agent_performance`, `resolution_rates`, `cross_project_patterns`, `file_hotspots`, `regression_analysis`, `trend_summary`, `cost_analysis`, `taxonomy_distribution`.

```typescript
import { isValidMetric, ANALYTICS_METRICS } from '@uluops/ops-sdk';
import type { AnalyticsMetric } from '@uluops/ops-sdk';

// Guard user input before calling
if (isValidMetric(userInput)) {
  const data = await client.analytics.getByMetric(userInput, { days: 30 });
}

// Enumerate valid metrics
console.log(ANALYTICS_METRICS); // ['agent_performance', 'resolution_rates', ...]

// Or use typed literals directly — IDE autocomplete for valid metrics
const metric: AnalyticsMetric = 'cost_analysis';
const costData = await client.analytics.getByMetric(metric, { days: 30 });
```

#### `client.analytics.listAgents(query)`

List agents with summary info (derived from performance data).

```typescript
const agents = await client.analytics.listAgents();
for (const v of agents) {
  console.log(`${v.name}: avg=${v.averageScore}, runs=${v.totalRuns}, pass=${v.passRate}`);
}
```



---

### Taxonomy Operations

Get the failure taxonomy schema.

#### `client.taxonomy.get()`

Get the full taxonomy schema with domains, modes, and severities.

```typescript
const taxonomy = await client.taxonomy.get();

console.log('Domains:', taxonomy.domains);
// [
//   { code: 'STR', name: 'Structural', description: '...', modes: [{ code: 'OMI', name: 'Omission', description: '...' }, ...] },
//   { code: 'SEM', name: 'Semantic', description: '...', modes: [...] },
//   { code: 'PRA', name: 'Pragmatic', description: '...', modes: [...] },
//   { code: 'EPI', name: 'Epistemic', description: '...', modes: [...] },
// ]

console.log('Severities:', taxonomy.severities);
// [{ code: 'C', name: 'critical', weight: 10 }, { code: 'H', name: 'high', weight: 5 }, ...]

console.log('Priorities:', taxonomy.priorities);
// ['critical', 'high', 'suggested', 'backlog']
```

---

### Org Operations

Reads any **member** of an org can make. (Org CRUD, membership and invitations are dashboard
surfaces and are not wrapped by this SDK.)

#### `client.orgs.getVisibleAuditLog(slug, query?)` — the org-visible audit feed (D19)

The subset of an org's audit log that any member may read: rows whose writer marked
`details.visibility = 'org'`. Today that is one class — a project **leaving this org for someone's
personal org** (an org admin may do that; before D19 the org's owner could not see it). The full
audit log stays admin+ and is not wrapped here.

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | `string` | Opaque keyset cursor — pass a prior page's `nextCursor` back verbatim |
| `limit` | `number` | Page size, 1–100 — the API answers 400 outside that range (it does not clamp) |

```typescript
import { readRehomeAuditDetails } from '@uluops/ops-sdk';

const feed = await client.orgs.getVisibleAuditLog('acme', { limit: 50 });
for (const entry of feed.data.entries) {
  const move = readRehomeAuditDetails(entry);      // null for rows written by anything else
  if (move) console.log(`${move.project_name}: ${move.from_org.slug} → ${move.to_org.slug} (${move.action})`);
}
// feed.count is the page size, feed.hasMore / feed.nextCursor page it
```

`action` on every row is the platform's closed enum (`org.updated`); the real event is
`details.action` (`project.rehome_out` on the source org's feed, `project.rehome_in` on the
target's). A non-member gets `403 ORG_ACCESS_DENIED`.

---

#### `client.orgs.list()` — the orgs you belong to

`GET /orgs`: every org the key holder is a member of, personal org included (`isPersonal: true`),
each with `slug`, `role`, `memberCount`, `subscriptionTier`. A key bound to one org still lists all
of its holder's orgs; the binding governs what it may *read*.

#### `client.orgs.getLogStat(slug, query?)` — the org rollup (ulu log §3.6)

The same body as `projects.getLogStat` computed over the org's live projects, plus `projects[]` —
the summary shape `{ name, runs, issues, fixed, regressions, lastRunAt }` where each column is that
project's own rollup measure (`regressions` = `cameBack.detected`, run-caught only), ordered by last
run desc then name, capped at 100 with `hasMoreProjects`. Any member reads. Served from a **60 s
TTL cache** per (org, window) — `computedAt` says how old the numbers are. Unknown slug → 404
`ORG_NOT_FOUND`; a key bound to another org → 403 `ORG_ACCESS_DENIED`. The slug in the path is the
org — no `OrgScopedOptions` here.

```typescript
for (const org of await client.orgs.list()) {
  const s = await client.orgs.getLogStat(org.slug);
  console.log(org.slug, `${s.projects.length}${s.hasMoreProjects ? '+' : ''} projects`, `${s.examined.runs} runs`, `${s.found.issues} findings`, `${s.decided.completed} fixed`, `${s.cameBack.detected} regressions`, `(as of ${s.computedAt})`);
}
```

### Admin Operations

The **platform-admin** surface (`users.role = 'admin'` — a platform role, not an org role). The two
writes additionally require a **login-issued session**: an API key, even an admin's, answers
`403 SESSION_REQUIRED` (`isSessionRequiredError`) — that is D20, the compensation for a stolen
admin key being able to move any project anywhere in one call. Log in with `client.login()` (and
`loginWithTotp()` if challenged) and the session bearer is what these calls send. A non-admin
principal gets `403 INSUFFICIENT_ROLE` on all four. There is deliberately no MCP tool for any of
this.

#### `client.admin.rehomeProject(projectId, { targetOrg, reason })` — session only

Move **any** project between **any** two orgs by UUID; no source- or target-membership
requirement, so `reason` is **required** (on this path the target org's only standing is the audit
row plus that text). Resolves the project unscoped — the route takes a UUID and the SDK refuses a
name client-side (`InputValidationError`). Answers the same refusals as the member path; here
`same_org` does mean "already done" (the lookup is by id, so the moved project is found wherever
it is), which is what makes a scripted pass over a list idempotent.

```typescript
await client.login(email, password, { autoRefresh: false });   // or loginWithTotp(...) after an MfaRequiredError
try {
  const moved = await client.admin.rehomeProject(projectId, { targetOrg: 'ulu-labs', reason: 'OQ-4 row 7' });
  console.log(moved.rehome.from_org.slug, '→', moved.rehome.to_org.slug);
} catch (err) {
  if (rehomeRefusalReason(err) === 'same_org') { /* done on a previous run */ }
  else throw err;
}
```

#### `client.admin.listProjectRehomes(query?)` — key-readable

The **current redirect table**: one row per vacated `(sourceOrgId, name)` and the `targetOrgId` it
points at. A reversal annihilates its row and a release deletes it, so this is state, not history.
`org` takes a UUID or a slug; `total` is the matching count and `returned` the page.

```typescript
const { data, total } = await client.admin.listProjectRehomes({ org: 'system', limit: 100 });
// data[0] → { id, sourceOrgId, name, projectId, targetOrgId, actorId, reason, createdAt }
```

#### `client.admin.listProjectRehomeEvents(query?)` — key-readable

The **append-only ledger** (D21): every `moved`, `repointed`, `annihilated`, `degenerate_dropped`,
`released` and `hard_deleted` event, written in the same transaction as the change; nothing the API
offers removes a row. Pages by `seq` (insertion order) — `nextCursor` is the `seq` to continue
below; pass it back verbatim. **Reconcile a migration against this**, not against the reservation
table and not against the script's own log. Unknown future event kinds parse verbatim
(`PROJECT_REHOME_EVENT_KINDS` lists the known six).

```typescript
const page = await client.admin.listProjectRehomeEvents({ org: 'ulu-labs', event: 'moved', limit: 100 });
page.data[0]; // { seq, event, projectId, projectName, fromOrgId, toOrgId, viaAdminPath, reason, createdAt, ... }
```

#### `client.admin.releaseProjectRehome(rehomeId)` — session only

Release a vacated address so the old `(org, name)` is creatable again — a by-name writer there then
gets a **new** project instead of a 410. Audited (a `released` ledger row); never done by time.

```typescript
await client.admin.releaseProjectRehome(reservationId); // → { released: true }
```
A `ZodError` here means the 200 body was not `{ released: true }` — and since the server answers
after the row is gone, the release most likely happened; re-read the listing before retrying.

---

### Health Check

Check API server status. This endpoint does not require authentication.

```typescript
import { OpsHttpClient } from '@uluops/ops-sdk';
import type { HealthResponse } from '@uluops/ops-sdk/types';

const http = new OpsHttpClient({ apiKey: 'ulr_...' });
const health = await http.get<HealthResponse>('/health');
console.log(health.status);   // 'ok' | 'degraded' | 'unhealthy'
console.log(health.version);  // API version
console.log(health.database); // { connected: boolean, latencyMs: number }
```

---

## CLI

For command-line usage, see the dedicated CLI package: [`@uluops/cli`](https://www.npmjs.com/package/@uluops/cli).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ULUOPS_API_KEY` | API key for authentication | - |
| `ULUOPS_EMAIL` | Email for session auth | - |
| `ULUOPS_PASSWORD` | Password for session auth | - |
| `ULUOPS_SESSION_TOKEN` | Session token for auth | - |
| `ULUOPS_ORG_SLUG` | Org slug for org-scoped requests (lowest precedence in [Org routing](#org-routing--which-org-a-call-lands-in)) | personal org |
| `ULUOPS_BASE_URL` | API base URL | `https://api.uluops.ai/api/v1` (localhost:3100 when `NODE_ENV=development`) |
| `ULUOPS_DEBUG` | Enable debug logging | `false` |

Create a `.env` file in your project:

```env
ULUOPS_API_KEY=ulr_your-api-key-here
```

Or configure globally in `~/.uluops/.env`.

## Error Handling

The SDK provides typed error classes for precise error handling:

```typescript
import {
  OpsApiError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  NetworkError,
  TimeoutError,
  isOpsApiError,
} from '@uluops/ops-sdk/errors';

try {
  await client.projects.get('non-existent');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log(error.message); // "Project 'non-existent' not found"
    console.log(error.details); // { resource: "Project 'non-existent' not found" }
  } else if (error instanceof UnauthorizedError) {
    console.log('Please authenticate');
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.details?.retryAfter}s`);
  } else if (error instanceof ValidationError) {
    console.log('Invalid input:', error.details);
  } else if (isOpsApiError(error)) {
    console.log(`API error: ${error.code} - ${error.message}`);
  }
}
```

### Error Classes

| Error | Status | Description |
|-------|--------|-------------|
| `ValidationError` | 400 | Invalid request data |
| `UnauthorizedError` | 401 | Authentication required |
| `ForbiddenError` | 403 | Access denied |
| `NotFoundError` | 404 | Resource not found |
| `ConflictError` | 409 | Resource conflict |
| `RateLimitError` | 429 | Rate limit exceeded |
| `PayloadTooLargeError` | 413 | Request body too large |
| `UnprocessableError` | 422 | Semantically invalid request |
| `ServiceUnavailableError` | 503 | Server unavailable |
| `NetworkError` | - | Connection error (auto-retried) |
| `TimeoutError` | - | Request timeout |
| `InputValidationError` | - | Client-side Zod validation failure |

### Type Guards

Every error class also ships a type guard. These are an alternative to `instanceof`
that narrows the error type without importing the class — useful in `switch`-style
handling or when you only need a subset of the hierarchy:

```typescript
import {
  isOpsApiError,        // any server-returned API error
  isNotFoundError,      // 404
  isUnauthorizedError,  // 401
  isForbiddenError,     // 403
  isValidationError,    // 400
  isConflictError,      // 409
  isUnprocessableError, // 422
  isRateLimitError,     // 429
  isPayloadTooLargeError, // 413
  isServiceUnavailableError, // 503
  isNetworkError,       // connection failure
  isTimeoutError,       // request timeout
} from '@uluops/ops-sdk/errors';

try {
  await client.runs.save(input);
} catch (error) {
  if (isNotFoundError(error)) {
    // handle missing resource
  } else if (isRateLimitError(error)) {
    console.log(`Retry after ${error.details?.retryAfter}s`);
  } else if (isOpsApiError(error)) {
    console.log(`API error: ${error.code} - ${error.message}`);
  }
}
```

### Automatic Retries

The SDK automatically retries on transient errors (502, 503, 504, 429) and network failures (DNS, connection reset, ECONNREFUSED) with exponential backoff:

```typescript
const client = new OpsClient({
  apiKey: 'ulr_...',
  retries: 3,        // Number of retry attempts (default: 3)
  timeout: 30000,    // Request timeout in ms (default: 30000)
});
```

### Request Size Limits

The API enforces the following payload limits:

- **Request body**: 1 MB maximum for most endpoints
- **`raw_markdown`** field in `runs.save()`: up to 500,000 characters
- **Recommendations array**: no hard limit, but very large arrays (1000+) may cause timeouts
- **Bulk operations**: capped at 100 items per request (e.g., `bulkUpdateStatus`)

Requests exceeding these limits will receive a `413 Payload Too Large` or `422 Unprocessable Entity` response.

## Input Validation

The SDK includes Zod-based runtime validators for all mutating operations. Import them from `@uluops/ops-sdk/config`:

```typescript
import { InputValidationError } from '@uluops/ops-sdk/errors';
import { validateCreateProjectInput } from '@uluops/ops-sdk/config';

try {
  const validated = validateCreateProjectInput({ name: '' }); // throws
} catch (error) {
  if (error instanceof InputValidationError) {
    console.log('Validation errors:', error.errors);
    // => [{ code: 'too_small', minimum: 1, path: ['name'], message: 'Too small: expected string to have >=1 characters' }]
  }
}
```

Available validators: `validateRegisterInput`, `validateLoginInput`, `validateCreateProjectInput`, `validateSaveRunInput`, `validateCreateUserIssueInput`, `validateUpdateIssueStatusInput`, `validateBulkStatusUpdateInput`, and more.

## Advanced Usage

### Using the Low-Level HTTP Client

> **Prefer `OpsClient`** for all standard operations. Use `OpsHttpClient` directly only when you need custom endpoints or raw response access.

For advanced use cases, you can use `OpsHttpClient` directly:

```typescript
import { OpsHttpClient } from '@uluops/ops-sdk';

const http = new OpsHttpClient({
  apiKey: 'ulr_...',
});

// Make raw requests
const data = await http.get<MyType>('/custom/endpoint', { param: 'value' });
const result = await http.post<MyType>('/custom/endpoint', { body: 'data' });
const raw = await http.requestRaw('GET', '/endpoint'); // Without data unwrapping
```

### Custom Authentication Strategy

The two strategies the client installs itself — `ApiKeyAuth` and `JwtSessionAuth` — are exported at the package root (re-exports of `@uluops/sdk-core/http`) for callers that construct one directly instead of through `createAuthStrategy`; the factory is the documented path and the constructors' signatures are sdk-core's.

```typescript
import { OpsHttpClient, createAuthStrategy } from '@uluops/ops-sdk';

// Create auth strategy manually
const authStrategy = createAuthStrategy({
  apiKey: 'ulr_...',
  // or
  sessionToken: 'jwt-token',
});

// Wire the strategy into the HTTP client
const http = new OpsHttpClient();
http.setAuthStrategy(authStrategy);
```

### Loading Credentials Programmatically

```typescript
import { loadCredentials, loadConfig } from '@uluops/ops-sdk/config';

// Load from environment and config files
const credentials = loadCredentials();
console.log(credentials.apiKey);
console.log(credentials.email);

// Load full config
const config = loadConfig();
console.log(config.baseUrl);
```

## Troubleshooting

### Invalid API Key Format

```text
Error: Invalid API key format. Keys must start with 'ulr_'
```

Ensure your API key starts with the `ulr_` prefix. Generate a new key if needed:

```typescript
const { key } = await client.auth.createApiKey({ name: 'My Key' });
console.log(key); // ulr_abc123...
```

### Authentication Errors

```text
UnauthorizedError: the provided api_key credential was rejected (401)
```

Check that:
1. Your API key is valid and not revoked
2. Environment variables are set correctly
3. The `.env` file is in the correct location

```bash
# Verify environment
[ -n "$ULUOPS_API_KEY" ] && echo "ULUOPS_API_KEY is set" || echo "ULUOPS_API_KEY is NOT set"
```

### Rate Limiting

```text
RateLimitError: Rate limit exceeded. Retry after 60 seconds
```

The SDK automatically retries rate-limited requests. For high-volume operations:

1. Batch operations where possible
2. Increase retry count: `retries: 5`
3. Add delays between requests

### Debug Mode

Enable debug logging to see request/response details:

```typescript
const client = new OpsClient({
  apiKey: 'ulr_...',
  debug: true,
});
```

Or via environment:

```bash
ULUOPS_DEBUG=true node app.js
```

## License

MIT License - see [LICENSE](./LICENSE) for details.

Occurrence `correlationStatus` is a saved detection fact, separate from current issue status. Legacy rows may be null, and run recommendation status is `unknown` when no fact was captured. Discovery retains regression-inclusive `recurringIssues` and adds optional `regressionIssues`, `observedIssues`, `unknownIssues` (summary `totalRegressions`, `totalObserved`, `totalUnknown`); absent fields indicate an older API, not zero.


### Versioned idempotency (F20)

`runs.save({ ..., idempotencyKey: "submission-1", idempotencyContract: "report-v2", rawMarkdown: report })`
negotiates support through authenticated `/capabilities` using the same org context.
Unsupported selection throws `UnsupportedContractError` before the write. Omission
keeps `legacy-v1`, whose hash excludes report text. Optional `result.idempotency`
reports the contract, replay status, comparison quality and excluded fields; older
servers omit it. A historical hashless replay is `unverifiable`. V2 compares exact
report bytes (omitted/null are equivalent), and retains the original accepted hash
after enrichment. A key cannot switch contracts. Use a new key only for an intentional
new submission. SDK-core's F20 code-preserving build is required for these errors;
final stable dependency pins are a coordinated release gate.
