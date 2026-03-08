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
  subscriptionTier: SubscriptionTierResponseSchema.optional(),
  username: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: DateTimeStringSchema.optional(),
  updatedAt: DateTimeStringSchema.optional(),
});

export const PublicUserResponseSchema = AuthUserResponseSchema.extend({
  avatarMimeType: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  hasAvatar: z.boolean().optional(),
});

/**
 * Login response schema.
 * The API returns `sessionToken` (preferred) but legacy clients may use `token`.
 * Both are accepted for backward compatibility; the SDK normalizes to `sessionToken`.
 */
export const LoginResponseSchema = z.object({
  user: AuthUserResponseSchema,
  sessionToken: z.string().optional(),
  token: z.string().optional(),
  expiresAt: DateTimeStringSchema.optional(),
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
  subscriptionTier: SubscriptionTierResponseSchema.optional(),
  user: AuthUserResponseSchema.optional(),
  token: z.string().optional(),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const PublicApiKeyResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  prefix: z.string().optional(),
  lastUsedAt: NullableDateTimeSchema.optional(),
  expiresAt: NullableDateTimeSchema.optional(),
  createdAt: DateTimeStringSchema,
});

export const ApiKeyCreatedResponseSchema = z.object({
  id: z.string().optional(),
  name: z.string().nullable().optional(),
  key: z.string(),
  apiKey: PublicApiKeyResponseSchema.optional(),
});

export const PublicSessionResponseSchema = z.object({
  id: z.string(),
  expiresAt: DateTimeStringSchema.optional(),
  createdAt: DateTimeStringSchema,
  lastActiveAt: DateTimeStringSchema.optional(),
  lastUsed: DateTimeStringSchema.optional(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable().optional(),
});

export const MessageResponseSchema = z.object({
  message: z.string(),
});

// ============================================
// ADMIN RESPONSE SCHEMAS
// ============================================

export const AdminStatsResponseSchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  activeUsers: z.number().int().nonnegative(),
  totalProjects: z.number().int().nonnegative().optional(),
  totalRuns: z.number().int().nonnegative().optional(),
  totalIssues: z.number().int().nonnegative().optional(),
  totalSessions: z.number().int().nonnegative().optional(),
  totalApiKeys: z.number().int().nonnegative().optional(),
  storageUsedMb: z.number().nonnegative().optional(),
});

export const PaginationResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative().optional(),
});

export const AdminUserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: UserRoleResponseSchema.optional(),
  subscriptionTier: SubscriptionTierResponseSchema.optional(),
  isActive: z.boolean().optional(),
  deactivatedAt: NullableDateTimeSchema.optional(),
  createdAt: DateTimeStringSchema.optional(),
  updatedAt: DateTimeStringSchema.optional(),
});

export const AdminSessionResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userEmail: z.string().optional(),
  userAgent: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  createdAt: DateTimeStringSchema.optional(),
  lastActiveAt: DateTimeStringSchema.optional(),
  expiresAt: DateTimeStringSchema.optional(),
});

export const AdminApiKeyResponseSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  userEmail: z.string().optional(),
  name: z.string().nullable().optional(),
  prefix: z.string().optional(),
  createdAt: DateTimeStringSchema.optional(),
  lastUsedAt: NullableDateTimeSchema.optional(),
  expiresAt: NullableDateTimeSchema.optional(),
});

// ============================================
// PROJECT RESPONSE SCHEMAS
// ============================================

export const ProjectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ownerId: z.string().uuid().optional(), // Not always returned in list views
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema.optional(),
  deletedAt: NullableDateTimeSchema.optional(),
});

export const ProjectSummaryStatsResponseSchema = z.object({
  totalIssues: z.number().int().nonnegative(),
  openIssues: z.number().int().nonnegative(),
  completedIssues: z.number().int().nonnegative().optional(),
  deferredIssues: z.number().int().nonnegative().optional(),
  wontfixIssues: z.number().int().nonnegative().optional(),
  totalRuns: z.number().int().nonnegative(),
  lastRunAt: NullableDateTimeSchema,
  averageScore: z.number().nullable().optional(),
});

export const ProjectSummaryResponseSchema = z.object({
  project: ProjectResponseSchema,
  stats: ProjectSummaryStatsResponseSchema,
});

export const TrendDataPointResponseSchema = z.object({
  date: z.string(),
  openIssues: z.number().int().nonnegative(),
  completedIssues: z.number().int().nonnegative().optional(),
  closedIssues: z.number().int().nonnegative().optional(), // Legacy field
  newIssues: z.number().int().nonnegative().optional(),
  resolvedIssues: z.number().int().nonnegative().optional(),
});

// ============================================
// ISSUE RESPONSE SCHEMAS
// ============================================

export const IssueResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  fingerprint: z.string().optional(),
  title: z.string(),
  status: StatusResponseSchema.optional(),
  priority: PriorityResponseSchema,
  severity: SeverityResponseSchema.nullable().optional(),
  failureCode: FailureCodeResponseSchema.optional(),
  failureDomain: FailureDomainResponseSchema.nullable().optional(),
  failureMode: z.string().nullable().optional(),
  failureSeverityCode: FailureSeverityCodeResponseSchema.optional(),
  category: z.string().nullable().optional(),
  validator: z.string().nullable().optional(),
  type: IssueTypeResponseSchema.nullable().optional(),
  filePath: z.string().nullable().optional(),
  lineNumber: z.number().int().nonnegative().nullable().optional(),
  timesSeen: z.number().int().positive().optional(),
  firstSeenRunId: z.string().uuid().optional(),
  lastSeenRunId: z.string().uuid().optional(),
  resolvedAt: NullableDateTimeSchema.optional(),
  resolutionRunId: z.string().uuid().nullable().optional(),
  deletedAt: NullableDateTimeSchema.optional(),
  createdAt: DateTimeStringSchema.optional(),
  updatedAt: DateTimeStringSchema.optional(),
});

