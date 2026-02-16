/**
 * Contract Test Helpers
 *
 * These utilities ensure mock data in tests matches the actual API contract,
 * preventing false confidence from tests that pass with incorrect mock shapes.
 *
 * Key features:
 * - Mock data factories that produce schema-validated responses
 * - Assertion utilities for validating mock shapes
 * - Integration test helpers for optional live API testing
 */
import { z } from 'zod';
import nock from 'nock';
import {
  ProjectResponseSchema,
  IssueResponseSchema,
  RunResponseSchema,
  ValidatorSnapshotResponseSchema,
  ProjectSummaryResponseSchema,
  ProjectSummaryStatsResponseSchema,
  TrendDataPointResponseSchema,
  OccurrenceResponseSchema,
  IssueNoteResponseSchema,
  StatusHistoryResponseSchema,
  MergeIssuesResultResponseSchema,
  BulkStatusUpdateResultResponseSchema,
  StatusUpdateResultResponseSchema,
  IssueDetailsResponseSchema,
  ErrorResponseSchema,
  AuthUserResponseSchema,
  LoginResponseSchema,
  RegisterResponseSchema,
  PublicApiKeyResponseSchema,
  ApiKeyCreatedResponseSchema,
  PublicSessionResponseSchema,
  MessageResponseSchema,
  AdminStatsResponseSchema,
  AdminUserResponseSchema,
  AdminSessionResponseSchema,
  AdminApiKeyResponseSchema,
  PaginationResponseSchema,
  PublicUserResponseSchema,
  createApiResponseSchema,
  createListResponseSchema,
} from '../src/types/response-schemas.js';
import type { Priority, Status, Severity, FailureDomain, NoteType, UserRole, SubscriptionTier } from '../src/types/enums.js';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Environment variable to enable strict contract validation
 * Set to 'false' to disable (useful for debugging)
 */
const STRICT_CONTRACTS = process.env.STRICT_CONTRACTS !== 'false';

/**
 * Enable integration tests against live API
 * Set INTEGRATION_TEST_API_URL and INTEGRATION_TEST_API_KEY to enable
 */
export const INTEGRATION_TEST_CONFIG = {
  enabled: Boolean(process.env.INTEGRATION_TEST_API_URL && process.env.INTEGRATION_TEST_API_KEY),
  apiUrl: process.env.INTEGRATION_TEST_API_URL ?? '',
  apiKey: process.env.INTEGRATION_TEST_API_KEY ?? '',
};

// ============================================
// MOCK DATA FACTORIES
// ============================================

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `00000000-0000-0000-0000-${String(idCounter).padStart(12, '0')}`;
}

