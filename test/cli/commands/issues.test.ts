import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerIssueCommands } from '../../../src/cli/commands/issues.js';

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
import type { Issue } from '../../../src/types/issues.js';

describe('Issues CLI Commands', () => {
  let program: Command;
  let mockClient: {
    issues: {
      listByProject: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      getDetails: ReturnType<typeof vi.fn>;
      search: ReturnType<typeof vi.fn>;
      updateStatus: ReturnType<typeof vi.fn>;
      addNote: ReturnType<typeof vi.fn>;
      getHistory: ReturnType<typeof vi.fn>;
      undoLastChange: ReturnType<typeof vi.fn>;
    };
  };
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  const mockIssue: Issue = {
    id: 'issue-123e4567-e89b-12d3',
    projectId: 'proj-1',
    fingerprint: 'abc123def456',
    title: 'Critical bug in authentication',
    status: 'open',
    priority: 'critical',
    severity: 'high',
    validator: 'security-analyst',
    filePath: 'src/auth/login.ts',
    lineNumber: 42,
    timesSeen: 3,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      issues: {
        listByProject: vi.fn(),
        get: vi.fn(),
        getDetails: vi.fn(),
        search: vi.fn(),
        updateStatus: vi.fn(),
        addNote: vi.fn(),
        getHistory: vi.fn(),
        undoLastChange: vi.fn(),
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
    registerIssueCommands(program);

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('issues list <project>', () => {
    it('should call client.issues.listByProject with project name', async () => {
      mockClient.issues.listByProject.mockResolvedValue([mockIssue]);

      await program.parseAsync(['node', 'test', 'issues', 'list', 'my-project']);

      expect(mockClient.issues.listByProject).toHaveBeenCalledWith('my-project', {
        status: undefined,
        priority: undefined,
        severity: undefined,
        validator: undefined,
        failureDomain: undefined,
        limit: 50,
        includeResolved: undefined,
      });
    });

    it('should pass status filter', async () => {
      mockClient.issues.listByProject.mockResolvedValue([mockIssue]);

      await program.parseAsync(['node', 'test', 'issues', 'list', 'my-project', '--status', 'open']);

      expect(mockClient.issues.listByProject).toHaveBeenCalledWith('my-project', expect.objectContaining({
        status: 'open',
      }));
    });

    it('should pass priority filter', async () => {
      mockClient.issues.listByProject.mockResolvedValue([mockIssue]);

      await program.parseAsync(['node', 'test', 'issues', 'list', 'my-project', '--priority', 'critical']);

      expect(mockClient.issues.listByProject).toHaveBeenCalledWith('my-project', expect.objectContaining({
        priority: 'critical',
      }));
    });

    it('should pass severity filter', async () => {
      mockClient.issues.listByProject.mockResolvedValue([mockIssue]);

      await program.parseAsync(['node', 'test', 'issues', 'list', 'my-project', '--severity', 'high']);

      expect(mockClient.issues.listByProject).toHaveBeenCalledWith('my-project', expect.objectContaining({
        severity: 'high',
      }));
    });

    it('should pass validator filter', async () => {
      mockClient.issues.listByProject.mockResolvedValue([mockIssue]);

      await program.parseAsync(['node', 'test', 'issues', 'list', 'my-project', '--validator', 'code-validator']);

      expect(mockClient.issues.listByProject).toHaveBeenCalledWith('my-project', expect.objectContaining({
        validator: 'code-validator',
      }));
    });

    it('should pass domain filter', async () => {
      mockClient.issues.listByProject.mockResolvedValue([mockIssue]);

      await program.parseAsync(['node', 'test', 'issues', 'list', 'my-project', '--domain', 'SEM']);

      expect(mockClient.issues.listByProject).toHaveBeenCalledWith('my-project', expect.objectContaining({
        failureDomain: 'SEM',
      }));
    });

    it('should pass custom limit', async () => {
      mockClient.issues.listByProject.mockResolvedValue([mockIssue]);

      await program.parseAsync(['node', 'test', 'issues', 'list', 'my-project', '--limit', '25']);

      expect(mockClient.issues.listByProject).toHaveBeenCalledWith('my-project', expect.objectContaining({
        limit: 25,
      }));
    });

    it('should pass include-resolved flag', async () => {
      mockClient.issues.listByProject.mockResolvedValue([mockIssue]);

      await program.parseAsync(['node', 'test', 'issues', 'list', 'my-project', '--include-resolved']);

      expect(mockClient.issues.listByProject).toHaveBeenCalledWith('my-project', expect.objectContaining({
        includeResolved: true,
      }));
    });

    it('should show empty message when no issues', async () => {
      mockClient.issues.listByProject.mockResolvedValue([]);

      await program.parseAsync(['node', 'test', 'issues', 'list', 'my-project']);

      expect(consoleSpy).toHaveBeenCalledWith('No issues found');
    });

    it('should format issues as table', async () => {
      mockClient.issues.listByProject.mockResolvedValue([mockIssue]);

      await program.parseAsync(['node', 'test', 'issues', 'list', 'my-project']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Critical bug in authentication');
      expect(output).toContain('open');
    });
  });

  describe('issues get <id>', () => {
    it('should call client.issues.get with issue ID', async () => {
      mockClient.issues.get.mockResolvedValue(mockIssue);

      await program.parseAsync(['node', 'test', 'issues', 'get', 'issue-123']);

      expect(mockClient.issues.get).toHaveBeenCalledWith('issue-123');
    });

    it('should format single issue', async () => {
      mockClient.issues.get.mockResolvedValue(mockIssue);

      await program.parseAsync(['node', 'test', 'issues', 'get', 'issue-123']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Title: Critical bug in authentication');
      expect(output).toContain('Status: open');
      expect(output).toContain('Priority: critical');
    });

    it('should call getDetails with --full flag', async () => {
      const mockDetails = {
        issue: mockIssue,
        occurrences: [
          { validator: 'code-validator', filePath: 'src/test.ts', lineNumber: 10 },
        ],
        notes: [
          { noteType: 'context', content: 'This is a note' },
        ],
        statusHistory: [
          { oldStatus: null, newStatus: 'open', changedAt: '2024-01-15T10:00:00Z' },
        ],
      };
      mockClient.issues.getDetails.mockResolvedValue(mockDetails);

      await program.parseAsync(['node', 'test', 'issues', 'get', 'issue-123', '--full']);

      expect(mockClient.issues.getDetails).toHaveBeenCalledWith('issue-123');
    });

    it('should show occurrences with --full flag', async () => {
      const mockDetails = {
        issue: mockIssue,
        occurrences: [
          { validator: 'code-validator', filePath: 'src/test.ts', lineNumber: 10 },
        ],
        notes: [],
        statusHistory: [],
      };
      mockClient.issues.getDetails.mockResolvedValue(mockDetails);

      await program.parseAsync(['node', 'test', 'issues', 'get', 'issue-123', '--full']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Occurrences (1)');
      expect(output).toContain('code-validator');
    });
  });

  describe('issues search', () => {
    it('should require --query option', async () => {
      await expect(
        program.parseAsync(['node', 'test', 'issues', 'search'])
      ).rejects.toThrow();
    });

    it('should call client.issues.search with query', async () => {
      mockClient.issues.search.mockResolvedValue([mockIssue]);

      await program.parseAsync(['node', 'test', 'issues', 'search', '--query', 'authentication']);

      expect(mockClient.issues.search).toHaveBeenCalledWith({
        query: 'authentication',
        projects: undefined,
        status: undefined,
        priority: undefined,
        limit: 20,
      });
    });

    it('should split projects by comma', async () => {
      mockClient.issues.search.mockResolvedValue([mockIssue]);

      await program.parseAsync([
        'node', 'test', 'issues', 'search',
        '--query', 'bug',
        '--projects', 'proj-1,proj-2,proj-3',
      ]);

      expect(mockClient.issues.search).toHaveBeenCalledWith(expect.objectContaining({
        projects: ['proj-1', 'proj-2', 'proj-3'],
      }));
    });

    it('should show empty message when no results', async () => {
      mockClient.issues.search.mockResolvedValue([]);

      await program.parseAsync(['node', 'test', 'issues', 'search', '--query', 'nonexistent']);

      expect(consoleSpy).toHaveBeenCalledWith('No issues found');
    });
  });

  describe('issues update <id>', () => {
    it('should require --status option', async () => {
      await expect(
        program.parseAsync(['node', 'test', 'issues', 'update', 'issue-123'])
      ).rejects.toThrow();
    });

    it('should call client.issues.updateStatus', async () => {
      const updatedIssue = { ...mockIssue, status: 'completed' as const };
      mockClient.issues.updateStatus.mockResolvedValue(updatedIssue);

      await program.parseAsync([
        'node', 'test', 'issues', 'update', 'issue-123',
        '--status', 'completed',
      ]);

      expect(mockClient.issues.updateStatus).toHaveBeenCalledWith('issue-123', {
        status: 'completed',
        reason: undefined,
      });
    });

    it('should pass reason option', async () => {
      const updatedIssue = { ...mockIssue, status: 'deferred' as const };
      mockClient.issues.updateStatus.mockResolvedValue(updatedIssue);

      await program.parseAsync([
        'node', 'test', 'issues', 'update', 'issue-123',
        '--status', 'deferred',
        '--reason', 'Will fix in next sprint',
      ]);

      expect(mockClient.issues.updateStatus).toHaveBeenCalledWith('issue-123', {
        status: 'deferred',
        reason: 'Will fix in next sprint',
      });
    });

    it('should show confirmation message', async () => {
      const updatedIssue = { ...mockIssue, status: 'completed' as const };
      mockClient.issues.updateStatus.mockResolvedValue(updatedIssue);

      await program.parseAsync([
        'node', 'test', 'issues', 'update', 'issue-123',
        '--status', 'completed',
      ]);

      const output = consoleSpy.mock.calls.flat().join('\n');
      // ID is truncated to 8 chars in output
      expect(output).toContain('issue-12');
      expect(output).toContain('completed');
    });
  });

  describe('issues close <id>', () => {
    it('should call updateStatus with completed status', async () => {
      const closedIssue = { ...mockIssue, status: 'completed' as const };
      mockClient.issues.updateStatus.mockResolvedValue(closedIssue);

      await program.parseAsync(['node', 'test', 'issues', 'close', 'issue-123']);

      expect(mockClient.issues.updateStatus).toHaveBeenCalledWith('issue-123', {
        status: 'completed',
        reason: 'Closed via CLI',
      });
    });

    it('should use custom reason', async () => {
      const closedIssue = { ...mockIssue, status: 'completed' as const };
      mockClient.issues.updateStatus.mockResolvedValue(closedIssue);

      await program.parseAsync([
        'node', 'test', 'issues', 'close', 'issue-123',
        '--reason', 'Fixed in PR #42',
      ]);

      expect(mockClient.issues.updateStatus).toHaveBeenCalledWith('issue-123', {
        status: 'completed',
        reason: 'Fixed in PR #42',
      });
    });

    it('should show closed confirmation', async () => {
      const closedIssue = { ...mockIssue, status: 'completed' as const };
      mockClient.issues.updateStatus.mockResolvedValue(closedIssue);

      await program.parseAsync(['node', 'test', 'issues', 'close', 'issue-123']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('closed');
    });
  });

  describe('issues add-note <id>', () => {
    it('should require --message option', async () => {
      await expect(
        program.parseAsync(['node', 'test', 'issues', 'add-note', 'issue-123'])
      ).rejects.toThrow();
    });

    it('should call client.issues.addNote', async () => {
      const mockNote = { id: 'note-1', issueId: 'issue-123', noteType: 'context', content: 'Test note', createdAt: '2024-01-15' };
      mockClient.issues.addNote.mockResolvedValue(mockNote);

      await program.parseAsync([
        'node', 'test', 'issues', 'add-note', 'issue-123',
        '--message', 'This is a test note',
      ]);

      expect(mockClient.issues.addNote).toHaveBeenCalledWith('issue-123', {
        content: 'This is a test note',
        noteType: 'context',
      });
    });

    it('should pass custom note type', async () => {
      const mockNote = { id: 'note-1', issueId: 'issue-123', noteType: 'resolution', content: 'Fixed by...', createdAt: '2024-01-15' };
      mockClient.issues.addNote.mockResolvedValue(mockNote);

      await program.parseAsync([
        'node', 'test', 'issues', 'add-note', 'issue-123',
        '--message', 'Fixed by reverting changes',
        '--type', 'resolution',
      ]);

      expect(mockClient.issues.addNote).toHaveBeenCalledWith('issue-123', {
        content: 'Fixed by reverting changes',
        noteType: 'resolution',
      });
    });
  });

  describe('issues history <id>', () => {
    it('should call client.issues.getHistory', async () => {
      const mockHistory = [
        { oldStatus: null, newStatus: 'open', changedAt: '2024-01-15T10:00:00Z' },
        { oldStatus: 'open', newStatus: 'completed', changedAt: '2024-01-16T10:00:00Z', reason: 'Fixed' },
      ];
      mockClient.issues.getHistory.mockResolvedValue(mockHistory);

      await program.parseAsync(['node', 'test', 'issues', 'history', 'issue-123']);

      expect(mockClient.issues.getHistory).toHaveBeenCalledWith('issue-123');
    });

    it('should format history entries', async () => {
      const mockHistory = [
        { oldStatus: null, newStatus: 'open', changedAt: '2024-01-15T10:00:00Z' },
        { oldStatus: 'open', newStatus: 'completed', changedAt: '2024-01-16T10:00:00Z', reason: 'Fixed' },
      ];
      mockClient.issues.getHistory.mockResolvedValue(mockHistory);

      await program.parseAsync(['node', 'test', 'issues', 'history', 'issue-123']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Status History:');
      expect(output).toContain('(new)');
      expect(output).toContain('open');
      expect(output).toContain('completed');
      expect(output).toContain('Reason: Fixed');
    });

    it('should show empty message when no history', async () => {
      mockClient.issues.getHistory.mockResolvedValue([]);

      await program.parseAsync(['node', 'test', 'issues', 'history', 'issue-123']);

      expect(consoleSpy).toHaveBeenCalledWith('No status history');
    });
  });

  describe('issues undo <id>', () => {
    it('should call client.issues.undoLastChange', async () => {
      const revertedIssue = { ...mockIssue, status: 'open' as const };
      mockClient.issues.undoLastChange.mockResolvedValue(revertedIssue);

      await program.parseAsync(['node', 'test', 'issues', 'undo', 'issue-123']);

      expect(mockClient.issues.undoLastChange).toHaveBeenCalledWith('issue-123');
    });

    it('should show restored status', async () => {
      const revertedIssue = { ...mockIssue, status: 'open' as const };
      mockClient.issues.undoLastChange.mockResolvedValue(revertedIssue);

      await program.parseAsync(['node', 'test', 'issues', 'undo', 'issue-123']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('restored');
      expect(output).toContain('open');
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

    it('should output JSON for issues list', async () => {
      mockClient.issues.listByProject.mockResolvedValue([mockIssue]);

      await program.parseAsync(['node', 'test', 'issues', 'list', 'my-project']);

      const output = consoleSpy.mock.calls.flat().join('');
      expect(output).toContain('"title"');
      expect(output).toContain('"Critical bug in authentication"');
    });

    it('should output JSON for issues get', async () => {
      mockClient.issues.get.mockResolvedValue(mockIssue);

      await program.parseAsync(['node', 'test', 'issues', 'get', 'issue-123']);

      const output = consoleSpy.mock.calls.flat().join('');
      expect(output).toContain('"status"');
      expect(output).toContain('"open"');
    });

    it('should output JSON for issues search', async () => {
      mockClient.issues.search.mockResolvedValue([mockIssue]);

      await program.parseAsync([
        'node', 'test', 'issues', 'search',
        '--query', 'bug',
      ]);

      const output = consoleSpy.mock.calls.flat().join('');
      expect(output).toContain('"fingerprint"');
    });
  });

  describe('Error handling', () => {
    it('should call handleError on API failure', async () => {
      const apiError = new Error('API Error');
      mockClient.issues.listByProject.mockRejectedValue(apiError);

      await expect(
        program.parseAsync(['node', 'test', 'issues', 'list', 'my-project'])
      ).rejects.toThrow('API Error');

      expect(handleError).toHaveBeenCalledWith(apiError, expect.any(Object));
    });
  });
});
