import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as authOps from '../../src/operations/auth.js';
import { BASE_URL } from '../setup.js';

describe('Auth Operations', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: 'ulr_test-api-key-12345',
    });
  });

  describe('register', () => {
    it('should register a new user', async () => {
      nock(BASE_URL)
        .post('/auth/register', {
          email: 'newuser@example.com',
          password: 'securePassword123',
        })
        .reply(201, {
          data: {
            user: { id: 'user-1', email: 'newuser@example.com', role: 'user' },
            token: 'jwt-token-abc',
          },
        });

      const result = await authOps.register(client, {
        email: 'newuser@example.com',
        password: 'securePassword123',
      });

      expect(result.user.email).toBe('newuser@example.com');
      expect(result.token).toBe('jwt-token-abc');
    });
  });

  describe('login', () => {
    it('should login and return token', async () => {
      nock(BASE_URL)
        .post('/auth/login', {
          email: 'user@example.com',
          password: 'password123',
        })
        .reply(200, {
          data: {
            user: { id: 'user-1', email: 'user@example.com' },
            token: 'jwt-token-xyz',
          },
        });

      const result = await authOps.login(client, {
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.token).toBe('jwt-token-xyz');
      expect(result.user.id).toBe('user-1');
    });
  });

  describe('logoutAll', () => {
    it('should logout all sessions', async () => {
      nock(BASE_URL)
        .post('/auth/logout-all')
        .reply(200, { data: { sessionsRevoked: 3 } });

      const result = await authOps.logoutAll(client);

      expect(result.sessionsRevoked).toBe(3);
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email', async () => {
      nock(BASE_URL)
        .post('/auth/forgot-password', { email: 'user@example.com' })
        .reply(200, { data: { message: 'Password reset email sent' } });

      const result = await authOps.forgotPassword(client, 'user@example.com');

      expect(result.message).toBe('Password reset email sent');
    });
  });

  describe('resetPassword', () => {
    it('should reset password with token', async () => {
      nock(BASE_URL)
        .post('/auth/reset-password', {
          token: 'reset-token-123',
          newPassword: 'newSecurePassword',
        })
        .reply(200, { data: { message: 'Password reset successfully' } });

      const result = await authOps.resetPassword(client, {
        token: 'reset-token-123',
        newPassword: 'newSecurePassword',
      });

      expect(result.message).toBe('Password reset successfully');
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      nock(BASE_URL)
        .put('/auth/password', {
          currentPassword: 'oldPassword',
          newPassword: 'newPassword123',
        })
        .reply(200, { data: { message: 'Password changed successfully' } });

      const result = await authOps.changePassword(client, {
        currentPassword: 'oldPassword',
        newPassword: 'newPassword123',
      });

      expect(result.message).toBe('Password changed successfully');
    });
  });

  describe('setPassword', () => {
    it('should set initial password', async () => {
      nock(BASE_URL)
        .post('/auth/password', { password: 'initialPassword' })
        .reply(200, { data: { message: 'Password set successfully' } });

      const result = await authOps.setPassword(client, 'initialPassword');

      expect(result.message).toBe('Password set successfully');
    });
  });

  describe('getMe', () => {
    it('should get current user', async () => {
      nock(BASE_URL)
        .get('/auth/me')
        .reply(200, {
          data: {
            id: 'user-1',
            email: 'user@example.com',
            role: 'user',
          },
        });

      const user = await authOps.getMe(client);

      expect(user.id).toBe('user-1');
      expect(user.email).toBe('user@example.com');
      expect(user.role).toBe('user');
    });
  });

  describe('getProfile', () => {
    it('should get full user profile', async () => {
      nock(BASE_URL)
        .get('/auth/profile')
        .reply(200, {
          data: {
            user: {
              id: 'user-1',
              email: 'user@example.com',
              displayName: 'Test User',
              createdAt: '2024-01-01T00:00:00Z',
            },
          },
        });

      const result = await authOps.getProfile(client);

      expect(result.user.displayName).toBe('Test User');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      nock(BASE_URL)
        .patch('/auth/profile', { displayName: 'New Name' })
        .reply(200, {
          data: {
            user: {
              id: 'user-1',
              displayName: 'New Name',
            },
          },
        });

      const result = await authOps.updateProfile(client, { displayName: 'New Name' });

      expect(result.user.displayName).toBe('New Name');
    });
  });

  describe('deleteAvatar', () => {
    it('should delete user avatar', async () => {
      nock(BASE_URL)
        .delete('/auth/avatar')
        .reply(200, { data: {} });

      await expect(authOps.deleteAvatar(client)).resolves.toBeUndefined();
    });
  });

  describe('listApiKeys', () => {
    it('should list API keys', async () => {
      nock(BASE_URL)
        .get('/auth/keys')
        .reply(200, {
          data: [
            { id: 'key-1', name: 'My Key', prefix: 'ulr_abc', createdAt: '2024-01-01' },
            { id: 'key-2', name: 'Another Key', prefix: 'ulr_def', createdAt: '2024-01-02' },
          ],
        });

      const keys = await authOps.listApiKeys(client);

      expect(keys).toHaveLength(2);
      expect(keys[0].name).toBe('My Key');
    });
  });

  describe('createApiKey', () => {
    it('should create API key with name', async () => {
      nock(BASE_URL)
        .post('/auth/keys', { name: 'Production Key' })
        .reply(201, {
          data: {
            id: 'key-3',
            name: 'Production Key',
            key: 'ulr_full-secret-key-value',
          },
        });

      const result = await authOps.createApiKey(client, { name: 'Production Key' });

      expect(result.name).toBe('Production Key');
      expect(result.key).toBe('ulr_full-secret-key-value');
    });

    it('should create API key without name', async () => {
      nock(BASE_URL)
        .post('/auth/keys')
        .reply(201, {
          data: {
            id: 'key-4',
            key: 'ulr_unnamed-key',
          },
        });

      const result = await authOps.createApiKey(client);

      expect(result.key).toBe('ulr_unnamed-key');
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke API key', async () => {
      nock(BASE_URL)
        .delete('/auth/keys/key-1')
        .reply(200, { data: {} });

      await expect(authOps.revokeApiKey(client, 'key-1')).resolves.toBeUndefined();
    });
  });

  describe('listSessions', () => {
    it('should list active sessions', async () => {
      nock(BASE_URL)
        .get('/auth/sessions')
        .reply(200, {
          data: [
            { id: 'sess-1', userAgent: 'Chrome', createdAt: '2024-01-01', lastUsed: '2024-01-02' },
            { id: 'sess-2', userAgent: 'Firefox', createdAt: '2024-01-01', lastUsed: '2024-01-03' },
          ],
        });

      const sessions = await authOps.listSessions(client);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].userAgent).toBe('Chrome');
    });
  });

  describe('revokeSession', () => {
    it('should revoke session', async () => {
      nock(BASE_URL)
        .delete('/auth/sessions/sess-1')
        .reply(200, { data: {} });

      await expect(authOps.revokeSession(client, 'sess-1')).resolves.toBeUndefined();
    });
  });
});
