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

import type {
  Run,
  RunSummary,
  RunAnalysis,
  ProjectAnalysisList,
  AnalysisRecordsList,
  AgentRunsAnalysis,
  SaveRunInput,
  SaveRunResponse,
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
import type { OrgScopedOptions, RunCallOptions } from './types/org.js';
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
 */
export type OpsClientConfig = HttpClientConfig;

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
        'Call client.login() or set ULUOPS_API_KEY before making API requests.'
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
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await authOps.login(this.httpClient, { email, password });
    // Install session auth so subsequent requests are authenticated.
    // Pass email/password through for automatic token refresh.
    this.httpClient.setAuthStrategy(
      new JwtSessionAuth(
        this.httpClient.createFetchClient(),
        { email, password },
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
   * @returns Number of sessions revoked
   * @throws {UnauthorizedError} If client is not authenticated
   * @throws {OpsApiError} On network or server errors
   */
  async logout(): Promise<{ sessionsRevoked: number }> {
    return authOps.logoutAll(this.httpClient);
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
  private scope(options?: OrgScopedOptions): OpsHttpClient {
    return options?.org ? this.httpClient.withOrg(options.org) : this.httpClient;
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
    list: (options?: OrgScopedOptions): Promise<{ data: Project[]; total: number }> =>
      projectOps.list(this.scope(options)),

    /** Get a project by id or name. */
    get: (idOrName: string, options?: OrgScopedOptions): Promise<Project> =>
      projectOps.get(this.scope(options), idOrName),

    /** Create a new project. */
    create: (input: CreateProjectInput, options?: OrgScopedOptions): Promise<Project> =>
      projectOps.create(this.scope(options), input),

    /** Update a project's metadata. */
    update: (idOrName: string, input: UpdateProjectInput, options?: OrgScopedOptions): Promise<Project> =>
      projectOps.update(this.scope(options), idOrName, input),

    /** Permanently delete a project (requires confirmation). */
    delete: (idOrName: string, input: DeleteProjectInput, options?: OrgScopedOptions): Promise<DeleteResult> =>
      projectOps.deleteProject(this.scope(options), idOrName, input),

    /** Soft-delete a project; reversible via `restore()`. */
    softDelete: (idOrName: string, input: DeleteProjectInput, options?: OrgScopedOptions): Promise<DeleteResult> =>
      projectOps.softDelete(this.scope(options), idOrName, input),

    /** Restore a soft-deleted project. */
    restore: (idOrName: string, options?: OrgScopedOptions): Promise<Project> =>
      projectOps.restore(this.scope(options), idOrName),

    /** Rename a project. */
    rename: (input: RenameProjectInput, options?: OrgScopedOptions): Promise<Project> =>
      projectOps.rename(this.scope(options), input),

    /** Get aggregate summary stats for a project. */
    getSummary: (idOrName: string, options?: OrgScopedOptions): Promise<ProjectSummaryResponse> =>
      projectOps.getSummary(this.scope(options), idOrName),

    /** Get time-series trends for a project. */
    getTrends: (idOrName: string, query?: ProjectTrendsQuery, options?: OrgScopedOptions): Promise<ProjectTrends> =>
      projectOps.getTrends(this.scope(options), idOrName, query),

    /** List a project's issues (filtered) — {data, total} (6.0.0, T13).
     * Replaces listIssuesWithCount, which existed only to recover the count
     * the old array return dropped. */
    listIssues: (idOrName: string, query?: ListProjectIssuesQuery, options?: OrgScopedOptions): Promise<{ data: Issue[]; total: number }> =>
      projectOps.listIssues(this.scope(options), idOrName, query),

    /** Bulk-update the status of many issues in a project. */
    bulkUpdateIssueStatus: (idOrName: string, updates: BulkIssueStatusUpdate[], options?: OrgScopedOptions): Promise<BulkIssueStatusResult> =>
      projectOps.bulkUpdateIssueStatus(this.scope(options), idOrName, updates),

    /** Merge duplicate issues within a project. */
    mergeIssues: (idOrName: string, input: MergeIssuesInput, options?: OrgScopedOptions): Promise<MergeIssuesResult> =>
      projectOps.mergeIssues(this.scope(options), idOrName, input),

    /**
     * Merge one project into another (merge-projects spec v0.3.4) — the
     * source's runs and issues are re-keyed into the target inside one
     * advisory-locked transaction; the source is soft-deleted by default.
     * Pairwise only. Dry-run first: `{ ...input, dryRun: true }`.
     */
    mergeProjects: (input: MergeProjectsInput, options?: OrgScopedOptions): Promise<MergeProjectsResult> =>
      projectOps.mergeProjects(this.scope(options), input),

    /**
     * Move a project to another org (project-org-routing-and-rehome §4.1, D14).
     * The SOURCE is this call's org scope — pass `{ org: '<source>' }` (or set
     * the client `orgSlug`) when the project is not in your personal org; the
     * project is looked up THERE. Needs `admin`/`owner` in both orgs. Old
     * address becomes a `410 PROJECT_REHOMED` tombstone, not a fork.
     */
    rehome: (idOrName: string, input: RehomeProjectInput, options?: OrgScopedOptions): Promise<RehomeResponse> =>
      projectOps.rehome(this.scope(options), idOrName, input),
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
    getVisibleAuditLog: (slug: string, query?: OrgAuditFeedQuery): Promise<OrgAuditFeed> =>
      orgOps.getVisibleAuditLog(this.httpClient, slug, query),
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
    save: (input: SaveRunInput, options?: RunCallOptions): Promise<SaveRunResponse> =>
      runOps.save(this.scope(options), input, options),

    /** Preview a save without persisting (dry-run). */
    validate: (input: SaveRunInput, options?: RunCallOptions): Promise<ValidateRunResponse> =>
      runOps.validate(this.scope(options), input, options),

    /** Diff two runs to surface regressions/improvements. */
    diff: (query: RunDiffQuery, options?: OrgScopedOptions): Promise<RunDiffResult> =>
      runOps.diff(this.scope(options), query),

    /** Archive old runs by number/date/keep-last filter. */
    archive: (input: ArchiveRunsInput, options?: OrgScopedOptions): Promise<ArchiveRunsResult> =>
      runOps.archive(this.scope(options), input),

    /** Update a run (project + run number). Discards the analysis-write echo (use updateWithEcho); on analysis-bearing calls can throw AnalysisEchoMismatchError AFTER the write landed. */
    update: (input: UpdateRunByNumberInput, options?: RunCallOptions): Promise<RunWriteEcho> =>
      runOps.update(this.scope(options), input, options),

    /** Read-only preview of an analysis-bearing update (project + run number): what a write under the requested record_write_mode would supersede, create, and retire. */
    previewUpdate: (input: UpdateRunPreviewByNumberInput, options?: RunCallOptions): Promise<RunUpdatePreview> =>
      runOps.previewUpdate(this.scope(options), input, options),

    /** Update (project + run number) returning the run AND the §3.9 analysis-write echo — success-path visibility of superseded/created counts (F17). */
    updateWithEcho: (input: UpdateRunByNumberInput, options?: RunCallOptions): Promise<UpdateRunWithEchoResult> =>
      runOps.updateWithEcho(this.scope(options), input, options),

    /** List run summaries for a project — {data, total} (6.0.0, T13). */
    listByProject: (projectId: string, query?: ListRunsQuery, options?: OrgScopedOptions): Promise<{ data: RunSummary[]; total: number }> =>
      runOps.listByProject(this.scope(options), projectId, query),

    /** Get the latest run for a project (optionally by workflow type). */
    getLatest: (projectId: string, workflowType?: string, options?: OrgScopedOptions): Promise<Run> =>
      runOps.getLatest(this.scope(options), projectId, workflowType),

    /** Get full details for a run (defaults to latest when runNumber omitted). */
    getDetails: (projectId: string, runNumber?: number, options?: OrgScopedOptions): Promise<RunDetails> =>
      runOps.getDetails(this.scope(options), projectId, runNumber),

    /** Get a single run by its id. */
    get: (runId: string, options?: OrgScopedOptions): Promise<Run> =>
      runOps.get(this.scope(options), runId),

    /** Update a run by id. Discards the analysis-write echo (use updateByIdWithEcho); on analysis-bearing calls can throw AnalysisEchoMismatchError AFTER the write landed. */
    updateById: (runId: string, input: UpdateRunInput, options?: RunCallOptions): Promise<RunWriteEcho> =>
      runOps.updateById(this.scope(options), runId, input, options),

    /** Read-only preview of an analysis-bearing update, by run id. See previewUpdate. */
    previewUpdateById: (runId: string, input: UpdateRunPreviewInput, options?: RunCallOptions): Promise<RunUpdatePreview> =>
      runOps.previewUpdateById(this.scope(options), runId, input, options),

    /** By-id sibling of updateWithEcho (F17). */
    updateByIdWithEcho: (runId: string, input: UpdateRunInput, options?: RunCallOptions): Promise<UpdateRunWithEchoResult> =>
      runOps.updateByIdWithEcho(this.scope(options), runId, input, options),

    /** Delete a run by id. */
    delete: (runId: string, options?: OrgScopedOptions): Promise<DeleteResult> =>
      runOps.deleteRun(this.scope(options), runId),

    // Analysis operations (v0.3.0)
    /** Get the structured analysis attached to a run. */
    getAnalysis: (runId: string, options?: OrgScopedOptions): Promise<RunAnalysis> =>
      runOps.getAnalysis(this.scope(options), runId),

    /** List analyses across a project's runs. */
    getProjectAnalysis: (projectId: string, query?: ProjectAnalysisQuery, options?: OrgScopedOptions): Promise<ProjectAnalysisList> =>
      runOps.getProjectAnalysis(this.scope(options), projectId, query),

    /** Query individual analysis records across runs. */
    queryAnalysisRecords: (query?: AnalysisRecordsQuery, options?: OrgScopedOptions): Promise<AnalysisRecordsList> =>
      runOps.queryAnalysisRecords(this.scope(options), query),

    /** Get per-run analysis history for a single agent. */
    getAgentRunsAnalysis: (agentName: string, query: AgentRunsAnalysisQuery, options?: OrgScopedOptions): Promise<AgentRunsAnalysis> =>
      runOps.getAgentRunsAnalysis(this.scope(options), agentName, query),
  };

  // ============================================
  // ISSUE OPERATIONS
  // ============================================

  /** Issue CRUD, search, status management, notes, and bulk operations */
  readonly issues = {
    /** Create a user-submitted issue. */
    create: (input: CreateUserIssueInput, options?: OrgScopedOptions): Promise<Issue> =>
      issueOps.create(this.scope(options), input),

    /** Search issues by text/filters. */
    search: (query: IssueSearchQuery, options?: OrgScopedOptions): Promise<Issue[]> =>
      issueOps.search(this.scope(options), query),

    /** Get an issue by its fingerprint within a project. */
    getByFingerprint: (fingerprint: string, project: string, options?: OrgScopedOptions): Promise<Issue> =>
      issueOps.getByFingerprint(this.scope(options), fingerprint, project),

    /** Update an issue's status by fingerprint + project. */
    updateStatusByFingerprint: (fingerprint: string, project: string, input: UpdateIssueStatusInput, options?: OrgScopedOptions): Promise<StatusUpdateResult> =>
      issueOps.updateStatusByFingerprint(this.scope(options), fingerprint, project, input),

    /** Get an issue by id. */
    get: (issueId: string, options?: OrgScopedOptions): Promise<Issue> =>
      issueOps.get(this.scope(options), issueId),

    /** Get an issue with notes and history detail. */
    getDetails: (issueId: string, options?: OrgScopedOptions): Promise<IssueDetails> =>
      issueOps.getDetails(this.scope(options), issueId),

    /** Get an issue's change history. */
    getHistory: (issueId: string, options?: OrgScopedOptions): Promise<IssueHistoryEnvelope> =>
      issueOps.getHistory(this.scope(options), issueId),

    /** Update an issue's status by id. */
    updateStatus: (issueId: string, input: UpdateIssueStatusInput, options?: OrgScopedOptions): Promise<Issue> =>
      issueOps.updateStatus(this.scope(options), issueId, input),

    /** Update an issue's metadata by id. */
    update: (issueId: string, input: UpdateIssueInput, options?: OrgScopedOptions): Promise<Issue> =>
      issueOps.update(this.scope(options), issueId, input),

    /** Add a note to an issue. */
    addNote: (issueId: string, input: CreateIssueNoteInput, options?: OrgScopedOptions): Promise<IssueNote> =>
      issueOps.addNote(this.scope(options), issueId, input),

    /** Restore a soft-deleted issue. */
    restore: (issueId: string, options?: OrgScopedOptions): Promise<Issue> =>
      issueOps.restore(this.scope(options), issueId),

    /** Soft-delete an active issue; reversible via `restore()`. */
    softDelete: (issueId: string, options?: OrgScopedOptions): Promise<DeleteResult> =>
      issueOps.softDelete(this.scope(options), issueId),

    /** Undo the most recent change to an issue. */
    undoLastChange: (issueId: string, options?: OrgScopedOptions): Promise<Issue> =>
      issueOps.undoLastChange(this.scope(options), issueId),

    /** Bulk-update issue statuses; returns `{ updated, failed }`. */
    bulkUpdateStatus: (updates: BulkStatusUpdateItem[], options?: OrgScopedOptions): Promise<BulkIssueStatusResult> =>
      issueOps.bulkUpdateStatus(this.scope(options), updates),

    /** List a project's issues by project id (filtered). */
    listByProject: (projectId: string, query?: ListIssuesQuery, options?: OrgScopedOptions): Promise<Issue[]> =>
      issueOps.listByProject(this.scope(options), projectId, query),
  };

  // ============================================
  // ANALYTICS OPERATIONS
  // ============================================

  /** Agent performance, taxonomy analytics, burndown, velocity, and discovery */
  readonly analytics = {
    /** Get per-agent performance metrics. */
    getAgentPerformance: (query?: AnalyticsQuery, options?: OrgScopedOptions): Promise<AgentPerformance[]> =>
      analyticsOps.getAgentPerformance(this.scope(options), query),

    /** Get agent reliability (convergence/recurrence) metrics. */
    getAgentReliability: (query?: AgentReliabilityQuery, options?: OrgScopedOptions): Promise<AgentReliabilityResult> =>
      analyticsOps.getAgentReliability(this.scope(options), query),

    /** Get an agent's lifecycle timeline. */
    getAgentLifecycle: (agentName: string, query?: AnalyticsQuery, options?: OrgScopedOptions): Promise<AgentLifecycleEntry[]> =>
      analyticsOps.getAgentLifecycle(this.scope(options), agentName, query),

    /** Get issue resolution-rate metrics. */
    getResolutionRates: (query?: AnalyticsQuery, options?: OrgScopedOptions): Promise<ResolutionRateResult[]> =>
      analyticsOps.getResolutionRates(this.scope(options), query),

    /** Get files with the most recurring issues. */
    getFileHotspots: (query?: AnalyticsQuery, options?: OrgScopedOptions): Promise<FileHotspotResult[]> =>
      analyticsOps.getFileHotspots(this.scope(options), query),

    /** Get the distribution of issues across the failure taxonomy. */
    getTaxonomyDistribution: (query?: AnalyticsQuery, options?: OrgScopedOptions): Promise<TaxonomyDistributionResult[]> =>
      analyticsOps.getTaxonomyDistribution(this.scope(options), query),

    /** Get the full taxonomy analytics breakdown. */
    getFullTaxonomy: (query?: AnalyticsQuery, options?: OrgScopedOptions): Promise<FullTaxonomyAnalyticsResult> =>
      analyticsOps.getFullTaxonomy(this.scope(options), query),

    /** Get issue burndown over time. */
    getBurndown: (query?: BurndownQuery, options?: OrgScopedOptions): Promise<BurndownResultResponse> =>
      analyticsOps.getBurndown(this.scope(options), query),

    /** Get resolution velocity over time. */
    getVelocity: (query?: VelocityQuery, options?: OrgScopedOptions): Promise<VelocityResultResponse> =>
      analyticsOps.getVelocity(this.scope(options), query),

    /** Get issue-discovery rate metrics. */
    getDiscovery: (query?: DiscoveryQuery, options?: OrgScopedOptions): Promise<DiscoveryResultResponse> =>
      analyticsOps.getDiscovery(this.scope(options), query),

    /** Get the agent comparison matrix. */
    getAgentMatrix: (query?: AgentMatrixQuery, options?: OrgScopedOptions): Promise<AgentMatrixResultResponse> =>
      analyticsOps.getAgentMatrix(this.scope(options), query),

    /** Get a high-level trend summary. */
    getTrendSummary: (query?: AnalyticsQuery, options?: OrgScopedOptions): Promise<TrendSummaryResult[]> =>
      analyticsOps.getTrendSummary(this.scope(options), query),

    /**
     * Get analytics by metric name (generic endpoint).
     * Returns unvalidated data — use typed methods (getAgentPerformance, etc.) for validated responses.
     *
     */
    getByMetric: (metric: analyticsOps.AnalyticsMetric, query?: AnalyticsQuery, options?: OrgScopedOptions): Promise<unknown> =>
      analyticsOps.getByMetric(this.scope(options), metric, query),

    /** List agents known to the analytics layer. */
    listAgents: (query?: AnalyticsQuery, options?: OrgScopedOptions): Promise<AgentInfo[]> =>
      analyticsOps.listAgents(this.scope(options), query),

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
