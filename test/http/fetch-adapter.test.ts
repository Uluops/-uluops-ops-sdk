import { describe, it, expect } from 'vitest';
import type { FetchClient } from '../../src/http/fetch-adapter.js';

describe('FetchClient Interface', () => {
  it('should be satisfiable with a minimal implementation', () => {
    const mockClient: FetchClient = {
      post: async <T>(_url: string, _body: object) => {
        return { data: { data: 'test' as unknown as T } };
      },
    };

    expect(mockClient.post).toBeTypeOf('function');
  });

  it('should return properly nested data structure', async () => {
    const mockClient: FetchClient = {
      post: async <T>(_url: string, body: object) => {
        return { data: { data: body as unknown as T } };
      },
    };

    const result = await mockClient.post<{ token: string }>('/auth/login', {
      email: 'test@example.com',
      password: 'pass',
    });

    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('data');
    expect(result.data.data).toEqual({
      email: 'test@example.com',
      password: 'pass',
    });
  });

  it('should propagate errors from post', async () => {
    const mockClient: FetchClient = {
      post: async () => {
        throw new Error('Network failure');
      },
    };

    await expect(mockClient.post('/auth/login', {})).rejects.toThrow('Network failure');
  });

  it('should accept generic type parameter', async () => {
    interface LoginResponse {
      sessionToken: string;
      expiresAt: string;
    }

    const mockClient: FetchClient = {
      post: async <T>(_url: string, _body: object) => {
        return {
          data: {
            data: { sessionToken: 'jwt-123', expiresAt: '2026-12-31' } as unknown as T,
          },
        };
      },
    };

    const result = await mockClient.post<LoginResponse>('/auth/login', {
      email: 'test@example.com',
      password: 'pass',
    });

    expect(result.data.data.sessionToken).toBe('jwt-123');
    expect(result.data.data.expiresAt).toBe('2026-12-31');
  });
});
