import { OpsHttpClient, type HttpClientConfig } from './http/http-client.js';
import { createLogger } from '@uluops/sdk-core/utils';
import { JwtSessionAuth } from './http/auth-strategy.js';
import { loadCredentials } from './config/loaders.js';
import { DEFAULT_BASE_URL, ENV_VARS } from './config/constants.js';
import * as authOps from './operations/auth.js';
import * as projectOps from './operations/projects.js';
import * as runOps from './operations/runs.js';
import * as issueOps from './operations/issues.js';
import * as analyticsOps from './operations/analytics.js';
import * as taxonomyOps from './operations/taxonomy.js';
import * as orgOps from './operations/orgs.js';
import * as adminOps from './operations/admin.js';
import type {
  RegisterInput,
  LoginInput,
  TotpLoginInput,
  LoginResponse,
  RegisterResponse,
  UpdateProfileInput,
  ChangePasswordInput,
  ResetPasswordInput,
  CreateApiKeyInput,
  ApiKeyCreatedResponse,
  PublicApiKey,
  PublicSession,
  AuthUser,
  PublicUser,
} from './types/auth.js';

import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  DeleteProjectInput,
  RenameProjectInput,
  ProjectSummaryResponse,
  ProjectTrends,
  ProjectTrendsQuery,
  ListProjectIssuesQuery,
  BulkIssueStatusUpdate,
  BulkIssueStatusResult,
  MergeIssuesInput,
  MergeIssuesResult,
  MergeProjectsInput,
  MergeProjectsResult,
} from './types/projects.js';
import type { ProjectLogQuery, ProjectLogPage, LogStatQuery, ProjectLogStat, OrgLogStat, OrgListEntry } from './types/log.js';

import type {
  Run,
  RunSummary,
  RunAnalysis,
  ProjectAnalysisList,
  AnalysisRecordsList,
  AgentRunsAnalysis,
  SaveRunInput,
  SaveRunResponseWithEcho,
  ValidateRunResponse,
  RunDiffQuery,
  RunDiffResult,
  ArchiveRunsInput,
  ArchiveRunsResult,
  UpdateRunInput,
  UpdateRunByNumberInput,
  UpdateRunPreviewInput,
  UpdateRunPreviewByNumberInput,
  RunUpdatePreview,
  UpdateRunWithEchoResult,
  ListRunsQuery,
  RunDetails,
  ProjectAnalysisQuery,
  AnalysisRecordsQuery,
  AgentRunsAnalysisQuery,
  RunWriteEcho,
} from './types/runs.js';

import type {
  Issue,
  CreateUserIssueInput,
  UpdateIssueInput,
  UpdateIssueStatusInput,
  CreateIssueNoteInput,
  IssueNote,
  IssueDetails,
  IssueHistoryEnvelope,
  IssueSearchQuery,
  ListIssuesQuery,
  BulkStatusUpdateItem,
  StatusUpdateResult,
} from './types/issues.js';

import type {
  AnalyticsQuery,
  AgentPerformance,
  AgentInfo,
  AgentLifecycleEntry,
  AgentReliabilityQuery,
  BurndownQuery,
  VelocityQuery,
  DiscoveryQuery,
  AgentMatrixQuery,
  TaxonomyResponse,
  AgentReliabilityResult,
  ResolutionRateResult,
  FileHotspotResult,
  TaxonomyDistributionResult,
  FullTaxonomyAnalyticsResult,
  BurndownResultResponse,
  VelocityResultResponse,
  DiscoveryResultResponse,
  AgentMatrixResultResponse,
  TrendSummaryResult,
} from './types/analytics.js';

import type { MessageResponse, DeleteResult } from './types/responses.js';
import { attachResponseContext, type ResponseContext } from '@uluops/sdk-core/http';
import type { ContextResult, OrgScopedOptions, RunCallOptions } from './types/org.js';
import type {
  RehomeProjectInput,
  AdminRehomeProjectInput,
  RehomeResponse,
  ProjectRehomeList,
  ProjectRehomeListQuery,
  ProjectRehomeEventList,
  ProjectRehomeEventListQuery,
  OrgAuditFeed,
  OrgAuditFeedQuery,
} from './types/rehome.js';

/**
 * OpsClient configuration options.
 * All HTTP-level options (baseUrl, timeout, retries, debug, auth) are available.
 *
 * Note on `email`/`password` in the constructor: the login then happens inside
 * sdk-core, which cannot see an MFA challenge — an MFA-enrolled account gets a
 * generic `UnauthorizedError`, not `MfaRequiredError`. Use `login()` /
 * `loginWithTotp()` for those accounts.
 */
export type OpsClientConfig = HttpClientConfig;

