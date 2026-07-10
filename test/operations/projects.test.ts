import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { ZodError } from 'zod';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as projectOps from '../../src/operations/projects.js';
import {
  BASE_URL,
  TEST_API_KEY,
  createMockProject,
  createMockProjectSummary,
  createMockDailyIssueCounts,
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
  DailyIssueCountsResponseSchema,
  BulkStatusUpdateResultResponseSchema,
  MergeIssuesResultResponseSchema,
  resetMockIds,
} from '../contract-helpers.js';

describe('Project Operations', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    resetMockIds();
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
    // API actually returns 204 No Content on successful delete; the SDK
    // synthesizes `{deleted: true}` to preserve the documented return shape.
    it('should hard delete project with confirmation (204 No Content)', async () => {
      nock(BASE_URL)
        .delete(`/projects/${TEST_IDS.proj1}`, {
          confirm: true,
          confirmationPhrase: TEST_IDS.proj1,
        })
        .reply(204);

      const result = await projectOps.deleteProject(client, TEST_IDS.proj1, {
        confirm: true,
        confirmationPhrase: TEST_IDS.proj1,
      });
      expect(result).toEqual({ deleted: true });
    });

    it('should also accept legacy 200 + body shape if the API returns one', async () => {
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
    it('should soft delete project (204 No Content)', async () => {
      nock(BASE_URL)
        .delete(`/projects/${TEST_IDS.proj1}/soft`, {
          confirm: true,
          confirmationPhrase: TEST_IDS.proj1,
        })
        .reply(204);

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
      const mockProject = createMockProject();
      const mockTrends = {
        project: mockProject,
        days: 30,
        daily: [
          { date: '2024-01-01', total: 15, critical: 3, new: 10, resolved: 5 },
          { date: '2024-01-02', total: 12, critical: 2, new: 4, resolved: 7 },
        ],
        summary: { averageNew: 7, averageResolved: 6, netChange: 1, trendDirection: 'stable' as const },
      };

      nock(BASE_URL)
        .get(`/projects/${TEST_IDS.proj1}/trends`)
        .reply(200, { data: mockTrends });

      const trends = await projectOps.getTrends(client, TEST_IDS.proj1);

      expect(trends.daily).toHaveLength(2);
      expect(trends.daily[0].date).toBe('2024-01-01');
      expect(trends.daily[0].total).toBe(15);
      expect(trends.summary.trendDirection).toBe('stable');
    });

    it('should get project trends with query parameters', async () => {
      const mockProject = createMockProject();
      const mockTrends = {
        project: mockProject,
        days: 7,
        daily: [{ date: '2024-01-01', total: 5, critical: 1, new: 3, resolved: 2 }],
        summary: { averageNew: 3, averageResolved: 2, netChange: 1, trendDirection: 'stable' as const },
      };

      nock(BASE_URL)
        .get(`/projects/${TEST_IDS.proj1}/trends`)
        .query({ days: 7 })
        .reply(200, { data: mockTrends });

      const trends = await projectOps.getTrends(client, TEST_IDS.proj1, { days: 7 });

      expect(trends.daily).toHaveLength(1);
      expect(trends.days).toBe(7);
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

    it('should reject response missing count field', async () => {
      const mockIssues = [
        createMockIssue({ title: 'Bug 1' }),
        createMockIssue({ title: 'Bug 2' }),
      ];

      nock(BASE_URL)
        .get(`/projects/${TEST_IDS.proj1}/issues`)
        .reply(200, { data: mockIssues });

      await expect(
        projectOps.listIssuesWithCount(client, TEST_IDS.proj1)
      ).rejects.toThrow(ZodError);
    });
  });

  describe('bulkUpdateIssueStatus', () => {
    it('should bulk update issue statuses', async () => {
      const projectId = TEST_IDS.proj3;
      const issueId1 = TEST_IDS.issue1;
      const issueId2 = TEST_IDS.issue2;

      nock(BASE_URL)
        .patch(`/projects/${projectId}/issues/status`, {
          updates: [
            { issueId: issueId1, status: 'completed', reason: 'Fixed' },
            { issueId: issueId2, status: 'wontfix', reason: 'By design' },
          ],
        })
        .reply(200, { data: { updated: 2, failed: [] } });

      const result = await projectOps.bulkUpdateIssueStatus(client, projectId, [
        { issueId: issueId1, status: 'completed', reason: 'Fixed' },
        { issueId: issueId2, status: 'wontfix', reason: 'By design' },
      ]);

      expect(result.updated).toBe(2);
      expect(result.failed).toHaveLength(0);
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

  describe('mergeProjects', () => {
    const mockMergeResult = {
      source: {
        id: TEST_IDS.proj1,
        name: 'merge-source',
        run_count: 2,
        issue_count: 3,
        status_after: 'soft-deleted',
      },
      target: {
        id: TEST_IDS.proj2,
        name: 'merge-target',
        run_count_before: 5,
        issue_count_before: 4,
        run_count_after: 7,
        issue_count_after: 6,
      },
      moved: {
        runs: 2,
        issues: 2,
        issue_dedupes: 1,
        occurrences_reparented: 3,
        issue_notes_reparented: 1,
        status_history_reparented: 2,
      },
      conflicts: [
        {
          kind: 'fingerprint_dedup',
          source_id: TEST_IDS.issue1,
          target_id: TEST_IDS.issue2,
          resolution: 'target_survives_source_absorbed',
        },
      ],
      audit: {
        merge_id: TEST_IDS.issue3,
        timestamp: '2026-07-10T12:00:00.000Z',
        actor_id: TEST_IDS.user1,
        dry_run: false,
      },
    };

    it('should merge projects (response conforms to the spec §5 snake_case contract)', async () => {
      nock(BASE_URL)
        .post('/projects/merge', {
          source: 'merge-source',
          target: 'merge-target',
        })
        .reply(200, { data: mockMergeResult });

      const result = await projectOps.mergeProjects(client, {
        source: 'merge-source',
        target: 'merge-target',
      });

      expect(result.moved.runs).toBe(2);
      expect(result.moved.issue_dedupes).toBe(1);
      expect(result.source.status_after).toBe('soft-deleted');
      expect(result.target.run_count_after).toBe(7);
      expect(result.conflicts[0]?.kind).toBe('fingerprint_dedup');
    });

    it('should pass dryRun/deleteSource/confirmCrossOrg through in the request body', async () => {
      nock(BASE_URL)
        .post('/projects/merge', {
          source: 'merge-source',
          target: 'merge-target',
          dryRun: true,
          deleteSource: false,
          confirmCrossOrg: false,
        })
        .reply(200, {
          data: {
            ...mockMergeResult,
            source: { ...mockMergeResult.source, status_after: 'dry-run' },
            audit: { ...mockMergeResult.audit, dry_run: true },
          },
        });

      const result = await projectOps.mergeProjects(client, {
        source: 'merge-source',
        target: 'merge-target',
        dryRun: true,
        deleteSource: false,
        confirmCrossOrg: false,
      });

      expect(result.audit.dry_run).toBe(true);
      expect(result.source.status_after).toBe('dry-run');
    });

    it('should surface 409 ALREADY_MERGED with details.audit_id on the typed error', async () => {
      nock(BASE_URL)
        .post('/projects/merge')
        .reply(409, {
          error: {
            message: 'Source project was already merged',
            code: 'ALREADY_MERGED',
            details: { audit_id: TEST_IDS.issue3, target_project_id: TEST_IDS.proj2 },
          },
        });

      try {
        await projectOps.mergeProjects(client, { source: 'a', target: 'b' });
        expect.unreachable('should have thrown');
      } catch (err) {
        const typed = err as { statusCode?: number; details?: Record<string, unknown> };
        expect(typed.statusCode).toBe(409);
        expect(typed.details).toMatchObject({ audit_id: TEST_IDS.issue3 });
      }
    });

    it('should surface 409 MERGE_LOCK_UNAVAILABLE with the retry hint', async () => {
      nock(BASE_URL)
        .post('/projects/merge')
        .reply(409, {
          error: {
            message: 'Merge lock unavailable',
            code: 'MERGE_LOCK_UNAVAILABLE',
            details: { retry_after_seconds: 5 },
          },
        });

      try {
        await projectOps.mergeProjects(client, { source: 'a', target: 'b' });
        expect.unreachable('should have thrown');
      } catch (err) {
        const typed = err as { statusCode?: number; details?: Record<string, unknown> };
        expect(typed.statusCode).toBe(409);
        expect(typed.details).toMatchObject({ retry_after_seconds: 5 });
      }
    });

    it('should surface 403 CROSS_ORG_MERGE_REQUIRES_CONFIRMATION (system-actor path)', async () => {
      nock(BASE_URL)
        .post('/projects/merge')
        .reply(403, {
          error: {
            message: 'Cross-org merge requires confirmation',
            code: 'CROSS_ORG_MERGE_REQUIRES_CONFIRMATION',
            details: { hint: 'Pass confirmCrossOrg=true to allow system-actor cross-org merges' },
          },
        });

      await expect(
        projectOps.mergeProjects(client, { source: 'a', target: 'b' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should reject source === target at the client boundary WITHOUT an HTTP call', async () => {
      // No nock intercept registered — an HTTP attempt would fail with a nock
      // "no match" error, not a validation error.
      await expect(
        projectOps.mergeProjects(client, { source: 'same-project', target: 'same-project' })
      ).rejects.toThrow(/source and target must be different/);
    });
  });
});
