import { describe, it, expect } from 'vitest';
import {
  InputValidationError,
  validateRegisterInput,
  validateLoginInput,
  validateCreateProjectInput,
  validateDeleteProjectInput,
  validateRenameProjectInput,
  validateSaveFeaturesListInput,
  validateCreateUserIssueInput,
  validateUpdateIssueStatusInput,
  validateCreateIssueNoteInput,
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
