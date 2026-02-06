import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as authOps from '../../src/operations/auth.js';
import { BASE_URL, TEST_API_KEY } from '../setup.js';
import {
  createMockAuthUser,
  createMockPublicUser,
  createMockLoginResponse,
  createMockRegisterResponse,
  createMockPublicApiKey,
  createMockApiKeyCreated,
  createMockPublicSession,
  createMockMessage,
  resetMockIds,
} from '../contract-helpers.js';

describe('Auth Operations', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    resetMockIds();
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: TEST_API_KEY,
    });
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const mockResponse = createMockRegisterResponse({
        email: 'newuser@example.com',
        user: createMockAuthUser({ email: 'newuser@example.com' }),
        token: 'jwt-token-abc',
      });

      nock(BASE_URL)
        .post('/auth/register', {
          email: 'newuser@example.com',
          password: 'securePassword123',
        })
        .reply(201, { data: mockResponse });

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
      const mockResponse = createMockLoginResponse({
        user: createMockAuthUser({ id: 'user-1', email: 'user@example.com' }),
        token: 'jwt-token-xyz',
      });

      nock(BASE_URL)
        .post('/auth/login', {
          email: 'user@example.com',
          password: 'password123',
        })
        .reply(200, { data: mockResponse });

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
      const mockResponse = createMockMessage('Password reset email sent');

      nock(BASE_URL)
        .post('/auth/forgot-password', { email: 'user@example.com' })
        .reply(200, { data: mockResponse });

      const result = await authOps.forgotPassword(client, 'user@example.com');

      expect(result.message).toBe('Password reset email sent');
    });
  });

  describe('resetPassword', () => {
    it('should reset password with token', async () => {
      const mockResponse = createMockMessage('Password reset successfully');

      nock(BASE_URL)
        .post('/auth/reset-password', {
          token: 'reset-token-123',
          password: 'newSecurePass1',
        })
        .reply(200, { data: mockResponse });

      const result = await authOps.resetPassword(client, {
        token: 'reset-token-123',
        password: 'newSecurePass1',
      });

      expect(result.message).toBe('Password reset successfully');
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      const mockResponse = createMockMessage('Password changed successfully');

      nock(BASE_URL)
        .put('/auth/password', {
          currentPassword: 'oldPassword',
          newPassword: 'newPassword123',
        })
        .reply(200, { data: mockResponse });

      const result = await authOps.changePassword(client, {
        currentPassword: 'oldPassword',
        newPassword: 'newPassword123',
      });

      expect(result.message).toBe('Password changed successfully');
    });
  });

  describe('setPassword', () => {
    it('should set initial password', async () => {
      const mockResponse = createMockMessage('Password set successfully');

      nock(BASE_URL)
        .post('/auth/password', { password: 'initialPassword' })
        .reply(200, { data: mockResponse });

      const result = await authOps.setPassword(client, 'initialPassword');

      expect(result.message).toBe('Password set successfully');
    });
  });

  describe('getMe', () => {
    it('should get current user', async () => {
      const mockUser = createMockAuthUser({
        id: 'user-1',
        email: 'user@example.com',
        role: 'developer',
      });

      nock(BASE_URL)
        .get('/auth/me')
        .reply(200, { data: mockUser });

      const user = await authOps.getMe(client);

      expect(user.id).toBe('user-1');
      expect(user.email).toBe('user@example.com');
      expect(user.role).toBe('developer');
    });
  });

  describe('getProfile', () => {
    it('should get full user profile', async () => {
      const mockUser = createMockPublicUser({
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
      });

      nock(BASE_URL)
        .get('/auth/profile')
        .reply(200, {
          data: { user: mockUser },
        });

      const result = await authOps.getProfile(client);

      expect(result.user.name).toBe('Test User');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const mockUser = createMockPublicUser({
        id: 'user-1',
        name: 'New Name',
      });

      nock(BASE_URL)
        .patch('/auth/profile', { name: 'New Name' })
        .reply(200, {
          data: { user: mockUser },
        });

      const result = await authOps.updateProfile(client, { name: 'New Name' });

      expect(result.user.name).toBe('New Name');
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
      const key1 = createMockPublicApiKey({ name: 'My Key' });
      const key2 = createMockPublicApiKey({ name: 'Another Key' });

      nock(BASE_URL)
        .get('/auth/keys')
        .reply(200, { data: [key1, key2] });

      const keys = await authOps.listApiKeys(client);

      expect(keys).toHaveLength(2);
      expect(keys[0].name).toBe('My Key');
    });
  });

  describe('createApiKey', () => {
    it('should create API key with name', async () => {
      const mockResponse = createMockApiKeyCreated({
        key: 'ulr_full-secret-key-value',
        apiKey: createMockPublicApiKey({ name: 'Production Key' }),
      });

      nock(BASE_URL)
        .post('/auth/keys', { name: 'Production Key' })
        .reply(201, { data: mockResponse });

      const result = await authOps.createApiKey(client, { name: 'Production Key' });

      expect(result.key).toBe('ulr_full-secret-key-value');
    });

    it('should create API key without name', async () => {
      const mockResponse = createMockApiKeyCreated({
        key: 'ulr_unnamed-key',
      });

      nock(BASE_URL)
        .post('/auth/keys')
        .reply(201, { data: mockResponse });

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
      const sess1 = createMockPublicSession({ userAgent: 'Chrome' });
      const sess2 = createMockPublicSession({ userAgent: 'Firefox' });

      nock(BASE_URL)
        .get('/auth/sessions')
        .reply(200, { data: [sess1, sess2] });

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
