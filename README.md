# @uluops/ops-sdk

[![npm version](https://img.shields.io/npm/v/@uluops/ops-sdk.svg)](https://www.npmjs.com/package/@uluops/ops-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

Official TypeScript SDK for the UluOps validation tracker API. Track validation runs, manage issues, analyze trends, and integrate AI validation pipelines into your workflow.

**Current version: 0.1.0** | [Changelog](./CHANGELOG.md)

## Quick Start

### Programmatic Usage

```typescript
import { OpsClient } from '@uluops/ops-sdk';

const client = new OpsClient({
  apiKey: 'ulr_your-api-key-here',
});

// Save a validation run
const result = await client.runs.save({
  project: 'my-project',
  workflowType: 'post-implementation',
  validators: [
    { name: 'code-validator', score: 85, status: 'PASS' },
    { name: 'test-architect', score: 72, status: 'APPROVED' },
  ],
  recommendations: [
    {
      validator: 'code-validator',
      title: 'Missing error handling',
      priority: 'suggested',
      filePath: 'src/api/client.ts',
      lineNumber: 42,
    },
  ],
});

console.log(`Run #${result.run.runNumber} saved: ${result.issues.created} issues created`);
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
  - [Admin Operations](#admin-operations)
- [Environment Variables](#environment-variables)
- [Error Handling](#error-handling)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

The UluOps SDK provides programmatic access to the UluOps validation tracker API, enabling you to:

- **Track Validation Runs**: Save validation pipeline results with validator scores and recommendations
- **Manage Issues**: Create, search, update, and track issues across projects
- **Analyze Trends**: Get burndown charts, velocity metrics, and taxonomy distribution analytics
- **Automate Workflows**: Integrate validation tracking into CI/CD pipelines

The SDK covers **74 API endpoints** across 7 operation domains with full TypeScript support.

## Features

- **Full API Coverage**: Access all 74 endpoints across auth, projects, runs, issues, analytics, taxonomy, and admin domains
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

## Authentication

The SDK supports two authentication methods:

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

For interactive applications, you can authenticate with email/password:

```typescript
import { OpsClient } from '@uluops/ops-sdk';

const client = new OpsClient({
  baseUrl: 'https://api.uluops.com/api/v1',
});

// Login to get a session
const { token, user } = await client.auth.login({
  email: 'user@example.com',
  password: 'your-password',
});

// Create a new client with the session token
const authenticatedClient = new OpsClient({
  sessionToken: token,
});

// Logout when done
await authenticatedClient.logout();
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
  ValidatorPerformance,
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
| `@uluops/ops-sdk` | Main `OpsClient`, `OpsHttpClient`, auth strategies |
| `@uluops/ops-sdk/types` | All TypeScript types and Zod schemas |
| `@uluops/ops-sdk/errors` | Error classes and utilities |
| `@uluops/ops-sdk/config` | Configuration loaders and constants |

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
  baseUrl: 'http://localhost:3100/api/v1',  // API base URL
  timeout: 30000,              // Request timeout in ms (default: 30000)
  retries: 3,                  // Retry count for transient errors (default: 3)
  debug: false,                // Enable debug logging

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
| `displayName` | `string` | No | Display name |
| `bio` | `string` | No | User bio |
| `avatarUrl` | `string` | No | Avatar URL |

```typescript
const { user } = await client.auth.updateProfile({
  displayName: 'John Doe',
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
| `newPassword` | `string` | Yes | New password |

```typescript
await client.auth.resetPassword({
  token: 'reset-token-from-email',
  newPassword: 'newSecurePassword',
});
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
| `project` | `string` | Yes | Current project name or ID |
| `name` | `string` | Yes | New project name |

```typescript
const project = await client.projects.rename({
  project: 'old-name',
  name: 'new-name',
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
| `validator` | `string` | No | Filter by validator |
| `limit` | `number` | No | Max results (default: 50) |
| `offset` | `number` | No | Pagination offset |

```typescript
const issues = await client.projects.listIssues('my-project', {
  status: 'open',
  priority: 'critical',
  limit: 10,
});
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

---

### Run Operations

Save and manage validation runs.

#### `client.runs.save(input)`

Save a new validation run.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | Yes | Project name or ID |
| `workflowType` | `string` | Yes | Workflow type (e.g., `'post-implementation'`) |
| `validators` | `Validator[]` | Yes | Array of validator results |
| `recommendations` | `Recommendation[]` | No | Array of issues/recommendations |
| `summary` | `object` | No | Summary statistics |
| `rawMarkdown` | `string` | No | Raw markdown report |

```typescript
const result = await client.runs.save({
  project: 'my-project',
  workflowType: 'post-implementation',
  validators: [
    {
      name: 'code-validator',
      score: 85,
      status: 'PASS',
      model: 'sonnet',
      tokens: { input_tokens: 1000, output_tokens: 500 },
    },
    {
      name: 'test-architect',
      score: 72,
      status: 'APPROVED',
    },
  ],
  recommendations: [
    {
      validator: 'code-validator',
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
console.log(`Issues: ${result.issues.created} created, ${result.issues.updated} updated`);
```

#### `client.runs.validate(input)`

Preview what a save would do without persisting.

```typescript
const preview = await client.runs.validate({
  project: 'my-project',
  workflowType: 'post-implementation',
  validators: [...],
  recommendations: [...],
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
console.log(details.validators);
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
console.log(`Archived ${result.archivedCount} runs`);
```

#### `client.runs.update(input)`

Update run metadata (tokens, scores).

```typescript
const run = await client.runs.update({
  project: 'my-project',
  runNumber: 5,
  validators: [
    { name: 'code-validator', score: 90, input_tokens: 1500 },
  ],
});
```

#### `client.runs.delete(runId)`

Delete a run.

```typescript
await client.runs.delete('run-uuid-here');
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
| `priority` | `Priority` | Yes | `'critical'`, `'suggested'`, `'backlog'` |
| `severity` | `Severity` | No | `'critical'`, `'high'`, `'medium'`, `'low'`, `'info'` |
| `type` | `IssueType` | No | `'bug'`, `'feature'`, `'refactor'`, etc. |
| `filePath` | `string` | No | File path where issue exists |
| `lineNumber` | `number` | No | Line number |
| `description` | `string` | No | Detailed description |
| `failureCode` | `string` | No | Taxonomy code (e.g., `'SEM-VAL/H'`) |
| `validator` | `string` | No | Validator name (defaults to `'user-submitted'`) |

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
| `validators` | `string[]` | No | Filter by validators |
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
console.log('Related issues:', details.relatedIssues);
```

#### `client.issues.getByFingerprint(fingerprint, project)`

Get an issue by its SHA-256 fingerprint.

```typescript
const issue = await client.issues.getByFingerprint('abc123...', 'my-project');
```

#### `client.issues.getHistory(issueId)`

Get status change history for an issue.

```typescript
const history = await client.issues.getHistory('issue-uuid');
for (const entry of history) {
  console.log(`${entry.fromStatus} -> ${entry.toStatus} at ${entry.changedAt}`);
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

#### `client.issues.edit(issueId, input)`

Edit issue metadata.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | `string` | No | New title |
| `filePath` | `string` | No | New file path |
| `lineNumber` | `number` | No | New line number |
| `severity` | `Severity` | No | New severity |
| `category` | `string` | No | New category |
| `failureCode` | `string` | No | New failure code |

```typescript
const issue = await client.issues.edit('issue-uuid', {
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
```

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

#### `client.analytics.getValidatorPerformance(query)`

Get performance metrics by validator.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | No | Filter by project |
| `days` | `number` | No | Time window (default: 30) |

```typescript
const performance = await client.analytics.getValidatorPerformance({ days: 30 });
for (const validator of performance) {
  console.log(`${validator.validator}: avg=${validator.avgScore}, pass=${validator.passRate}`);
}
```

#### `client.analytics.getValidatorReliability(query)`

Get validator reliability statistics (false positive rates, resolution rates).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `validator` | `string` | No | Filter by validator |
| `days` | `number` | No | Time window (default: 90) |

```typescript
const { validators } = await client.analytics.getValidatorReliability({ days: 90 });
for (const v of validators) {
  console.log(`${v.validator}: reliability=${v.reliabilityScore}`);
}
```

#### `client.analytics.getResolutionRates(query)`

Get issue resolution rates by project.

```typescript
const rates = await client.analytics.getResolutionRates();
for (const rate of rates) {
  console.log(`${rate.project}: ${rate.rate * 100}% resolved`);
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
  console.log(`${hotspot.filePath}: ${hotspot.issueCount} issues`);
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
const { data, computedAt } = await client.analytics.getFullTaxonomy();
console.log('By domain:', data.byDomain);
console.log('By mode:', data.byMode);
console.log('By severity:', data.bySeverity);
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
// { STR: { direction: 'declining', rate: -0.05 }, ... }
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
for (const mode of velocity.modes) {
  console.log(`${mode.mode}: velocity=${mode.velocity}, trend=${mode.trend}`);
}
console.log('Alerts:', velocity.alerts);
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

#### `client.analytics.getValidatorMatrix(query)`

Get validator-taxonomy coverage matrix.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | `string` | No | Filter by project |
| `days` | `number` | No | Time window (default: 90) |
| `minIssues` | `number` | No | Min issues for inclusion |

```typescript
const matrix = await client.analytics.getValidatorMatrix();
console.log('Coverage matrix:', matrix.matrix);
console.log('Blind spots:', matrix.blindSpots); // Domains not detected
console.log('Single points:', matrix.singlePoints); // Only one validator detects
console.log('High overlap:', matrix.highOverlap); // 3+ validators detect
```

#### `client.analytics.getTrendSummary(query)`

Get general trend summary.

```typescript
const trends = await client.analytics.getTrendSummary();
for (const trend of trends) {
  console.log(`${trend.metric}: ${trend.value} (${trend.change > 0 ? '+' : ''}${trend.change})`);
}
```

#### `client.analytics.getByMetric(metric, query)`

Get analytics by specific metric name.

```typescript
const costData = await client.analytics.getByMetric('cost_analysis', { days: 30 });
const regressions = await client.analytics.getByMetric('regression_analysis', { project: 'my-project' });
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
//   { code: 'STR', name: 'Structural', modes: ['OMI', 'RED', 'MIS'] },
//   { code: 'SEM', name: 'Semantic', modes: ['VAL', 'TYP', 'LOG'] },
//   { code: 'PRA', name: 'Pragmatic', modes: ['PER', 'SEC', 'MAI'] },
//   { code: 'EPI', name: 'Epistemic', modes: ['DOC', 'NAM', 'CLR'] },
// ]

console.log('Severities:', taxonomy.severities);
// ['critical', 'high', 'medium', 'low', 'info']

console.log('Priorities:', taxonomy.priorities);
// ['critical', 'suggested', 'backlog']
```

---

### Admin Operations

Administrative operations (requires admin role).

#### `client.admin.getStats()`

Get dashboard statistics.

```typescript
const stats = await client.admin.getStats();
console.log(`Users: ${stats.totalUsers} (${stats.activeUsers} active)`);
console.log(`Projects: ${stats.totalProjects}`);
console.log(`Runs: ${stats.totalRuns}`);
console.log(`Issues: ${stats.totalIssues}`);
```

#### `client.admin.listUsers(query)`

List all users with pagination.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `role` | `string` | No | Filter by role |
| `search` | `string` | No | Search by email |
| `page` | `number` | No | Page number |
| `limit` | `number` | No | Results per page |

```typescript
const { users, pagination } = await client.admin.listUsers({
  role: 'admin',
  limit: 20,
});
```

#### `client.admin.getUser(userId)`

Get user details with stats.

```typescript
const { user, stats } = await client.admin.getUser('user-id');
console.log(`${user.email}: ${stats.projectCount} projects, ${stats.runCount} runs`);
```

#### `client.admin.createUser(input)`

Create a new user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | `string` | Yes | User email |
| `password` | `string` | No | User password |
| `role` | `string` | No | User role |
| `sendWelcomeEmail` | `boolean` | No | Send welcome email |

```typescript
const { user, temporaryPassword } = await client.admin.createUser({
  email: 'newuser@example.com',
  role: 'developer',
  sendWelcomeEmail: true,
});
```

#### `client.admin.updateUser(userId, input)`

Update user attributes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `role` | `string` | No | New role |
| `subscriptionTier` | `string` | No | New subscription tier |

```typescript
const { user } = await client.admin.updateUser('user-id', {
  role: 'admin',
  subscriptionTier: 'enterprise',
});
```

#### `client.admin.deactivateUser(userId)`

Deactivate a user account.

```typescript
const { user } = await client.admin.deactivateUser('user-id');
console.log(`User deactivated: ${user.isActive === false}`);
```

#### `client.admin.reactivateUser(userId)`

Reactivate a deactivated user.

```typescript
const { user } = await client.admin.reactivateUser('user-id');
```

#### `client.admin.resetUserPassword(userId)`

Trigger a password reset email for a user.

```typescript
const { message } = await client.admin.resetUserPassword('user-id');
```

#### `client.admin.bulkDeactivate(userIds)`

Bulk deactivate multiple users.

```typescript
const result = await client.admin.bulkDeactivate(['user-1', 'user-2', 'user-3']);
console.log(`Deactivated: ${result.success}, Failed: ${result.failed}`);
```

#### `client.admin.listSessions(query)`

List all active sessions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | No | Filter by user |
| `page` | `number` | No | Page number |
| `limit` | `number` | No | Results per page |

```typescript
const { sessions, pagination } = await client.admin.listSessions({ userId: 'user-1' });
```

#### `client.admin.terminateSession(sessionId)`

Terminate a specific session.

```typescript
const { message } = await client.admin.terminateSession('session-id');
```

#### `client.admin.terminateUserSessions(userId)`

Terminate all sessions for a user.

```typescript
const { message } = await client.admin.terminateUserSessions('user-id');
```

#### `client.admin.listKeys(query)`

List all API keys.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | No | Filter by user |
| `search` | `string` | No | Search by name |
| `page` | `number` | No | Page number |
| `limit` | `number` | No | Results per page |

```typescript
const { keys, pagination } = await client.admin.listKeys({ search: 'production' });
```

#### `client.admin.revokeKey(keyId)`

Revoke an API key.

```typescript
const { message } = await client.admin.revokeKey('key-id');
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
| `ULUOPS_BASE_URL` | API base URL | `http://localhost:3100/api/v1` |
| `ULUOPS_DEBUG` | Enable debug logging | `false` |

Create a `.env` file in your project:

```env
ULUOPS_API_KEY=ulr_your-api-key-here
ULUOPS_BASE_URL=https://api.uluops.com/api/v1
```

Or configure globally in `~/.uluops/.env`.

> **Note:** The SDK defaults to `http://localhost:3100/api/v1` for local development. For production use, always set `ULUOPS_BASE_URL` or pass `baseUrl` to the constructor.

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
    console.log('Project not found');
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
| `ServiceUnavailableError` | 503 | Server unavailable |
| `NetworkError` | - | Connection error |
| `TimeoutError` | - | Request timeout |

### Automatic Retries

The SDK automatically retries on transient errors (502, 503, 504, 429) with exponential backoff:

```typescript
const client = new OpsClient({
  apiKey: 'ulr_...',
  retries: 3,        // Number of retry attempts (default: 3)
  timeout: 30000,    // Request timeout in ms (default: 30000)
});
```

## Input Validation

The SDK includes Zod-based runtime validators for all mutating operations. Import them from `@uluops/ops-sdk/config`:

```typescript
import { validateCreateProjectInput, InputValidationError } from '@uluops/ops-sdk/config';

try {
  const validated = validateCreateProjectInput({ name: '' }); // throws
} catch (error) {
  if (error instanceof InputValidationError) {
    console.log('Validation errors:', error.errors);
  }
}
```

Available validators: `validateRegisterInput`, `validateLoginInput`, `validateCreateProjectInput`, `validateSaveFeaturesListInput`, `validateCreateUserIssueInput`, `validateUpdateIssueStatusInput`, `validateBulkStatusUpdateInput`, and more. See [`src/config/validators.ts`](./src/config/validators.ts) for the full list.

## Advanced Usage

### Using the Low-Level HTTP Client

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

```
Error: Invalid API key format. Keys must start with 'ulr_'
```

Ensure your API key starts with the `ulr_` prefix. Generate a new key if needed:

```typescript
const { key } = await client.auth.createApiKey({ name: 'My Key' });
console.log(key); // ulr_abc123...
```

### Authentication Errors

```
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

```
NetworkError: connect ECONNREFUSED 127.0.0.1:3100
```

Verify the API server is running and accessible:

```bash
curl http://localhost:3100/api/v1/health
```

Or configure the correct base URL:

```typescript
const client = new OpsClient({
  baseUrl: 'https://api.uluops.com/api/v1',
  apiKey: 'ulr_...',
});
```

### Rate Limiting

```
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
