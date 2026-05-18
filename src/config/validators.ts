import { z } from 'zod';
import {
  CreateProjectInputSchema,
  SaveRunInputSchema,
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
  BulkStatusUpdateInputSchema,
  DeleteProjectInputSchema,
  RenameProjectInputSchema,
  UpdateIssueInputSchema,
} from '../types/schemas.js';

/**
 * Client-side validation error thrown when input fails Zod schema validation.
 *
 * Contains structured error details from Zod for programmatic inspection.
 * Import from `@uluops/ops-sdk/errors` or `@uluops/ops-sdk/config`.
 *
 * @example
 * ```typescript
 * try {
 *   validateSaveRunInput(data);
 * } catch (err) {
 *   if (err instanceof InputValidationError) {
 *     console.log(err.message);  // "Invalid save run: project: String must contain at least 1 character(s)"
 *     console.log(err.errors);   // Zod issue array with path, code, message per field
 *   }
 * }
 * ```
 */
export class InputValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: z.ZodError['issues']
  ) {
    super(message);
    this.name = 'InputValidationError';
  }
}

/**
 * Format a single Zod issue into a human-readable string.
 */
function formatZodIssue(e: z.ZodError['issues'][number]): string {
  const field = e.path.join('.') || '(root)';
  if (e.code === 'invalid_value' && 'values' in e && Array.isArray(e.values)) {
    const opts = e.values.map(String).join(', ');
    return `${field} must be one of: ${opts}`;
  }
  return `${field}: ${e.message}`;
}

function validate<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map(formatZodIssue).join(', ');
    throw new InputValidationError(`Invalid ${context}: ${messages}`, result.error.issues);
  }
  return result.data;
}

// ============================================
// AUTH VALIDATORS
// ============================================

/**
 * Validate user registration input.
 * @param data - Raw input: `{ email: string (valid email, max 255), password: string (8-128 chars, requires uppercase + lowercase + digit) }`
 * @returns Validated `RegisterInput`
 * @throws {InputValidationError} If email is invalid or password doesn't meet requirements
 */
export function validateRegisterInput(data: unknown) {
  return validate(RegisterInputSchema, data, 'register input');
}

/**
 * Validate login input.
 * @param data - Raw input: `{ email: string, password: string }`
 * @returns Validated `LoginInput`
 * @throws {InputValidationError} If email or password is missing
 */
export function validateLoginInput(data: unknown) {
  return validate(LoginInputSchema, data, 'login input');
}

/**
 * Validate profile update input. At least one field must be provided.
 * @param data - Raw input: `{ username?, name?, bio?, timezone?, websiteUrl?, avatar?, avatarMimeType? }`
 * @returns Validated `UpdateProfileInput`
 * @throws {InputValidationError} If no fields provided, or username doesn't match `^[a-z][a-z0-9_]{2,29}$`
 */
export function validateUpdateProfileInput(data: unknown) {
  return validate(UpdateProfileInputSchema, data, 'profile update');
}

/**
 * Validate password change input.
 * @param data - Raw input: `{ currentPassword: string, newPassword: string (8-128, upper+lower+digit) }`
 * @returns Validated `ChangePasswordInput`
 * @throws {InputValidationError} If current password missing or new password doesn't meet requirements
 */
export function validateChangePasswordInput(data: unknown) {
  return validate(ChangePasswordInputSchema, data, 'password change');
}

/**
 * Validate password reset input (from reset email).
 * @param data - Raw input: `{ token: string, password: string (8-128, upper+lower+digit) }`
 * @returns Validated `ResetPasswordInput`
 * @throws {InputValidationError} If token missing or password doesn't meet requirements
 */
export function validateResetPasswordInput(data: unknown) {
  return validate(ResetPasswordInputSchema, data, 'password reset');
}

/**
 * Validate API key creation input.
 * @param data - Raw input: `{ name?: string (max 100), expiresAt?: string (ISO 8601) }`
 * @returns Validated `CreateApiKeyInput`
 * @throws {InputValidationError} If name exceeds 100 chars or expiresAt is not valid ISO 8601
 */
export function validateCreateApiKeyInput(data: unknown) {
  return validate(CreateApiKeyInputSchema, data, 'API key creation');
}

// ============================================
// PROJECT VALIDATORS
// ============================================

/**
 * Validate project creation input.
 * @param data - Raw input: `{ name: string (1-200 chars) }`
 * @returns Validated `CreateProjectInput`
 * @throws {InputValidationError} If name is empty or exceeds 200 chars
 */
export function validateCreateProjectInput(data: unknown) {
  return validate(CreateProjectInputSchema, data, 'project creation');
}

/**
 * Validate project deletion input. Requires explicit confirmation.
 * @param data - Raw input: `{ confirm: true, confirmationPhrase: string }`
 * @returns Validated `DeleteProjectInput`
 * @throws {InputValidationError} If confirm is not `true` or confirmationPhrase is missing
 */
export function validateDeleteProjectInput(data: unknown) {
  return validate(DeleteProjectInputSchema, data, 'project deletion');
}

/**
 * Validate project rename input.
 * @param data - Raw input: `{ oldName: string, newName: string (1-200 chars) }`
 * @returns Validated `RenameProjectInput`
 * @throws {InputValidationError} If either name is empty or newName exceeds 200 chars
 */
