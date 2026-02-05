import { OpsHttpClient } from './http/http-client.js';
import { JwtSessionAuth } from './http/auth-strategy.js';
import * as authOps from './operations/auth.js';
import * as projectOps from './operations/projects.js';
import * as runOps from './operations/runs.js';
import * as issueOps from './operations/issues.js';
import * as analyticsOps from './operations/analytics.js';
import * as taxonomyOps from './operations/taxonomy.js';
import * as adminOps from './operations/admin.js';

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
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminSession,
  AdminApiKey,
  AdminStats,
  UserStats,
  BulkResult,
  ListUsersQuery,
  ListSessionsQuery,
  ListKeysQuery,
} from './types/auth.js';

import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  DeleteProjectInput,
  RenameProjectInput,
  ProjectSummary,
  TrendDataPoint,
  ProjectTrendsQuery,
  ListProjectIssuesQuery,
  BulkIssueStatusUpdate,
  BulkIssueStatusResult,
  MergeIssuesInput,
  MergeIssuesResult,
} from './types/projects.js';

import type {
  Run,
  SaveFeaturesListInput,
  SaveFeaturesListResponse,
  ValidateFeaturesListResponse,
  RunDiffQuery,
  RunDiffResult,
  ArchiveRunsInput,
  ArchiveRunsResult,
  UpdateRunInput,
  UpdateRunByNumberInput,
  ListRunsQuery,
  RunDetails,
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
  ValidatorPerformance,
  ValidatorReliability,
  ValidatorReliabilityQuery,
  ResolutionRate,
  FileHotspot,
  TaxonomyDistribution,
  FullTaxonomyAnalytics,
  BurndownResult,
  BurndownQuery,
  VelocityResult,
  VelocityQuery,
  DiscoveryResult,
  DiscoveryQuery,
  ValidatorMatrixResult,
  ValidatorMatrixQuery,
  TrendSummary,
  TaxonomySchema,
} from './types/analytics.js';

import type { MessageResponse, Pagination } from './types/responses.js';

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
}

