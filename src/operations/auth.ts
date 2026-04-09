import { z } from 'zod';
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
import {
  AuthUserResponseSchema,
  PublicUserResponseSchema,
  LoginResponseSchema,
  RegisterResponseSchema,
  PublicApiKeyResponseSchema,
  ApiKeyCreatedResponseSchema,
  PublicSessionResponseSchema,
  MessageResponseSchema,
} from '../types/response-schemas.js';
import {
  validateRegisterInput,
  validateLoginInput,
  validateUpdateProfileInput,
  validateChangePasswordInput,
  validateResetPasswordInput,
  validateCreateApiKeyInput,
} from '../config/validators.js';

const ProfileResponseSchema = z.object({ user: PublicUserResponseSchema });

/**
 * Register a new user
 */
export async function register(
  client: OpsHttpClient,
  input: RegisterInput
): Promise<RegisterResponse> {
  validateRegisterInput(input);
  return client.post('/auth/register', input, { skipAuth: true, schema: RegisterResponseSchema });
}

/**
 * Login with email and password
 */
export async function login(
  client: OpsHttpClient,
  input: LoginInput
): Promise<LoginResponse> {
  validateLoginInput(input);
  return client.post('/auth/login', input, { skipAuth: true, schema: LoginResponseSchema });
}

/**
 * Logout all sessions for the current user
 */
export async function logoutAll(
  client: OpsHttpClient
): Promise<{ sessionsRevoked: number }> {
  return client.post('/auth/logout-all', undefined, { schema: z.object({ sessionsRevoked: z.number() }) });
}

/**
 * Request a password reset email
 */
export async function forgotPassword(
  client: OpsHttpClient,
  email: string
): Promise<MessageResponse> {
  return client.post('/auth/forgot-password', { email }, { skipAuth: true, schema: MessageResponseSchema });
}

/**
 * Reset password using a reset token
 */
export async function resetPassword(
  client: OpsHttpClient,
  input: ResetPasswordInput
): Promise<MessageResponse> {
  validateResetPasswordInput(input);
  return client.post('/auth/reset-password', input, { skipAuth: true, schema: MessageResponseSchema });
}

/**
 * Change password (requires current password)
 */
export async function changePassword(
  client: OpsHttpClient,
  input: ChangePasswordInput
): Promise<MessageResponse> {
  validateChangePasswordInput(input);
  return client.put('/auth/password', input, { schema: MessageResponseSchema });
}

/**
 * Set password (first time, no current password)
 */
export async function setPassword(
  client: OpsHttpClient,
  password: string
): Promise<MessageResponse> {
  return client.post('/auth/password', { password }, { schema: MessageResponseSchema });
}

/**
 * Get current user info (minimal)
 */
export async function getMe(client: OpsHttpClient): Promise<AuthUser> {
  return client.get('/auth/me', undefined, { schema: AuthUserResponseSchema });
}

/**
 * Get current user's full profile
 */
export async function getProfile(client: OpsHttpClient): Promise<{ user: PublicUser }> {
  return client.get('/auth/profile', undefined, { schema: ProfileResponseSchema });
}

/**
 * Update current user's profile
 */
export async function updateProfile(
  client: OpsHttpClient,
  input: UpdateProfileInput
): Promise<{ user: PublicUser }> {
  validateUpdateProfileInput(input);
  return client.patch('/auth/profile', input, { schema: ProfileResponseSchema });
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
  return client.get('/auth/keys', undefined, { schema: z.array(PublicApiKeyResponseSchema) });
}

/**
 * Create a new API key
 */
export async function createApiKey(
  client: OpsHttpClient,
  input?: CreateApiKeyInput
): Promise<ApiKeyCreatedResponse> {
  if (input) validateCreateApiKeyInput(input);
  return client.post('/auth/keys', input, { schema: ApiKeyCreatedResponseSchema });
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
  return client.get('/auth/sessions', undefined, { schema: z.array(PublicSessionResponseSchema) });
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
