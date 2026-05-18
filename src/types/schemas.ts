import { z } from 'zod';
import {
  PRIORITIES,
  STATUSES,
  SEVERITIES,
  FAILURE_DOMAINS,
  ISSUE_TYPES,
  NOTE_TYPES,
  AVATAR_MIME_TYPES,
  FAILURE_CODE_PATTERN,
} from './enums.js';

// ============================================
// SHARED SCHEMAS
// ============================================

export const UuidSchema = z.string().uuid();

export const PrioritySchema = z.enum(PRIORITIES);
export const StatusSchema = z.enum(STATUSES);
export const SeveritySchema = z.enum(SEVERITIES);
export const FailureDomainSchema = z.enum(FAILURE_DOMAINS);
export const IssueTypeSchema = z.enum(ISSUE_TYPES);
export const NoteTypeSchema = z.enum(NOTE_TYPES);
export const AvatarMimeTypeSchema = z.enum(AVATAR_MIME_TYPES);

export const FailureCodeSchema = z.string().regex(FAILURE_CODE_PATTERN, {
  message: 'Invalid failure code format. Expected: DOMAIN-MODE/SEVERITY (e.g., SEM-VAL/H)',
});

// ============================================
// AUTH SCHEMAS
// ============================================

const PasswordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

export const RegisterInputSchema = z.object({
  email: z.string().email().max(255),
  password: PasswordSchema,
});

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const UpdateProfileInputSchema = z
  .object({
    username: z
      .string()
      .regex(/^[a-z][a-z0-9_]{2,29}$/)
      .nullish(),
    name: z.string().max(100).nullish(),
    bio: z.string().max(500).nullish(),
    timezone: z.string().nullish(),
    websiteUrl: z.string().url().max(500).nullish(),
    avatar: z.string().nullish(), // base64
    avatarMimeType: AvatarMimeTypeSchema.nullish(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string(),
  newPassword: PasswordSchema,
});

export const ResetPasswordInputSchema = z.object({
  token: z.string(),
  password: PasswordSchema,
});

export const CreateApiKeyInputSchema = z.object({
  name: z.string().max(100).optional(),
  expiresAt: z.string().datetime().optional(),
});

// ============================================
// PROJECT SCHEMAS
// ============================================

export const CreateProjectInputSchema = z.object({
  name: z.string().min(1).max(200),
});

export const UpdateProjectInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export const DeleteProjectInputSchema = z.object({
  confirm: z.literal(true),
  confirmationPhrase: z.string(),
});

export const RenameProjectInputSchema = z.object({
  oldName: z.string().min(1),
  newName: z.string().min(1).max(200),
});

// ============================================
// RUN SCHEMAS
// ============================================

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheCreationTokens: z.number().int().nonnegative().optional(),
  cacheReadTokens: z.number().int().nonnegative().optional(),
  totalEffectiveTokens: z.number().int().nonnegative().optional(),
});

export const AgentInputSchema = z.object({
  name: z.string().min(1).max(100),
  score: z.number().min(0).max(100),
  maxScore: z.number().min(0).max(100).optional(),
  decision: z.string().min(1).max(50),
  summary: z.string().max(2000).optional(),
  model: z.string().max(50).optional(),
  tokens: TokenUsageSchema.optional(),
  durationMs: z.number().int().nonnegative().optional(),
  definitionVersion: z.string().max(50).optional(),
});

export const RecommendationInputSchema = z.object({
  agent: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  priority: PrioritySchema,
  type: IssueTypeSchema.optional(),
  severity: SeveritySchema.optional(),
  failureCode: FailureCodeSchema.optional(),
  failureDomain: FailureDomainSchema.optional(),
  failureMode: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  filePath: z.string().max(1000).optional(),
  lineNumber: z.number().int().nonnegative().nullish(),
  description: z.string().max(10000).optional(),
  classificationConfidence: z.enum(['high', 'medium', 'low']).optional(),
  classifiedBy: z.enum(['agent', 'classifier', 'human']).optional(),
  secondaryFailureCodes: z.array(z.string()).optional(),
  taxonomyVersion: z.string().optional(),
});

