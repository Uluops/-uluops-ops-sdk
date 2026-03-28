import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as adminOps from '../../src/operations/admin.js';
import { BASE_URL, TEST_API_KEY } from '../setup.js';
import {
  TEST_IDS,
  createMockAdminStats,
  createMockAdminUser,
  createMockAdminSession,
  createMockAdminApiKey,
  createMockPagination,
  createMockMessage,
  resetMockIds,
} from '../contract-helpers.js';

describe('Admin Operations', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    resetMockIds();
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: TEST_API_KEY,
    });
  });

  describe('getStats', () => {
    it('should get admin dashboard stats', async () => {
      const mockStats = createMockAdminStats({
        totalUsers: 150,
        activeUsers: 120,
        totalProjects: 75,
      });

      nock(BASE_URL)
        .get('/admin/stats')
        .reply(200, { data: mockStats });

      const stats = await adminOps.getStats(client);

      expect(stats.totalUsers).toBe(150);
      expect(stats.activeUsers).toBe(120);
      expect(stats.totalProjects).toBe(75);
    });
  });

  describe('listUsers', () => {
    it('should list all users', async () => {
      const user1 = createMockAdminUser({ email: 'user1@example.com', role: 'developer' });
      const user2 = createMockAdminUser({ email: 'admin@example.com', role: 'admin' });
      const pagination = createMockPagination({ total: 2, page: 1, limit: 20, totalPages: 1 });

      nock(BASE_URL)
        .get('/admin/users')
        .reply(200, {
          data: {
            users: [user1, user2],
            pagination,
          },
        });

      const result = await adminOps.listUsers(client);

      expect(result.users).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter users by role', async () => {
      const adminUser = createMockAdminUser({ email: 'admin@example.com', role: 'admin' });
      const pagination = createMockPagination({ total: 1, page: 1, limit: 20 });

      nock(BASE_URL)
        .get('/admin/users')
        .query({ role: 'admin' })
        .reply(200, {
          data: {
            users: [adminUser],
            pagination,
          },
        });

      const result = await adminOps.listUsers(client, { role: 'admin' });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].role).toBe('admin');
    });

    it('should search users', async () => {
      const user = createMockAdminUser({ email: 'john@example.com' });
      const pagination = createMockPagination({ total: 1, page: 1, limit: 10 });

      nock(BASE_URL)
        .get('/admin/users')
        .query({ search: 'john', limit: 10 })
        .reply(200, {
          data: {
            users: [user],
            pagination,
          },
        });

      const result = await adminOps.listUsers(client, { search: 'john', limit: 10 });

      expect(result.users[0].email).toBe('john@example.com');
    });

    it('should paginate results', async () => {
      const user = createMockAdminUser({ email: 'user6@example.com' });
      const pagination = createMockPagination({ total: 10, page: 2, limit: 5, totalPages: 2 });

      nock(BASE_URL)
        .get('/admin/users')
        .query({ page: 2, limit: 5 })
        .reply(200, {
          data: {
            users: [user],
            pagination,
          },
        });

      const result = await adminOps.listUsers(client, { page: 2, limit: 5 });

      expect(result.pagination.page).toBe(2);
    });
  });

  describe('getUser', () => {
    it('should get user by ID with stats', async () => {
      const mockUser = createMockAdminUser({
        id: TEST_IDS.user1,
        email: 'user@example.com',
        role: 'developer',
        subscriptionTier: 'pro',
      });

      nock(BASE_URL)
        .get(`/admin/users/${TEST_IDS.user1}`)
        .reply(200, {
          data: {
            user: mockUser,
            stats: {
              projectCount: 5,
              runCount: 100,
              issueCount: 250,
              lastLoginAt: '2024-01-15',
            },
          },
        });

      const result = await adminOps.getUser(client, TEST_IDS.user1);

      expect(result.user.email).toBe('user@example.com');
      expect(result.stats.projectCount).toBe(5);
    });
  });

  describe('createUser', () => {
    it('should create user with password', async () => {
      const mockUser = createMockAdminUser({
        email: 'newuser@example.com',
        role: 'developer',
      });

      nock(BASE_URL)
        .post('/admin/users', {
          email: 'newuser@example.com',
          password: 'securePass123',
          role: 'developer',
          subscriptionTier: 'free',
        })
        .reply(201, {
          data: { user: mockUser },
        });

      const result = await adminOps.createUser(client, {
        email: 'newuser@example.com',
        password: 'securePass123',
        role: 'developer',
        subscriptionTier: 'free',
      });

      expect(result.user.email).toBe('newuser@example.com');
    });

    it('should create user with welcome email', async () => {
      const mockUser = createMockAdminUser({ email: 'invited@example.com' });

      nock(BASE_URL)
        .post('/admin/users', {
          email: 'invited@example.com',
          role: 'viewer',
          subscriptionTier: 'free',
          sendWelcomeEmail: true,
        })
        .reply(201, {
          data: {
            user: mockUser,
            temporaryPassword: 'tempPass123',
          },
        });

      const result = await adminOps.createUser(client, {
        email: 'invited@example.com',
        role: 'viewer',
        subscriptionTier: 'free',
        sendWelcomeEmail: true,
      });

      expect(result.temporaryPassword).toBe('tempPass123');
    });
  });

  describe('updateUser', () => {
    it('should update user role', async () => {
      const mockUser = createMockAdminUser({ id: TEST_IDS.user1, role: 'admin' });

      nock(BASE_URL)
        .patch(`/admin/users/${TEST_IDS.user1}`, { role: 'admin' })
        .reply(200, {
          data: { user: mockUser },
        });

      const result = await adminOps.updateUser(client, TEST_IDS.user1, { role: 'admin' });

      expect(result.user.role).toBe('admin');
    });

    it('should update subscription tier', async () => {
      const mockUser = createMockAdminUser({ id: TEST_IDS.user1, subscriptionTier: 'enterprise' });

      nock(BASE_URL)
        .patch(`/admin/users/${TEST_IDS.user1}`, { subscriptionTier: 'enterprise' })
        .reply(200, {
          data: { user: mockUser },
        });

      const result = await adminOps.updateUser(client, TEST_IDS.user1, {
        subscriptionTier: 'enterprise',
      });

      expect(result.user.subscriptionTier).toBe('enterprise');
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user', async () => {
      const mockUser = createMockAdminUser({ id: TEST_IDS.user1, isActive: false });

      nock(BASE_URL)
        .delete(`/admin/users/${TEST_IDS.user1}`)
        .reply(200, {
          data: { user: mockUser },
        });

      const result = await adminOps.deactivateUser(client, TEST_IDS.user1);

      expect(result.user.isActive).toBe(false);
    });
  });

  describe('reactivateUser', () => {
    it('should reactivate user', async () => {
      const mockUser = createMockAdminUser({ id: TEST_IDS.user1, isActive: true, deactivatedAt: null });

      nock(BASE_URL)
        .post(`/admin/users/${TEST_IDS.user1}/reactivate`)
        .reply(200, {
          data: { user: mockUser },
        });

      const result = await adminOps.reactivateUser(client, TEST_IDS.user1);

      expect(result.user.isActive).toBe(true);
    });
  });

  describe('resetUserPassword', () => {
    it('should trigger password reset', async () => {
      const mockResponse = createMockMessage('Password reset email sent');

      nock(BASE_URL)
        .post(`/admin/users/${TEST_IDS.user1}/reset-password`)
        .reply(200, { data: mockResponse });

      const result = await adminOps.resetUserPassword(client, TEST_IDS.user1);

      expect(result.message).toBe('Password reset email sent');
    });
  });

  describe('bulkDeactivate', () => {
    it('should bulk deactivate users', async () => {
      nock(BASE_URL)
        .post('/admin/users/bulk-deactivate', {
          userIds: [
            '00000000-0000-1000-8000-000000000001',
            '00000000-0000-1000-8000-000000000002',
            '00000000-0000-1000-8000-000000000003',
          ],
        })
        .reply(200, {
          data: {
            success: 3,
            failed: 0,
            results: [
              { userId: TEST_IDS.user1, success: true },
              { userId: TEST_IDS.user2, success: true },
              { userId: TEST_IDS.user3, success: true },
            ],
          },
        });

      const result = await adminOps.bulkDeactivate(client, [
        '00000000-0000-1000-8000-000000000001',
        '00000000-0000-1000-8000-000000000002',
        '00000000-0000-1000-8000-000000000003',
      ]);

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
    });
  });

  describe('listSessions', () => {
    it('should list all sessions', async () => {
      const session = createMockAdminSession({
        userId: TEST_IDS.user1,
        userEmail: 'user@example.com',
        userAgent: 'Chrome',
      });
      const pagination = createMockPagination({ total: 1, page: 1, limit: 20 });

      nock(BASE_URL)
        .get('/admin/sessions')
        .reply(200, {
          data: {
            sessions: [session],
            pagination,
          },
        });

      const result = await adminOps.listSessions(client);

      expect(result.sessions).toHaveLength(1);
    });

    it('should filter sessions by user', async () => {
      const session = createMockAdminSession({ userId: TEST_IDS.user1 });
      const pagination = createMockPagination({ total: 1, page: 1, limit: 20 });

      nock(BASE_URL)
        .get('/admin/sessions')
        .query({ userId: TEST_IDS.user1 })
        .reply(200, {
          data: {
            sessions: [session],
            pagination,
          },
        });

      const result = await adminOps.listSessions(client, { userId: TEST_IDS.user1 });

      expect(result.sessions[0].userId).toBe(TEST_IDS.user1);
    });
  });

  describe('terminateSession', () => {
    it('should terminate specific session', async () => {
      const mockResponse = createMockMessage('Session terminated');

      nock(BASE_URL)
        .delete(`/admin/sessions/${TEST_IDS.session1}`)
        .reply(200, { data: mockResponse });

      const result = await adminOps.terminateSession(client, TEST_IDS.session1);

      expect(result.message).toBe('Session terminated');
    });
  });

  describe('terminateUserSessions', () => {
    it('should terminate all sessions for a user', async () => {
      const mockResponse = createMockMessage('3 sessions terminated');

      nock(BASE_URL)
        .delete(`/admin/sessions/user/${TEST_IDS.user1}`)
        .reply(200, { data: mockResponse });

      const result = await adminOps.terminateUserSessions(client, TEST_IDS.user1);

      expect(result.message).toBe('3 sessions terminated');
    });
  });

  describe('listKeys', () => {
    it('should list all API keys', async () => {
      const key = createMockAdminApiKey({
        userId: TEST_IDS.user1,
        userEmail: 'user@example.com',
        name: 'Production Key',
      });
      const pagination = createMockPagination({ total: 1, page: 1, limit: 20 });

      nock(BASE_URL)
        .get('/admin/keys')
        .reply(200, {
          data: {
            keys: [key],
            pagination,
          },
        });

      const result = await adminOps.listKeys(client);

      expect(result.keys).toHaveLength(1);
      expect(result.keys[0].name).toBe('Production Key');
    });

    it('should filter keys by user', async () => {
      const key = createMockAdminApiKey({ userId: TEST_IDS.user1 });
      const pagination = createMockPagination({ total: 1, page: 1, limit: 20 });

      nock(BASE_URL)
        .get('/admin/keys')
        .query({ userId: TEST_IDS.user1 })
        .reply(200, {
          data: {
            keys: [key],
            pagination,
          },
        });

      const result = await adminOps.listKeys(client, { userId: TEST_IDS.user1 });

      expect(result.keys[0].userId).toBe(TEST_IDS.user1);
    });

    it('should search keys', async () => {
      const key = createMockAdminApiKey({ name: 'Production Key' });
      const pagination = createMockPagination({ total: 1, page: 1, limit: 20 });

      nock(BASE_URL)
        .get('/admin/keys')
        .query({ search: 'production' })
        .reply(200, {
          data: {
            keys: [key],
            pagination,
          },
        });

      const result = await adminOps.listKeys(client, { search: 'production' });

      expect(result.keys[0].name).toBe('Production Key');
    });
  });

  describe('revokeKey', () => {
    it('should revoke API key', async () => {
      const mockResponse = createMockMessage('API key revoked');

      nock(BASE_URL)
        .delete(`/admin/keys/${TEST_IDS.key1}`)
        .reply(200, { data: mockResponse });

      const result = await adminOps.revokeKey(client, TEST_IDS.key1);

      expect(result.message).toBe('API key revoked');
    });
  });
});
