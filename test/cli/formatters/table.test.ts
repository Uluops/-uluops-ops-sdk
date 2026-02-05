import { describe, it, expect } from 'vitest';
import { formatTable, formatKeyValue, type Column } from '../../../src/cli/formatters/table.js';

describe('Table Formatter', () => {
  describe('formatTable', () => {
    interface TestRow {
      id: string;
      name: string;
      value: number;
    }

    const testData: TestRow[] = [
      { id: '1', name: 'Alpha', value: 100 },
      { id: '2', name: 'Beta', value: 200 },
      { id: '3', name: 'Gamma', value: 300 },
    ];

    it('should format data as a table with headers', () => {
      const columns: Column<TestRow>[] = [
        { header: 'ID', accessor: 'id' },
        { header: 'NAME', accessor: 'name' },
        { header: 'VALUE', accessor: (r) => String(r.value) },
      ];

      const result = formatTable(testData, columns);
      expect(result).toContain('ID');
      expect(result).toContain('NAME');
      expect(result).toContain('VALUE');
      expect(result).toContain('Alpha');
      expect(result).toContain('Beta');
      expect(result).toContain('Gamma');
    });

    it('should return "No data" for empty array', () => {
      const columns: Column<TestRow>[] = [
        { header: 'ID', accessor: 'id' },
      ];
      expect(formatTable([], columns)).toBe('No data');
    });

    it('should handle fixed column widths', () => {
      const columns: Column<TestRow>[] = [
        { header: 'ID', accessor: 'id', width: 10 },
        { header: 'NAME', accessor: 'name', width: 15 },
      ];

      const result = formatTable(testData, columns);
      const lines = result.split('\n');

      // Header and separator lines should have consistent width
      expect(lines[0]).toContain('ID');
      expect(lines[1]).toContain('-');
    });

    it('should right-align numeric columns', () => {
      const columns: Column<TestRow>[] = [
        { header: 'VALUE', accessor: (r) => String(r.value), width: 10, align: 'right' },
      ];

      const result = formatTable(testData, columns);
      // Right-aligned values should have leading spaces
      expect(result).toContain('100');
      expect(result).toContain('200');
    });

    it('should center-align columns', () => {
      const columns: Column<TestRow>[] = [
        { header: 'NAME', accessor: 'name', width: 15, align: 'center' },
      ];

      const result = formatTable(testData, columns);
      expect(result).toContain('Alpha');
    });

    it('should truncate long values', () => {
      const longData = [{ id: '1', name: 'This is a very long name that should be truncated', value: 1 }];
      const columns: Column<TestRow>[] = [
        { header: 'NAME', accessor: 'name', width: 20 },
      ];

      const result = formatTable(longData, columns);
      // Truncated text ends with ellipsis character
      expect(result).toContain('…');
    });

    it('should use function accessors', () => {
      const columns: Column<TestRow>[] = [
        { header: 'DOUBLED', accessor: (r) => String(r.value * 2) },
      ];

      const result = formatTable(testData, columns);
      expect(result).toContain('200'); // 100 * 2
      expect(result).toContain('400'); // 200 * 2
      expect(result).toContain('600'); // 300 * 2
    });

    it('should handle null/undefined values', () => {
      const dataWithNulls = [
        { id: '1', name: null as unknown as string, value: 100 },
      ];
      const columns: Column<typeof dataWithNulls[0]>[] = [
        { header: 'NAME', accessor: 'name' },
      ];

      // Should not throw
      const result = formatTable(dataWithNulls, columns);
      expect(result).toBeDefined();
    });

    it('should include separator line between header and data', () => {
      const columns: Column<TestRow>[] = [
        { header: 'ID', accessor: 'id' },
      ];

      const result = formatTable(testData, columns);
      const lines = result.split('\n');

      expect(lines.length).toBeGreaterThanOrEqual(3); // header, separator, at least one data row
      expect(lines[1]).toMatch(/^-+$/); // Separator is all dashes
    });
  });

  describe('formatKeyValue', () => {
    it('should format simple key-value pairs', () => {
      const result = formatKeyValue({
        name: 'Test',
        value: 123,
      });

      expect(result).toContain('Name: Test');
      expect(result).toContain('Value: 123');
    });

    it('should convert camelCase to Title Case', () => {
      const result = formatKeyValue({
        firstName: 'John',
        lastName: 'Doe',
        createdAt: '2024-01-01',
      });

      expect(result).toContain('First Name: John');
      expect(result).toContain('Last Name: Doe');
      expect(result).toContain('Created At: 2024-01-01');
    });

    it('should preserve keys with spaces', () => {
      const result = formatKeyValue({
        'Full Name': 'John Doe',
        'API Key': 'abc123',
      });

      expect(result).toContain('Full Name: John Doe');
      expect(result).toContain('API Key: abc123');
    });

    it('should filter out null and undefined values', () => {
      const result = formatKeyValue({
        present: 'yes',
        missing: null,
        gone: undefined,
      });

      expect(result).toContain('Present: yes');
      expect(result).not.toContain('Missing');
      expect(result).not.toContain('Gone');
    });

    it('should handle nested objects', () => {
      const result = formatKeyValue({
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      });

      expect(result).toContain('User:');
      expect(result).toContain('Name: John');
      expect(result).toContain('Email: john@example.com');
    });

    it('should support custom indentation', () => {
      const result = formatKeyValue({ name: 'Test' }, 4);
      expect(result).toMatch(/^\s{4}Name: Test/);
    });

    it('should handle boolean values', () => {
      const result = formatKeyValue({
        active: true,
        disabled: false,
      });

      expect(result).toContain('Active: true');
      expect(result).toContain('Disabled: false');
    });

    it('should handle array values', () => {
      const result = formatKeyValue({
        tags: ['a', 'b', 'c'],
      });

      expect(result).toContain('Tags: a,b,c');
    });

    it('should handle empty object', () => {
      const result = formatKeyValue({});
      expect(result).toBe('');
    });
  });
});