export const SaveRunInputSchema = z.object({
  project: z.string().min(1).max(200),
  workflowType: z.string().min(1).max(100),
  agents: z.array(AgentInputSchema).min(1),
  recommendations: z.array(RecommendationInputSchema),
  timestamp: z.string().datetime().optional(),
  rawMarkdown: z.string().optional(),
  summary: z
    .object({
      allGatesPassed: z.boolean().optional(),
      averageScore: z.number().min(0).max(100).optional(),
    })
    .optional(),
  idempotencyKey: z.string().max(100).optional(),
  definitionType: z.string().max(20).optional(),
  definitionName: z.string().max(100).optional(),
  definitionVersion: z.string().max(50).optional(),
  definitionHash: z.string().max(64).optional(),
  definitionId: z.string().uuid().optional(),
  definitionMinSubscription: z.enum(['free', 'hobbyist', 'plus', 'pro', 'enterprise']).optional(),
  analysisRecords: z.array(z.object({
    recordType: z.string().min(1),
    recordId: z.string().min(1).max(20),
    title: z.string().min(1).max(500),
    classification: z.string().max(50).nullish(),
    severity: SeveritySchema.nullish(),
    data: z.record(z.string(), z.unknown()),
  })).max(100).optional(),
  analysisSummary: z.union([
    z.object({
      decision: z.string().min(1).max(50),
      score: z.number().min(0).max(100),
      decisionVocabulary: z.string().max(100).nullish(),
      systemMetrics: z.record(z.string(), z.unknown()).nullish(),
      categoryScores: z.array(z.object({
        name: z.string(),
        weight: z.number().min(1),
        score: z.number().min(0),
      })).nullish(),
      epistemicAssessment: z.record(z.string(), z.unknown()).nullish(),
      auditImplications: z.array(z.string()).nullish(),
    }),
    z.array(z.object({
      agentName: z.string().max(100).optional(),
      decision: z.string().min(1).max(50),
      score: z.number().min(0).max(100),
      decisionVocabulary: z.string().max(100).nullish(),
      systemMetrics: z.record(z.string(), z.unknown()).nullish(),
      categoryScores: z.array(z.object({
        name: z.string(),
        weight: z.number().min(1),
        score: z.number().min(0),
      })).nullish(),
      epistemicAssessment: z.record(z.string(), z.unknown()).nullish(),
      auditImplications: z.array(z.string()).nullish(),
    })).max(20),
  ]).optional(),
});

export const ArchiveRunsInputSchema = z.object({
  project: z.string().min(1),
  beforeRunNumber: z.number().int().positive().optional(),
  beforeDate: z.string().datetime().optional(),
  keepLast: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
});

// ============================================
// ISSUE SCHEMAS
// ============================================

export const CreateUserIssueInputSchema = z.object({
  project: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  priority: PrioritySchema,
  severity: SeveritySchema.optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(10000).optional(),
  filePath: z.string().max(1000).optional(),
  lineNumber: z.number().int().nonnegative().nullish(),
  failureCode: FailureCodeSchema.optional(),
  failureDomain: FailureDomainSchema.optional(),
  failureMode: z.string().max(50).optional(),
  agent: z.string().min(1).max(100).optional(),
  type: IssueTypeSchema.optional(),
});

export const UpdateIssueInputSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  status: StatusSchema.optional(),
  priority: PrioritySchema.optional(),
  severity: SeveritySchema.nullish(),
  failureCode: FailureCodeSchema.nullish(),
  failureDomain: FailureDomainSchema.nullish(),
  failureMode: z.string().max(50).nullish(),
  category: z.string().max(100).nullish(),
  type: IssueTypeSchema.nullish(),
  filePath: z.string().max(1000).nullish(),
  lineNumber: z.number().int().nonnegative().nullish(),
});

export const UpdateIssueStatusInputSchema = z.object({
  status: StatusSchema,
  reason: z.string().max(500).optional(),
});

export const CreateIssueNoteInputSchema = z.object({
  content: z.string().min(1).max(10000),
  noteType: NoteTypeSchema.optional(),
  createdBy: z.string().max(200).optional(),
});

export const BulkStatusUpdateItemSchema = z.object({
  issueId: UuidSchema.optional(),
  id: UuidSchema.optional(),
  status: StatusSchema,
  reason: z.string().max(500).optional(),
});

export const BulkStatusUpdateInputSchema = z.object({
  updates: z.array(BulkStatusUpdateItemSchema).min(1).max(100),
});

// ============================================
// QUERY SCHEMAS
// ============================================

export const ListIssuesQuerySchema = z.object({
  status: StatusSchema.optional(),
  priority: PrioritySchema.optional(),
  severity: SeveritySchema.optional(),
  failureDomain: FailureDomainSchema.optional(),
  agent: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  includeResolved: z.coerce.boolean().optional(),
  minTimesSeen: z.coerce.number().int().positive().optional(),
  dateStart: z.string().datetime().optional(),
  dateEnd: z.string().datetime().optional(),
});

export const IssueSearchQuerySchema = z.object({
  query: z.string().optional(),
  projects: z.array(z.string()).optional(),
  agents: z.array(z.string()).optional(),
  status: z.union([StatusSchema, z.literal('all')]).optional(),
  priority: z.union([PrioritySchema, z.literal('all')]).optional(),
  severities: z.array(SeveritySchema).optional(),
  failureDomains: z.array(FailureDomainSchema).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const AnalyticsQuerySchema = z.object({
  project: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const BurndownQuerySchema = AnalyticsQuerySchema.extend({
  granularity: z.enum(['daily', 'weekly']).optional(),
});

export const VelocityQuerySchema = AnalyticsQuerySchema.extend({
  alertThreshold: z.coerce.number().int().min(10).max(500).optional(),
});

export const DiscoveryQuerySchema = AnalyticsQuerySchema.extend({
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

export const AgentMatrixQuerySchema = AnalyticsQuerySchema.extend({
  minIssues: z.coerce.number().int().min(1).max(1000).optional(),
});


// NOTE: Inferred input types are exported from their respective domain files
// (e.g., RegisterInput from auth.ts, SaveRunInput from runs.ts).
// Do NOT re-export types here with the same name as the schema consts —
// it creates consumer confusion between value and type imports.
