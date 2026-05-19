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
  StatusHistory,
  IssueDetails,
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
 * Main SDK client for the UluOps validation tracker API.
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
    register: (input: RegisterInput): Promise<RegisterResponse> =>
      authOps.register(this.httpClient, input),

    login: (input: LoginInput): Promise<LoginResponse> =>
      authOps.login(this.httpClient, input),

    logoutAll: (): Promise<{ sessionsRevoked: number }> =>
      authOps.logoutAll(this.httpClient),

    forgotPassword: (email: string): Promise<MessageResponse> =>
      authOps.forgotPassword(this.httpClient, email),

    resetPassword: (input: ResetPasswordInput): Promise<MessageResponse> =>
      authOps.resetPassword(this.httpClient, input),

    changePassword: (input: ChangePasswordInput): Promise<MessageResponse> =>
      authOps.changePassword(this.httpClient, input),

    setPassword: (password: string): Promise<MessageResponse> =>
      authOps.setPassword(this.httpClient, password),

    getMe: (): Promise<AuthUser> =>
      authOps.getMe(this.httpClient),

    getProfile: (): Promise<{ user: PublicUser }> =>
      authOps.getProfile(this.httpClient),

    updateProfile: (input: UpdateProfileInput): Promise<{ user: PublicUser }> =>
      authOps.updateProfile(this.httpClient, input),

    getAvatar: (): Promise<{ data: ArrayBuffer; contentType: string }> =>
      authOps.getAvatar(this.httpClient),

    deleteAvatar: (): Promise<void> =>
      authOps.deleteAvatar(this.httpClient),

    listApiKeys: (): Promise<PublicApiKey[]> =>
      authOps.listApiKeys(this.httpClient),

    createApiKey: (input?: CreateApiKeyInput): Promise<ApiKeyCreatedResponse> =>
      authOps.createApiKey(this.httpClient, input),

    revokeApiKey: (keyId: string): Promise<void> =>
      authOps.revokeApiKey(this.httpClient, keyId),

    listSessions: (): Promise<PublicSession[]> =>
      authOps.listSessions(this.httpClient),

    revokeSession: (sessionId: string): Promise<void> =>
      authOps.revokeSession(this.httpClient, sessionId),
  };

  // ============================================
  // PROJECT OPERATIONS
  // ============================================

  /** Project CRUD, summaries, trends, issue listing, and bulk operations */
  readonly projects = {
    list: (): Promise<Project[]> =>
      projectOps.list(this.httpClient),

    get: (idOrName: string): Promise<Project> =>
      projectOps.get(this.httpClient, idOrName),

    create: (input: CreateProjectInput): Promise<Project> =>
      projectOps.create(this.httpClient, input),

    update: (idOrName: string, input: UpdateProjectInput): Promise<Project> =>
      projectOps.update(this.httpClient, idOrName, input),

    delete: (idOrName: string, input: DeleteProjectInput): Promise<DeleteResult> =>
      projectOps.deleteProject(this.httpClient, idOrName, input),

    softDelete: (idOrName: string, input: DeleteProjectInput): Promise<DeleteResult> =>
      projectOps.softDelete(this.httpClient, idOrName, input),

    restore: (idOrName: string): Promise<Project> =>
      projectOps.restore(this.httpClient, idOrName),

    rename: (input: RenameProjectInput): Promise<Project> =>
      projectOps.rename(this.httpClient, input),

    getSummary: (idOrName: string): Promise<ProjectSummaryResponse> =>
      projectOps.getSummary(this.httpClient, idOrName),

    getTrends: (idOrName: string, query?: ProjectTrendsQuery): Promise<ProjectTrends> =>
      projectOps.getTrends(this.httpClient, idOrName, query),

    listIssues: (idOrName: string, query?: ListProjectIssuesQuery): Promise<Issue[]> =>
      projectOps.listIssues(this.httpClient, idOrName, query),

    listIssuesWithCount: (idOrName: string, query?: ListProjectIssuesQuery): Promise<PaginatedIssues> =>
      projectOps.listIssuesWithCount(this.httpClient, idOrName, query),

    bulkUpdateIssueStatus: (idOrName: string, updates: BulkIssueStatusUpdate[]): Promise<BulkIssueStatusResult> =>
      projectOps.bulkUpdateIssueStatus(this.httpClient, idOrName, updates),

    mergeIssues: (idOrName: string, input: MergeIssuesInput): Promise<MergeIssuesResult> =>
      projectOps.mergeIssues(this.httpClient, idOrName, input),
  };

  // ============================================
  // RUN OPERATIONS
  // ============================================

  /** Validation run save, preview, diff, archive, and retrieval */
  readonly runs = {
    save: (input: SaveRunInput, options?: { preValidated?: boolean }): Promise<SaveRunResponse> =>
      runOps.save(this.httpClient, input, options),

    validate: (input: SaveRunInput, options?: { preValidated?: boolean }): Promise<ValidateRunResponse> =>
      runOps.validate(this.httpClient, input, options),

    diff: (query: RunDiffQuery): Promise<RunDiffResult> =>
      runOps.diff(this.httpClient, query),

    archive: (input: ArchiveRunsInput): Promise<ArchiveRunsResult> =>
      runOps.archive(this.httpClient, input),

    update: (input: UpdateRunByNumberInput, options?: { preValidated?: boolean }): Promise<Run> =>
      runOps.update(this.httpClient, input, options),

    listByProject: (projectId: string, query?: ListRunsQuery): Promise<RunSummary[]> =>
      runOps.listByProject(this.httpClient, projectId, query),

    getLatest: (projectId: string, workflowType?: string): Promise<Run> =>
      runOps.getLatest(this.httpClient, projectId, workflowType),

    getDetails: (projectId: string, runNumber?: number): Promise<RunDetails> =>
      runOps.getDetails(this.httpClient, projectId, runNumber),

    get: (runId: string): Promise<Run> =>
      runOps.get(this.httpClient, runId),

    updateById: (runId: string, input: UpdateRunInput, options?: { preValidated?: boolean }): Promise<Run> =>
      runOps.updateById(this.httpClient, runId, input, options),

    delete: (runId: string): Promise<DeleteResult> =>
      runOps.deleteRun(this.httpClient, runId),

    // Analysis operations (v0.3.0)
    getAnalysis: (runId: string): Promise<RunAnalysis> =>
      runOps.getAnalysis(this.httpClient, runId),

    getProjectAnalysis: (projectId: string, query?: ProjectAnalysisQuery): Promise<ProjectAnalysisList> =>
      runOps.getProjectAnalysis(this.httpClient, projectId, query),

    queryAnalysisRecords: (query?: AnalysisRecordsQuery): Promise<AnalysisRecordsList> =>
      runOps.queryAnalysisRecords(this.httpClient, query),

    getAgentRunsAnalysis: (agentName: string, query: AgentRunsAnalysisQuery): Promise<AgentRunsAnalysis> =>
      runOps.getAgentRunsAnalysis(this.httpClient, agentName, query),
  };

  // ============================================
  // ISSUE OPERATIONS
  // ============================================

  /** Issue CRUD, search, status management, notes, and bulk operations */
  readonly issues = {
    create: (input: CreateUserIssueInput): Promise<Issue> =>
      issueOps.create(this.httpClient, input),

    search: (query: IssueSearchQuery): Promise<Issue[]> =>
      issueOps.search(this.httpClient, query),

    getByFingerprint: (fingerprint: string, project: string): Promise<Issue> =>
      issueOps.getByFingerprint(this.httpClient, fingerprint, project),

    updateStatusByFingerprint: (fingerprint: string, project: string, input: UpdateIssueStatusInput): Promise<StatusUpdateResult> =>
      issueOps.updateStatusByFingerprint(this.httpClient, fingerprint, project, input),

    get: (issueId: string): Promise<Issue> =>
      issueOps.get(this.httpClient, issueId),

    getDetails: (issueId: string): Promise<IssueDetails> =>
      issueOps.getDetails(this.httpClient, issueId),

    getHistory: (issueId: string): Promise<StatusHistory[]> =>
      issueOps.getHistory(this.httpClient, issueId),

    updateStatus: (issueId: string, input: UpdateIssueStatusInput): Promise<Issue> =>
      issueOps.updateStatus(this.httpClient, issueId, input),

    update: (issueId: string, input: UpdateIssueInput): Promise<Issue> =>
      issueOps.update(this.httpClient, issueId, input),

    addNote: (issueId: string, input: CreateIssueNoteInput): Promise<IssueNote> =>
      issueOps.addNote(this.httpClient, issueId, input),

    restore: (issueId: string): Promise<Issue> =>
      issueOps.restore(this.httpClient, issueId),

    undoLastChange: (issueId: string): Promise<Issue> =>
      issueOps.undoLastChange(this.httpClient, issueId),

    bulkUpdateStatus: (updates: BulkStatusUpdateItem[]): Promise<BulkIssueStatusResult> =>
      issueOps.bulkUpdateStatus(this.httpClient, updates),

    listByProject: (projectId: string, query?: ListIssuesQuery): Promise<Issue[]> =>
      issueOps.listByProject(this.httpClient, projectId, query),
  };

  // ============================================
  // ANALYTICS OPERATIONS
  // ============================================

  /** Agent performance, taxonomy analytics, burndown, velocity, and discovery */
  readonly analytics = {
    getAgentPerformance: (query?: AnalyticsQuery): Promise<AgentPerformance[]> =>
      analyticsOps.getAgentPerformance(this.httpClient, query),

    getAgentReliability: (query?: AgentReliabilityQuery): Promise<AgentReliabilityResult> =>
      analyticsOps.getAgentReliability(this.httpClient, query),

    getAgentLifecycle: (agentName: string, query?: AnalyticsQuery): Promise<AgentLifecycleEntry[]> =>
      analyticsOps.getAgentLifecycle(this.httpClient, agentName, query),

    getResolutionRates: (query?: AnalyticsQuery): Promise<ResolutionRateResult[]> =>
      analyticsOps.getResolutionRates(this.httpClient, query),

    getFileHotspots: (query?: AnalyticsQuery): Promise<FileHotspotResult[]> =>
      analyticsOps.getFileHotspots(this.httpClient, query),

    getTaxonomyDistribution: (query?: AnalyticsQuery): Promise<TaxonomyDistributionResult[]> =>
      analyticsOps.getTaxonomyDistribution(this.httpClient, query),

    getFullTaxonomy: (query?: AnalyticsQuery): Promise<FullTaxonomyAnalyticsResult> =>
      analyticsOps.getFullTaxonomy(this.httpClient, query),

    getBurndown: (query?: BurndownQuery): Promise<BurndownResultResponse> =>
      analyticsOps.getBurndown(this.httpClient, query),

    getVelocity: (query?: VelocityQuery): Promise<VelocityResultResponse> =>
      analyticsOps.getVelocity(this.httpClient, query),

    getDiscovery: (query?: DiscoveryQuery): Promise<DiscoveryResultResponse> =>
      analyticsOps.getDiscovery(this.httpClient, query),

    getAgentMatrix: (query?: AgentMatrixQuery): Promise<AgentMatrixResultResponse> =>
      analyticsOps.getAgentMatrix(this.httpClient, query),

    getTrendSummary: (query?: AnalyticsQuery): Promise<TrendSummaryResult[]> =>
      analyticsOps.getTrendSummary(this.httpClient, query),

    /**
     * Get analytics by metric name (generic endpoint).
     * Returns unvalidated data — use typed methods (getAgentPerformance, etc.) for validated responses.
     */
    getByMetric: (metric: analyticsOps.AnalyticsMetric, query?: AnalyticsQuery): Promise<unknown> =>
      analyticsOps.getByMetric(this.httpClient, metric, query),

    listAgents: (query?: AnalyticsQuery): Promise<AgentInfo[]> =>
      analyticsOps.listAgents(this.httpClient, query),

  };

  // ============================================
  // TAXONOMY OPERATIONS
  // ============================================

  /** Failure taxonomy schema (domains, modes, severities) */
  readonly taxonomy = {
    get: (): Promise<TaxonomyResponse> =>
      taxonomyOps.get(this.httpClient),
  };

}
