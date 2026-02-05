import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerRunCommands } from '../../../src/cli/commands/runs.js';

// Mock the context module
vi.mock('../../../src/cli/context.js', () => ({
  createContext: vi.fn(),
  handleError: vi.fn((error, ctx) => {
    throw error;
  }),
}));

// Mock withSpinner and exitWithError but keep other exports
vi.mock('../../../src/cli/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/cli/utils.js')>();
  return {
    ...actual,
    withSpinner: vi.fn(async (_ctx, _opts, fn) => fn()),
    exitWithError: vi.fn((msg) => {
      throw new Error(msg);
    }),
  };
});

import { createContext, handleError } from '../../../src/cli/context.js';
import { exitWithError } from '../../../src/cli/utils.js';
import type { Run } from '../../../src/types/runs.js';

describe('Runs CLI Commands', () => {
  let program: Command;
  let mockClient: {
    runs: {
      listByProject: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      getLatest: ReturnType<typeof vi.fn>;
      getDetails: ReturnType<typeof vi.fn>;
      save: ReturnType<typeof vi.fn>;
      validate: ReturnType<typeof vi.fn>;
      diff: ReturnType<typeof vi.fn>;
      archive: ReturnType<typeof vi.fn>;
    };
  };
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  const mockRun: Run = {
    id: 'run-123e4567-e89b-12d3',
    projectId: 'proj-1',
    runNumber: 5,
    workflowType: 'post-implementation',
    averageScore: 85.5,
    allGatesPassed: true,
    createdAt: '2024-01-15T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      runs: {
        listByProject: vi.fn(),
        get: vi.fn(),
        getLatest: vi.fn(),
        getDetails: vi.fn(),
        save: vi.fn(),
        validate: vi.fn(),
        diff: vi.fn(),
        archive: vi.fn(),
      },
    };

    vi.mocked(createContext).mockReturnValue({
      client: mockClient as unknown as ReturnType<typeof createContext>['client'],
      json: false,
      debug: false,
      quiet: true,
    });

    program = new Command();
    program.exitOverride();
    program.configureOutput({
      writeErr: () => {},
    });
    registerRunCommands(program);

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('runs list <project>', () => {
    it('should call client.runs.listByProject with project name', async () => {
      mockClient.runs.listByProject.mockResolvedValue([mockRun]);

      await program.parseAsync(['node', 'test', 'runs', 'list', 'my-project']);

      expect(mockClient.runs.listByProject).toHaveBeenCalledWith('my-project', {
        workflowType: undefined,
        limit: 20,
      });
    });

    it('should pass workflow type filter', async () => {
      mockClient.runs.listByProject.mockResolvedValue([mockRun]);

      await program.parseAsync(['node', 'test', 'runs', 'list', 'my-project', '--workflow', 'ship']);

      expect(mockClient.runs.listByProject).toHaveBeenCalledWith('my-project', {
        workflowType: 'ship',
        limit: 20,
      });
    });

    it('should pass custom limit', async () => {
      mockClient.runs.listByProject.mockResolvedValue([mockRun]);

      await program.parseAsync(['node', 'test', 'runs', 'list', 'my-project', '--limit', '10']);

      expect(mockClient.runs.listByProject).toHaveBeenCalledWith('my-project', {
        workflowType: undefined,
        limit: 10,
      });
    });

    it('should show empty message when no runs', async () => {
      mockClient.runs.listByProject.mockResolvedValue([]);

      await program.parseAsync(['node', 'test', 'runs', 'list', 'my-project']);

      expect(consoleSpy).toHaveBeenCalledWith('No runs found');
    });

    it('should format runs as table', async () => {
      mockClient.runs.listByProject.mockResolvedValue([mockRun]);

      await program.parseAsync(['node', 'test', 'runs', 'list', 'my-project']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('post-implementation');
      expect(output).toContain('85.5');
    });
  });

  describe('runs get <runId>', () => {
    it('should call client.runs.get with run ID', async () => {
      mockClient.runs.get.mockResolvedValue(mockRun);

      await program.parseAsync(['node', 'test', 'runs', 'get', 'run-123']);

      expect(mockClient.runs.get).toHaveBeenCalledWith('run-123');
    });

    it('should format single run', async () => {
      mockClient.runs.get.mockResolvedValue(mockRun);

      await program.parseAsync(['node', 'test', 'runs', 'get', 'run-123']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Run Number: 5');
      expect(output).toContain('Workflow Type: post-implementation');
    });
  });

  describe('runs latest <project>', () => {
    it('should call client.runs.getLatest', async () => {
      mockClient.runs.getLatest.mockResolvedValue(mockRun);

      await program.parseAsync(['node', 'test', 'runs', 'latest', 'my-project']);

      expect(mockClient.runs.getLatest).toHaveBeenCalledWith('my-project', undefined);
    });

    it('should pass workflow type filter', async () => {
      mockClient.runs.getLatest.mockResolvedValue(mockRun);

      await program.parseAsync(['node', 'test', 'runs', 'latest', 'my-project', '--workflow', 'ship']);

      expect(mockClient.runs.getLatest).toHaveBeenCalledWith('my-project', 'ship');
    });
  });

  describe('runs details <project>', () => {
    const mockDetails = {
      run: mockRun,
      validators: [
        { name: 'code-validator', score: 85, maxScore: 100, status: 'PASS' },
        { name: 'test-architect', score: 75, maxScore: 100, status: 'FAIL' },
      ],
      recommendations: [
        { title: 'Fix bug', priority: 'critical', severity: 'high', validator: 'code-validator', correlation: 'new' },
      ],
    };

    it('should call client.runs.getDetails with project', async () => {
      mockClient.runs.getDetails.mockResolvedValue(mockDetails);

      await program.parseAsync(['node', 'test', 'runs', 'details', 'my-project']);

      expect(mockClient.runs.getDetails).toHaveBeenCalledWith('my-project', undefined);
    });

    it('should pass run number option', async () => {
      mockClient.runs.getDetails.mockResolvedValue(mockDetails);

      await program.parseAsync(['node', 'test', 'runs', 'details', 'my-project', '--number', '3']);

      expect(mockClient.runs.getDetails).toHaveBeenCalledWith('my-project', 3);
    });

    it('should format details with validators and recommendations', async () => {
      mockClient.runs.getDetails.mockResolvedValue(mockDetails);

      await program.parseAsync(['node', 'test', 'runs', 'details', 'my-project']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Run #5');
      expect(output).toContain('Validators:');
      expect(output).toContain('code-validator');
      expect(output).toContain('Recommendations:');
      expect(output).toContain('Fix bug');
      expect(output).toContain('[NEW]');
    });
  });

  describe('runs save', () => {
    it('should require --file or --stdin', async () => {
      await expect(
        program.parseAsync(['node', 'test', 'runs', 'save'])
      ).rejects.toThrow('Either --file or --stdin is required');
    });
  });

  describe('runs validate', () => {
    it('should require --file or --stdin', async () => {
      await expect(
        program.parseAsync(['node', 'test', 'runs', 'validate'])
      ).rejects.toThrow('Either --file or --stdin is required');
    });
  });

  describe('runs diff <project>', () => {
    const mockDiff = {
      fixed: [{ title: 'Bug fixed', id: '1' }],
      new: [{ title: 'New issue', id: '2' }],
      unchanged: [{ title: 'Still there', id: '3' }],
    };

    it('should require --base and --compare options', async () => {
      await expect(
        program.parseAsync(['node', 'test', 'runs', 'diff', 'my-project'])
      ).rejects.toThrow();
    });

    it('should call client.runs.diff with correct params', async () => {
      mockClient.runs.diff.mockResolvedValue(mockDiff);

      await program.parseAsync([
        'node', 'test', 'runs', 'diff', 'my-project',
        '--base', '5',
        '--compare', '6',
      ]);

      expect(mockClient.runs.diff).toHaveBeenCalledWith({
        project: 'my-project',
        baseRun: 5,
        compareRun: 6,
      });
    });

    it('should format diff output', async () => {
      mockClient.runs.diff.mockResolvedValue(mockDiff);

      await program.parseAsync([
        'node', 'test', 'runs', 'diff', 'my-project',
        '--base', '5',
        '--compare', '6',
      ]);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Comparing run #5');
      expect(output).toContain('Fixed (1)');
      expect(output).toContain('Bug fixed');
      expect(output).toContain('New (1)');
      expect(output).toContain('New issue');
    });
  });

  describe('runs archive <project>', () => {
    it('should require one of the archive options', async () => {
      await expect(
        program.parseAsync(['node', 'test', 'runs', 'archive', 'my-project'])
      ).rejects.toThrow('One of --before-run, --before-date, or --keep-last is required');
    });

    it('should call client.runs.archive with --before-run', async () => {
      mockClient.runs.archive.mockResolvedValue({ archivedCount: 5 });

      await program.parseAsync([
        'node', 'test', 'runs', 'archive', 'my-project',
        '--before-run', '10',
      ]);

      expect(mockClient.runs.archive).toHaveBeenCalledWith({
        project: 'my-project',
        beforeRunNumber: 10,
        beforeDate: undefined,
        keepLast: undefined,
        reason: undefined,
      });
    });

    it('should call client.runs.archive with --keep-last', async () => {
      mockClient.runs.archive.mockResolvedValue({ archivedCount: 3 });

      await program.parseAsync([
        'node', 'test', 'runs', 'archive', 'my-project',
        '--keep-last', '5',
        '--reason', 'Cleanup old runs',
      ]);

      expect(mockClient.runs.archive).toHaveBeenCalledWith({
        project: 'my-project',
        beforeRunNumber: undefined,
        beforeDate: undefined,
        keepLast: 5,
        reason: 'Cleanup old runs',
      });
    });

    it('should show archive count', async () => {
      mockClient.runs.archive.mockResolvedValue({ archivedCount: 5 });

      await program.parseAsync([
        'node', 'test', 'runs', 'archive', 'my-project',
        '--keep-last', '10',
      ]);

      expect(consoleSpy).toHaveBeenCalledWith('Archived 5 runs');
    });
  });

  describe('JSON output mode', () => {
    beforeEach(() => {
      vi.mocked(createContext).mockReturnValue({
        client: mockClient as unknown as ReturnType<typeof createContext>['client'],
        json: true,
        debug: false,
        quiet: true,
      });
    });

    it('should output JSON for runs list', async () => {
      mockClient.runs.listByProject.mockResolvedValue([mockRun]);

      await program.parseAsync(['node', 'test', 'runs', 'list', 'my-project']);

      const output = consoleSpy.mock.calls.flat().join('');
      expect(output).toContain('"runNumber"');
      expect(output).toContain('5');
    });

    it('should output JSON for runs get', async () => {
      mockClient.runs.get.mockResolvedValue(mockRun);

      await program.parseAsync(['node', 'test', 'runs', 'get', 'run-123']);

      const output = consoleSpy.mock.calls.flat().join('');
      expect(output).toContain('"workflowType"');
      expect(output).toContain('"post-implementation"');
    });
  });
});
