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

});
