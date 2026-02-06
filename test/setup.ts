import { vi, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { resetMockIds } from './contract-helpers.js';

export const BASE_URL = 'http://localhost:3100/api/v1';
export const TEST_API_KEY = 'ulr_test-api-key-12345';
export const TEST_API_KEY_SHORT = 'ulr_test-key';
export const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';

beforeEach(() => {
  nock.cleanAll();
  nock.disableNetConnect();
  resetMockIds();
  vi.stubEnv('ULUOPS_API_KEY', TEST_API_KEY);
});

afterEach(() => {
  // Capture unconsumed interceptors before cleanup.
  // If a mock was registered but not called, it means the SDK sent a different
  // request than expected (wrong URL, method, query params, or body).
  const pending = nock.pendingMocks();

  vi.unstubAllEnvs();
  nock.cleanAll();
  nock.enableNetConnect();

  if (pending.length > 0) {
    throw new Error(
      `Unconsumed nock interceptors (request mismatch?):\n  ${pending.join('\n  ')}`
    );
  }
});

/**
 * Helper to mock an API endpoint
 * @deprecated Use mockValidatedEndpoint from contract-helpers.ts for schema validation
 */
export function mockEndpoint(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  response: unknown,
  statusCode = 200
): nock.Scope {
  return nock(BASE_URL)[method](path).reply(statusCode, response);
}

/**
 * Helper to mock an error response
 * @deprecated Use mockValidatedError from contract-helpers.ts for schema validation
 */
export function mockError(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  statusCode: number,
  errorCode: string,
  message: string
): nock.Scope {
  return nock(BASE_URL)[method](path).reply(statusCode, {
    error: {
      code: errorCode,
      message,
    },
  });
}

// Re-export contract helpers for convenience
export {
  createMockProject,
  createMockIssue,
  createMockRun,
  createMockValidatorSnapshot,
  createMockProjectSummary,
  createMockTrendDataPoint,
  createMockOccurrence,
  createMockIssueNote,
  createMockStatusHistory,
  createMockIssueDetails,
  createMockBulkStatusUpdateResult,
  createMockMergeIssuesResult,
  createMockStatusUpdateResult,
  mockValidatedEndpoint,
  mockValidatedListEndpoint,
  mockValidatedError,
  assertMatchesSchema,
  assertValidApiResponse,
  integration,
  INTEGRATION_TEST_CONFIG,
  ProjectResponseSchema,
  IssueResponseSchema,
  RunResponseSchema,
} from './contract-helpers.js';
