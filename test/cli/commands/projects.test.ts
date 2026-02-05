import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerProjectCommands } from '../../../src/cli/commands/projects.js';

// Mock the context module
vi.mock('../../../src/cli/context.js', () => ({
  createContext: vi.fn(),
  handleError: vi.fn((error, ctx) => {
    throw error;
  }),
}));

// Mock withSpinner but keep other exports
vi.mock('../../../src/cli/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/cli/utils.js')>();
  return {
    ...actual,
    withSpinner: vi.fn(async (_ctx, _opts, fn) => fn()),
  };
});

import { createContext, handleError } from '../../../src/cli/context.js';
import type { Project } from '../../../src/types/projects.js';

describe('Projects CLI Commands', () => {
  let program: Command;
  let mockClient: {
    projects: {
      list: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      softDelete: ReturnType<typeof vi.fn>;
      restore: ReturnType<typeof vi.fn>;
      getSummary: ReturnType<typeof vi.fn>;
      getTrends: ReturnType<typeof vi.fn>;
    };
  };
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  const mockProject: Project = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'test-project',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock client
    mockClient = {
      projects: {
        list: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        softDelete: vi.fn(),
        restore: vi.fn(),
        getSummary: vi.fn(),
        getTrends: vi.fn(),
      },
    };

    // Mock createContext to return our mock client
    vi.mocked(createContext).mockReturnValue({
      client: mockClient as unknown as ReturnType<typeof createContext>['client'],
      json: false,
      debug: false,
      quiet: true,
    });

    // Create fresh program for each test
    program = new Command();
    program.exitOverride(); // Prevent process.exit
    program.configureOutput({
      writeErr: () => {}, // Suppress error output
    });
    registerProjectCommands(program);

    // Spy on console
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('projects list', () => {
    it('should call client.projects.list', async () => {
      mockClient.projects.list.mockResolvedValue([mockProject]);

      await program.parseAsync(['node', 'test', 'projects', 'list']);

      expect(mockClient.projects.list).toHaveBeenCalledTimes(1);
    });

    it('should format output as table by default', async () => {
      mockClient.projects.list.mockResolvedValue([mockProject]);

      await program.parseAsync(['node', 'test', 'projects', 'list']);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('test-project');
    });

    it('should output JSON when ctx.json is true', async () => {
      vi.mocked(createContext).mockReturnValue({
        client: mockClient as unknown as ReturnType<typeof createContext>['client'],
        json: true,
        debug: false,
        quiet: true,
      });
      mockClient.projects.list.mockResolvedValue([mockProject]);

      await program.parseAsync(['node', 'test', 'projects', 'list']);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('');
      expect(output).toContain('"name"');
      expect(output).toContain('"test-project"');
    });

    it('should show empty message when no projects', async () => {
      mockClient.projects.list.mockResolvedValue([]);

      await program.parseAsync(['node', 'test', 'projects', 'list']);

      expect(consoleSpy).toHaveBeenCalledWith('No projects found');
    });
  });

  describe('projects get <name>', () => {
    it('should call client.projects.get with project name', async () => {
      mockClient.projects.get.mockResolvedValue(mockProject);

      await program.parseAsync(['node', 'test', 'projects', 'get', 'my-project']);

      expect(mockClient.projects.get).toHaveBeenCalledWith('my-project');
    });

    it('should format single project output', async () => {
      mockClient.projects.get.mockResolvedValue(mockProject);

      await program.parseAsync(['node', 'test', 'projects', 'get', 'test-project']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Name: test-project');
    });

    it('should handle API errors', async () => {
      const apiError = new Error('Not found');
      mockClient.projects.get.mockRejectedValue(apiError);

      await expect(
        program.parseAsync(['node', 'test', 'projects', 'get', 'nonexistent'])
      ).rejects.toThrow('Not found');

      expect(handleError).toHaveBeenCalledWith(apiError, expect.any(Object));
    });
  });

  describe('projects create <name>', () => {
    it('should call client.projects.create with name', async () => {
      mockClient.projects.create.mockResolvedValue(mockProject);

      await program.parseAsync(['node', 'test', 'projects', 'create', 'new-project']);

      expect(mockClient.projects.create).toHaveBeenCalledWith({ name: 'new-project' });
    });

    it('should output created project', async () => {
      mockClient.projects.create.mockResolvedValue(mockProject);

      await program.parseAsync(['node', 'test', 'projects', 'create', 'test-project']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('test-project');
    });
  });

  describe('projects delete <name>', () => {
    it('should prompt for confirmation without --yes flag', async () => {
      await expect(
        program.parseAsync(['node', 'test', 'projects', 'delete', 'my-project'])
      ).rejects.toThrow('process.exit called');

      // Should show confirmation message, not call delete
      expect(mockClient.projects.softDelete).not.toHaveBeenCalled();
      expect(mockClient.projects.delete).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('soft-delete'));
    });

    it('should soft-delete with --yes flag', async () => {
      mockClient.projects.softDelete.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'projects', 'delete', 'my-project', '--yes']);

      expect(mockClient.projects.softDelete).toHaveBeenCalledWith('my-project', {
        confirm: true,
        confirmationPhrase: 'my-project',
      });
    });

    it('should hard-delete with --force --yes flags', async () => {
      mockClient.projects.delete.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'projects', 'delete', 'my-project', '--force', '--yes']);

      expect(mockClient.projects.delete).toHaveBeenCalledWith('my-project', {
        confirm: true,
        confirmationPhrase: 'my-project',
      });
    });

    it('should show restore hint after soft-delete', async () => {
      mockClient.projects.softDelete.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'projects', 'delete', 'my-project', '--yes']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('restore');
    });
  });

  describe('projects restore <name>', () => {
    it('should call client.projects.restore', async () => {
      mockClient.projects.restore.mockResolvedValue(mockProject);

      await program.parseAsync(['node', 'test', 'projects', 'restore', 'my-project']);

      expect(mockClient.projects.restore).toHaveBeenCalledWith('my-project');
    });
  });

  describe('projects summary <name>', () => {
    it('should call client.projects.getSummary', async () => {
      const mockSummary = {
        project: mockProject,
        stats: {
          openIssues: 5,
          criticalIssues: 2,
          totalIssues: 20,
          totalRuns: 10,
          latestRunNumber: 10,
          latestRunDate: '2024-01-15T10:00:00Z',
        },
      };
      mockClient.projects.getSummary.mockResolvedValue(mockSummary);

      await program.parseAsync(['node', 'test', 'projects', 'summary', 'my-project']);

      expect(mockClient.projects.getSummary).toHaveBeenCalledWith('my-project');
    });

    it('should format summary with stats', async () => {
      const mockSummary = {
        project: mockProject,
        stats: {
          openIssues: 5,
          criticalIssues: 2,
          totalIssues: 20,
          totalRuns: 10,
        },
      };
      mockClient.projects.getSummary.mockResolvedValue(mockSummary);

      await program.parseAsync(['node', 'test', 'projects', 'summary', 'my-project']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Open: 5');
      expect(output).toContain('Critical: 2');
    });
  });

  describe('projects trends <name>', () => {
    it('should call client.projects.getTrends with default days', async () => {
      mockClient.projects.getTrends.mockResolvedValue([]);

      await program.parseAsync(['node', 'test', 'projects', 'trends', 'my-project']);

      expect(mockClient.projects.getTrends).toHaveBeenCalledWith('my-project', { days: 30 });
    });

    it('should pass custom --days option', async () => {
      mockClient.projects.getTrends.mockResolvedValue([]);

      await program.parseAsync(['node', 'test', 'projects', 'trends', 'my-project', '--days', '7']);

      expect(mockClient.projects.getTrends).toHaveBeenCalledWith('my-project', { days: 7 });
    });

    it('should show no data message when trends empty', async () => {
      mockClient.projects.getTrends.mockResolvedValue([]);

      await program.parseAsync(['node', 'test', 'projects', 'trends', 'my-project']);

      expect(consoleSpy).toHaveBeenCalledWith('No trend data available');
    });

    it('should format trend data with bars', async () => {
      mockClient.projects.getTrends.mockResolvedValue([
        { date: '2024-01-15', openIssues: 5, newIssues: 2, resolvedIssues: 1 },
        { date: '2024-01-16', openIssues: 6, newIssues: 3, resolvedIssues: 2 },
      ]);

      await program.parseAsync(['node', 'test', 'projects', 'trends', 'my-project']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('2024-01-15');
      expect(output).toContain('#'); // Bar chart
      expect(output).toContain('5 open');
    });
  });
});
