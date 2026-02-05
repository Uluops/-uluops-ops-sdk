import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { OpsClient } from '../../client.js';
import { CONFIG_PATHS } from '../../config/constants.js';
import {
  createContext,
  createUnauthenticatedContext,
  handleError,
  type GlobalOptions,
} from '../context.js';
import { createSpinner } from '../utils.js';
import { formatApiKeys } from '../formatters/output.js';

/**
 * Save credentials to the credentials file
 */
function saveCredentials(
  profile: string,
  credentials: {
    type: 'api_key' | 'session';
    apiKey?: string;
    sessionToken?: string;
    expiresAt?: string;
    email?: string;
  }
): void {
  const configDir = join(homedir(), CONFIG_PATHS.GLOBAL_DIR);
  const credPath = join(homedir(), CONFIG_PATHS.CREDENTIALS);

  // Create config directory if it doesn't exist
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Load existing credentials or start fresh
  let stored: Record<string, unknown> = {};
  if (existsSync(credPath)) {
    try {
      stored = JSON.parse(require('fs').readFileSync(credPath, 'utf-8'));
    } catch {
      // Start fresh if file is corrupted
    }
  }

  // Update the profile
  stored[profile] = credentials;

  // Write back
  writeFileSync(credPath, JSON.stringify(stored, null, 2));
}

/**
 * Register auth commands
 */
export function registerAuthCommands(program: Command): void {
  const auth = program
    .command('auth')
    .description('Authentication and credential management');

  // ulu auth login
  auth
    .command('login')
    .description('Login with email and password')
    .option('-e, --email <email>', 'Email address')
    .option('-p, --password <password>', 'Password')
    .action(async (options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createUnauthenticatedContext(globalOpts);

      if (!options.email || !options.password) {
        console.error('Error: Both --email and --password are required');
        console.error('Usage: ulu auth login --email <email> --password <password>');
        process.exit(1);
      }

      const spinner = ctx.quiet ? null : createSpinner('Logging in...');

      try {
        spinner?.start();

        const client = new OpsClient({
          email: options.email,
          password: options.password,
          baseUrl: ctx.baseUrl,
        });

        const result = await client.login(options.email, options.password);
        spinner?.succeed('Login successful');

        // Save credentials
        const profile = globalOpts.profile ?? 'default';
        saveCredentials(profile, {
          type: 'session',
          sessionToken: result.sessionToken,
          expiresAt: result.expiresAt,
          email: options.email,
        });

        if (ctx.json) {
          console.log(JSON.stringify({ success: true, profile }, null, 2));
        } else {
          console.log(`\nCredentials saved to profile: ${profile}`);
          console.log('You can now use other ulu commands.');
        }
      } catch (error) {
        spinner?.fail('Login failed');
        handleError(error, ctx);
      }
    });

  // ulu auth logout
  auth
    .command('logout')
    .description('Logout and revoke all sessions')
    .action(async (_, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Logging out...');

      try {
        spinner?.start();
        const result = await ctx.client.logout();
        spinner?.succeed('Logged out');

        if (ctx.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Revoked ${result.sessionsRevoked} session(s)`);
        }
      } catch (error) {
        spinner?.fail('Logout failed');
        handleError(error, ctx);
      }
    });

  // ulu auth whoami
  auth
    .command('whoami')
    .description('Show current authenticated user')
    .action(async (_, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching user info...');

      try {
        spinner?.start();
        const user = await ctx.client.auth.getMe();
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(user, null, 2));
        } else {
          console.log(`Email: ${user.email}`);
          console.log(`Role: ${user.role}`);
          console.log(`Tier: ${user.subscriptionTier}`);
          if (user.username) console.log(`Username: ${user.username}`);
          if (user.name) console.log(`Name: ${user.name}`);
          console.log(`Auth Type: ${ctx.client.getAuthType()}`);
        }
      } catch (error) {
        spinner?.fail('Failed to fetch user info');
        handleError(error, ctx);
      }
    });

  // ulu auth api-keys
  const apiKeys = auth
    .command('api-keys')
    .description('Manage API keys');

  // ulu auth api-keys list
  apiKeys
    .command('list')
    .description('List all API keys')
    .action(async (_, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching API keys...');

      try {
        spinner?.start();
        const keys = await ctx.client.auth.listApiKeys();
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(keys, null, 2));
        } else if (keys.length === 0) {
          console.log('No API keys found');
        } else {
          console.log(formatApiKeys(keys));
        }
      } catch (error) {
        spinner?.fail('Failed to fetch API keys');
        handleError(error, ctx);
      }
    });

  // ulu auth api-keys create
  apiKeys
    .command('create')
    .description('Create a new API key')
    .option('-n, --name <name>', 'Key name (for identification)')
    .option('--expires <date>', 'Expiration date (ISO format)')
    .action(async (options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Creating API key...');

      try {
        spinner?.start();
        const result = await ctx.client.auth.createApiKey({
          name: options.name,
          expiresAt: options.expires,
        });
        spinner?.succeed('API key created');

        if (ctx.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('\n' + '='.repeat(60));
          console.log('IMPORTANT: Save this key now - it will not be shown again!');
          console.log('='.repeat(60));
          console.log(`\nAPI Key: ${result.key}`);
          console.log(`Key ID: ${result.apiKey.id}`);
          if (result.apiKey.name) console.log(`Name: ${result.apiKey.name}`);
          console.log('\n' + '='.repeat(60));
        }
      } catch (error) {
        spinner?.fail('Failed to create API key');
        handleError(error, ctx);
      }
    });

  // ulu auth api-keys revoke
  apiKeys
    .command('revoke <keyId>')
    .description('Revoke an API key')
    .action(async (keyId: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Revoking API key...');

      try {
        spinner?.start();
        await ctx.client.auth.revokeApiKey(keyId);
        spinner?.succeed('API key revoked');

        if (ctx.json) {
          console.log(JSON.stringify({ success: true, keyId }, null, 2));
        } else {
          console.log(`API key ${keyId} has been revoked`);
        }
      } catch (error) {
        spinner?.fail('Failed to revoke API key');
        handleError(error, ctx);
      }
    });
}
