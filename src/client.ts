import { OpsHttpClient } from './http/http-client.js';
import { JwtSessionAuth } from './http/auth-strategy.js';
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
  MergeIssuesInput,
  MergeIssuesResult,
} from './types/projects.js';

import type { z } from 'zod';
import type {
  Run,
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
} from './types/runs.js';
import type {
  RunSummaryResponseSchema,
  RunAnalysisResponseSchema,
  ProjectAnalysisListResponseSchema,
  AnalysisRecordsListResponseSchema,
} from './types/response-schemas.js';

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
  AgentInfo,
  AgentReliabilityQuery,
  BurndownQuery,
  VelocityQuery,
  DiscoveryQuery,
  AgentMatrixQuery,
  TaxonomySchema,
} from './types/analytics.js';

import type { MessageResponse, DeleteResult } from './types/responses.js';

/**
 * OpsClient configuration options
 */
export interface OpsClientConfig {
  /** API key for authentication (preferred) */
  apiKey?: string;
  /** Email for session-based auth */
  email?: string;
  /** Password for session-based auth */
  password?: string;
  /** Existing session token */
  sessionToken?: string;
  /** API base URL (defaults to localhost:3100) */
  baseUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Number of retries for transient errors */
  retries?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Callback when session token is refreshed */
  onTokenRefresh?: (token: string) => void;
  /** Org slug for multi-tenancy — sets X-Org-Slug header on all requests */
  orgSlug?: string;
}

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

  constructor(config: OpsClientConfig = {}) {
    this.httpClient = new OpsHttpClient(config);
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
   * Logout current session (all sessions)
   */
  async logout(): Promise<{ sessionsRevoked: number }> {
    return authOps.logoutAll(this.httpClient);
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    const authStrategy = this.httpClient.getAuthStrategy();
    return authStrategy?.isAuthenticated() ?? false;
  }

  /**
   * Get authentication type
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

    bulkUpdateIssueStatus: (idOrName: string, updates: BulkIssueStatusUpdate[]) =>
      projectOps.bulkUpdateIssueStatus(this.httpClient, idOrName, updates),

    mergeIssues: (idOrName: string, input: MergeIssuesInput): Promise<MergeIssuesResult> =>
      projectOps.mergeIssues(this.httpClient, idOrName, input),
  };

  // ============================================
  // RUN OPERATIONS
  // ============================================

  /** Validation run save, preview, diff, archive, and retrieval */
  readonly runs = {
    save: (input: SaveRunInput): Promise<SaveRunResponse> =>
      runOps.save(this.httpClient, input),

    validate: (input: SaveRunInput): Promise<ValidateRunResponse> =>
      runOps.validate(this.httpClient, input),

    diff: (query: RunDiffQuery): Promise<RunDiffResult> =>
      runOps.diff(this.httpClient, query),

    archive: (input: ArchiveRunsInput): Promise<ArchiveRunsResult> =>
      runOps.archive(this.httpClient, input),

    update: (input: UpdateRunByNumberInput): Promise<Run> =>
      runOps.update(this.httpClient, input),

    listByProject: (projectId: string, query?: ListRunsQuery): Promise<z.infer<typeof RunSummaryResponseSchema>[]> =>
      runOps.listByProject(this.httpClient, projectId, query),

    getLatest: (projectId: string, workflowType?: string): Promise<Run> =>
      runOps.getLatest(this.httpClient, projectId, workflowType),

    getDetails: (projectId: string, runNumber?: number): Promise<RunDetails> =>
      runOps.getDetails(this.httpClient, projectId, runNumber),

    get: (runId: string): Promise<Run> =>
      runOps.get(this.httpClient, runId),

    updateById: (runId: string, input: UpdateRunInput): Promise<Run> =>
      runOps.updateById(this.httpClient, runId, input),

    delete: (runId: string): Promise<DeleteResult> =>
      runOps.deleteRun(this.httpClient, runId),

    // Analysis operations (v0.3.0)
    getAnalysis: (runId: string): Promise<z.infer<typeof RunAnalysisResponseSchema>> =>
      runOps.getAnalysis(this.httpClient, runId),

    getProjectAnalysis: (projectId: string, query?: ProjectAnalysisQuery): Promise<z.infer<typeof ProjectAnalysisListResponseSchema>> =>
      runOps.getProjectAnalysis(this.httpClient, projectId, query),

    queryAnalysisRecords: (query?: AnalysisRecordsQuery): Promise<z.infer<typeof AnalysisRecordsListResponseSchema>> =>
      runOps.queryAnalysisRecords(this.httpClient, query),
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

    edit: (issueId: string, input: UpdateIssueInput): Promise<Issue> =>
      issueOps.edit(this.httpClient, issueId, input),

    addNote: (issueId: string, input: CreateIssueNoteInput): Promise<IssueNote> =>
      issueOps.addNote(this.httpClient, issueId, input),

    restore: (issueId: string): Promise<Issue> =>
      issueOps.restore(this.httpClient, issueId),

    undoLastChange: (issueId: string): Promise<Issue> =>
      issueOps.undoLastChange(this.httpClient, issueId),

    bulkUpdateStatus: (updates: BulkStatusUpdateItem[]) =>
      issueOps.bulkUpdateStatus(this.httpClient, updates),

    listByProject: (projectId: string, query?: ListIssuesQuery): Promise<Issue[]> =>
      issueOps.listByProject(this.httpClient, projectId, query),
  };

  // ============================================
  // ANALYTICS OPERATIONS
  // ============================================

  /** Agent performance, taxonomy analytics, burndown, velocity, and discovery */
  readonly analytics = {
    getAgentPerformance: (query?: AnalyticsQuery) =>
      analyticsOps.getAgentPerformance(this.httpClient, query),

    getAgentReliability: (query?: AgentReliabilityQuery) =>
      analyticsOps.getAgentReliability(this.httpClient, query),

    getResolutionRates: (query?: AnalyticsQuery) =>
      analyticsOps.getResolutionRates(this.httpClient, query),

    getFileHotspots: (query?: AnalyticsQuery) =>
      analyticsOps.getFileHotspots(this.httpClient, query),

    getTaxonomyDistribution: (query?: AnalyticsQuery) =>
      analyticsOps.getTaxonomyDistribution(this.httpClient, query),

    getFullTaxonomy: (query?: AnalyticsQuery) =>
      analyticsOps.getFullTaxonomy(this.httpClient, query),

    getBurndown: (query?: BurndownQuery) =>
      analyticsOps.getBurndown(this.httpClient, query),

    getVelocity: (query?: VelocityQuery) =>
      analyticsOps.getVelocity(this.httpClient, query),

    getDiscovery: (query?: DiscoveryQuery) =>
      analyticsOps.getDiscovery(this.httpClient, query),

    getAgentMatrix: (query?: AgentMatrixQuery) =>
      analyticsOps.getAgentMatrix(this.httpClient, query),

    getTrendSummary: (query?: AnalyticsQuery) =>
      analyticsOps.getTrendSummary(this.httpClient, query),

    getByMetric: (metric: analyticsOps.AnalyticsMetric, query?: AnalyticsQuery) =>
      analyticsOps.getByMetric(this.httpClient, metric, query),

    listAgents: (query?: AnalyticsQuery): Promise<AgentInfo[]> =>
      analyticsOps.listAgents(this.httpClient, query),

    // Backwards-compatible aliases
    /** @deprecated Use getAgentPerformance instead */
    getValidatorPerformance: (query?: AnalyticsQuery) =>
      analyticsOps.getAgentPerformance(this.httpClient, query),
    /** @deprecated Use getAgentReliability instead */
    getValidatorReliability: (query?: AgentReliabilityQuery) =>
      analyticsOps.getAgentReliability(this.httpClient, query),
    /** @deprecated Use getAgentMatrix instead */
    getValidatorMatrix: (query?: AgentMatrixQuery) =>
      analyticsOps.getAgentMatrix(this.httpClient, query),
    /** @deprecated Use listAgents instead */
    listValidators: (query?: AnalyticsQuery): Promise<AgentInfo[]> =>
      analyticsOps.listAgents(this.httpClient, query),
  };

  // ============================================
  // TAXONOMY OPERATIONS
  // ============================================

  /** Failure taxonomy schema (domains, modes, severities) */
  readonly taxonomy = {
    get: (): Promise<TaxonomySchema> =>
      taxonomyOps.get(this.httpClient),
  };

}
