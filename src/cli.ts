#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerAuthCommands } from './cli/commands/auth.js';
import { registerProjectCommands } from './cli/commands/projects.js';
import { registerRunCommands } from './cli/commands/runs.js';
import { registerIssueCommands } from './cli/commands/issues.js';
import { registerAnalyticsCommands } from './cli/commands/analytics.js';
import { registerAdminCommands } from './cli/commands/admin.js';
import { registerDefinitionCommands, registerModelCommands } from '@uluops/registry-sdk/cli/commands';

// Get package.json for version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const program = new Command();

program
  .name('ulu')
  .description('UluOps validation tracker CLI')
  .version(packageJson.version, '-V, --version', 'Output the version number')
  .option('--api-key <key>', 'API key (overrides environment variable)')
  .option('--profile <name>', 'Config profile to use', 'default')
  .option('--base-url <url>', 'API base URL')
  .option('--json', 'Output in JSON format for scripting')
  .option('--debug', 'Enable debug output')
  .option('-q, --quiet', 'Suppress spinners and non-essential output');

// Register command groups
registerAuthCommands(program);
registerProjectCommands(program);
registerRunCommands(program);
registerIssueCommands(program);
registerAnalyticsCommands(program);
registerAdminCommands(program);

// Registry commands (from @uluops/registry-sdk)
registerDefinitionCommands(program);
registerModelCommands(program);

// Default action when no command is provided
program.action(() => {
  program.help();
});

// Parse and execute
program.parse();
