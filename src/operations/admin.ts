import type { OpsHttpClient } from '../http/http-client.js';
import type {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminSession,
  AdminApiKey,
  AdminStats,
  UserStats,
  PublicUser,
  BulkResult,
  ListUsersQuery,
  ListSessionsQuery,
  ListKeysQuery,
} from '../types/auth.js';
import type { Pagination } from '../types/responses.js';
import {
  validateAdminCreateUserInput,
  validateAdminUpdateUserInput,
  validateBulkDeactivateInput,
} from '../config/validators.js';

/**
 * Get admin dashboard statistics
 */
export async function getStats(client: OpsHttpClient): Promise<AdminStats> {
  return client.get<AdminStats>('/admin/stats');
}

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * List all users with filtering and pagination
 */
export async function listUsers(
  client: OpsHttpClient,
  query?: ListUsersQuery
): Promise<{ users: PublicUser[]; pagination: Pagination }> {
  return client.get<{ users: PublicUser[]; pagination: Pagination }>('/admin/users', {
    search: query?.search,
    role: Array.isArray(query?.role) ? query.role.join(',') : query?.role,
    subscriptionTier: Array.isArray(query?.subscriptionTier)
      ? query.subscriptionTier.join(',')
      : query?.subscriptionTier,
    isActive: query?.isActive,
    sortBy: query?.sortBy,
    sortOrder: query?.sortOrder,
    page: query?.page,
    limit: query?.limit,
  });
}

/**
 * Get a user by ID with stats
 */
export async function getUser(
  client: OpsHttpClient,
  userId: string
): Promise<{ user: PublicUser; stats: UserStats }> {
  return client.get<{ user: PublicUser; stats: UserStats }>(`/admin/users/${encodeURIComponent(userId)}`);
}

/**
 * Create a new user (admin)
 */
export async function createUser(
  client: OpsHttpClient,
  input: AdminCreateUserInput
): Promise<{ user: PublicUser; temporaryPassword?: string }> {
  validateAdminCreateUserInput(input);
  return client.post<{ user: PublicUser; temporaryPassword?: string }>('/admin/users', {
    email: input.email,
    password: input.password,
    role: input.role,
    subscriptionTier: input.subscriptionTier,
    sendWelcomeEmail: input.sendWelcomeEmail,
  });
}

/**
 * Update a user (admin)
 */
export async function updateUser(
  client: OpsHttpClient,
  userId: string,
  input: AdminUpdateUserInput
): Promise<{ user: PublicUser }> {
  validateAdminUpdateUserInput(input);
  return client.patch<{ user: PublicUser }>(`/admin/users/${encodeURIComponent(userId)}`, {
    email: input.email,
    role: input.role,
    subscriptionTier: input.subscriptionTier,
  });
}

/**
 * Deactivate (soft-delete) a user
 */
export async function deactivateUser(
  client: OpsHttpClient,
  userId: string
): Promise<{ user: PublicUser }> {
  return client.delete<{ user: PublicUser }>(`/admin/users/${encodeURIComponent(userId)}`);
}

/**
 * Reactivate a deactivated user
 */
export async function reactivateUser(
  client: OpsHttpClient,
  userId: string
): Promise<{ user: PublicUser }> {
  return client.post<{ user: PublicUser }>(`/admin/users/${userId}/reactivate`);
}

/**
 * Trigger a password reset email for a user
 */
export async function resetUserPassword(
  client: OpsHttpClient,
  userId: string
): Promise<{ message: string }> {
  return client.post<{ message: string }>(`/admin/users/${userId}/reset-password`);
}

/**
 * Bulk deactivate users
 */
export async function bulkDeactivate(
  client: OpsHttpClient,
  userIds: string[]
): Promise<BulkResult> {
  validateBulkDeactivateInput({ userIds });
  return client.post<BulkResult>('/admin/users/bulk-deactivate', {
    userIds: userIds,
  });
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * List all active sessions
 */
export async function listSessions(
  client: OpsHttpClient,
  query?: ListSessionsQuery
): Promise<{ sessions: AdminSession[]; pagination: Pagination }> {
  return client.get<{ sessions: AdminSession[]; pagination: Pagination }>('/admin/sessions', {
    userId: query?.userId,
    sortBy: query?.sortBy,
    sortOrder: query?.sortOrder,
    page: query?.page,
    limit: query?.limit,
  });
}

/**
 * Terminate a specific session
 */
export async function terminateSession(
  client: OpsHttpClient,
  sessionId: string
): Promise<{ message: string }> {
  return client.delete<{ message: string }>(`/admin/sessions/${encodeURIComponent(sessionId)}`);
}

/**
 * Terminate all sessions for a user
 */
export async function terminateUserSessions(
  client: OpsHttpClient,
  userId: string
): Promise<{ message: string }> {
  return client.delete<{ message: string }>(`/admin/sessions/user/${encodeURIComponent(userId)}`);
}

// ============================================
// API KEY MANAGEMENT
// ============================================

/**
 * List all API keys
 */
export async function listKeys(
  client: OpsHttpClient,
  query?: ListKeysQuery
): Promise<{ keys: AdminApiKey[]; pagination: Pagination }> {
  return client.get<{ keys: AdminApiKey[]; pagination: Pagination }>('/admin/keys', {
    userId: query?.userId,
    search: query?.search,
    sortBy: query?.sortBy,
    sortOrder: query?.sortOrder,
    page: query?.page,
    limit: query?.limit,
  });
}

/**
 * Revoke any API key
 */
export async function revokeKey(
  client: OpsHttpClient,
  keyId: string
): Promise<{ message: string }> {
  return client.delete<{ message: string }>(`/admin/keys/${encodeURIComponent(keyId)}`);
}
