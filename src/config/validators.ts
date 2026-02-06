import { z } from 'zod';
import {
  CreateProjectInputSchema,
  SaveFeaturesListInputSchema,
  CreateUserIssueInputSchema,
  UpdateIssueStatusInputSchema,
  CreateIssueNoteInputSchema,
  ArchiveRunsInputSchema,
  RegisterInputSchema,
  LoginInputSchema,
  UpdateProfileInputSchema,
  ChangePasswordInputSchema,
  ResetPasswordInputSchema,
  CreateApiKeyInputSchema,
  AdminCreateUserInputSchema,
  AdminUpdateUserInputSchema,
  BulkDeactivateInputSchema,
  BulkStatusUpdateInputSchema,
  DeleteProjectInputSchema,
  RenameProjectInputSchema,
  UpdateIssueInputSchema,
} from '../types/schemas.js';

/**
 * Validation error with details
 */
export class InputValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: z.ZodError['errors']
  ) {
    super(message);
    this.name = 'InputValidationError';
  }
}

/**
 * Generic validation function
 */
function formatZodError(e: z.ZodIssue): string {
  const field = e.path.join('.') || '(root)';
  if (e.code === 'invalid_enum_value') {
    const opts = (e as z.ZodInvalidEnumValueIssue).options.join(', ');
    return `${field} must be one of: ${opts} (got '${(e as z.ZodInvalidEnumValueIssue).received}')`;
  }
  return `${field}: ${e.message}`;
}

function validate<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.errors.map(formatZodError).join(', ');
    throw new InputValidationError(`Invalid ${context}: ${messages}`, result.error.errors);
  }
  return result.data;
}

// ============================================
// AUTH VALIDATORS
// ============================================

export function validateRegisterInput(data: unknown) {
  return validate(RegisterInputSchema, data, 'register input');
}

export function validateLoginInput(data: unknown) {
  return validate(LoginInputSchema, data, 'login input');
}

export function validateUpdateProfileInput(data: unknown) {
  return validate(UpdateProfileInputSchema, data, 'profile update');
}

export function validateChangePasswordInput(data: unknown) {
  return validate(ChangePasswordInputSchema, data, 'password change');
}

export function validateResetPasswordInput(data: unknown) {
  return validate(ResetPasswordInputSchema, data, 'password reset');
}

export function validateCreateApiKeyInput(data: unknown) {
  return validate(CreateApiKeyInputSchema, data, 'API key creation');
}

// ============================================
// PROJECT VALIDATORS
// ============================================

export function validateCreateProjectInput(data: unknown) {
  return validate(CreateProjectInputSchema, data, 'project creation');
}

export function validateDeleteProjectInput(data: unknown) {
  return validate(DeleteProjectInputSchema, data, 'project deletion');
}

export function validateRenameProjectInput(data: unknown) {
  return validate(RenameProjectInputSchema, data, 'project rename');
}

// ============================================
// RUN VALIDATORS
// ============================================

export function validateSaveFeaturesListInput(data: unknown) {
  return validate(SaveFeaturesListInputSchema, data, 'features list');
}

export function validateArchiveRunsInput(data: unknown) {
  return validate(ArchiveRunsInputSchema, data, 'archive runs');
}

// ============================================
// ISSUE VALIDATORS
// ============================================

export function validateCreateUserIssueInput(data: unknown) {
  return validate(CreateUserIssueInputSchema, data, 'issue creation');
}

export function validateUpdateIssueInput(data: unknown) {
  return validate(UpdateIssueInputSchema, data, 'issue update');
}

export function validateUpdateIssueStatusInput(data: unknown) {
  return validate(UpdateIssueStatusInputSchema, data, 'status update');
}

export function validateCreateIssueNoteInput(data: unknown) {
  return validate(CreateIssueNoteInputSchema, data, 'issue note');
}

export function validateBulkStatusUpdateInput(data: unknown) {
  return validate(BulkStatusUpdateInputSchema, data, 'bulk status update');
}

// ============================================
// ADMIN VALIDATORS
// ============================================

export function validateAdminCreateUserInput(data: unknown) {
  return validate(AdminCreateUserInputSchema, data, 'admin user creation');
}

export function validateAdminUpdateUserInput(data: unknown) {
  return validate(AdminUpdateUserInputSchema, data, 'admin user update');
}

export function validateBulkDeactivateInput(data: unknown) {
  return validate(BulkDeactivateInputSchema, data, 'bulk deactivation');
}

// ============================================
// SIMPLE VALIDATORS
// ============================================

export function validateUuid(value: string, fieldName: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new InputValidationError(`Invalid ${fieldName}: must be a valid UUID`, []);
  }
}

export function validateRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InputValidationError(`${fieldName} is required`, []);
  }
  return value.trim();
}

export function validatePositiveInt(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new InputValidationError(`${fieldName} must be a positive integer`, []);
  }
  return num;
}
