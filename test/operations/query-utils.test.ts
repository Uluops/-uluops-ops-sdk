import { describe, it, expect } from 'vitest';
import { buildIssueListParams } from '../../src/operations/query-utils.js';

describe('query-utils', () => {
  describe('buildIssueListParams', () => {
    it('should return undefined when no query provided', () => {
      expect(buildIssueListParams()).toBeUndefined();
      expect(buildIssueListParams(undefined)).toBeUndefined();
    });

    it('should pass through all string fields', () => {
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
        failureDomain: 'SEM',
        validator: 'code-validator',
        dateStart: '2025-01-01',
        dateEnd: '2025-12-31',
        limit: undefined,
        offset: undefined,
        includeResolved: undefined,
        minTimesSeen: undefined,
      });
    });

    it('should pass through numeric fields', () => {
      const result = buildIssueListParams({ limit: 50, offset: 10, minTimesSeen: 3 });
      expect(result?.limit).toBe(50);
      expect(result?.offset).toBe(10);
      expect(result?.minTimesSeen).toBe(3);
    });

    it('should pass through boolean includeResolved', () => {
      const result = buildIssueListParams({ includeResolved: true });
      expect(result?.includeResolved).toBe(true);

      const result2 = buildIssueListParams({ includeResolved: false });
      expect(result2?.includeResolved).toBe(false);
    });

    it('should handle empty query object (all fields undefined)', () => {
      const result = buildIssueListParams({});
      expect(result).toBeDefined();
      expect(result?.status).toBeUndefined();
      expect(result?.priority).toBeUndefined();
      expect(result?.limit).toBeUndefined();
    });

    it('should preserve boundary values for limit and offset', () => {
      const result = buildIssueListParams({ limit: 0, offset: 0 });
      expect(result?.limit).toBe(0);
      expect(result?.offset).toBe(0);
    });

    it('should handle a fully populated query', () => {
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
      expect(result).toEqual(query);
    });
  });
});
