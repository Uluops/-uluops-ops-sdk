import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { ZodError } from 'zod';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as runOps from '../../src/operations/runs.js';
import { ANALYSIS_RECORD_ID_MAX_LENGTH } from '../../src/types/schemas.js';
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

    it('should forward archivedAt and archive reason (wire key archivedReason) in update body', async () => {
      const archivedAt = '2026-04-08T22:00:00.000Z';
      const mockRun = createMockRun({ runNumber: 10 });

      nock(BASE_URL)
        .patch('/runs/update', (body) => {
          return (
            body.project === 'my-project' &&
            body.runNumber === 10 &&
            body.archivedAt === archivedAt &&
            // The API's update schema reads `archivedReason`; the old
            // `archiveReason` spelling was silently stripped (tracker
            // d21e0a57). Assert the value ARRIVES under the read key and
            // that the stripped key is not sent at all.
            body.archivedReason === 'Superseded by run #11' &&
            body.archiveReason === undefined
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
            body.archivedReason === null &&
            body.archiveReason === undefined
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
          total: 2,
        });

      const result = await runOps.listByProject(client, TEST_IDS.proj1);

      expect(result.total).toBe(2);
      const runs = result.data;
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
          total: 1,
        });

      const { data: runs } = await runOps.listByProject(client, TEST_IDS.proj1, {
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
          total: 1,
        });

      const { data: runs } = await runOps.listByProject(client, TEST_IDS.proj1);

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

    it('should forward archivedAt and archive reason (wire key archivedReason) for archive', async () => {
      const mockRun = createMockRun();
      const archivedAt = '2026-04-08T22:00:00.000Z';

      nock(BASE_URL)
        .patch(`/runs/${mockRun.id}`, (body) => {
          return (
            body.archivedAt === archivedAt &&
            // Wire key is `archivedReason` — see the update() twin of this test.
            body.archivedReason === 'Manual cleanup' &&
            body.archiveReason === undefined
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
          return body.archivedAt === null && body.archivedReason === null && body.archiveReason === undefined;
        })
        .reply(200, { data: mockRun });

      const run = await runOps.updateById(client, mockRun.id, {
        archivedAt: null,
        archiveReason: null,
      });

      expect(run.id).toBe(mockRun.id);
    });
  });

  describe('analysisWrite echo assertion (spec §3.9 skew alarm)', () => {
    const echo = { recordMode: 'replace', supersededRecords: 2, supersededSummaries: 1, createdRecords: 3, createdSummaries: 1 };
    const inputRecord = { agentName: 'aristotle-analyst', recordType: 'finding', recordId: 'F-1', title: 'Test finding', data: {} };
    const analysisInput = { analysisRecords: [inputRecord] };

    it('accepts an analysis-bearing update whose reply carries a replace echo', async () => {
      const mockRun = createMockRun({ runNumber: 5 });
      nock(BASE_URL)
        .patch('/runs/update')
        .reply(200, { data: mockRun, analysisWrite: echo });

      const run = await runOps.update(client, { project: 'my-project', runNumber: 5, ...analysisInput });
      expect(run.runNumber).toBe(5);
    });

    it('throws AnalysisEchoMismatchError when an analysis-bearing update reply has NO echo (old API)', async () => {
      const mockRun = createMockRun({ runNumber: 5 });
      // The stubbed OLD-API response shape: { data } with no analysisWrite —
      // the checklist's required control: the assertion observed failing.
      nock(BASE_URL)
        .patch('/runs/update')
        .reply(200, { data: mockRun });

      await expect(
        runOps.update(client, { project: 'my-project', runNumber: 5, ...analysisInput })
      ).rejects.toMatchObject({ name: 'AnalysisEchoMismatchError' });
    });

    it('throws AnalysisEchoMismatchError when the echoed recordMode differs (future API)', async () => {
      const mockRun = createMockRun();
      nock(BASE_URL)
        .patch(`/runs/${mockRun.id}`)
        .reply(200, { data: mockRun, analysisWrite: { ...echo, recordMode: 'merge' } });

      await expect(
        runOps.updateById(client, mockRun.id, analysisInput)
      ).rejects.toMatchObject({ name: 'AnalysisEchoMismatchError' });
    });

    it('does NOT require an echo on a non-analysis update', async () => {
      const mockRun = createMockRun({ runNumber: 7 });
      nock(BASE_URL)
        .patch('/runs/update')
        .reply(200, { data: mockRun });

      const run = await runOps.update(client, { project: 'my-project', runNumber: 7, averageScore: 90 });
      expect(run.runNumber).toBe(7);
    });

    it('does NOT require an echo for analysisRecords: [] (API hasAnalysis is length > 0)', async () => {
      // The F1 boundary: an empty array is `!== undefined` but not analysis-
      // bearing to the API, which replies WITHOUT an echo. The SDK predicate
      // must agree, or this exact call throws a false "server predates 1a"
      // against a healthy production server.
      const mockRun = createMockRun({ runNumber: 9 });
      nock(BASE_URL)
        .patch('/runs/update')
        .reply(200, { data: mockRun });

      const run = await runOps.update(client, { project: 'my-project', runNumber: 9, analysisRecords: [], averageScore: 91 });
      expect(run.runNumber).toBe(9);
    });

    it('does NOT require an echo for analysisSummary: [] either', async () => {
      const mockRun = createMockRun({ runNumber: 9 });
      nock(BASE_URL)
        .patch('/runs/update')
        .reply(200, { data: mockRun });

      const run = await runOps.update(client, { project: 'my-project', runNumber: 9, analysisSummary: [] });
      expect(run.runNumber).toBe(9);
    });

    it('forwards record_write_mode on the wire and accepts a matching merge echo (1b)', async () => {
      const mockRun = createMockRun({ runNumber: 5 });
      nock(BASE_URL)
        .patch('/runs/update', (body) => body.recordWriteMode === 'merge')
        .reply(200, { data: mockRun, analysisWrite: { ...echo, recordMode: 'merge' } });

      const run = await runOps.update(client, {
        project: 'my-project', runNumber: 5, recordWriteMode: 'merge', ...analysisInput,
      });
      expect(run.runNumber).toBe(5);
    });

    it('sent merge but echoed replace → mode-mismatch (the pre-1b silent-strip skew, spec §3.9)', async () => {
      // A pre-1b server STRIPS record_write_mode and executes replace — the
      // echo then says 'replace' for a merge send. This is the exact skew the
      // assertion exists for: without it, a caller who thought they appended
      // has silently retired the agent's unmatched records.
      const mockRun = createMockRun({ runNumber: 5 });
      nock(BASE_URL)
        .patch('/runs/update')
        .reply(200, { data: mockRun, analysisWrite: echo }); // recordMode: 'replace'

      let thrown: unknown;
      try {
        await runOps.update(client, { project: 'my-project', runNumber: 5, recordWriteMode: 'merge', ...analysisInput });
      } catch (e) { thrown = e; }
      expect(thrown).toMatchObject({
        name: 'AnalysisEchoMismatchError',
        reason: 'mode-mismatch',
        expectedRecordMode: 'merge',
        actualRecordMode: 'replace',
      });
    });

    it('updateWithEcho returns the run AND the echo; null when no analysis sent (F17)', async () => {
      const mockRun = createMockRun({ runNumber: 5 });
      nock(BASE_URL)
        .patch('/runs/update')
        .reply(200, { data: mockRun, analysisWrite: echo });
      const withEcho = await runOps.updateWithEcho(client, { project: 'my-project', runNumber: 5, ...analysisInput });
      expect(withEcho.run.runNumber).toBe(5);
      expect(withEcho.analysisWrite).toEqual(echo);

      nock(BASE_URL)
        .patch('/runs/update')
        .reply(200, { data: mockRun });
      const noEcho = await runOps.updateWithEcho(client, { project: 'my-project', runNumber: 5, averageScore: 90 });
      expect(noEcho.analysisWrite).toBeNull();
    });

    it('updateByIdWithEcho mirrors by id (F17)', async () => {
      const mockRun = createMockRun();
      nock(BASE_URL)
        .patch(`/runs/${mockRun.id}`)
        .reply(200, { data: mockRun, analysisWrite: echo });
      const withEcho = await runOps.updateByIdWithEcho(client, mockRun.id, analysisInput);
      expect(withEcho.run.id).toBe(mockRun.id);
      expect(withEcho.analysisWrite?.supersededRecords).toBe(2);
    });

    it('a 204/empty body on the update path throws a named OpsApiError, not an anonymous ZodError', async () => {
      // Tracker 71626d6a: rawEnvelope skips sdk-core's envelope check;
      // parseUpdateEnvelope restores the named format error.
      nock(BASE_URL)
        .patch('/runs/update')
        .reply(204);

      await expect(
        runOps.update(client, { project: 'my-project', runNumber: 5, averageScore: 90 })
      ).rejects.toMatchObject({ name: expect.stringMatching(/SdkApiError|OpsApiError/) });
    });

    it('carries structured discriminators and the landed run on the error', async () => {
      const mockRun = createMockRun({ runNumber: 5 });
      nock(BASE_URL)
        .patch('/runs/update')
        .reply(200, { data: mockRun, analysisWrite: { ...echo, recordMode: 'merge' } });

      let thrown: unknown;
      try {
        await runOps.update(client, { project: 'my-project', runNumber: 5, ...analysisInput });
      } catch (e) { thrown = e; }
      expect(thrown).toMatchObject({
        name: 'AnalysisEchoMismatchError',
        reason: 'mode-mismatch',
        expectedRecordMode: 'replace',
        actualRecordMode: 'merge',
      });
      expect((thrown as { run: { runNumber: number } }).run.runNumber).toBe(5);
    });

    it('asserts the echo on analysisSummary-only updates too', async () => {
      const mockRun = createMockRun({ runNumber: 8 });
      nock(BASE_URL)
        .patch('/runs/update')
        .reply(200, { data: mockRun });

      await expect(
        runOps.update(client, {
          project: 'my-project',
          runNumber: 8,
          analysisSummary: { agentName: 'aristotle-analyst', decision: 'PROCEED' },
        })
      ).rejects.toMatchObject({ name: 'AnalysisEchoMismatchError' });
    });
  });

  describe('previewUpdate', () => {
    const previewReply = {
      data: {
        preview: true,
        recordMode: 'replace',
        byAgent: {
          'aristotle-analyst': {
            wouldSupersedeRecords: 2,
            wouldSupersedeSummaries: 1,
            wouldCreateRecords: 1,
            wouldCreateSummaries: 1,
            wouldRetireRecordIds: ['old-finding-1'],
          },
        },
      },
    };

    it('merge preview against a mode-stripping server throws preview-mode-mismatch BEFORE any write (F8)', async () => {
      // The rehearsal gets the same guard as the performance: a pre-1b server
      // previews replace for a merge send — returning that plan would model
      // the wrong semantics (its retire list describes a write that will not
      // happen as previewed).
      nock(BASE_URL)
        .post('/runs/update-preview')
        .reply(200, previewReply); // recordMode: 'replace' — the stripped answer

      let thrown: unknown;
      try {
        await runOps.previewUpdate(client, {
          project: 'my-project', runNumber: 5, recordWriteMode: 'merge',
          analysisRecords: [{ agentName: 'aristotle-analyst', recordType: 'finding', recordId: 'F-1', title: 'Test finding', data: {} }],
        });
      } catch (e) { thrown = e; }
      expect(thrown).toMatchObject({
        name: 'AnalysisEchoMismatchError',
        reason: 'preview-mode-mismatch',
        expectedRecordMode: 'merge',
        actualRecordMode: 'replace',
        run: null, // nothing was written
      });
    });

    it('forwards record_write_mode on the preview wire (1b — a stripped mode previews the wrong semantics)', async () => {
      nock(BASE_URL)
        .post('/runs/update-preview', (body) => body.recordWriteMode === 'merge')
        .reply(200, { data: { ...previewReply.data, recordMode: 'merge' } });

      const plan = await runOps.previewUpdate(client, {
        project: 'my-project', runNumber: 5, recordWriteMode: 'merge',
        analysisRecords: [{ agentName: 'aristotle-analyst', recordType: 'finding', recordId: 'F-1', title: 'Test finding', data: {} }],
      });
      expect(plan.recordMode).toBe('merge');
    });

    it('previews by project + run number via POST /runs/update-preview', async () => {
      nock(BASE_URL)
        .post('/runs/update-preview', (body) => body.project === 'my-project' && body.runNumber === 5)
        .reply(200, previewReply);

      const plan = await runOps.previewUpdate(client, {
        project: 'my-project',
        runNumber: 5,
        analysisRecords: [{ agentName: 'aristotle-analyst', recordType: 'finding', recordId: 'F-1', title: 'Test finding', data: {} }],
      });

      expect(plan.preview).toBe(true);
      expect(plan.recordMode).toBe('replace');
      expect(plan.byAgent['aristotle-analyst']?.wouldRetireRecordIds).toEqual(['old-finding-1']);
    });

    it('previews by run id via POST /runs/:id/update-preview', async () => {
      const runId = TEST_IDS.run1;
      nock(BASE_URL)
        .post(`/runs/${runId}/update-preview`)
        .reply(200, previewReply);

      const plan = await runOps.previewUpdateById(client, runId, {
        analysisRecords: [{ agentName: 'aristotle-analyst', recordType: 'finding', recordId: 'F-1', title: 'Test finding', data: {} }],
      });

      expect(plan.byAgent['aristotle-analyst']?.wouldSupersedeRecords).toBe(2);
    });

    it('rejects non-analysis update fields client-side with a named error', async () => {
      // The API's scope-rule 400 is unreachable through the SDK (the body is
      // built from the analysis fields alone), so this client-side rejection
      // is the only thing standing between a spread-in update input and a
      // silently narrowed preview. No nock stub: reaching the error proves
      // no request left.
      await expect(
        runOps.previewUpdate(client, {
          project: 'my-project',
          runNumber: 5,
          // A caller spreading an UpdateRunInput into the preview:
          ...( { averageScore: 90, agents: [{ name: 'code-validator', score: 90 }] } as object),
        })
      ).rejects.toThrow(/analysis concerns only; remove: agents, averageScore/);
    });

    it('rejects an invalid analysis record client-side before any request', async () => {
      // No nock stub: a network attempt would throw a nock "no match" error,
      // so reaching the InputValidationError proves the request never left.
      await expect(
        runOps.previewUpdateById(client, TEST_IDS.run1, {
          // recordId: '' violates .min(1) — client-side validation must reject it
          analysisRecords: [{ agentName: 'aristotle-analyst', recordType: 'finding', recordId: '', title: 't', data: {} }],
        })
      ).rejects.toMatchObject({ name: 'InputValidationError' });
    });

    it('throws ZodError on a malformed preview response', async () => {
      nock(BASE_URL)
        .post('/runs/update-preview')
        .reply(200, { data: { preview: true, recordMode: 'replace', byAgent: { a: { wouldSupersedeRecords: 'two' } } } });

      await expect(
        runOps.previewUpdate(client, { project: 'my-project', runNumber: 5 })
      ).rejects.toBeInstanceOf(ZodError);
    });
  });

  describe('response validation', () => {
    it('should throw ZodError on malformed response', async () => {
      const runId = TEST_IDS.run1;
      // Return a response missing required fields (no projectId, no runNumber, etc.)
      nock(BASE_URL)
        .get(`/runs/${runId}`)
        .reply(200, {
          data: { id: runId, workflowType: 'ship' },
        });

      await expect(
        runOps.get(client, runId)
      ).rejects.toThrow(ZodError);
    });

    it('should throw ZodError on wrong field type', async () => {
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
      ).rejects.toThrow(ZodError);
    });

    it('should throw ZodError on malformed listByProject response', async () => {
      nock(BASE_URL)
        .get('/runs/project/my-project')
        .reply(200, {
          data: [{ id: TEST_IDS.run1, workflowType: 'ship' }], // Missing required fields
        });

      await expect(
        runOps.listByProject(client, 'my-project')
      ).rejects.toThrow(ZodError);
    });

    it('should throw ZodError on malformed getLatest response', async () => {
      nock(BASE_URL)
        .get('/runs/project/my-project/latest')
        .query({ workflow_type: 'ship' })
        .reply(200, {
          data: { runNumber: 'not-a-number' }, // Wrong type
        });

      await expect(
        runOps.getLatest(client, 'my-project', 'ship')
      ).rejects.toThrow(ZodError);
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
            recordsTotal: 1,
            summariesTotal: 1,
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
        // API returns the pagination payload directly (no `{data: …}` envelope).
        // The SDK uses `rawEnvelope: true` to preserve `{data, total, …}`.
        .reply(200, { data: [], total: 0, limit: 10, offset: 0 });

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
        // See getProjectAnalysis above — pagination payload is unwrapped.
        .reply(200, { data: [mockRecord], total: 1, limit: 5, offset: 0 });

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

  describe('analysis recordId length (100-char widening)', () => {
    const valid100 = 'a'.repeat(ANALYSIS_RECORD_ID_MAX_LENGTH);
    const invalid101 = 'a'.repeat(ANALYSIS_RECORD_ID_MAX_LENGTH + 1);

    const longRecord = (recordId: string) => ({
      recordType: 'four_cause',
      recordId,
      title: 'Long semantic id',
      data: { material: 'TypeScript' },
    });

    it('forwards a 100-char recordId through save()', async () => {
      const mockRun = createMockRun({ runNumber: 1 });
      nock(BASE_URL)
        .post('/runs', (body) => body.analysisRecords?.[0]?.recordId === valid100)
        .reply(201, {
          data: {
            run: mockRun,
            agents: [createMockAgentSnapshot({ runId: mockRun.id })],
            correlation: { newIssues: 0, recurringIssues: 0, regressions: 0 },
            deduplicated: false,
          },
          // T21: analysis-bearing saves carry the echo (asserted by save()).
          analysisWrite: { recordMode: 'initial', supersededRecords: 0, supersededSummaries: 0, createdRecords: 1, createdSummaries: 0 },
        });

      const result = await runOps.save(client, {
        project: 'my-project',
        workflowType: 'post-implementation',
        agents: [{ name: 'aristotle-analyst', score: 90, decision: 'PROCEED' }],
        recommendations: [],
        analysisRecords: [longRecord(valid100)],
      });

      expect(result.run.runNumber).toBe(1);
    });

    it('forwards a 100-char recordId through validate()', async () => {
      nock(BASE_URL)
        .post('/runs/validate', (body) => body.analysisRecords?.[0]?.recordId === valid100)
        .reply(200, {
          data: {
            wouldCreate: 0,
            wouldUpdate: 0,
            wouldRegress: 0,
            validationErrors: [],
            preview: { newIssues: [], recurringIssues: [], regressions: [] },
          },
        });

      const result = await runOps.validate(client, {
        project: 'my-project',
        workflowType: 'post-implementation',
        agents: [{ name: 'aristotle-analyst', score: 90, decision: 'PROCEED' }],
        recommendations: [],
        analysisRecords: [longRecord(valid100)],
      });

      expect(result.validationErrors).toHaveLength(0);
    });

    it('forwards a 100-char recordId through update()', async () => {
      const mockRun = createMockRun({ runNumber: 5 });
      nock(BASE_URL)
        .patch('/runs/update', (body) => body.analysisRecords?.[0]?.recordId === valid100)
        .reply(200, {
          data: mockRun,
          // Analysis-bearing update: the 1a API echoes analysisWrite, and the
          // SDK asserts on it (spec §3.9) — an echo-less reply here would throw.
          analysisWrite: { recordMode: 'replace', supersededRecords: 0, supersededSummaries: 0, createdRecords: 1, createdSummaries: 0 },
        });

      const run = await runOps.update(client, {
        project: 'my-project',
        runNumber: 5,
        analysisRecords: [longRecord(valid100)],
      });

      expect(run.runNumber).toBe(5);
    });

    it('rejects a 101-char recordId client-side on save()', async () => {
      await expect(
        runOps.save(client, {
          project: 'my-project',
          workflowType: 'post-implementation',
          agents: [{ name: 'aristotle-analyst', score: 90, decision: 'PROCEED' }],
          recommendations: [],
          analysisRecords: [longRecord(invalid101)],
        })
      ).rejects.toThrow();
    });
  });

  describe('getAgentRunsAnalysis', () => {
    it('should get analysis summaries for a specific agent', async () => {
      nock(BASE_URL)
        .get('/agents/epictetus-validator/runs-analysis')
        .query({ project: 'my-project' })
        .reply(200, {
          data: [
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
        });

      const result = await runOps.getAgentRunsAnalysis(client, 'epictetus-validator', {
        project: 'my-project',
      });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].decision).toBe('FACTUAL');
      expect(result.data[0].runNumber).toBe(5);
      expect(result.data[0].workflowType).toBe('post-implementation');
    });

    it('should filter by decision', async () => {
      nock(BASE_URL)
        .get('/agents/code-validator/runs-analysis')
        .query({ project: 'my-project', decision: 'PASS' })
        .reply(200, { data: [], total: 0 });

      const result = await runOps.getAgentRunsAnalysis(client, 'code-validator', {
        project: 'my-project',
        decision: 'PASS',
      });

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it('strict pin (6.0.0): the pre-flip nested wire REJECTS — the tolerance window is closed', async () => {
      nock(BASE_URL)
        .get('/agents/code-validator/runs-analysis')
        .query({ project: 'my-project' })
        .reply(200, { data: { items: [], total: 4 } });

      await expect(runOps.getAgentRunsAnalysis(client, 'code-validator', {
        project: 'my-project',
      })).rejects.toThrow();
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

  describe('tool-sweep batch 1 — T1 content-derived idempotency key, T21 save echo', () => {
    const plainInput = () => ({
      project: 'my-project',
      workflowType: 'post-implementation',
      agents: [{ name: 'code-validator', score: 85, decision: 'PASS' }],
      recommendations: [],
    });
    const plainReply = (deduplicated = false) => ({
      data: {
        run: createMockRun({ runNumber: 1 }),
        agents: [],
        correlation: { newIssues: 0, recurringIssues: 0, regressions: 0 },
        deduplicated,
      },
    });

    it('T1: the default idempotency key is content-derived — identical payloads send the SAME key', async () => {
      const keys: string[] = [];
      nock(BASE_URL)
        .post('/runs', (body) => { keys.push(body.idempotencyKey); return true; })
        .times(2)
        .reply(201, plainReply());

      await runOps.save(client, plainInput());
      await runOps.save(client, plainInput());

      expect(keys).toHaveLength(2);
      expect(keys[0]).toBe(keys[1]);
      // sha256 hex, not a UUID — the random default was the T1 mechanism.
      expect(keys[0]).toMatch(/^[a-f0-9]{64}$/);
    });

    it('T1 control: different payloads derive DIFFERENT keys; an explicit key passes through', async () => {
      const keys: string[] = [];
      nock(BASE_URL)
        .post('/runs', (body) => { keys.push(body.idempotencyKey); return true; })
        .times(3)
        .reply(201, plainReply());

      await runOps.save(client, plainInput());
      await runOps.save(client, { ...plainInput(), workflowType: 'ship' });
      await runOps.save(client, { ...plainInput(), idempotencyKey: 'my-explicit-key' });

      expect(keys[0]).not.toBe(keys[1]);
      expect(keys[2]).toBe('my-explicit-key');
    });

    it('T21: the analysisWrite echo is surfaced on the save result', async () => {
      const echo = { recordMode: 'initial', supersededRecords: 0, supersededSummaries: 0, createdRecords: 2, createdSummaries: 1 };
      nock(BASE_URL)
        .post('/runs')
        .reply(201, { ...plainReply(), analysisWrite: echo });

      const result = await runOps.save(client, {
        ...plainInput(),
        analysisRecords: [{ recordType: 'finding', recordId: 'r1', title: 't', data: { k: 1 } }],
      });

      expect(result.analysisWrite).toEqual(echo);
    });

    it('T21: analysis-bearing save with NO echo throws AnalysisEchoMismatchError (old API)', async () => {
      nock(BASE_URL).post('/runs').reply(201, plainReply());

      await expect(
        runOps.save(client, {
          ...plainInput(),
          analysisRecords: [{ recordType: 'finding', recordId: 'r1', title: 't', data: { k: 1 } }],
        })
      ).rejects.toMatchObject({ name: 'AnalysisEchoMismatchError', reason: 'missing-echo' });
    });

    it('T21 control: a DEDUPLICATED analysis-bearing replay carries no echo and does not throw — nothing was written', async () => {
      nock(BASE_URL).post('/runs').reply(200, plainReply(true));

      const result = await runOps.save(client, {
        ...plainInput(),
        analysisRecords: [{ recordType: 'finding', recordId: 'r1', title: 't', data: { k: 1 } }],
      });

      expect(result.deduplicated).toBe(true);
      expect(result.analysisWrite).toBeNull();
    });

    it('T21 control: a plain save without analysis needs no echo and returns analysisWrite null', async () => {
      nock(BASE_URL).post('/runs').reply(201, plainReply());

      const result = await runOps.save(client, plainInput());
      expect(result.analysisWrite).toBeNull();
    });
  });
});
