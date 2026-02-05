import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sleep,
  retry,
  toSnakeCase,
  toCamelCase,
  deepMerge,
  pick,
  omit,
  compact,
  formatDate,
  isUuid,
  truncate,
  buildQueryString,
} from '../../src/utils/helpers.js';

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

      const result = await retry(fn, { maxRetries: 3, baseDelayMs: 10 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      vi.useRealTimers(); // Use real timers for this test
      const error = new Error('always fails');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        retry(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 20 })
      ).rejects.toThrow('always fails');

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect shouldRetry predicate', async () => {
      vi.useRealTimers();
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
      vi.useRealTimers();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const result = await retry(fn, {
        maxRetries: 4,
        baseDelayMs: 100,
        maxDelayMs: 50, // Cap should limit delay
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('toSnakeCase', () => {
    it('should convert camelCase keys to snake_case', () => {
      const input = { firstName: 'John', lastName: 'Doe', createdAt: '2024-01-01' };
      const result = toSnakeCase(input);
      expect(result).toEqual({
        first_name: 'John',
        last_name: 'Doe',
        created_at: '2024-01-01',
      });
    });

    it('should handle already snake_case keys', () => {
      const input = { already_snake: 'value' };
      const result = toSnakeCase(input);
      expect(result).toEqual({ already_snake: 'value' });
    });

    it('should handle empty object', () => {
      expect(toSnakeCase({})).toEqual({});
    });

    it('should preserve values', () => {
      const input = { someValue: 123, anotherValue: null };
      const result = toSnakeCase(input);
      expect(result.some_value).toBe(123);
      expect(result.another_value).toBeNull();
    });
  });

  describe('toCamelCase', () => {
    it('should convert snake_case keys to camelCase', () => {
      const input = { first_name: 'John', last_name: 'Doe', created_at: '2024-01-01' };
      const result = toCamelCase(input);
      expect(result).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        createdAt: '2024-01-01',
      });
    });

    it('should handle already camelCase keys', () => {
      const input = { alreadyCamel: 'value' };
      const result = toCamelCase(input);
      expect(result).toEqual({ alreadyCamel: 'value' });
    });

    it('should handle empty object', () => {
      expect(toCamelCase({})).toEqual({});
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
      expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
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

  describe('buildQueryString', () => {
    it('should build query string from params', () => {
      const params = { name: 'test', limit: 10 };
      expect(buildQueryString(params)).toBe('?name=test&limit=10');
    });

    it('should skip undefined and null values', () => {
      const params = { a: 1, b: undefined, c: null, d: 2 };
      expect(buildQueryString(params)).toBe('?a=1&d=2');
    });

    it('should handle array values', () => {
      const params = { tags: ['a', 'b', 'c'] };
      expect(buildQueryString(params)).toBe('?tags=a&tags=b&tags=c');
    });

    it('should encode special characters', () => {
      const params = { query: 'hello world', filter: 'a&b' };
      expect(buildQueryString(params)).toBe('?query=hello%20world&filter=a%26b');
    });

    it('should return empty string for empty params', () => {
      expect(buildQueryString({})).toBe('');
    });

    it('should return empty string when all values are undefined/null', () => {
      expect(buildQueryString({ a: undefined, b: null })).toBe('');
    });
  });
});