/**
 * Options for `OpsClient.login`.
 *
 * `autoRefresh` (default `true`) keeps the password on the installed session
 * so sdk-core can re-login when a request answers 401. Three properties of
 * that refresh are not obvious from the word "automatic", and they matter for
 * a script driving admin writes under a session (spec §4.7):
 *
 * - it is a **fresh login**, and under the API's default single-session
 *   policy (`AUTH_ALLOW_CONCURRENT_SESSIONS` unset) a login **revokes the
 *   user's other sessions** — the operator's dashboard tab dies each time;
 * - **mutations are not retried** after a refresh: the POST/DELETE that hit
 *   the 401 still throws it, so the caller sees the failure anyway;
 * - the budget is **one**: the password is cleared after the first re-login,
 *   so the second 401 is terminal with a different message.
 *
 * Pass `{ autoRefresh: false }` when a 401 must mean "stop" (a migration
 * script, anything sharing the account with a dashboard). The session is
 * then installed without credentials, exactly as `loginWithTotp` installs
 * its session, and a 401 surfaces untouched.
 */
export interface LoginOptions {
  autoRefresh?: boolean;
}

/**
 * Main SDK client for the UluOps platform API.
 *
 * Supports two authentication modes:
 * - **API key**: Pass `apiKey` in config (stateless, recommended for CI/CD and scripts)
 * - **Session**: Call {@link OpsClient.login} with email/password (stateful, auto-refreshes tokens)
 *
 * @example
 * ```ts
 * // API key auth
 * const client = new OpsClient({ apiKey: 'your-key' });
 * const projects = await client.projects.list();
 *
 * // Session auth
 * const client = new OpsClient({ baseUrl: 'https://api.uluops.com' });
 * await client.login('user@example.com', 'password');
 * ```
 */
export class OpsClient {
  private readonly httpClient: OpsHttpClient;

