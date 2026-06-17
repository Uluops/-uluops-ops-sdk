/**
 * Utility functions for @uluops/ops-sdk
 *
 * SDK-specific utilities only. Shared utilities (sleep, retry, isUuid, etc.)
 * live in @uluops/sdk-core and are imported directly where needed.
 */

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
