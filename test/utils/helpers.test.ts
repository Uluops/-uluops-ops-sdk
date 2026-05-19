import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sleep,
  retry,
  isUuid,
  truncate,
  toSnakeCase,
  toCamelCase,
} from '../../src/utils/helpers.js';
import { TEST_UUID } from '../setup.js';

describe('Helper Utilities', () => {
  describe('sleep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should resolve after specified delay', async () => {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('retry', () => {
    // Named constants for retry test configuration
    const FAST_BASE_DELAY_MS = 10;
    const FAST_MAX_DELAY_MS = 20;
    const CAPPED_BASE_DELAY_MS = 100;
    const CAPPED_MAX_DELAY_MS = 50; // Intentionally lower than base to test cap

    afterEach(() => {
      vi.useRealTimers(); // Ensure timers are reset after each test
    });

    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const result = await retry(fn, { maxRetries: 3, baseDelayMs: FAST_BASE_DELAY_MS });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const error = new Error('always fails');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        retry(fn, { maxRetries: 2, baseDelayMs: FAST_BASE_DELAY_MS, maxDelayMs: FAST_MAX_DELAY_MS })
      ).rejects.toThrow('always fails');

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect shouldRetry predicate', async () => {
      const error = new Error('non-retryable');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        retry(fn, {
          maxRetries: 3,
          shouldRetry: () => false,
        })
      ).rejects.toThrow('non-retryable');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should respect maxDelayMs cap', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const result = await retry(fn, {
        maxRetries: 4,
        baseDelayMs: CAPPED_BASE_DELAY_MS,
        maxDelayMs: CAPPED_MAX_DELAY_MS,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('isUuid', () => {
    it('should return true for valid UUIDs', () => {
      expect(isUuid(TEST_UUID)).toBe(true);
      expect(isUuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isUuid('not-a-uuid')).toBe(false);
      expect(isUuid('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isUuid('')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
    });

    it('should not truncate short strings', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('should handle exact length', () => {
      expect(truncate('Hello', 5)).toBe('Hello');
    });

    it('should handle very short maxLength', () => {
      expect(truncate('Hello World', 4)).toBe('H...');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('newIssues')).toBe('new_issues');
      expect(toSnakeCase('wouldCreate')).toBe('would_create');
      expect(toSnakeCase('falsePositiveRate')).toBe('false_positive_rate');
    });

    it('should handle strings with no uppercase', () => {
      expect(toSnakeCase('simple')).toBe('simple');
    });

    it('should handle consecutive uppercase letters', () => {
      expect(toSnakeCase('XMLParser')).toBe('xml_parser');
      expect(toSnakeCase('getHTTPSUrl')).toBe('get_https_url');
      expect(toSnakeCase('parseJSON')).toBe('parse_json');
    });
  });

  describe('toCamelCase', () => {
    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase('new_issues')).toBe('newIssues');
      expect(toCamelCase('would_create')).toBe('wouldCreate');
      expect(toCamelCase('false_positive_rate')).toBe('falsePositiveRate');
    });

    it('should handle strings with no underscores', () => {
      expect(toCamelCase('simple')).toBe('simple');
    });

    it('should handle digits after underscores', () => {
      expect(toCamelCase('field_1')).toBe('field1');
      expect(toCamelCase('step_2_result')).toBe('step2Result');
    });
  });

});
