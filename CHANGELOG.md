# Changelog

All notable changes to `@uluops/ops-sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- F06: Preserve optional burndown interval, as-of, granularity, timezone and bucket metadata when parsing API responses; remain compatible with older servers.

## [6.7.1] - 2026-09-24

### Changed

- Preserve score-threshold metadata for agent performance and lifecycle: raw-score threshold, scored-run denominator and percentage units. `passRate` remains the compatibility alias; this metric does not establish a gate outcome.

## [6.7.0] - 2026-09-19

### Added

- Add withResponseContext to org-scoped operations, preserving default return shapes and attaching context to post-response validation errors. Isolate concurrent org metadata while sharing authentication refresh and rate-limit state.


- Add opt-in report-v2 idempotency, per-operation capability negotiation, typed unsupported-contract refusals before writes, and optional replay metadata. Pins `@uluops/sdk-core` 0.18.0, preserving structured 404/409 error codes and details. Opt-in report-v2 requires API capability support.

- **F02 — Analysis type declarations and provenance.** Save/update validation retains explicit `agentType` on records and summaries. Read schemas preserve type source and exact definition ID/version while accepting older responses. Unresolved and historically inferred attribution is `unknown`.

- **F01 — Occurrence history fields.** Retain optional, nullable occurrence `correlationStatus`, additive discovery counts and project-log `occurrenceCounts` in response schemas. Older producer responses remain accepted. Document the distinction between saved occurrence facts, current issue status and original run counts.

Includes the following unpublished 6.6.x candidates.

## [6.6.1] - 2026-09-18 (unpublished candidate)

- Send canonical matrix thresholds and retain eligibility metadata (F22); includes the 6.6.0 analytics wire-contract changes.

## [6.6.0] - 2026-09-18 (unpublished candidate)

### Added

- **`AgentReliability.declinedRate: number`** — the `wontfix` share of an agent's issues
  (0–100), which ops-api has emitted on `GET /analytics/agents/reliability` since `262bc93`
  (2026-09-17, @uluops/analytics 0.11.0 D2-A) and which the non-strict
  `AgentReliabilityResponseSchema` silently dropped: every SDK consumer (ops-mcp
  `get_agent_reliability`, `ulu analytics reliability`) returned rows without it. Required,
  not optional — the API always sends it. Tracker `aa3ab1ed`.

### Changed

- **`AgentReliability.falsePositiveRate` means less than it did — same type, narrower
  meaning.** Since ops-api `262bc93` it counts `false-positive` only; `wontfix` moved to
  `declinedRate` and sits in neither the resolution nor the false-positive numerator, so
  `falsePositiveRate` went DOWN and `reliabilityScore` went UP for every agent with declined
  issues on 2026-09-17, with no change on this SDK's surface. No compiler or parse error can
  show this; this entry is the only channel. `regressionHazardPer1000IssueDays` (regression
  analysis, D4-A) is NOT affected here: `regression_analysis` is served through the untyped
  `getByMetric`, so it already passes through.

## [6.5.2] - 2026-09-17

### Fixed

- Preserve optional nullable `modelRaw` on agent snapshots when parsing save and
  run-detail responses, alongside the normalized `model` field.

## [6.5.1] - 2026-09-16

Patch: the ship-run-#48 fixes — three runtime defects under the org-scoped and session paths, the README/JSDoc corrections from consumer-validate run #47, and package metadata. No new surface; `client.runs.save`'s declared return type widens to what it already returned.

### Changed

- **README: the Quick Start's "Requires a `plus` tier subscription or higher" notice on Project Analytics is gone.** Every tracker analytics feature moved to `free` in `@uluops/tier-gate` 0.5.0/0.6.0 (2026-08-21; the API pins 0.6.0), so the notice described a `ForbiddenError` no caller has been able to receive for weeks. No SDK behavior changes — the methods, the `ForbiddenError` class and the 403 mapping are unchanged; only the claim about who gets one.
- **The no-credentials warning now says where to get a key** — `https://app.uluops.ai` (Settings → API keys) is in the runtime message, not only in README prose. Message text only; the condition and log level are unchanged (consumer-validate run #47, dx-validator).

### Fixed

