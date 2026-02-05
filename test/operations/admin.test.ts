import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as adminOps from '../../src/operations/admin.js';
import { BASE_URL } from '../setup.js';

describe('Admin Operations', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: 'ulr_test-api-key-12345',
    });
  });

  describe('getStats', () => {
    it('should get admin dashboard stats', async () => {
      nock(BASE_URL)
        .get('/admin/stats')
        .reply(200, {
          data: {
            totalUsers: 150,
            activeUsers: 120,
            totalProjects: 75,
            totalRuns: 5000,
            totalIssues: 15000,
            storageUsedMb: 2500,
          },
        });

      const stats = await adminOps.getStats(client);

      expect(stats.totalUsers).toBe(150);
      expect(stats.activeUsers).toBe(120);
      expect(stats.totalProjects).toBe(75);
    });
  });

  describe('listUsers', () => {
    it('should list all users', async () => {
      nock(BASE_URL)
        .get('/admin/users')
        .reply(200, {
          data: {
            users: [
              { id: 'user-1', email: 'user1@example.com', role: 'user' },
              { id: 'user-2', email: 'admin@example.com', role: 'admin' },
            ],
            pagination: { total: 2, page: 1, limit: 20, totalPages: 1 },
          },
        });

      const result = await adminOps.listUsers(client);

      expect(result.users).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter users by role', async () => {
      nock(BASE_URL)
        .get('/admin/users')
        .query({ role: 'admin' })
        .reply(200, {
          data: {
            users: [{ id: 'user-2', email: 'admin@example.com', role: 'admin' }],
            pagination: { total: 1, page: 1, limit: 20 },
          },
        });

      const result = await adminOps.listUsers(client, { role: 'admin' });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].role).toBe('admin');
    });

    it('should search users', async () => {
      nock(BASE_URL)
        .get('/admin/users')
        .query({ search: 'john', limit: 10 })
        .reply(200, {
          data: {
            users: [{ id: 'user-3', email: 'john@example.com' }],
            pagination: { total: 1, page: 1, limit: 10 },
          },
        });

      const result = await adminOps.listUsers(client, { search: 'john', limit: 10 });

      expect(result.users[0].email).toBe('john@example.com');
    });

    it('should paginate results', async () => {
      nock(BASE_URL)
        .get('/admin/users')
        .query({ page: 2, limit: 5 })
        .reply(200, {
          data: {
            users: [{ id: 'user-6', email: 'user6@example.com' }],
            pagination: { total: 10, page: 2, limit: 5, totalPages: 2 },
          },
        });

      const result = await adminOps.listUsers(client, { page: 2, limit: 5 });

      expect(result.pagination.page).toBe(2);
    });
  });

  describe('getUser', () => {
    it('should get user by ID with stats', async () => {
      nock(BASE_URL)
        .get('/admin/users/user-1')
        .reply(200, {
          data: {
            user: {
              id: 'user-1',
              email: 'user@example.com',
              role: 'user',
              subscriptionTier: 'pro',
              createdAt: '2024-01-01',
            },
            stats: {
              projectCount: 5,
              runCount: 100,
              issueCount: 250,
              lastLoginAt: '2024-01-15',
            },
          },
        });

      const result = await adminOps.getUser(client, 'user-1');

      expect(result.user.email).toBe('user@example.com');
      expect(result.stats.projectCount).toBe(5);
    });
  });

  describe('createUser', () => {
    it('should create user with password', async () => {
      nock(BASE_URL)
        .post('/admin/users', {
          email: 'newuser@example.com',
          password: 'securePass123',
          role: 'developer',
          subscription_tier: 'free',
        })
        .reply(201, {
          data: {
            user: { id: 'user-new', email: 'newuser@example.com', role: 'developer' },
          },
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
      nock(BASE_URL)
        .post('/admin/users', {
          email: 'invited@example.com',
          role: 'viewer',
          subscription_tier: 'free',
          send_welcome_email: true,
        })
        .reply(201, {
          data: {
            user: { id: 'user-invited', email: 'invited@example.com' },
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
      nock(BASE_URL)
        .patch('/admin/users/user-1', { role: 'admin' })
        .reply(200, {
          data: { user: { id: 'user-1', role: 'admin' } },
        });

      const result = await adminOps.updateUser(client, 'user-1', { role: 'admin' });

      expect(result.user.role).toBe('admin');
    });

    it('should update subscription tier', async () => {
      nock(BASE_URL)
        .patch('/admin/users/user-1', { subscription_tier: 'enterprise' })
        .reply(200, {
          data: { user: { id: 'user-1', subscriptionTier: 'enterprise' } },
        });

      const result = await adminOps.updateUser(client, 'user-1', {
        subscriptionTier: 'enterprise',
      });

      expect(result.user.subscriptionTier).toBe('enterprise');
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user', async () => {
      nock(BASE_URL)
        .delete('/admin/users/user-1')
        .reply(200, {
          data: { user: { id: 'user-1', isActive: false, deactivatedAt: '2024-01-15' } },
        });

      const result = await adminOps.deactivateUser(client, 'user-1');

      expect(result.user.isActive).toBe(false);
    });
  });

  describe('reactivateUser', () => {
    it('should reactivate user', async () => {
      nock(BASE_URL)
        .post('/admin/users/user-1/reactivate')
        .reply(200, {
          data: { user: { id: 'user-1', isActive: true, deactivatedAt: null } },
        });

      const result = await adminOps.reactivateUser(client, 'user-1');

      expect(result.user.isActive).toBe(true);
    });
  });

  describe('resetUserPassword', () => {
    it('should trigger password reset', async () => {
      nock(BASE_URL)
        .post('/admin/users/user-1/reset-password')
        .reply(200, {
          data: { message: 'Password reset email sent' },
        });

      const result = await adminOps.resetUserPassword(client, 'user-1');

      expect(result.message).toBe('Password reset email sent');
    });
  });

  describe('bulkDeactivate', () => {
    it('should bulk deactivate users', async () => {
      nock(BASE_URL)
        .post('/admin/users/bulk-deactivate', {
          user_ids: [
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
              { userId: 'user-1', success: true },
              { userId: 'user-2', success: true },
              { userId: 'user-3', success: true },
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
      nock(BASE_URL)
        .get('/admin/sessions')
        .reply(200, {
          data: {
            sessions: [
              {
                id: 'sess-1',
                userId: 'user-1',
                userEmail: 'user@example.com',
                userAgent: 'Chrome',
                createdAt: '2024-01-01',
              },
            ],
            pagination: { total: 1, page: 1, limit: 20 },
          },
        });

      const result = await adminOps.listSessions(client);

      expect(result.sessions).toHaveLength(1);
    });

    it('should filter sessions by user', async () => {
      nock(BASE_URL)
        .get('/admin/sessions')
        .query({ user_id: 'user-1' })
        .reply(200, {
          data: {
            sessions: [{ id: 'sess-1', userId: 'user-1' }],
            pagination: { total: 1, page: 1, limit: 20 },
          },
        });

      const result = await adminOps.listSessions(client, { userId: 'user-1' });

      expect(result.sessions[0].userId).toBe('user-1');
    });
  });

  describe('terminateSession', () => {
    it('should terminate specific session', async () => {
      nock(BASE_URL)
        .delete('/admin/sessions/sess-1')
        .reply(200, {
          data: { message: 'Session terminated' },
        });

      const result = await adminOps.terminateSession(client, 'sess-1');

      expect(result.message).toBe('Session terminated');
    });
  });

  describe('terminateUserSessions', () => {
    it('should terminate all sessions for a user', async () => {
      nock(BASE_URL)
        .delete('/admin/sessions/user/user-1')
        .reply(200, {
          data: { message: '3 sessions terminated' },
        });

      const result = await adminOps.terminateUserSessions(client, 'user-1');

      expect(result.message).toBe('3 sessions terminated');
    });
  });

  describe('listKeys', () => {
    it('should list all API keys', async () => {
      nock(BASE_URL)
        .get('/admin/keys')
        .reply(200, {
          data: {
            keys: [
              {
                id: 'key-1',
                userId: 'user-1',
                userEmail: 'user@example.com',
                name: 'Production Key',
                prefix: 'ulr_prod',
                createdAt: '2024-01-01',
              },
            ],
            pagination: { total: 1, page: 1, limit: 20 },
          },
        });

      const result = await adminOps.listKeys(client);

      expect(result.keys).toHaveLength(1);
      expect(result.keys[0].name).toBe('Production Key');
    });

    it('should filter keys by user', async () => {
      nock(BASE_URL)
        .get('/admin/keys')
        .query({ user_id: 'user-1' })
        .reply(200, {
          data: {
            keys: [{ id: 'key-1', userId: 'user-1' }],
            pagination: { total: 1, page: 1, limit: 20 },
          },
        });

      const result = await adminOps.listKeys(client, { userId: 'user-1' });

      expect(result.keys[0].userId).toBe('user-1');
    });

    it('should search keys', async () => {
      nock(BASE_URL)
        .get('/admin/keys')
        .query({ search: 'production' })
        .reply(200, {
          data: {
            keys: [{ id: 'key-1', name: 'Production Key' }],
            pagination: { total: 1, page: 1, limit: 20 },
          },
        });

      const result = await adminOps.listKeys(client, { search: 'production' });

      expect(result.keys[0].name).toBe('Production Key');
    });
  });

  describe('revokeKey', () => {
    it('should revoke API key', async () => {
      nock(BASE_URL)
        .delete('/admin/keys/key-1')
        .reply(200, {
          data: { message: 'API key revoked' },
        });

      const result = await adminOps.revokeKey(client, 'key-1');

      expect(result.message).toBe('API key revoked');
    });
  });
});
