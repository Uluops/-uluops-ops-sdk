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
  validateSetPasswordInput,
  validateCreateApiKeyInput,
} from '../config/validators.js';

const ProfileResponseSchema = z.object({ user: PublicUserResponseSchema });

/**
 * Register a new user account. Does not require authentication.
 *
 * @param client - HTTP client instance
 * @param input - `{ email, password }` — password requires 8-128 chars, uppercase + lowercase + digit
 * @returns `{ user, token }` — the token can be used for immediate session auth
 * @throws {InputValidationError} If email invalid or password doesn't meet requirements
 */
export async function register(
  client: OpsHttpClient,
  input: RegisterInput
): Promise<RegisterResponse> {
  validateRegisterInput(input);
  return client.post('/auth/register', input, { skipAuth: true, schema: RegisterResponseSchema });
}

/**
 * Login with email and password. Does not require authentication.
 * Returns a session token — use `OpsClient.login()` instead for auto-install.
 *
 * @param client - HTTP client instance
 * @param input - `{ email, password }`
 * @returns `{ user, sessionToken }` — token must be manually installed on the client
 * @throws {InputValidationError} If email or password is missing
 * @throws {UnauthorizedError} If credentials are invalid
 */
export async function login(
  client: OpsHttpClient,
  input: LoginInput
): Promise<LoginResponse> {
  validateLoginInput(input);
  return client.post('/auth/login', input, { skipAuth: true, schema: LoginResponseSchema });
}

/**
 * Revoke all sessions for the current user (not just the current session).
 *
 * @param client - HTTP client instance
 * @returns `{ sessionsRevoked: number }`
 */
export async function logoutAll(
  client: OpsHttpClient
): Promise<{ sessionsRevoked: number }> {
  return client.post('/auth/logout-all', undefined, { schema: z.object({ sessionsRevoked: z.number() }) });
}

/**
 * Request a password reset email. Does not require authentication.
 * Always returns success (prevents email enumeration).
 *
 * @param client - HTTP client instance
 * @param email - Email address of the account to reset
 * @returns Success message
 */
export async function forgotPassword(
  client: OpsHttpClient,
  email: string
): Promise<MessageResponse> {
  return client.post('/auth/forgot-password', { email }, { skipAuth: true, schema: MessageResponseSchema });
}

/**
 * Reset password using a token from the reset email. Does not require authentication.
 *
 * @param client - HTTP client instance
 * @param input - `{ token, password }` — password must meet complexity requirements
 * @returns Success message
 * @throws {InputValidationError} If password doesn't meet requirements
 */
export async function resetPassword(
  client: OpsHttpClient,
  input: ResetPasswordInput
): Promise<MessageResponse> {
  validateResetPasswordInput(input);
  return client.post('/auth/reset-password', input, { skipAuth: true, schema: MessageResponseSchema });
}

/**
 * Change the current user's password. Requires knowing the current password.
 *
 * @param client - HTTP client instance
 * @param input - `{ currentPassword, newPassword }` — new password must meet requirements
 * @returns Success message
 * @throws {InputValidationError} If new password doesn't meet requirements
 * @throws {UnauthorizedError} If current password is incorrect
 */
export async function changePassword(
  client: OpsHttpClient,
  input: ChangePasswordInput
): Promise<MessageResponse> {
  validateChangePasswordInput(input);
  return client.put('/auth/password', input, { schema: MessageResponseSchema });
}

/**
 * Set password for the first time (accounts created without one, e.g. OAuth or admin-created).
 *
 * @param client - HTTP client instance
 * @param password - New password (8-128 chars, must contain upper+lower+digit)
 * @returns Success message
 * @throws {InputValidationError} If password doesn't meet complexity requirements
 */
export async function setPassword(
  client: OpsHttpClient,
  password: string
): Promise<MessageResponse> {
  validateSetPasswordInput({ password });
  return client.post('/auth/password', { password }, { schema: MessageResponseSchema });
}

