import { describe, it, expect, beforeEach, vi } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../src/http/http-client.js';
import {
  OpsApiError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  RateLimitError,
} from '../src/errors/errors.js';
import { BASE_URL } from './setup.js';

describe('OpsHttpClient', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: 'ulr_test-api-key-12345',
    });
  });

  describe('constructor', () => {
    it('should create client with API key', () => {
      const c = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: 'ulr_test-key',
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
        .matchHeader('Authorization', 'Bearer ulr_test-api-key-12345')
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
    it('should throw ValidationError for 400', async () => {
      nock(BASE_URL).get('/projects').reply(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });

      await expect(client.get('/projects')).rejects.toThrow(ValidationError);
    });

    it('should throw UnauthorizedError for 401', async () => {
      nock(BASE_URL).get('/projects').reply(401, {
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
      });

      await expect(client.get('/projects')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw NotFoundError for 404', async () => {
      nock(BASE_URL).get('/projects/999').reply(404, {
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });

      await expect(client.get('/projects/999')).rejects.toThrow(NotFoundError);
    });

    it('should throw RateLimitError for 429', async () => {
      // Use a client with 1 retry since 429 is retryable (1 means only 1 attempt)
      const noRetryClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: 'ulr_test-api-key-12345',
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
    });

    it('should not retry on 400 errors', async () => {
      nock(BASE_URL).get('/projects').reply(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Bad request' },
      });

      await expect(client.get('/projects')).rejects.toThrow(ValidationError);
    });

    it('should give up after max retries', async () => {
      // All requests fail with 503
      nock(BASE_URL).get('/projects').times(3).reply(503, {
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Down' },
      });

      await expect(client.get('/projects')).rejects.toThrow(OpsApiError);
    });

    it('should respect custom retry count', async () => {
      const customClient = new OpsHttpClient({
        baseUrl: BASE_URL,
        apiKey: 'ulr_test-key',
        retries: 1,
      });

      nock(BASE_URL).get('/projects').times(2).reply(503, {
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Down' },
      });

      await expect(customClient.get('/projects')).rejects.toThrow(OpsApiError);
    });
  });

  describe('requestRaw', () => {
    it('should return raw response without unwrapping data', async () => {
      nock(BASE_URL).get('/raw-endpoint').reply(200, { custom: 'response' });

      const result = await client.requestRaw('GET', '/raw-endpoint');

      expect(result).toEqual({ custom: 'response' });
    });
  });
});
