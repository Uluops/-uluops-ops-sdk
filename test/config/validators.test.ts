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
  validateUuid,
  validateRequiredString,
  validatePositiveInt,
} from '../../src/config/validators.js';
import { TEST_UUID } from '../setup.js';

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
    it('should accept valid input and return validated data', () => {
      const input = { email: 'test@example.com', password: 'securePass123' };
      const result = validateRegisterInput(input);
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('securePass123');
    });

    it('should reject missing email with descriptive error', () => {
      const input = { password: 'securePass123' };
      try {
        validateRegisterInput(input);
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.message).toContain('register input');
        expect(validationError.errors.length).toBeGreaterThan(0);
        expect(validationError.errors.some(e => e.path.includes('email'))).toBe(true);
      }
    });

    it('should reject invalid email format with path in error', () => {
      const input = { email: 'not-an-email', password: 'securePass123' };
      try {
        validateRegisterInput(input);
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('email'))).toBe(true);
      }
    });

    it('should reject missing password with path in error', () => {
      const input = { email: 'test@example.com' };
      try {
        validateRegisterInput(input);
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('password'))).toBe(true);
      }
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
    it('should accept valid input and return validated data', () => {
      const input = { email: 'test@example.com', password: 'pass123' };
      const result = validateLoginInput(input);
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('pass123');
    });

    it('should reject missing fields with error details', () => {
      try {
        validateLoginInput({});
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.message).toContain('login input');
        expect(validationError.errors.length).toBeGreaterThan(0);
      }
    });

    it('should accept short password (login does not enforce complexity)', () => {
      const result = validateLoginInput({ email: 'test@example.com', password: 'a' });
      expect(result.password).toBe('a');
    });

    it('should accept long password', () => {
      const longPassword = 'x'.repeat(256);
      const result = validateLoginInput({ email: 'test@example.com', password: longPassword });
      expect(result.password).toBe(longPassword);
    });

    it('should reject missing email with error path', () => {
      try {
        validateLoginInput({ password: 'pass123' });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('email'))).toBe(true);
      }
    });

    it('should reject invalid email format', () => {
      expect(() => validateLoginInput({ email: 'not-email', password: 'pass123' })).toThrow(InputValidationError);
    });

    it('should reject missing password with error path', () => {
      try {
        validateLoginInput({ email: 'test@example.com' });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('password'))).toBe(true);
      }
    });
  });

  describe('validateCreateProjectInput', () => {
    it('should accept valid input and return validated data', () => {
      const input = { name: 'my-project' };
      const result = validateCreateProjectInput(input);
      expect(result.name).toBe('my-project');
    });

    it('should reject empty name with error path', () => {
      try {
        validateCreateProjectInput({ name: '' });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.message).toContain('project creation');
        expect(validationError.errors.some(e => e.path.includes('name'))).toBe(true);
      }
    });

    it('should reject missing name', () => {
      expect(() => validateCreateProjectInput({})).toThrow(InputValidationError);
    });
  });

  describe('validateDeleteProjectInput', () => {
    it('should accept valid confirmation and return validated data', () => {
      const input = { confirm: true, confirmationPhrase: 'my-project' };
      const result = validateDeleteProjectInput(input);
      expect(result.confirm).toBe(true);
      expect(result.confirmationPhrase).toBe('my-project');
    });

    it('should reject without confirm flag with error path', () => {
      try {
        validateDeleteProjectInput({ confirmationPhrase: 'my-project' });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('confirm'))).toBe(true);
      }
    });

    it('should reject with confirm: false', () => {
      try {
        validateDeleteProjectInput({ confirm: false, confirmationPhrase: 'my-project' });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateRenameProjectInput', () => {
    it('should accept valid input and return validated data', () => {
      const input = { oldName: 'old-name', newName: 'new-name' };
      const result = validateRenameProjectInput(input);
      expect(result.oldName).toBe('old-name');
      expect(result.newName).toBe('new-name');
    });

    it('should reject missing oldName with error path', () => {
      try {
        validateRenameProjectInput({ newName: 'new-name' });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('oldName'))).toBe(true);
      }
    });

    it('should reject missing newName with error path', () => {
      try {
        validateRenameProjectInput({ oldName: 'old-name' });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('newName'))).toBe(true);
      }
    });
  });

  describe('validateSaveFeaturesListInput', () => {
    it('should accept valid input and return validated data', () => {
      const input = {
        project: 'my-project',
        workflowType: 'post-implementation',
        agents: [{ name: 'code-validator', score: 85, decision: 'PASS' }],
        recommendations: [],
      };
      const result = validateSaveFeaturesListInput(input);
      expect(result.project).toBe('my-project');
      expect(result.workflowType).toBe('post-implementation');
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe('code-validator');
      expect(result.agents[0].score).toBe(85);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should accept input with recommendations and return them', () => {
      const input = {
        project: 'my-project',
        workflowType: 'post-implementation',
        agents: [{ name: 'code-validator', score: 85, decision: 'PASS' }],
        recommendations: [
          { agent: 'code-validator', title: 'Issue', priority: 'suggested' },
        ],
      };
      const result = validateSaveFeaturesListInput(input);
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].title).toBe('Issue');
      expect(result.recommendations[0].priority).toBe('suggested');
    });

    it('should reject missing project with error path', () => {
      try {
        validateSaveFeaturesListInput({
          workflowType: 'post-implementation',
          agents: [{ name: 'test', score: 80, decision: 'PASS' }],
          recommendations: [],
        });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.message).toContain('save run');
        expect(validationError.errors.some(e => e.path.includes('project'))).toBe(true);
      }
    });

    it('should reject invalid validator format with error details', () => {
      try {
        validateSaveFeaturesListInput({
          project: 'my-project',
          workflowType: 'post-implementation',
          agents: [{ name: 'test' }], // missing score and status
          recommendations: [],
        });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateCreateUserIssueInput', () => {
    it('should accept valid minimal input and return validated data', () => {
      const input = {
        project: 'my-project',
        title: 'Bug report',
        priority: 'critical',
      };
      const result = validateCreateUserIssueInput(input);
      expect(result.project).toBe('my-project');
      expect(result.title).toBe('Bug report');
      expect(result.priority).toBe('critical');
    });

    it('should accept valid full input and preserve all fields', () => {
      const input = {
        project: 'my-project',
        title: 'Bug report',
        priority: 'suggested' as const,
        severity: 'high' as const,
        type: 'bug' as const,
        filePath: 'src/index.ts',
        lineNumber: 42,
        description: 'Detailed description',
      };
      const result = validateCreateUserIssueInput(input);
      expect(result.severity).toBe('high');
      expect(result.type).toBe('bug');
      expect(result.filePath).toBe('src/index.ts');
      expect(result.lineNumber).toBe(42);
    });

    it('should reject invalid priority with error details', () => {
      try {
        validateCreateUserIssueInput({
          project: 'my-project',
          title: 'Bug',
          priority: 'invalid',
        });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('priority'))).toBe(true);
      }
    });
  });

  describe('validateUpdateIssueStatusInput', () => {
    it('should accept valid status update and return validated data', () => {
      const result = validateUpdateIssueStatusInput({ status: 'completed' });
      expect(result.status).toBe('completed');
    });

    it('should accept status update with reason and preserve it', () => {
      const result = validateUpdateIssueStatusInput({ status: 'deferred', reason: 'Will fix later' });
      expect(result.status).toBe('deferred');
      expect(result.reason).toBe('Will fix later');
    });

    it('should reject invalid status with error details', () => {
      try {
        validateUpdateIssueStatusInput({ status: 'invalid-status' });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('status'))).toBe(true);
      }
    });
  });

  describe('validateCreateIssueNoteInput', () => {
    it('should accept valid note and return validated data', () => {
      const result = validateCreateIssueNoteInput({ content: 'This is a note' });
      expect(result.content).toBe('This is a note');
    });

    it('should accept note with type and preserve it', () => {
      const result = validateCreateIssueNoteInput({ content: 'Note content', noteType: 'resolution' });
      expect(result.content).toBe('Note content');
      expect(result.noteType).toBe('resolution');
    });

    it('should reject empty content with error path', () => {
      try {
        validateCreateIssueNoteInput({ content: '' });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('content'))).toBe(true);
      }
    });
  });

  describe('validateUpdateProfileInput', () => {
    it('should accept valid name update and return validated data', () => {
      const result = validateUpdateProfileInput({ name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('should accept valid username and return it', () => {
      const result = validateUpdateProfileInput({ username: 'johndoe' });
      expect(result.username).toBe('johndoe');
    });

    it('should reject empty object with error details', () => {
      try {
        validateUpdateProfileInput({});
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.length).toBeGreaterThan(0);
      }
    });

    it('should reject invalid username format', () => {
      expect(() => validateUpdateProfileInput({ username: 'UPPERCASE' })).toThrow(InputValidationError);
    });

    it('should reject username starting with number', () => {
      expect(() => validateUpdateProfileInput({ username: '1abc' })).toThrow(InputValidationError);
    });
  });

  describe('validateChangePasswordInput', () => {
    it('should accept valid input and return validated data', () => {
      const result = validateChangePasswordInput({
        currentPassword: 'oldPass123',
        newPassword: 'newPass456',
      });
      expect(result.currentPassword).toBe('oldPass123');
      expect(result.newPassword).toBe('newPass456');
    });

    it('should reject short new password with error path', () => {
      try {
        validateChangePasswordInput({
          currentPassword: 'oldPass123',
          newPassword: 'short',
        });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('newPassword'))).toBe(true);
      }
    });

    it('should reject missing currentPassword', () => {
      expect(() => validateChangePasswordInput({ newPassword: 'newPass456' })).toThrow(InputValidationError);
    });
  });

  describe('validateResetPasswordInput', () => {
    it('should accept valid input and return validated data', () => {
      const result = validateResetPasswordInput({
        token: 'reset-token-abc',
        password: 'newSecure123',
      });
      expect(result.token).toBe('reset-token-abc');
      expect(result.password).toBe('newSecure123');
    });

    it('should reject missing token with error path', () => {
      try {
        validateResetPasswordInput({ password: 'newSecure123' });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('token'))).toBe(true);
      }
    });

    it('should reject short password', () => {
      expect(() => validateResetPasswordInput({ token: 'abc', password: 'short' })).toThrow(InputValidationError);
    });
  });

  describe('validateCreateApiKeyInput', () => {
    it('should accept empty object and return validated data', () => {
      const result = validateCreateApiKeyInput({});
      expect(result).toBeDefined();
    });

    it('should accept input with name and return it', () => {
      const result = validateCreateApiKeyInput({ name: 'My Key' });
      expect(result.name).toBe('My Key');
    });

    it('should accept input with expiresAt and return it', () => {
      const result = validateCreateApiKeyInput({ expiresAt: '2025-12-31T00:00:00Z' });
      expect(result.expiresAt).toBe('2025-12-31T00:00:00Z');
    });

    it('should reject name exceeding 100 chars with error path', () => {
      try {
        validateCreateApiKeyInput({ name: 'x'.repeat(101) });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('name'))).toBe(true);
      }
    });
  });

  describe('validateArchiveRunsInput', () => {
    it('should accept valid input with beforeRunNumber and return validated data', () => {
      const result = validateArchiveRunsInput({ project: 'my-project', beforeRunNumber: 10 });
      expect(result.project).toBe('my-project');
      expect(result.beforeRunNumber).toBe(10);
    });

    it('should accept valid input with keepLast and return it', () => {
      const result = validateArchiveRunsInput({ project: 'my-project', keepLast: 5 });
      expect(result.project).toBe('my-project');
      expect(result.keepLast).toBe(5);
    });

    it('should reject missing project with error path', () => {
      try {
        validateArchiveRunsInput({ beforeRunNumber: 10 });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('project'))).toBe(true);
      }
    });

    it('should reject zero keepLast', () => {
      expect(() => validateArchiveRunsInput({ project: 'p', keepLast: 0 })).toThrow(InputValidationError);
    });
  });

  describe('validateUpdateIssueInput', () => {
    it('should accept valid title update and return validated data', () => {
      const result = validateUpdateIssueInput({ title: 'Updated title' });
      expect(result.title).toBe('Updated title');
    });

    it('should accept valid severity update and return it', () => {
      const result = validateUpdateIssueInput({ severity: 'high' });
      expect(result.severity).toBe('high');
    });

    it('should accept valid failure code and return it', () => {
      const result = validateUpdateIssueInput({ failureCode: 'SEM-VAL/H' });
      expect(result.failureCode).toBe('SEM-VAL/H');
    });

    it('should reject invalid failure code format with error path', () => {
      try {
        validateUpdateIssueInput({ failureCode: 'invalid' });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('failureCode'))).toBe(true);
      }
    });

    it('should reject empty title with error path', () => {
      try {
        validateUpdateIssueInput({ title: '' });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('title'))).toBe(true);
      }
    });
  });

  describe('validateBulkStatusUpdateInput', () => {
    it('should accept valid updates array and return validated data', () => {
      const result = validateBulkStatusUpdateInput({
        updates: [{ issueId: TEST_UUID, status: 'completed' }],
      });
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].issueId).toBe(TEST_UUID);
      expect(result.updates[0].status).toBe('completed');
    });

    it('should reject empty updates array with error path', () => {
      try {
        validateBulkStatusUpdateInput({ updates: [] });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('updates'))).toBe(true);
      }
    });

    it('should reject invalid status in updates with error details', () => {
      try {
        validateBulkStatusUpdateInput({
          updates: [{ issueId: TEST_UUID, status: 'invalid' }],
        });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateSaveFeaturesListInput - boundaries', () => {
    it('should reject score below 0', () => {
      expect(() => validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        agents: [{ name: 'v', score: -1, decision: 'FAIL' }],
        recommendations: [],
      })).toThrow(InputValidationError);
    });

    it('should reject score above 100', () => {
      expect(() => validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        agents: [{ name: 'v', score: 101, decision: 'FAIL' }],
        recommendations: [],
      })).toThrow(InputValidationError);
    });

    it('should accept score 0 and preserve exact value', () => {
      const result = validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        agents: [{ name: 'v', score: 0, decision: 'FAIL' }],
        recommendations: [],
      });
      expect(result.agents[0].score).toBe(0);
    });

    it('should accept score 100 and preserve exact value', () => {
      const result = validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        agents: [{ name: 'v', score: 100, decision: 'PASS' }],
        recommendations: [],
      });
      expect(result.agents[0].score).toBe(100);
    });

    it('should reject empty validators array with error details', () => {
      try {
        validateSaveFeaturesListInput({
          project: 'p', workflowType: 'w',
          agents: [],
          recommendations: [],
        });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.some(e => e.path.includes('agents'))).toBe(true);
      }
    });

    it('should reject invalid recommendation priority with error path', () => {
      try {
        validateSaveFeaturesListInput({
          project: 'p', workflowType: 'w',
          agents: [{ name: 'v', score: 80, decision: 'PASS' }],
          recommendations: [{ agent: 'v', title: 'Issue', priority: 'invalid' }],
        });
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InputValidationError);
        const validationError = error as InputValidationError;
        expect(validationError.errors.length).toBeGreaterThan(0);
      }
    });

    it('should preserve all validator fields through validation', () => {
      const result = validateSaveFeaturesListInput({
        project: 'test-proj', workflowType: 'ship',
        agents: [
          { name: 'code-validator', score: 88, decision: 'PASS', model: 'sonnet' },
          { name: 'test-architect', score: 72, decision: 'APPROVED' },
        ],
        recommendations: [
          { agent: 'code-validator', title: 'Fix bug', priority: 'critical', severity: 'high' },
        ],
      });
      expect(result.agents).toHaveLength(2);
      expect(result.agents[0].name).toBe('code-validator');
      expect(result.agents[1].score).toBe(72);
      expect(result.recommendations[0].severity).toBe('high');
    });
  });

  describe('validateSaveFeaturesListInput - complex boundary values', () => {
    it('should accept recommendation title at max length (500 chars)', () => {
      const result = validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        agents: [{ name: 'v', score: 50, decision: 'PASS' }],
        recommendations: [{ agent: 'v', title: 'x'.repeat(500), priority: 'suggested' }],
      });
      expect(result.recommendations[0].title).toHaveLength(500);
    });

    it('should reject recommendation title exceeding max length (501 chars)', () => {
      expect(() => validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        agents: [{ name: 'v', score: 50, decision: 'PASS' }],
        recommendations: [{ agent: 'v', title: 'x'.repeat(501), priority: 'suggested' }],
      })).toThrow(InputValidationError);
    });

    it('should accept description at max length (10000 chars)', () => {
      const result = validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        agents: [{ name: 'v', score: 50, decision: 'PASS' }],
        recommendations: [{
          agent: 'v', title: 'Issue', priority: 'suggested',
          description: 'x'.repeat(10000),
        }],
      });
      expect(result.recommendations[0].description).toHaveLength(10000);
    });

    it('should reject description exceeding max length (10001 chars)', () => {
      expect(() => validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        agents: [{ name: 'v', score: 50, decision: 'PASS' }],
        recommendations: [{
          agent: 'v', title: 'Issue', priority: 'suggested',
          description: 'x'.repeat(10001),
        }],
      })).toThrow(InputValidationError);
    });

    it('should accept filePath at max length (1000 chars)', () => {
      const result = validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        agents: [{ name: 'v', score: 50, decision: 'PASS' }],
        recommendations: [{
          agent: 'v', title: 'Issue', priority: 'suggested',
          filePath: 'x'.repeat(1000),
        }],
      });
      expect(result.recommendations[0].filePath).toHaveLength(1000);
    });

    it('should accept project name at max length (200 chars)', () => {
      const result = validateSaveFeaturesListInput({
        project: 'p'.repeat(200), workflowType: 'w',
        agents: [{ name: 'v', score: 50, decision: 'PASS' }],
        recommendations: [],
      });
      expect(result.project).toHaveLength(200);
    });

    it('should accept multiple agents and recommendations', () => {
      const agents = Array.from({ length: 20 }, (_, i) => ({
        name: `agent-${i}`, score: i * 5, decision: 'PASS',
      }));
      const recommendations = Array.from({ length: 50 }, (_, i) => ({
        agent: `agent-${i % 20}`, title: `Issue ${i}`, priority: 'suggested' as const,
      }));
      const result = validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w', agents, recommendations,
      });
      expect(result.agents).toHaveLength(20);
      expect(result.recommendations).toHaveLength(50);
    });

    it('should accept empty recommendations array', () => {
      const result = validateSaveFeaturesListInput({
        project: 'p', workflowType: 'w',
        agents: [{ name: 'v', score: 50, decision: 'PASS' }],
        recommendations: [],
      });
      expect(result.recommendations).toHaveLength(0);
    });
  });

  describe('validateCreateUserIssueInput - boundary values', () => {
    it('should accept title at max length (500 chars)', () => {
      const result = validateCreateUserIssueInput({
        project: 'p', title: 'x'.repeat(500), priority: 'suggested',
      });
      expect(result.title).toHaveLength(500);
    });

    it('should reject title exceeding max length', () => {
      expect(() => validateCreateUserIssueInput({
        project: 'p', title: 'x'.repeat(501), priority: 'suggested',
      })).toThrow(InputValidationError);
    });

    it('should accept lineNumber at zero boundary', () => {
      const result = validateCreateUserIssueInput({
        project: 'p', title: 'Issue', priority: 'suggested', lineNumber: 0,
      });
      expect(result.lineNumber).toBe(0);
    });

    it('should reject negative lineNumber', () => {
      expect(() => validateCreateUserIssueInput({
        project: 'p', title: 'Issue', priority: 'suggested', lineNumber: -1,
      })).toThrow(InputValidationError);
    });
  });

  describe('validateUuid', () => {
    it('should accept valid UUID', () => {
      expect(() =>
        validateUuid(TEST_UUID, 'id')
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
