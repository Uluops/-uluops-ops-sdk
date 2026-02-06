import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../src/http/http-client.js';
import {
  OpsApiError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ServiceUnavailableError,
} from '../src/errors/errors.js';
import {
  ApiKeyAuth,
  JwtSessionAuth,
  createAuthStrategy,
} from '../src/http/auth-strategy.js';
import { BASE_URL, TEST_API_KEY, TEST_API_KEY_SHORT } from './setup.js';

describe('OpsHttpClient', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: TEST_API_KEY,
    });
  });

  describe('constructor', () => {
    it('should create client with API key', () => {
      const c = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: TEST_API_KEY_SHORT,
      });
      const authStrategy = c.getAuthStrategy();
      expect(authStrategy?.isAuthenticated()).toBe(true);
      expect(authStrategy?.getType()).toBe('api_key');
    });

    it('should create client without credentials', () => {
      const c = new OpsHttpClient({ baseUrl: BASE_URL });
      expect(c.getAuthStrategy()).toBeNull();
    });

    it('should reject invalid API key format', () => {
      expect(() => {
        new OpsHttpClient({
          baseUrl: BASE_URL,
          apiKey: 'invalid-key', // Missing ulr_ prefix
        });
      }).toThrow('Invalid API key format');
    });

    it('should reject API key with wrong prefix', () => {
      expect(() => {
        new OpsHttpClient({
          baseUrl: BASE_URL,
          apiKey: 'api_some-key',
        });
      }).toThrow('Invalid API key format');
    });

    it('should reject whitespace-only API key', () => {
      expect(() => {
        new OpsHttpClient({
          baseUrl: BASE_URL,
          apiKey: '   ',
        });
      }).toThrow();
    });

    it('should reject API key with prefix as substring but not at start', () => {
      expect(() => {
        new OpsHttpClient({
          baseUrl: BASE_URL,
          apiKey: 'xulr_some-key',
        });
      }).toThrow('Invalid API key format');
    });
  });

  describe('GET requests', () => {
    it('should make GET request and return data', async () => {
      nock(BASE_URL)
        .get('/projects')
        .reply(200, { data: [{ id: '1', name: 'test' }] });

      const result = await client.get<{ id: string; name: string }[]>('/projects');

      expect(result).toEqual([{ id: '1', name: 'test' }]);
    });

    it('should include query parameters', async () => {
      nock(BASE_URL)
        .get('/projects')
        .query({ limit: 10, status: 'active' })
        .reply(200, { data: [] });

      const result = await client.get('/projects', { limit: 10, status: 'active' });

      expect(result).toEqual([]);
    });

    it('should include Authorization header', async () => {
      nock(BASE_URL)
        .get('/projects')
        .matchHeader('Authorization', `Bearer ${TEST_API_KEY}`)
        .reply(200, { data: [] });

      await client.get('/projects');
    });
  });

  describe('POST requests', () => {
    it('should make POST request with body', async () => {
      nock(BASE_URL)
        .post('/projects', { name: 'new-project' })
        .reply(201, { data: { id: '123', name: 'new-project' } });

      const result = await client.post('/projects', { name: 'new-project' });

      expect(result).toEqual({ id: '123', name: 'new-project' });
    });
  });

  describe('PATCH requests', () => {
    it('should make PATCH request with body', async () => {
      nock(BASE_URL)
        .patch('/projects/123', { name: 'updated' })
        .reply(200, { data: { id: '123', name: 'updated' } });

      const result = await client.patch('/projects/123', { name: 'updated' });

      expect(result).toEqual({ id: '123', name: 'updated' });
    });
  });

  describe('DELETE requests', () => {
    it('should make DELETE request', async () => {
      nock(BASE_URL)
        .delete('/projects/123')
        .reply(200, { data: { deleted: true } });

      const result = await client.delete('/projects/123');

      expect(result).toEqual({ deleted: true });
    });
  });

  describe('error handling', () => {
    it('should throw ValidationError for 400 with message', async () => {
      nock(BASE_URL).get('/projects').reply(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });

      try {
        await client.get('/projects');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain('Invalid input');
        expect((error as ValidationError).statusCode).toBe(400);
      }
    });

    it('should throw UnauthorizedError for 401 with message', async () => {
      nock(BASE_URL).get('/projects').reply(401, {
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
      });

      try {
        await client.get('/projects');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedError);
        expect((error as UnauthorizedError).message).toContain('Invalid token');
        expect((error as UnauthorizedError).statusCode).toBe(401);
      }
    });

    it('should throw NotFoundError for 404 with message', async () => {
      nock(BASE_URL).get('/projects/999').reply(404, {
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });

      try {
        await client.get('/projects/999');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
        expect((error as NotFoundError).message).toContain('Project not found');
        expect((error as NotFoundError).statusCode).toBe(404);
      }
    });

    it('should throw RateLimitError for 429', async () => {
      // Use a client with 1 retry since 429 is retryable (1 means only 1 attempt)
      const noRetryClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: TEST_API_KEY,
        retries: 1,
      });

      nock(BASE_URL).get('/projects').reply(429, {
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });

      await expect(noRetryClient.get('/projects')).rejects.toThrow(RateLimitError);
    });

    it('should include error details', async () => {
      nock(BASE_URL).get('/projects').reply(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: { field: 'name', reason: 'required' },
        },
      });

      try {
        await client.get('/projects');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as OpsApiError).details).toEqual({
          field: 'name',
          reason: 'required',
        });
      }
    });
  });

  describe('retry logic', () => {
    it('should retry on 503 errors', async () => {
      // First request fails with 503
      nock(BASE_URL).get('/projects').reply(503, {
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Try again' },
      });

      // Second request succeeds
      nock(BASE_URL).get('/projects').reply(200, { data: [] });

      const result = await client.get('/projects');

      expect(result).toEqual([]);
      // Verify both interceptors were consumed (1 retry + 1 success = 2 requests)
      expect(nock.isDone()).toBe(true);
    });

    it('should not retry on 400 errors', async () => {
      nock(BASE_URL).get('/projects').reply(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Bad request' },
      });

      await expect(client.get('/projects')).rejects.toThrow(ValidationError);
      // Verify only 1 request was made (no retry for 400)
      expect(nock.isDone()).toBe(true);
    });

    it('should give up after max retries', async () => {
      // All requests fail with 503 — default client has 3 retries
      nock(BASE_URL).get('/projects').times(3).reply(503, {
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Down' },
      });

      await expect(client.get('/projects')).rejects.toThrow(OpsApiError);
      // Verify all 3 retry attempts were made
      expect(nock.isDone()).toBe(true);
    }, 15000);

    it('should respect custom retry count', async () => {
      const customClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: TEST_API_KEY_SHORT,
        retries: 1,
      });

      // Only 1 interceptor — retries: 1 means only 1 attempt total
      nock(BASE_URL).get('/projects').reply(503, {
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Down' },
      });

      await expect(customClient.get('/projects')).rejects.toThrow(OpsApiError);
      // Verify exactly 1 request was made (retries: 1 = 1 attempt)
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('requestRaw', () => {
    it('should return raw response without unwrapping data', async () => {
      nock(BASE_URL).get('/raw-endpoint').reply(200, { custom: 'response' });

      const result = await client.requestRaw('GET', '/raw-endpoint');

      expect(result).toEqual({ custom: 'response' });
    });
  });

  describe('malformed response handling', () => {
    it('should handle response without data wrapper gracefully', async () => {
      // Some endpoints return data directly without { data: ... } wrapper
      nock(BASE_URL).get('/direct').reply(200, { id: '1', name: 'test' });

      // requestRaw handles this - returns the raw response
      const result = await client.requestRaw('GET', '/direct');
      expect(result).toEqual({ id: '1', name: 'test' });
    });

    it('should handle 200 with empty data wrapper', async () => {
      nock(BASE_URL).delete('/resource/1').reply(200, { data: undefined });

      const result = await client.delete('/resource/1');
      expect(result).toBeUndefined();
    });

    it('should handle null data in response', async () => {
      nock(BASE_URL).get('/nullable').reply(200, { data: null });

      const result = await client.get('/nullable');
      expect(result).toBeNull();
    });

    it('should throw on invalid JSON response', async () => {
      nock(BASE_URL).get('/invalid').reply(200, 'not json', {
        'Content-Type': 'text/plain',
      });

      await expect(client.get('/invalid')).rejects.toThrow();
    });
  });

  describe('authentication header consistency', () => {
    it('should include Authorization header on POST requests', async () => {
      nock(BASE_URL)
        .post('/projects')
        .matchHeader('Authorization', `Bearer ${TEST_API_KEY}`)
        .reply(201, { data: { id: '1' } });

      await client.post('/projects', { name: 'test' });
    });

    it('should include Authorization header on PATCH requests', async () => {
      nock(BASE_URL)
        .patch('/projects/1')
        .matchHeader('Authorization', `Bearer ${TEST_API_KEY}`)
        .reply(200, { data: { id: '1' } });

      await client.patch('/projects/1', { name: 'updated' });
    });

    it('should include Authorization header on PUT requests', async () => {
      nock(BASE_URL)
        .put('/projects/1')
        .matchHeader('Authorization', `Bearer ${TEST_API_KEY}`)
        .reply(200, { data: { id: '1' } });

      await client.put('/projects/1', { name: 'replaced' });
    });

    it('should include Authorization header on DELETE requests', async () => {
      nock(BASE_URL)
        .delete('/projects/1')
        .matchHeader('Authorization', `Bearer ${TEST_API_KEY}`)
        .reply(200, { data: { deleted: true } });

      await client.delete('/projects/1');
    });

    it('should not include Authorization header when no credentials', async () => {
      const unauthClient = new OpsHttpClient({ baseUrl: BASE_URL });

      nock(BASE_URL)
        .get('/public')
        .matchHeader('Authorization', (val) => val === undefined)
        .reply(200, { data: [] });

      await unauthClient.get('/public');
    });

    it('should fail with UnauthorizedError when accessing protected endpoint without auth', async () => {
      const unauthClient = new OpsHttpClient({ baseUrl: BASE_URL });

      nock(BASE_URL)
        .get('/projects')
        .matchHeader('Authorization', (val) => val === undefined)
        .reply(401, {
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });

      await expect(unauthClient.get('/projects')).rejects.toThrow(UnauthorizedError);
    });

    it('should include Content-Type header on all requests', async () => {
      nock(BASE_URL)
        .get('/projects')
        .matchHeader('Content-Type', 'application/json')
        .reply(200, { data: [] });

      await client.get('/projects');
    });
  });

  describe('network error handling', () => {
    it('should throw TimeoutError when request times out', async () => {
      const timeoutClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: TEST_API_KEY_SHORT,
        timeout: 100,
        retries: 1,
      });

      nock(BASE_URL).get('/slow').delay(200).reply(200, { data: [] });

      await expect(timeoutClient.get('/slow')).rejects.toThrow(TimeoutError);
    });

    it('should succeed when response arrives before timeout', async () => {
      const timeoutClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: TEST_API_KEY_SHORT,
        timeout: 500,
        retries: 1,
      });

      nock(BASE_URL).get('/fast').delay(50).reply(200, { data: { ok: true } });

      const result = await timeoutClient.get('/fast');
      expect(result).toEqual({ ok: true });
    });

    it('should throw TimeoutError with very small timeout', async () => {
      const tinyTimeoutClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: TEST_API_KEY_SHORT,
        timeout: 1,
        retries: 1,
      });

      nock(BASE_URL).get('/tiny-timeout').delay(100).reply(200, { data: [] });

      await expect(tinyTimeoutClient.get('/tiny-timeout')).rejects.toThrow(TimeoutError);
    });

    it('should include timeout value in TimeoutError details', async () => {
      const timeoutMs = 150;
      const timeoutClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: TEST_API_KEY_SHORT,
        timeout: timeoutMs,
        retries: 1,
      });

      nock(BASE_URL).get('/timeout-details').delay(300).reply(200, { data: [] });

      try {
        await timeoutClient.get('/timeout-details');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).message).toContain(`${timeoutMs}ms`);
      }
    });

    it('should throw NetworkError on connection refused', async () => {
      const badClient = new OpsHttpClient({
        baseUrl: 'http://localhost:59999', // Port that nothing listens on
        apiKey: TEST_API_KEY_SHORT,
        retries: 1,
      });

      await expect(badClient.get('/test')).rejects.toThrow();
    });

    it('should throw ServiceUnavailableError for 502 Bad Gateway', async () => {
      const noRetryClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: TEST_API_KEY_SHORT,
        retries: 1,
      });

      nock(BASE_URL).get('/gateway').reply(502, {
        error: { message: 'Bad Gateway' },
      });

      await expect(noRetryClient.get('/gateway')).rejects.toThrow(ServiceUnavailableError);
    });

    it('should throw ServiceUnavailableError for 504 Gateway Timeout', async () => {
      const noRetryClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: TEST_API_KEY_SHORT,
        retries: 1,
      });

      nock(BASE_URL).get('/timeout').reply(504, {
        error: { message: 'Gateway Timeout' },
      });

      await expect(noRetryClient.get('/timeout')).rejects.toThrow(ServiceUnavailableError);
    });
  });

  describe('retry behavior', () => {
    it('should retry on 502 errors', async () => {
      nock(BASE_URL).get('/retry502').reply(502, {
        error: { message: 'Bad Gateway' },
      });
      nock(BASE_URL).get('/retry502').reply(200, { data: { ok: true } });

      const result = await client.get('/retry502');
      expect(result).toEqual({ ok: true });
      expect(nock.isDone()).toBe(true);
    });

    it('should retry on 504 errors', async () => {
      nock(BASE_URL).get('/retry504').reply(504, {
        error: { message: 'Gateway Timeout' },
      });
      nock(BASE_URL).get('/retry504').reply(200, { data: { ok: true } });

      const result = await client.get('/retry504');
      expect(result).toEqual({ ok: true });
      expect(nock.isDone()).toBe(true);
    });

    it('should retry on 429 rate limit errors', async () => {
      nock(BASE_URL).get('/rate').reply(429, {
        error: { code: 'RATE_LIMITED', message: 'Rate limited' },
      });
      nock(BASE_URL).get('/rate').reply(200, { data: { ok: true } });

      const result = await client.get('/rate');
      expect(result).toEqual({ ok: true });
      expect(nock.isDone()).toBe(true);
    });

    it('should not retry on 401 Unauthorized', async () => {
      // Client without refreshable auth
      const staticClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: TEST_API_KEY_SHORT,
        retries: 3,
      });

      // Only set up one mock - if it retries, it would fail
      nock(BASE_URL).get('/auth').reply(401, {
        error: { code: 'UNAUTHORIZED', message: 'Invalid' },
      });

      await expect(staticClient.get('/auth')).rejects.toThrow(UnauthorizedError);
    });

    it('should not retry on 403 Forbidden', async () => {
      nock(BASE_URL).get('/forbidden').reply(403, {
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });

      await expect(client.get('/forbidden')).rejects.toThrow(OpsApiError);
    });

    it('should not retry on 404 Not Found', async () => {
      nock(BASE_URL).get('/missing').reply(404, {
        error: { code: 'NOT_FOUND', message: 'Not found' },
      });

      await expect(client.get('/missing')).rejects.toThrow(NotFoundError);
    });

    it('should not retry on 409 Conflict', async () => {
      nock(BASE_URL).post('/create').reply(409, {
        error: { code: 'CONFLICT', message: 'Already exists' },
      });

      await expect(client.post('/create', { name: 'dup' })).rejects.toThrow(OpsApiError);
    });

    it('should exhaust all retries before failing', async () => {
      const twoRetryClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: TEST_API_KEY_SHORT,
        retries: 2,
      });

      nock(BASE_URL).get('/fail').times(2).reply(503, {
        error: { message: 'Down' },
      });

      await expect(twoRetryClient.get('/fail')).rejects.toThrow(OpsApiError);
      // Verify all 2 attempts were consumed
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('session auth with token refresh', () => {
    it('should not attempt refresh when sessionToken provided without credentials', async () => {
      // When only sessionToken is provided (no email/password), refresh is not possible
      // because createAuthStrategy stores empty credentials
      const sessionClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        sessionToken: 'static-token',
      });

      // Request fails with 401
      nock(BASE_URL)
        .get('/protected')
        .matchHeader('Authorization', 'Bearer static-token')
        .reply(401, { error: { message: 'Token expired' } });

      // Refresh attempt goes through createFetchClient() which uses new URL(path, baseUrl),
      // resolving to the base origin (not the /api/v1 path). The attempt fails because
      // nock.disableNetConnect() blocks unmatched requests, and the error is caught silently.
      // The original UnauthorizedError is then thrown.
      await expect(sessionClient.get('/protected')).rejects.toThrow(UnauthorizedError);
    });

    it('should report session type for session auth', () => {
      const sessionClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        sessionToken: 'some-token',
      });

      const strategy = sessionClient.getAuthStrategy();
      expect(strategy?.getType()).toBe('session');
      expect(strategy?.canRefresh()).toBe(true);
    });

    it('should deduplicate concurrent token refresh attempts', async () => {
      const sessionClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        email: 'user@test.com',
        password: 'pass123',
        retries: 2,
      });

      // Replace the auth strategy with a spy-able mock.
      // Refresh must take non-zero time so concurrent callers see the shared promise.
      const refreshSpy = vi.fn().mockImplementation(
        () => new Promise<void>(resolve => setTimeout(resolve, 10))
      );
      const mockStrategy = {
        getAuthorizationHeader: () => 'Bearer mock-token',
        canRefresh: () => true,
        refresh: refreshSpy,
        isAuthenticated: () => true,
        getType: () => 'session' as const,
      };
      (sessionClient as any).authStrategy = mockStrategy;

      // All 3 concurrent requests get 401 on first attempt
      nock(BASE_URL).get('/race1').reply(401, { error: { message: 'Token expired' } });
      nock(BASE_URL).get('/race2').reply(401, { error: { message: 'Token expired' } });
      nock(BASE_URL).get('/race3').reply(401, { error: { message: 'Token expired' } });

      // Retry after refresh: all 3 succeed
      nock(BASE_URL).get('/race1').reply(200, { data: { id: 1 } });
      nock(BASE_URL).get('/race2').reply(200, { data: { id: 2 } });
      nock(BASE_URL).get('/race3').reply(200, { data: { id: 3 } });

      const [r1, r2, r3] = await Promise.all([
        sessionClient.get('/race1'),
        sessionClient.get('/race2'),
        sessionClient.get('/race3'),
      ]);

      expect(r1).toEqual({ id: 1 });
      expect(r2).toEqual({ id: 2 });
      expect(r3).toEqual({ id: 3 });
      // Key assertion: refresh called exactly once despite 3 concurrent 401s
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('ApiKeyAuth', () => {
  it('should create auth with valid API key', () => {
    const auth = new ApiKeyAuth('ulr_valid-key');
    expect(auth.getAuthorizationHeader()).toBe('Bearer ulr_valid-key');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getType()).toBe('api_key');
    expect(auth.canRefresh()).toBe(false);
  });

  it('should reject empty API key', () => {
    expect(() => new ApiKeyAuth('')).toThrow('API key is required');
  });

  it('should reject API key without prefix', () => {
    expect(() => new ApiKeyAuth('invalid-key')).toThrow('Invalid API key format');
  });

  it('should throw on refresh attempt', async () => {
    const auth = new ApiKeyAuth('ulr_test-key');
    await expect(auth.refresh()).rejects.toThrow('API keys cannot be refreshed');
  });
});

