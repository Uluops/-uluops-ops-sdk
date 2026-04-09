import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as projectOps from '../../src/operations/projects.js';
import {
  BASE_URL,
  TEST_API_KEY,
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
  TEST_IDS,
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
      apiKey: TEST_API_KEY,
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
      expect(projects[0].id).toBeDefined();
      expect(projects[0].ownerId).toBeDefined();
      expect(projects[1].name).toBe('Project B');
    });
  });

  describe('get', () => {
    it('should get project by ID', async () => {
      const projectId = TEST_IDS.proj1;
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
      expect(project.id).toBeDefined();
      expect(project.ownerId).toBeDefined();
      expect(project.createdAt).toBeDefined();
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
      expect(project.id).toBeDefined();
      expect(project.createdAt).toBeDefined();
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
      const projectId = TEST_IDS.proj2;
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
        .delete(`/projects/${TEST_IDS.proj1}`, {
          confirm: true,
          confirmationPhrase: TEST_IDS.proj1,
        })
        .reply(200, { data: { deleted: true } });

      const result = await projectOps.deleteProject(client, TEST_IDS.proj1, {
        confirm: true,
        confirmationPhrase: TEST_IDS.proj1,
      });
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('softDelete', () => {
    it('should soft delete project', async () => {
      nock(BASE_URL)
        .delete(`/projects/${TEST_IDS.proj1}/soft`, {
          confirm: true,
          confirmationPhrase: TEST_IDS.proj1,
        })
        .reply(200, { data: { deleted: true } });

      const result = await projectOps.softDelete(client, TEST_IDS.proj1, {
        confirm: true,
        confirmationPhrase: TEST_IDS.proj1,
      });
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('restore', () => {
    it('should restore soft-deleted project', async () => {
      const mockProject = createMockProject({ name: 'Restored Project' });

      mockValidatedEndpoint(
        BASE_URL,
        'post',
        `/projects/${TEST_IDS.proj1}/restore`,
        mockProject,
        ProjectResponseSchema
      );

      const project = await projectOps.restore(client, TEST_IDS.proj1);

      expect(project.name).toBe('Restored Project');
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
        `/projects/${TEST_IDS.proj1}/summary`,
        mockSummary,
        ProjectSummaryResponseSchema
      );

      const summary = await projectOps.getSummary(client, TEST_IDS.proj1);

      expect(summary.project).toBeDefined();
      expect(summary.stats.totalRuns).toBe(50);
      expect(summary.stats.openIssues).toBe(25);
      expect(summary.stats.totalIssues).toBe(100);
      expect(summary.stats.criticalIssues).toBe(5);
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
        `/projects/${TEST_IDS.proj1}/trends`,
        mockTrends,
        TrendDataPointResponseSchema
      );

      const trends = await projectOps.getTrends(client, TEST_IDS.proj1);

      expect(trends).toHaveLength(2);
      expect(trends[0].date).toBe('2024-01-01');
      expect(trends[0].openIssues).toBe(10);
      expect(trends[0].completedIssues).toBe(5);
      expect(trends[1].openIssues).toBe(8);
      expect(trends[1].completedIssues).toBe(7);
    });

    it('should get project trends with query parameters', async () => {
      const mockTrends = [createMockTrendDataPoint({ date: '2024-01-01', openIssues: 5 })];

      nock(BASE_URL)
        .get(`/projects/${TEST_IDS.proj1}/trends`)
        .query({ days: 7 })
        .reply(200, { data: mockTrends });

      const trends = await projectOps.getTrends(client, TEST_IDS.proj1, { days: 7 });

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
        `/projects/${TEST_IDS.proj1}/issues`,
        mockIssues,
        IssueResponseSchema
      );

      const issues = await projectOps.listIssues(client, TEST_IDS.proj1);

      expect(issues).toHaveLength(2);
      expect(issues[0].title).toBe('Bug 1');
      expect(issues[0].priority).toBe('critical');
      expect(issues[1].title).toBe('Bug 2');
      expect(issues[1].priority).toBe('suggested');
    });

    it('should list issues with filters', async () => {
      const mockIssues = [createMockIssue({ title: 'Critical Bug', priority: 'critical' })];

      nock(BASE_URL)
        .get(`/projects/${TEST_IDS.proj1}/issues`)
        .query({
          status: 'open',
          priority: 'critical',
          limit: 10,
        })
        .reply(200, { data: mockIssues });

      const issues = await projectOps.listIssues(client, TEST_IDS.proj1, {
        status: 'open',
        priority: 'critical',
        limit: 10,
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].priority).toBe('critical');
    });
  });

  describe('listIssuesWithCount', () => {
    it('should return issues with count from API envelope', async () => {
      const mockIssues = [
        createMockIssue({ title: 'Bug 1', priority: 'critical' }),
        createMockIssue({ title: 'Bug 2', priority: 'suggested' }),
      ];

      nock(BASE_URL)
        .get(`/projects/${TEST_IDS.proj1}/issues`)
        .reply(200, { data: mockIssues, count: 42 });

      const result = await projectOps.listIssuesWithCount(client, TEST_IDS.proj1);

      expect(result.issues).toHaveLength(2);
      expect(result.count).toBe(42);
      expect(result.issues[0].title).toBe('Bug 1');
    });

    it('should pass through query filters', async () => {
      const mockIssues = [createMockIssue({ title: 'Critical Bug' })];

      nock(BASE_URL)
        .get(`/projects/${TEST_IDS.proj1}/issues`)
        .query({ status: 'open', priority: 'critical' })
        .reply(200, { data: mockIssues, count: 1 });

      const result = await projectOps.listIssuesWithCount(client, TEST_IDS.proj1, {
        status: 'open',
        priority: 'critical',
      });

      expect(result.issues).toHaveLength(1);
      expect(result.count).toBe(1);
    });

    it('should default count to data length when not in response', async () => {
      const mockIssues = [
        createMockIssue({ title: 'Bug 1' }),
        createMockIssue({ title: 'Bug 2' }),
      ];

      nock(BASE_URL)
        .get(`/projects/${TEST_IDS.proj1}/issues`)
        .reply(200, { data: mockIssues });

      const result = await projectOps.listIssuesWithCount(client, TEST_IDS.proj1);

      expect(result.issues).toHaveLength(2);
      expect(result.count).toBe(2);
    });
  });

  describe('bulkUpdateIssueStatus', () => {
    it('should bulk update issue statuses', async () => {
      const projectId = TEST_IDS.proj3;
      const issueId1 = TEST_IDS.issue1;
      const issueId2 = TEST_IDS.issue2;
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
      expect(results[0].issueId).toBe(issueId1);
      expect(results[1].issueId).toBe(issueId2);
      expect(results[0].previousStatus).toBe('open');
      expect(results[0].newStatus).toBe('completed');
    });
  });

  describe('mergeIssues', () => {
    it('should merge issues', async () => {
      const mockResult = createMockMergeIssuesResult({ mergedCount: 2 });

      nock(BASE_URL)
        .post(`/projects/${TEST_IDS.proj1}/issues/merge`, {
          targetIssueId: TEST_IDS.issue1,
          sourceIssueIds: [TEST_IDS.issue2, TEST_IDS.issue3],
          strategy: 'keep_target',
        })
        .reply(200, { data: mockResult });

      const result = await projectOps.mergeIssues(client, TEST_IDS.proj1, {
        targetIssueId: TEST_IDS.issue1,
        sourceIssueIds: [TEST_IDS.issue2, TEST_IDS.issue3],
        strategy: 'keep_target',
      });

      expect(result.mergedCount).toBe(2);
      expect(result.migratedOccurrences).toBe(5);
      expect(result.targetIssue).toBeDefined();
    });
  });
});
