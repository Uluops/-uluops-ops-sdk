import { vi, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

export const BASE_URL = 'http://localhost:3100/api/v1';

beforeEach(() => {
  nock.cleanAll();
  vi.stubEnv('ULUOPS_API_KEY', 'ulr_test-api-key-12345');
});

afterEach(() => {
  vi.unstubAllEnvs();
  nock.cleanAll();
  nock.enableNetConnect();
});

/**
 * Helper to mock an API endpoint
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
