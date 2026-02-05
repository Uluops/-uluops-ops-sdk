import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { createContext, handleError, type GlobalOptions } from '../context.js';
import { createSpinner, exitWithError } from '../utils.js';
import { formatRuns, formatRun } from '../formatters/output.js';
import type { SaveFeaturesListInput } from '../../types/runs.js';

/**
 * Read JSON input from file or stdin
 */
async function readJsonInput(options: { file?: string; stdin?: boolean }): Promise<unknown> {
  if (options.stdin) {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    try {
      return JSON.parse(content);
    } catch {
      exitWithError('Invalid JSON input from stdin');
    }
  }

  if (options.file) {
    if (!existsSync(options.file)) {
      exitWithError(`File not found: ${options.file}`);
    }
    const content = readFileSync(options.file, 'utf-8');
    try {
      return JSON.parse(content);
    } catch {
      exitWithError(`Invalid JSON in file: ${options.file}`);
    }
  }

  exitWithError('Either --file or --stdin is required');
}

/**
 * Register run commands
 */
export function registerRunCommands(program: Command): void {
  const runs = program
    .command('runs')
    .description('Manage validation runs');

  // ulu runs list <project>
  runs
    .command('list <project>')
    .description('List runs for a project')
    .option('-w, --workflow <type>', 'Filter by workflow type')
    .option('-l, --limit <number>', 'Maximum number of runs to return', '20')
    .action(async (project: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching runs...');

      try {
        spinner?.start();
        const data = await ctx.client.runs.listByProject(project, {
          workflowType: options.workflow,
          limit: parseInt(options.limit, 10),
        });
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
        } else if (data.length === 0) {
          console.log('No runs found');
        } else {
          console.log(formatRuns(data));
        }
      } catch (error) {
        spinner?.fail('Failed to fetch runs');
        handleError(error, ctx);
      }
    });

  // ulu runs get <runId>
  runs
    .command('get <runId>')
    .description('Get run by ID')
    .action(async (runId: string, _, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching run...');

      try {
        spinner?.start();
        const run = await ctx.client.runs.get(runId);
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(run, null, 2));
        } else {
          console.log(formatRun(run));
        }
      } catch (error) {
        spinner?.fail('Failed to fetch run');
        handleError(error, ctx);
      }
    });

  // ulu runs latest <project>
  runs
    .command('latest <project>')
    .description('Get the latest run for a project')
    .option('-w, --workflow <type>', 'Filter by workflow type')
    .action(async (project: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching latest run...');

      try {
        spinner?.start();
        const run = await ctx.client.runs.getLatest(project, options.workflow);
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(run, null, 2));
        } else {
          console.log(formatRun(run));
        }
      } catch (error) {
        spinner?.fail('Failed to fetch latest run');
        handleError(error, ctx);
      }
    });

  // ulu runs details <project>
  runs
    .command('details <project>')
    .description('Get detailed run information including validators and recommendations')
    .option('-n, --number <number>', 'Run number (defaults to latest)')
    .action(async (project: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Fetching run details...');

      try {
        spinner?.start();
        const runNumber = options.number ? parseInt(options.number, 10) : undefined;
        const details = await ctx.client.runs.getDetails(project, runNumber);
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(details, null, 2));
        } else {
          console.log(`Run #${details.run.runNumber} - ${details.run.workflowType}`);
          console.log(`Score: ${details.run.averageScore?.toFixed(1) ?? '-'}`);
          console.log(`Passed: ${details.run.allGatesPassed ? 'Yes' : 'No'}`);
          console.log('');

          if (details.validators.length > 0) {
            console.log('Validators:');
            for (const v of details.validators) {
              const status = v.status === 'PASS' ? '\u2713' : '\u2717';
              console.log(`  ${status} ${v.name}: ${v.score}/${v.maxScore ?? 100} (${v.status})`);
            }
          }

          if (details.recommendations.length > 0) {
            console.log('\nRecommendations:');
            for (const r of details.recommendations.slice(0, 10)) {
              const marker = r.correlation === 'new' ? '[NEW]' : r.correlation === 'regression' ? '[REG]' : '';
              console.log(`  - ${r.title} ${marker}`);
              console.log(`    ${r.priority}/${r.severity ?? '-'} from ${r.validator}`);
            }
            if (details.recommendations.length > 10) {
              console.log(`\n  ... and ${details.recommendations.length - 10} more`);
            }
          }
        }
      } catch (error) {
        spinner?.fail('Failed to fetch run details');
        handleError(error, ctx);
      }
    });

  // ulu runs save
  runs
    .command('save')
    .description('Save a validation run')
    .option('-f, --file <path>', 'JSON file containing run data')
    .option('--stdin', 'Read JSON from stdin')
    .option('-p, --project <name>', 'Override project name in input')
    .option('-w, --workflow <type>', 'Override workflow type in input')
    .action(async (options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);

      if (!options.file && !options.stdin) {
        exitWithError('Either --file or --stdin is required');
      }

      const spinner = ctx.quiet ? null : createSpinner('Saving run...');

      try {
        spinner?.start();

        // Read and parse input
        const input = (await readJsonInput(options)) as SaveFeaturesListInput;

        // Apply overrides
        if (options.project) input.project = options.project;
        if (options.workflow) input.workflowType = options.workflow;

        // Validate required fields
        if (!input.project) {
          exitWithError('Missing required field: project');
        }
        if (!input.workflowType) {
          exitWithError('Missing required field: workflowType');
        }
        if (!Array.isArray(input.validators)) {
          exitWithError('Missing required field: validators (must be an array)');
        }

        const result = await ctx.client.runs.save(input);
        spinner?.succeed('Run saved');

        if (ctx.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Run #${result.run.runNumber} saved successfully`);
          console.log('');
          console.log('Correlation:');
          // Handle both camelCase and snake_case responses
          const corr = result.correlation as unknown as Record<string, number>;
          console.log(`  New issues: ${corr.newIssues ?? corr.new_issues ?? 0}`);
          console.log(`  Recurring: ${corr.recurringIssues ?? corr.recurring_issues ?? 0}`);
          console.log(`  Regressions: ${corr.regressions ?? 0}`);
          if (result.deduplicated) {
            console.log('\n(Deduplicated: run with same idempotency key already existed)');
          }
        }
      } catch (error) {
        spinner?.fail('Failed to save run');
        handleError(error, ctx);
      }
    });

  // ulu runs validate
  runs
    .command('validate')
    .description('Validate run input without saving (dry run)')
    .option('-f, --file <path>', 'JSON file containing run data')
    .option('--stdin', 'Read JSON from stdin')
    .option('-p, --project <name>', 'Override project name in input')
    .option('-w, --workflow <type>', 'Override workflow type in input')
    .action(async (options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);

      if (!options.file && !options.stdin) {
        exitWithError('Either --file or --stdin is required');
      }

      const spinner = ctx.quiet ? null : createSpinner('Validating...');

      try {
        spinner?.start();

        // Read and parse input
        const input = (await readJsonInput(options)) as SaveFeaturesListInput;

        // Apply overrides
        if (options.project) input.project = options.project;
        if (options.workflow) input.workflowType = options.workflow;

        const result = await ctx.client.runs.validate(input);
        spinner?.succeed('Validation complete');

        if (ctx.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          // Handle both camelCase and snake_case responses
          const res = result as unknown as Record<string, unknown>;
          const wouldCreate = res.wouldCreate ?? res.would_create;
          const wouldUpdate = res.wouldUpdate ?? res.would_update;
          const wouldRegress = res.wouldRegress ?? res.would_regress;
          const validationErrors = (res.validationErrors ?? res.validation_errors ?? []) as string[];
          const preview = res.preview as Record<string, unknown> | undefined;

          console.log('Validation Preview:');
          console.log(`  Would create: ${wouldCreate ? 'Yes' : 'No'}`);
          console.log(`  Would update: ${wouldUpdate ? 'Yes' : 'No'}`);
          console.log(`  Would regress: ${wouldRegress ? 'Yes' : 'No'}`);

          if (validationErrors.length > 0) {
            console.log('\nValidation Errors:');
            for (const err of validationErrors) {
              console.log(`  - ${err}`);
            }
          }

          if (preview) {
            const newIssues = (preview.newIssues ?? preview.new_issues ?? []) as unknown[];
            const recurringIssues = (preview.recurringIssues ?? preview.recurring_issues ?? []) as unknown[];
            const regressions = (preview.regressions ?? []) as unknown[];
            console.log('\nCorrelation Preview:');
            console.log(`  New issues: ${newIssues.length}`);
            console.log(`  Recurring: ${recurringIssues.length}`);
            console.log(`  Regressions: ${regressions.length}`);
          }
        }
      } catch (error) {
        spinner?.fail('Validation failed');
        handleError(error, ctx);
      }
    });

  // ulu runs diff <project>
  runs
    .command('diff <project>')
    .description('Compare two runs')
    .requiredOption('-b, --base <number>', 'Base run number')
    .requiredOption('-c, --compare <number>', 'Compare run number')
    .action(async (project: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);
      const spinner = ctx.quiet ? null : createSpinner('Comparing runs...');

      try {
        spinner?.start();
        const result = await ctx.client.runs.diff({
          project,
          baseRun: parseInt(options.base, 10),
          compareRun: parseInt(options.compare, 10),
        });
        spinner?.succeed();

        if (ctx.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Comparing run #${options.base} → #${options.compare}\n`);

          if (result.fixed.length > 0) {
            console.log(`Fixed (${result.fixed.length}):`);
            for (const issue of result.fixed.slice(0, 5)) {
              console.log(`  \u2713 ${issue.title}`);
            }
            if (result.fixed.length > 5) {
              console.log(`  ... and ${result.fixed.length - 5} more`);
            }
          }

          if (result.new.length > 0) {
            console.log(`\nNew (${result.new.length}):`);
            for (const issue of result.new.slice(0, 5)) {
              console.log(`  + ${issue.title}`);
            }
            if (result.new.length > 5) {
              console.log(`  ... and ${result.new.length - 5} more`);
            }
          }

          if (result.unchanged.length > 0) {
            console.log(`\nUnchanged: ${result.unchanged.length} issues`);
          }
        }
      } catch (error) {
        spinner?.fail('Failed to compare runs');
        handleError(error, ctx);
      }
    });

  // ulu runs archive <project>
  runs
    .command('archive <project>')
    .description('Archive old runs')
    .option('--before-run <number>', 'Archive runs before this run number')
    .option('--before-date <date>', 'Archive runs before this date (ISO format)')
    .option('--keep-last <number>', 'Keep the last N runs')
    .option('--reason <text>', 'Reason for archiving')
    .action(async (project: string, options, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const ctx = createContext(globalOpts);

      if (!options.beforeRun && !options.beforeDate && !options.keepLast) {
        exitWithError('One of --before-run, --before-date, or --keep-last is required');
      }

      const spinner = ctx.quiet ? null : createSpinner('Archiving runs...');

      try {
        spinner?.start();
        const result = await ctx.client.runs.archive({
          project,
          beforeRunNumber: options.beforeRun ? parseInt(options.beforeRun, 10) : undefined,
          beforeDate: options.beforeDate,
          keepLast: options.keepLast ? parseInt(options.keepLast, 10) : undefined,
          reason: options.reason,
        });
        spinner?.succeed('Runs archived');

        if (ctx.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Archived ${result.archivedCount} runs`);
        }
      } catch (error) {
        spinner?.fail('Failed to archive runs');
        handleError(error, ctx);
      }
    });
}