export const OccurrenceResponseSchema = z.object({
  id: z.string().uuid().optional(),
  issueId: z.string().uuid().optional(),
  runId: z.string().uuid(),
  agentName: z.string().optional(),
  description: z.string().nullable().optional(),
  filePath: z.string().nullable().optional(),
  lineNumber: z.number().int().nonnegative().nullable().optional(),
  classificationConfidence: z.enum(['high', 'medium', 'low']).nullable().optional(),
  classifiedBy: z.enum(['validator', 'classifier', 'human']).nullable().optional(),
  timestamp: DateTimeStringSchema.optional(),
  createdAt: DateTimeStringSchema.optional(),
});

export const IssueNoteResponseSchema = z.object({
  id: z.string().uuid(),
  issueId: z.string().uuid().optional(),
  content: z.string(),
  noteType: NoteTypeResponseSchema,
  createdBy: z.string().nullable().optional(),
  createdAt: DateTimeStringSchema,
});

export const StatusHistoryResponseSchema = z.object({
  id: z.string().uuid().optional(),
  issueId: z.string().uuid().optional(),
  oldStatus: StatusResponseSchema.nullable().optional(),
  from: StatusResponseSchema.nullable().optional(), // Alternative field name
  newStatus: StatusResponseSchema.optional(),
  to: StatusResponseSchema.optional(), // Alternative field name
  reason: z.string().nullable().optional(),
  changedAt: DateTimeStringSchema.optional(),
  timestamp: DateTimeStringSchema.optional(), // Alternative field name
});

export const IssueDetailsResponseSchema = z.object({
  issue: IssueResponseSchema,
  occurrences: z.array(OccurrenceResponseSchema),
  notes: z.array(IssueNoteResponseSchema),
  history: z.array(StatusHistoryResponseSchema).optional(),
});

export const StatusUpdateResultResponseSchema = z.object({
  id: z.string().uuid().optional(),
  issueId: z.string().uuid().optional(),
  fingerprint: z.string().optional(),
  previousStatus: StatusResponseSchema,
  newStatus: StatusResponseSchema,
  updatedAt: DateTimeStringSchema.optional(),
  success: z.boolean().optional(),
});

// ============================================
// RUN RESPONSE SCHEMAS
// ============================================

export const RunResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  runNumber: z.number().int().positive(),
  workflowType: z.string(),
  timestamp: DateTimeStringSchema,
  allGatesPassed: z.boolean(),
  averageScore: z.number().nullable().optional(),
  rawMarkdown: z.string().nullable().optional(),
  archivedAt: NullableDateTimeSchema.optional(),
  archiveReason: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  createdAt: DateTimeStringSchema.optional(),
  updatedAt: DateTimeStringSchema.optional(),
});

export const AgentSnapshotResponseSchema = z.object({
  id: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  name: z.string(),
  score: z.number().min(0).max(100),
  maxScore: z.number().min(0).max(100).optional(),
  status: z.string(),
  model: z.string().nullable().optional(),
  inputTokens: z.number().int().nonnegative().nullable().optional(),
  outputTokens: z.number().int().nonnegative().nullable().optional(),
  cacheCreationTokens: z.number().int().nonnegative().nullable().optional(),
  cacheReadTokens: z.number().int().nonnegative().nullable().optional(),
  totalEffectiveTokens: z.number().int().nonnegative().nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  createdAt: DateTimeStringSchema.optional(),
  updatedAt: DateTimeStringSchema.optional(),
});

export const CorrelationResultResponseSchema = z.object({
  newIssues: z.number().int().nonnegative(),
  recurringIssues: z.number().int().nonnegative(),
  regressions: z.number().int().nonnegative(),
});

export const SaveFeaturesListResponseSchema = z.object({
  run: RunResponseSchema,
  validators: z.array(AgentSnapshotResponseSchema),
  correlation: CorrelationResultResponseSchema,
  deduplicated: z.boolean(),
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
  validatorChanges: z.array(AgentChangeResponseSchema),
});

export const RunDetailsResponseSchema = z.object({
  run: RunResponseSchema,
  validators: z.array(AgentSnapshotResponseSchema),
  recommendations: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    priority: PriorityResponseSchema,
    severity: SeverityResponseSchema.nullable(),
    validator: z.string(),
    status: z.string(),
    correlation: z.enum(['new', 'recurring', 'regression']),
  })),
});

// ============================================
// MERGE ISSUES RESPONSE SCHEMA
// ============================================

export const MergeIssuesResultResponseSchema = z.object({
  targetIssue: IssueResponseSchema.optional(),
  targetIssueId: z.string().uuid().optional(),
  mergedCount: z.number().int().nonnegative(),
  migratedOccurrences: z.number().int().nonnegative().optional(),
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
    details: z.record(z.unknown()).optional(),
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
export type AdminStatsResponse = z.infer<typeof AdminStatsResponseSchema>;
export type AdminUserResponseData = z.infer<typeof AdminUserResponseSchema>;
