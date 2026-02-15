import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sleep,
  retry,
  deepMerge,
  pick,
  omit,
  compact,
  formatDate,
  isUuid,
  truncate,
  toSnakeCase,
  toCamelCase,
  getFlexibleProperty,
  normalizeKeys,
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

  describe('deepMerge', () => {
    it('should merge flat objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      expect(deepMerge(target, source)).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should deeply merge nested objects', () => {
      const target = { outer: { a: 1, b: 2 } };
      const source = { outer: { b: 3, c: 4 } };
      expect(deepMerge(target, source)).toEqual({ outer: { a: 1, b: 3, c: 4 } });
    });

    it('should not modify original objects', () => {
      const target = { a: 1 };
      const source = { b: 2 };
      deepMerge(target, source);
      expect(target).toEqual({ a: 1 });
    });

    it('should handle arrays by replacing', () => {
      const target = { arr: [1, 2] };
      const source = { arr: [3, 4, 5] };
      expect(deepMerge(target, source)).toEqual({ arr: [3, 4, 5] });
    });

    it('should skip undefined values', () => {
      const target = { a: 1, b: 2 };
      const source = { a: undefined, b: 3 };
      expect(deepMerge(target, source)).toEqual({ a: 1, b: 3 });
    });
  });

  describe('pick', () => {
    it('should pick specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });

    it('should ignore non-existent keys', () => {
      const obj = { a: 1 };
      expect(pick(obj, ['a', 'b' as keyof typeof obj])).toEqual({ a: 1 });
    });

    it('should return empty object for empty keys', () => {
      const obj = { a: 1 };
      expect(pick(obj, [])).toEqual({});
    });
  });

  describe('omit', () => {
    it('should omit specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
    });

    it('should handle omitting non-existent keys', () => {
      const obj = { a: 1 };
      expect(omit(obj, ['b' as keyof typeof obj])).toEqual({ a: 1 });
    });

    it('should return copy when omitting nothing', () => {
      const obj = { a: 1 };
      const result = omit(obj, []);
      expect(result).toEqual({ a: 1 });
      expect(result).not.toBe(obj);
    });
  });

  describe('compact', () => {
    it('should remove undefined values', () => {
      const obj = { a: 1, b: undefined, c: 3 };
      expect(compact(obj)).toEqual({ a: 1, c: 3 });
    });

    it('should keep null values', () => {
      const obj = { a: 1, b: null };
      expect(compact(obj)).toEqual({ a: 1, b: null });
    });

    it('should keep falsy values except undefined', () => {
      const obj = { a: 0, b: '', c: false, d: undefined };
      expect(compact(obj)).toEqual({ a: 0, b: '', c: false });
    });
  });

  describe('formatDate', () => {
    it('should format Date object to ISO string', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(formatDate(date)).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should format date string to ISO string', () => {
      const result = formatDate('2024-01-15T12:00:00Z');
      expect(result).toBe('2024-01-15T12:00:00.000Z');
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
      expect(toSnakeCase('XMLParser')).toBe('_x_m_l_parser');
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

  describe('normalizeKeys', () => {
    it('should convert flat snake_case keys to camelCase', () => {
      const input = { run_number: 1, workflow_type: 'ship' };
      expect(normalizeKeys(input)).toEqual({ runNumber: 1, workflowType: 'ship' });
    });

    it('should recursively convert nested objects', () => {
      const input = {
        project_name: 'test',
        run_details: {
          run_number: 5,
          all_gates_passed: true,
        },
      };
      expect(normalizeKeys(input)).toEqual({
        projectName: 'test',
        runDetails: {
          runNumber: 5,
          allGatesPassed: true,
        },
      });
    });

    it('should handle arrays of objects', () => {
      const input = [
        { file_path: 'src/a.ts', line_number: 10 },
        { file_path: 'src/b.ts', line_number: 20 },
      ];
      expect(normalizeKeys(input)).toEqual([
        { filePath: 'src/a.ts', lineNumber: 10 },
        { filePath: 'src/b.ts', lineNumber: 20 },
      ]);
    });

    it('should handle mixed nested arrays and objects', () => {
      const input = {
        issue_list: [
          { issue_id: '123', failure_code: 'STR-OMI/H' },
        ],
      };
      expect(normalizeKeys(input)).toEqual({
        issueList: [
          { issueId: '123', failureCode: 'STR-OMI/H' },
        ],
      });
    });

    it('should pass through primitives unchanged', () => {
      expect(normalizeKeys('hello')).toBe('hello');
      expect(normalizeKeys(42)).toBe(42);
      expect(normalizeKeys(true)).toBe(true);
      expect(normalizeKeys(null)).toBeNull();
      expect(normalizeKeys(undefined)).toBeUndefined();
    });

    it('should handle keys with digits after underscores', () => {
      const input = { field_1: 'a', field_2b: 'b' };
      expect(normalizeKeys(input)).toEqual({ field1: 'a', field2b: 'b' });
    });

    it('should handle already camelCase keys', () => {
      const input = { alreadyCamel: true, noChange: 42 };
      expect(normalizeKeys(input)).toEqual({ alreadyCamel: true, noChange: 42 });
    });

    it('should handle empty objects and arrays', () => {
      expect(normalizeKeys({})).toEqual({});
      expect(normalizeKeys([])).toEqual([]);
    });
  });

  describe('getFlexibleProperty', () => {
    it('should return camelCase property if it exists', () => {
      const obj = { newIssues: 5 };
      expect(getFlexibleProperty(obj, 'newIssues', 0)).toBe(5);
    });

    it('should fallback to snake_case if camelCase not found', () => {
      const obj = { new_issues: 10 };
      expect(getFlexibleProperty(obj, 'newIssues', 0)).toBe(10);
    });

    it('should return default value if neither format found', () => {
      const obj = { otherField: 'test' };
      expect(getFlexibleProperty(obj, 'newIssues', 42)).toBe(42);
    });

    it('should prefer camelCase over snake_case', () => {
      const obj = { newIssues: 5, new_issues: 10 };
      expect(getFlexibleProperty(obj, 'newIssues', 0)).toBe(5);
    });

    it('should handle undefined values correctly', () => {
      const obj = { newIssues: undefined, new_issues: 10 };
      expect(getFlexibleProperty(obj, 'newIssues', 0)).toBe(10);
    });

    it('should work with various types', () => {
      const obj = {
        isActive: true,
        validationErrors: ['error1', 'error2'],
        preview: { nested: 'value' },
      };
      expect(getFlexibleProperty(obj, 'isActive', false)).toBe(true);
      expect(getFlexibleProperty<string[]>(obj, 'validationErrors', [])).toEqual(['error1', 'error2']);
      expect(getFlexibleProperty(obj, 'preview', null)).toEqual({ nested: 'value' });
    });
  });

});
