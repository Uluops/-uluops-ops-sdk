import { describe, it, expect } from 'vitest';
import { buildIssueListParams } from '../../src/operations/query-utils.js';
import { toApiQuery } from '../../src/http/http-client.js';

describe('query-utils', () => {
  describe('buildIssueListParams', () => {
    it('should return undefined when no query provided', () => {
      expect(buildIssueListParams()).toBeUndefined();
      expect(buildIssueListParams(undefined)).toBeUndefined();
    });

    it('should convert camelCase keys to snake_case', () => {
      const query = {
        status: 'open',
        priority: 'critical',
        severity: 'high',
        failureDomain: 'SEM',
        validator: 'code-validator',
        dateStart: '2025-01-01',
        dateEnd: '2025-12-31',
      };
      const result = buildIssueListParams(query);
      expect(result).toEqual({
        status: 'open',
        priority: 'critical',
        severity: 'high',
        failure_domain: 'SEM',
        validator: 'code-validator',
        date_start: '2025-01-01',
        date_end: '2025-12-31',
      });
    });

    it('should pass through numeric fields with snake_case keys', () => {
      const result = buildIssueListParams({ limit: 50, offset: 10, minTimesSeen: 3 });
      expect(result?.limit).toBe(50);
      expect(result?.offset).toBe(10);
      expect(result?.min_times_seen).toBe(3);
    });

    it('should pass through boolean includeResolved as snake_case', () => {
      const result = buildIssueListParams({ includeResolved: true });
      expect(result?.include_resolved).toBe(true);

      const result2 = buildIssueListParams({ includeResolved: false });
      expect(result2?.include_resolved).toBe(false);
    });

    it('should return undefined for empty query object (all fields undefined)', () => {
      const result = buildIssueListParams({});
      // All undefined values are stripped, leaving empty object → undefined
      expect(result).toBeUndefined();
    });

    it('should strip "all" values instead of passing them through', () => {
      const result = buildIssueListParams({ status: 'all' });
      // 'all' means no filter — param is omitted entirely
      expect(result).toBeUndefined();
    });

    it('should preserve boundary values for limit and offset', () => {
      const result = buildIssueListParams({ limit: 0, offset: 0 });
      expect(result?.limit).toBe(0);
      expect(result?.offset).toBe(0);
    });

    it('should handle a fully populated query with snake_case conversion', () => {
      const query = {
        status: 'open',
        priority: 'critical',
        severity: 'high',
        failureDomain: 'STR',
        validator: 'test-architect',
        limit: 100,
        offset: 25,
        includeResolved: false,
        minTimesSeen: 2,
        dateStart: '2025-06-01',
        dateEnd: '2025-06-30',
      };
      const result = buildIssueListParams(query);
      expect(result).toEqual({
        status: 'open',
        priority: 'critical',
        severity: 'high',
        failure_domain: 'STR',
        validator: 'test-architect',
        limit: 100,
        offset: 25,
        include_resolved: false,
        min_times_seen: 2,
        date_start: '2025-06-01',
        date_end: '2025-06-30',
      });
    });
  });

  describe('toApiQuery', () => {
    it('should return undefined for undefined input', () => {
      expect(toApiQuery(undefined)).toBeUndefined();
    });

    it('should return undefined for empty object', () => {
      expect(toApiQuery({})).toBeUndefined();
    });

    it('should skip array values that are all non-primitive objects', () => {
      expect(toApiQuery({ items: [{ id: 1 }, { id: 2 }] })).toBeUndefined();
    });

    it('should skip empty arrays', () => {
      expect(toApiQuery({ tags: [] })).toBeUndefined();
    });

    it('should filter non-primitive values from mixed arrays', () => {
      const result = toApiQuery({ ids: ['a', { nested: true }, 'b'] });
      expect(result).toEqual({ ids: 'a,b' });
    });

    it('should skip nested object values silently', () => {
      const result = toApiQuery({ name: 'test', nested: { foo: 'bar' } });
      expect(result).toEqual({ name: 'test' });
    });
  });
});