describe('JwtSessionAuth', () => {
  let mockHttpClient: any;

  beforeEach(() => {
    mockHttpClient = {
      post: vi.fn(),
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should create auth with initial token', () => {
    const auth = new JwtSessionAuth(
      mockHttpClient,
      { email: 'test@example.com', password: 'pass' },
      undefined,
      'initial-token'
    );
    expect(auth.getAuthorizationHeader()).toBe('Bearer initial-token');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getType()).toBe('session');
    expect(auth.canRefresh()).toBe(true);
    expect(auth.getSessionToken()).toBe('initial-token');
  });

  it('should create auth without initial token (not authenticated)', () => {
    const auth = new JwtSessionAuth(mockHttpClient, {
      email: 'test@example.com',
      password: 'pass',
    });
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getSessionToken()).toBeNull();
    expect(() => auth.getAuthorizationHeader()).toThrow(UnauthorizedError);
  });

  it('should login and store token', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    mockHttpClient.post.mockResolvedValue({
      data: {
        data: {
          sessionToken: 'new-session-token',
          expiresAt: futureDate,
        },
      },
    });

    const auth = new JwtSessionAuth(mockHttpClient, {
      email: 'test@example.com',
      password: 'pass',
    });

    const token = await auth.login();

    expect(token).toBe('new-session-token');
    expect(auth.getSessionToken()).toBe('new-session-token');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getAuthorizationHeader()).toBe('Bearer new-session-token');
    expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'test@example.com',
      password: 'pass',
    });
  });

  it('should call onTokenRefresh callback after login', async () => {
    const onRefresh = vi.fn();
    mockHttpClient.post.mockResolvedValue({
      data: {
        data: {
          sessionToken: 'refreshed-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      },
    });

    const auth = new JwtSessionAuth(
      mockHttpClient,
      { email: 'test@example.com', password: 'pass' },
      onRefresh
    );

    await auth.login();

    expect(onRefresh).toHaveBeenCalledWith('refreshed-token');
  });

  it('should detect expired token in isAuthenticated', () => {
    const auth = new JwtSessionAuth(
      mockHttpClient,
      { email: 'test@example.com', password: 'pass' },
      undefined,
      'expired-token'
    );

    // Manually set expiration to the past
    (auth as any).expiresAt = new Date(Date.now() - 1000);

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getSessionToken()).toBeNull();
  });

  it('should clear session on logout', () => {
    const auth = new JwtSessionAuth(
      mockHttpClient,
      { email: 'test@example.com', password: 'pass' },
      undefined,
      'active-token'
    );

    expect(auth.isAuthenticated()).toBe(true);

    auth.clearSession();

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getSessionToken()).toBeNull();
    expect(auth.getExpiresAt()).toBeNull();
  });

  it('should refresh by re-logging in', async () => {
    mockHttpClient.post.mockResolvedValue({
      data: {
        data: {
          sessionToken: 'refreshed-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      },
    });

    const auth = new JwtSessionAuth(
      mockHttpClient,
      { email: 'test@example.com', password: 'pass' },
      undefined,
      'old-token'
    );

    await auth.refresh();

    expect(auth.getSessionToken()).toBe('refreshed-token');
  });
});