- **README API-reference examples caught up with the 6.0.0 envelope change** (consumer-validate run #47 — docs-validator and public-interface-validator, the latter's AF-003). `projects.list`, `projects.listIssues` and `runs.listByProject` return `{data, total}` since 6.0.0 but three examples still iterated the raw result (`TypeError: … is not iterable` on copy-paste); `runs.getAgentRunsAnalysis` was destructured as `{items}` after the 6.0.0 `items → data` rename; and `projects.listIssuesWithCount` — removed in 6.0.0 — still had a full section and a stale prose mention. The section is gone, the examples show the envelope, and the prose names the two surviving list methods. Also added the two methods that had no README presence at all — `projects.mergeProjects` (spec v0.3.4) and `auth.totpLogin` — plus `ULUOPS_ORG_SLUG` in the environment-variables table and the `orgs`/`admin` domains in the Features list (8 domains, not 7). The Quick Start guards the nullable `correlation` so it typechecks under `strict`.
- **CHANGELOG hygiene**: the `[Unreleased]` section had drifted to the middle of the file (below six released versions) and three headers used an em dash before the date; both normalized.
- **README: the `runs.update` example passed a nested `tokens` object** — `UpdateAgentInput` is flat by design (`inputTokens`, `outputTokens`, …) and the update path forwards `agents` verbatim, so the documented example sent a key the server drops and reported success. The example now shows the flat fields (ship run #48 — anxiety-reader F1, release-readiness). Also: "Three org-routing errors" above a five-row table; the `#org-routing` anchor pointed at a slug that does not exist; the idempotency-key row states that the content hash is key-order-sensitive inside caller-supplied objects; the "Type-Safe" feature bullet says what write-side validation does and does not do; `findWorkspaceOrgFile` / `WORKSPACE_ORG_FILE` / `PERSONAL_ORG_SENTINEL` and `ApiKeyAuth` / `JwtSessionAuth` are named where their documented siblings are.
- **`client.runs.save` is typed `Promise<SaveRunResponseWithEcho>`** — what the operation has returned since 5.22.0 (`analysisWrite: AnalysisWriteEcho | null`); the facade narrowed it to `SaveRunResponse`, so the echo the 5.22.0 entry advertises was unreachable through the typed client. Type-only widening; no runtime change.
- **JSDoc**: `runs.getAgentRunsAnalysis` `@returns` said `items` (the 6.0.0 rename made it `data`); `analytics.getVelocity` `@returns` named a `period` the parsed shape does not carry. A sweep of every `@returns` mentioning `items` found only these two.
- **`withOrg`'s catch guards the error type** (`instanceof InputValidationError`) instead of asserting it, matching every other catch site; and its comment no longer claims the override covers `requestRaw` / `requestBinary` / `requestStream` (it does not — see Known below).
- **package.json** carries `homepage`, `bugs` and `sideEffects: false` (the npm page had no Homepage/Issues links; bundlers could not tree-shake an ESM-only package without the flag).
- **Tests**: `issues.get(id, { org })` is now actually exercised (the previous test's name promised it and the body called only `analytics.getAgentPerformance`); the update-preview scope guard's documented explicit-`null` rejection is pinned; `validateUuid`'s version/variant nibbles are pinned against a widened regex.

### Fixed (runtime — ship run #48, code-auditor; each verified against source and `dist/` before the fix, each pinned by a test written first and watched fail)

- **`logout()` now clears the installed session.** It revoked every session server-side and returned, leaving the `JwtSessionAuth` — token and, with `autoRefresh` (the default), the password — in place: `isAuthenticated()` stayed true on a revoked token, and the next 401 re-logged-in and silently undid the logout. It now calls the strategy's `clearSession()` after `logoutAll` resolves; the next request fails `UnauthorizedError` before it is sent and `login()` is the only way back. An API-key strategy is left alone (keys are not sessions). Behaviour change on the auth lifecycle; test: `client.test.ts` "logout() clears the local session".
- **Org-scoped views share the root client's resilience state.** `withOrg` returns a prototype-chained view, and sdk-core writes its token-refresh dedup gate (`refreshPromise`), the last rate-limit headers and the once-per-threshold warning latch through `this` — so each per-call view got its own copy: N concurrent scoped 401s started N re-logins (which revoke each other under the API's single-session default), and `getRateLimitInfo()` / `onRateLimitApproaching` never saw org-scoped traffic. Views now forward those fields (and `authStrategy`) to the one root by accessor; views of views chain to the root, not to each other. The field list is the census of sdk-core 0.17.0's mutable instance fields, and the new org-scope tests exercise refresh dedup and rate-limit visibility THROUGH views rather than trusting the list. The pre-existing dedup test only ever hit the root client.
- **`save()` uses the same analysis-bearing predicate as `update()`.** Its own copy tested `analysisSummary !== undefined`, so `analysisSummary: []` demanded an echo the server does not emit for an empty write and threw `AnalysisEchoMismatchError` ("the run WAS saved, do not retry") on a wholly successful save. The empty-array boundary is now pinned on the save path too.

### Known, not fixed here

- **`requestRaw` / `requestBinary` / `requestStream` bypass the org override** — they reach fetch without `request()`, so on a scoped view they send no `X-Org-Slug` and skip the `orgInvalid` rejection. No ops-sdk operation uses them on a scoped path; the `withOrg` comment now says so instead of claiming full coverage (ship run #48).

## [6.5.0] - 2026-09-15

ulu log, Phase 3 (spec v0.1.13 §3.2/§3.3/§3.5/§3.6; checklist Phase 3). Additive — nothing existing changes shape or signature; one existing function changes what it *accepts* (below, under Changed, because that is the kind of change a signature does not show).

### Added

- **`projects.getLog(idOrName, query?, options?)`** — the project log: `run`, `decision` and `regression` events interleaved newest first, keyset-paged (`{ data, count, hasMore, nextCursor? }`; pass `nextCursor` back verbatim). The event union is closed (`LogEvent`, discriminated on `type`) and parsed strictly; `counts` on a `run` is typed `... | null` and IS null on runs saved before migration 065. **Query keys go to the wire as named** (`workflowType`, `includeArchived`) — the API's log schema is camelCase and non-strict, so a snake_cased key is silently ignored with a 200 (the filter vanishes); this call therefore does not use the SDK's generic `toApiQuery`, and the test carries the control showing the generic path would have produced `workflow_type`.
- **`projects.getLogStat(idOrName, query?, options?)`** — the rollup (`ProjectLogStat`): two frames on two clocks, `decided` = current status of the found issues (sums to `found.issues`), D12's `cameBack.detected` / `reopened` as distinct issues with row counts beside them, D13's `activity.restated`, D14's seven-key `byStatus`.
- **`orgs.list()`** — `GET /orgs`: the orgs the key holder belongs to, personal included (`OrgListEntry`). What `ulu log --orgs` iterates.
- **`orgs.getLogStat(slug, query?)`** — the org rollup (`OrgLogStat`): the same body over the org's live projects plus `projects[]` (D15's summary shape, capped at 100 with `hasMoreProjects`) and **`computedAt`** — the org rollup is served from a 60 s TTL cache per (org, window) (D16), and this field is required by the parse: an older API that omits it fails loudly rather than reporting numbers of unknown age.
- **`readWorkspaceFile(path, uid?)`** → `{ org?, project? } | undefined` — the full workspace file, beside the unchanged `readWorkspaceOrgFile`, which now delegates to it. `project` is validated like the API validates a project name (1–200 chars, no control characters) and is **not** trimmed — a name is matched exactly. **A file carrying `project` without `org` throws** (`"project" requires "org"; use "personal" for no org`), so a project-only file can never shadow an outer org. No resolver is added here: the read-only ladder (`--project` → file → `ULUOPS_PROJECT` → error) belongs to the one command that reads it (D5).
- Types: `LogEvent` / `LogRunEvent` / `LogDecisionEvent` / `LogRegressionEvent`, `ProjectLogPage`, `ProjectLogQuery`, `LogStatQuery`, `LogStatBody`, `ProjectLogStat`, `OrgLogStat`, `OrgLogProjectSummary`, `OrgListEntry`, `WorkspaceFile`; the Zod schemas beside them.

### Changed

- **`readWorkspaceOrgFile` no longer throws on a `.uluops.json` that carries `project`** — the allowlist is `org`, `project`, `$schema` (was `org`, `$schema`), and the refusal message now names all three. Same signature, same return; a file that was refused in 6.4.x is read in 6.5.0. This is a semantics-without-signature change and this entry is the only place it shows. **Rollout rule (spec §3.5, by provenance):** because every 6.4.x-and-older reader throws on the key — for every command, not only `ulu log` — `project` may not be written into any checkout, and no docs may describe writing it, until every *installed* copy of this package in that tree is ≥ 6.5.0. The checklist carries the enumeration (`find … -path '*/@uluops/ops-sdk/dist/config/workspace-org.js'`) and the 13-consumer census.

## [6.4.1] - 2026-09-15

6.4.0 reached Verdaccio only; the review of that change set (anxiety-reader 84 / docs-validator 81 / dx-validator 83 / code-auditor 98, all on the `feat/rehome-surfaces` diff) folded into this release before npm. What changed against 6.4.0:

### Added

- **`login(email, password, { autoRefresh })`.** The default (`true`) is unchanged; `false` installs the session without the password so a 401 surfaces untouched. Why it exists: sdk-core's refresh is a *fresh login*, and under the API's default single-session policy a login **revokes the user's other sessions**; the mutation that hit the 401 is then *not* retried, and the budget is one. A script that must treat 401 as "stop" (spec §4.7) was having the SDK act first. Tested both ways: no `/auth/login` on a 401 with the option, exactly one without.
- **`isInsufficientRoleError`** — the fifth 403 code gains the guard every other one has.
- `admin.rehomeProject` / `admin.releaseProjectRehome` **refuse a non-UUID client-side** (`InputValidationError`) — `validateUuid` existed and was dead code; the admin route is id-only and answers 400 to a name, and the whole `projects.*` surface trains callers to pass names.
- TSDoc `@param`/`@returns`/`@example` on the new operations and validators; `@throws {MfaRequiredError}` on `login`.

### Changed

- **`admin.releaseProjectRehome` shape failure is a `ZodError`**, like every other shape failure in this SDK, not a bare `Error` — and the doc says what it means: the server answers 200 after the row is gone, so a shape failure is most likely a *completed* release.
- The admin path's missing-`reason` message says why it is required ("the target org's only standing for the move") instead of Zod's "expected nonoptional".
- `OrgAuditFeedQuery.limit` is documented as **1–100, not clamped** (the API answers 400) — the JSDoc said "1–200 (API-clamped)", which was false on both counts.

### Fixed — documentation that overclaimed

- The 6.4.0 entry said "an MFA-enrolled account could not log in through the SDK … Fixed". True for `login()`/`auth.login()` only: a client constructed with `{ email, password }` (or autoloaded credentials) logs in inside sdk-core, which cannot see the challenge and surfaces a generic `UnauthorizedError`. Documented on `OpsClientConfig`, `MfaRequiredError` and in the README; not fixable from this package without intercepting sdk-core's strategy.
- The MFA challenge token is **single-use and consumed before the code is verified** (API `totp-service.verifyLogin`) — a mistyped code burns it. The README example read as retryable; it no longer does.
- **`same_org` is the idempotence signal of the ADMIN path only.** The member path's lookup is source-scoped, so a re-run after the move answers 404, not `same_org`. `projects.rehome`'s doc, the README table and `rehomeRefusalReason`'s doc now say so, and the table gained the two missing reasons (`project_soft_deleted`, `project_has_no_org`) plus a row for *no HTTP answer* (`null` from `rehomeRefusalReason` is "not a refusal I can name", not "safe to retry").
- README "automatic token refresh" is now qualified with the three properties above.

### Known, not fixed here

- sdk-core's 401 branch inspects the *client's* auth strategy, not the request's `skipAuth`, so a wrong TOTP code on a bare client says "Set ULUOPS_API_KEY" — the one remedy D20 forbids. Filed against sdk-core.
- A TOTP-installed session's expiry message ("credentials were cleared after login") is sdk-core's and wrong for this path; `JwtSessionAuth` has no way to be handed `expiresAt`.

## [6.4.0] - 2026-09-15 (Verdaccio only)

### Added

The client side of project re-home (project-org-routing-and-rehome spec §4; API deployed 2026-09-15). Three surfaces for three audiences — a member capability, a member feed, and a platform-admin namespace — plus the login branch the admin path made unavoidable.

- **`projects.rehome(idOrName, { targetOrg, reason? }, options?)`** — the member path (`POST /projects/:id/rehome`). The SOURCE is the call's org scope (`options.org` / client `orgSlug`); the project is looked up there, so a work-org project moved without scope is a 404, not a silent personal-org lookup. Returns `RehomeResponse`: the project after the move plus `rehome.{from_org, to_org, audit_ids}` (snake_case by contract; `audit_ids` is `[]` today because the platform ACL returns no ids — the ledger is the durable record). Body is built as the API's `.strict()` schema wants it: `reason` is omitted, never sent as null.
- **`rehomeRefusalReason(err)`** and `REHOME_REFUSAL_REASONS` — reads `details.reason` on the 400/409 refusals (`same_org`, `moved_during_request`, `deadlock_retry`, `concurrent_modification`, `name_collision`, `soft_deleted_conflict`, `rehomed_away_conflict`, `export_in_progress`, `project_soft_deleted`, `project_has_no_org`) and returns `null` for anything else, an unknown reason included. Enumerated because the Phase 4 runbook (spec §4.7) assigns each a disposition and a script that types the strings itself will misspell one.
- **`orgs.getVisibleAuditLog(slug, { cursor?, limit? })`** — the D19 feed (`GET /orgs/:slug/audit-log/global`): rows a writer marked `visibility: 'org'`, readable by any member; today, projects leaving the org for a personal org. New `orgs` namespace (reads only). **`readRehomeAuditDetails(entry)`** narrows an entry's `details` to the re-home writer's shape (`RehomeAuditDetails`) or `null`, so a renderer can print a move in one line and everything else raw.
- **`admin.*` namespace** — `rehomeProject(projectId, { targetOrg, reason })` (the D8 platform path: any project, any orgs, by UUID, `reason` REQUIRED), `listProjectRehomes(query?)` (the reservation/redirect table), `listProjectRehomeEvents(query?)` (the D21 append-only ledger, paged by `seq`; unknown event kinds parse verbatim), `releaseProjectRehome(rehomeId)`. All four need the PLATFORM admin role (`403 INSUFFICIENT_ROLE` otherwise); the two writes are session-only (D20). This is the Phase 4 migration script's substrate; no MCP tool wraps it, on purpose.
- **`SESSION_REQUIRED`** / **`isSessionRequiredError`** and **`INSUFFICIENT_ROLE`** — the two 403 codes the admin path adds to the org-routing set.
- **MFA login.** `login()` / `auth.login()` now throw **`MfaRequiredError`** (`mfaChallengeToken`, `expiresAt`, `mfaMethods`; guard `isMfaRequiredError`) when `POST /auth/login` answers the challenge shape, and **`OpsClient.loginWithTotp(challengeToken, code)`** / `auth.totpLogin()` complete it (`POST /auth/totp/login`) and install the session. Not a nice-to-have: D20 makes the admin re-home route session-only and the operator account may be MFA-enrolled, and the SDK could not log such an account in at all — see Fixed. A TOTP-installed session carries no password, so it is NOT auto-refreshed; on expiry requests fail 401 and the caller logs in again (a migration script treats that as "stop", never "retry with the key").
- `ProjectResponseSchema` gains **`orgId`** (nullable, optional). The API has emitted it on every project read since org scoping landed; `z.object()` was stripping it, so a re-homed project's new org was invisible through the SDK.

### Fixed

- **An MFA-enrolled account could not log in through the SDK.** `LoginResponseSchema` required `sessionToken`, and the API's `200 { mfa_required: true, mfa_challenge_token, ... }` challenge body therefore surfaced as a raw `ZodError` on `sessionToken` — a parse failure on a successful request, with the challenge token discarded. The challenge is now parsed first (narrower literal) and thrown as `MfaRequiredError`; a session body still parses (tested as the control).

### Notes

- Live-verified 2026-09-15 against the current API build on a prod-copy database, not only against nock: member round trip personal → team → personal, `410 PROJECT_REHOMED` at the vacated address on a write (reads there 404 — D14 is a write-path check), `same_org`, the source-scope 404, C6 (owner moving into their own personal org), annihilation on reversal, the D19 feed on both orgs with a non-member `ORG_ACCESS_DENIED` control, and the key→session login ladder. The admin ledger schemas were checked against the controller and nock only — the smoke user was not a platform admin (`INSUFFICIENT_ROLE` on all four, which also fixes the middleware order: platform role before the session gate).
- Spec §4.1 says the response carries `orgSlug`; the API emits `orgId` and the slug inside `rehome.to_org`. The schema follows the wire; the spec changelog records the drift.

## [6.3.1] - 2026-09-13

### Security

Security audit of the org-routing train (ops-uluops-api run #187, 2026-09-13). None of these was a bypass; each is a channel by which the wrong org could be chosen silently.

- **`resolveWorkspaceOrg` walk is bounded by the home directory** when `cwd` is under it: a `.uluops.json` at `/`, `/Users` or a container root can no longer become the default for every checkout beneath it (the single-default leak D13 exists to remove, one layer down). Outside home the walk still reaches the root. New `home` option (default `os.homedir()`), injectable for tests.
- **A workspace file owned by another user is refused**, not skipped — the planting vector is a shared parent directory. New `uid` option (default `process.getuid()`; `undefined` disables the check on platforms without uids).
- **The workspace file's key check is an allowlist** (`org`, `$schema`). It was a ten-name denylist while the error said "may carry only org"; `baseURL`, `apikey`, `token` passed. Inert (only `org` was read), but the stated invariant is now the enforced one.
- **`"personal"` is honoured as an explicit value** (`resolveWorkspaceOrg({ explicit: 'personal' })`, `withOrg('personal')`): no header, `source: 'explicit'`. It used to go to the wire as a slug (404 `ORG_NOT_FOUND`, or a real org if anyone registers the name). `withOrg('personal')` does not cancel a constructor `orgSlug`.
- **Per-call org header is set last, and an org header in `options.headers` is refused** on a scoped view. The spread order let a caller header win, and `X-Org-Id` outranks `X-Org-Slug` server-side — no live caller did this; the invariant held by luck.

## [6.3.0] - 2026-09-13

### Added

- **`resolveWorkspaceOrg()` — the D13 workspace default** (project-org-routing-and-rehome spec D13, §2.0). Walks upward from `cwd` to the nearest `.uluops.json` and honours only its `org`; the reserved value `"personal"` stops the walk and means "no org" (a personal repo cloned under a work tree carries it so the outer file does not win). Precedence: `explicit` (a `--org` flag, an MCP tool's `org` argument) > nearest workspace file > `ULUOPS_ORG_SLUG` (kept as the lowest fall-through for headless environments) > personal. Returns `{ org, source, path }` so a caller can print *why* a call landed where it did.

  **The file may carry only `org`.** `apiKey`, `baseUrl`, `profile`, `credentials`, `sessionToken`, `email`, `password` are refused with `InputValidationError`, not ignored — a `.env` in cwd once retargeted the CLI's base URL, and the one guard that keeps that footgun from transferring is that this file cannot name a target or an identity. Malformed JSON and invalid slugs are refused loudly for the same reason: a silently ignored file is a silently wrong org. The slug is server-relative, so "where it landed" output should print the base URL beside the org.

  Lives here, not in each consumer: the CLI and the tracker MCP both need it, and two copies of a walk-up function in two repos are the drift class the spec exists to remove. `findWorkspaceOrgFile` and `readWorkspaceOrgFile` are exported for tooling that wants to explain the answer. `ENV_VARS.ORG_SLUG` added. Tests build their own temp trees and pass `stopAt` so a real `.uluops.json` above the temp dir cannot leak in — this workspace will carry one.

## [6.2.0] - 2026-09-13

### Added

- **Per-call `org` on every project, run, issue and analytics operation** (project-org-routing-and-rehome spec §3.2, D12). Each method on `client.projects`, `client.runs`, `client.issues` and `client.analytics` takes a trailing `options?: { org?: string }` (run writes: `RunCallOptions`, which also carries the existing `_skipClientValidation`). `org` is the target org's slug and becomes `X-Org-Slug` on that one request, overriding the constructor-level `orgSlug`. **Precedence on the wire, lowest to highest: personal org (no header) < constructor `orgSlug` < per-call `org`; an API key BOUND to an org ignores both headers and returns `403 ORG_ACCESS_DENIED` if they name a different org** — the platform's rule, surfaced verbatim. The API never infers an org from a project name (spec D2): a call that names no org creates or targets the *personal* project of that name even when a work org has one by the same name.

  **Mechanism, because it differs from the spec's plan and the difference is worth knowing.** The spec (§3.2) said every operation would migrate from sdk-core's verb helpers to `client.request(..., { headers })`. sdk-core's `get/post/patch/put/delete` all delegate to `this.request`, so instead `OpsHttpClient` overrides `request` and exposes `withOrg(slug)`, a prototype-chained VIEW of the client that merges the header on every request it makes. One seam, zero operation rewrites, and the view shares the root's auth strategy, so a session installed on the root is honoured. `OpsClient` mints the view per call. Same wire contract; the test file asserts on the outgoing request as nock sees it, including a `badheaders` control proving the root client sends no header and that minting a view does not mutate the root.

- **`OpsHttpClient.withOrg(slug)`** and **`scopedOrg`** (read-only, for diagnostics) on the low-level client; `ORG_SLUG_PATTERN` and `ORG_SLUG_HEADER` exported. `withOrg` validates the slug with the same pattern as `orgSlug` and throws `InputValidationError` — it is a header value, so CRLF and whitespace can never reach the wire.

- **Org-routing error codes and type guards**: `INSUFFICIENT_ORG_ROLE` / `isInsufficientOrgRoleError` (403 — below the org's write floor; on tracker writes the API's body carries `details.applied: false` and forbids retrying without `org`: **do not retry the same call org-less — that is not a fallback, it files the work in the caller's personal org**), `ORG_ACCESS_DENIED` / `isOrgAccessDeniedError` (403 — not a member, or a bound key naming another org), and `PROJECT_REHOMED` / `isProjectRehomedError` with `ProjectRehomedDetails` (410 — spec D14: the project this name once denoted in this org now lives in `details.target_org.slug`; pass it as `org` and the same call succeeds). The rehomed guard requires the details shape it promises, not only the code, so a narrowed error is safe to dereference. `InsufficientOrgRoleDetails` declared.

### Changed

- `client.runs.*` write and preview options are typed `RunCallOptions` (`OrgScopedOptions & { _skipClientValidation? }`) instead of the inline `{ _skipClientValidation?: boolean }`. Structurally compatible; nothing a caller wrote breaks.

## [6.1.0] - 2026-09-10

### Added

- **`description` on `IssueResponseSchema` and on `RunDetailsResponseSchema`'s `recommendations[]`** — the occurrence's own account of a sighting, as opposed to the issue's `title`. Both `.nullable().optional()`.

  **Why it needed declaring at all, and why the failure was invisible.** `z.object()` strips undeclared keys and returns a clean 200. So a listing that omitted `description` was indistinguishable from findings that genuinely had none, and every consumer reasonably read the omission as an absence. Nothing errored; nothing logged. This is the same mechanism, on the same file, as `issueStatus` / `659d061d` — the third field to go missing this way, which is why each now carries its own test suite asserting the **value survives the parse**, not merely that parsing succeeds. `success: true` passes against the broken state.

  The cost was real: a remediation pass over `ops-uluops-api` spent a full iteration re-investigating seven findings whose descriptions each said "FIXED IN RUN" — one call away on `get_issue_details`, which does return the field (tracker `fc862289`).

  **Optional in both directions, deliberately.** A required key makes `.parse()` throw on every issue read against an API that predates the change, and the SDK and API deploy independently. Absent means "this read path does not supply it"; `null` means "the latest occurrence has no description". Same reasoning already recorded on `mergedIntoIssueId`.

  **Not a column on `issues`.** It lives on `occurrences`. `GET /projects/:id/issues` derives it per issue via a correlated subquery (ops-uluops-api); the by-id and by-fingerprint lookups do not supply it and will report `undefined`. Requires ops-uluops-api with the matching change deployed — against an older API this parses cleanly and yields `undefined`, which is the intended degradation, not a silent one: the field's absence is now expressible, where before it was indistinguishable from a finding having no description.

## [6.0.0] - 2026-08-24

### BREAKING — breaking-train Train C: the STRICT release (tool-sweep T10/T11/T13/T22/T23)

Closes the 5.23.0 tolerance window: the new API-2.0.0 shapes are pinned
strictly and the pre-flip wire NO LONGER PARSES (the tolerance fixtures now
assert old-wire failure). Requires API >= 2.0.0 (deployed). Migration table:

| Method | 5.x returned | 6.0 returns | Migration |
|---|---|---|---|
| `projects.list()` | `Project[]` | `{data, total}` | read `.data`; `total` is new signal |
| `runs.listByProject()` | `RunSummary[]` | `{data, total}` | read `.data` |
| `projects.listIssues()` | `Issue[]` | `{data, total}` | read `.data`; replaces `listIssuesWithCount` (removed — `count` is now `total`) |
| `runs.get()` / `getLatest()` | full row (`Run`) | 14-key read projection (`Run` narrowed) | dropped fields: use `getDetails` for rawMarkdown/definition trio; internals are gone by design |
| `runs.getDetails().run` | full row | read projection + rawMarkdown + definition trio | — |
| `runs.diff()` `baseRun`/`compareRun` | full rows | read projections | — |
| `runs.update()` / `updateById()` | `Run` | `RunWriteEcho` (full row — unchanged shape, new name) | type-only |
| `runs.getAnalysis()` | `{records, summaries, total}` | `{records, summaries, recordsTotal, summariesTotal}` | `total` is gone; it counted records only |
| `runs.getAgentRunsAnalysis()` | `{items, total}` | `{data, total}` | rename `items` → `data` |
| `projects.mergeProjects()` | spec-§5 snake_case | spec-0.3.5 camelCase | rename keys (runCount, statusAfter, issueDedupes, ..., audit.dryRun) |

- Schema split: `RunReadResponseSchema` / `RunDetailRunResponseSchema` /
  `RunWriteEchoResponseSchema` replace the single `RunResponseSchema` — the
  write echo confirms exactly what was persisted and could not be silently
  slimmed by the read trim. `Run` (type) is now the read projection;
  `RunWriteEcho` is the echo.
- `test/types/tolerance-window.test.ts` flipped to strict pins: new wire must
  parse, old wire must FAIL (a strict schema that still accepted the old
  shape would silently re-open the window).

## [5.23.0] - 2026-08-24

### Changed — breaking-train Train A: the TOLERANT release (tool-sweep T10/T11/T13/T22/T23)

Zero signature changes. Every schema below now parses BOTH the current API
wire and the upcoming API 2.0.0 wire, so consumers on this release survive
the flip in either order. Consumers MUST be on >= 5.23.0 before API 2.0.0
deploys; SDK 6.0.0 (after the flip) re-pins the new shapes strictly.

- `RunResponseSchema`: ten fields become optional (`authorId, rawMarkdown,
  idempotencyKey, payloadHash, definitionType/Name/Version, definitionHash,
  definitionId, registrySyncedAt`) — API 2.0.0 removes them from run READ
  responses (T10); save/update echoes keep the full row. Tolerance flows to
  every embedding schema (diff, details, save, update).
- `RunAnalysisResponseSchema`: `total` optional; optional `recordsTotal`/
  `summariesTotal` added (T22 — exactly one set present per API version).
- `getAgentRunsAnalysis`: reads the raw envelope and accepts the old nested
  `{data: {items, total}}` or the new flat `{data: [...], total}`,
  normalizing to `{items, total}` (return type unchanged).
- `mergeProjects`: response schema is a snake|camel union; camel wire is
  normalized back to the spec-§5 snake_case shape (return type unchanged —
  spec 0.3.5 renames the wire at API 2.0.0, T23).
- Semantics-without-signature notice: `analytics.getByMetric` returns
  `unknown`; at API 2.0.0 the `taxonomy_distribution` metric's runtime shape
  changes from a bare array to `{data, total}`. Callers with `Array.isArray`
  branching are unaffected.
- New `test/types/tolerance-window.test.ts`: paired old-wire/new-wire
  fixtures per surface — in 6.0.0 the old-wire assertions flip to must-FAIL
  and become the strict pins.

### Fixed

- **`AgentPerformanceResponseSchema.averageScore/passRate` and
  `AgentLifecycleEntryResponseSchema.avgScore/passRate` are nullable** — an
  agent with no scored runs aggregates to NULL server-side (the API's own
  types declare `number | null`), and the non-null assertion made
  `list_agents` / `get_analytics(agent_performance)` / `analytics.listAgents`
  throw on real rows. Found live during Train A validation: **`list_agents`
  was broken in production** for any catalog containing unscored agents (e.g.
  explorer/lens agents). `AgentInfo.averageScore/passRate` widen to
  `number | null` accordingly — a type-level change that reflects what the
  wire always carried. This is the nullable-score class one ring out from the
  run schemas, which were fixed earlier (fix the pattern, not the citation).

## [5.22.0] - 2026-08-21

> Numbered past 5.21.0, which is reserved by the in-flight per-key-scopes train
> (staged on Verdaccio 2026-08-21). If this train merges first, scopes rebases and
> takes 5.23.0 — reconcile at merge, whichever lands second renumbers.

### Changed — behavior, not just API surface

- **The default `idempotencyKey` on `runs.save()` is now derived from the payload content
  (sha256), not `randomUUID()`** (tool-sweep T1, tracker project `mcp-tool-surface-sweep`).
  The random default only deduplicated retries inside one call's HTTP loop; a harness-level
  retry — a new `save()` call with the same payload, the default behavior of every agent on
  timeout — minted a fresh UUID and wrote a second billable run. Content-derived, a
  byte-identical resubmission maps to the same key and the server returns the original run
  with `deduplicated: true`. **Semantics to note:** two deliberate, byte-identical keyless
  saves now deduplicate. Callers who want two identical runs pass explicit distinct
  `idempotencyKey`s — or include a `timestamp`, which makes the payloads differ. Caret-ranged
  consumers adopt this on a plain `npm install`.

### Added

- **`runs.save()` surfaces the `analysisWrite` confirmation** (tool-sweep T21; API 2.0.0+, or a
  1.70.0 deploy after 2026-08-19 — this read "≥1.71.0" until 2026-09-13; no such version was
  ever declared, see ops-uluops-api issue `aea76608`).
  The save response envelope now carries `analysisWrite` as a sibling of `data` — the same
  placement as the update envelope — read via `rawEnvelope` and returned on the result
  (`analysisWrite: AnalysisWriteEcho | null`; `recordMode: 'initial'` on this path). Like the
  update path, an **analysis-bearing** save that comes back without the echo throws
  `AnalysisEchoMismatchError` (`reason: 'missing-echo'`) — the run WAS saved; verify via
  `get_run_analysis`, do not retry. A deduplicated replay correctly carries no echo and does
  not throw (nothing was written). Return type is `SaveRunResponseWithEcho` (a superset of
  the previous `SaveRunResponse` — source-compatible).

## [5.21.0] - 2026-08-22

### Added — per-key scope on API keys (platform v1.27.0)

- `createApiKey` accepts `scope: 'read' | 'write'` (`CreateApiKeyInput`,
  `CreateApiKeyInputSchema` — closed enum, validated client-side). Omitted ⇒
  server defaults to `'write'`.
- `PublicApiKeyResponseSchema` now declares `scope` (raw string — the platform
  read surface is deliberately tolerant of an out-of-enum stored value, so the
  SDK relays it rather than throwing). Declaring the field is the whole fix for
  the prior silent strip. The schema stays **strip-by-default (NOT `.strict()`)**
  so an additive platform field stays forward-compatible instead of throwing for
  every consumer — and, on `createApiKey`, throwing *after* the key is minted
  would lose a returned-once secret. See the RegisterResponseSchema and
  MergeConflictKind scars in `response-schemas.ts` for why response-parse
  strictness is the wrong tool; field-set correctness is a live-contract-test
  job. (A `.strict()` was tried and reverted after review, 2026-08-22.)
- `--json` output carries `scope` automatically (plain stringify, no re-parse).

## [5.20.0] - 2026-08-21

### Changed

- **`@uluops/sdk-core` 0.16.0 → 0.17.0** — `ForbiddenError` now retains the API's structured
  `code` and `details` (RE-PROBE-02 N1). Tier-gate denials surface as `code: 'TIER_REQUIRED'`
  with `details {required, current, feature, hint?, upgradeUrl?}`; role denials as
  `ROLE_REQUIRED`/`INSUFFICIENT_ROLE`. Generic 403s keep `code: 'FORBIDDEN'`. No signature
  changes; consumers branching on `code === 'FORBIDDEN'` would no longer match tier/role
  denials (workspace census found none).

## [5.19.0] - 2026-08-21

Adopts update-run phase 1b (API live 2026-08-21, spec v0.7.0): record write
modes, and the F17 success-path echo (both ratified 2026-08-20).

### Added

- **`recordWriteMode: 'replace' | 'merge'`** on `UpdateRunInput` and both
  preview inputs, wired through `buildUpdatePayload`'s allow-list (the
  checklist 2-1 edit, deliberately held back from 5.18.0 while the 1a API
  would have silently stripped it). `merge` upserts on
  `(agent_name, record_id)`: matched rows superseded, unmatched keys
  appended, nothing retired; summaries have no mode. The echo assertion now
  compares against **the mode this call sent** — a pre-1b server that
  strips the field echoes `replace` for a `merge` send, and that mismatch
  throws `AnalysisEchoMismatchError` instead of silently retiring the
  agent's unmatched records under replace semantics the caller didn't ask
  for. The previews forward the mode for the same reason (a stripped mode
  previews the wrong semantics).
- **`runs.updateWithEcho` / `runs.updateByIdWithEcho`** (F17, tracker
  `93031143`): distinct methods returning `{ run, analysisWrite }` —
  success-path visibility of the superseded/created counts.
  `supersededRecords: 0` on an enrichment that expected to replace is the
  only caller-visible symptom of old-attribution rows accumulating beside
  the insert; until now that signal existed solely in a server-side warn
  log. `analysisWrite` is `null` on non-analysis updates. Existing
  `update`/`updateById` signatures and returns are unchanged.
- 204/empty-body regression test on the update path (tracker `71626d6a`):
  the named `OpsApiError` from `parseUpdateEnvelope`, pinned.
- Tarball instrument extended to 8 checks (mode-on-wire, with-echo, and the
  two skew paths below at published shape); `check:tarball:control`
  re-derived — exactly 7 failures required against published 5.17.0.

### Fixed — pre-publish review round (code-validator 89 PASS / anxiety-reader 66 FRAGILITY_MASKED / public-interface 84+89 POLISHED)

- **The preview now asserts the echoed mode** (`reason:
  'preview-mode-mismatch'`, nothing written): a pre-1b server that strips
  `record_write_mode` previews replace while the caller plans a merge — the
  plan's `would_retire_record_ids` then models a write that will not happen
  as previewed. This was the anxiety read's composed scenario (preview says
  safe → write destroys → error reads as version skew → recovery shows only
  survivors); the rehearsal now carries the same guard as the performance.
- **The mode-mismatch error leads with the data consequence**: a merge send
  answered with a replace echo now says RECORDS MAY HAVE BEEN RETIRED first
  (with the superseded/created counts inline and a pointer at the
  include_superseded export — the only read surface where superseded rows
  are visible), before the version-skew explanation.
- Public `update`/`updateById` regained their docblocks (they had migrated
  to the private envelope helpers): both now state that they DISCARD the
  echo, point at the with-echo variants, and carry the post-write-throw
  @throws contract; the OpsClient one-liners say the same.
- `AnalysisEchoMismatchError` docs rewritten for 1b's dynamic expected mode
  (it is the mode each call sent, not a fixed 'replace'), naming the
  server-BEHIND case as the primary cause.
- The SDK's analysis-bearing predicate comment no longer claims to mirror
  the API's `hasAnalysis` (1b gave that a third, 400-only disjunct): it
  mirrors the ECHO-EMISSION condition, and says so precisely.
- README: hand-maintained "Current version" line and "75 methods" count
  removed (a claim that does not exist cannot drift — the real count had
  reached 81); dedicated `updateWithEcho` section with the
  supersededRecords>createdRecords duplicate-collapse note; preview and
  updateById descriptions rewritten mode-aware.

## [5.18.0] - 2026-08-20

Adopts the ops-uluops-api update-run replacement-semantics change (spec v0.5.0, API 1a,
prod since 2026-08-20): analysis writes through `update`/`updateById` are **per-agent
scoped replace** — an update speaks only for the agents named in it. This was a
**semantics change with no signature change** on the wire: the same payload now
supersedes less. This entry and the type docblocks are the channel for it.

### Added

- **`runs.previewUpdate(input)` / `runs.previewUpdateById(runId, input)`** — read-only
  preview of an analysis-bearing update (`POST /runs/update-preview`,
  `POST /runs/:id/update-preview`). Returns `{ preview, recordMode, byAgent }` where each
  agent's plan carries `wouldSupersede*`, `wouldCreate*`, and `wouldRetireRecordIds` —
  the rows a replace write would retire by omission. Analysis concerns only; the API
  rejects any other update field with a named 400 (spec §4 scope rule).
- **`AnalysisEchoMismatchError`** — the §3.9 skew alarm. Analysis-bearing updates now
  read the response envelope raw (sdk-core ≥0.16.0 `rawEnvelope`; the default unwrap
  discards `analysisWrite` because it is a sibling of `data`) and assert the server's
  echoed `recordMode` equals the mode this SDK implements (`replace`). No echo (server
  predates 1a) or a different mode (server moved past it) throws the named error
  **after the write has landed** — silent client/server semantics skew becomes loud.
  Updates without analysis concerns are unaffected.
- Public types `AnalysisWriteEcho`, `AgentWritePlan`, `RunUpdatePreview`,
  `UpdateRunPreviewInput`, `UpdateRunPreviewByNumberInput`.

### Changed

- `UpdateRunInput.analysisRecords` / `.analysisSummary` docblocks now state the
  per-agent replace scoping (previously "replaces existing" with no scope — ambiguous
  between run-wide and per-agent, and run-wide was true before API 1a).
- `@uluops/sdk-core` pin `0.15.0` → `0.16.0` (exact), for `rawEnvelope`.
- **"Analysis-bearing" now mirrors the API's predicate — entries required, not mere
  key presence.** The echo assertion fires only when `analysisRecords` /
  `analysisSummary` carry at least one entry, matching the server's `hasAnalysis`
  (`length > 0`). Without this, `analysisRecords: []` (a filter that matched nothing)
  would have thrown a false "server predates 1a" against a healthy production server,
  after the metadata half of the PATCH had already landed. Found by review before
  release; never shipped.
- **`workflowType` is no longer sent by `update`/`updateById` and is `@deprecated` on
  `UpdateRunInput`.** Both API update schemas deliberately omit it (ADR-005 —
  structural identity is immutable), so it was a silent strip-and-200 — the identical
  defect class to the `archiveReason` key fixed below, sitting two lines above it.
  No observable behavior changes (the server ignored it either way); the type now
  says so instead of implying updatability.
- `previewUpdate`/`previewUpdateById` **reject non-analysis update fields client-side**
  with a named `InputValidationError` listing the offending keys (mirroring the API's
  scope-rule 400, which is unreachable through the SDK since the request body is built
  from the analysis fields alone). Previously a spread-in update input was silently
  narrowed to its analysis fields — a preview that modeled only part of the write.
- `AnalysisEchoMismatchError` carries structured fields — `reason`
  (`'missing-echo' | 'mode-mismatch'`), `expectedRecordMode`, `actualRecordMode`,
  `run` (the updated run: the write that already landed), `analysisWrite` — so
  callers branch on data, not message strings, and can honor "do not retry" without
  a re-read.
- Malformed 2xx bodies on the update path (204/empty, non-envelope JSON) throw a
  named `OpsApiError` naming the endpoint, restoring the diagnostic the default
  unwrap path had (`rawEnvelope` skips sdk-core's envelope check).
- `scripts/verify-update-run-tarball.mjs` (`npm run check:tarball`) commits the
  packed-tarball behavioural check as a standing instrument, with
  `check:tarball:control` running it against published 5.17.0 and requiring exactly
  the three new-behavior checks to fail — a control run where nothing fails means
  the instrument is inert.

### Fixed

- **`archiveReason` never reached the API** (tracker `d21e0a57`): the update payload sent
  the key `archiveReason`, but the API's update schema reads `archivedReason`, so the
  value was silently stripped — archiving via SDK set `archivedAt` but never the reason.
  The wire key is now `archivedReason`; the input field name is unchanged
  (`archiveReason`, matching the Run response field), so no caller code changes.
  Note: the by-project `update` path additionally drops ALL archive fields server-side
  (open API issue `15e58cab`); `updateById` applies them today.

## [5.17.0] - 2026-08-17

### Fixed — `auth.register()` threw a raw `ZodError` on every call (BREAKING TYPE CHANGE)

`RegisterResponseSchema` declared a flat shape — required `id`, `email`, `isActive`, `role`,
`subscriptionTier`, `createdAt`, `updatedAt` at the top level, with `user` optional. The API
has never returned that. `POST /auth/register` performs an auto-login and returns
`{user, sessionToken, expiresAt}` — byte-identical to `POST /auth/login`.

So every real call threw an unwrapped `ZodError` with seven issues, on a successful HTTP 201,
**after the account had already been created server-side**. The error was not caught by
`instanceof OpsApiError`, `isOpsApiError()`, or any pattern this README's Error Handling
section teaches, so it also broke the documented error hierarchy. This was the first
documented onboarding step for a new user with no key yet.

`LoginResponseSchema` — twelve lines above it in the same file — was already correct.

**Why no test caught it:** the tests asserted against hand-written mock factories derived
from this schema rather than from a real response. The mock and the schema agreed with each
other, and neither agreed with the server. `createMockRegisterResponse` self-validates against
`RegisterResponseSchema` under `STRICT_CONTRACTS`, which proves mock/schema agreement and never
mock/server agreement — so the check that existed could not have caught the defect it was
positioned to catch.

Corrected alongside the schema, and `prepublishOnly` is what forced it: the 5.17.0 publish was
blocked by two failures whose error text read *"Invalid mock register response data"*. The
factory now builds the real `{user, sessionToken, expiresAt}` shape, identical to
`createMockLoginResponse`. `test/client.test.ts` had been asserting `result.email` — a
**top-level field the API has never returned** — which passed only because the factory
fabricated it; it now asserts `result.user.email` and `result.sessionToken`.
`test/operations/auth.test.ts` already asserted the nested `result.user.email` correctly and
merely passed a redundant flat override. Any future change here must be checked against a live
`/auth/register` call, not a fixture built from the schema it is meant to validate.

**This changes the exported `RegisterResponse` type** from flat to nested. Strictly that is
a breaking type change, and a case for a major bump exists. It is shipped as a minor on the
grounds that the previous type described a shape the runtime never produced: no consumer
could have been reading `.email` off a successful call, because there were no successful
calls. Code typed against the old shape was already failing at runtime. Callers now read
`result.user.email` and `result.sessionToken`.

Verified live against a dev API: `register()` returns `{user, sessionToken, expiresAt}`,
`user.email` matches the address requested, and `sessionToken` is populated.

### Added

- **`failureMode` on the issue-list query types.** `ListProjectIssuesQuery`,
  `ListIssuesQuery`, and the shared private `IssueListQuery` in `query-utils` all carried
  `failureDomain` and none carried `failureMode`, so the mode half of a
  `DOMAIN-MODE/SEVERITY` code was untypeable as a filter even though the API accepts it.

  **This was a types-only gap, not a functional one.** `buildIssueListParams` is a bare
  `toApiQuery(query)` camelCase→snake_case conversion with no allowlist, so a caller who
  forced the key through with a cast always reached the wire. What the omission actually
  did was tell every typed consumer the filter did not exist — and that is how it stayed
  unwired end-to-end for so long: the MCP's `query_issues` declared `failure_mode` in its
  tool schema and dropped it from its forward-list, and the API declared it in three layers
  and applied it in none.

  ⚠️ **The server-side half is not deployed yet.** The API fix lives on
  `fix/analytics-fanout-and-mode-filter` and is pushed but unmerged at the time of writing.
  Against an API without it, this filter is **silently ignored and returns unfiltered
  results** — the same failure mode it was added to close, one hop later. The README's
  filter table carries this caveat. Do not treat the SDK type as evidence the filter works
  against a given deployment.

  Typed as a bare `string`, deliberately, rather than a union of the 28 canonical modes.
  `issues.failure_mode` carries no membership constraint server-side, so non-canonical rows
  exist — and finding them is the filter's most valuable use, because the taxonomy analytics
  structurally cannot: they build their mode distribution by iterating the catalog, so a
  non-member is absent from the result by construction.

  Additive and optional on all three interfaces. Note `IssueSearchQuery` (backing
  `issues.search()`) deliberately does **not** receive it — the server-side search path has
  no mode predicate — so the filter is available on the three list methods only.

### Changed — documentation corrections found by a live DX pass

- `README.md` version banner said 5.11.0, seven releases stale. Now 5.17.0.
- Node requirement said 18.0.0 in both the badge and the prerequisites while `engines`
  requires `>=20.3.0`. A reader on Node 18 followed the stated prerequisite into an engine
  mismatch npm never warned about. Both corrected to 20.3.
- **The Quick Start's `getBurndown` example rejects for every newly registered user.** Every
  route in the API's analytics router is tier-gated, `free` is the default tier on
  registration, and the README mentioned subscription tiers nowhere. The Quick Start now
  carries the requirement inline.
- The `listIssues` filter table documented 6 of 12 parameters — missing `failureDomain`,
  `failureMode`, `includeResolved`, `minTimesSeen`, `dateStart` and `dateEnd`. Now complete,
  and declared canonical for the three list methods that share the shape, with the
  `issues.search` exception stated.
- Troubleshooting told the reader to run `echo $ULUOPS_API_KEY`, which prints the key value
  rather than testing presence. Replaced with a presence test that does not emit the secret.
- Table of contents omitted the `CLI` and `Input Validation` sections.
- `package.json` description rewritten to lead with a verb.

## [5.16.0] - 2026-08-12

### Changed

- **`conflicts[].kind` on `MergeProjectsResult` is no longer a closed `z.enum`.** It is now
  shape-validated (`/^[a-z][a-z0-9_]*$/`) — the same call this file already made for
  `FailureDomainResponseSchema`, and for the same reason.

  **This was an outage waiting on the next API release, not a style preference.** `kind` is
  server-controlled and additive: the API can add a conflict kind without a breaking change
  on its side. `mergeProjects` parses via `.parse()`, and `z.enum` **throws** on an unknown
  member — so every kind the API added would have taken down every consumer that had not
  upgraded first. The failure mode is unusually bad for this endpoint: the merge **succeeds
  server-side**, then the SDK throws on the response, so the caller sees an error for work
  that actually completed and may retry a non-idempotent operation.

  Verified against this schema before and after: a payload carrying `fingerprint_dedup`
  parsed clean while the same payload with `fingerprint_blocked_by_deleted` failed on
  `conflicts.0.kind`. After the change all known kinds and an invented
  `some_future_kind_not_yet_invented` parse, while `Not A Valid Kind!`, `UPPER_CASE` and
  `''` are still rejected — permissive is not the same as absent, and both directions are
  pinned by tests that were each confirmed to fail on the opposite mistake.

  **Rejected alternative:** `z.enum(...).catch('unknown')`, which also avoids the throw but
  silently replaces the server's answer with a sentinel — the value would be gone with no
  error, which is the failure shape this SDK has been bitten by before.

  **Type-level note, called out because it is the one thing a consumer can notice:**
  `MergeProjectsResult['conflicts'][number]['kind']` widens from a literal union to
  `string`. Code that *reads* or compares it is unaffected; code that assigns it to a
  narrower literal-union variable will no longer typecheck. Released as a minor because no
  consumer in the workspace narrows on this field — searched `ops-uluops-mcp`,
  `packages/-uluops-ops-mcp`, `ops-uluops-dashboard` and `ops-uluops-registry` on
  2026-08-12, zero references to any conflict kind or to `MergeProjectsResult`.

### Added

- **`MERGE_PROJECT_CONFLICT_KINDS`** and the **`MergeProjectConflictKind`** open-union type
  (`(typeof KINDS)[number] | (string & {})`), so the known set stays documented and
  autocompletable now that the schema no longer enumerates it. Includes
  `fingerprint_blocked_by_deleted` (registry-api tracker `642595bb`): the target project
  holds a soft-deleted issue owning that fingerprint, so the source issue cannot be moved
  onto it and is left in the source project. Since a successful merge soft-deletes the
  source project, that issue becomes hidden with it — the conflict is a prompt to restore
  the target's deleted issue and re-run, not a notice.
- **`MergeConflictKindResponseSchema`**, exported so the shape rule has one definition.

## [5.15.0] - 2026-08-11

### Added

- **`shadowModes` on `AgentMatrixResultResponseSchema`, plus the `ShadowMode` type.**
  `ops-uluops-api` `7ada3b0` scoped `analysis.singlePoints` / `analysis.highOverlap` to the
  canonical failure taxonomy and began returning the excluded non-canonical codes under a
  `shadowModes` key. This SDK did not declare it.

  **The field was therefore unreachable through the SDK, silently.** `getAgentMatrix` returns
  `AgentMatrixResultResponseSchema.parse(...)`, and a plain `z.object()` strips undeclared
  keys rather than rejecting them — so the parse succeeded, returned `['matrix','analysis']`,
  and dropped the field with no error and no type complaint. Both MCP packages call
  `opsClient.analytics.getAgentMatrix`, so `get_agent_matrix` — the tool whose output
  surfaced the original shadow-mode defect — could not see the fix for it.

  This is the **third** instance of this mechanism, after `clusterKey` and `agentName`, and
  the first on a *read* path: those two were fields a caller could not send, this is a field
  a caller could not receive. `test/types/shadow-modes-survive.test.ts` joins the existing
  family and asserts on parse output rather than on types, since a type-level check passes
  whether or not Zod keeps the value at runtime.

  **`shadowModes` is `.optional()`, deliberately not `.default([])`.** The field exists
  because an exclusion that leaves no trace cannot be told apart from an exclusion of
  nothing; defaulting would rebuild exactly that ambiguity at the SDK boundary, making a
  server too old to compute the residue indistinguishable from one reporting a clean one.
  `undefined` means "this API does not report shadow modes", `[]` means "it does, and found
  none". Consumers must handle `undefined` rather than assuming an array — that cost is the
  point. It also means this release does not throw against currently-deployed older APIs.

## [5.14.0] - 2026-08-11

### Deprecated

- **`status` on `UpdateIssueInput`** (`client.issues.update`) — use
  `client.issues.updateStatus`. Removed in the next major.

  **The server now refuses it with a `400`** (ops-uluops-api `d42f218`, tracker
  `ff0f3d8a`). `PATCH /issues/:id` records no `status_history` row and derives no
  `resolved_at`, so a status change made through it bypassed the audit trail, the
  resolving-status derivation, and the guards that keep `'merged'` reachable only
  through a real merge. This SDK was the one consumer that actually sent the field —
  the MCP tools, the CLI and the dashboard all route status through the status
  endpoint already.

  **Still declared and still sent on the wire, deliberately.** Two reasons, both
  learned here the hard way:

  1. An OLDER tracker still accepts it. Enforcing the new server's policy client-side
     would break callers against an API that works — the same independent-deploy
     reasoning that made `resolutionRunId` optional rather than removed.
  2. Dropping it from the request body would convert an actionable `400` into a
     silent no-op: the call would succeed and the status would not change. That is
     the exact failure this workspace hit three times in three days
     (`mergedIntoIssueId` stripped by this SDK, `priority` stripped by the MCP
     `edit_issue` tool, and a schema test that could not tell either way).

  A test pins the forwarding, so a future "the server rejects it, why send it?"
  cleanup fails loudly rather than reintroducing that silence.

  `resolvedAt` was already correctly excluded from this input as server-managed and
  needs no change.


## [5.13.0] - 2026-08-09

### Added

- **`mergedIntoIssueId` on issue responses** — the issue a merge source was absorbed
  into (`ops-uluops-api` migration 078, tracker `a5639db7`). `null` = never merged.

  **The key has been on the wire since that migration shipped; this SDK was dropping
  it.** Responses are parsed with `z.object()`, which strips unknown keys rather than
  erroring — so the value arrived, was discarded, and nothing anywhere reported a
  problem. That is the failure mode of a late-added field: not an error, silence. Anyone
  on an earlier version is not seeing `null`, they are seeing nothing.

  What it buys: an answer to *"where did this issue go?"*. Before this, `status` read
  `merged` and the trail ended — MCP, the CLI and the dashboard all showed a dead end,
  and the only fallbacks were parsing `status_history` prose (`Merged into issue <id>`)
  or querying the database, which in production is reachable only from EC2. During an
  incident that is the difference between one lookup and no answer.

  **Optional, not required**, so this release still parses responses from an API that
  predates migration 078 — the same independent-deploy tolerance `resolutionRunId` has
  in the opposite direction (that field is leaving the wire; this one arrived on it
  first). Read-only: the API refuses to set it through any update path, and it is an
  identity relation, so it stays populated when the target is soft-deleted.


## [5.12.0] - 2026-08-04

### Added

- **`clusterKey` on `RecommendationInput`** — orchestrator-declared convergence,
  **within-run only**. Recommendations sharing a `clusterKey` in one run are the same
  adjudicated defect reported by different agents. Set it from a merge or falsification
  stage instead of collapsing the findings before submission. Optional, max 64 chars,
  opaque to the tracker: never interpreted, never verified, never joined across runs.

  Requires a tracker with migration 076 (`occurrences.convergence_cluster_id`). Against
  an older tracker the field is accepted and discarded, which is the pre-existing
  behaviour for any unknown field and is not made worse by declaring it here.

  **Why this is a minor and not a patch.** The field is additive and no existing call
  breaks, but it is a capability rather than a fix, and consumers span five majors
  (`^1.1.0` through `5.11.x` across 13 packages in this workspace). A patch bump would
  read as "nothing to adopt" to every one of them.

  **Why declaring it is load-bearing rather than cosmetic.** `RecommendationInputSchema`
  is a plain `z.object()`, so Zod *strips* unknown keys rather than erroring. While
  `clusterKey` was undeclared, an orchestrator that set it saw no type error (the object
  was a superset of a valid input), no validation error (strip is silent), no runtime
  error (the request succeeded) — and a tracker row with `convergence_cluster_id = NULL`.
  The tracker documents NULL as *"no adjudicating stage"* and a per-run count of `0` as
  *"a stage was declared and silently stopped working"*, so a transport-layer strip
  produced the tracker's **collapsing-pipeline signature** for a merge stage that was
  working correctly — and the instrument would have blamed the pipeline rather than this
  schema. Do not remove the field as unused before a producer ships.

  Tests assert the **parse output**, not the type: a type-level check passes whether or
  not Zod keeps the value at runtime, and runtime retention is the entire claim. They
  also assert that `max(64)` rejects rather than truncates — a truncated key is a
  different cluster id that still looks valid, silently splitting one adjudicated defect
  into two.

## [5.11.1] - 2026-08-02

### Fixed

- **Failure-code examples in TSDoc, error messages and README now use canonical codes.**
  `SEM-VAL` was the worked example in five source sites and two README examples, and it is
  not a valid code — `VAL` is an `EPI` mode, so `EPI-VAL` exists and `SEM-VAL` does not.
  Codes are drawn from a closed set rather than composed from a domain and a mode
  independently — 24 at the time of this fix, 28 since failure-taxonomy v1.1.0 added
  `STR-ORG`, `SEM-CAT`, `PRA-ACT` and `EPI-SCP`. The count is stated as a range because
  this entry is a record of a fix, not a live mode list; the authority is the
  `failure_taxonomy` catalog served by `GET /taxonomy`.

  These are TSDoc, so they surface in consumer IDE tooltips and the generated API docs —
  the invalid example reached every downstream developer at the point of use. Affected:
  `types/schemas.ts` (the "invalid failure code format" message), `types/enums.ts` ×2,
  `config/validators.ts`, `operations/runs.ts` (`@example`), and README.

  Two further non-canonical codes were found in README examples while verifying and are also
  corrected: `PRA-SEC/C` (`SEC` is not a mode) on a SQL-injection example, now `SEM-INC/C`
  to match `security-analyst`'s own convention, and a `STR-OMI/M` on a missing-error-handling
  example, now `PRA-FRA/M`. The `runs.ts` `@example` pairing "Missing null check" now reads
  `SEM-COM/M`, matching the worked example in the agent render template.

  No behaviour change — the validation regex is unchanged and still checks format, not
  membership. This corrects what the SDK *teaches*, not what it accepts.


## [5.11.0] - 2026-08-02

### Changed

- **`IssueResponseSchema.resolutionRunId` is now optional** — `z.string().uuid().nullable()`
  becomes `z.string().uuid().nullable().optional()`. Deprecated; it will be removed in the
  next major.

  `ops-uluops-api` drops `issues.resolution_run_id` in migration 075 (its tracker
  `83eeac77`). The column encoded resolution-by-run, a model the tracker never
  implemented — runs *detect*, humans and agents *resolve*, and no run is in scope at a
  resolving transition. It was `NULL` on all 18,192 production rows, so every response
  this SDK has ever parsed carried `null` there.

  **Upgrade before that API deploys — this release is the ordering constraint, not a
  convenience.** These schemas are runtime-parsed: every response goes through
  `.parse()`. A *required* key that the API stops sending therefore throws a ZodError on
  **every issue read**, rather than surfacing as `null`. Any consumer still on ≤5.10.0
  when the API drops the field breaks on all of `getIssue`, `listIssues`, `searchIssues`
  and every operation embedding an issue.

  Nothing else changes: `null` and uuid values are still accepted, so this release parses
  both the old and new API shapes and can ship ahead of either. A malformed value is still
  rejected — the relaxation is to presence, not to the type.

  **Consumers to upgrade:** `ops-uluops-mcp` (`^5.9.0`), `packages/-uluops-cli` (`5.10.0`),
  `ops-uluops-dashboard` (`^5.0.0`), `packages/-uluops-rah-service` (`5.10.0`).

## [5.10.0] - 2026-07-19

### Changed

- **`allGatesPassed` is now nullable on run response schemas** —
  `RunResponseSchema` and `RunSummaryResponseSchema` widen the field from
  `z.boolean()` to `z.boolean().nullable()` (`SaveRunResponseSchema` inherits
  via its embedded `RunResponseSchema`). `null` means **NOT_A_GATE**: the run
  carried no gate-bearing agents (e.g. a cognitive-lens-only run), which is
  distinct from `false` (a gate ran and failed). Consumers should render `null`
  neutrally ("N/A"/"—") and exclude null runs from both terms of any pass-rate
  computation. The *input* schemas are unchanged — `summary.allGatesPassed`
  remains `boolean | undefined`; `null` is never a valid input value.

  This is the read-shape half of ops-uluops-api's
  `save-run-decision-semantics` spec v0.2.1 (Phase A of its deploy cascade):
  previously the API fabricated `allGatesPassed: true` for lens-only runs whose
  every decision fell in a permissive pass-set (including negative poles like
  `VULNERABLE`), and pre-5.10.0 SDK versions throw `ZodError` if the API emits
  `null`. The API will begin emitting `null` only after its response consumers
  resolve 5.10.0+; upgrading is forward-compatibility, not a behavior change —
  today's API still emits booleans, which parse identically.

### Added

- **`client.projects.mergeProjects(input)`** — merge one project into another
  (merge-projects spec v0.3.4). The source's runs and issues are re-keyed into
  the target inside one advisory-locked transaction server-side; the source is
  soft-deleted by default. Pairwise only. Input:
  `{ source, target, dryRun?, deleteSource?, confirmCrossOrg? }` with
  client-side rejection of `source === target`. The result follows the spec §5
  shape (snake_case fields by pinned contract: `source`, `target`, `moved`,
  `conflicts`, `audit`). Discriminate errors on `err.code`: `SAME_PROJECT`,
  `TARGET_DELETED`, `MERGE_TOO_LARGE`, `CROSS_ORG_MERGE`,
  `CROSS_ORG_MERGE_REQUIRES_CONFIRMATION`, `ALREADY_MERGED`
  (`details.audit_id`), `MERGE_LOCK_UNAVAILABLE`
  (`details.retry_after_seconds` — the SDK does not auto-retry), `MERGE_FAILED`.
- **Merge provenance fields on response schemas** — `mergedFromProjectId`,
  `mergedFromRunNumber`, `mergedFromIdempotencyKey` on `RunResponseSchema` /
  `RunSummaryResponseSchema` and `mergedFromProjectId` on
  `IssueResponseSchema` (all optional-nullable; `null` = never merged). Zod's
  default parse strips unknown keys, so without these declarations the
  ops-api mig-069 columns would be invisible to every SDK consumer. Note:
  `save_run` against a merged-away project now returns
  `410 PROJECT_MERGED` with the successor in `details.target_project_name`.

## [5.7.0] - 2026-07-08

### Changed

- **`SaveRunResponseSchema.correlation` is now nullable.** On an idempotent
  `saveRun` replay of a run saved before the API began persisting correlation
  counts, the API returns `correlation: null` — the original counts were never
  stored and are not fabricated. Response parsing previously threw a `ZodError`
  on that shape. Fresh saves and post-migration replays remain non-null.
  Consumers reading the correlation should handle `null`
  (e.g. `result.correlation?.newIssues`). Pairs with the ops-uluops-api change
  that persists correlation counts on the run (migration 065).

## [5.6.0] - 2026-07-06

### Changed

- **Bumped `@uluops/sdk-core` pin `0.14.0` → `0.15.0`.** sdk-core 0.15.0 adds the
  streaming transport (`requestStream`/`getStream`). Because `OpsHttpClient extends
  HttpClient`, these methods are now **inherited on `OpsHttpClient`** and available
  to advanced consumers holding the low-level client — a resilient way to obtain an
  unconsumed `Response` for BFF/stream passthrough (full auth, redirect rejection,
  error mapping, and security-event emission run through the headers; no retry after
  handoff). See the sdk-core README for the streaming contract.
- **`engines.node` raised `>=18.0.0` → `>=20.3.0`** to match sdk-core's real runtime
  floor: the inherited `getStream` composes the caller's `AbortSignal` via
  `AbortSignal.any` (Node 20.3.0+). Buffered operations are unaffected, but the
  declared floor now matches the full public surface.

## [5.5.1] - 2026-07-06

### Fixed

- **`agentId` was stripped from read responses.** 5.5.0 added `agentId` to the
  input types but not to `AgentSnapshotResponseSchema`, so Zod response
  parsing silently dropped the field on `getDetails`/run reads even when the
  API returned it. Now on the response schema (optional/nullable — absent
  from pre-1.66 API responses).

## [5.5.0] - 2026-07-06

### Added

- **`agentId` provenance field on `AgentInput` and `UpdateAgentInput`** (and
  `AgentInputSchema`). Carries the harness transcript/agent id (e.g.
  agent-metrics `a4f35bf2cacc5f3ac`) so a saved tracker agent row is joinable
  back to its agent-metrics buffer entry and session transcript. Optional,
  max 50 chars; the API persists it to `agent_snapshots.agent_id`
  (ops-api migration 064). The wire already passed unknown fields through
  (`save()` posts raw input) — this makes the typed surface truthful.

## [5.4.0] - 2026-07-02

Adopts `@uluops/sdk-core@0.14.0` (security-observability release) and surfaces its
new public API so ops-sdk consumers get the hardening and can use the new types.

### Added

- **Structured security-event channel.** `onSecurityEvent` is now a typed option
  on `HttpClientConfig`/`OpsClientConfig` and is forwarded to the underlying
  sdk-core client. Re-exports the `SecurityEvent` union and its member types
  (`SecurityEventHandler`, `SecurityEventType`, `AuthType`, `AuthFailureEvent`,
  `RedirectRejectedEvent`, `TokenRefreshFailedEvent`, `AuthStrategyReplacedEvent`)
  so consumers can type their handler.
- **`RedirectError` + `isRedirectError`** re-exported. An upstream 3xx now throws
  this dedicated, non-retryable error instead of a retryable `NetworkError`.

### Changed

- **Bump `@uluops/sdk-core` 0.13.0 → 0.14.0.** Pulls in the redirect hardening
  (`redirect: 'manual'`, credential body never replayed to a redirect target),
  `baseUrl` embedded-credential rejection (CWE-200), and the structured logger /
  sanitized `requestId` fixes. **Migration:** code that caught a redirect as
  `NetworkError` should now catch `RedirectError` (or `isRedirectError(e)`);
  redirects are no longer auto-retried.

## [5.3.0] - 2026-07-02

### Added

- **`STATUS_REASON_MAX_LENGTH` (= 1000)** exported from `types/schemas.ts` — the
  single client-side source of truth for the status-change `reason` cap, consumed
  by the MCP tool schemas (same pattern as `ANALYSIS_RECORD_ID_MAX_LENGTH`).

### Changed

- **Status-change `reason` cap widened from 500 to 1000 characters** in
  `UpdateIssueStatusInputSchema` and `BulkStatusUpdateItemSchema`, matching
  `status_history.reason` `varchar(1000)` (ops-api migration `062`; requires
  ops-api ≥ 1.63.0 deployed — older servers reject 501–1000 char reasons with a
  400, failing safe). The run-archive `archiveReason` field is a different column
  and deliberately stays at 500.

## [5.2.0] - 2026-06-28

### Added

- **Cross-harness token components** (additive, non-breaking). New optional token fields
  carrying the OpenAI/Google/Codex token shapes that previously died at the SDK wire:
  - `TokenUsage` / `TokenUsageSchema` (nested, `save_run`): `cachedInputTokens`,
    `reasoningOutputTokens`, `thinkingTokens`, `toolTokens`.
  - `UpdateAgentInput` (flat, `update_run`): the same four components.
  - `AgentSnapshotResponseSchema` (flat, read): the four components as `.nullable().optional()`
    (NULL for historical rows / until the API columns ship).
  - `reasoning`/`thinking`/`tool` are subsets of **gross** `outputTokens` — stored for
    cost/analytics, never added to `totalEffectiveTokens`. `cachedInputTokens` is the cached
    portion subtracted in the canonical `(input − cached_input) + output_gross + cache_creation`.
- **`harness` field** on `AgentInput` / `AgentInputSchema`, `UpdateAgentInput`, and
  `AgentSnapshotResponseSchema` — the producing CLI/runtime. Free string at the wire
  (matches the `model` precedent; canonical set `claude-code|codex|opencode|gemini-cli|uluops-core`).

See `cross-harness-token-normalization-spec-v0_5_0.md` §3.1/§3.4. All fields optional —
existing consumers and payloads remain valid.

## [5.1.0] - 2026-06-26

### Changed

- **Analysis `recordId` max length widened from 20 to 100** in `SaveRunInputSchema`
  (and therefore `UpdateRunInputSchema`, which reuses it). `recordId` is an agent-local
  identifier (e.g. `foundations-api-aristotle-20260626`), not a key or correlation
  spine, so this is a non-breaking client-side relaxation — previously-valid inputs
  remain valid. New `ANALYSIS_RECORD_ID_MAX_LENGTH` constant (exported) is the single
  source of truth; mirrors the API column (migration 058) and the API/MCP request
  schemas. Requires ops-api ≥ 1.61.0 deployed so the server accepts the longer IDs.

## [5.0.0] - 2026-06-23

### Breaking

- **`maxScore` is now `number | null` on response types** — `AgentSnapshotResponseSchema.maxScore` accepts `null`. Completes the score-nullability transition begun in 2.0.0 (which made `score` nullable but left `maxScore` required). A scoreless agent (generator, executor, crashed) now carries `score: null, maxScore: null` — the invariant `score === null ⟺ maxScore === null` holds. This affects any code that performs arithmetic on `maxScore` (e.g. `score / maxScore`) without a null check.

### Changed

- **`AgentInput.maxScore` is now optional and nullable** — agents that do not produce a score can omit `maxScore` or pass `null`. Existing callers that always provide a numeric maxScore are unaffected.
- **`AgentInputSchema`** — Zod schema updated to `.optional().nullable()` on the `maxScore` field, mirroring the `score` field.

### Migration Guide

- If you always provide a maxScore: **no change needed**
- If you compute `score / maxScore`: guard on null first (in practice `maxScore` is null only when `score` is null, which you already handle since 2.0.0)
- Generator/executor agents: omit `maxScore` alongside `score`

## [4.0.1] - 2026-06-17

### Fixed

- **`updateProfile` accepts canonical username slugs.** The client-side validator
  used the old letter-start, underscore-only pattern (`^[a-z][a-z0-9_]{2,29}$`),
  which rejected valid URL slugs like `ulu-labs` before the request reached the
  API. Unified to the canonical slug pattern
  `^[a-z0-9](?:[a-z0-9_-]{0,38}[a-z0-9])?$` (hyphens and digit-start allowed),
  matching the ops-api username fold-in where setting a username confirms it.

## [4.0.0] - 2026-06-17

Analytics type system realigned to derive from the Zod response schemas, plus the
documentation and internal-hygiene fixes from a `consumer-validate` pipeline run
(run #5: docs 91 / public-interface 87 / dx 96, all gates passed). No runtime
behavior or endpoint changes — the breaking surface is limited to four removed
analytics **type** exports (see below).

### ⚠ BREAKING CHANGES

- **Removed four analytics type exports** that had no SDK producer method and
  existed only to annotate `getByMetric()` results by hand: `CrossProjectPattern`,
  `RegressionEntry`, `CostEntry`, `CategoryPerformanceEntry` (and their
  `*ResponseSchema` counterparts). The underlying metrics — `cross_project_patterns`,
  `regression_analysis`, `cost_analysis` — remain available unchanged through the
  untyped `getByMetric()` path. **Migration:** if you imported these types, inline
  an equivalent local interface or inspect the `getByMetric()` return directly. No
  method signatures or runtime behavior changed.

### Changed

- **Analytics types are now schema-derived.** Hand-written `interface` declarations
  (`Period`, `AgentLifecycleEntry`, `AgentReliability`, `BurndownResult`,
  `VelocityResult`, `DiscoveryResult`, `AgentMatrixResult`, `TrendSummary`,
  `BlindSpot`, `MatrixAnalysis`, `SinglePointFailure`, `HighOverlap`, and related
  row/point shapes) are now `z.infer` aliases of their Zod response schemas, so the
  compile-time types and runtime validation can no longer drift apart. The exported
  type names are unchanged; shapes now track the schemas exactly. New backing
  schemas (`BlindSpotResponseSchema`, `SinglePointFailureResponseSchema`,
  `HighOverlapResponseSchema`, `MatrixAnalysisResponseSchema`) are internal
  implementation detail — like all `*ResponseSchema`s, they are not exported through
  any public subpath. This release introduces **no new public exports**; the surface
  change is the four removed types below plus the `interface`→`type` conversion.

### Fixed

- **Overstated 3.4.0 changelog claim.** The 3.4.0 entry said every `OpsClient`
  delegate carries an `@see` link to its underlying operation; delegates actually
  carry a summary line only. Corrected the wording to match what shipped.
- **Stale `runs.validate()` JSDoc example.** The `@example` referenced a
  non-existent `preview.correlation` field and omitted the required
  `recommendations` input. Corrected to use the actual `ValidateRunResponse`
  fields (`wouldCreate` / `wouldUpdate` / `wouldRegress`).
- **`getByMetric()` `@throws` type.** Documented `@throws {Error}` but the
  implementation throws `InputValidationError`; the tag now names the precise
  class so consumers can branch on `instanceof`.
- **README `auth.login()` example.** Destructured the legacy optional `token`
  field instead of the required `sessionToken`; following the example as written
  yielded `undefined`.
- **README `raw_markdown` size limit.** Documented as 100,000 characters but the
  schema enforces 500,000; the prose now matches the enforced ceiling.
- **README `types/enums` coverage.** The exports table and a new "Failure Code
  Utilities" example now document the shipped runtime helpers `parseFailureCode`,
  `buildFailureCode`, and `severityFromCode`, previously discoverable only by
  source-diving.

### Removed

- **(Breaking — see above)** `CrossProjectPattern`, `RegressionEntry`, `CostEntry`,
  `CategoryPerformanceEntry` and their `*ResponseSchema` exports.
- **Internal-only dead utilities** (not part of any export path, no production
  callers): `toCamelCase` and the `sleep`/`retry`/`truncate`/`isPlainObject`/`isUuid`
  re-exports from `src/utils/helpers.ts`, plus their tests. The API returns
  camelCase directly, so no client-side casing conversion was needed; shared
  utilities remain available from `@uluops/sdk-core` for internal use. No consumer
  impact — none were reachable through the package `exports` map.

## [3.4.0] - 2026-06-16

Consumer-experience polish from a `consumer-validate` pipeline run (docs 93 /
public-interface 91 / dx 88, all gates passed). No runtime behavior changes to
existing successful calls; one error type is now more specific (see Changed).

### Security

- **Defensive string-length ceilings on issue-domain response fields (CWE-20).**
  Completes the bounding started in 3.2.1, which covered only the history-event
  schemas: `IssueResponseSchema` (fingerprint, title, failureMode, category,
  agent, filePath), `OccurrenceResponseSchema` (agentName, description, filePath),
  `IssueNoteResponseSchema` (content, createdBy), and `StatusHistoryResponseSchema`
  (reason) now carry `.max()` bounds set at-or-above the tracker DB column sizes
  (verified against prod 2026-06-16, with margin against future widenings). An
  unbounded `z.string()` let a degenerate or malicious server force a large heap
  allocation on the calling host before any consumer-side gate could run (the CLI
  consumes these schemas in issue-picker mode and `formatIssue`); oversized
  payloads now throw `ZodError` at parse time instead. Compliant servers are
  unaffected. The reusable `MAX_*` ceiling constants are consolidated above the
  schemas, and `createMockIssue` now eagerly validates against the schema so a
  malformed/oversized test fixture fails at construction. Two tests assert the
  bound fires on an oversized title (600 chars) and fingerprint (200 chars).

### Fixed

- **`bulkUpdateStatus` README example corrected.** The example iterated the result
  in a `for…of` loop and read `result.success` / `result.issueId` / `result.error` —
  but the method returns an aggregate object `{ updated: number, failed: string[] }`,
  so the documented code threw `TypeError: results is not iterable` at runtime. The
  API and TypeScript types were always correct; only the example was wrong.
- **`NotFoundError.details` README comment corrected** to the real shape
  (`{ resource: "Project '…' not found" }`, not `{ id: '…' }`).
- **`client.issues.search()` `query` parameter documented as optional** (it is
  `query?: string`; filter-only searches are valid) — the parameter table previously
  marked it required.
- **Stale README version header** (was `3.2.1`) updated.
- **Analytics response types no longer drift from their Zod schemas.** Every
  analytics type in `src/types/analytics.ts` is now derived via `z.infer` from its
  schema in `response-schemas.ts`, collapsing a second hand-written copy that had
  already diverged in two places: `ResolutionRate` exposed `avgTimeToResolveDays`
  where the wire field is `averageTimeToResolve`, and `TaxonomyDistribution`
  declared a phantom `mode` field (and typed `domain` as the `FailureDomain` enum)
  that the endpoint never returns. Both now match runtime exactly. No consumer
  imported these interface types directly — they consume the method return types —
  so the only break is for anyone who hand-typed against fields that were already
  `undefined` at runtime. The agent-matrix sub-shapes (`BlindSpot`,
  `SinglePointFailure`, `HighOverlap`, `MatrixAnalysis`) gained standalone schemas
  so they derive from a single source too. `AgentInfo` remains a hand-written
  interface by design — it is a client-side projection from `getAgentPerformance`
  with no API endpoint, hence no schema.

### Removed

- **Four unreachable analytics types and their schemas** — `CrossProjectPattern`,
  `RegressionEntry`, `CostEntry`, `CategoryPerformanceEntry`. No typed client method
  returned them (reachable only via the generic `getByMetric()`, which returns
  `unknown`) and they had zero references across the SDK and all consumers. The
  corresponding metric strings (`cross_project_patterns`, `regression_analysis`,
  `cost_analysis`) still work via `getByMetric()`.

### Changed

- **`OpsHttpClient` now throws `InputValidationError` (not a base `Error`) for an
  invalid `orgSlug`.** Aligns with every other constructor-time validation so callers
  branching on `instanceof InputValidationError` catch it. `InputValidationError`
  extends `Error`, so existing `instanceof Error` / catch-all handlers are unaffected.

### Docs

- **`client.issues.softDelete(issueId)` is now documented** in the README Issue
  Operations section (previously the only public method with no README entry).
- **Error type guards documented.** Added a "Type Guards" section covering all twelve
  guards (`isNotFoundError`, `isRateLimitError`, …) exported from `@uluops/ops-sdk/errors`.
- **Every `OpsClient` namespace delegate now carries a summary JSDoc line**, so IDE hover over
  `client.runs.save`, `client.issues.search`, etc. surfaces a one-line description
  instead of a bare signature. Full `@param`/`@returns`/`@throws` details live on the
  underlying operation functions (visible in the generated TypeDoc).
- **`loadCredentials` / `loadConfig` gained full `@param`/`@returns` JSDoc** documenting
  the `options > env > file` priority chain, plus a JSDoc block on the `OpsHttpClient`
  constructor, `buildIssueListParams`, and the config import example at the package root
  (now showing `loadConfig`, `loadEnvFiles`, `ENV_VARS`, `API_KEY_PREFIX`).
- **TypeDoc API-reference generation added** (`npm run docs:api` → `docs/api`,
  `@internal` excluded). `typedoc` added as a dev dependency.

### Internal

- **Leaked internal helpers tagged `@internal`** (no longer surfaced in generated docs;
  still exported to avoid a breaking change): `createErrorFromStatus`
  (`@uluops/ops-sdk/errors`); `getGlobalConfigDir`, `getCredentialsPath`,
  `loadStoredCredentials`, `isApiKey`, `validateCredentials`, `validateUuid`,
  `validateRequiredString`, `validatePositiveInt` (`@uluops/ops-sdk/config`). These are
  plumbing re-exported for advanced/tooling consumers and are not covered by semver.

## [3.3.0] - 2026-06-16

### Changed

- **Bumped `@uluops/sdk-core` to `0.13.0`** (exact pin), which carries three fixes that affect this SDK at runtime:
  - `retries: 0` now makes one attempt and surfaces the real typed error (e.g. `NetworkError`) instead of a contextless `Error('Request failed')`.
  - A 401 with credentials present now yields an actionable `UnauthorizedError` (server reason preserved, plus guidance that the credential may be expired/revoked/invalid), distinct from the no-credentials case; the broken private-monorepo link was removed from the no-credentials message.
  - `isApiKey()` now enforces the minimum key length, so it agrees with the `ApiKeyAuth` constructor.

## [3.2.2] - 2026-06-08

Companion to API v1.58.1 (dry-run completeness + Zod error envelope).
No breaking changes; all additions optional and additive.

### Added

- **`validate()` forwards `analysisRecords` and `analysisSummary` to the API.** Prior versions only sent `project`, `workflowType`, `agents`, `recommendations` — even when callers supplied analysis fields on `SaveRunInput`, those fields were silently stripped on the wire. Now passed through so the dry-run reflects the full set of side effects `save()` would produce.
- **`ValidateRunResponseSchema` accepts new optional fields** matching API v1.58.1+:
  - `wouldCreateAnalysisRecords` — count of analysis records the save would persist.
  - `wouldCreateAnalysisSummaries` — count of analysis summaries (single object → 1, array → length).
  - `preview.analysisRecords` — short echo `Array<{recordId, recordType, title}>` of records that would be created.
  - `preview.analysisSummaries` — short echo `Array<{agentName?, decision}>` of summaries.
- All four response fields are `.optional()` so callers against older API versions continue to parse cleanly.

### Why

Discovered during a Codex foundations skill run on 2026-06-08: `validate()` returned green for payloads that `save()` then rejected on analysis-record shape, because the SDK stripped analysis fields from the dry-run request and the API's preview never validated them. Two repos shipped together — API v1.58.1 makes the preview faithful; this SDK release makes the SDK request and response shapes match. Tracker: `ops-uluops-api` `c29dd21e` (PRA-DRI/H).

## [3.2.1] - 2026-06-08

Post-implementation hardening on the 3.2.0 envelope work. No breaking
changes; all improvements are defensive, type-precision, or doc-fix.

### Security

- **Defensive string-length ceilings on history-event fields** (CWE-20). `agentName` (255), `description` (10k), `reason` (2k), `content` (10k), `createdBy` (200) on `HistoryOccurrenceEventSchema`, `HistoryStatusEventSchema`, and `HistoryNoteEventSchema` now have `.max()` bounds aligned with the server-side DB column sizes. A degenerate or malicious server returning oversized payloads (worst case at the 1000-event ceiling ≈ 1 GB allocation on the calling host) now throws ZodError at parse time instead of silently consuming memory. Compliant servers are unaffected.

### Internal

- Constituent event types in `src/types/issues.ts` derived via `z.infer<typeof HistoryXxxEventSchema>` instead of `Extract<HistoryEvent, { type: '...' }>`. Keeps the codebase's single-source-of-truth convention (every other type in the file uses `z.infer<>`) and removes a silent-`never` risk if the union discriminator string ever changes.

### Docs

- README `getHistory` example rewritten to the post-3.2.0 envelope shape (was still showing the legacy `StatusHistory[]` iteration); BREAKING callout above the example; version string corrected to 3.2.0+; `IssueHistoryEnvelope` / `HistoryEvent` / `HistoryOccurrenceEvent` / `HistoryStatusEvent` / `HistoryNoteEvent` / `TransitionType` added to the TypeScript Support import example.
- 3.2.0 CHANGELOG entry corrected: schemas in `response-schemas.ts` are internal (not exported through the public barrel); type exports in `issues.ts` are the consumer-facing surface.

### Tests

- 1 new test asserting the `.max()` bound fires on a 20kB note content. Suite 475 → 476.

## [3.2.0] - 2026-06-08

### Changed

- **BREAKING: `issues.getHistory()` now returns `IssueHistoryEnvelope`** (live-tests T2 §3.1, F10). The endpoint behind it changed in `ops-uluops-api` from returning a bare `StatusHistory[]` (status transitions only, with the prior `undoLastChange` destroying the row it reverted) to a merged envelope:
  ```ts
  {
    issueId: string,
    events: HistoryEvent[],   // occurrence | status | note (discriminated on `type`)
    totalEvents: number,
    truncated: boolean        // true when totalEvents > 1000; oldest events dropped
  }
  ```
  The SDK now parses with `IssueHistoryEnvelopeSchema` and returns the typed envelope. Consumers doing `result[0]` or `Array.isArray(result)` must update to `result.events[0]`. In practice most pre-fix consumers were getting `[]` from the lossy bare-array shape, so real-world breakage is small.

### Added

- New internal schemas in `src/types/response-schemas.ts` (not part of the package's public entry — `response-schemas.ts` is intentionally withheld from the barrel per `src/types/index.ts:19`):
  - `TransitionTypeResponseSchema` — `z.enum(['change', 'undo'])`.
  - `HistoryOccurrenceEventSchema`, `HistoryStatusEventSchema`, `HistoryNoteEventSchema` — three legs of the discriminated union.
  - `HistoryEventSchema` — `z.discriminatedUnion('type', [...])` with compile-time narrowing.
  - `IssueHistoryEnvelopeSchema` — the envelope returned by `GET /issues/:id/history`.
- **New exported types** in `src/types/issues.ts` (reachable from `@uluops/ops-sdk`): `TransitionType`, `HistoryEvent`, `IssueHistoryEnvelope`, plus three named constituent event types added in post-impl r2 — `HistoryOccurrenceEvent`, `HistoryStatusEvent`, `HistoryNoteEvent` (so consumers writing handlers that accept a specific event branch don't need `Extract<HistoryEvent, { type: '...' }>` inline).
- `StatusHistoryResponseSchema` extended with `transitionType: TransitionTypeResponseSchema.nullable().optional()` and `revertedChangeId: z.string().uuid().nullable().optional()`. Both are nullable AND optional so the schema parses cleanly against pre-migration server responses that don't carry the new columns. `HistoryStatusEventSchema` uses the same `.nullable().optional()` pattern (defensive — see post-impl r1 notes below).

### Security

- **Defensive string-length ceilings on history-event fields** (post-impl r3, CWE-20). `agentName` (255), `description` (10k), `reason` (2k), `content` (10k), `createdBy` (200) on `HistoryOccurrenceEventSchema`, `HistoryStatusEventSchema`, and `HistoryNoteEventSchema` now have `.max()` bounds aligned with the server-side DB column sizes. A degenerate or malicious server returning oversized payloads (worst case at the 1000-event ceiling ≈ 1 GB allocation on the calling host) now throws ZodError at parse time instead of silently consuming memory. Compliant servers are unaffected.

### Internal

- Constituent event types in `src/types/issues.ts` derived via `z.infer<typeof HistoryXxxEventSchema>` instead of `Extract<HistoryEvent, { type: '...' }>` (post-impl r3). Keeps the codebase's single-source-of-truth convention (every other type in the file uses `z.infer<>`) and removes a silent-`never` risk if the union discriminator string ever changes.

### Tests

- 5 new tests for the envelope (suite 469 → 476):
  - Discriminated-union narrowing across all three event types (occurrence/status/note with undo tombstone)
  - Backward-compat parse with `transitionType: null`
  - Backward-compat parse with `transitionType` absent entirely (post-impl r1)
  - `truncated: true` ceiling test
  - Wire-vs-computed truncation distinguishing test (post-impl r2 — server assertion wins over `events.length < totalEvents`)
  - ZodError on legacy bare-array response (post-impl r2 — BREAKING-change defense)
  - ZodError on envelope with unknown event type (post-impl r2 — forward-compat strictness)
  - ZodError on oversized string field (post-impl r3 — CWE-20 size guard)
- Legacy `StatusHistory[]` test assertions replaced.

## [3.0.5] - 2026-06-01

### Security

- **Bump `@uluops/sdk-core` from `0.11.0` to `0.11.1`.** Pulls in today's security hardening: `redirect: 'error'` on all fetch sites (CRLF/credential-replay on auth redirects), control-character stripping in error messages (`stripControlChars` + `SdkApiError` constructor), widened `SENSITIVE_KEYS` (x-api-key, set-cookie, proxy-authorization, x-auth-token), added `column` to `REDACTED_DETAIL_KEYS`, and `sanitizeString` coverage for URL userinfo + bare JWT shapes.

### Supply chain

- **Pin all dependencies and devDependencies to exact versions.** Per the new UluOps-wide exact-pinning policy adopted 2026-06-01 in response to the RedHat-class supply-chain attack pattern. `dependencies`: `zod` and `@uluops/sdk-core` pinned exact. `devDependencies`: typescript, eslint stack, nock, vitest, @types/node, typescript-eslint pinned exact. Lockfile re-aligned.

## [3.0.4] - 2026-06-01

### Added

- **`client.issues.softDelete(issueId)`** — soft-deletes an active issue via
  `DELETE /issues/:id/soft`. Returns `{ deleted: true }` on success.
  Companion to `client.issues.restore(issueId)`, which had no inverse exposed
  through the SDK or MCP. Mirrors the project soft-delete shape — no body
  required, 204 No Content on success.

  Closes the restore-without-delete gap surfaced during the MCP smoke test
  arc (tracker issue `c8a54ec1` on ops-uluops-api).

## [3.0.3] - 2026-06-01

### Fixed

- **`softDelete` and `deleteProject` now correctly handle the API's 204 No Content
  response.** The API has always returned 204 (empty body) on successful delete, but the
  SDK was calling `DeleteResultResponseSchema.parse(undefined)` and throwing
  `ZodError: expected object, received undefined`. The shared `deleteWithConfirmation`
  helper now synthesizes the documented `{deleted: true}` shape when the response is
  `undefined`, while still validating any body the API may return in the future.

  Surfaced by live MCP smoke (`soft_delete_project` via uluops-tracker).

## [3.0.2] - 2026-06-01

### Fixed

- **`diffRuns` schema now permits `null` for `baseScore`, `compareScore`, and `change`.**
  When an agent appears in only one of the two runs being diffed — common for cross-workflow
  diffs where the agent roster differs — the API correctly returns `null` for the missing
  side. The previous schema required `number` and threw `ZodError` on every cross-workflow
  diff. Same-workflow diffs were unaffected by chance because rosters happened to align.

  Surfaced by live MCP smoke (`diff_runs` between sdk-core run #15 security-cognitive-lens
  and run #16 security-audit).

## [3.0.1] - 2026-06-01

### Fixed

- **`getProjectAnalysis` and `queryAnalysisRecords` now use `rawEnvelope: true`.**
  Both endpoints return a flat pagination payload `{data, total, limit, offset}` — the
  HttpClient's default `{data: T}` envelope unwrap was collapsing that to just the inner
  array, causing `Schema.parse(array)` to throw `ZodError` with "expected object, received
  array". The fix preserves the full pagination wrapper.

  This is a pre-existing bug surfaced by live MCP tool invocation (`get_project_analysis`
  via uluops-tracker). Unit tests had been mocking a double-envelope `{data: {data, total}}`
  that the API never actually returns; mocks corrected to single-envelope.

## [3.0.0] - 2026-06-01

### Breaking

- **Requires `@uluops/sdk-core` 0.11.0.** sdk-core 0.11.0 removed the `options.schema` parameter
  from `HttpClient.request`/`get`/`post`/etc. ops-sdk now compatible only with 0.11.x.
- **No public API changes** — every exported operation still returns the same validated
  type. The schema validation moved from inside `client.METHOD(..., { schema })` to an
  external `Schema.parse(await client.METHOD(...))` wrapping the call. Consumers of ops-sdk
  see no behavioral change except that validation errors now surface as `ZodError` directly
  instead of `ResponseValidationError`.

### Internal

- 68 call sites across 8 operation files migrated to the external-parse pattern. Driven by
  the sdk-core schema-removal migration script (`scripts/migrate-schema.mjs`).
- `runs.test.ts` and `projects.test.ts` assertions updated from
  `/API response validation failed/` regex match to `ZodError` class match.
- Pre-existing test on `sanitizeForDisplay` array-of-objects updated to reflect sdk-core's
  0.10.2 redaction-before-recursion behavior (was failing under sdk-core 0.10.2 too).

## [2.0.2] - 2026-05-31

### Fixed

- **`Run` response schema now includes `authorId` and `definitionId`** — both fields are returned on every Run response by `ops-uluops-api` but were missing from `RunResponseSchema`. Because Zod strips unknown keys, consumers parsing through the SDK silently lost both fields. `Run.authorId` (UUID, nullable — null for system/API-key runs) and `Run.definitionId` (UUID, nullable — registry definition identity linkage) are now part of the parsed type. Additive; no consumer code changes required.
- **`Run` response schema now includes `payloadHash`** — SHA-256 of the save_run payload, used server-side for idempotency deduplication. Previously stripped by the same Zod mechanism.
- **`ValidateRunResponse` now includes `wouldObserve`** — count of recommendations matching issues with observation status. Optional on the schema to remain backward-compatible with API versions that did not yet emit it.
- **`ValidateRunPreview` now includes `observations`** — array of `{ id, title }` for observed issues surfaced by the validate preview. Optional, same back-compat reasoning.

### Internal

- `createMockRun` contract fixture updated to include the new required keys. The previous fixture also lacked `payloadHash` (added in 2.0.1) — the gap was latent because contract validation only runs when `STRICT_CONTRACTS` is set.

## [2.0.1] - 2026-05-27

### Fixed

- **Production base URL corrected** — default URL changed from `https://api.uluops.ai/api/v1/ops` to `https://api.uluops.ai/api/v1`. The `/ops` path prefix did not exist in the API routing, causing 404 errors for all SDK calls using the production default.

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
