import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as projectOps from '../../src/operations/projects.js';
import {
  BASE_URL,
  createMockProject,
  createMockProjectSummary,
  createMockTrendDataPoint,
  createMockIssue,
  createMockBulkStatusUpdateResult,
  createMockMergeIssuesResult,
  mockValidatedEndpoint,
  mockValidatedListEndpoint,
  ProjectResponseSchema,
  IssueResponseSchema,
} from '../setup.js';
import {
  ProjectSummaryResponseSchema,
  TrendDataPointResponseSchema,
  BulkStatusUpdateResultResponseSchema,
  MergeIssuesResultResponseSchema,
} from '../contract-helpers.js';

describe('Project Operations', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: 'ulr_test-api-key-12345',
    });
  });

  describe('list', () => {
    it('should list all projects', async () => {
      const mockProjects = [
        createMockProject({ name: 'Project A' }),
        createMockProject({ name: 'Project B' }),
      ];

      mockValidatedListEndpoint(
        BASE_URL,
        'get',
        '/projects',
        mockProjects,
        ProjectResponseSchema
      );

      const projects = await projectOps.list(client);

      expect(projects).toHaveLength(2);
      expect(projects[0].name).toBe('Project A');
    });
  });

  describe('get', () => {
    it('should get project by ID', async () => {
      const projectId = '11111111-1111-1111-1111-111111111111';
      const mockProject = createMockProject({ id: projectId, name: 'Project A' });

      mockValidatedEndpoint(
        BASE_URL,
        'get',
        `/projects/${projectId}`,
        mockProject,
        ProjectResponseSchema
      );

      const project = await projectOps.get(client, projectId);

      expect(project.id).toBe(projectId);
      expect(project.name).toBe('Project A');
    });

    it('should get project by name', async () => {
      const mockProject = createMockProject({ name: 'my-project' });

      mockValidatedEndpoint(
        BASE_URL,
        'get',
        '/projects/my-project',
        mockProject,
        ProjectResponseSchema
      );

      const project = await projectOps.get(client, 'my-project');

      expect(project.name).toBe('my-project');
    });

    it('should URL encode project names with special characters', async () => {
      const mockProject = createMockProject({ name: 'my project/with slashes' });

      mockValidatedEndpoint(
        BASE_URL,
        'get',
        '/projects/my%20project%2Fwith%20slashes',
        mockProject,
        ProjectResponseSchema
      );

      const project = await projectOps.get(client, 'my project/with slashes');

      expect(project.name).toBe('my project/with slashes');
    });
  });

  describe('create', () => {
    it('should create a new project', async () => {
      const mockProject = createMockProject({ name: 'New Project' });

      nock(BASE_URL)
        .post('/projects', { name: 'New Project' })
        .reply(201, { data: mockProject });

      const project = await projectOps.create(client, { name: 'New Project' });

      expect(project.name).toBe('New Project');
    });
  });

  describe('update', () => {
    it('should update project', async () => {
      const projectId = '22222222-2222-2222-2222-222222222222';
      const mockProject = createMockProject({ id: projectId, name: 'Updated Name' });

      nock(BASE_URL)
        .patch(`/projects/${projectId}`, { name: 'Updated Name' })
        .reply(200, { data: mockProject });

      const project = await projectOps.update(client, projectId, { name: 'Updated Name' });

      expect(project.name).toBe('Updated Name');
    });
  });

  describe('deleteProject', () => {
    it('should hard delete project with confirmation', async () => {
      nock(BASE_URL)
        .delete('/projects/proj-1', {
          confirm: true,
          confirmationPhrase: 'proj-1',
        })
        .reply(200, { data: {} });

      await expect(
        projectOps.deleteProject(client, 'proj-1', {
          confirm: true,
          confirmationPhrase: 'proj-1',
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('softDelete', () => {
    it('should soft delete project', async () => {
      nock(BASE_URL)
        .delete('/projects/proj-1/soft', {
          confirm: true,
          confirmationPhrase: 'proj-1',
        })
        .reply(200, { data: {} });

      await expect(
        projectOps.softDelete(client, 'proj-1', {
          confirm: true,
          confirmationPhrase: 'proj-1',
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('restore', () => {
    it('should restore soft-deleted project', async () => {
      const mockProject = createMockProject({ name: 'Restored Project', deletedAt: null });

      mockValidatedEndpoint(
        BASE_URL,
        'post',
        '/projects/proj-1/restore',
        mockProject,
        ProjectResponseSchema
      );

      const project = await projectOps.restore(client, 'proj-1');

      expect(project.deletedAt).toBeNull();
    });
  });

  describe('rename', () => {
    it('should rename project', async () => {
      const mockProject = createMockProject({ name: 'new-name' });

      nock(BASE_URL)
        .post('/projects/rename', {
          oldName: 'old-name',
          newName: 'new-name',
        })
        .reply(200, { data: mockProject });

      const project = await projectOps.rename(client, {
        oldName: 'old-name',
        newName: 'new-name',
      });

      expect(project.name).toBe('new-name');
    });
  });

  describe('getSummary', () => {
    it('should get project summary', async () => {
      const mockSummary = createMockProjectSummary({
        totalRuns: 50,
        openIssues: 25,
      });

      mockValidatedEndpoint(
        BASE_URL,
        'get',
        '/projects/proj-1/summary',
        mockSummary,
        ProjectSummaryResponseSchema
      );

      const summary = await projectOps.getSummary(client, 'proj-1');

      expect(summary.totalRuns).toBe(50);
      expect(summary.openIssues).toBe(25);
    });
  });

  describe('getTrends', () => {
    it('should get project trends with default query', async () => {
      const mockTrends = [
        createMockTrendDataPoint({ date: '2024-01-01', openIssues: 10, completedIssues: 5 }),
        createMockTrendDataPoint({ date: '2024-01-02', openIssues: 8, completedIssues: 7 }),
      ];

      mockValidatedListEndpoint(
        BASE_URL,
        'get',
        '/projects/proj-1/trends',
        mockTrends,
        TrendDataPointResponseSchema
      );

      const trends = await projectOps.getTrends(client, 'proj-1');

      expect(trends).toHaveLength(2);
      expect(trends[0].openIssues).toBe(10);
    });

    it('should get project trends with query parameters', async () => {
      const mockTrends = [createMockTrendDataPoint({ date: '2024-01-01', openIssues: 5 })];

      nock(BASE_URL)
        .get('/projects/proj-1/trends')
        .query({ days: 7 })
        .reply(200, { data: mockTrends });

      const trends = await projectOps.getTrends(client, 'proj-1', { days: 7 });

      expect(trends).toHaveLength(1);
    });
  });

  describe('listIssues', () => {
    it('should list project issues', async () => {
      const mockIssues = [
        createMockIssue({ title: 'Bug 1', priority: 'critical' }),
        createMockIssue({ title: 'Bug 2', priority: 'suggested' }),
      ];

      mockValidatedListEndpoint(
        BASE_URL,
        'get',
        '/projects/proj-1/issues',
        mockIssues,
        IssueResponseSchema
      );

      const issues = await projectOps.listIssues(client, 'proj-1');

      expect(issues).toHaveLength(2);
    });

    it('should list issues with filters', async () => {
      const mockIssues = [createMockIssue({ title: 'Critical Bug', priority: 'critical' })];

      nock(BASE_URL)
        .get('/projects/proj-1/issues')
        .query({
          status: 'open',
          priority: 'critical',
          limit: 10,
        })
        .reply(200, { data: mockIssues });

      const issues = await projectOps.listIssues(client, 'proj-1', {
        status: 'open',
        priority: 'critical',
        limit: 10,
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].priority).toBe('critical');
    });
  });

  describe('bulkUpdateIssueStatus', () => {
    it('should bulk update issue statuses', async () => {
      const projectId = '33333333-3333-3333-3333-333333333333';
      const issueId1 = '44444444-4444-4444-4444-444444444441';
      const issueId2 = '44444444-4444-4444-4444-444444444442';
      const mockResults = [
        createMockBulkStatusUpdateResult({ issueId: issueId1, success: true }),
        createMockBulkStatusUpdateResult({ issueId: issueId2, success: true }),
      ];

      nock(BASE_URL)
        .patch(`/projects/${projectId}/issues/status`, {
          updates: [
            { issueId: issueId1, status: 'completed', reason: 'Fixed' },
            { issueId: issueId2, status: 'wontfix', reason: 'By design' },
          ],
        })
        .reply(200, { data: mockResults });

      const results = await projectOps.bulkUpdateIssueStatus(client, projectId, [
        { issueId: issueId1, status: 'completed', reason: 'Fixed' },
        { issueId: issueId2, status: 'wontfix', reason: 'By design' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
    });
  });

  describe('mergeIssues', () => {
    it('should merge issues', async () => {
      const mockResult = createMockMergeIssuesResult({ mergedCount: 2 });

      nock(BASE_URL)
        .post('/projects/proj-1/issues/merge', {
          targetIssueId: 'issue-1',
          sourceIssueIds: ['issue-2', 'issue-3'],
          strategy: 'keep_target',
        })
        .reply(200, { data: mockResult });

      const result = await projectOps.mergeIssues(client, 'proj-1', {
        targetIssueId: 'issue-1',
        sourceIssueIds: ['issue-2', 'issue-3'],
        strategy: 'keep_target',
      });

      expect(result.mergedCount).toBe(2);
    });
  });
});
