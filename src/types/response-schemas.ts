/**
 * Response Zod schemas for contract validation
 *
 * These schemas validate API response shapes to ensure mock data in tests
 * matches the actual API contract. This prevents false confidence from
 * tests that pass with incorrect mock shapes.
 */
import { z } from 'zod';
import {
  PRIORITIES,
  STATUSES,
  SEVERITIES,
  FAILURE_DOMAINS,
  ISSUE_TYPES,
  NOTE_TYPES,
  USER_ROLES,
  SUBSCRIPTION_TIERS,
  FAILURE_CODE_PATTERN,
} from './enums.js';

// ============================================
// SHARED RESPONSE SCHEMAS
// ============================================

export const DateTimeStringSchema = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/));
export const NullableDateTimeSchema = DateTimeStringSchema.nullable();

export const PriorityResponseSchema = z.enum(PRIORITIES);
export const StatusResponseSchema = z.enum(STATUSES);
export const SeverityResponseSchema = z.enum(SEVERITIES);
export const FailureDomainResponseSchema = z.enum(FAILURE_DOMAINS);
export const IssueTypeResponseSchema = z.enum(ISSUE_TYPES);
export const NoteTypeResponseSchema = z.enum(NOTE_TYPES);
export const UserRoleResponseSchema = z.enum(USER_ROLES);
export const SubscriptionTierResponseSchema = z.enum(SUBSCRIPTION_TIERS);

export const FailureCodeResponseSchema = z.string().regex(FAILURE_CODE_PATTERN).nullable();
export const FailureSeverityCodeResponseSchema = z.enum(['C', 'H', 'M', 'L', 'I']).nullable();

// ============================================
// AUTH RESPONSE SCHEMAS
// ============================================

export const AuthUserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: UserRoleResponseSchema,
  subscriptionTier: SubscriptionTierResponseSchema,
  username: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const PublicUserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: UserRoleResponseSchema,
  subscriptionTier: SubscriptionTierResponseSchema,
  username: z.string().nullable(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  timezone: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  avatarMimeType: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp']).nullable(),
  isActive: z.boolean(),
  hasAvatar: z.boolean(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

/**
 * Login response schema.
 * The API returns `sessionToken` (preferred) but legacy clients may use `token`.
 * Both are accepted for backward compatibility; the SDK normalizes to `sessionToken`.
 */
export const LoginResponseSchema = z.object({
  user: AuthUserResponseSchema,
  sessionToken: z.string(),
  token: z.string().optional(),              // Legacy field
  expiresAt: DateTimeStringSchema,
});

/**
 * Register response schema.
 * Guaranteed fields: id, email, role, createdAt, updatedAt.
 * The `user` and `token` fields are included for API variants that return them.
 */
export const RegisterResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  isActive: z.boolean(),
  role: UserRoleResponseSchema,
  subscriptionTier: SubscriptionTierResponseSchema,
  user: AuthUserResponseSchema.optional(),
  token: z.string().optional(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const PublicApiKeyResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  prefix: z.string().optional(),
  lastUsedAt: NullableDateTimeSchema,
  expiresAt: NullableDateTimeSchema,
  createdAt: DateTimeStringSchema,
});

export const ApiKeyCreatedResponseSchema = z.object({
  key: z.string(),
  apiKey: PublicApiKeyResponseSchema,
});

export const PublicSessionResponseSchema = z.object({
  id: z.string(),
  expiresAt: DateTimeStringSchema,
  createdAt: DateTimeStringSchema,
  lastActiveAt: DateTimeStringSchema,
  lastUsed: DateTimeStringSchema.optional(),  // Alternative field name
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
});

export const MessageResponseSchema = z.object({
  message: z.string(),
});

export const PaginationResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative().optional(),
});

// ============================================
// PROJECT RESPONSE SCHEMAS
// ============================================

