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
import type {
  RegisterInput,
  LoginInput,
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
  PaginatedIssues,
  ProjectTrends,
  ProjectTrendsQuery,
  ListProjectIssuesQuery,
  BulkIssueStatusUpdate,
  BulkIssueStatusResult,
  MergeIssuesInput,
  MergeIssuesResult,
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
  ListRunsQuery,
  RunDetails,
  ProjectAnalysisQuery,
  AnalysisRecordsQuery,
  AgentRunsAnalysisQuery,
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

  // ============================================
  // AUTH OPERATIONS
  // ============================================

  /** Authentication, API keys, sessions, and user profile management */
  readonly auth = {
    /** Register a new user account. */
    register: (input: RegisterInput): Promise<RegisterResponse> =>
      authOps.register(this.httpClient, input),

    /** Log in with email + password, returning a session token. */
    login: (input: LoginInput): Promise<LoginResponse> =>
      authOps.login(this.httpClient, input),

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
    /** List all projects visible to the caller. */
    list: (): Promise<Project[]> =>
      projectOps.list(this.httpClient),

    /** Get a project by id or name. */
    get: (idOrName: string): Promise<Project> =>
      projectOps.get(this.httpClient, idOrName),

    /** Create a new project. */
    create: (input: CreateProjectInput): Promise<Project> =>
      projectOps.create(this.httpClient, input),

    /** Update a project's metadata. */
    update: (idOrName: string, input: UpdateProjectInput): Promise<Project> =>
      projectOps.update(this.httpClient, idOrName, input),

    /** Permanently delete a project (requires confirmation). */
    delete: (idOrName: string, input: DeleteProjectInput): Promise<DeleteResult> =>
      projectOps.deleteProject(this.httpClient, idOrName, input),

    /** Soft-delete a project; reversible via `restore()`. */
    softDelete: (idOrName: string, input: DeleteProjectInput): Promise<DeleteResult> =>
      projectOps.softDelete(this.httpClient, idOrName, input),

    /** Restore a soft-deleted project. */
    restore: (idOrName: string): Promise<Project> =>
      projectOps.restore(this.httpClient, idOrName),

    /** Rename a project. */
    rename: (input: RenameProjectInput): Promise<Project> =>
      projectOps.rename(this.httpClient, input),

    /** Get aggregate summary stats for a project. */
    getSummary: (idOrName: string): Promise<ProjectSummaryResponse> =>
      projectOps.getSummary(this.httpClient, idOrName),

    /** Get time-series trends for a project. */
    getTrends: (idOrName: string, query?: ProjectTrendsQuery): Promise<ProjectTrends> =>
      projectOps.getTrends(this.httpClient, idOrName, query),

    /** List a project's issues (filtered). */
    listIssues: (idOrName: string, query?: ListProjectIssuesQuery): Promise<Issue[]> =>
      projectOps.listIssues(this.httpClient, idOrName, query),

    /** List a project's issues with a total count for pagination. */
    listIssuesWithCount: (idOrName: string, query?: ListProjectIssuesQuery): Promise<PaginatedIssues> =>
      projectOps.listIssuesWithCount(this.httpClient, idOrName, query),

    /** Bulk-update the status of many issues in a project. */
    bulkUpdateIssueStatus: (idOrName: string, updates: BulkIssueStatusUpdate[]): Promise<BulkIssueStatusResult> =>
      projectOps.bulkUpdateIssueStatus(this.httpClient, idOrName, updates),

    /** Merge duplicate issues within a project. */
    mergeIssues: (idOrName: string, input: MergeIssuesInput): Promise<MergeIssuesResult> =>
      projectOps.mergeIssues(this.httpClient, idOrName, input),
  };

  // ============================================
  // RUN OPERATIONS
  // ============================================

  /** Execution run save, preview, diff, archive, and retrieval */
  readonly runs = {
    /** Save an execution run (agents, scores, recommendations). */
    save: (input: SaveRunInput, options?: { _skipClientValidation?: boolean }): Promise<SaveRunResponse> =>
      runOps.save(this.httpClient, input, options),

    /** Preview a save without persisting (dry-run). */
    validate: (input: SaveRunInput, options?: { _skipClientValidation?: boolean }): Promise<ValidateRunResponse> =>
      runOps.validate(this.httpClient, input, options),

    /** Diff two runs to surface regressions/improvements. */
    diff: (query: RunDiffQuery): Promise<RunDiffResult> =>
      runOps.diff(this.httpClient, query),

    /** Archive old runs by number/date/keep-last filter. */
    archive: (input: ArchiveRunsInput): Promise<ArchiveRunsResult> =>
      runOps.archive(this.httpClient, input),

    /** Update a run identified by project + run number. */
    update: (input: UpdateRunByNumberInput, options?: { _skipClientValidation?: boolean }): Promise<Run> =>
      runOps.update(this.httpClient, input, options),

    /** List run summaries for a project. */
    listByProject: (projectId: string, query?: ListRunsQuery): Promise<RunSummary[]> =>
      runOps.listByProject(this.httpClient, projectId, query),

    /** Get the latest run for a project (optionally by workflow type). */
    getLatest: (projectId: string, workflowType?: string): Promise<Run> =>
      runOps.getLatest(this.httpClient, projectId, workflowType),

    /** Get full details for a run (defaults to latest when runNumber omitted). */
    getDetails: (projectId: string, runNumber?: number): Promise<RunDetails> =>
      runOps.getDetails(this.httpClient, projectId, runNumber),

    /** Get a single run by its id. */
    get: (runId: string): Promise<Run> =>
      runOps.get(this.httpClient, runId),

    /** Update a run identified directly by id. */
    updateById: (runId: string, input: UpdateRunInput, options?: { _skipClientValidation?: boolean }): Promise<Run> =>
      runOps.updateById(this.httpClient, runId, input, options),

    /** Delete a run by id. */
    delete: (runId: string): Promise<DeleteResult> =>
      runOps.deleteRun(this.httpClient, runId),

    // Analysis operations (v0.3.0)
    /** Get the structured analysis attached to a run. */
    getAnalysis: (runId: string): Promise<RunAnalysis> =>
      runOps.getAnalysis(this.httpClient, runId),

    /** List analyses across a project's runs. */
    getProjectAnalysis: (projectId: string, query?: ProjectAnalysisQuery): Promise<ProjectAnalysisList> =>
      runOps.getProjectAnalysis(this.httpClient, projectId, query),

    /** Query individual analysis records across runs. */
    queryAnalysisRecords: (query?: AnalysisRecordsQuery): Promise<AnalysisRecordsList> =>
      runOps.queryAnalysisRecords(this.httpClient, query),

    /** Get per-run analysis history for a single agent. */
    getAgentRunsAnalysis: (agentName: string, query: AgentRunsAnalysisQuery): Promise<AgentRunsAnalysis> =>
      runOps.getAgentRunsAnalysis(this.httpClient, agentName, query),
  };

  // ============================================
  // ISSUE OPERATIONS
  // ============================================

  /** Issue CRUD, search, status management, notes, and bulk operations */
  readonly issues = {
    /** Create a user-submitted issue. */
    create: (input: CreateUserIssueInput): Promise<Issue> =>
      issueOps.create(this.httpClient, input),

    /** Search issues by text/filters. */
    search: (query: IssueSearchQuery): Promise<Issue[]> =>
      issueOps.search(this.httpClient, query),

    /** Get an issue by its fingerprint within a project. */
    getByFingerprint: (fingerprint: string, project: string): Promise<Issue> =>
      issueOps.getByFingerprint(this.httpClient, fingerprint, project),

    /** Update an issue's status by fingerprint + project. */
    updateStatusByFingerprint: (fingerprint: string, project: string, input: UpdateIssueStatusInput): Promise<StatusUpdateResult> =>
      issueOps.updateStatusByFingerprint(this.httpClient, fingerprint, project, input),

    /** Get an issue by id. */
    get: (issueId: string): Promise<Issue> =>
      issueOps.get(this.httpClient, issueId),

    /** Get an issue with notes and history detail. */
    getDetails: (issueId: string): Promise<IssueDetails> =>
      issueOps.getDetails(this.httpClient, issueId),

    /** Get an issue's change history. */
    getHistory: (issueId: string): Promise<IssueHistoryEnvelope> =>
      issueOps.getHistory(this.httpClient, issueId),

    /** Update an issue's status by id. */
    updateStatus: (issueId: string, input: UpdateIssueStatusInput): Promise<Issue> =>
      issueOps.updateStatus(this.httpClient, issueId, input),

    /** Update an issue's metadata by id. */
    update: (issueId: string, input: UpdateIssueInput): Promise<Issue> =>
      issueOps.update(this.httpClient, issueId, input),

    /** Add a note to an issue. */
    addNote: (issueId: string, input: CreateIssueNoteInput): Promise<IssueNote> =>
      issueOps.addNote(this.httpClient, issueId, input),

    /** Restore a soft-deleted issue. */
    restore: (issueId: string): Promise<Issue> =>
      issueOps.restore(this.httpClient, issueId),

    /** Soft-delete an active issue; reversible via `restore()`. */
    softDelete: (issueId: string): Promise<DeleteResult> =>
      issueOps.softDelete(this.httpClient, issueId),

    /** Undo the most recent change to an issue. */
    undoLastChange: (issueId: string): Promise<Issue> =>
      issueOps.undoLastChange(this.httpClient, issueId),

    /** Bulk-update issue statuses; returns `{ updated, failed }`. */
    bulkUpdateStatus: (updates: BulkStatusUpdateItem[]): Promise<BulkIssueStatusResult> =>
      issueOps.bulkUpdateStatus(this.httpClient, updates),

    /** List a project's issues by project id (filtered). */
    listByProject: (projectId: string, query?: ListIssuesQuery): Promise<Issue[]> =>
      issueOps.listByProject(this.httpClient, projectId, query),
  };

  // ============================================
  // ANALYTICS OPERATIONS
  // ============================================

  /** Agent performance, taxonomy analytics, burndown, velocity, and discovery */
  readonly analytics = {
    /** Get per-agent performance metrics. */
    getAgentPerformance: (query?: AnalyticsQuery): Promise<AgentPerformance[]> =>
      analyticsOps.getAgentPerformance(this.httpClient, query),

    /** Get agent reliability (convergence/recurrence) metrics. */
    getAgentReliability: (query?: AgentReliabilityQuery): Promise<AgentReliabilityResult> =>
      analyticsOps.getAgentReliability(this.httpClient, query),

    /** Get an agent's lifecycle timeline. */
    getAgentLifecycle: (agentName: string, query?: AnalyticsQuery): Promise<AgentLifecycleEntry[]> =>
      analyticsOps.getAgentLifecycle(this.httpClient, agentName, query),

    /** Get issue resolution-rate metrics. */
    getResolutionRates: (query?: AnalyticsQuery): Promise<ResolutionRateResult[]> =>
      analyticsOps.getResolutionRates(this.httpClient, query),

    /** Get files with the most recurring issues. */
    getFileHotspots: (query?: AnalyticsQuery): Promise<FileHotspotResult[]> =>
      analyticsOps.getFileHotspots(this.httpClient, query),

    /** Get the distribution of issues across the failure taxonomy. */
    getTaxonomyDistribution: (query?: AnalyticsQuery): Promise<TaxonomyDistributionResult[]> =>
      analyticsOps.getTaxonomyDistribution(this.httpClient, query),

    /** Get the full taxonomy analytics breakdown. */
    getFullTaxonomy: (query?: AnalyticsQuery): Promise<FullTaxonomyAnalyticsResult> =>
      analyticsOps.getFullTaxonomy(this.httpClient, query),

    /** Get issue burndown over time. */
    getBurndown: (query?: BurndownQuery): Promise<BurndownResultResponse> =>
      analyticsOps.getBurndown(this.httpClient, query),

    /** Get resolution velocity over time. */
    getVelocity: (query?: VelocityQuery): Promise<VelocityResultResponse> =>
      analyticsOps.getVelocity(this.httpClient, query),

    /** Get issue-discovery rate metrics. */
    getDiscovery: (query?: DiscoveryQuery): Promise<DiscoveryResultResponse> =>
      analyticsOps.getDiscovery(this.httpClient, query),

    /** Get the agent comparison matrix. */
    getAgentMatrix: (query?: AgentMatrixQuery): Promise<AgentMatrixResultResponse> =>
      analyticsOps.getAgentMatrix(this.httpClient, query),

    /** Get a high-level trend summary. */
    getTrendSummary: (query?: AnalyticsQuery): Promise<TrendSummaryResult[]> =>
      analyticsOps.getTrendSummary(this.httpClient, query),

    /**
     * Get analytics by metric name (generic endpoint).
     * Returns unvalidated data — use typed methods (getAgentPerformance, etc.) for validated responses.
     *
     */
    getByMetric: (metric: analyticsOps.AnalyticsMetric, query?: AnalyticsQuery): Promise<unknown> =>
      analyticsOps.getByMetric(this.httpClient, metric, query),

    /** List agents known to the analytics layer. */
    listAgents: (query?: AnalyticsQuery): Promise<AgentInfo[]> =>
      analyticsOps.listAgents(this.httpClient, query),

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