  /**
   * @param config - Client configuration. If no auth credentials are provided,
   *   the constructor auto-loads from `ULUOPS_API_KEY` env var, `.env` files,
   *   and `~/.uluops/credentials.json` (in that order).
   */
  constructor(config: OpsClientConfig = {}) {
    // Auto-load credentials from env vars / .env / ~/.uluops/credentials.json
    // if no explicit auth was provided in config
    const hasExplicitAuth = config.apiKey || config.sessionToken || (config.email && config.password);
    if (!hasExplicitAuth) {
      const creds = loadCredentials();
      if (creds.apiKey) config = { ...config, apiKey: creds.apiKey };
      else if (creds.sessionToken) config = { ...config, sessionToken: creds.sessionToken };
      else if (creds.email && creds.password) config = { ...config, email: creds.email, password: creds.password };
    }
    this.httpClient = new OpsHttpClient(config);
    const logger = createLogger('ops-sdk', config.debug ?? false);
    const resolvedUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    logger.debug(`Initialized — baseUrl=${resolvedUrl}`);
    if (!config.baseUrl && resolvedUrl.includes('localhost')) {
      logger.warn(
        `Resolved to localhost (${resolvedUrl}) because NODE_ENV=${process.env.NODE_ENV}. ` +
        'Set ULUOPS_BASE_URL or pass baseUrl in config to override.'
      );
    }
    if (!this.isAuthenticated() && !(config.email && config.password)) {
      logger.warn(
        `No credentials found (checked: constructor config, ${ENV_VARS.API_KEY} env, .env files, ~/.uluops/credentials.json). ` +
        'Call client.login() or set ULUOPS_API_KEY before making API requests. ' +
        'Create a key at https://app.uluops.ai (Settings → API keys).'
      );
    }
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  /**
   * Login with email and password, then install session auth for subsequent requests.
   *
   * Prefer this over `client.auth.login()` — this method automatically configures
   * the client for authenticated requests with token auto-refresh. `client.auth.login()`
   * only returns the token without installing it.
   */
  async login(email: string, password: string, options: LoginOptions = {}): Promise<LoginResponse> {
    const response = await authOps.login(this.httpClient, { email, password });
    // Install session auth so subsequent requests are authenticated. With
    // `autoRefresh` (the default) the password is kept so sdk-core can re-login
    // on a 401 — see LoginOptions for what that refresh actually does and when
    // to turn it off.
    this.httpClient.setAuthStrategy(
      new JwtSessionAuth(
        this.httpClient.createFetchClient(),
        options.autoRefresh === false ? { email: '', password: '' } : { email, password },
        undefined,
        response.sessionToken
      )
    );
    return response;
  }

  /**
   * Complete an MFA-challenged login with a TOTP code and install the session.
   *
   * `login()` throws `MfaRequiredError` for an account with TOTP or a passkey
   * enrolled; pass its `mfaChallengeToken` here with the current six-digit code
   * before `expiresAt`. The installed session has NO password to re-login with
   * (a re-login would only produce another challenge), so it is not
   * auto-refreshed: when it expires, requests fail `401` and the caller logs in
   * again. A Phase 4 migration script should treat that 401 as "stop", not
   * "retry with the key" (spec §4.7).
   */
  async loginWithTotp(mfaChallengeToken: string, code: string, rememberMe?: boolean): Promise<LoginResponse> {
    const response = await authOps.totpLogin(this.httpClient, { mfaChallengeToken, code, rememberMe });
    this.httpClient.setAuthStrategy(
      new JwtSessionAuth(
        this.httpClient.createFetchClient(),
        { email: '', password: '' }, // no credentials → no refresh (same shape createAuthStrategy uses for a bare sessionToken)
        undefined,
        response.sessionToken
      )
    );
    return response;
  }

  /**
   * Logout current session (revokes all sessions for this user).
   *
   * Revoke every session for the current user server-side AND clear the
   * session installed on this client (token and retained password), so
   * `isAuthenticated()` is false afterwards and no automatic re-login can
   * follow. An API-key strategy is untouched — keys are not sessions.
   *
   * @returns Number of sessions revoked
   * @throws {UnauthorizedError} If client is not authenticated
   * @throws {OpsApiError} On network or server errors
   */
  async logout(): Promise<{ sessionsRevoked: number }> {
    const result = await authOps.logoutAll(this.httpClient);
    // The server has revoked every session; forget ours too. Until ship run
    // #48 this returned without touching the installed strategy, so
    // `isAuthenticated()` stayed true on a revoked token and — with
    // `autoRefresh` (the default) — the next 401 re-logged-in with the
    // retained password, silently undoing the logout. `clearSession()` drops
    // the token AND the password, so the next request fails `UnauthorizedError`
    // before it is sent, and a fresh `login()` is the only way back. An API-key
    // strategy is not a session and is left alone.
    const strategy = this.httpClient.getAuthStrategy();
    if (strategy instanceof JwtSessionAuth) strategy.clearSession();
    return result;
  }

  /**
   * Check if client has valid credentials installed (API key or session token).
   *
   * @returns `true` if an auth strategy is present and authenticated
   */
  isAuthenticated(): boolean {
    const authStrategy = this.httpClient.getAuthStrategy();
    return authStrategy?.isAuthenticated() ?? false;
  }

  /**
   * Get the current authentication type.
   *
   * @returns `'api_key'`, `'session'`, or `null` if unauthenticated
   */
  getAuthType(): 'api_key' | 'session' | null {
    const authStrategy = this.httpClient.getAuthStrategy();
    return authStrategy?.getType() ?? null;
  }

  /**
   * The HTTP client for one call: a per-call `org` (spec §3.2) yields a view
   * carrying `X-Org-Slug: <org>` on that request only; otherwise the root
   * client (constructor `orgSlug`, else the personal org).
   */
  private scope(options?: OrgScopedOptions<boolean>): OpsHttpClient {
    return options?.org ? this.httpClient.withOrg(options.org) : this.httpClient;
  }

  private async execute<T, C extends boolean = false>(
    options: OrgScopedOptions<C> | undefined,
    operation: (client: OpsHttpClient) => Promise<T>,
  ): Promise<ContextResult<T, C>> {
    let context: ResponseContext | null = null;
    const client = this.scope(options).withResponseCapture(value => { context = value; });
    try {
      const data = await operation(client);
      // The generic opt-in mirrors this runtime branch; existing shapes stay intact.
      return (options?.withResponseContext ? { data, context } : data) as ContextResult<T, C>;
    } catch (error) {
      // HTTP errors already carry their own response; schema/echo errors occur later.
      if (!(error instanceof Error) || !('responseContext' in error)) attachResponseContext(error, context);
      throw error;
    }
  }

  // ============================================
  // AUTH OPERATIONS
  // ============================================

  /** Authentication, API keys, sessions, and user profile management */
  readonly auth = {
    /** Register a new user account. */
    register: (input: RegisterInput): Promise<RegisterResponse> =>
      authOps.register(this.httpClient, input),

    /** Log in with email + password, returning a session token. Throws `MfaRequiredError` for an MFA-enrolled account. */
    login: (input: LoginInput): Promise<LoginResponse> =>
      authOps.login(this.httpClient, input),

    /** Complete an MFA challenge with a TOTP code, returning the session (not installed — see `OpsClient.loginWithTotp`). */
    totpLogin: (input: TotpLoginInput): Promise<LoginResponse> =>
      authOps.totpLogin(this.httpClient, input),

    /** Revoke all active sessions for the current user. */
    logoutAll: (): Promise<{ sessionsRevoked: number }> =>
      authOps.logoutAll(this.httpClient),

    /** Trigger a password-reset email for the given address. */
    forgotPassword: (email: string): Promise<MessageResponse> =>
      authOps.forgotPassword(this.httpClient, email),

    /** Complete a password reset using a token from the reset email. */
    resetPassword: (input: ResetPasswordInput): Promise<MessageResponse> =>
      authOps.resetPassword(this.httpClient, input),

    /** Change the current user's password (requires current password). */
    changePassword: (input: ChangePasswordInput): Promise<MessageResponse> =>
      authOps.changePassword(this.httpClient, input),

    /** Set a first-time password for OAuth/admin-created accounts. */
    setPassword: (password: string): Promise<MessageResponse> =>
      authOps.setPassword(this.httpClient, password),

    /** Get the authenticated user (auth-scoped view). */
    getMe: (): Promise<AuthUser> =>
      authOps.getMe(this.httpClient),

    /** Get the current user's public profile. */
    getProfile: (): Promise<{ user: PublicUser }> =>
      authOps.getProfile(this.httpClient),

    /** Update the current user's profile (partial; at least one field). */
    updateProfile: (input: UpdateProfileInput): Promise<{ user: PublicUser }> =>
      authOps.updateProfile(this.httpClient, input),

    /** Fetch the current user's avatar bytes and content type. */
    getAvatar: (): Promise<{ data: ArrayBuffer; contentType: string }> =>
      authOps.getAvatar(this.httpClient),

    /** Remove the current user's avatar. */
    deleteAvatar: (): Promise<void> =>
      authOps.deleteAvatar(this.httpClient),

    /** List the current user's API keys (metadata only). */
    listApiKeys: (): Promise<PublicApiKey[]> =>
      authOps.listApiKeys(this.httpClient),

    /** Create an API key; the secret is returned once, on creation. */
    createApiKey: (input?: CreateApiKeyInput): Promise<ApiKeyCreatedResponse> =>
      authOps.createApiKey(this.httpClient, input),

    /** Revoke an API key by id. */
    revokeApiKey: (keyId: string): Promise<void> =>
      authOps.revokeApiKey(this.httpClient, keyId),

    /** List the current user's active sessions. */
    listSessions: (): Promise<PublicSession[]> =>
      authOps.listSessions(this.httpClient),

    /** Revoke a single session by id. */
    revokeSession: (sessionId: string): Promise<void> =>
      authOps.revokeSession(this.httpClient, sessionId),
  };

  // ============================================
  // PROJECT OPERATIONS
  // ============================================

  /** Project CRUD, summaries, trends, issue listing, and bulk operations */
  readonly projects = {
    /** List all projects visible to the caller — {data, total} (6.0.0, T13). */
    list: <C extends boolean = false>(options?: OrgScopedOptions<C>): Promise<ContextResult<{ data: Project[]; total: number }, C>> =>
      this.execute(options, client => projectOps.list(client)),

    /** Get a project by id or name. */
    get: <C extends boolean = false>(idOrName: string, options?: OrgScopedOptions<C>): Promise<ContextResult<Project, C>> =>
      this.execute(options, client => projectOps.get(client, idOrName)),

    /** Create a new project. */
    create: <C extends boolean = false>(input: CreateProjectInput, options?: OrgScopedOptions<C>): Promise<ContextResult<Project, C>> =>
      this.execute(options, client => projectOps.create(client, input)),

    /** Update a project's metadata. */
    update: <C extends boolean = false>(idOrName: string, input: UpdateProjectInput, options?: OrgScopedOptions<C>): Promise<ContextResult<Project, C>> =>
      this.execute(options, client => projectOps.update(client, idOrName, input)),

    /** Permanently delete a project (requires confirmation). */
    delete: <C extends boolean = false>(idOrName: string, input: DeleteProjectInput, options?: OrgScopedOptions<C>): Promise<ContextResult<DeleteResult, C>> =>
      this.execute(options, client => projectOps.deleteProject(client, idOrName, input)),

    /** Soft-delete a project; reversible via `restore()`. */
    softDelete: <C extends boolean = false>(idOrName: string, input: DeleteProjectInput, options?: OrgScopedOptions<C>): Promise<ContextResult<DeleteResult, C>> =>
      this.execute(options, client => projectOps.softDelete(client, idOrName, input)),

    /** Restore a soft-deleted project. */
    restore: <C extends boolean = false>(idOrName: string, options?: OrgScopedOptions<C>): Promise<ContextResult<Project, C>> =>
      this.execute(options, client => projectOps.restore(client, idOrName)),

    /** Rename a project. */
    rename: <C extends boolean = false>(input: RenameProjectInput, options?: OrgScopedOptions<C>): Promise<ContextResult<Project, C>> =>
      this.execute(options, client => projectOps.rename(client, input)),

    /** Get aggregate summary stats for a project. */
    getSummary: <C extends boolean = false>(idOrName: string, options?: OrgScopedOptions<C>): Promise<ContextResult<ProjectSummaryResponse, C>> =>
      this.execute(options, client => projectOps.getSummary(client, idOrName)),

    /** Get time-series trends for a project. */
    getTrends: <C extends boolean = false>(idOrName: string, query?: ProjectTrendsQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<ProjectTrends, C>> =>
      this.execute(options, client => projectOps.getTrends(client, idOrName, query)),

    /** List a project's issues (filtered) — {data, total} (6.0.0, T13).
     * Replaces listIssuesWithCount, which existed only to recover the count
     * the old array return dropped. */
    listIssues: <C extends boolean = false>(idOrName: string, query?: ListProjectIssuesQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<{ data: Issue[]; total: number }, C>> =>
      this.execute(options, client => projectOps.listIssues(client, idOrName, query)),

    /** Bulk-update the status of many issues in a project. */
    bulkUpdateIssueStatus: <C extends boolean = false>(idOrName: string, updates: BulkIssueStatusUpdate[], options?: OrgScopedOptions<C>): Promise<ContextResult<BulkIssueStatusResult, C>> =>
      this.execute(options, client => projectOps.bulkUpdateIssueStatus(client, idOrName, updates)),

    /** Merge duplicate issues within a project. */
    mergeIssues: <C extends boolean = false>(idOrName: string, input: MergeIssuesInput, options?: OrgScopedOptions<C>): Promise<ContextResult<MergeIssuesResult, C>> =>
      this.execute(options, client => projectOps.mergeIssues(client, idOrName, input)),

    /**
     * Merge one project into another (merge-projects spec v0.3.4) — the
     * source's runs and issues are re-keyed into the target inside one
     * advisory-locked transaction; the source is soft-deleted by default.
     * Pairwise only. Dry-run first: `{ ...input, dryRun: true }`.
     */
    mergeProjects: <C extends boolean = false>(input: MergeProjectsInput, options?: OrgScopedOptions<C>): Promise<ContextResult<MergeProjectsResult, C>> =>
      this.execute(options, client => projectOps.mergeProjects(client, input)),

    /**
     * Move a project to another org (project-org-routing-and-rehome §4.1, D14).
     * The SOURCE is this call's org scope — pass `{ org: '<source>' }` (or set
     * the client `orgSlug`) when the project is not in your personal org; the
     * project is looked up THERE. Needs `admin`/`owner` in both orgs. Old
     * address becomes a `410 PROJECT_REHOMED` tombstone, not a fork.
     */
    rehome: <C extends boolean = false>(idOrName: string, input: RehomeProjectInput, options?: OrgScopedOptions<C>): Promise<ContextResult<RehomeResponse, C>> =>
      this.execute(options, client => projectOps.rehome(client, idOrName, input)),

    /**
     * The project log (ulu log spec §3.2) — runs, decisions and regressions
     * interleaved newest first, keyset-paged; pass `nextCursor` back verbatim.
     * A `regression` is a row a run re-detected; a `resolved → open` decision
     * with no run is *reopened by decision* (D12) — keep them apart.
     */
    getLog: <C extends boolean = false>(idOrName: string, query?: ProjectLogQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<ProjectLogPage, C>> =>
      this.execute(options, client => projectOps.getLog(client, idOrName, query)),

    /**
     * The log's rollup (§3.3): examined / found / decided / cameBack /
     * activity — a cohort frame on run timestamps and an activity frame on
     * ledger timestamps; `decided` is the CURRENT status of the found issues.
     */
    getLogStat: <C extends boolean = false>(idOrName: string, query?: LogStatQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<ProjectLogStat, C>> =>
      this.execute(options, client => projectOps.getLogStat(client, idOrName, query)),
  };

  // ============================================
  // ORG OPERATIONS
  // ============================================

  /** Org reads a member can make. (Org CRUD and membership are dashboard/platform surfaces, not wrapped here.) */
  readonly orgs = {
    /**
     * The org-visible audit feed (D19) — rows a writer marked `visibility: 'org'`,
     * readable by any member; today, projects leaving this org for a personal
     * org. `nextCursor` is opaque; pass it back verbatim. Narrow entries with
     * `readRehomeAuditDetails()`.
     */
    getVisibleAuditLog: <C extends boolean = false>(slug: string, query?: OrgAuditFeedQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<OrgAuditFeed, C>> =>
      this.execute(options, client => orgOps.getVisibleAuditLog(client, slug, query)),

    /** The orgs the caller belongs to (personal included) — what `ulu log --orgs` iterates. */
    list: (): Promise<OrgListEntry[]> => orgOps.list(this.httpClient),

    /**
     * The org rollup (ulu log §3.6): the §3.3 body over the org's live projects
     * plus a per-project table (`projects[]`, capped at 100). Any member reads;
     * cached 60 s server-side — `computedAt` says how old. The slug in the
     * path is the org; no `OrgScopedOptions` here for the same reason as
     * `getVisibleAuditLog`.
     */
    getLogStat: <C extends boolean = false>(slug: string, query?: LogStatQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<OrgLogStat, C>> =>
      this.execute(options, client => orgOps.getLogStat(client, slug, query)),
  };

  // ============================================
  // ADMIN OPERATIONS (platform role)
  // ============================================

  /**
   * Platform-admin surface. Requires `users.role = 'admin'`; the writes also
   * require a login-issued SESSION (D20) — an API key gets `403 SESSION_REQUIRED`
   * (`isSessionRequiredError`). Log in with `login()` / `loginWithTotp()` first.
   * Deliberately not exposed as MCP tools.
   */
  readonly admin = {
    /**
     * Move ANY project between ANY orgs by UUID — `reason` required, session
     * only. `same_org` (via `rehomeRefusalReason`) means already done.
     */
    rehomeProject: (projectId: string, input: AdminRehomeProjectInput): Promise<RehomeResponse> =>
      adminOps.rehomeProject(this.httpClient, projectId, input),

    /** The current redirect table: every vacated `(org, name)` and where it points. Key-readable. */
    listProjectRehomes: (query?: ProjectRehomeListQuery): Promise<ProjectRehomeList> =>
      adminOps.listProjectRehomes(this.httpClient, query),

    /** The append-only re-home ledger (D21), paged by `seq`. Key-readable. Reconcile migrations against THIS. */
    listProjectRehomeEvents: (query?: ProjectRehomeEventListQuery): Promise<ProjectRehomeEventList> =>
      adminOps.listProjectRehomeEvents(this.httpClient, query),

    /** Release a vacated address so the old name is creatable again (audited; never by time). Session only. */
    releaseProjectRehome: (rehomeId: string): Promise<{ released: true }> =>
      adminOps.releaseProjectRehome(this.httpClient, rehomeId),
  };

  // ============================================
  // RUN OPERATIONS
  // ============================================

  /** Execution run save, preview, diff, archive, and retrieval */
  readonly runs = {
    /** Save an execution run (agents, scores, recommendations). */
    save: <C extends boolean = false>(input: SaveRunInput, options?: RunCallOptions<C>): Promise<ContextResult<SaveRunResponseWithEcho, C>> =>
      this.execute(options, client => runOps.save(client, input, options)),

    /** Preview a save without persisting (dry-run). */
    validate: <C extends boolean = false>(input: SaveRunInput, options?: RunCallOptions<C>): Promise<ContextResult<ValidateRunResponse, C>> =>
      this.execute(options, client => runOps.validate(client, input, options)),

    /** Diff two runs to surface regressions/improvements. */
    diff: <C extends boolean = false>(query: RunDiffQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<RunDiffResult, C>> =>
      this.execute(options, client => runOps.diff(client, query)),

    /** Archive old runs by number/date/keep-last filter. */
    archive: <C extends boolean = false>(input: ArchiveRunsInput, options?: OrgScopedOptions<C>): Promise<ContextResult<ArchiveRunsResult, C>> =>
      this.execute(options, client => runOps.archive(client, input)),

    /** Update a run (project + run number). Discards the analysis-write echo (use updateWithEcho); on analysis-bearing calls can throw AnalysisEchoMismatchError AFTER the write landed. */
    update: <C extends boolean = false>(input: UpdateRunByNumberInput, options?: RunCallOptions<C>): Promise<ContextResult<RunWriteEcho, C>> =>
      this.execute(options, client => runOps.update(client, input, options)),

    /** Read-only preview of an analysis-bearing update (project + run number): what a write under the requested record_write_mode would supersede, create, and retire. */
    previewUpdate: <C extends boolean = false>(input: UpdateRunPreviewByNumberInput, options?: RunCallOptions<C>): Promise<ContextResult<RunUpdatePreview, C>> =>
      this.execute(options, client => runOps.previewUpdate(client, input, options)),

    /** Update (project + run number) returning the run AND the §3.9 analysis-write echo — success-path visibility of superseded/created counts (F17). */
    updateWithEcho: <C extends boolean = false>(input: UpdateRunByNumberInput, options?: RunCallOptions<C>): Promise<ContextResult<UpdateRunWithEchoResult, C>> =>
      this.execute(options, client => runOps.updateWithEcho(client, input, options)),

    /** List run summaries for a project — {data, total} (6.0.0, T13). */
    listByProject: <C extends boolean = false>(projectId: string, query?: ListRunsQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<{ data: RunSummary[]; total: number }, C>> =>
      this.execute(options, client => runOps.listByProject(client, projectId, query)),

    /** Get the latest run for a project (optionally by workflow type). */
    getLatest: <C extends boolean = false>(projectId: string, workflowType?: string, options?: OrgScopedOptions<C>): Promise<ContextResult<Run, C>> =>
      this.execute(options, client => runOps.getLatest(client, projectId, workflowType)),

    /** Get full details for a run (defaults to latest when runNumber omitted). */
    getDetails: <C extends boolean = false>(projectId: string, runNumber?: number, options?: OrgScopedOptions<C>): Promise<ContextResult<RunDetails, C>> =>
      this.execute(options, client => runOps.getDetails(client, projectId, runNumber)),

    /** Get a single run by its id. */
    get: <C extends boolean = false>(runId: string, options?: OrgScopedOptions<C>): Promise<ContextResult<Run, C>> =>
      this.execute(options, client => runOps.get(client, runId)),

    /** Update a run by id. Discards the analysis-write echo (use updateByIdWithEcho); on analysis-bearing calls can throw AnalysisEchoMismatchError AFTER the write landed. */
    updateById: <C extends boolean = false>(runId: string, input: UpdateRunInput, options?: RunCallOptions<C>): Promise<ContextResult<RunWriteEcho, C>> =>
      this.execute(options, client => runOps.updateById(client, runId, input, options)),

    /** Read-only preview of an analysis-bearing update, by run id. See previewUpdate. */
    previewUpdateById: <C extends boolean = false>(runId: string, input: UpdateRunPreviewInput, options?: RunCallOptions<C>): Promise<ContextResult<RunUpdatePreview, C>> =>
      this.execute(options, client => runOps.previewUpdateById(client, runId, input, options)),

    /** By-id sibling of updateWithEcho (F17). */
    updateByIdWithEcho: <C extends boolean = false>(runId: string, input: UpdateRunInput, options?: RunCallOptions<C>): Promise<ContextResult<UpdateRunWithEchoResult, C>> =>
      this.execute(options, client => runOps.updateByIdWithEcho(client, runId, input, options)),

    /** Delete a run by id. */
    delete: <C extends boolean = false>(runId: string, options?: OrgScopedOptions<C>): Promise<ContextResult<DeleteResult, C>> =>
      this.execute(options, client => runOps.deleteRun(client, runId)),

    // Analysis operations (v0.3.0)
    /** Get the structured analysis attached to a run. */
    getAnalysis: <C extends boolean = false>(runId: string, options?: OrgScopedOptions<C>): Promise<ContextResult<RunAnalysis, C>> =>
      this.execute(options, client => runOps.getAnalysis(client, runId)),

    /** List analyses across a project's runs. */
    getProjectAnalysis: <C extends boolean = false>(projectId: string, query?: ProjectAnalysisQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<ProjectAnalysisList, C>> =>
      this.execute(options, client => runOps.getProjectAnalysis(client, projectId, query)),

    /** Query individual analysis records across runs. */
    queryAnalysisRecords: <C extends boolean = false>(query?: AnalysisRecordsQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<AnalysisRecordsList, C>> =>
      this.execute(options, client => runOps.queryAnalysisRecords(client, query)),

    /** Get per-run analysis history for a single agent. */
    getAgentRunsAnalysis: <C extends boolean = false>(agentName: string, query: AgentRunsAnalysisQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<AgentRunsAnalysis, C>> =>
      this.execute(options, client => runOps.getAgentRunsAnalysis(client, agentName, query)),
  };

  // ============================================
  // ISSUE OPERATIONS
  // ============================================

  /** Issue CRUD, search, status management, notes, and bulk operations */
  readonly issues = {
    /** Create a user-submitted issue. */
    create: <C extends boolean = false>(input: CreateUserIssueInput, options?: OrgScopedOptions<C>): Promise<ContextResult<Issue, C>> =>
      this.execute(options, client => issueOps.create(client, input)),

    /** Search issues by text/filters. */
    search: <C extends boolean = false>(query: IssueSearchQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<Issue[], C>> =>
      this.execute(options, client => issueOps.search(client, query)),

    /** Get an issue by its fingerprint within a project. */
    getByFingerprint: <C extends boolean = false>(fingerprint: string, project: string, options?: OrgScopedOptions<C>): Promise<ContextResult<Issue, C>> =>
      this.execute(options, client => issueOps.getByFingerprint(client, fingerprint, project)),

    /** Update an issue's status by fingerprint + project. */
    updateStatusByFingerprint: <C extends boolean = false>(fingerprint: string, project: string, input: UpdateIssueStatusInput, options?: OrgScopedOptions<C>): Promise<ContextResult<StatusUpdateResult, C>> =>
      this.execute(options, client => issueOps.updateStatusByFingerprint(client, fingerprint, project, input)),

    /** Get an issue by id. */
    get: <C extends boolean = false>(issueId: string, options?: OrgScopedOptions<C>): Promise<ContextResult<Issue, C>> =>
      this.execute(options, client => issueOps.get(client, issueId)),

    /** Get an issue with notes and history detail. */
    getDetails: <C extends boolean = false>(issueId: string, options?: OrgScopedOptions<C>): Promise<ContextResult<IssueDetails, C>> =>
      this.execute(options, client => issueOps.getDetails(client, issueId)),

    /** Get an issue's change history. */
    getHistory: <C extends boolean = false>(issueId: string, options?: OrgScopedOptions<C>): Promise<ContextResult<IssueHistoryEnvelope, C>> =>
      this.execute(options, client => issueOps.getHistory(client, issueId)),

    /** Update an issue's status by id. */
    updateStatus: <C extends boolean = false>(issueId: string, input: UpdateIssueStatusInput, options?: OrgScopedOptions<C>): Promise<ContextResult<Issue, C>> =>
      this.execute(options, client => issueOps.updateStatus(client, issueId, input)),

    /** Update an issue's metadata by id. */
    update: <C extends boolean = false>(issueId: string, input: UpdateIssueInput, options?: OrgScopedOptions<C>): Promise<ContextResult<Issue, C>> =>
      this.execute(options, client => issueOps.update(client, issueId, input)),

    /** Add a note to an issue. */
    addNote: <C extends boolean = false>(issueId: string, input: CreateIssueNoteInput, options?: OrgScopedOptions<C>): Promise<ContextResult<IssueNote, C>> =>
      this.execute(options, client => issueOps.addNote(client, issueId, input)),

    /** Restore a soft-deleted issue. */
    restore: <C extends boolean = false>(issueId: string, options?: OrgScopedOptions<C>): Promise<ContextResult<Issue, C>> =>
      this.execute(options, client => issueOps.restore(client, issueId)),

    /** Soft-delete an active issue; reversible via `restore()`. */
    softDelete: <C extends boolean = false>(issueId: string, options?: OrgScopedOptions<C>): Promise<ContextResult<DeleteResult, C>> =>
      this.execute(options, client => issueOps.softDelete(client, issueId)),

    /** Undo the most recent change to an issue. */
    undoLastChange: <C extends boolean = false>(issueId: string, options?: OrgScopedOptions<C>): Promise<ContextResult<Issue, C>> =>
      this.execute(options, client => issueOps.undoLastChange(client, issueId)),

    /** Bulk-update issue statuses; returns `{ updated, failed }`. */
    bulkUpdateStatus: <C extends boolean = false>(updates: BulkStatusUpdateItem[], options?: OrgScopedOptions<C>): Promise<ContextResult<BulkIssueStatusResult, C>> =>
      this.execute(options, client => issueOps.bulkUpdateStatus(client, updates)),

    /** List a project's issues by project id (filtered). */
    listByProject: <C extends boolean = false>(projectId: string, query?: ListIssuesQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<Issue[], C>> =>
      this.execute(options, client => issueOps.listByProject(client, projectId, query)),
  };

  // ============================================
  // ANALYTICS OPERATIONS
  // ============================================

  /** Agent performance, taxonomy analytics, burndown, velocity, and discovery */
  readonly analytics = {
    /** Get per-agent performance metrics. */
    getAgentPerformance: <C extends boolean = false>(query?: AnalyticsQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<AgentPerformance[], C>> =>
      this.execute(options, client => analyticsOps.getAgentPerformance(client, query)),

    /** Get agent reliability (convergence/recurrence) metrics. */
    getAgentReliability: <C extends boolean = false>(query?: AgentReliabilityQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<AgentReliabilityResult, C>> =>
      this.execute(options, client => analyticsOps.getAgentReliability(client, query)),

    /** Get an agent's lifecycle timeline. */
    getAgentLifecycle: <C extends boolean = false>(agentName: string, query?: AnalyticsQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<AgentLifecycleEntry[], C>> =>
      this.execute(options, client => analyticsOps.getAgentLifecycle(client, agentName, query)),

    /** Get issue resolution-rate metrics. */
    getResolutionRates: <C extends boolean = false>(query?: AnalyticsQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<ResolutionRateResult[], C>> =>
      this.execute(options, client => analyticsOps.getResolutionRates(client, query)),

    /** Get files with the most recurring issues. */
    getFileHotspots: <C extends boolean = false>(query?: AnalyticsQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<FileHotspotResult[], C>> =>
      this.execute(options, client => analyticsOps.getFileHotspots(client, query)),

    /** Get the distribution of issues across the failure taxonomy. */
    getTaxonomyDistribution: <C extends boolean = false>(query?: AnalyticsQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<TaxonomyDistributionResult[], C>> =>
      this.execute(options, client => analyticsOps.getTaxonomyDistribution(client, query)),

    /** Get the full taxonomy analytics breakdown. */
    getFullTaxonomy: <C extends boolean = false>(query?: AnalyticsQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<FullTaxonomyAnalyticsResult, C>> =>
      this.execute(options, client => analyticsOps.getFullTaxonomy(client, query)),

    /** Get issue burndown over time. */
    getBurndown: <C extends boolean = false>(query?: BurndownQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<BurndownResultResponse, C>> =>
      this.execute(options, client => analyticsOps.getBurndown(client, query)),

    /** Get resolution velocity over time. */
    getVelocity: <C extends boolean = false>(query?: VelocityQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<VelocityResultResponse, C>> =>
      this.execute(options, client => analyticsOps.getVelocity(client, query)),

    /** Get issue-discovery rate metrics. */
    getDiscovery: <C extends boolean = false>(query?: DiscoveryQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<DiscoveryResultResponse, C>> =>
      this.execute(options, client => analyticsOps.getDiscovery(client, query)),

    /** Get the agent comparison matrix. */
    getAgentMatrix: <C extends boolean = false>(query?: AgentMatrixQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<AgentMatrixResultResponse, C>> =>
      this.execute(options, client => analyticsOps.getAgentMatrix(client, query)),

    /** Get a high-level trend summary. */
    getTrendSummary: <C extends boolean = false>(query?: AnalyticsQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<TrendSummaryResult[], C>> =>
      this.execute(options, client => analyticsOps.getTrendSummary(client, query)),

    /**
     * Get analytics by metric name (generic endpoint).
     * Returns unvalidated data — use typed methods (getAgentPerformance, etc.) for validated responses.
     *
     */
    getByMetric: <C extends boolean = false>(metric: analyticsOps.AnalyticsMetric, query?: AnalyticsQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<unknown, C>> =>
      this.execute(options, client => analyticsOps.getByMetric(client, metric, query)),

    /** List agents known to the analytics layer. */
    listAgents: <C extends boolean = false>(query?: AnalyticsQuery, options?: OrgScopedOptions<C>): Promise<ContextResult<AgentInfo[], C>> =>
      this.execute(options, client => analyticsOps.listAgents(client, query)),

  };

  // ============================================
  // TAXONOMY OPERATIONS
  // ============================================

  /** Failure taxonomy schema (domains, modes, severities) */
  readonly taxonomy = {
    /** Get the failure-taxonomy schema (domains, modes, severities). */
    get: (): Promise<TaxonomyResponse> =>
      taxonomyOps.get(this.httpClient),
  };

}
