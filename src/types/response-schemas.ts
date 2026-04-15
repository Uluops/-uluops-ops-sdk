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
  classifiedBy: z.enum(['agent', 'classifier', 'human']).nullable(),
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
  observed: z.number().int().nonnegative().optional(),
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

export const ValidateRunPreviewSchema = z.object({
  newIssues: z.array(z.object({ title: z.string(), agent: z.string() })),
  recurringIssues: z.array(z.object({ id: z.string(), title: z.string(), timesSeen: z.number() })),
  regressions: z.array(z.object({ id: z.string(), title: z.string(), lastStatus: z.string() })),
});

export const ValidateRunResponseSchema = z.object({
  wouldCreate: z.number().int().nonnegative(),
  wouldUpdate: z.number().int().nonnegative(),
  wouldRegress: z.number().int().nonnegative(),
  validationErrors: z.array(z.string()),
  preview: ValidateRunPreviewSchema,
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
  updated: z.number().int().nonnegative(),
  failed: z.array(z.string()),
});

// ============================================
// ANALYTICS RESPONSE SCHEMAS
// ============================================

export const AgentPerformanceResponseSchema = z.object({
  name: z.string(),
  totalRuns: z.number().int().nonnegative(),
  averageScore: z.number(),
  passRate: z.number(),
  totalIssuesFound: z.number().int().nonnegative(),
});

export const AgentReliabilityResponseSchema = z.object({
  name: z.string(),
  totalIssues: z.number().int().nonnegative(),
  falsePositiveRate: z.number(),
  resolutionRate: z.number(),
  avgTimeToResolveDays: z.number().nullable(),
  reliabilityScore: z.number(),
});

export const AgentReliabilityResultResponseSchema = z.object({
  agents: z.array(AgentReliabilityResponseSchema),
});

export const ResolutionRateResponseSchema = z.object({
  project: z.string(),
  totalIssues: z.number().int().nonnegative(),
  resolvedIssues: z.number().int().nonnegative(),
  resolutionRate: z.number(),
  averageTimeToResolve: z.number().nullable(),
});

export const FileHotspotResponseSchema = z.object({
  filePath: z.string(),
  totalIssues: z.number().int().nonnegative(),
  openIssues: z.number().int().nonnegative(),
  resolvedIssues: z.number().int().nonnegative(),
  topAgents: z.array(z.string()),
});

export const TaxonomyDistributionResponseSchema = z.object({
  domain: z.string(),
  count: z.number().int().nonnegative(),
  percentage: z.number(),
});

export const OutlierPointResponseSchema = z.object({
  date: z.string(),
  value: z.number(),
  direction: z.enum(['high', 'low']),
});

export const ResidualDiagnosticsResponseSchema = z.object({
  durbinWatson: z.number(),
  autocorrelation: z.enum(['none', 'positive', 'negative', 'inconclusive']),
  varianceRatio: z.number().nullable(),
  heteroscedasticity: z.enum(['constant', 'increasing', 'decreasing', 'inconclusive']),
  skewness: z.number(),
  runsTestZ: z.number(),
  assumptionScore: z.number(),
  warnings: z.array(z.string()),
});

export const DomainTrendResponseSchema = z.object({
  netChange: z.number(),
  trend: z.string(),
  avgDailyChange: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
  sampleSize: z.number().int(),
  rSquared: z.number(),
  standardError: z.number(),
  confidenceInterval: z.tuple([z.number(), z.number()]),
  outliers: z.array(OutlierPointResponseSchema),
  diagnostics: ResidualDiagnosticsResponseSchema.nullable(),
  ciReliable: z.boolean(),
  warnings: z.array(z.string()),
  weeklyPatternDetected: z.boolean(),
});

