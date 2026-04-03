import type { UserRole, SubscriptionTier, AvatarMimeType } from './enums.js';

/**
 * Full user entity
 */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  username: string | null;
  name: string | null;
  bio: string | null;
  timezone: string | null;
  websiteUrl: string | null;
  avatar: string | null; // base64 encoded
  avatarMimeType: AvatarMimeType | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Authenticated user from auth middleware
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  username?: string | null;
  name?: string | null;
  bio?: string | null;
  timezone?: string | null;
  websiteUrl?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public user representation (client-safe)
 */
export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  username: string | null;
  name: string | null;
  bio: string | null;
  timezone: string | null;
  websiteUrl: string | null;
  avatarMimeType: AvatarMimeType | null;
  isActive: boolean;
  hasAvatar: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * User registration input
 */
export interface RegisterInput {
  email: string;
  password: string;
}

/**
 * User login input
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  user: AuthUser;
  sessionToken: string;
  expiresAt: string;
}

/**
 * Register response
 */
export interface RegisterResponse {
  id: string;
  email: string;
  isActive: boolean;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  createdAt: string;
  updatedAt: string;
}

/**
 * Profile update input
 */
export interface UpdateProfileInput {
  username?: string | null;
  name?: string | null;
  bio?: string | null;
  timezone?: string | null;
  websiteUrl?: string | null;
  avatar?: string | null; // base64 encoded
  avatarMimeType?: AvatarMimeType | null;
}

/**
 * Password change input (requires current password)
 */
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/**
 * Password reset request input
 */
export interface ForgotPasswordInput {
  email: string;
}

/**
 * Password reset input
 */
export interface ResetPasswordInput {
  token: string;
  password: string;
}

/**
 * API key entity
 */
export interface ApiKey {
  id: string;
  userId: string;
  keyHash: string;
  name: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/**
 * Public API key (metadata only, no hash)
 */
export interface PublicApiKey {
  id: string;
  name: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/**
 * API key creation input
 */
export interface CreateApiKeyInput {
  name?: string;
  expiresAt?: string;
}

/**
 * API key creation response (includes plaintext key)
 */
export interface ApiKeyCreatedResponse {
  key: string; // The plaintext key - only shown once
  apiKey: PublicApiKey;
}

/**
 * Session entity
 */
export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  lastActiveAt: string;
  userAgent: string | null;
  ipAddress: string | null;
}

/**
 * Public session (no token hash)
 */
export interface PublicSession {
  id: string;
  expiresAt: string;
  createdAt: string;
  lastActiveAt: string;
  userAgent: string | null;
  ipAddress: string | null;
}

