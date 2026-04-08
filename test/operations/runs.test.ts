import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as runOps from '../../src/operations/runs.js';
import { BASE_URL, TEST_API_KEY } from '../setup.js';
import {
  TEST_IDS,
  createMockRun,
  createMockValidatorSnapshot,
  createMockIssue,
  resetMockIds,
} from '../contract-helpers.js';

describe('Run Operations', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    resetMockIds();
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: TEST_API_KEY,
    });
  });

  describe('save', () => {
    it('should save validation run', async () => {
      const mockRun = createMockRun({ runNumber: 1, workflowType: 'post-implementation' });

      nock(BASE_URL)
        .post('/runs', (body) => {
          return (
            body.project === 'my-project' &&
            body.workflowType === 'post-implementation' &&
            body.agents.length === 1 &&
            body.agents[0].name === 'code-validator'
          );
        })
        .reply(201, {
          data: {
            run: mockRun,
            issues: { created: 2, updated: 0, unchanged: 1 },
          },
        });

      const result = await runOps.save(client, {
        project: 'my-project',
        workflowType: 'post-implementation',
        agents: [
          { name: 'code-validator', score: 85, decision: 'PASS' },
        ],
        recommendations: [],
      });

      expect(result.run.runNumber).toBe(1);
      expect(result.issues.created).toBe(2);
    });

    it('should save run with recommendations', async () => {
      const mockRun = createMockRun({ runNumber: 2 });

      nock(BASE_URL)
        .post('/runs', (body) => {
          return (
            body.agents.length === 1 &&
            body.recommendations.length === 1 &&
            body.recommendations[0].title === 'Fix bug' &&
            body.recommendations[0].priority === 'critical'
          );
        })
        .reply(201, {
          data: {
            run: mockRun,
            issues: { created: 1, updated: 0 },
          },
        });

      const result = await runOps.save(client, {
        project: 'my-project',
        workflowType: 'post-implementation',
        agents: [
          { name: 'code-validator', score: 70, decision: 'FAIL' },
        ],
        recommendations: [
          {
            agent: 'code-validator',
            title: 'Fix bug',
            priority: 'critical',
          },
        ],
      });

      expect(result.issues.created).toBe(1);
    });

    it('should save run with token metrics', async () => {
      const mockRun = createMockRun({ runNumber: 3 });

      nock(BASE_URL)
        .post('/runs', (body) => {
          const tokens = body.agents[0].tokens;
          return (
            tokens.inputTokens === 1000 &&
            tokens.outputTokens === 500
          );
        })
        .reply(201, {
          data: {
            run: mockRun,
            issues: { created: 0, updated: 0 },
          },
        });

      await runOps.save(client, {
        project: 'my-project',
        workflowType: 'ship',
        agents: [
          {
            name: 'test-architect',
            score: 90,
            decision: 'PASS',
            tokens: {
              inputTokens: 1000,
              outputTokens: 500,
            },
          },
        ],
        recommendations: [],
      });
    });
  });

  describe('validate', () => {
    it('should validate run without saving', async () => {
      const mockIssue = createMockIssue({ title: 'New issue', priority: 'suggested' });

      nock(BASE_URL)
        .post('/runs/validate')
        .reply(200, {
          data: {
            wouldCreate: [mockIssue],
            wouldUpdate: [],
            wouldRegress: [],
            validationErrors: [],
          },
        });

      const result = await runOps.validate(client, {
        project: 'my-project',
        workflowType: 'post-implementation',
        agents: [{ name: 'code-validator', score: 85, decision: 'PASS' }],
        recommendations: [
          { agent: 'code-validator', title: 'New issue', priority: 'suggested' },
        ],
      });

      expect(result.wouldCreate).toHaveLength(1);
      expect(result.validationErrors).toHaveLength(0);
    });
  });

  describe('diff', () => {
    it('should diff two runs', async () => {
      const baseRun = createMockRun({ runNumber: 1 });
      const compareRun = createMockRun({ runNumber: 2 });

      nock(BASE_URL)
        .get('/runs/diff')
        .query({ project: 'my-project', baseRun: 1, compareRun: 2 })
        .reply(200, {
          data: {
            baseRun,
            compareRun,
            fixed: [{ issueId: TEST_IDS.issue1, title: 'Fixed bug' }],
            new: [{ issueId: TEST_IDS.issue2, title: 'New issue' }],
            unchanged: [{ issueId: TEST_IDS.issue3, title: 'Still there' }],
            agentChanges: [
              { name: 'code-validator', baseScore: 75, compareScore: 85, change: 10 },
            ],
          },
        });

      const result = await runOps.diff(client, {
        project: 'my-project',
        baseRun: 1,
        compareRun: 2,
      });

      expect(result.baseRun.runNumber).toBe(1);
      expect(result.compareRun.runNumber).toBe(2);
      expect(result.fixed).toHaveLength(1);
      expect(result.fixed[0].issueId).toBe(TEST_IDS.issue1);
      expect(result.fixed[0].title).toBe('Fixed bug');
      expect(result.new).toHaveLength(1);
      expect(result.new[0].issueId).toBe(TEST_IDS.issue2);
      expect(result.unchanged).toHaveLength(1);
      expect(result.agentChanges).toHaveLength(1);
      expect(result.agentChanges[0].name).toBe('code-validator');
      expect(result.agentChanges[0].baseScore).toBe(75);
      expect(result.agentChanges[0].compareScore).toBe(85);
      expect(result.agentChanges[0].change).toBe(10);
    });
  });

  describe('archive', () => {
    it('should archive runs by run number', async () => {
      nock(BASE_URL)
        .post('/runs/archive', {
          project: 'my-project',
          beforeRunNumber: 10,
        })
        .reply(200, {
          data: {
            archivedCount: 9,
            archivedRunNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
        });

      const result = await runOps.archive(client, {
        project: 'my-project',
        beforeRunNumber: 10,
      });

      expect(result.archivedCount).toBe(9);
      expect(result.archivedRunNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should archive runs keeping last N', async () => {
      nock(BASE_URL)
        .post('/runs/archive', {
          project: 'my-project',
          keepLast: 5,
        })
        .reply(200, {
          data: { archivedCount: 15 },
        });

      const result = await runOps.archive(client, {
        project: 'my-project',
        keepLast: 5,
      });

      expect(result.archivedCount).toBe(15);
    });
  });

  describe('update', () => {
    it('should update run by project and number', async () => {
      const mockRun = createMockRun({ runNumber: 5, allGatesPassed: true, averageScore: 92 });

      nock(BASE_URL)
        .patch('/runs/update', {
          project: 'my-project',
          runNumber: 5,
          allGatesPassed: true,
          averageScore: 92,
        })
        .reply(200, {
          data: mockRun,
        });

      const run = await runOps.update(client, {
        project: 'my-project',
        runNumber: 5,
        allGatesPassed: true,
        averageScore: 92,
      });

      expect(run.allGatesPassed).toBe(true);
      expect(run.averageScore).toBe(92);
    });
  });

  describe('listByProject', () => {
    it('should list runs for a project', async () => {
      const run1 = createMockRun({ runNumber: 1 });
      const run2 = createMockRun({ runNumber: 2 });

      nock(BASE_URL)
        .get(`/runs/project/${TEST_IDS.proj1}`)
        .reply(200, {
          data: [run1, run2],
        });

      const runs = await runOps.listByProject(client, TEST_IDS.proj1);

      expect(runs).toHaveLength(2);
      expect(runs[0].runNumber).toBe(1);
      expect(runs[1].runNumber).toBe(2);
    });

    it('should list runs with query params', async () => {
      const run = createMockRun({ runNumber: 11 });

      nock(BASE_URL)
        .get(`/runs/project/${TEST_IDS.proj1}`)
        .query({ limit: 5, offset: 10 })
        .reply(200, {
          data: [run],
        });

      const runs = await runOps.listByProject(client, TEST_IDS.proj1, {
        limit: 5,
        offset: 10,
      });

      expect(runs).toHaveLength(1);
    });

    it('should preserve RunSummary enrichment fields', async () => {
      const run = {
        ...createMockRun({ runNumber: 1 }),
        totalRecommendations: 5,
        criticalCount: 2,
        suggestedCount: 3,
        backlogCount: 0,
        validatorScores: { 'code-validator': 85, 'test-architect': 90 },
      };

      nock(BASE_URL)
        .get(`/runs/project/${TEST_IDS.proj1}`)
        .reply(200, {
          data: [run],
        });

      const runs = await runOps.listByProject(client, TEST_IDS.proj1);

      expect(runs).toHaveLength(1);
      expect(runs[0].totalRecommendations).toBe(5);
      expect(runs[0].criticalCount).toBe(2);
      expect(runs[0].validatorScores).toEqual({ 'code-validator': 85, 'test-architect': 90 });
    });
  });

  describe('getLatest', () => {
    it('should get latest run', async () => {
      const mockRun = createMockRun({ runNumber: 100, workflowType: 'ship' });

      nock(BASE_URL)
        .get(`/runs/project/${TEST_IDS.proj1}/latest`)
        .reply(200, {
          data: mockRun,
        });

      const run = await runOps.getLatest(client, TEST_IDS.proj1);

      expect(run.runNumber).toBe(100);
    });

    it('should get latest run by workflow type', async () => {
      const mockRun = createMockRun({ runNumber: 95, workflowType: 'post-implementation' });

      nock(BASE_URL)
        .get(`/runs/project/${TEST_IDS.proj1}/latest`)
        .query({ workflowType: 'post-implementation' })
        .reply(200, {
          data: mockRun,
        });

      const run = await runOps.getLatest(client, TEST_IDS.proj1, 'post-implementation');

      expect(run.workflowType).toBe('post-implementation');
    });
  });

  describe('getDetails', () => {
    it('should get run details with recommendations', async () => {
      const mockRun = createMockRun({ runNumber: 10 });
      const mockIssue = createMockIssue({ title: 'Fix this' });

      nock(BASE_URL)
        .get(`/runs/project/${TEST_IDS.proj1}/details`)
        .reply(200, {
          data: {
            run: mockRun,
            recommendations: [
              { ...mockIssue, correlation: 'new' },
            ],
            summary: { newIssues: 1, fixedIssues: 2 },
          },
        });

      const details = await runOps.getDetails(client, TEST_IDS.proj1);

      expect(details.recommendations).toHaveLength(1);
      expect(details.recommendations[0].correlation).toBe('new');
      expect(details.summary.newIssues).toBe(1);
      expect(details.summary.fixedIssues).toBe(2);
      expect(details.run.runNumber).toBe(10);
    });

    it('should get details for specific run number', async () => {
      const mockRun = createMockRun({ runNumber: 5 });

      nock(BASE_URL)
        .get(`/runs/project/${TEST_IDS.proj1}/details`)
        .query({ runNumber: 5 })
        .reply(200, {
          data: {
            run: mockRun,
            recommendations: [],
            summary: {},
          },
        });

      const details = await runOps.getDetails(client, TEST_IDS.proj1, 5);

      expect(details.run.runNumber).toBe(5);
    });
  });

  describe('get', () => {
    it('should get run by ID', async () => {
      const mockRun = createMockRun({ runNumber: 42, workflowType: 'ship' });

      nock(BASE_URL)
        .get(`/runs/${mockRun.id}`)
        .reply(200, {
          data: mockRun,
        });

      const run = await runOps.get(client, mockRun.id);

      expect(run.id).toBe(mockRun.id);
      expect(run.runNumber).toBe(42);
    });
  });

  describe('updateById', () => {
    it('should update run by ID', async () => {
      const mockRun = createMockRun({ averageScore: 88 });

      nock(BASE_URL)
        .patch(`/runs/${mockRun.id}`, {
          averageScore: 88,
        })
        .reply(200, {
          data: mockRun,
        });

      const run = await runOps.updateById(client, mockRun.id, {
        averageScore: 88,
      });

      expect(run.averageScore).toBe(88);
    });
  });

  describe('deleteRun', () => {
    it('should delete run with confirmation header', async () => {
      const runId = TEST_IDS.run1;
      nock(BASE_URL)
        .delete(`/runs/${runId}`)
        .matchHeader('X-Confirm-Delete', runId)
        .reply(200, { data: {} });

      const result = await runOps.deleteRun(client, runId);
      expect(result).toEqual({ deleted: true });
    });
  });
});