export const BurndownDataPointResponseSchema = z.object({
  date: z.string(),
  STR: z.number().int().nonnegative(),
  SEM: z.number().int().nonnegative(),
  PRA: z.number().int().nonnegative(),
  EPI: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const BurndownResultResponseSchema = z.object({
  timeSeries: z.array(BurndownDataPointResponseSchema),
  trends: z.object({
    STR: DomainTrendResponseSchema,
    SEM: DomainTrendResponseSchema,
    PRA: DomainTrendResponseSchema,
    EPI: DomainTrendResponseSchema,
  }),
});

export const VelocityItemResponseSchema = z.object({
  domain: z.string(),
  mode: z.string(),
  failureCode: z.string(),
  currentCount: z.number().int().nonnegative(),
  previousCount: z.number().int().nonnegative(),
  velocityPercent: z.number(),
  alert: z.boolean(),
  sparkline: z.array(z.number()),
  trendReliability: z.enum(['high', 'medium', 'low']),
});

export const VelocitySummaryResponseSchema = z.object({
  improving: z.array(z.string()),
  stable: z.array(z.string()),
  degrading: z.array(z.string()),
  mostImproved: z.string().nullable(),
  mostConcerning: z.string().nullable(),
});

export const VelocityResultResponseSchema = z.object({
  items: z.array(VelocityItemResponseSchema),
  summary: VelocitySummaryResponseSchema,
});

export const DiscoveryDomainBreakdownSchema = z.object({
  new: z.number().int().nonnegative(),
  recurring: z.number().int().nonnegative(),
});

export const DiscoveryTimelinePointResponseSchema = z.object({
  period: z.string(),
  newIssues: z.number().int().nonnegative(),
  recurringIssues: z.number().int().nonnegative(),
  domains: z.record(z.string(), DiscoveryDomainBreakdownSchema),
});

export const DiscoverySummaryResponseSchema = z.object({
  totalNew: z.number().int().nonnegative(),
  totalRecurring: z.number().int().nonnegative(),
  newToRecurringRatio: z.number().nullable(),
  peakNewPeriod: z.object({ period: z.string(), count: z.number() }).nullable(),
});

export const DiscoveryResultResponseSchema = z.object({
  timeline: z.array(DiscoveryTimelinePointResponseSchema),
  summary: DiscoverySummaryResponseSchema,
});

export const AgentMatrixRowResponseSchema = z.object({
  agent: z.string(),
  domains: z.record(z.string(), z.number()),
  total: z.number().int().nonnegative(),
  coverage: z.number().int().nonnegative(),
  coveragePercent: z.number(),
});

export const AgentMatrixResultResponseSchema = z.object({
  matrix: z.array(AgentMatrixRowResponseSchema),
  analysis: z.object({
    blindSpots: z.array(z.object({ agent: z.string(), missingDomains: z.array(z.string()) })),
    singlePoints: z.array(z.object({ domain: z.string(), mode: z.string(), onlyAgent: z.string() })),
    highOverlap: z.array(z.object({ mode: z.string(), agentCount: z.number(), agents: z.array(z.string()) })),
  }),
});

export const TrendSummaryResponseSchema = z.object({
  period: z.string(),
  newIssues: z.number().int().nonnegative(),
  resolvedIssues: z.number().int().nonnegative(),
  regressions: z.number().int().nonnegative(),
  averageScore: z.number(),
});

export const CrossProjectPatternResponseSchema = z.object({
  pattern: z.string(),
  projects: z.array(z.string()),
  projectCount: z.number().int().nonnegative(),
  totalOccurrences: z.number().int().nonnegative(),
  severity: z.string(),
});

export const RegressionEntryResponseSchema = z.object({
  issueId: z.string(),
  title: z.string(),
  project: z.string(),
  timesRegressed: z.number().int().nonnegative(),
  lastRegression: z.string(),
  agent: z.string(),
});

export const CostEntryResponseSchema = z.object({
  name: z.string(),
  totalRuns: z.number().int().nonnegative(),
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  totalEffectiveTokens: z.number().int().nonnegative(),
  estimatedCost: z.number(),
});

export const CategoryPerformanceResponseSchema = z.object({
  category: z.string(),
  totalIssues: z.number().int().nonnegative(),
  resolvedIssues: z.number().int().nonnegative(),
  resolutionRate: z.number(),
  avgTimeToResolveDays: z.number().nullable(),
});

export const PeriodResponseSchema = z.object({
  start: z.string(),
  end: z.string(),
  days: z.number().int().positive(),
});

export const FullTaxonomyAnalyticsResponseSchema = z.object({
  byDomain: z.array(z.object({
    domain: z.string(),
    label: z.string(),
    count: z.number().int().nonnegative(),
    percentage: z.number(),
  })),
  bySeverity: z.array(z.object({
    severity: z.string(),
    label: z.string(),
    count: z.number().int().nonnegative(),
    percentage: z.number(),
  })),
  byMode: z.array(z.object({
    mode: z.string(),
    label: z.string(),
    domain: z.string(),
    domainLabel: z.string(),
    count: z.number().int().nonnegative(),
    percentage: z.number(),
  })),
  topCodes: z.array(z.object({
    code: z.string(),
    domain: z.string(),
    mode: z.string(),
    severity: z.string(),
    label: z.string(),
    count: z.number().int().nonnegative(),
    percentage: z.number(),
  })),
  heatmapData: z.array(z.object({
    domain: z.string(),
    domainLabel: z.string(),
    mode: z.string(),
    modeLabel: z.string(),
    count: z.number().int().nonnegative(),
    percentage: z.number(),
    intensity: z.number(),
  })),
  totals: z.object({
    totalIssues: z.number().int().nonnegative(),
    classifiedIssues: z.number().int().nonnegative(),
    unclassifiedIssues: z.number().int().nonnegative(),
    classificationRate: z.number(),
  }),
  period: PeriodResponseSchema,
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

// ============================================
// TAXONOMY RESPONSE SCHEMA
// ============================================

const TaxonomyModeSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
});

const TaxonomyDomainSchema = z.object({
  code: FailureDomainResponseSchema,
  name: z.string(),
  description: z.string(),
  modes: z.array(TaxonomyModeSchema),
});

const TaxonomySeveritySchema = z.object({
  code: z.string(),
  name: z.string(),
  weight: z.number(),
});

const FailureCodePatternSchema = z.object({
  pattern: z.string(),
  format: z.string(),
  example: z.string(),
});

export const TaxonomyResponseSchema = z.object({
  domains: z.array(TaxonomyDomainSchema),
  severities: z.array(TaxonomySeveritySchema),
  priorities: z.array(z.string()),
  statuses: z.array(z.string()),
  failureCodePattern: FailureCodePatternSchema,
});

// Type exports
export type TaxonomyResponse = z.infer<typeof TaxonomyResponseSchema>;
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
