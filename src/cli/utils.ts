import ora, { type Ora } from 'ora';

/**
 * Create a spinner for long-running operations
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    spinner: 'dots',
  });
}

/**
 * Format a date for display
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}

/**
 * Truncate a string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Format JSON output
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Print error message and exit
 */
export function exitWithError(message: string, code = 1): never {
  console.error(`Error: ${message}`);
  process.exit(code);
}

/**
 * Redact sensitive values for display
 */
export function redact(value: string, showLast = 4): string {
  if (value.length <= showLast) return '[REDACTED]';
  return `${'*'.repeat(value.length - showLast)}${value.slice(-showLast)}`;
}
