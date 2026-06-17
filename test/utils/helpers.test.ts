import { describe, it, expect } from 'vitest';
import { toSnakeCase } from '../../src/utils/helpers.js';

describe('Helper Utilities', () => {
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
});