/**
 * Main SDK client for ops-uluops-api
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
   * Login with email and password
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await authOps.login(this.httpClient, { email, password });
    // Update the auth strategy with new token
    const authStrategy = this.httpClient.getAuthStrategy();
    if (authStrategy instanceof JwtSessionAuth) {
      // The strategy handles token storage internally
    }
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

  readonly projects = {
    list: (): Promise<Project[]> =>
      projectOps.list(this.httpClient),

    get: (idOrName: string): Promise<Project> =>
      projectOps.get(this.httpClient, idOrName),

    create: (input: CreateProjectInput): Promise<Project> =>
      projectOps.create(this.httpClient, input),

    update: (idOrName: string, input: UpdateProjectInput): Promise<Project> =>
      projectOps.update(this.httpClient, idOrName, input),

    delete: (idOrName: string, input: DeleteProjectInput): Promise<void> =>
      projectOps.deleteProject(this.httpClient, idOrName, input),

    softDelete: (idOrName: string, input: DeleteProjectInput): Promise<void> =>
      projectOps.softDelete(this.httpClient, idOrName, input),

    restore: (idOrName: string): Promise<Project> =>
      projectOps.restore(this.httpClient, idOrName),

    rename: (input: RenameProjectInput): Promise<Project> =>
      projectOps.rename(this.httpClient, input),

    getSummary: (idOrName: string): Promise<ProjectSummary> =>
      projectOps.getSummary(this.httpClient, idOrName),

    getTrends: (idOrName: string, query?: ProjectTrendsQuery): Promise<TrendDataPoint[]> =>
      projectOps.getTrends(this.httpClient, idOrName, query),

    listIssues: (idOrName: string, query?: ListProjectIssuesQuery): Promise<Issue[]> =>
      projectOps.listIssues(this.httpClient, idOrName, query),

    bulkUpdateIssueStatus: (idOrName: string, updates: BulkIssueStatusUpdate[]): Promise<BulkIssueStatusResult[]> =>
      projectOps.bulkUpdateIssueStatus(this.httpClient, idOrName, updates),

    mergeIssues: (idOrName: string, input: MergeIssuesInput): Promise<MergeIssuesResult> =>
      projectOps.mergeIssues(this.httpClient, idOrName, input),
  };

  // ============================================
  // RUN OPERATIONS
  // ============================================

  readonly runs = {
    save: (input: SaveFeaturesListInput): Promise<SaveFeaturesListResponse> =>
      runOps.save(this.httpClient, input),

    validate: (input: SaveFeaturesListInput): Promise<ValidateFeaturesListResponse> =>
      runOps.validate(this.httpClient, input),

    diff: (query: RunDiffQuery): Promise<RunDiffResult> =>
      runOps.diff(this.httpClient, query),

    archive: (input: ArchiveRunsInput): Promise<ArchiveRunsResult> =>
      runOps.archive(this.httpClient, input),

    update: (input: UpdateRunByNumberInput): Promise<Run> =>
      runOps.update(this.httpClient, input),

    listByProject: (projectId: string, query?: ListRunsQuery): Promise<Run[]> =>
      runOps.listByProject(this.httpClient, projectId, query),

    getLatest: (projectId: string, workflowType?: string): Promise<Run> =>
      runOps.getLatest(this.httpClient, projectId, workflowType),

    getDetails: (projectId: string, runNumber?: number): Promise<RunDetails> =>
      runOps.getDetails(this.httpClient, projectId, runNumber),

    get: (runId: string): Promise<Run> =>
      runOps.get(this.httpClient, runId),

    updateById: (runId: string, input: UpdateRunInput): Promise<Run> =>
      runOps.updateById(this.httpClient, runId, input),

    delete: (runId: string): Promise<void> =>
      runOps.deleteRun(this.httpClient, runId),
  };

  // ============================================
  // ISSUE OPERATIONS
  // ============================================

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

    bulkUpdateStatus: (updates: BulkStatusUpdateItem[]): Promise<StatusUpdateResult[]> =>
      issueOps.bulkUpdateStatus(this.httpClient, updates),

    listByProject: (projectId: string, query?: ListIssuesQuery): Promise<Issue[]> =>
      issueOps.listByProject(this.httpClient, projectId, query),
  };

  // ============================================
  // ANALYTICS OPERATIONS
  // ============================================

  readonly analytics = {
    getValidatorPerformance: (query?: AnalyticsQuery): Promise<ValidatorPerformance[]> =>
      analyticsOps.getValidatorPerformance(this.httpClient, query),

    getValidatorReliability: (query?: ValidatorReliabilityQuery): Promise<{ validators: ValidatorReliability[] }> =>
      analyticsOps.getValidatorReliability(this.httpClient, query),

    getResolutionRates: (query?: AnalyticsQuery): Promise<ResolutionRate[]> =>
      analyticsOps.getResolutionRates(this.httpClient, query),

    getFileHotspots: (query?: AnalyticsQuery): Promise<FileHotspot[]> =>
      analyticsOps.getFileHotspots(this.httpClient, query),

    getTaxonomyDistribution: (query?: AnalyticsQuery): Promise<TaxonomyDistribution[]> =>
      analyticsOps.getTaxonomyDistribution(this.httpClient, query),

    getFullTaxonomy: (query?: AnalyticsQuery): Promise<{ data: FullTaxonomyAnalytics; computedAt: string }> =>
      analyticsOps.getFullTaxonomy(this.httpClient, query),

    getBurndown: (query?: BurndownQuery): Promise<BurndownResult> =>
      analyticsOps.getBurndown(this.httpClient, query),

    getVelocity: (query?: VelocityQuery): Promise<VelocityResult> =>
      analyticsOps.getVelocity(this.httpClient, query),

    getDiscovery: (query?: DiscoveryQuery): Promise<DiscoveryResult> =>
      analyticsOps.getDiscovery(this.httpClient, query),

    getValidatorMatrix: (query?: ValidatorMatrixQuery): Promise<ValidatorMatrixResult> =>
      analyticsOps.getValidatorMatrix(this.httpClient, query),

    getTrendSummary: (query?: AnalyticsQuery): Promise<TrendSummary[]> =>
      analyticsOps.getTrendSummary(this.httpClient, query),

    getByMetric: (metric: string, query?: AnalyticsQuery): Promise<unknown> =>
      analyticsOps.getByMetric(this.httpClient, metric, query),
  };

  // ============================================
  // TAXONOMY OPERATIONS
  // ============================================

  readonly taxonomy = {
    get: (): Promise<TaxonomySchema> =>
      taxonomyOps.get(this.httpClient),
  };

  // ============================================
  // ADMIN OPERATIONS
  // ============================================

  readonly admin = {
    getStats: (): Promise<AdminStats> =>
      adminOps.getStats(this.httpClient),

    listUsers: (query?: ListUsersQuery): Promise<{ users: PublicUser[]; pagination: Pagination }> =>
      adminOps.listUsers(this.httpClient, query),

    getUser: (userId: string): Promise<{ user: PublicUser; stats: UserStats }> =>
      adminOps.getUser(this.httpClient, userId),

    createUser: (input: AdminCreateUserInput): Promise<{ user: PublicUser; temporaryPassword?: string }> =>
      adminOps.createUser(this.httpClient, input),

    updateUser: (userId: string, input: AdminUpdateUserInput): Promise<{ user: PublicUser }> =>
      adminOps.updateUser(this.httpClient, userId, input),

    deactivateUser: (userId: string): Promise<{ user: PublicUser }> =>
      adminOps.deactivateUser(this.httpClient, userId),

    reactivateUser: (userId: string): Promise<{ user: PublicUser }> =>
      adminOps.reactivateUser(this.httpClient, userId),

    resetUserPassword: (userId: string): Promise<{ message: string }> =>
      adminOps.resetUserPassword(this.httpClient, userId),

    bulkDeactivate: (userIds: string[]): Promise<BulkResult> =>
      adminOps.bulkDeactivate(this.httpClient, userIds),

    listSessions: (query?: ListSessionsQuery): Promise<{ sessions: AdminSession[]; pagination: Pagination }> =>
      adminOps.listSessions(this.httpClient, query),

    terminateSession: (sessionId: string): Promise<{ message: string }> =>
      adminOps.terminateSession(this.httpClient, sessionId),

    terminateUserSessions: (userId: string): Promise<{ message: string }> =>
      adminOps.terminateUserSessions(this.httpClient, userId),

    listKeys: (query?: ListKeysQuery): Promise<{ keys: AdminApiKey[]; pagination: Pagination }> =>
      adminOps.listKeys(this.httpClient, query),

    revokeKey: (keyId: string): Promise<{ message: string }> =>
      adminOps.revokeKey(this.httpClient, keyId),
  };
}
