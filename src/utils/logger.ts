/**
 * Simple debug logger interface
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Create a logger instance
 */
export function createLogger(enabled: boolean): Logger {
  const noop = () => {};

  if (!enabled) {
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
    };
  }

  const prefix = '[ops-sdk]';
  const timestamp = () => new Date().toISOString();

  return {
    debug(message: string, ...args: unknown[]): void {
      console.debug(`${timestamp()} ${prefix} DEBUG:`, message, ...args);
    },
    info(message: string, ...args: unknown[]): void {
      console.info(`${timestamp()} ${prefix} INFO:`, message, ...args);
    },
    warn(message: string, ...args: unknown[]): void {
      console.warn(`${timestamp()} ${prefix} WARN:`, message, ...args);
    },
    error(message: string, ...args: unknown[]): void {
      console.error(`${timestamp()} ${prefix} ERROR:`, message, ...args);
    },
  };
}

/**
 * Redact sensitive values for safe logging
 * Shows only the last N characters
 */
export function redactSensitive(value: string, showLast = 4): string {
  if (value.length <= showLast) {
    return '[REDACTED]';
  }
  return `${'*'.repeat(Math.min(value.length - showLast, 20))}${value.slice(-showLast)}`;
}

/**
 * Keys that should be redacted from objects before logging/display
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'apiKey',
  'api_key',
  'token',
  'sessionToken',
  'session_token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'authorization',
  'secret',
  'credential',
  'credentials',
]);

/**
 * Sanitize an object by redacting sensitive keys
 * Returns a new object with sensitive values replaced
 * Only redacts string values - objects and arrays are recursively sanitized
 */
export function sanitizeForDisplay(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitiveKey = SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_KEYS.has(key);

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      result[key] = sanitizeForDisplay(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      // Recursively sanitize arrays
      result[key] = value.map((item) =>
        item && typeof item === 'object'
          ? sanitizeForDisplay(item as Record<string, unknown>)
          : item
      );
    } else if (isSensitiveKey && typeof value === 'string') {
      // Only redact string values with sensitive keys
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }

  return result;
}