/**
 * Get current user info (minimal — id, email, role).
 *
 * @param client - HTTP client instance
 * @returns `AuthUser` with id, email, role, createdAt
 */
export async function getMe(client: OpsHttpClient): Promise<AuthUser> {
  return client.get('/auth/me', undefined, { schema: AuthUserResponseSchema });
}

/**
 * Get current user's full profile (username, bio, avatar, timezone, etc.).
 *
 * @param client - HTTP client instance
 * @returns `{ user: PublicUser }` with all profile fields
 */
export async function getProfile(client: OpsHttpClient): Promise<{ user: PublicUser }> {
  return client.get('/auth/profile', undefined, { schema: ProfileResponseSchema });
}

/**
 * Update the current user's profile. At least one field must be provided.
 *
 * @param client - HTTP client instance
 * @param input - Profile fields: username, name, bio, timezone, websiteUrl, avatar (base64), avatarMimeType
 * @returns `{ user }` with updated profile
 * @throws {InputValidationError} If no fields provided or constraints violated
 */
export async function updateProfile(
  client: OpsHttpClient,
  input: UpdateProfileInput
): Promise<{ user: PublicUser }> {
  validateUpdateProfileInput(input);
  return client.patch('/auth/profile', input, { schema: ProfileResponseSchema });
}

/**
 * Get the current user's avatar image as binary data.
 *
 * @param client - HTTP client instance
 * @returns `{ data: ArrayBuffer, contentType: string }` — contentType is e.g. 'image/png'
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
 * Delete the current user's avatar image.
 *
 * @param client - HTTP client instance
 */
export async function deleteAvatar(client: OpsHttpClient): Promise<void> {
  await client.delete('/auth/avatar');
}

/**
 * List the current user's API keys (excludes the full key value — only id, name, prefix, createdAt).
 *
 * @param client - HTTP client instance
 * @returns Array of `PublicApiKey` objects
 */
export async function listApiKeys(
  client: OpsHttpClient
): Promise<PublicApiKey[]> {
  return client.get('/auth/keys', undefined, { schema: z.array(PublicApiKeyResponseSchema) });
}

/**
 * Create a new API key. The full key is only returned once — store it securely.
 *
 * @param client - HTTP client instance
 * @param input - Optional: `{ name?, expiresAt? }`
 * @returns `{ id, name, key }` — key starts with `ulr_` prefix
 * @throws {InputValidationError} If name exceeds 100 chars
 */
export async function createApiKey(
  client: OpsHttpClient,
  input?: CreateApiKeyInput
): Promise<ApiKeyCreatedResponse> {
  if (input) validateCreateApiKeyInput(input);
  return client.post('/auth/keys', input, { schema: ApiKeyCreatedResponseSchema });
}

/**
 * Revoke an API key by ID. Immediately invalidates the key.
 *
 * @param client - HTTP client instance
 * @param keyId - API key UUID
 */
export async function revokeApiKey(
  client: OpsHttpClient,
  keyId: string
): Promise<void> {
  await client.delete(`/auth/keys/${encodeURIComponent(keyId)}`);
}

/**
 * List the current user's active sessions (id, userAgent, ipAddress, createdAt, expiresAt).
 *
 * @param client - HTTP client instance
 * @returns Array of `PublicSession` objects
 */
export async function listSessions(
  client: OpsHttpClient
): Promise<PublicSession[]> {
  return client.get('/auth/sessions', undefined, { schema: z.array(PublicSessionResponseSchema) });
}

/**
 * Revoke a session by ID. Immediately invalidates the session token.
 *
 * @param client - HTTP client instance
 * @param sessionId - Session UUID
 */
export async function revokeSession(
  client: OpsHttpClient,
  sessionId: string
): Promise<void> {
  await client.delete(`/auth/sessions/${encodeURIComponent(sessionId)}`);
}
