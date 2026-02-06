import { describe, it, expect } from 'vitest';
import {
  InputValidationError,
  validateRegisterInput,
  validateLoginInput,
  validateUpdateProfileInput,
  validateChangePasswordInput,
  validateResetPasswordInput,
  validateCreateApiKeyInput,
  validateCreateProjectInput,
  validateDeleteProjectInput,
  validateRenameProjectInput,
  validateSaveFeaturesListInput,
  validateArchiveRunsInput,
  validateCreateUserIssueInput,
  validateUpdateIssueInput,
  validateUpdateIssueStatusInput,
  validateCreateIssueNoteInput,
  validateBulkStatusUpdateInput,
  validateAdminCreateUserInput,
  validateAdminUpdateUserInput,
  validateBulkDeactivateInput,
  validateUuid,
  validateRequiredString,
  validatePositiveInt,
} from '../../src/config/validators.js';

describe('Config Validators', () => {
  describe('InputValidationError', () => {
    it('should create error with message and errors array', () => {
      const error = new InputValidationError('Test error', [
        { code: 'invalid_type', message: 'Expected string', path: ['field'] } as any,
      ]);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('InputValidationError');
      expect(error.errors).toHaveLength(1);
    });
  });

  describe('validateRegisterInput', () => {
    it('should accept valid input', () => {
      const input = { email: 'test@example.com', password: 'securePass123' };
      expect(() => validateRegisterInput(input)).not.toThrow();
    });

    it('should reject missing email', () => {
      const input = { password: 'securePass123' };
      expect(() => validateRegisterInput(input)).toThrow(InputValidationError);
    });

    it('should reject invalid email format', () => {
      const input = { email: 'not-an-email', password: 'securePass123' };
      expect(() => validateRegisterInput(input)).toThrow(InputValidationError);
    });

    it('should reject missing password', () => {
      const input = { email: 'test@example.com' };
      expect(() => validateRegisterInput(input)).toThrow(InputValidationError);
    });

    it('should reject short password (< 8 chars)', () => {
      const input = { email: 'test@example.com', password: 'short' };
      expect(() => validateRegisterInput(input)).toThrow(InputValidationError);
    });

    it('should accept exactly 8 char password with complexity', () => {
      const input = { email: 'test@example.com', password: 'Abcdef1!' };
      expect(() => validateRegisterInput(input)).not.toThrow();
    });

    it('should reject password without uppercase', () => {
      const input = { email: 'test@example.com', password: 'abcdefg1' };
      expect(() => validateRegisterInput(input)).toThrow(InputValidationError);
    });

    it('should reject password without lowercase', () => {
      const input = { email: 'test@example.com', password: 'ABCDEFG1' };
      expect(() => validateRegisterInput(input)).toThrow(InputValidationError);
    });

    it('should reject password without digit', () => {
      const input = { email: 'test@example.com', password: 'Abcdefgh' };
      expect(() => validateRegisterInput(input)).toThrow(InputValidationError);
    });

    it('should reject password exceeding 128 chars', () => {
      const input = { email: 'test@example.com', password: 'Aa1' + 'a'.repeat(126) };
      expect(() => validateRegisterInput(input)).toThrow(InputValidationError);
    });
  });

  describe('validateLoginInput', () => {
    it('should accept valid input', () => {
      const input = { email: 'test@example.com', password: 'pass123' };
      expect(() => validateLoginInput(input)).not.toThrow();
    });

    it('should reject missing fields', () => {
      expect(() => validateLoginInput({})).toThrow(InputValidationError);
    });
  });

  describe('validateCreateProjectInput', () => {
    it('should accept valid input', () => {
      const input = { name: 'my-project' };
      expect(() => validateCreateProjectInput(input)).not.toThrow();
    });

    it('should reject empty name', () => {
      const input = { name: '' };
      expect(() => validateCreateProjectInput(input)).toThrow(InputValidationError);
    });

    it('should reject missing name', () => {
      expect(() => validateCreateProjectInput({})).toThrow(InputValidationError);
    });
  });

  describe('validateDeleteProjectInput', () => {
    it('should accept valid confirmation', () => {
      const input = { confirm: true, confirmationPhrase: 'my-project' };
      expect(() => validateDeleteProjectInput(input)).not.toThrow();
    });

    it('should reject without confirm flag', () => {
      const input = { confirmationPhrase: 'my-project' };
      expect(() => validateDeleteProjectInput(input)).toThrow(InputValidationError);
    });

    it('should reject with confirm: false', () => {
      const input = { confirm: false, confirmationPhrase: 'my-project' };
      expect(() => validateDeleteProjectInput(input)).toThrow(InputValidationError);
    });
  });

  describe('validateRenameProjectInput', () => {
    it('should accept valid input', () => {
      const input = { oldName: 'old-name', newName: 'new-name' };
      expect(() => validateRenameProjectInput(input)).not.toThrow();
    });

    it('should reject missing oldName', () => {
      const input = { newName: 'new-name' };
      expect(() => validateRenameProjectInput(input)).toThrow(InputValidationError);
    });

    it('should reject missing newName', () => {
      const input = { oldName: 'old-name' };
      expect(() => validateRenameProjectInput(input)).toThrow(InputValidationError);
    });
  });

  describe('validateSaveFeaturesListInput', () => {
    it('should accept valid input with empty recommendations', () => {
      const input = {
        project: 'my-project',
        workflowType: 'post-implementation',
        validators: [{ name: 'code-validator', score: 85, status: 'PASS' }],
        recommendations: [],
      };
      expect(() => validateSaveFeaturesListInput(input)).not.toThrow();
    });

    it('should accept input with recommendations', () => {
      const input = {
        project: 'my-project',
        workflowType: 'post-implementation',
        validators: [{ name: 'code-validator', score: 85, status: 'PASS' }],
        recommendations: [
          { validator: 'code-validator', title: 'Issue', priority: 'suggested' },
        ],
      };
      expect(() => validateSaveFeaturesListInput(input)).not.toThrow();
    });

    it('should reject missing project', () => {
      const input = {
        workflowType: 'post-implementation',
        validators: [{ name: 'test', score: 80, status: 'PASS' }],
        recommendations: [],
      };
      expect(() => validateSaveFeaturesListInput(input)).toThrow(InputValidationError);
    });

    it('should reject invalid validator format', () => {
      const input = {
        project: 'my-project',
        workflowType: 'post-implementation',
        validators: [{ name: 'test' }], // missing score and status
        recommendations: [],
      };
      expect(() => validateSaveFeaturesListInput(input)).toThrow(InputValidationError);
    });
  });

  describe('validateCreateUserIssueInput', () => {
    it('should accept valid minimal input', () => {
      const input = {
        project: 'my-project',
        title: 'Bug report',
        priority: 'critical',
      };
      expect(() => validateCreateUserIssueInput(input)).not.toThrow();
    });

    it('should accept valid full input', () => {
      const input = {
        project: 'my-project',
        title: 'Bug report',
        priority: 'suggested',
        severity: 'high',
        type: 'bug',
        filePath: 'src/index.ts',
        lineNumber: 42,
        description: 'Detailed description',
      };
      expect(() => validateCreateUserIssueInput(input)).not.toThrow();
    });

    it('should reject invalid priority', () => {
      const input = {
        project: 'my-project',
        title: 'Bug',
        priority: 'invalid',
      };
      expect(() => validateCreateUserIssueInput(input)).toThrow(InputValidationError);
    });
  });

  describe('validateUpdateIssueStatusInput', () => {
    it('should accept valid status update', () => {
      const input = { status: 'completed' };
      expect(() => validateUpdateIssueStatusInput(input)).not.toThrow();
    });

    it('should accept status update with reason', () => {
      const input = { status: 'deferred', reason: 'Will fix later' };
      expect(() => validateUpdateIssueStatusInput(input)).not.toThrow();
    });

    it('should reject invalid status', () => {
      const input = { status: 'invalid-status' };
      expect(() => validateUpdateIssueStatusInput(input)).toThrow(InputValidationError);
    });
  });

  describe('validateCreateIssueNoteInput', () => {
    it('should accept valid note', () => {
      const input = { content: 'This is a note' };
      expect(() => validateCreateIssueNoteInput(input)).not.toThrow();
    });

    it('should accept note with type', () => {
      const input = { content: 'Note content', noteType: 'resolution' };
      expect(() => validateCreateIssueNoteInput(input)).not.toThrow();
    });

    it('should reject empty content', () => {
      const input = { content: '' };
      expect(() => validateCreateIssueNoteInput(input)).toThrow(InputValidationError);
    });
  });

  describe('validateUpdateProfileInput', () => {
    it('should accept valid name update', () => {
      expect(() => validateUpdateProfileInput({ name: 'New Name' })).not.toThrow();
    });

    it('should accept valid username', () => {
      expect(() => validateUpdateProfileInput({ username: 'johndoe' })).not.toThrow();
    });

    it('should reject empty object (no fields)', () => {
      expect(() => validateUpdateProfileInput({})).toThrow(InputValidationError);
    });

    it('should reject invalid username format', () => {
      expect(() => validateUpdateProfileInput({ username: 'UPPERCASE' })).toThrow(InputValidationError);
    });

    it('should reject username starting with number', () => {
      expect(() => validateUpdateProfileInput({ username: '1abc' })).toThrow(InputValidationError);
    });
  });

  describe('validateChangePasswordInput', () => {
    it('should accept valid input', () => {
      expect(() => validateChangePasswordInput({
        currentPassword: 'oldPass123',
        newPassword: 'newPass456',
      })).not.toThrow();
    });

    it('should reject short new password', () => {
      expect(() => validateChangePasswordInput({
        currentPassword: 'oldPass123',
        newPassword: 'short',
      })).toThrow(InputValidationError);
    });

    it('should reject missing currentPassword', () => {
      expect(() => validateChangePasswordInput({ newPassword: 'newPass456' })).toThrow(InputValidationError);
    });
  });

  describe('validateResetPasswordInput', () => {
    it('should accept valid input', () => {
      expect(() => validateResetPasswordInput({
        token: 'reset-token-abc',
        password: 'newSecure123',
      })).not.toThrow();
    });

    it('should reject missing token', () => {
      expect(() => validateResetPasswordInput({ password: 'newSecure123' })).toThrow(InputValidationError);
    });

    it('should reject short password', () => {
      expect(() => validateResetPasswordInput({ token: 'abc', password: 'short' })).toThrow(InputValidationError);
    });
  });

  describe('validateCreateApiKeyInput', () => {
    it('should accept empty object', () => {
      expect(() => validateCreateApiKeyInput({})).not.toThrow();
    });

    it('should accept input with name', () => {
      expect(() => validateCreateApiKeyInput({ name: 'My Key' })).not.toThrow();
    });

    it('should accept input with expiresAt', () => {
      expect(() => validateCreateApiKeyInput({ expiresAt: '2025-12-31T00:00:00Z' })).not.toThrow();
    });

    it('should reject name exceeding 100 chars', () => {
      expect(() => validateCreateApiKeyInput({ name: 'x'.repeat(101) })).toThrow(InputValidationError);
    });
  });

  describe('validateArchiveRunsInput', () => {
    it('should accept valid input with beforeRunNumber', () => {
      expect(() => validateArchiveRunsInput({ project: 'my-project', beforeRunNumber: 10 })).not.toThrow();
    });

    it('should accept valid input with keepLast', () => {
      expect(() => validateArchiveRunsInput({ project: 'my-project', keepLast: 5 })).not.toThrow();
    });

    it('should reject missing project', () => {
      expect(() => validateArchiveRunsInput({ beforeRunNumber: 10 })).toThrow(InputValidationError);
    });

    it('should reject zero keepLast', () => {
      expect(() => validateArchiveRunsInput({ project: 'p', keepLast: 0 })).toThrow(InputValidationError);
    });
  });

  describe('validateUpdateIssueInput', () => {
    it('should accept valid title update', () => {
      expect(() => validateUpdateIssueInput({ title: 'Updated title' })).not.toThrow();
    });

    it('should accept valid severity update', () => {
      expect(() => validateUpdateIssueInput({ severity: 'high' })).not.toThrow();
    });

    it('should accept valid failure code', () => {
      expect(() => validateUpdateIssueInput({ failureCode: 'SEM-VAL/H' })).not.toThrow();
    });

    it('should reject invalid failure code format', () => {
      expect(() => validateUpdateIssueInput({ failureCode: 'invalid' })).toThrow(InputValidationError);
    });

    it('should reject empty title', () => {
      expect(() => validateUpdateIssueInput({ title: '' })).toThrow(InputValidationError);
    });
  });

  describe('validateBulkStatusUpdateInput', () => {
    it('should accept valid updates array', () => {
      expect(() => validateBulkStatusUpdateInput({
        updates: [{ issueId: '550e8400-e29b-41d4-a716-446655440000', status: 'completed' }],
      })).not.toThrow();
    });

    it('should reject empty updates array', () => {
      expect(() => validateBulkStatusUpdateInput({ updates: [] })).toThrow(InputValidationError);
    });

    it('should reject invalid status in updates', () => {
      expect(() => validateBulkStatusUpdateInput({
        updates: [{ issueId: '550e8400-e29b-41d4-a716-446655440000', status: 'invalid' }],
      })).toThrow(InputValidationError);
    });
  });

  describe('validateAdminCreateUserInput', () => {
    it('should accept valid input', () => {
      expect(() => validateAdminCreateUserInput({
        email: 'new@example.com',
        role: 'developer',
        subscriptionTier: 'free',
      })).not.toThrow();
    });

    it('should accept input with optional password', () => {
      expect(() => validateAdminCreateUserInput({
        email: 'new@example.com',
        password: 'securePass123',
        role: 'admin',
        subscriptionTier: 'enterprise',
      })).not.toThrow();
    });

    it('should reject invalid role', () => {
      expect(() => validateAdminCreateUserInput({
        email: 'new@example.com',
        role: 'superadmin',
        subscriptionTier: 'free',
      })).toThrow(InputValidationError);
    });

    it('should reject invalid subscription tier', () => {
      expect(() => validateAdminCreateUserInput({
        email: 'new@example.com',
        role: 'developer',
        subscriptionTier: 'platinum',
      })).toThrow(InputValidationError);
    });

    it('should reject missing required fields', () => {
      expect(() => validateAdminCreateUserInput({ email: 'new@example.com' })).toThrow(InputValidationError);
    });
  });

  describe('validateAdminUpdateUserInput', () => {
    it('should accept valid role update', () => {
      expect(() => validateAdminUpdateUserInput({ role: 'admin' })).not.toThrow();
    });

    it('should accept valid tier update', () => {
      expect(() => validateAdminUpdateUserInput({ subscriptionTier: 'pro' })).not.toThrow();
    });

    it('should reject empty object (no fields)', () => {
      expect(() => validateAdminUpdateUserInput({})).toThrow(InputValidationError);
    });
  });

  describe('validateBulkDeactivateInput', () => {
    it('should accept valid UUID array', () => {
      expect(() => validateBulkDeactivateInput({
        userIds: ['550e8400-e29b-41d4-a716-446655440000'],
      })).not.toThrow();
    });

    it('should reject empty array', () => {
      expect(() => validateBulkDeactivateInput({ userIds: [] })).toThrow(InputValidationError);
    });

    it('should reject non-UUID strings', () => {
      expect(() => validateBulkDeactivateInput({ userIds: ['not-a-uuid'] })).toThrow(InputValidationError);
    });
  });

  describe('validateSaveFeaturesListInput - boundaries', () => {
    it('should reject score below 0', () => {
      expect(() => validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        validators: [{ name: 'v', score: -1, status: 'FAIL' }],
        recommendations: [],
      })).toThrow(InputValidationError);
    });

    it('should reject score above 100', () => {
      expect(() => validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        validators: [{ name: 'v', score: 101, status: 'FAIL' }],
        recommendations: [],
      })).toThrow(InputValidationError);
    });

    it('should accept score at boundaries (0 and 100)', () => {
      expect(() => validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        validators: [{ name: 'v', score: 0, status: 'FAIL' }],
        recommendations: [],
      })).not.toThrow();
      expect(() => validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        validators: [{ name: 'v', score: 100, status: 'PASS' }],
        recommendations: [],
      })).not.toThrow();
    });

    it('should reject empty validators array', () => {
      expect(() => validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        validators: [],
        recommendations: [],
      })).toThrow(InputValidationError);
    });

    it('should reject invalid recommendation priority', () => {
      expect(() => validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        validators: [{ name: 'v', score: 80, status: 'PASS' }],
        recommendations: [{ validator: 'v', title: 'Issue', priority: 'invalid' }],
      })).toThrow(InputValidationError);
    });
  });

  describe('validateUuid', () => {
    it('should accept valid UUID', () => {
      expect(() =>
        validateUuid('550e8400-e29b-41d4-a716-446655440000', 'id')
      ).not.toThrow();
    });

    it('should reject invalid UUID', () => {
      expect(() => validateUuid('not-a-uuid', 'id')).toThrow(InputValidationError);
    });

    it('should include field name in error message', () => {
      try {
        validateUuid('invalid', 'userId');
        expect.fail('Should throw');
      } catch (error) {
        expect((error as Error).message).toContain('userId');
      }
    });
  });

  describe('validateRequiredString', () => {
    it('should accept non-empty string', () => {
      expect(validateRequiredString('hello', 'name')).toBe('hello');
    });

    it('should trim whitespace', () => {
      expect(validateRequiredString('  hello  ', 'name')).toBe('hello');
    });

    it('should reject empty string', () => {
      expect(() => validateRequiredString('', 'name')).toThrow(InputValidationError);
    });

    it('should reject whitespace-only string', () => {
      expect(() => validateRequiredString('   ', 'name')).toThrow(InputValidationError);
    });

    it('should reject non-string values', () => {
      expect(() => validateRequiredString(123, 'name')).toThrow(InputValidationError);
      expect(() => validateRequiredString(null, 'name')).toThrow(InputValidationError);
      expect(() => validateRequiredString(undefined, 'name')).toThrow(InputValidationError);
    });
  });

  describe('validatePositiveInt', () => {
    it('should accept positive integer', () => {
      expect(validatePositiveInt(5, 'count')).toBe(5);
    });

    it('should accept 1 (boundary condition)', () => {
      expect(validatePositiveInt(1, 'count')).toBe(1);
    });

    it('should reject -1 (boundary condition)', () => {
      expect(() => validatePositiveInt(-1, 'count')).toThrow(InputValidationError);
    });

    it('should accept numeric string', () => {
      expect(validatePositiveInt('10', 'count')).toBe(10);
    });

    it('should reject zero', () => {
      expect(() => validatePositiveInt(0, 'count')).toThrow(InputValidationError);
    });

    it('should reject negative numbers', () => {
      expect(() => validatePositiveInt(-5, 'count')).toThrow(InputValidationError);
    });

    it('should reject floats', () => {
      expect(() => validatePositiveInt(3.14, 'count')).toThrow(InputValidationError);
    });

    it('should reject non-numeric values', () => {
      expect(() => validatePositiveInt('abc', 'count')).toThrow(InputValidationError);
    });
  });
});
