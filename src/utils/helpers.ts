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
 * Convert camelCase to snake_case
 * @param str - camelCase string to convert
 * @returns snake_case formatted string
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Convert snake_case to camelCase
 * @param str - snake_case string to convert
 * @returns camelCase formatted string
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}
