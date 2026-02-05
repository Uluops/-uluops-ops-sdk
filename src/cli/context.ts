import { OpsClient } from '../client.js';
import { loadConfig } from '../config/loaders.js';
import { OpsApiError } from '../errors/errors.js';
import { sanitizeForDisplay } from '../utils/logger.js';
import { exitWithError } from './utils.js';

/**
 * Global CLI options passed from commander
 */
export interface GlobalOptions {
  apiKey?: string;
  profile?: string;
  baseUrl?: string;
  json?: boolean;
  debug?: boolean;
  quiet?: boolean;
}

/**
 * CLI execution context
 */
export interface CliContext {
  client: OpsClient;
  json: boolean;
  debug: boolean;
  quiet: boolean;
}

/**
 * Create CLI context from global options
 * Initializes OpsClient with credentials from options, env vars, or stored credentials
 */
export function createContext(options: GlobalOptions): CliContext {
  const config = loadConfig({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    profile: options.profile,
    debug: options.debug,
  });

  const hasCredentials =
    config.credentials.apiKey ||
    config.credentials.sessionToken ||
    (config.credentials.email && config.credentials.password);

  if (!hasCredentials) {
    exitWithError(
      'No credentials found.\n' +
        'Set ULUOPS_API_KEY environment variable, use --api-key flag,\n' +
        'or run "ulu auth login" to authenticate.'
    );
  }

  const client = new OpsClient({
    apiKey: config.credentials.apiKey,
    sessionToken: config.credentials.sessionToken,
    email: config.credentials.email,
    password: config.credentials.password,
    baseUrl: config.baseUrl,
    debug: config.debug,
  });

  return {
    client,
    json: options.json ?? false,
    debug: options.debug ?? false,
    quiet: options.quiet ?? false,
  };
}

/**
 * Create context without requiring credentials (for commands like login)
 */
export function createUnauthenticatedContext(options: GlobalOptions): Omit<CliContext, 'client'> & { baseUrl: string } {
  const config = loadConfig({
    baseUrl: options.baseUrl,
    profile: options.profile,
    debug: options.debug,
  });

  return {
    baseUrl: config.baseUrl,
    json: options.json ?? false,
    debug: options.debug ?? false,
    quiet: options.quiet ?? false,
  };
}

/**
 * Handle errors consistently across all CLI commands
 * Provides helpful hints based on error type
 */
export function handleError(error: unknown, ctx: Pick<CliContext, 'json' | 'debug'>): never {
  if (error instanceof OpsApiError) {
    if (ctx.json) {
      // Sanitize error output to prevent accidental credential exposure
      const safeError = sanitizeForDisplay(error.toJSON());
      console.error(JSON.stringify(safeError, null, 2));
    } else {
      console.error(`Error: ${error.message}`);

      // Provide helpful hints based on error code
      if (error.code === 'UNAUTHORIZED' || error.statusCode === 401) {
        console.error('\nHint: Your credentials may be invalid or expired.');
        console.error('Run "ulu auth login" or check your ULUOPS_API_KEY.');
      } else if (error.code === 'NOT_FOUND' || error.statusCode === 404) {
        console.error('\nHint: The resource was not found. Check the name or ID.');
      } else if (error.code === 'VALIDATION_ERROR' || error.statusCode === 400) {
        console.error('\nHint: Invalid input. Check the command arguments.');
      } else if (error.code === 'RATE_LIMITED' || error.statusCode === 429) {
        console.error('\nHint: Rate limited. Wait a moment and try again.');
      }

      if (ctx.debug && error.details) {
        // Sanitize details to prevent accidental credential exposure
        const safeDetails = sanitizeForDisplay(error.details);
        console.error('\nDetails:', JSON.stringify(safeDetails, null, 2));
      }

      if (error.requestId) {
        console.error(`\nRequest ID: ${error.requestId}`);
      }
    }
    process.exit(1);
  }

  // Network or unknown errors
  if (ctx.json) {
    console.error(JSON.stringify({ error: String(error) }));
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);

    if (message.includes('ECONNREFUSED') || message.includes('network')) {
      console.error('\nHint: Cannot connect to the API. Check if the server is running.');
    }

    if (ctx.debug && error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }

  process.exit(1);
}
