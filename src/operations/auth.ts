import type { OpsHttpClient } from '../http/http-client.js';
import type {
  RegisterInput,
  LoginInput,
  LoginResponse,
  RegisterResponse,
  UpdateProfileInput,
  ChangePasswordInput,
  ResetPasswordInput,
  CreateApiKeyInput,
  ApiKeyCreatedResponse,
  PublicApiKey,
  PublicSession,
  AuthUser,
  PublicUser,
} from '../types/auth.js';
import type { MessageResponse } from '../types/responses.js';

/**
 * Register a new user
 */
export async function register(
  client: OpsHttpClient,
  input: RegisterInput
): Promise<RegisterResponse> {
  return client.post<RegisterResponse>('/auth/register', input);
}

/**
 * Login with email and password
 */
export async function login(
  client: OpsHttpClient,
  input: LoginInput
): Promise<LoginResponse> {
  return client.post<LoginResponse>('/auth/login', input);
}

/**
 * Logout all sessions for the current user
 */
export async function logoutAll(
  client: OpsHttpClient
): Promise<{ sessionsRevoked: number }> {
  return client.post<{ sessionsRevoked: number }>('/auth/logout-all');
}

/**
 * Request a password reset email
 */
export async function forgotPassword(
  client: OpsHttpClient,
  email: string
): Promise<MessageResponse> {
  return client.post<MessageResponse>('/auth/forgot-password', { email });
}

/**
 * Reset password using a reset token
 */
export async function resetPassword(
  client: OpsHttpClient,
  input: ResetPasswordInput
): Promise<MessageResponse> {
  return client.post<MessageResponse>('/auth/reset-password', input);
}

/**
 * Change password (requires current password)
 */
export async function changePassword(
  client: OpsHttpClient,
  input: ChangePasswordInput
): Promise<MessageResponse> {
  return client.put<MessageResponse>('/auth/password', input);
}

/**
 * Set password (first time, no current password)
 */
export async function setPassword(
  client: OpsHttpClient,
  password: string
): Promise<MessageResponse> {
  return client.post<MessageResponse>('/auth/password', { password });
}

/**
 * Get current user info (minimal)
 */
export async function getMe(client: OpsHttpClient): Promise<AuthUser> {
  return client.get<AuthUser>('/auth/me');
}

/**
 * Get current user's full profile
 */
export async function getProfile(client: OpsHttpClient): Promise<{ user: PublicUser }> {
  return client.get<{ user: PublicUser }>('/auth/profile');
}

/**
 * Update current user's profile
 */
export async function updateProfile(
  client: OpsHttpClient,
  input: UpdateProfileInput
): Promise<{ user: PublicUser }> {
  return client.patch<{ user: PublicUser }>('/auth/profile', input as Record<string, unknown>);
}

/**
 * Get current user's avatar (returns binary data)
 */
export async function getAvatar(
  client: OpsHttpClient
): Promise<{ data: ArrayBuffer; contentType: string }> {
  const response = await client.requestBinary('GET', '/auth/avatar');
  return {
    data: response.data,
    contentType: response.contentType,
  };
}

/**
 * Delete current user's avatar
 */
export async function deleteAvatar(client: OpsHttpClient): Promise<void> {
  await client.delete('/auth/avatar');
}

/**
 * List user's API keys
 */
export async function listApiKeys(
  client: OpsHttpClient
): Promise<PublicApiKey[]> {
  return client.get<PublicApiKey[]>('/auth/keys');
}

/**
 * Create a new API key
 */
export async function createApiKey(
  client: OpsHttpClient,
  input?: CreateApiKeyInput
): Promise<ApiKeyCreatedResponse> {
  return client.post<ApiKeyCreatedResponse>('/auth/keys', input);
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(
  client: OpsHttpClient,
  keyId: string
): Promise<void> {
  await client.delete(`/auth/keys/${encodeURIComponent(keyId)}`);
}

/**
 * List user's active sessions
 */
export async function listSessions(
  client: OpsHttpClient
): Promise<PublicSession[]> {
  return client.get<PublicSession[]>('/auth/sessions');
}

/**
 * Revoke a session
 */
export async function revokeSession(
  client: OpsHttpClient,
  sessionId: string
): Promise<void> {
  await client.delete(`/auth/sessions/${encodeURIComponent(sessionId)}`);
}
