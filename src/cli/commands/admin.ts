import { Command } from 'commander';
import { createContext, handleError, type GlobalOptions } from '../context.js';
import { createSpinner, formatDate } from '../utils.js';
import { formatTable, formatKeyValue, type Column } from '../formatters/table.js';
import type { UserRole, SubscriptionTier } from '../../types/enums.js';

/**
 * Register admin commands
 */
export function registerAdminCommands(program: Command): void {
  const admin = program
    .command('admin')
    .description('Admin operations (requires admin role)');

  // ulu admin stats
  admin
    .command('stats')
    .description('Get admin dashboard statistics')
    .action(async (_, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching admin stats...');

      try {
        spinner?.start();
        const stats = await ctx.client.admin.getStats();
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          // Handle both API response format (activeSessions) and type definition (totalSessions)
          const s = stats as unknown as Record<string, number>;
          console.log('Admin Statistics:\n');
          console.log(formatKeyValue({
            'Total Users': stats.totalUsers,
            'Active Users': stats.activeUsers,
            'Active Sessions': s.activeSessions ?? stats.totalSessions,
            'Total API Keys': stats.totalApiKeys,
          }));
        }
      } catch (error) {
        spinner?.fail('Failed to fetch admin stats');
        handleError(error, ctx);
      }
    });

  // ============================================
  // USER MANAGEMENT
  // ============================================

  const users = admin
    .command('users')
    .description('User management');

  // ulu admin users list
  users
    .command('list')
    .description('List all users')
    .option('-s, --search <text>', 'Search by email or username')
    .option('-r, --role <role>', 'Filter by role (admin, developer, publisher, viewer)')
    .option('-t, --tier <tier>', 'Filter by subscription tier')
    .option('--inactive', 'Show only inactive users')
    .option('-l, --limit <number>', 'Maximum results', '20')
    .option('-p, --page <number>', 'Page number', '1')
    .action(async (options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching users...');

      try {
        spinner?.start();
        const data = await ctx.client.admin.listUsers({
          search: options.search,
          role: options.role as UserRole | undefined,
          subscriptionTier: options.tier as SubscriptionTier | undefined,
          isActive: options.inactive ? false : undefined,
          limit: parseInt(options.limit, 10),
          page: parseInt(options.page, 10),
        });
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
        } else if (data.users.length === 0) {
          console.log('No users found');
        } else {
          const columns: Column<(typeof data.users)[0]>[] = [
            { header: 'ID', accessor: (u) => u.id.slice(0, 8), width: 10 },
            { header: 'EMAIL', accessor: 'email', width: 30 },
            { header: 'ROLE', accessor: 'role', width: 10 },
            { header: 'TIER', accessor: 'subscriptionTier', width: 12 },
            { header: 'ACTIVE', accessor: (u) => u.isActive ? 'Yes' : 'No', width: 7 },
          ];
          console.log(formatTable(data.users, columns));

          if (data.pagination) {
            console.log(`\nPage ${data.pagination.page} of ${data.pagination.totalPages} (${data.pagination.total} total)`);
          }
        }
      } catch (error) {
        spinner?.fail('Failed to fetch users');
        handleError(error, ctx);
      }
    });

  // ulu admin users get <id>
  users
    .command('get <id>')
    .description('Get user details')
    .action(async (id: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching user...');

      try {
        spinner?.start();
        const data = await ctx.client.admin.getUser(id);
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(formatKeyValue({
            ID: data.user.id,
            Email: data.user.email,
            Username: data.user.username,
            Role: data.user.role,
            'Subscription Tier': data.user.subscriptionTier,
            Active: data.user.isActive ? 'Yes' : 'No',
            'Created At': formatDate(data.user.createdAt),
          }));

          if (data.stats) {
            console.log('\nStatistics:');
            console.log(formatKeyValue({
              Sessions: data.stats.sessionCount,
              'API Keys': data.stats.apiKeyCount,
              'Last Login': data.stats.lastLoginAt ? formatDate(data.stats.lastLoginAt) : 'Never',
            }));
          }
        }
      } catch (error) {
        spinner?.fail('Failed to fetch user');
        handleError(error, ctx);
      }
    });

  // ulu admin users create
  users
    .command('create')
    .description('Create a new user')
    .requiredOption('-e, --email <email>', 'User email')
    .option('-p, --password <password>', 'User password (generates temporary if not provided)')
    .option('-r, --role <role>', 'User role (admin, developer, publisher, viewer)', 'developer')
    .option('-t, --tier <tier>', 'Subscription tier', 'free')
    .option('--no-welcome', 'Do not send welcome email')
    .action(async (options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Creating user...');

      try {
        spinner?.start();
        const data = await ctx.client.admin.createUser({
          email: options.email,
          password: options.password,
          role: options.role as UserRole,
          subscriptionTier: options.tier as SubscriptionTier,
          sendWelcomeEmail: options.welcome,
        });
        spinner?.succeed('User created');

        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(`User ${data.user.email} created with ID: ${data.user.id}`);
          if (data.temporaryPassword) {
            console.log(`\nTemporary password: ${data.temporaryPassword}`);
            console.log('(User should change this on first login)');
          }
        }
      } catch (error) {
        spinner?.fail('Failed to create user');
        handleError(error, ctx);
      }
    });

  // ulu admin users update <id>
  users
    .command('update <id>')
    .description('Update a user')
    .option('-e, --email <email>', 'New email')
    .option('-r, --role <role>', 'New role (admin, developer, publisher, viewer)')
    .option('-t, --tier <tier>', 'New subscription tier')
    .action(async (id: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Updating user...');

      try {
        spinner?.start();
        const data = await ctx.client.admin.updateUser(id, {
          email: options.email,
          role: options.role as UserRole | undefined,
          subscriptionTier: options.tier as SubscriptionTier | undefined,
        });
        spinner?.succeed('User updated');

        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(`User ${data.user.email} updated`);
        }
      } catch (error) {
        spinner?.fail('Failed to update user');
        handleError(error, ctx);
      }
    });

  // ulu admin users deactivate <id>
  users
    .command('deactivate <id>')
    .description('Deactivate a user')
    .action(async (id: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Deactivating user...');

      try {
        spinner?.start();
        const data = await ctx.client.admin.deactivateUser(id);
        spinner?.succeed('User deactivated');

        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(`User ${data.user.email} deactivated`);
        }
      } catch (error) {
        spinner?.fail('Failed to deactivate user');
        handleError(error, ctx);
      }
    });

  // ulu admin users reactivate <id>
  users
    .command('reactivate <id>')
    .description('Reactivate a deactivated user')
    .action(async (id: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Reactivating user...');

      try {
        spinner?.start();
        const data = await ctx.client.admin.reactivateUser(id);
        spinner?.succeed('User reactivated');

        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(`User ${data.user.email} reactivated`);
        }
      } catch (error) {
        spinner?.fail('Failed to reactivate user');
        handleError(error, ctx);
      }
    });

  // ulu admin users reset-password <id>
  users
    .command('reset-password <id>')
    .description('Send password reset email to user')
    .action(async (id: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Sending password reset...');

      try {
        spinner?.start();
        const result = await ctx.client.admin.resetUserPassword(id);
        spinner?.succeed('Password reset email sent');

        if (ctx.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result.message);
        }
      } catch (error) {
        spinner?.fail('Failed to send password reset');
        handleError(error, ctx);
      }
    });

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  const sessions = admin
    .command('sessions')
    .description('Session management');

  // ulu admin sessions list
  sessions
    .command('list')
    .description('List all active sessions')
    .option('-u, --user <id>', 'Filter by user ID')
    .option('-l, --limit <number>', 'Maximum results', '20')
    .option('-p, --page <number>', 'Page number', '1')
    .action(async (options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching sessions...');

      try {
        spinner?.start();
        const data = await ctx.client.admin.listSessions({
          userId: options.user,
          limit: parseInt(options.limit, 10),
          page: parseInt(options.page, 10),
        });
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
        } else if (data.sessions.length === 0) {
          console.log('No sessions found');
        } else {
          const columns: Column<(typeof data.sessions)[0]>[] = [
            { header: 'ID', accessor: (s) => s.id.slice(0, 8), width: 10 },
            { header: 'USER', accessor: 'userEmail', width: 25 },
            { header: 'IP', accessor: (s) => s.ipAddress ?? '-', width: 15 },
            { header: 'CREATED', accessor: (s) => formatDate(s.createdAt), width: 20 },
          ];
          console.log(formatTable(data.sessions, columns));

          if (data.pagination) {
            console.log(`\nPage ${data.pagination.page} of ${data.pagination.totalPages} (${data.pagination.total} total)`);
          }
        }
      } catch (error) {
        spinner?.fail('Failed to fetch sessions');
        handleError(error, ctx);
      }
    });

  // ulu admin sessions terminate <id>
  sessions
    .command('terminate <id>')
    .description('Terminate a session')
    .action(async (id: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Terminating session...');

      try {
        spinner?.start();
        const result = await ctx.client.admin.terminateSession(id);
        spinner?.succeed('Session terminated');

        if (ctx.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result.message);
        }
      } catch (error) {
        spinner?.fail('Failed to terminate session');
        handleError(error, ctx);
      }
    });

  // ulu admin sessions terminate-user <userId>
  sessions
    .command('terminate-user <userId>')
    .description('Terminate all sessions for a user')
    .action(async (userId: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Terminating user sessions...');

      try {
        spinner?.start();
        const result = await ctx.client.admin.terminateUserSessions(userId);
        spinner?.succeed('User sessions terminated');

        if (ctx.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result.message);
        }
      } catch (error) {
        spinner?.fail('Failed to terminate user sessions');
        handleError(error, ctx);
      }
    });

  // ============================================
  // API KEY MANAGEMENT
  // ============================================

  const keys = admin
    .command('keys')
    .description('API key management');

  // ulu admin keys list
  keys
    .command('list')
    .description('List all API keys')
    .option('-u, --user <id>', 'Filter by user ID')
    .option('-s, --search <text>', 'Search by name')
    .option('-l, --limit <number>', 'Maximum results', '20')
    .option('-p, --page <number>', 'Page number', '1')
    .action(async (options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching API keys...');

      try {
        spinner?.start();
        const data = await ctx.client.admin.listKeys({
          userId: options.user,
          search: options.search,
          limit: parseInt(options.limit, 10),
          page: parseInt(options.page, 10),
        });
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
        } else if (data.keys.length === 0) {
          console.log('No API keys found');
        } else {
          const columns: Column<(typeof data.keys)[0]>[] = [
            { header: 'ID', accessor: (k) => k.id.slice(0, 8), width: 10 },
            { header: 'NAME', accessor: (k) => k.name ?? '(unnamed)', width: 20 },
            { header: 'USER', accessor: 'userEmail', width: 25 },
            { header: 'LAST USED', accessor: (k) => k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never', width: 20 },
          ];
          console.log(formatTable(data.keys, columns));

          if (data.pagination) {
            console.log(`\nPage ${data.pagination.page} of ${data.pagination.totalPages} (${data.pagination.total} total)`);
          }
        }
      } catch (error) {
        spinner?.fail('Failed to fetch API keys');
        handleError(error, ctx);
      }
    });

  // ulu admin keys revoke <id>
  keys
    .command('revoke <id>')
    .description('Revoke an API key')
    .action(async (id: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Revoking API key...');

      try {
        spinner?.start();
        const result = await ctx.client.admin.revokeKey(id);
        spinner?.succeed('API key revoked');

        if (ctx.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result.message);
        }
      } catch (error) {
        spinner?.fail('Failed to revoke API key');
        handleError(error, ctx);
      }
    });
}