export const ProjectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  domain: z.string().optional(),
  ownerId: z.string().uuid(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const ProjectSummaryStatsResponseSchema = z.object({
  totalRuns: z.number().int().nonnegative(),
  totalIssues: z.number().int().nonnegative(),
  openIssues: z.number().int().nonnegative(),
  criticalIssues: z.number().int().nonnegative(),
  latestRunNumber: z.number().int().positive().nullable(),
  latestRunDate: NullableDateTimeSchema,
});

export const ProjectSummaryResponseSchema = z.object({
  project: ProjectResponseSchema,
  stats: ProjectSummaryStatsResponseSchema,
});

export const DailyIssueCountsResponseSchema = z.object({
  date: z.string(),
  total: z.number().int().nonnegative(),
  critical: z.number().int().nonnegative(),
  new: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
});

export const TrendsSummaryResponseSchema = z.object({
  averageNew: z.number(),
  averageResolved: z.number(),
  netChange: z.number(),
  trendDirection: z.enum(['improving', 'stable', 'worsening']),
});

export const ProjectTrendsResponseSchema = z.object({
  project: ProjectResponseSchema,
  days: z.number().int().positive(),
  daily: z.array(DailyIssueCountsResponseSchema),
  summary: TrendsSummaryResponseSchema,
});

/** @deprecated Use DailyIssueCountsResponseSchema — kept for contract-helpers compat */
export const TrendDataPointResponseSchema = DailyIssueCountsResponseSchema;

// ============================================
// ISSUE RESPONSE SCHEMAS
// ============================================

export const IssueResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  fingerprint: z.string(),
  title: z.string(),
  status: StatusResponseSchema,
  priority: PriorityResponseSchema,
  severity: SeverityResponseSchema.nullable(),
  failureCode: FailureCodeResponseSchema,
  failureDomain: FailureDomainResponseSchema.nullable(),
  failureMode: z.string().nullable(),
  failureSeverityCode: FailureSeverityCodeResponseSchema,
  category: z.string().nullable(),
  agent: z.string().nullable(),
  type: IssueTypeResponseSchema.nullable(),
  filePath: z.string().nullable(),
  lineNumber: z.number().int().nonnegative().nullable(),
  timesSeen: z.number().int().positive(),
  firstSeenRunId: z.string().uuid(),
  lastSeenRunId: z.string().uuid(),
  resolvedAt: NullableDateTimeSchema,
  resolutionRunId: z.string().uuid().nullable(),
  deletedAt: NullableDateTimeSchema.optional(),  // Stripped by issueToPublic
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const OccurrenceResponseSchema = z.object({
  id: z.string().uuid(),
  issueId: z.string().uuid(),
  runId: z.string().uuid(),
  agentName: z.string(),
  description: z.string().nullable(),
  filePath: z.string().nullable(),
  lineNumber: z.number().int().nonnegative().nullable(),
  classificationConfidence: z.enum(['high', 'medium', 'low']).nullable(),
  classifiedBy: z.enum(['validator', 'classifier', 'human']).nullable(),
  createdAt: DateTimeStringSchema,
});

export const IssueNoteResponseSchema = z.object({
  id: z.string().uuid(),
  issueId: z.string().uuid(),
  content: z.string(),
  noteType: NoteTypeResponseSchema,
  createdBy: z.string().nullable(),
  createdAt: DateTimeStringSchema,
});

export const StatusHistoryResponseSchema = z.object({
  id: z.string().uuid(),
  issueId: z.string().uuid(),
  oldStatus: StatusResponseSchema.nullable(),
  from: StatusResponseSchema.nullable().optional(), // Alternative field name
  newStatus: StatusResponseSchema,
  to: StatusResponseSchema.optional(),              // Alternative field name
  reason: z.string().nullable(),
  changedAt: DateTimeStringSchema,
  timestamp: DateTimeStringSchema.optional(),       // Alternative field name
});

export const IssueDetailsResponseSchema = z.object({
  issue: IssueResponseSchema,
  occurrences: z.array(OccurrenceResponseSchema),
  notes: z.array(IssueNoteResponseSchema),
  history: z.array(StatusHistoryResponseSchema),
});

export const StatusUpdateResultResponseSchema = z.object({
  id: z.string().uuid(),
  issueId: z.string().uuid().optional(),
  fingerprint: z.string(),
  previousStatus: StatusResponseSchema,
  newStatus: StatusResponseSchema,
  updatedAt: DateTimeStringSchema,
  success: z.boolean().optional(),
});

// ============================================
// RUN RESPONSE SCHEMAS
// ============================================

export const RunResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),               // Always present (NOT NULL in DB)
  runNumber: z.number().int().positive(),
  workflowType: z.string(),
  timestamp: DateTimeStringSchema,
  allGatesPassed: z.boolean(),
  averageScore: z.number().nullable(),
  rawMarkdown: z.string().nullable(),
  archivedAt: NullableDateTimeSchema,
  archiveReason: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  definitionType: z.string().nullable(),       // Nullable in DB
  definitionName: z.string().nullable(),       // Nullable in DB
  definitionVersion: z.string().nullable(),    // Nullable in DB
  definitionHash: z.string().nullable(),       // Nullable in DB
  registrySyncedAt: NullableDateTimeSchema,    // Nullable in DB
  createdAt: DateTimeStringSchema,             // Always present (NOT NULL in DB)
  updatedAt: DateTimeStringSchema,             // Always present (NOT NULL in DB)
});