export function validateRenameProjectInput(data: unknown) {
  return validate(RenameProjectInputSchema, data, 'project rename');
}

// ============================================
// RUN VALIDATORS
// ============================================

/**
 * Validate save run input. This is the primary validation for `client.runs.save()`.
 * @param data - Raw input with required fields: `project` (1-200), `workflowType` (1-100),
 *   `agents` (non-empty array), `recommendations` (array, use `[]` for empty).
 *   Optional: `summary`, `rawMarkdown`, `idempotencyKey`, `definitionType/Name/Version/Hash`,
 *   `analysisRecords`, `analysisSummary`.
 * @returns Validated `SaveRunInput`
 * @throws {InputValidationError} If required fields missing, agents empty, or field constraints violated
 */
export function validateSaveRunInput(data: unknown) {
  return validate(SaveRunInputSchema, data, 'save run');
}

/**
 * Validate archive runs input.
 * @param data - Raw input: `{ project: string }` plus at least one filter:
 *   `beforeRunNumber?`, `beforeDate?` (ISO 8601), `keepLast?`, `reason?` (max 500)
 * @returns Validated `ArchiveRunsInput`
 * @throws {InputValidationError} If project missing or filter constraints violated
 */
export function validateArchiveRunsInput(data: unknown) {
  return validate(ArchiveRunsInputSchema, data, 'archive runs');
}

// ============================================
// ISSUE VALIDATORS
// ============================================

/**
 * Validate user-submitted issue creation input.
 * @param data - Raw input with required: `project` (1-200), `title` (1-500),
 *   `priority` ('critical' | 'high' | 'suggested' | 'backlog').
 *   Optional: `severity`, `category`, `description` (max 10000), `filePath`, `lineNumber`,
 *   `failureCode` (e.g. 'SEM-VAL/H'), `failureDomain`, `failureMode`, `agent`, `type`.
 * @returns Validated `CreateUserIssueInput`
 * @throws {InputValidationError} If required fields missing or constraints violated
 */
export function validateCreateUserIssueInput(data: unknown) {
  return validate(CreateUserIssueInputSchema, data, 'issue creation');
}

/**
 * Validate issue metadata update input. All fields optional.
 * @param data - Raw input: `{ title?, status?, priority?, severity?, failureCode?, filePath?, lineNumber?, ... }`
 * @returns Validated `UpdateIssueInput`
 * @throws {InputValidationError} If any provided field violates its constraints
 */
export function validateUpdateIssueInput(data: unknown) {
  return validate(UpdateIssueInputSchema, data, 'issue update');
}

/**
 * Validate issue status update input.
 * @param data - Raw input: `{ status: Status, reason?: string (max 500) }`
 * @returns Validated `UpdateIssueStatusInput`
 * @throws {InputValidationError} If status is not a valid Status enum value
 */
export function validateUpdateIssueStatusInput(data: unknown) {
  return validate(UpdateIssueStatusInputSchema, data, 'status update');
}

/**
 * Validate issue note creation input.
 * @param data - Raw input: `{ content: string (1-10000), noteType?: NoteType, createdBy?: string }`
 * @returns Validated `CreateIssueNoteInput`
 * @throws {InputValidationError} If content is empty or exceeds 10000 chars
 */
export function validateCreateIssueNoteInput(data: unknown) {
  return validate(CreateIssueNoteInputSchema, data, 'issue note');
}

/**
 * Validate bulk issue status update input. Max 100 items per request.
 * @param data - Raw input: `{ updates: Array<{ issueId?: string, id?: string, status: Status, reason?: string }> }`
 * @returns Validated bulk update input
 * @throws {InputValidationError} If updates array is empty, exceeds 100 items, or any item has invalid status
 */
export function validateBulkStatusUpdateInput(data: unknown) {
  return validate(BulkStatusUpdateInputSchema, data, 'bulk status update');
}


// ============================================
// SIMPLE VALIDATORS
// ============================================

/**
 * Validate that a string is a valid UUID v1-5.
 * @param value - The string to validate
 * @param fieldName - Field name for error messages (e.g. 'projectId', 'issueId')
 * @throws {InputValidationError} If value is not a valid UUID format
 */
export function validateUuid(value: string, fieldName: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new InputValidationError(`Invalid ${fieldName}: must be a valid UUID`, [
      { code: 'custom', path: [fieldName], message: 'must be a valid UUID' }
    ]);
  }
}

/**
 * Validate that a value is a non-empty string after trimming.
 * @param value - The value to validate
 * @param fieldName - Field name for error messages
 * @returns The trimmed string
 * @throws {InputValidationError} If value is not a string or is empty after trimming
 */
export function validateRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InputValidationError(`${fieldName} is required`, [
      { code: 'custom', path: [fieldName], message: 'is required' }
    ]);
  }
  return value.trim();
}

/**
 * Validate that a value is a positive integer (> 0).
 * @param value - The value to validate (coerced via `Number()`)
 * @param fieldName - Field name for error messages
 * @returns The validated number
 * @throws {InputValidationError} If value is not a positive integer
 */
export function validatePositiveInt(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new InputValidationError(`${fieldName} must be a positive integer`, []);
  }
  return num;
}
