import { Command } from 'commander';
import { createContext, handleError, type GlobalOptions } from '../context.js';
import { createSpinner } from '../utils.js';
import { formatIssues, formatIssue } from '../formatters/output.js';
import type { Status, Priority, Severity, FailureDomain } from '../../types/enums.js';

/**
 * Register issue commands
 */
export function registerIssueCommands(program: Command): void {
  const issues = program
    .command('issues')
    .description('Manage validation issues');

  // ulu issues list <project>
  issues
    .command('list <project>')
    .description('List issues for a project')
    .option('-s, --status <status>', 'Filter by status (open, completed, deferred, wontfix)')
    .option('-p, --priority <priority>', 'Filter by priority (critical, suggested, backlog)')
    .option('--severity <severity>', 'Filter by severity (critical, high, medium, low, info)')
    .option('-v, --validator <name>', 'Filter by validator')
    .option('-d, --domain <domain>', 'Filter by failure domain (STR, SEM, PRA, EPI)')
    .option('-l, --limit <number>', 'Maximum number of issues', '50')
    .option('--include-resolved', 'Include resolved issues')
    .action(async (project: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching issues...');

      try {
        spinner?.start();
        const data = await ctx.client.issues.listByProject(project, {
          status: options.status as Status | undefined,
          priority: options.priority as Priority | undefined,
          severity: options.severity as Severity | undefined,
          validator: options.validator,
          failureDomain: options.domain as FailureDomain | undefined,
          limit: parseInt(options.limit, 10),
          includeResolved: options.includeResolved,
        });
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
        } else if (data.length === 0) {
          console.log('No issues found');
        } else {
          console.log(formatIssues(data));
        }
      } catch (error) {
        spinner?.fail('Failed to fetch issues');
        handleError(error, ctx);
      }
    });

  // ulu issues get <id>
  issues
    .command('get <id>')
    .description('Get issue details')
    .option('--full', 'Include occurrences and notes')
    .action(async (id: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching issue...');

      try {
        spinner?.start();

        if (options.full) {
          const details = await ctx.client.issues.getDetails(id);
          spinner?.succeed();

          if (ctx.json) {
            console.log(JSON.stringify(details, null, 2));
          } else {
            console.log(formatIssue(details.issue));

            if (details.occurrences.length > 0) {
              console.log(`\nOccurrences (${details.occurrences.length}):`);
              for (const occ of details.occurrences.slice(0, 5)) {
                console.log(`  - ${occ.validator} at ${occ.filePath ?? '(no file)'}${occ.lineNumber ? `:${occ.lineNumber}` : ''}`);
              }
              if (details.occurrences.length > 5) {
                console.log(`  ... and ${details.occurrences.length - 5} more`);
              }
            }

            if (details.notes.length > 0) {
              console.log(`\nNotes (${details.notes.length}):`);
              for (const note of details.notes) {
                console.log(`  [${note.noteType}] ${note.content.slice(0, 100)}${note.content.length > 100 ? '...' : ''}`);
              }
            }

            if (details.statusHistory.length > 0) {
              console.log(`\nStatus History (${details.statusHistory.length} changes)`);
            }
          }
        } else {
          const issue = await ctx.client.issues.get(id);
          spinner?.succeed();

          if (ctx.json) {
            console.log(JSON.stringify(issue, null, 2));
          } else {
            console.log(formatIssue(issue));
          }
        }
      } catch (error) {
        spinner?.fail('Failed to fetch issue');
        handleError(error, ctx);
      }
    });

  // ulu issues search
  issues
    .command('search')
    .description('Search issues across projects')
    .requiredOption('-q, --query <text>', 'Search query')
    .option('-p, --projects <names>', 'Filter by project names (comma-separated)')
    .option('-s, --status <status>', 'Filter by status')
    .option('--priority <priority>', 'Filter by priority')
    .option('-l, --limit <number>', 'Maximum number of results', '20')
    .action(async (options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Searching...');

      try {
        spinner?.start();
        const data = await ctx.client.issues.search({
          query: options.query,
          projects: options.projects?.split(','),
          status: options.status as Status | undefined,
          priority: options.priority as Priority | undefined,
          limit: parseInt(options.limit, 10),
        });
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
        } else if (data.length === 0) {
          console.log('No issues found');
        } else {
          console.log(formatIssues(data));
        }
      } catch (error) {
        spinner?.fail('Search failed');
        handleError(error, ctx);
      }
    });

  // ulu issues update <id>
  issues
    .command('update <id>')
    .description('Update issue status')
    .requiredOption('-s, --status <status>', 'New status (open, completed, deferred, wontfix)')
    .option('-r, --reason <text>', 'Reason for status change')
    .action(async (id: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Updating issue...');

      try {
        spinner?.start();
        const issue = await ctx.client.issues.updateStatus(id, {
          status: options.status as Status,
          reason: options.reason,
        });
        spinner?.succeed('Issue updated');

        if (ctx.json) {
          console.log(JSON.stringify(issue, null, 2));
        } else {
          console.log(`Issue ${id.slice(0, 8)} status changed to: ${issue.status}`);
        }
      } catch (error) {
        spinner?.fail('Failed to update issue');
        handleError(error, ctx);
      }
    });

  // ulu issues close <id>
  issues
    .command('close <id>')
    .description('Close an issue (mark as completed)')
    .option('-r, --reason <text>', 'Reason for closing')
    .action(async (id: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Closing issue...');

      try {
        spinner?.start();
        const issue = await ctx.client.issues.updateStatus(id, {
          status: 'completed',
          reason: options.reason ?? 'Closed via CLI',
        });
        spinner?.succeed('Issue closed');

        if (ctx.json) {
          console.log(JSON.stringify(issue, null, 2));
        } else {
          console.log(`Issue ${id.slice(0, 8)} closed`);
        }
      } catch (error) {
        spinner?.fail('Failed to close issue');
        handleError(error, ctx);
      }
    });

  // ulu issues add-note <id>
  issues
    .command('add-note <id>')
    .description('Add a note to an issue')
    .requiredOption('-m, --message <text>', 'Note content')
    .option('-t, --type <type>', 'Note type (context, resolution, blocker)', 'context')
    .action(async (id: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Adding note...');

      try {
        spinner?.start();
        const note = await ctx.client.issues.addNote(id, {
          content: options.message,
          noteType: options.type as 'context' | 'resolution' | 'blocker',
        });
        spinner?.succeed('Note added');

        if (ctx.json) {
          console.log(JSON.stringify(note, null, 2));
        } else {
          console.log(`Note added to issue ${id.slice(0, 8)}`);
        }
      } catch (error) {
        spinner?.fail('Failed to add note');
        handleError(error, ctx);
      }
    });

  // ulu issues history <id>
  issues
    .command('history <id>')
    .description('Show issue status history')
    .action(async (id: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching history...');

      try {
        spinner?.start();
        const history = await ctx.client.issues.getHistory(id);
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(history, null, 2));
        } else if (history.length === 0) {
          console.log('No status history');
        } else {
          console.log('Status History:');
          for (const entry of history) {
            const date = new Date(entry.changedAt).toLocaleString();
            console.log(`  ${date}: ${entry.oldStatus ?? '(new)'} → ${entry.newStatus}`);
            if (entry.reason) {
              console.log(`    Reason: ${entry.reason}`);
            }
          }
        }
      } catch (error) {
        spinner?.fail('Failed to fetch history');
        handleError(error, ctx);
      }
    });

  // ulu issues undo <id>
  issues
    .command('undo <id>')
    .description('Undo the last status change')
    .action(async (id: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Undoing change...');

      try {
        spinner?.start();
        const issue = await ctx.client.issues.undoLastChange(id);
        spinner?.succeed('Change undone');

        if (ctx.json) {
          console.log(JSON.stringify(issue, null, 2));
        } else {
          console.log(`Issue ${id.slice(0, 8)} restored to: ${issue.status}`);
        }
      } catch (error) {
        spinner?.fail('Failed to undo change');
        handleError(error, ctx);
      }
    });
}
