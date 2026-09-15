import { z } from 'zod';
import {
  CreateProjectInputSchema,
  UpdateProjectInputSchema,
  SaveRunInputSchema,
  CreateUserIssueInputSchema,
  UpdateIssueStatusInputSchema,
  CreateIssueNoteInputSchema,
  ArchiveRunsInputSchema,
  UpdateRunInputSchema,
  UpdateRunPreviewInputSchema,
  UPDATE_PREVIEW_FORBIDDEN_INPUT_KEYS,
  RegisterInputSchema,
  LoginInputSchema,
  UpdateProfileInputSchema,
  ChangePasswordInputSchema,
  ResetPasswordInputSchema,
  SetPasswordInputSchema,
  CreateApiKeyInputSchema,
  BulkStatusUpdateInputSchema,
  DeleteProjectInputSchema,
  RenameProjectInputSchema,
  MergeProjectsInputSchema,
  RehomeProjectInputSchema,
  AdminRehomeProjectInputSchema,
  TotpLoginInputSchema,
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
export function validateRegisterInput(data: unknown): z.infer<typeof RegisterInputSchema> {
  return validate(RegisterInputSchema, data, 'register input');
}

/**
 * Validate login input.
 * @param data - Raw input: `{ email: string, password: string }`
 * @returns Validated `LoginInput`
 * @throws {InputValidationError} If email or password is missing
 */
export function validateLoginInput(data: unknown): z.infer<typeof LoginInputSchema> {
  return validate(LoginInputSchema, data, 'login input');
}

/**
 * Validate profile update input. At least one field must be provided.
 * @param data - Raw input: `{ username?, name?, bio?, timezone?, websiteUrl?, avatar?, avatarMimeType? }`
 * @returns Validated `UpdateProfileInput`
 * @throws {InputValidationError} If no fields provided, or username doesn't match `^[a-z0-9](?:[a-z0-9_-]{0,38}[a-z0-9])?$`
 */
export function validateUpdateProfileInput(data: unknown): z.infer<typeof UpdateProfileInputSchema> {
  return validate(UpdateProfileInputSchema, data, 'profile update');
}

/**
 * Validate password change input.
 * @param data - Raw input: `{ currentPassword: string, newPassword: string (8-128, upper+lower+digit) }`
 * @returns Validated `ChangePasswordInput`
 * @throws {InputValidationError} If current password missing or new password doesn't meet requirements
 */
export function validateChangePasswordInput(data: unknown): z.infer<typeof ChangePasswordInputSchema> {
  return validate(ChangePasswordInputSchema, data, 'password change');
}

/**
 * Validate password reset input (from reset email).
 * @param data - Raw input: `{ token: string, password: string (8-128, upper+lower+digit) }`
 * @returns Validated `ResetPasswordInput`
 * @throws {InputValidationError} If token missing or password doesn't meet requirements
 */
export function validateResetPasswordInput(data: unknown): z.infer<typeof ResetPasswordInputSchema> {
  return validate(ResetPasswordInputSchema, data, 'password reset');
}

/**
 * Validate set-password input (first-time password for OAuth/admin-created accounts).
 * @param data - Raw input: `{ password: string (8-128, upper+lower+digit) }`
 * @returns Validated `SetPasswordInput`
 * @throws {InputValidationError} If password doesn't meet complexity requirements
 */
export function validateSetPasswordInput(data: unknown): z.infer<typeof SetPasswordInputSchema> {
  return validate(SetPasswordInputSchema, data, 'set password');
}

/**
 * Validate API key creation input.
 * @param data - Raw input: `{ name?: string (max 100), expiresAt?: string (ISO 8601) }`
 * @returns Validated `CreateApiKeyInput`
 * @throws {InputValidationError} If name exceeds 100 chars or expiresAt is not valid ISO 8601
 */
export function validateCreateApiKeyInput(data: unknown): z.infer<typeof CreateApiKeyInputSchema> {
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
export function validateCreateProjectInput(data: unknown): z.infer<typeof CreateProjectInputSchema> {
  return validate(CreateProjectInputSchema, data, 'project creation');
}

/**
 * Validate project update input.
 * @param data - Raw input: `{ name?: string (1-200 chars) }`
 * @returns Validated `UpdateProjectInput`
 * @throws {InputValidationError} If name exceeds 200 chars
 */
export function validateUpdateProjectInput(data: unknown): z.infer<typeof UpdateProjectInputSchema> {
  return validate(UpdateProjectInputSchema, data, 'project update');
}

/**
 * Validate project deletion input. Requires explicit confirmation.
 * @param data - Raw input: `{ confirm: true, confirmationPhrase: string }`
 * @returns Validated `DeleteProjectInput`
 * @throws {InputValidationError} If confirm is not `true` or confirmationPhrase is missing
 */
export function validateDeleteProjectInput(data: unknown): z.infer<typeof DeleteProjectInputSchema> {
  return validate(DeleteProjectInputSchema, data, 'project deletion');
}

/**
 * Validate project rename input.
 * @param data - Raw input: `{ oldName: string, newName: string (1-200 chars) }`
 * @returns Validated `RenameProjectInput`
 * @throws {InputValidationError} If either name is empty or newName exceeds 200 chars
 */
export function validateRenameProjectInput(data: unknown): z.infer<typeof RenameProjectInputSchema> {
  return validate(RenameProjectInputSchema, data, 'project rename');
}

/**
 * Validate merge-projects input (merge-projects spec v0.3.4).
 * Rejects `source === target` at the client boundary — saves the round-trip
 * that would return 400 SAME_PROJECT.
 * @param data - Raw input: `{ source, target, dryRun?, deleteSource?, confirmCrossOrg? }`
 * @returns Validated `MergeProjectsInput`
 * @throws {InputValidationError} If either name is empty or source equals target
 */
export function validateMergeProjectsInput(data: unknown): z.infer<typeof MergeProjectsInputSchema> {
  return validate(MergeProjectsInputSchema, data, 'project merge');
}

/**
 * Validate member-path re-home input (spec §4.1): a slug-shaped `targetOrg`
 * and an optional bounded `reason`.
 * @throws {InputValidationError} If the slug is malformed or the reason is empty/over 500 chars
 */
export function validateRehomeProjectInput(data: unknown): z.infer<typeof RehomeProjectInputSchema> {
  return validate(RehomeProjectInputSchema, data, 'project re-home');
}

/**
 * Validate admin-path re-home input — identical to the member path except
 * `reason` is required (the server rejects a missing one with 400; catching it
 * here keeps the Phase 4 script's failure at row 0, not row 61).
 * @throws {InputValidationError} If `reason` is missing
 */
export function validateAdminRehomeProjectInput(data: unknown): z.infer<typeof AdminRehomeProjectInputSchema> {
  return validate(AdminRehomeProjectInputSchema, data, 'admin project re-home');
}

/**
 * Validate TOTP login completion input.
 * @throws {InputValidationError} If the challenge token is empty or the code is not six digits
 */
export function validateTotpLoginInput(data: unknown): z.infer<typeof TotpLoginInputSchema> {
  return validate(TotpLoginInputSchema, data, 'TOTP login');
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
export function validateSaveRunInput(data: unknown): z.infer<typeof SaveRunInputSchema> {
  return validate(SaveRunInputSchema, data, 'save run');
}

/**
 * Validate archive runs input.
 * @param data - Raw input: `{ project: string }` plus at least one filter:
 *   `beforeRunNumber?`, `beforeDate?` (ISO 8601), `keepLast?`, `reason?` (max 500)
 * @returns Validated `ArchiveRunsInput`
 * @throws {InputValidationError} If project missing or filter constraints violated
 */
export function validateArchiveRunsInput(data: unknown): z.infer<typeof ArchiveRunsInputSchema> {
  return validate(ArchiveRunsInputSchema, data, 'archive runs');
}

/**
 * Validate update run input. All fields are optional but validated when present.
 * @param data - Raw input with optional fields to update
 * @returns Validated update run input
 * @throws {InputValidationError} If field constraints are violated
 */
export function validateUpdateRunInput(data: unknown): z.infer<typeof UpdateRunInputSchema> {
  return validate(UpdateRunInputSchema, data, 'update run');
}

/**
 * Validate update-preview input: analysis concerns only (spec §4 scope rule).
 * The SDK builds the preview request body from the analysis fields alone, so
 * a non-analysis update field passed here would otherwise be silently dropped
 * — never rejected by the server, whose named 400 is unreachable through the
 * SDK. This validator therefore enforces the scope rule client-side: any
 * forbidden key present (even explicitly `null`d) is a named error, matching
 * the server's own wording.
 * @param data - Raw input with optional `analysisRecords` / `analysisSummary`
 * @returns Validated update-preview input
 * @throws {InputValidationError} If a non-analysis update field is present or
 *   analysis field constraints are violated
 */
export function validateUpdateRunPreviewInput(data: unknown): z.infer<typeof UpdateRunPreviewInputSchema> {
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const body = data as Record<string, unknown>;
    const offending = UPDATE_PREVIEW_FORBIDDEN_INPUT_KEYS.filter((k) => body[k] !== undefined);
    if (offending.length > 0) {
      throw new InputValidationError(
        `update-preview accepts analysis concerns only; remove: ${offending.join(', ')}`,
        []
      );
    }
  }
  return validate(UpdateRunPreviewInputSchema, data, 'update-run preview');
}

// ============================================
// ISSUE VALIDATORS
// ============================================

/**
 * Validate user-submitted issue creation input.
 * @param data - Raw input with required: `project` (1-200), `title` (1-500),
 *   `priority` ('critical' | 'high' | 'suggested' | 'backlog').
 *   Optional: `severity`, `category`, `description` (max 10000), `filePath`, `lineNumber`,
 *   `failureCode` (e.g. 'STR-OMI/H'), `failureDomain`, `failureMode`, `agent`, `type`.
 * @returns Validated `CreateUserIssueInput`
 * @throws {InputValidationError} If required fields missing or constraints violated
 */
export function validateCreateUserIssueInput(data: unknown): z.infer<typeof CreateUserIssueInputSchema> {
  return validate(CreateUserIssueInputSchema, data, 'issue creation');
}

/**
 * Validate issue metadata update input. All fields optional.
 * @param data - Raw input: `{ title?, status?, priority?, severity?, failureCode?, filePath?, lineNumber?, ... }`
 * @returns Validated `UpdateIssueInput`
 * @throws {InputValidationError} If any provided field violates its constraints
 */
export function validateUpdateIssueInput(data: unknown): z.infer<typeof UpdateIssueInputSchema> {
  return validate(UpdateIssueInputSchema, data, 'issue update');
}

/**
 * Validate issue status update input.
 * @param data - Raw input: `{ status: Status, reason?: string (max 1000) }`
 * @returns Validated `UpdateIssueStatusInput`
 * @throws {InputValidationError} If status is not a valid Status enum value
 */
export function validateUpdateIssueStatusInput(data: unknown): z.infer<typeof UpdateIssueStatusInputSchema> {
  return validate(UpdateIssueStatusInputSchema, data, 'status update');
}

/**
 * Validate issue note creation input.
 * @param data - Raw input: `{ content: string (1-10000), noteType?: NoteType, createdBy?: string }`
 * @returns Validated `CreateIssueNoteInput`
 * @throws {InputValidationError} If content is empty or exceeds 10000 chars
 */
export function validateCreateIssueNoteInput(data: unknown): z.infer<typeof CreateIssueNoteInputSchema> {
  return validate(CreateIssueNoteInputSchema, data, 'issue note');
}

/**
 * Validate bulk issue status update input. Max 100 items per request.
 * @param data - Raw input: `{ updates: Array<{ issueId?: string, id?: string, status: Status, reason?: string }> }`
 * @returns Validated bulk update input
 * @throws {InputValidationError} If updates array is empty, exceeds 100 items, or any item has invalid status
 */
export function validateBulkStatusUpdateInput(data: unknown): z.infer<typeof BulkStatusUpdateInputSchema> {
  return validate(BulkStatusUpdateInputSchema, data, 'bulk status update');
}


// ============================================
// SIMPLE VALIDATORS
// ============================================
//
// @internal — the three helpers below are generic argument guards used
// internally before API calls. They are exported only via the
// `@uluops/ops-sdk/config` subpath and are not part of the documented public
// surface; prefer the domain validators above. May change without a major bump.

/**
 * @internal Not part of the public API.
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
 * @internal Not part of the public API.
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
 * @internal Not part of the public API.
 * Validate that a value is a positive integer (> 0).
 * @param value - The value to validate (coerced via `Number()`)
 * @param fieldName - Field name for error messages
 * @returns The validated number
 * @throws {InputValidationError} If value is not a positive integer
 */
export function validatePositiveInt(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new InputValidationError(`${fieldName} must be a positive integer`, [
      { code: 'custom', path: [fieldName], message: 'must be a positive integer' }
    ]);
  }
  return num;
}