function generateFingerprint(): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function isoDate(daysAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

/**
 * Reset ID counter between test files
 */
export function resetMockIds(): void {
  idCounter = 0;
}

/**
 * Factory for creating valid Project response data
 */
export function createMockProject(overrides: Partial<z.infer<typeof ProjectResponseSchema>> = {}) {
  const data = {
    id: generateId(),
    name: `Project ${idCounter}`,
    ownerId: generateId(),
    createdAt: isoDate(30),
    updatedAt: isoDate(1),
    deletedAt: null,
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = ProjectResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock project data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid Issue response data
 */
export function createMockIssue(overrides: Partial<z.infer<typeof IssueResponseSchema>> = {}) {
  const data = {
    id: generateId(),
    projectId: generateId(),
    fingerprint: generateFingerprint(),
    title: `Issue ${idCounter}`,
    status: 'open' as Status,
    priority: 'suggested' as Priority,
    severity: null,
    failureCode: null,
    failureDomain: null,
    failureMode: null,
    failureSeverityCode: null,
    category: null,
    validator: 'test-validator',
    type: null,
    filePath: null,
    lineNumber: null,
    timesSeen: 1,
    firstSeenRunId: generateId(),
    lastSeenRunId: generateId(),
    resolvedAt: null,
    resolutionRunId: null,
    deletedAt: null,
    createdAt: isoDate(7),
    updatedAt: isoDate(1),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = IssueResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock issue data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid Run response data
 */
export function createMockRun(overrides: Partial<z.infer<typeof RunResponseSchema>> = {}) {
  const data = {
    id: generateId(),
    projectId: generateId(),
    runNumber: idCounter,
    workflowType: 'post-implementation',
    timestamp: isoDate(1),
    allGatesPassed: true,
    averageScore: 85,
    rawMarkdown: null,
    archivedAt: null,
    archiveReason: null,
    idempotencyKey: null,
    createdAt: isoDate(1),
    updatedAt: isoDate(1),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = RunResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock run data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid ValidatorSnapshot response data
 */
export function createMockValidatorSnapshot(
  overrides: Partial<z.infer<typeof ValidatorSnapshotResponseSchema>> = {}
) {
  const data = {
    id: generateId(),
    runId: generateId(),
    name: 'code-validator',
    score: 85,
    maxScore: 100,
    status: 'PASS',
    model: 'sonnet',
    inputTokens: 1000,
    outputTokens: 500,
    cacheCreationTokens: null,
    cacheReadTokens: 800,
    totalEffectiveTokens: 700,
    durationMs: 5000,
    createdAt: isoDate(1),
    updatedAt: isoDate(1),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = ValidatorSnapshotResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock validator snapshot data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid ProjectSummary response data
 */
export function createMockProjectSummary(
  overrides: Partial<{
    project?: z.infer<typeof ProjectResponseSchema>;
    stats?: Partial<z.infer<typeof ProjectSummaryStatsResponseSchema>>;
    // Flat overrides for convenience (mapped into stats)
    totalIssues?: number;
    openIssues?: number;
    completedIssues?: number;
    deferredIssues?: number;
    wontfixIssues?: number;
    totalRuns?: number;
    lastRunAt?: string | null;
    averageScore?: number | null;
  }> = {}
) {
  const { project, stats, ...flatOverrides } = overrides;
  const data = {
    project: project ?? createMockProject(),
    stats: {
      totalIssues: 100,
      openIssues: 25,
      completedIssues: 50,
      deferredIssues: 15,
      wontfixIssues: 10,
      totalRuns: 50,
      lastRunAt: isoDate(1),
      averageScore: 85,
      ...flatOverrides,
      ...stats,
    },
  };

  if (STRICT_CONTRACTS) {
    const result = ProjectSummaryResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock project summary data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid TrendDataPoint response data
 */
export function createMockTrendDataPoint(
  overrides: Partial<z.infer<typeof TrendDataPointResponseSchema>> = {}
) {
  const data = {
    date: isoDate(0).split('T')[0],
    openIssues: 10,
    completedIssues: 5,
    newIssues: 2,
    resolvedIssues: 3,
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = TrendDataPointResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock trend data point: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid Occurrence response data
 */
export function createMockOccurrence(
  overrides: Partial<z.infer<typeof OccurrenceResponseSchema>> = {}
) {
  const data = {
    id: generateId(),
    issueId: generateId(),
    runId: generateId(),
    validator: 'code-validator',
    description: 'Found an issue',
    filePath: 'src/example.ts',
    lineNumber: 42,
    classificationConfidence: null,
    classifiedBy: null,
    createdAt: isoDate(1),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = OccurrenceResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock occurrence data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid IssueNote response data
 */
export function createMockIssueNote(
  overrides: Partial<z.infer<typeof IssueNoteResponseSchema>> = {}
) {
  const data = {
    id: generateId(),
    issueId: generateId(),
    content: 'This is a note',
    noteType: 'context' as NoteType,
    createdBy: null,
    createdAt: isoDate(1),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = IssueNoteResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock issue note data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid StatusHistory response data
 */
export function createMockStatusHistory(
  overrides: Partial<z.infer<typeof StatusHistoryResponseSchema>> = {}
) {
  const data = {
    id: generateId(),
    issueId: generateId(),
    oldStatus: null,
    from: null,
    newStatus: 'open' as Status,
    to: 'open' as Status,
    reason: null,
    changedAt: isoDate(1),
    timestamp: isoDate(1),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = StatusHistoryResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock status history data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid IssueDetails response data
 */
export function createMockIssueDetails(
  overrides: Partial<z.infer<typeof IssueDetailsResponseSchema>> = {}
) {
  const issueId = generateId();
  const data = {
    issue: createMockIssue({ id: issueId }),
    occurrences: [createMockOccurrence({ issueId })],
    notes: [createMockIssueNote({ issueId })],
    history: [createMockStatusHistory({ issueId })],
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = IssueDetailsResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock issue details data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid BulkStatusUpdateResult response data
 */
export function createMockBulkStatusUpdateResult(
  overrides: Partial<z.infer<typeof BulkStatusUpdateResultResponseSchema>> = {}
) {
  const data = {
    issueId: generateId(),
    success: true,
    previousStatus: 'open' as Status,
    newStatus: 'completed' as Status,
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = BulkStatusUpdateResultResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock bulk status update result data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid MergeIssuesResult response data
 */
export function createMockMergeIssuesResult(
  overrides: Partial<z.infer<typeof MergeIssuesResultResponseSchema>> = {}
) {
  const data = {
    targetIssue: createMockIssue(),
    targetIssueId: generateId(),
    mergedCount: 2,
    migratedOccurrences: 5,
    sourceIssues: [generateId(), generateId()],
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = MergeIssuesResultResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock merge issues result data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid StatusUpdateResult response data
 */
export function createMockStatusUpdateResult(
  overrides: Partial<z.infer<typeof StatusUpdateResultResponseSchema>> = {}
) {
  const data = {
    id: generateId(),
    issueId: generateId(),
    fingerprint: generateFingerprint(),
    previousStatus: 'open' as Status,
    newStatus: 'completed' as Status,
    updatedAt: isoDate(0),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = StatusUpdateResultResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock status update result data: ${result.error.message}`);
    }
  }

  return data;
}

// ============================================
// AUTH MOCK FACTORIES
// ============================================

/**
 * Factory for creating valid AuthUser response data
 */
export function createMockAuthUser(overrides: Partial<z.infer<typeof AuthUserResponseSchema>> = {}) {
  const data = {
    id: generateId(),
    email: `user${idCounter}@example.com`,
    role: 'developer' as UserRole,
    subscriptionTier: 'free' as SubscriptionTier,
    username: null,
    name: null,
    bio: null,
    timezone: null,
    websiteUrl: null,
    avatarUrl: null,
    createdAt: isoDate(30),
    updatedAt: isoDate(1),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = AuthUserResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock auth user data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid PublicUser response data
 */
export function createMockPublicUser(overrides: Partial<z.infer<typeof PublicUserResponseSchema>> = {}) {
  const data = {
    ...createMockAuthUser(),
    avatarMimeType: null,
    isActive: true,
    hasAvatar: false,
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = PublicUserResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock public user data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid LoginResponse data
 */
export function createMockLoginResponse(overrides: Partial<z.infer<typeof LoginResponseSchema>> = {}) {
  const data = {
    user: createMockAuthUser(),
    token: `jwt-token-${idCounter}`,
    expiresAt: isoDate(-1), // 1 day in future
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = LoginResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock login response data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid RegisterResponse data
 */
export function createMockRegisterResponse(overrides: Partial<z.infer<typeof RegisterResponseSchema>> = {}) {
  const data = {
    id: generateId(),
    user: createMockAuthUser(),
    token: `jwt-token-${idCounter}`,
    email: `user${idCounter}@example.com`,
    isActive: true,
    role: 'developer' as const,
    createdAt: isoDate(),
    updatedAt: isoDate(),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = RegisterResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock register response data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid PublicApiKey response data
 */
export function createMockPublicApiKey(overrides: Partial<z.infer<typeof PublicApiKeyResponseSchema>> = {}) {
  const data = {
    id: generateId(),
    name: `Key ${idCounter}`,
    prefix: `ulr_${idCounter}`,
    lastUsedAt: null,
    expiresAt: null,
    createdAt: isoDate(7),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = PublicApiKeyResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock public API key data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid ApiKeyCreated response data
 */
export function createMockApiKeyCreated(overrides: Partial<z.infer<typeof ApiKeyCreatedResponseSchema>> = {}) {
  const data = {
    key: `ulr_full-secret-key-${idCounter}`,
    apiKey: createMockPublicApiKey(),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = ApiKeyCreatedResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock API key created data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid PublicSession response data
 */
export function createMockPublicSession(overrides: Partial<z.infer<typeof PublicSessionResponseSchema>> = {}) {
  const data = {
    id: generateId(),
    expiresAt: isoDate(-7),
    createdAt: isoDate(14),
    lastActiveAt: isoDate(0),
    userAgent: 'Chrome/120.0',
    ipAddress: null,
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = PublicSessionResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock public session data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid MessageResponse data
 */
export function createMockMessage(message: string) {
  const data = { message };

  if (STRICT_CONTRACTS) {
    const result = MessageResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock message data: ${result.error.message}`);
    }
  }

  return data;
}

// ============================================
// ADMIN MOCK FACTORIES
// ============================================

/**
 * Factory for creating valid AdminStats response data
 */
export function createMockAdminStats(overrides: Partial<z.infer<typeof AdminStatsResponseSchema>> = {}) {
  const data = {
    totalUsers: 150,
    activeUsers: 120,
    totalProjects: 75,
    totalRuns: 5000,
    totalIssues: 15000,
    totalSessions: 200,
    totalApiKeys: 50,
    storageUsedMb: 2500,
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = AdminStatsResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock admin stats data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid AdminUser response data
 */
export function createMockAdminUser(overrides: Partial<z.infer<typeof AdminUserResponseSchema>> = {}) {
  const data = {
    id: generateId(),
    email: `user${idCounter}@example.com`,
    role: 'developer' as UserRole,
    subscriptionTier: 'free' as SubscriptionTier,
    isActive: true,
    deactivatedAt: null,
    createdAt: isoDate(30),
    updatedAt: isoDate(1),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = AdminUserResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock admin user data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid AdminSession response data
 */
export function createMockAdminSession(overrides: Partial<z.infer<typeof AdminSessionResponseSchema>> = {}) {
  const data = {
    id: generateId(),
    userId: generateId(),
    userEmail: `user${idCounter}@example.com`,
    userAgent: 'Chrome/120.0',
    ipAddress: null,
    createdAt: isoDate(7),
    lastActiveAt: isoDate(0),
    expiresAt: isoDate(-7),
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = AdminSessionResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock admin session data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid AdminApiKey response data
 */
export function createMockAdminApiKey(overrides: Partial<z.infer<typeof AdminApiKeyResponseSchema>> = {}) {
  const data = {
    id: generateId(),
    userId: generateId(),
    userEmail: `user${idCounter}@example.com`,
    name: `Key ${idCounter}`,
    prefix: `ulr_${idCounter}`,
    createdAt: isoDate(7),
    lastUsedAt: null,
    expiresAt: null,
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = AdminApiKeyResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock admin API key data: ${result.error.message}`);
    }
  }

  return data;
}

/**
 * Factory for creating valid Pagination response data
 */
export function createMockPagination(overrides: Partial<z.infer<typeof PaginationResponseSchema>> = {}) {
  const data = {
    total: 10,
    page: 1,
    limit: 20,
    totalPages: 1,
    ...overrides,
  };

  if (STRICT_CONTRACTS) {
    const result = PaginationResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid mock pagination data: ${result.error.message}`);
    }
  }

  return data;
}

// ============================================
// NOCK HELPERS WITH CONTRACT VALIDATION
// ============================================

/**
 * Create a validated nock mock that ensures response shape matches schema
 */
export function mockValidatedEndpoint<T extends z.ZodTypeAny>(
  baseUrl: string,
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  responseData: unknown,
  schema: T,
  statusCode = 200
): nock.Scope {
  // Validate response data against schema
  if (STRICT_CONTRACTS) {
    const wrappedSchema = createApiResponseSchema(schema);
    const wrapped = { data: responseData };
    const result = wrappedSchema.safeParse(wrapped);
    if (!result.success) {
      throw new Error(
        `Mock response for ${method.toUpperCase()} ${path} does not match schema:\n${result.error.message}`
      );
    }
  }

  return nock(baseUrl)[method](path).reply(statusCode, { data: responseData });
}

/**
 * Create a validated nock mock for list endpoints
 */
export function mockValidatedListEndpoint<T extends z.ZodTypeAny>(
  baseUrl: string,
  method: 'get' | 'post',
  path: string,
  responseData: unknown[],
  itemSchema: T,
  statusCode = 200
): nock.Scope {
  // Validate each item in the list
  if (STRICT_CONTRACTS) {
    const listSchema = createListResponseSchema(itemSchema);
    const result = listSchema.safeParse({ data: responseData });
    if (!result.success) {
      throw new Error(
        `Mock list response for ${method.toUpperCase()} ${path} does not match schema:\n${result.error.message}`
      );
    }
  }

  return nock(baseUrl)[method](path).reply(statusCode, { data: responseData });
}

/**
 * Create a validated error response mock
 */
export function mockValidatedError(
  baseUrl: string,
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  statusCode: number,
  errorCode: string,
  message: string,
  details?: Record<string, unknown>
): nock.Scope {
  const errorResponse = {
    error: {
      code: errorCode,
      message,
      ...(details && { details }),
    },
  };

  if (STRICT_CONTRACTS) {
    const result = ErrorResponseSchema.safeParse(errorResponse);
    if (!result.success) {
      throw new Error(`Invalid error response shape: ${result.error.message}`);
    }
  }

  return nock(baseUrl)[method](path).reply(statusCode, errorResponse);
}

// ============================================
// ASSERTION UTILITIES
// ============================================

/**
 * Assert that data matches a schema
 */
export function assertMatchesSchema<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T,
  context?: string
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = context
      ? `${context} does not match schema:\n${result.error.message}`
      : `Data does not match schema:\n${result.error.message}`;
    throw new Error(message);
  }
  return result.data;
}

/**
 * Assert that API response wrapper is valid
 */
export function assertValidApiResponse<T extends z.ZodTypeAny>(
  response: unknown,
  dataSchema: T,
  context?: string
): z.infer<T> {
  const wrapped = createApiResponseSchema(dataSchema);
  const result = wrapped.safeParse(response);
  if (!result.success) {
    const message = context
      ? `${context} API response invalid:\n${result.error.message}`
      : `API response invalid:\n${result.error.message}`;
    throw new Error(message);
  }
  return result.data.data;
}

// ============================================
// INTEGRATION TEST UTILITIES
// ============================================

/**
 * Skip test if integration tests are not enabled
 */
export function skipIfNoIntegration(): void {
  if (!INTEGRATION_TEST_CONFIG.enabled) {
    // Using console.log since this is called at test definition time
    console.log('Skipping integration test - INTEGRATION_TEST_API_URL not set');
  }
}

/**
 * Get describe/it functions that auto-skip integration tests
 */
export const integration = {
  /**
   * Use instead of describe() for integration test suites
   */
  describe: (name: string, fn: () => void) => {
    if (INTEGRATION_TEST_CONFIG.enabled) {
      return describe(name, fn);
    }
    return describe.skip(name, fn);
  },

  /**
   * Use instead of it() for individual integration tests
   */
  it: (name: string, fn: () => Promise<void> | void) => {
    if (INTEGRATION_TEST_CONFIG.enabled) {
      return it(name, fn);
    }
    return it.skip(name, fn);
  },
};

// ============================================
// RESPONSE SCHEMA EXPORTS (for direct use)
// ============================================

export {
  ProjectResponseSchema,
  IssueResponseSchema,
  RunResponseSchema,
  ValidatorSnapshotResponseSchema,
  ProjectSummaryResponseSchema,
  TrendDataPointResponseSchema,
  OccurrenceResponseSchema,
  IssueNoteResponseSchema,
  StatusHistoryResponseSchema,
  MergeIssuesResultResponseSchema,
  BulkStatusUpdateResultResponseSchema,
  StatusUpdateResultResponseSchema,
  IssueDetailsResponseSchema,
  ErrorResponseSchema,
  AuthUserResponseSchema,
  LoginResponseSchema,
  RegisterResponseSchema,
  PublicApiKeyResponseSchema,
  ApiKeyCreatedResponseSchema,
  PublicSessionResponseSchema,
  MessageResponseSchema,
  AdminStatsResponseSchema,
  AdminUserResponseSchema,
  AdminSessionResponseSchema,
  AdminApiKeyResponseSchema,
  PaginationResponseSchema,
  PublicUserResponseSchema,
  createApiResponseSchema,
  createListResponseSchema,
};
