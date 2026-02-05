import { Command } from 'commander';
import { createContext, handleError, type GlobalOptions } from '../context.js';
import { createSpinner } from '../utils.js';
import {
  formatProjects,
  formatProject,
  formatProjectSummary,
} from '../formatters/output.js';

/**
 * Register project commands
 */
export function registerProjectCommands(program: Command): void {
  const projects = program
    .command('projects')
    .description('Manage projects');

  // ulu projects list
  projects
    .command('list')
    .description('List all projects')
    .action(async (_, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching projects...');

      try {
        spinner?.start();
        const data = await ctx.client.projects.list();
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
        } else if (data.length === 0) {
          console.log('No projects found');
        } else {
          console.log(formatProjects(data));
        }
      } catch (error) {
        spinner?.fail('Failed to fetch projects');
        handleError(error, ctx);
      }
    });

  // ulu projects get <name>
  projects
    .command('get <name>')
    .description('Get project details')
    .action(async (name: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching project...');

      try {
        spinner?.start();
        const project = await ctx.client.projects.get(name);
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(project, null, 2));
        } else {
          console.log(formatProject(project));
        }
      } catch (error) {
        spinner?.fail('Failed to fetch project');
        handleError(error, ctx);
      }
    });

  // ulu projects create <name>
  projects
    .command('create <name>')
    .description('Create a new project')
    .action(async (name: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Creating project...');

      try {
        spinner?.start();
        const project = await ctx.client.projects.create({ name });
        spinner?.succeed('Project created');

        if (ctx.json) {
          console.log(JSON.stringify(project, null, 2));
        } else {
          console.log(formatProject(project));
        }
      } catch (error) {
        spinner?.fail('Failed to create project');
        handleError(error, ctx);
      }
    });

  // ulu projects delete <name>
  projects
    .command('delete <name>')
    .description('Delete a project')
    .option('--force', 'Hard delete (permanent, cannot be restored)')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (name: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);

      // Confirm deletion
      if (!options.yes) {
        console.log(`\nThis will ${options.force ? 'permanently delete' : 'soft-delete'} project: ${name}`);
        console.log('To confirm, run again with --yes flag');
        process.exit(0);
      }

      const spinner = ctx.quiet ? null : createSpinner('Deleting project...');

      try {
        spinner?.start();

        if (options.force) {
          await ctx.client.projects.delete(name, {
            confirm: true,
            confirmationPhrase: name,
          });
          spinner?.succeed('Project permanently deleted');
        } else {
          await ctx.client.projects.softDelete(name, {
            confirm: true,
            confirmationPhrase: name,
          });
          spinner?.succeed('Project soft-deleted');
        }

        if (ctx.json) {
          console.log(JSON.stringify({ success: true, name, hardDelete: !!options.force }, null, 2));
        } else if (!options.force) {
          console.log('Use "ulu projects restore" to recover this project');
        }
      } catch (error) {
        spinner?.fail('Failed to delete project');
        handleError(error, ctx);
      }
    });

  // ulu projects restore <name>
  projects
    .command('restore <name>')
    .description('Restore a soft-deleted project')
    .action(async (name: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Restoring project...');

      try {
        spinner?.start();
        const project = await ctx.client.projects.restore(name);
        spinner?.succeed('Project restored');

        if (ctx.json) {
          console.log(JSON.stringify(project, null, 2));
        } else {
          console.log(formatProject(project));
        }
      } catch (error) {
        spinner?.fail('Failed to restore project');
        handleError(error, ctx);
      }
    });

  // ulu projects summary <name>
  projects
    .command('summary <name>')
    .description('Get project summary with issue counts and latest run')
    .action(async (name: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching summary...');

      try {
        spinner?.start();
        const summary = await ctx.client.projects.getSummary(name);
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(summary, null, 2));
        } else {
          console.log(formatProjectSummary(summary));
        }
      } catch (error) {
        spinner?.fail('Failed to fetch summary');
        handleError(error, ctx);
      }
    });

  // ulu projects trends <name>
  projects
    .command('trends <name>')
    .description('Get project issue trends over time')
    .option('-d, --days <number>', 'Number of days to include', '30')
    .action(async (name: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching trends...');

      try {
        spinner?.start();
        const trends = await ctx.client.projects.getTrends(name, {
          days: parseInt(options.days, 10),
        });
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(trends, null, 2));
        } else if (trends.length === 0) {
          console.log('No trend data available');
        } else {
          console.log(`Issue trends for ${name} (last ${options.days} days):\n`);
          for (const point of trends.slice(-10)) {
            const bar = '#'.repeat(Math.min(point.openIssues, 50));
            console.log(`${point.date}: ${bar} ${point.openIssues} open (+${point.newIssues} new, -${point.resolvedIssues} resolved)`);
          }
          if (trends.length > 10) {
            console.log(`\n... showing last 10 of ${trends.length} data points`);
          }
        }
      } catch (error) {
        spinner?.fail('Failed to fetch trends');
        handleError(error, ctx);
      }
    });
}
