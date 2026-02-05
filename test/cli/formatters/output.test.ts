import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  output,
  formatProjects,
  formatProject,
  formatProjectSummary,
  formatRuns,
  formatRun,
  formatIssues,
  formatIssue,
  formatApiKeys,
} from '../../../src/cli/formatters/output.js';
import type { Project } from '../../../src/types/projects.js';
import type { Run } from '../../../src/types/runs.js';
import type { Issue } from '../../../src/types/issues.js';
import type { PublicApiKey } from '../../../src/types/auth.js';

describe('Output Formatters', () => {
  describe('output', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should output JSON when ctx.json is true', () => {
      output({ test: 'data' }, { json: true, quiet: false });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"test"'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"data"'));
    });

    it('should output plain data when ctx.json is false', () => {
      output('plain text', { json: false, quiet: false });
      expect(consoleSpy).toHaveBeenCalledWith('plain text');
    });
  });

  describe('formatProjects', () => {
    const mockProjects: Project[] = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Project Alpha',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      },
      {
        id: '223e4567-e89b-12d3-a456-426614174001',
        name: 'Project Beta',
        createdAt: '2024-01-16T10:00:00Z',
        updatedAt: '2024-01-16T10:00:00Z',
      },
    ];

    it('should format projects as a table', () => {
      const result = formatProjects(mockProjects);
      expect(result).toContain('NAME');
      expect(result).toContain('ID');
      expect(result).toContain('CREATED');
      expect(result).toContain('Project Alpha');
      expect(result).toContain('Project Beta');
    });

    it('should truncate long IDs', () => {
      const result = formatProjects(mockProjects);
      // ID should be truncated to 8 chars
      expect(result).toContain('123e4567');
      expect(result).not.toContain('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should handle empty array', () => {
      const result = formatProjects([]);
      expect(result).toBe('No data');
    });
  });

  describe('formatProject', () => {
    const mockProject: Project = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Project',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-16T12:00:00Z',
    };

    it('should format a single project with key-value pairs', () => {
      const result = formatProject(mockProject);
      expect(result).toContain('Name: Test Project');
      expect(result).toContain('Id: 123e4567');
    });

    it('should include created and updated dates', () => {
      const result = formatProject(mockProject);
      expect(result).toContain('Created At:');
      expect(result).toContain('Updated At:');
    });
  });

  describe('formatProjectSummary', () => {
    it('should format project summary with stats', () => {
      const summary = {
        project: {
          id: 'proj-1',
          name: 'My Project',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
        stats: {
          openIssues: 5,
          criticalIssues: 2,
          totalIssues: 15,
          totalRuns: 10,
          latestRunNumber: 10,
          latestRunDate: '2024-01-15T10:00:00Z',
        },
      };

      const result = formatProjectSummary(summary);
      expect(result).toContain('Project: My Project');
      expect(result).toContain('Open: 5');
      expect(result).toContain('Critical: 2');
      expect(result).toContain('Total: 15');
      expect(result).toContain('Total: 10');
    });

    it('should handle flat response structure', () => {
      const flatSummary = {
        openIssues: 3,
        criticalIssues: 1,
        totalIssues: 10,
        totalRuns: 5,
      };

      const result = formatProjectSummary(flatSummary);
      expect(result).toContain('Open: 3');
      expect(result).toContain('Critical: 1');
    });

    it('should handle missing optional fields', () => {
      const summary = {
        stats: {
          openIssues: 0,
          criticalIssues: 0,
          totalIssues: 0,
          totalRuns: 0,
        },
      };

      const result = formatProjectSummary(summary);
      expect(result).toContain('Open: 0');
      // Should not throw for missing latestRunDate
    });
  });

  describe('formatRuns', () => {
    const mockRuns: Run[] = [
      {
        id: 'run-123',
        projectId: 'proj-1',
        runNumber: 5,
        workflowType: 'post-implementation',
        averageScore: 85.5,
        allGatesPassed: true,
        createdAt: '2024-01-15T10:00:00Z',
      },
      {
        id: 'run-124',
        projectId: 'proj-1',
        runNumber: 6,
        workflowType: 'ship',
        averageScore: 72.0,
        allGatesPassed: false,
        createdAt: '2024-01-16T10:00:00Z',
      },
    ];

    it('should format runs as a table', () => {
      const result = formatRuns(mockRuns);
      expect(result).toContain('#');
      expect(result).toContain('WORKFLOW');
      expect(result).toContain('SCORE');
      expect(result).toContain('PASSED');
      expect(result).toContain('post-implementation');
      expect(result).toContain('ship');
    });

    it('should show Yes/No for passed status', () => {
      const result = formatRuns(mockRuns);
      expect(result).toContain('Yes');
      expect(result).toContain('No');
    });

    it('should format score with one decimal', () => {
      const result = formatRuns(mockRuns);
      expect(result).toContain('85.5');
      expect(result).toContain('72.0');
    });

    it('should handle missing average score', () => {
      const runsWithMissingScore: Run[] = [
        {
          id: 'run-125',
          projectId: 'proj-1',
          runNumber: 7,
          workflowType: 'test',
          allGatesPassed: true,
          createdAt: '2024-01-17T10:00:00Z',
        },
      ];

      const result = formatRuns(runsWithMissingScore);
      expect(result).toContain('-');
    });
  });

  describe('formatRun', () => {
    const mockRun: Run = {
      id: 'run-123e4567-e89b-12d3',
      projectId: 'proj-1',
      runNumber: 5,
      workflowType: 'post-implementation',
      averageScore: 85.5,
      allGatesPassed: true,
      createdAt: '2024-01-15T10:00:00Z',
    };

    it('should format a single run', () => {
      const result = formatRun(mockRun);
      expect(result).toContain('Run Number: 5');
      expect(result).toContain('Workflow Type: post-implementation');
      expect(result).toContain('Average Score: 85.5');
      expect(result).toContain('All Gates Passed: Yes');
    });

    it('should handle missing score', () => {
      const runWithoutScore: Run = {
        ...mockRun,
        averageScore: undefined,
      };
      const result = formatRun(runWithoutScore);
      expect(result).toContain('Average Score: -');
    });
  });

  describe('formatIssues', () => {
    const mockIssues: Issue[] = [
      {
        id: 'issue-123e4567-e89b-12d3',
        projectId: 'proj-1',
        fingerprint: 'abc123',
        title: 'Test issue with a moderately long title',
        status: 'open',
        priority: 'critical',
        severity: 'high',
        validator: 'code-validator',
        timesSeen: 3,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      },
      {
        id: 'issue-223e4567-e89b-12d3',
        projectId: 'proj-1',
        fingerprint: 'def456',
        title: 'Another issue',
        status: 'completed',
        priority: 'suggested',
        validator: 'test-architect',
        timesSeen: 1,
        createdAt: '2024-01-16T10:00:00Z',
        updatedAt: '2024-01-16T10:00:00Z',
      },
    ];

    it('should format issues as a table', () => {
      const result = formatIssues(mockIssues);
      expect(result).toContain('ID');
      expect(result).toContain('TITLE');
      expect(result).toContain('STATUS');
      expect(result).toContain('PRIORITY');
      expect(result).toContain('SEVERITY');
    });

    it('should show issue statuses', () => {
      const result = formatIssues(mockIssues);
      expect(result).toContain('open');
      expect(result).toContain('completed');
    });

    it('should handle missing severity', () => {
      const result = formatIssues(mockIssues);
      // Second issue has no severity, should show '-'
      expect(result).toContain('-');
    });
  });

  describe('formatIssue', () => {
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
      failureCode: 'SEC-001',
      category: 'Security',
      timesSeen: 5,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    it('should format a single issue with all fields', () => {
      const result = formatIssue(mockIssue);
      expect(result).toContain('Title: Critical bug in authentication');
      expect(result).toContain('Status: open');
      expect(result).toContain('Priority: critical');
      expect(result).toContain('Severity: high');
      expect(result).toContain('Validator: security-analyst');
      expect(result).toContain('File Path: src/auth/login.ts');
      expect(result).toContain('Line Number: 42');
      expect(result).toContain('Failure Code: SEC-001');
      expect(result).toContain('Category: Security');
      expect(result).toContain('Times Seen: 5');
    });

    it('should handle missing optional fields', () => {
      const minimalIssue: Issue = {
        id: 'issue-min',
        projectId: 'proj-1',
        fingerprint: 'xyz',
        title: 'Minimal issue',
        status: 'open',
        priority: 'backlog',
        validator: 'code-validator',
        timesSeen: 1,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      };

      const result = formatIssue(minimalIssue);
      expect(result).toContain('Title: Minimal issue');
      // Should not contain fields that are undefined
      expect(result).not.toContain('File Path:');
    });
  });

  describe('formatApiKeys', () => {
    const mockKeys: PublicApiKey[] = [
      {
        id: 'key-123e4567-e89b-12d3',
        userId: 'user-1',
        name: 'Production Key',
        lastUsedAt: '2024-01-15T10:00:00Z',
        expiresAt: '2025-01-15T10:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
      },
      {
        id: 'key-223e4567-e89b-12d3',
        userId: 'user-1',
        name: null,
        createdAt: '2024-01-02T10:00:00Z',
      },
    ];

    it('should format API keys as a table', () => {
      const result = formatApiKeys(mockKeys);
      expect(result).toContain('ID');
      expect(result).toContain('NAME');
      expect(result).toContain('LAST USED');
      expect(result).toContain('EXPIRES');
      expect(result).toContain('Production Key');
    });

    it('should show (unnamed) for null names', () => {
      const result = formatApiKeys(mockKeys);
      expect(result).toContain('(unnamed)');
    });

    it('should show Never for missing dates', () => {
      const result = formatApiKeys(mockKeys);
      expect(result).toContain('Never');
    });
  });
});
