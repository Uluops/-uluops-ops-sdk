import { z } from 'zod';
import type { UserRole, SubscriptionTier, AvatarMimeType } from './enums.js';
import {
  AuthUserResponseSchema,
  PublicUserResponseSchema,
  LoginResponseSchema,
  RegisterResponseSchema,
  PublicApiKeyResponseSchema,
  ApiKeyCreatedResponseSchema,
  PublicSessionResponseSchema,
} from './response-schemas.js';

// ─────────────────────────────────────────────────────────────────
// Response types (derived from Zod schemas — single source of truth)
// ─────────────────────────────────────────────────────────────────

/** Authenticated user from auth middleware */
export type AuthUser = z.infer<typeof AuthUserResponseSchema>;

/** Public user representation (client-safe) */
export type PublicUser = z.infer<typeof PublicUserResponseSchema>;

/** Login response */
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/** Register response */
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

/** Public API key (metadata only, no hash) */
export type PublicApiKey = z.infer<typeof PublicApiKeyResponseSchema>;

/** API key creation response (includes plaintext key) */
export type ApiKeyCreatedResponse = z.infer<typeof ApiKeyCreatedResponseSchema>;

/** Public session (no token hash) */
export type PublicSession = z.infer<typeof PublicSessionResponseSchema>;

// ─────────────────────────────────────────────────────────────────
// Input types (hand-written — not API responses)
// ─────────────────────────────────────────────────────────────────

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
 * API key creation input
 */
export interface CreateApiKeyInput {
  name?: string;
  expiresAt?: string;
}

/**
 * API key entity (internal, with hash)
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
 * Session entity (internal, with token hash)
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