describe('createAuthStrategy', () => {
  let mockHttpClient: any;

  beforeEach(() => {
    mockHttpClient = {
      post: vi.fn(),
    };
  });

  it('should prioritize API key over session', () => {
    const strategy = createAuthStrategy({
      apiKey: 'ulr_api-key',
      email: 'test@example.com',
      password: 'pass',
      httpClient: mockHttpClient,
    });

    expect(strategy.getType()).toBe('api_key');
  });

  it('should use session token when no API key', () => {
    const strategy = createAuthStrategy({
      sessionToken: 'session-token',
      httpClient: mockHttpClient,
    });

    expect(strategy.getType()).toBe('session');
    expect(strategy.getAuthorizationHeader()).toBe('Bearer session-token');
  });

  it('should use email/password when no API key or session', () => {
    const strategy = createAuthStrategy({
      email: 'test@example.com',
      password: 'pass',
      httpClient: mockHttpClient,
    });

    expect(strategy.getType()).toBe('session');
    expect(strategy.canRefresh()).toBe(true);
  });

  it('should throw when no credentials provided', () => {
    expect(() => createAuthStrategy({})).toThrow('No valid credentials provided');
  });

  it('should throw when session token provided without httpClient', () => {
    expect(() =>
      createAuthStrategy({
        sessionToken: 'token',
      })
    ).toThrow('No valid credentials provided');
  });

  it('should throw when email/password provided without httpClient', () => {
    expect(() =>
      createAuthStrategy({
        email: 'test@example.com',
        password: 'pass',
      })
    ).toThrow('No valid credentials provided');
  });
});
