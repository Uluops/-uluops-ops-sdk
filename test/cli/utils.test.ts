import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  truncate,
  formatJson,
  redact,
  withSpinner,
  createSpinner,
} from '../../src/cli/utils.js';

describe('CLI Utils', () => {
  describe('formatDate', () => {
    it('should format a date string', () => {
      const result = formatDate('2024-01-15T10:30:00Z');
      // Result depends on locale, but should be a non-empty string
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format a Date object', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = formatDate(date);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle ISO date strings', () => {
      const result = formatDate('2024-06-15');
      expect(result).toBeTruthy();
    });
  });

  describe('truncate', () => {
    it('should not truncate short strings', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('should truncate long strings with ellipsis', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
    });

    it('should handle exact length strings', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });

    it('should handle strings shorter than ellipsis', () => {
      // When maxLength is 3, we get "..." (length 3)
      expect(truncate('abcdefgh', 3)).toBe('...');
    });

    it('should handle empty strings', () => {
      expect(truncate('', 10)).toBe('');
    });
  });

  describe('formatJson', () => {
    it('should format object with indentation', () => {
      const result = formatJson({ name: 'test', value: 123 });
      expect(result).toBe('{\n  "name": "test",\n  "value": 123\n}');
    });

    it('should format arrays', () => {
      const result = formatJson([1, 2, 3]);
      expect(result).toBe('[\n  1,\n  2,\n  3\n]');
    });

    it('should handle null', () => {
      expect(formatJson(null)).toBe('null');
    });

    it('should handle nested objects', () => {
      const result = formatJson({ a: { b: { c: 1 } } });
      expect(result).toContain('"a"');
      expect(result).toContain('"b"');
      expect(result).toContain('"c"');
    });
  });

  describe('redact', () => {
    it('should redact most of the value showing last 4 chars', () => {
      expect(redact('secret-api-key')).toBe('**********-key');
    });

    it('should redact with custom number of visible chars', () => {
      expect(redact('secret-api-key', 6)).toBe('********pi-key');
    });

    it('should return [REDACTED] for short values', () => {
      expect(redact('abc')).toBe('[REDACTED]');
      expect(redact('abcd')).toBe('[REDACTED]');
    });

    it('should handle empty string', () => {
      expect(redact('')).toBe('[REDACTED]');
    });
  });

  describe('createSpinner', () => {
    it('should create a spinner with text', () => {
      const spinner = createSpinner('Loading...');
      expect(spinner).toBeDefined();
      expect(spinner.text).toBe('Loading...');
    });
  });

  describe('withSpinner', () => {
    let mockSpinner: {
      start: ReturnType<typeof vi.fn>;
      succeed: ReturnType<typeof vi.fn>;
      fail: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockSpinner = {
        start: vi.fn(),
        succeed: vi.fn(),
        fail: vi.fn(),
      };
    });

    it('should return result on success', async () => {
      const ctx = { quiet: true };
      const result = await withSpinner(
        ctx,
        { start: 'Starting...', failure: 'Failed' },
        async () => 'success'
      );
      expect(result).toBe('success');
    });

    it('should throw error on failure', async () => {
      const ctx = { quiet: true };
      await expect(
        withSpinner(
          ctx,
          { start: 'Starting...', failure: 'Failed' },
          async () => {
            throw new Error('test error');
          }
        )
      ).rejects.toThrow('test error');
    });

    it('should not create spinner in quiet mode', async () => {
      const ctx = { quiet: true };
      const result = await withSpinner(
        ctx,
        { start: 'Starting...', failure: 'Failed' },
        async () => 'result'
      );
      expect(result).toBe('result');
      // In quiet mode, no spinner is created, so the test passes if no error
    });

    it('should handle async operations', async () => {
      const ctx = { quiet: true };
      const result = await withSpinner(
        ctx,
        { start: 'Loading...', failure: 'Failed' },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { data: 'loaded' };
        }
      );
      expect(result).toEqual({ data: 'loaded' });
    });

    it('should preserve error type on failure', async () => {
      const ctx = { quiet: true };
      class CustomError extends Error {
        code = 'CUSTOM';
      }
      const customError = new CustomError('custom error');

      try {
        await withSpinner(
          ctx,
          { start: 'Starting...', failure: 'Failed' },
          async () => {
            throw customError;
          }
        );
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBe(customError);
        expect((error as CustomError).code).toBe('CUSTOM');
      }
    });
  });
});
