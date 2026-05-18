**[UluOps](https://uluops.ai)** · Operating Intelligence as Infrastructure

---

# @uluops/ops-sdk

[![npm version](https://img.shields.io/npm/v/@uluops/ops-sdk.svg)](https://www.npmjs.com/package/@uluops/ops-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

Official TypeScript SDK with Zod runtime validation for the UluOps validation tracker API. Track validation runs, manage issues, analyze trends, and integrate AI validation pipelines into your workflow.

**Current version: 1.8.5** | [Changelog](./CHANGELOG.md)

## Quick Start

### Programmatic Usage

```typescript
import { OpsClient } from '@uluops/ops-sdk';

// Defaults to https://api.uluops.ai/api/v1/ops in production.
// Set NODE_ENV=development for localhost:3100, or pass baseUrl explicitly.
const client = new OpsClient({
  apiKey: 'ulr_your-api-key-here', // Create via client.auth.createApiKey() or admin dashboard
});

// Save a validation run
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

console.log(`Run #${result.run.runNumber} saved: ${result.correlation.newIssues} new issues`);
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
  - [Health Check](#health-check)
- [Environment Variables](#environment-variables)
- [Error Handling](#error-handling)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

The UluOps SDK provides programmatic access to the UluOps validation tracker API, enabling you to:

- **Track Validation Runs**: Save validation pipeline results with agent scores and recommendations
- **Manage Issues**: Create, search, update, and track issues across projects
- **Analyze Trends**: Get burndown charts, velocity metrics, and taxonomy distribution analytics
- **Automate Workflows**: Integrate validation tracking into CI/CD pipelines

The SDK covers **83 API methods** across 7 operation domains with full TypeScript support.

## Features

- **Full API Coverage**: Access all 83 methods across auth, projects, runs, issues, analytics, and taxonomy domains
- **Type-Safe**: Complete TypeScript definitions with Zod runtime validation
- **Dual Authentication**: API key (preferred) and JWT session support
- **Automatic Retries**: Exponential backoff for transient errors (502, 503, 504, 429)
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
```

**Requirements:**
- Node.js 18.0.0 or higher
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

For interactive applications, use `client.login()` which automatically configures token auto-refresh:

```typescript
import { OpsClient } from '@uluops/ops-sdk';

const client = new OpsClient({
  baseUrl: 'https://api.uluops.ai/api/v1/ops',
});

// Login — installs session auth with automatic token refresh
const { sessionToken, user } = await client.login(
  'user@example.com',
  'your-password',
);

// Client is now authenticated — subsequent requests use the session token
const projects = await client.projects.list();

// Logout when done
await client.logout();
```

> **Note:** Prefer `client.login()` over `client.auth.login()`. The latter only returns the token without installing it, requiring manual client construction.

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
} from '@uluops/ops-sdk/types';

// Errors only
import {
  OpsApiError,
  ValidationError,
  NotFoundError,
  RateLimitError,
} from '@uluops/ops-sdk/errors';

// Config utilities
import { loadCredentials, DEFAULT_BASE_URL } from '@uluops/ops-sdk/config';
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
| `@uluops/ops-sdk/types/enums` | Priority, Status, Severity enums |
| `@uluops/ops-sdk/types/responses` | API response types |
| `@uluops/ops-sdk/types/schemas` | Zod input validation schemas |
| `@uluops/ops-sdk/types/auth` | Auth/credential types |
| `@uluops/ops-sdk/errors` | Error classes and utilities |
| `@uluops/ops-sdk/config` | Configuration loaders and constants |

#### Granular Type Imports

For minimal bundle size, import only the type modules you need:

```typescript
import type { Project } from '@uluops/ops-sdk/types/projects';
import type { Issue } from '@uluops/ops-sdk/types/issues';
import type { Run } from '@uluops/ops-sdk/types/runs';
import type { BurndownResult } from '@uluops/ops-sdk/types/analytics';
import type { Priority, Status, Severity } from '@uluops/ops-sdk/types/enums';
import type { ApiResponse } from '@uluops/ops-sdk/types/responses';
import type { SaveRunInput } from '@uluops/ops-sdk/types/runs';
import type { Credentials } from '@uluops/ops-sdk/config';
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

  // Connection settings
  baseUrl: 'https://api.uluops.ai/api/v1/ops',  // API base URL (localhost:3100 when NODE_ENV=development)
  timeout: 30000,              // Request timeout in ms (default: 30000)
  retries: 3,                  // Retry count for transient errors (default: 3)
  debug: false,                // Enable debug logging

  // Multi-tenancy
  orgSlug: 'my-org',           // Org slug (sets X-Org-Slug header on all requests)

  // Callbacks
  onTokenRefresh: (token) => { /* handle token refresh */ },
});
```

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
const { user, token } = await client.auth.login({
  email: 'user@example.com',
  password: 'password123',
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

```typescript
const { id, name, key } = await client.auth.createApiKey({ name: 'CI Pipeline' });
console.log('Save this key:', key); // Only shown once!
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

Manage validation projects.

#### `client.projects.list()`

List all projects.

```typescript
const projects = await client.projects.list();
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

#### `client.projects.listIssues(idOrName, query)`

List issues for a project with filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | `Status` | No | Filter by status |
| `priority` | `Priority` | No | Filter by priority |
| `severity` | `Severity` | No | Filter by severity |
| `agent` | `string` | No | Filter by agent |
| `limit` | `number` | No | Max results (default: 50) |
| `offset` | `number` | No | Pagination offset |

```typescript
const issues = await client.projects.listIssues('my-project', {
  status: 'open',
  priority: 'critical',
  limit: 10,
});
```

#### `client.projects.listIssuesWithCount(idOrName, query)`

List issues with total count for pagination. Same filters as `listIssues`.

```typescript
const { issues, count } = await client.projects.listIssuesWithCount('my-project', {
  status: 'open',
  limit: 10,
});
console.log(`Showing ${issues.length} of ${count} total issues`);
```

> **Note:** Uses `requestRaw` internally to access the envelope `count` field, which does not include automatic retry or token refresh. Use `listIssues` for retry-safe access without count.

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

---

### Run Operations

Save and manage validation runs.

#### `client.runs.save(input)`

Save a new validation run.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | Yes | Project name or ID |
| `workflowType` | `string` | Yes | Workflow type (e.g., `'post-implementation'`) |
| `agents` | `AgentInput[]` | Yes | Array of agent results |
| `recommendations` | `Recommendation[]` | Yes | Array of issues/recommendations (use `[]` for empty) |
| `summary` | `object` | No | Summary statistics |
| `rawMarkdown` | `string` | No | Raw markdown report |
| `idempotencyKey` | `string` | No | Key for duplicate prevention |
| `definitionType` | `string` | No | Definition type (`'agent'`, `'command'`, `'workflow'`, `'pipeline'`) |
| `definitionName` | `string` | No | Definition name (e.g., `'code-validator'`) |
| `definitionVersion` | `string` | No | Definition version (e.g., `'1.2.0'`) |
| `definitionHash` | `string` | No | SHA-256 content hash of the definition |
| `definitionId` | `string` | No | Registry definition UUID for direct identity linkage |
| `timestamp` | `string` | No | ISO 8601 timestamp override (defaults to server time) |
| `analysisRecords` | `AnalysisRecordInput[]` | No | Structured analysis records (v0.2.0) |
| `analysisSummary` | `AnalysisSummaryInput \| AnalysisSummaryInput[]` | No | Single or per-agent array of analysis summaries (v1.8.1) |
| `analysisSummary.explorationMaps` | `ExplorationMap[]` | No | Structural maps from explorer agents (v1.8.0) |

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
      tokens: { inputTokens: 1000, outputTokens: 500 },
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
      failureCode: 'SEM-VAL/M',
    },
  ],
  summary: {
    averageScore: 78.5,
    allGatesPassed: true,
  },
});

console.log(`Run #${result.run.runNumber} saved`);
console.log(`Issues: ${result.correlation.newIssues} new, ${result.correlation.recurringIssues} recurring`);
```

#### `client.runs.validate(input)`

Preview what a save would do without persisting.

```typescript
const preview = await client.runs.validate({
  project: 'my-project',
  workflowType: 'post-implementation',
  agents: [{ name: 'code-validator', score: 90, decision: 'PASS' }],
  recommendations: [{ agent: 'code-validator', title: 'Unused import', priority: 'backlog', failure_code: 'STR-OMI/L' }],
});

console.log('Would create:', preview.wouldCreate);
console.log('Would update:', preview.wouldUpdate);
console.log('Would regress:', preview.wouldRegress);
```

#### `client.runs.listByProject(projectId, query)`

List runs for a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowType` | `string` | No | Filter by workflow type |
| `limit` | `number` | No | Max results |
| `offset` | `number` | No | Pagination offset |

```typescript
const runs = await client.runs.listByProject('my-project', {
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

#### `client.runs.update(input)`

Update run metadata (tokens, scores).

```typescript
const run = await client.runs.update({
  project: 'my-project',
  runNumber: 5,
  agents: [
    { name: 'code-validator', score: 90, tokens: { inputTokens: 1500 } },
  ],
});
```

#### `client.runs.updateById(runId, input)`

Update run metadata by run UUID (alternative to `update` which uses project+runNumber). Supports post-hoc enrichment with structured analysis data (v1.7.0).

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
const { items, total } = await client.runs.getAgentRunsAnalysis('epictetus-validator', {
  project: 'my-project',
  limit: 10,
});
// items[0]: { decision, score, categoryScores, runNumber, runTimestamp, workflowType, snapshotScore, ... }
```

---

### Issue Operations

Track and manage validation issues.

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
| `failureCode` | `string` | No | Taxonomy code (e.g., `'SEM-VAL/H'`) |
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
  failureCode: 'PRA-SEC/C',
});
```

#### `client.issues.search(query)`

Search issues across projects.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | Yes | Search query |
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

Get status change history for an issue.

```typescript
const history = await client.issues.getHistory('issue-uuid');
for (const entry of history) {
  console.log(`${entry.oldStatus} -> ${entry.newStatus} at ${entry.changedAt}`);
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

Update issue metadata.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | `string` | No | New title |
| `filePath` | `string` | No | New file path |
| `lineNumber` | `number` | No | New line number |
| `severity` | `Severity` | No | New severity |
| `category` | `string` | No | New category |
| `failureCode` | `string` | No | New failure code |

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

// Each result includes per-item success/failure — some items may fail
// while others succeed (e.g., issue not found, invalid status transition)
for (const result of results) {
  if (!result.success) {
    console.warn(`Failed to update ${result.issueId}: ${result.error}`);
  }
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
  console.log(`${agent.name}: avg=${agent.avgScore}, pass=${agent.passRate}`);
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

Get agent reliability statistics (false positive rates, resolution rates).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent` | `string` | No | Filter by agent |
| `days` | `number` | No | Time window (default: 90) |

```typescript
const { agents } = await client.analytics.getAgentReliability({ days: 90 });
for (const a of agents) {
  console.log(`${a.agent}: reliability=${a.reliabilityScore}`);
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
| `minIssues` | `number` | No | Min issues for inclusion |

```typescript
const matrix = await client.analytics.getAgentMatrix();
console.log('Coverage matrix:', matrix.matrix);
console.log('Blind spots:', matrix.analysis.blindSpots); // Domains not detected
console.log('Single points:', matrix.analysis.singlePoints); // Only one agent detects
console.log('High overlap:', matrix.analysis.highOverlap); // 3+ agents detect
```

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
import type { AnalyticsMetric } from '@uluops/ops-sdk';

const metric: AnalyticsMetric = 'cost_analysis'; // IDE autocomplete for valid metrics
const costData = await client.analytics.getByMetric(metric, { days: 30 });
const regressions = await client.analytics.getByMetric('regression_analysis', { project: 'my-project' });
```

#### `client.analytics.listAgents(query)`

List agents with summary info (derived from performance data).

```typescript
const agents = await client.analytics.listAgents();
for (const v of agents) {
  console.log(`${v.name}: avg=${v.avgScore}, runs=${v.totalRuns}, pass=${v.passRate}`);
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

### Health Check

Check API server status. This endpoint does not require authentication.

```typescript
import { OpsHttpClient } from '@uluops/ops-sdk';
import type { HealthResponse } from '@uluops/ops-sdk/types';

const http = new OpsHttpClient({ baseUrl: 'http://localhost:3100/api/v1' });
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
| `ULUOPS_BASE_URL` | API base URL | `https://api.uluops.ai/api/v1/ops` (localhost:3100 when `NODE_ENV=development`) |
| `ULUOPS_DEBUG` | Enable debug logging | `false` |

Create a `.env` file in your project:

```env
ULUOPS_API_KEY=ulr_your-api-key-here
ULUOPS_BASE_URL=https://api.uluops.ai/api/v1/ops
```

Or configure globally in `~/.uluops/.env`.

> **Note:** The SDK defaults to `https://api.uluops.ai/api/v1/ops` in production. Set `NODE_ENV=development` to default to `http://localhost:3100/api/v1`, or pass `baseUrl` explicitly.

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
    console.log(error.details); // { id: 'non-existent' }
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
| `NetworkError` | - | Connection error |
| `TimeoutError` | - | Request timeout |
| `InputValidationError` | - | Client-side Zod validation failure |

### Automatic Retries

The SDK automatically retries on transient errors (502, 503, 504, 429) with exponential backoff:

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
- **`raw_markdown`** field in `runs.save()`: up to 100,000 characters
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
    // => [{ code: 'too_small', minimum: 1, path: ['name'], message: 'String must contain at least 1 character(s)' }]
  }
}
```

Available validators: `validateRegisterInput`, `validateLoginInput`, `validateCreateProjectInput`, `validateSaveRunInput`, `validateCreateUserIssueInput`, `validateUpdateIssueStatusInput`, `validateBulkStatusUpdateInput`, and more. See [`src/config/validators.ts`](./src/config/validators.ts) for the full list.

## Advanced Usage

### Using the Low-Level HTTP Client

> **Prefer `OpsClient`** for all standard operations. Use `OpsHttpClient` directly only when you need custom endpoints or raw response access.

For advanced use cases, you can use `OpsHttpClient` directly:

```typescript
import { OpsHttpClient } from '@uluops/ops-sdk';

const http = new OpsHttpClient({
  baseUrl: 'http://localhost:3100/api/v1',
  apiKey: 'ulr_...',
});

// Make raw requests
const data = await http.get<MyType>('/custom/endpoint', { param: 'value' });
const result = await http.post<MyType>('/custom/endpoint', { body: 'data' });
const raw = await http.requestRaw('GET', '/endpoint'); // Without data unwrapping
```

### Custom Authentication Strategy

```typescript
import { OpsHttpClient, createAuthStrategy } from '@uluops/ops-sdk';

// Create auth strategy manually
const authStrategy = createAuthStrategy({
  apiKey: 'ulr_...',
  // or
  sessionToken: 'jwt-token',
});

const http = new OpsHttpClient({
  baseUrl: 'http://localhost:3100/api/v1',
  // Auth strategy will be created from config
});
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
UnauthorizedError: Authentication required
```

Check that:
1. Your API key is valid and not revoked
2. Environment variables are set correctly
3. The `.env` file is in the correct location

```bash
# Verify environment
echo $ULUOPS_API_KEY
```

### Connection Errors

```text
NetworkError: connect ECONNREFUSED 127.0.0.1:3100
```

Verify the API server is running and accessible:

```bash
curl http://localhost:3100/api/v1/health
```

Or configure the correct base URL:

```typescript
const client = new OpsClient({
  baseUrl: 'https://api.uluops.ai/api/v1/ops',
  apiKey: 'ulr_...',
});
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