/** Run summary schema for list endpoints — enriched with aggregate fields, omits detail-only fields */
export const RunSummaryResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  runNumber: z.number().int().positive(),
  workflowType: z.string(),
  timestamp: DateTimeStringSchema,
  allGatesPassed: z.boolean(),
  averageScore: z.number().nullable().optional(),
  archivedAt: NullableDateTimeSchema.optional(),
  archiveReason: z.string().nullable().optional(),
  createdAt: DateTimeStringSchema,
  // Aggregate fields computed by getRunsSummary query
  totalRecommendations: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  suggestedCount: z.number().int().nonnegative(),
  backlogCount: z.number().int().nonnegative(),
  agentScores: z.record(z.string(), z.number()),
});

export const AgentSnapshotResponseSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  name: z.string(),
  score: z.number().min(0).max(100),
  maxScore: z.number().min(0).max(100),
  decision: z.string(),
  model: z.string().nullable(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  cacheCreationTokens: z.number().int().nonnegative().nullable(),
  cacheReadTokens: z.number().int().nonnegative().nullable(),
  totalEffectiveTokens: z.number().int().nonnegative().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const CorrelationResultResponseSchema = z.object({
  newIssues: z.number().int().nonnegative(),
  recurringIssues: z.number().int().nonnegative(),
  regressions: z.number().int().nonnegative(),
});

export const SaveRunResponseSchema = z.object({
  run: RunResponseSchema,
  agents: z.array(AgentSnapshotResponseSchema),
  correlation: CorrelationResultResponseSchema,
  deduplicated: z.boolean(),
  analysisRecords: z.lazy(() => z.array(AnalysisRecordResponseSchema)).optional(),
  analysisSummary: z.lazy(() => AnalysisSummaryResponseSchema).optional(),
});

export const DiffIssueRefResponseSchema = z.object({
  issueId: z.string().uuid(),
  title: z.string(),
});

export const AgentChangeResponseSchema = z.object({
  name: z.string(),
  baseScore: z.number(),
  compareScore: z.number(),
  change: z.number(),
});

export const RunDiffResultResponseSchema = z.object({
  baseRun: RunResponseSchema,
  compareRun: RunResponseSchema,
  fixed: z.array(DiffIssueRefResponseSchema),
  new: z.array(DiffIssueRefResponseSchema),
  unchanged: z.array(DiffIssueRefResponseSchema),
  agentChanges: z.array(AgentChangeResponseSchema),
});

export const RunDetailsResponseSchema = z.object({
  run: RunResponseSchema,
  agents: z.array(AgentSnapshotResponseSchema),
  recommendations: z.array(z.object({
    issueId: z.string().uuid(),
    title: z.string(),
    priority: PriorityResponseSchema,
    agent: z.string(),
    status: z.string(),
  })),
});

export const ValidateRunResponseSchema = z.object({
  wouldCreate: z.number().int().nonnegative(),
  wouldUpdate: z.number().int().nonnegative(),
  wouldRegress: z.number().int().nonnegative(),
  validationErrors: z.array(z.string()),
  preview: CorrelationResultResponseSchema,
});

export const ArchiveRunsResultResponseSchema = z.object({
  archived: z.number().int().nonnegative(),
});

export const DeleteResultResponseSchema = z.object({
  deleted: z.literal(true),
});

/** Analysis record returned by getAnalysis / queryAnalysisRecords */
export const AnalysisRecordResponseSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  agentName: z.string(),
  agentType: z.string(),
  recordType: z.string(),
  recordId: z.string(),
  title: z.string(),
  classification: z.string().nullable(),
  severity: z.string().nullable(),
  recordData: z.record(z.string(), z.unknown()),
  createdAt: DateTimeStringSchema,
});

/** Analysis summary returned by getProjectAnalysis */
export const AnalysisSummaryResponseSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  agentName: z.string(),
  agentType: z.string(),
  decision: z.string(),
  score: z.number().min(0).max(100),
  decisionVocabulary: z.string().nullable(),
  systemMetrics: z.record(z.string(), z.unknown()).nullable(),
  categoryScores: z.array(z.object({
    name: z.string(),
    weight: z.number(),
    score: z.number(),
  })).nullable(),
  epistemicAssessment: z.record(z.string(), z.unknown()).nullable(),
  auditImplications: z.array(z.string()).nullable(),
  createdAt: DateTimeStringSchema,
});

