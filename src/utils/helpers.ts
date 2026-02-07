/**
 * Utility functions for @uluops/ops-sdk
 *
 * Shared utilities are re-exported from @uluops/sdk-core.
 * SDK-specific utilities are defined here.
 */

// Re-export shared utilities from sdk-core
export { sleep, retry, truncate, isPlainObject, isUuid } from '@uluops/sdk-core/utils';

// ---- SDK-specific utilities ----

/**
 * Check if a value is a plain object (local copy for deepMerge to avoid
 * importing the re-exported version which could cause issues)
 */
function isObj(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep merge two objects, recursively merging nested objects
 * @param target - Base object to merge into
 * @param source - Object with values to overlay
 * @returns New merged object (does not mutate inputs)
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (isObj(sourceValue) && isObj(targetValue)) {
      result[key] = deepMerge(targetValue, sourceValue as Partial<Record<string, unknown>>) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Pick specified keys from an object
 * @param obj - Source object
 * @param keys - Keys to include in the result
 * @returns New object containing only the specified keys
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;

  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Omit specified keys from an object
 * @param obj - Source object
 * @param keys - Keys to exclude from the result
 * @returns New object without the specified keys
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };

  for (const key of keys) {
    delete result[key];
  }

  return result as Omit<T, K>;
}

/**
 * Remove undefined values from an object
 * @param obj - Source object to compact
 * @returns New object with undefined values removed
 */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value as T[keyof T];
    }
  }

  return result;
}

/**
 * Format a date for display as an ISO 8601 string
 * @param date - Date object or date string to format
 * @returns ISO 8601 formatted date string
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

/**
 * Convert camelCase to snake_case
 * @param str - camelCase string to convert
 * @returns snake_case formatted string
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 * @param str - snake_case string to convert
 * @returns camelCase formatted string
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Get a property from an object, trying camelCase first then snake_case
 * Useful for handling API responses that may use either format
 *
 * @example
 * ```typescript
 * const count = getFlexibleProperty(response, 'newIssues', 0);
 * // Tries response.newIssues, then response.new_issues, then returns 0
 * ```
 */
export function getFlexibleProperty<T>(
  obj: object,
  camelCaseKey: string,
  defaultValue: T
): T {
  const record = obj as Record<string, unknown>;
  // Try camelCase first
  if (camelCaseKey in record && record[camelCaseKey] !== undefined) {
    return record[camelCaseKey] as T;
  }
  // Try snake_case
  const snakeKey = toSnakeCase(camelCaseKey);
  if (snakeKey in record && record[snakeKey] !== undefined) {
    return record[snakeKey] as T;
  }
  return defaultValue;
}
