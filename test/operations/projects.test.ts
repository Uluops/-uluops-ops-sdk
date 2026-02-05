import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as projectOps from '../../src/operations/projects.js';
import { BASE_URL } from '../setup.js';

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
      nock(BASE_URL)
        .get('/projects')
        .reply(200, {
          data: [
            { id: 'proj-1', name: 'Project A', createdAt: '2024-01-01' },
            { id: 'proj-2', name: 'Project B', createdAt: '2024-01-02' },
          ],
        });

      const projects = await projectOps.list(client);

      expect(projects).toHaveLength(2);
      expect(projects[0].name).toBe('Project A');
    });
  });

  describe('get', () => {
    it('should get project by ID', async () => {
      nock(BASE_URL)
        .get('/projects/proj-1')
        .reply(200, {
          data: { id: 'proj-1', name: 'Project A', createdAt: '2024-01-01' },
        });

      const project = await projectOps.get(client, 'proj-1');

      expect(project.id).toBe('proj-1');
      expect(project.name).toBe('Project A');
    });

    it('should get project by name', async () => {
      nock(BASE_URL)
        .get('/projects/my-project')
        .reply(200, {
          data: { id: 'proj-1', name: 'my-project' },
        });

      const project = await projectOps.get(client, 'my-project');

      expect(project.name).toBe('my-project');
    });

    it('should URL encode project names with special characters', async () => {
      nock(BASE_URL)
        .get('/projects/my%20project%2Fwith%20slashes')
        .reply(200, {
          data: { id: 'proj-1', name: 'my project/with slashes' },
        });

      const project = await projectOps.get(client, 'my project/with slashes');

      expect(project.name).toBe('my project/with slashes');
    });
  });

  describe('create', () => {
    it('should create a new project', async () => {
      nock(BASE_URL)
        .post('/projects', { name: 'New Project' })
        .reply(201, {
          data: { id: 'proj-3', name: 'New Project', createdAt: '2024-01-03' },
        });

      const project = await projectOps.create(client, { name: 'New Project' });

      expect(project.id).toBe('proj-3');
      expect(project.name).toBe('New Project');
    });
  });

  describe('update', () => {
    it('should update project', async () => {
      nock(BASE_URL)
        .patch('/projects/proj-1', { name: 'Updated Name' })
        .reply(200, {
          data: { id: 'proj-1', name: 'Updated Name' },
        });

      const project = await projectOps.update(client, 'proj-1', { name: 'Updated Name' });

      expect(project.name).toBe('Updated Name');
    });
  });

  describe('deleteProject', () => {
    it('should hard delete project with confirmation', async () => {
      nock(BASE_URL)
        .delete('/projects/proj-1', {
          confirm: true,
          confirmation_phrase: 'proj-1',
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
          confirmation_phrase: 'proj-1',
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
      nock(BASE_URL)
        .post('/projects/proj-1/restore')
        .reply(200, {
          data: { id: 'proj-1', name: 'Restored Project', deletedAt: null },
        });

      const project = await projectOps.restore(client, 'proj-1');

      expect(project.deletedAt).toBeNull();
    });
  });

  describe('rename', () => {
    it('should rename project', async () => {
      nock(BASE_URL)
        .post('/projects/rename', {
          old_name: 'old-name',
          new_name: 'new-name',
        })
        .reply(200, {
          data: { id: 'proj-1', name: 'new-name' },
        });

      const project = await projectOps.rename(client, {
        oldName: 'old-name',
        newName: 'new-name',
      });

      expect(project.name).toBe('new-name');
    });
  });

  describe('getSummary', () => {
    it('should get project summary', async () => {
      nock(BASE_URL)
        .get('/projects/proj-1/summary')
        .reply(200, {
          data: {
            project: { id: 'proj-1', name: 'Project A' },
            totalRuns: 50,
            totalIssues: 100,
            openIssues: 25,
            resolvedIssues: 75,
            lastRunAt: '2024-01-10',
          },
        });

      const summary = await projectOps.getSummary(client, 'proj-1');

      expect(summary.totalRuns).toBe(50);
      expect(summary.openIssues).toBe(25);
    });
  });

  describe('getTrends', () => {
    it('should get project trends with default query', async () => {
      nock(BASE_URL)
        .get('/projects/proj-1/trends')
        .reply(200, {
          data: [
            { date: '2024-01-01', openIssues: 10, closedIssues: 5 },
            { date: '2024-01-02', openIssues: 8, closedIssues: 7 },
          ],
        });

      const trends = await projectOps.getTrends(client, 'proj-1');

      expect(trends).toHaveLength(2);
      expect(trends[0].openIssues).toBe(10);
    });

    it('should get project trends with query parameters', async () => {
      nock(BASE_URL)
        .get('/projects/proj-1/trends')
        .query({ days: 7 })
        .reply(200, {
          data: [{ date: '2024-01-01', openIssues: 5 }],
        });

      const trends = await projectOps.getTrends(client, 'proj-1', { days: 7 });

      expect(trends).toHaveLength(1);
    });
  });

  describe('listIssues', () => {
    it('should list project issues', async () => {
      nock(BASE_URL)
        .get('/projects/proj-1/issues')
        .reply(200, {
          data: [
            { id: 'issue-1', title: 'Bug 1', priority: 'critical' },
            { id: 'issue-2', title: 'Bug 2', priority: 'suggested' },
          ],
        });

      const issues = await projectOps.listIssues(client, 'proj-1');

      expect(issues).toHaveLength(2);
    });

    it('should list issues with filters', async () => {
      nock(BASE_URL)
        .get('/projects/proj-1/issues')
        .query({
          status: 'open',
          priority: 'critical',
          limit: 10,
        })
        .reply(200, {
          data: [{ id: 'issue-1', title: 'Critical Bug', priority: 'critical' }],
        });

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
      nock(BASE_URL)
        .patch('/projects/proj-1/issues/status', {
          updates: [
            { issueId: 'issue-1', status: 'completed', reason: 'Fixed' },
            { issueId: 'issue-2', status: 'wontfix', reason: 'By design' },
          ],
        })
        .reply(200, {
          data: [
            { issueId: 'issue-1', success: true },
            { issueId: 'issue-2', success: true },
          ],
        });

      const results = await projectOps.bulkUpdateIssueStatus(client, 'proj-1', [
        { issueId: 'issue-1', status: 'completed', reason: 'Fixed' },
        { issueId: 'issue-2', status: 'wontfix', reason: 'By design' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
    });
  });

  describe('mergeIssues', () => {
    it('should merge issues', async () => {
      nock(BASE_URL)
        .post('/projects/proj-1/issues/merge', {
          target_issue_id: 'issue-1',
          source_issue_ids: ['issue-2', 'issue-3'],
          strategy: 'keep_target',
        })
        .reply(200, {
          data: {
            targetIssue: { id: 'issue-1', title: 'Merged Issue' },
            mergedCount: 2,
            sourceIssues: ['issue-2', 'issue-3'],
          },
        });

      const result = await projectOps.mergeIssues(client, 'proj-1', {
        targetIssueId: 'issue-1',
        sourceIssueIds: ['issue-2', 'issue-3'],
        strategy: 'keep_target',
      });

      expect(result.mergedCount).toBe(2);
    });
  });
});
