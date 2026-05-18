import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as runOps from '../../src/operations/runs.js';
import { BASE_URL, TEST_API_KEY } from '../setup.js';
import {
  TEST_IDS,
  createMockRun,
  createMockRunSummary,
  createMockAgentSnapshot,
  createMockAnalysisRecord,
  createMockAnalysisSummary,
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
            agents: [createMockAgentSnapshot({ runId: mockRun.id })],
            correlation: { newIssues: 2, recurringIssues: 0, regressions: 0 },
            deduplicated: false,
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
            agents: [createMockAgentSnapshot({ runId: mockRun.id })],
            correlation: { newIssues: 1, recurringIssues: 0, regressions: 0 },
            deduplicated: false,
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

      expect(result.correlation.newIssues).toBe(1);
      expect(result.deduplicated).toBe(false);
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
            agents: [createMockAgentSnapshot({ runId: mockRun.id, name: 'test-architect' })],
            correlation: { newIssues: 0, recurringIssues: 0, regressions: 0 },
            deduplicated: false,
          },
        });

      const result = await runOps.save(client, {
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

      expect(result.run).toBeDefined();
      expect(result.run.runNumber).toBe(3);
    });
  });

  describe('validate', () => {
    it('should validate run without saving', async () => {
      nock(BASE_URL)
        .post('/runs/validate')
        .reply(200, {
          data: {
            wouldCreate: 1,
            wouldUpdate: 0,
            wouldRegress: 0,
            validationErrors: [],
            preview: { newIssues: [{ title: 'New issue', agent: 'code-validator' }], recurringIssues: [], regressions: [] },
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

      expect(result.wouldCreate).toBe(1);
      expect(result.validationErrors).toHaveLength(0);
    });
  });

  describe('diff', () => {
    it('should diff two runs', async () => {
      const baseRun = createMockRun({ runNumber: 1 });
      const compareRun = createMockRun({ runNumber: 2 });

      nock(BASE_URL)
        .get('/runs/diff')
        .query({ project: 'my-project', base_run: 1, compare_run: 2 })
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
            archived: 9,
          },
        });

      const result = await runOps.archive(client, {
        project: 'my-project',
        beforeRunNumber: 10,
      });

      expect(result.archived).toBe(9);
    });

    it('should archive runs keeping last N', async () => {
      nock(BASE_URL)
        .post('/runs/archive', {
          project: 'my-project',
          keepLast: 5,
        })
        .reply(200, {
          data: { archived: 15 },
        });

      const result = await runOps.archive(client, {
        project: 'my-project',
        keepLast: 5,
      });

      expect(result.archived).toBe(15);
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

    it('should forward archivedAt and archiveReason in update body', async () => {
      const archivedAt = '2026-04-08T22:00:00.000Z';
      const mockRun = createMockRun({ runNumber: 10 });

      nock(BASE_URL)
        .patch('/runs/update', (body) => {
          return (
            body.project === 'my-project' &&
            body.runNumber === 10 &&
            body.archivedAt === archivedAt &&
            body.archiveReason === 'Superseded by run #11'
          );
        })
        .reply(200, { data: mockRun });

      const run = await runOps.update(client, {
        project: 'my-project',
        runNumber: 10,
        archivedAt,
        archiveReason: 'Superseded by run #11',
      });

      expect(run.runNumber).toBe(10);
    });

    it('should forward null archivedAt for unarchive', async () => {
      const mockRun = createMockRun({ runNumber: 10 });

      nock(BASE_URL)
        .patch('/runs/update', (body) => {
          return (
            body.archivedAt === null &&
            body.archiveReason === null
          );
        })
        .reply(200, { data: mockRun });

      const run = await runOps.update(client, {
        project: 'my-project',
        runNumber: 10,
        archivedAt: null,
        archiveReason: null,
      });

      expect(run.runNumber).toBe(10);
    });
  });

  describe('listByProject', () => {
    it('should list runs for a project', async () => {
      const run1 = createMockRunSummary({ runNumber: 1 });
      const run2 = createMockRunSummary({ runNumber: 2 });

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
      const run = createMockRunSummary({ runNumber: 11 });

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
      const run = createMockRunSummary({
        runNumber: 1,
        totalRecommendations: 5,
        criticalCount: 2,
        suggestedCount: 3,
        backlogCount: 0,
        agentScores: { 'code-validator': 85, 'test-architect': 90 },
      });

      nock(BASE_URL)
        .get(`/runs/project/${TEST_IDS.proj1}`)
        .reply(200, {
          data: [run],
        });

      const runs = await runOps.listByProject(client, TEST_IDS.proj1);

      expect(runs).toHaveLength(1);
      expect(runs[0].totalRecommendations).toBe(5);
      expect(runs[0].criticalCount).toBe(2);
      expect(runs[0].agentScores).toEqual({ 'code-validator': 85, 'test-architect': 90 });
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
        .query({ workflow_type: 'post-implementation' })
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
      const mockAgent = createMockAgentSnapshot({ runId: mockRun.id });

      nock(BASE_URL)
        .get(`/runs/project/${TEST_IDS.proj1}/details`)
        .reply(200, {
          data: {
            run: mockRun,
            agents: [mockAgent],
            recommendations: [
              {
                issueId: TEST_IDS.issue1,
                title: 'Fix this',
                priority: 'suggested',
                agent: 'code-validator',
                status: 'open',
              },
            ],
          },
        });

      const details = await runOps.getDetails(client, TEST_IDS.proj1);

      expect(details.recommendations).toHaveLength(1);
      expect(details.recommendations[0].status).toBe('open');
      expect(details.agents).toHaveLength(1);
      expect(details.run.runNumber).toBe(10);
    });

    it('should get details for specific run number', async () => {
      const mockRun = createMockRun({ runNumber: 5 });

      nock(BASE_URL)
        .get(`/runs/project/${TEST_IDS.proj1}/details`)
        .query({ run_number: 5 })
        .reply(200, {
          data: {
            run: mockRun,
            agents: [],
            recommendations: [],
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

    it('should forward archivedAt and archiveReason for archive', async () => {
      const mockRun = createMockRun();
      const archivedAt = '2026-04-08T22:00:00.000Z';

      nock(BASE_URL)
        .patch(`/runs/${mockRun.id}`, (body) => {
          return (
            body.archivedAt === archivedAt &&
            body.archiveReason === 'Manual cleanup'
          );
        })
        .reply(200, { data: mockRun });

      const run = await runOps.updateById(client, mockRun.id, {
        archivedAt,
        archiveReason: 'Manual cleanup',
      });

      expect(run.id).toBe(mockRun.id);
    });

    it('should forward null archivedAt for unarchive', async () => {
      const mockRun = createMockRun();

      nock(BASE_URL)
        .patch(`/runs/${mockRun.id}`, (body) => {
          return body.archivedAt === null && body.archiveReason === null;
        })
        .reply(200, { data: mockRun });

      const run = await runOps.updateById(client, mockRun.id, {
        archivedAt: null,
        archiveReason: null,
      });

      expect(run.id).toBe(mockRun.id);
    });
  });

  describe('response validation', () => {
    it('should throw ResponseValidationError on malformed response', async () => {
      const runId = TEST_IDS.run1;
      // Return a response missing required fields (no projectId, no runNumber, etc.)
      nock(BASE_URL)
        .get(`/runs/${runId}`)
        .reply(200, {
          data: { id: runId, workflowType: 'ship' },
        });

      await expect(
        runOps.get(client, runId)
      ).rejects.toThrow(/API response validation failed/);
    });

    it('should throw ResponseValidationError on wrong field type', async () => {
      const runId = TEST_IDS.run1;
      nock(BASE_URL)
        .get(`/runs/${runId}`)
        .reply(200, {
          data: {
            ...createMockRun({ id: runId }),
            runNumber: 'not-a-number', // Should be number
          },
        });

      await expect(
        runOps.get(client, runId)
      ).rejects.toThrow(/API response validation failed/);
    });

    it('should throw ResponseValidationError on malformed listByProject response', async () => {
      nock(BASE_URL)
        .get('/runs/project/my-project')
        .reply(200, {
          data: [{ id: TEST_IDS.run1, workflowType: 'ship' }], // Missing required fields
        });

      await expect(
        runOps.listByProject(client, 'my-project')
      ).rejects.toThrow(/API response validation failed/);
    });

    it('should throw ResponseValidationError on malformed getLatest response', async () => {
      nock(BASE_URL)
        .get('/runs/project/my-project/latest')
        .query({ workflow_type: 'ship' })
        .reply(200, {
          data: { runNumber: 'not-a-number' }, // Wrong type
        });

      await expect(
        runOps.getLatest(client, 'my-project', 'ship')
      ).rejects.toThrow(/API response validation failed/);
    });
  });

  describe('error paths', () => {
    it('should throw on save 409 conflict', async () => {
      nock(BASE_URL)
        .post('/runs')
        .reply(409, { error: 'Duplicate run' });

      await expect(
        runOps.save(client, {
          project: 'my-project',
          workflowType: 'ship',
          agents: [{ name: 'v', score: 50, decision: 'PASS' }],
          recommendations: [],
        })
      ).rejects.toThrow();
    });

    it('should throw on get 404', async () => {
      nock(BASE_URL)
        .get('/runs/nonexistent-id')
        .reply(404, { error: 'Run not found' });

      await expect(
        runOps.get(client, 'nonexistent-id')
      ).rejects.toThrow();
    });

    it('should throw on updateById 404', async () => {
      nock(BASE_URL)
        .patch('/runs/nonexistent-id')
        .reply(404, { error: 'Run not found' });

      await expect(
        runOps.updateById(client, 'nonexistent-id', { averageScore: 50 })
      ).rejects.toThrow();
    });
  });

  describe('deleteRun', () => {
    it('should delete run with confirmation header', async () => {
      const runId = TEST_IDS.run1;
      nock(BASE_URL)
        .delete(`/runs/${runId}`)
        .matchHeader('X-Confirm-Delete', runId)
        .reply(200, { data: { deleted: true } });

      const result = await runOps.deleteRun(client, runId);
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('analysis operations', () => {
    it('getAnalysis should fetch analysis for a run', async () => {
      const runId = TEST_IDS.run1;
      const mockRecord = createMockAnalysisRecord({ runId, recordType: 'convention', recordId: 'C-1', title: 'Test convention' });
      const mockSummary = createMockAnalysisSummary({ runId, decision: 'VITAL', score: 85 });

      nock(BASE_URL)
        .get(`/runs/${runId}/analysis`)
        .reply(200, {
          data: {
            records: [mockRecord],
            summaries: [mockSummary],
            total: 1,
          },
        });

      const result = await runOps.getAnalysis(client, runId);
      expect(result.records).toHaveLength(1);
      expect(result.records[0].recordType).toBe('convention');
      expect(result.summaries).toHaveLength(1);
    });

    it('getProjectAnalysis should forward query params', async () => {
      const projectId = TEST_IDS.proj1;
      nock(BASE_URL)
        .get(`/projects/${projectId}/analysis`)
        .query({ limit: 10, definition_name: 'nietzsche-analyst' })
        .reply(200, {
          data: { data: [], total: 0 },
        });

      const result = await runOps.getProjectAnalysis(client, projectId, {
        limit: 10,
        definitionName: 'nietzsche-analyst',
      });
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('queryAnalysisRecords should forward filters', async () => {
      const mockRecord = createMockAnalysisRecord({ recordType: 'tension', recordId: 'T-1', title: 'Test tension' });

      nock(BASE_URL)
        .get('/analysis/records')
        .query({ record_type: 'tension', limit: 5 })
        .reply(200, {
          data: { data: [mockRecord], total: 1 },
        });

      const result = await runOps.queryAnalysisRecords(client, {
        recordType: 'tension',
        limit: 5,
      });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('save invalid input', () => {
    it('should reject save with missing project', async () => {
      await expect(
        runOps.save(client, {
          project: '',
          workflowType: 'ship',
          agents: [{ name: 'v', score: 50, decision: 'PASS' }],
          recommendations: [],
        } as any)
      ).rejects.toThrow();
    });

    it('should reject save with empty agents array', async () => {
      await expect(
        runOps.save(client, {
          project: 'my-project',
          workflowType: 'ship',
          agents: [],
          recommendations: [],
        } as any)
      ).rejects.toThrow();
    });

    it('should reject save with missing workflowType', async () => {
      await expect(
        runOps.save(client, {
          project: 'my-project',
          workflowType: '',
          agents: [{ name: 'v', score: 50, decision: 'PASS' }],
          recommendations: [],
        } as any)
      ).rejects.toThrow();
    });
  });

  describe('getAgentRunsAnalysis', () => {
    it('should get analysis summaries for a specific agent', async () => {
      nock(BASE_URL)
        .get('/agents/epictetus-validator/runs-analysis')
        .query({ project: 'my-project' })
        .reply(200, {
          data: {
            items: [
              {
                id: TEST_IDS.run1,
                runId: TEST_IDS.run2,
                agentName: 'epictetus-validator',
                agentType: 'validator',
                decision: 'FACTUAL',
                score: 82,
                decisionVocabulary: 'FACTUAL/INTERPRETED',
                systemMetrics: null,
                categoryScores: [{ name: 'Epistemic Hygiene', weight: 30, score: 25 }],
                epistemicAssessment: null,
                auditImplications: null,
                explorationMaps: null,
                createdAt: '2026-05-01T00:00:00Z',
                runNumber: 5,
                runTimestamp: '2026-05-01T00:00:00Z',
                workflowType: 'post-implementation',
                snapshotScore: 82,
              },
            ],
            total: 1,
          },
        });

      const result = await runOps.getAgentRunsAnalysis(client, 'epictetus-validator', {
        project: 'my-project',
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].decision).toBe('FACTUAL');
      expect(result.items[0].runNumber).toBe(5);
      expect(result.items[0].workflowType).toBe('post-implementation');
    });

    it('should filter by decision', async () => {
      nock(BASE_URL)
        .get('/agents/code-validator/runs-analysis')
        .query({ project: 'my-project', decision: 'PASS' })
        .reply(200, { data: { items: [], total: 0 } });

      const result = await runOps.getAgentRunsAnalysis(client, 'code-validator', {
        project: 'my-project',
        decision: 'PASS',
      });

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  describe('archive invalid input', () => {
    it('should reject archive with missing project', async () => {
      await expect(
        runOps.archive(client, {
          project: '',
          workflowType: 'ship',
        } as any)
      ).rejects.toThrow();
    });

    it('should reject archive with missing workflowType', async () => {
      await expect(
        runOps.archive(client, {
          project: 'my-project',
          workflowType: '',
        } as any)
      ).rejects.toThrow();
    });
  });
});