/** Full analysis response for a single run */
export const RunAnalysisResponseSchema = z.object({
  records: z.array(AnalysisRecordResponseSchema),
  summaries: z.array(AnalysisSummaryResponseSchema),
  total: z.number().int().nonnegative(),
});

/** Paginated analysis summaries response (getProjectAnalysis) */
export const ProjectAnalysisListResponseSchema = z.object({
  data: z.array(AnalysisSummaryResponseSchema),
  total: z.number().int().nonnegative(),
});

/** Paginated analysis records response (queryAnalysisRecords) */
export const AnalysisRecordsListResponseSchema = z.object({
  data: z.array(AnalysisRecordResponseSchema),
  total: z.number().int().nonnegative(),
});

// ============================================
// MERGE ISSUES RESPONSE SCHEMA
// ============================================

export const MergeIssuesResultResponseSchema = z.object({
  targetIssue: IssueResponseSchema.optional(),
  targetIssueId: z.string().uuid(),
  mergedCount: z.number().int().nonnegative(),
  migratedOccurrences: z.number().int().nonnegative(),
  sourceIssues: z.array(z.string().uuid()).optional(),
});

// ============================================
// BULK UPDATE RESPONSE SCHEMAS
// ============================================

export const BulkStatusUpdateResultResponseSchema = z.object({
  issueId: z.string().uuid(),
  success: z.boolean(),
  error: z.string().optional(),
  previousStatus: StatusResponseSchema.optional(),
  newStatus: StatusResponseSchema.optional(),
});

// ============================================
// ERROR RESPONSE SCHEMAS
// ============================================

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

// ============================================
// WRAPPED RESPONSE SCHEMAS
// ============================================

/**
 * Generic API response wrapper
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    message: z.string().optional(),
  });
}

/**
 * Generic list response wrapper
 */
export function createListResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    count: z.number().int().nonnegative().optional(),
  });
}

// Pre-built wrapped schemas for common responses
export const ProjectListResponseSchema = createListResponseSchema(ProjectResponseSchema);
export const IssueListResponseSchema = createListResponseSchema(IssueResponseSchema);
export const TrendListResponseSchema = createListResponseSchema(TrendDataPointResponseSchema);
export const BulkStatusUpdateListResponseSchema = createListResponseSchema(BulkStatusUpdateResultResponseSchema);
export const StatusHistoryListResponseSchema = createListResponseSchema(StatusHistoryResponseSchema);

export const ProjectApiResponseSchema = createApiResponseSchema(ProjectResponseSchema);
export const IssueApiResponseSchema = createApiResponseSchema(IssueResponseSchema);
export const IssueDetailsApiResponseSchema = createApiResponseSchema(IssueDetailsResponseSchema);
export const IssueNoteApiResponseSchema = createApiResponseSchema(IssueNoteResponseSchema);
export const ProjectSummaryApiResponseSchema = createApiResponseSchema(ProjectSummaryResponseSchema);
export const MergeIssuesApiResponseSchema = createApiResponseSchema(MergeIssuesResultResponseSchema);
export const StatusUpdateApiResponseSchema = createApiResponseSchema(StatusUpdateResultResponseSchema);

// Type exports
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type IssueResponse = z.infer<typeof IssueResponseSchema>;
export type RunResponse = z.infer<typeof RunResponseSchema>;
export type AgentSnapshotResponse = z.infer<typeof AgentSnapshotResponseSchema>;
/** @deprecated Use AgentSnapshotResponse instead */
export type ValidatorSnapshotResponse = AgentSnapshotResponse;
/** @deprecated Use AgentSnapshotResponseSchema instead */
export const ValidatorSnapshotResponseSchema = AgentSnapshotResponseSchema;
/** @deprecated Use AgentChangeResponseSchema instead */
export const ValidatorChangeResponseSchema = AgentChangeResponseSchema;
export type OccurrenceResponse = z.infer<typeof OccurrenceResponseSchema>;
export type IssueNoteResponse = z.infer<typeof IssueNoteResponseSchema>;
export type StatusHistoryResponse = z.infer<typeof StatusHistoryResponseSchema>;
export type AuthUserResponse = z.infer<typeof AuthUserResponseSchema>;
export type PublicUserResponse = z.infer<typeof PublicUserResponseSchema>;
export type LoginResponseData = z.infer<typeof LoginResponseSchema>;
export type RegisterResponseData = z.infer<typeof RegisterResponseSchema>;
export type PublicApiKeyResponse = z.infer<typeof PublicApiKeyResponseSchema>;
export type PublicSessionResponse = z.infer<typeof PublicSessionResponseSchema>;
