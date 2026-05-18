import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsClient } from '../src/client.js';
import { BASE_URL, TEST_API_KEY } from './setup.js';
import {
  createMockRun,
  createMockRunSummary,
  createMockAgentSnapshot,
  createMockProject,
  createMockProjectSummary,
  createMockDailyIssueCounts,
  createMockIssue,
  createMockAuthUser,
  createMockLoginResponse,
  createMockRegisterResponse,
  createMockPublicApiKey,
  createMockApiKeyCreated,
  resetMockIds,
} from './contract-helpers.js';

describe('OpsClient', () => {
  let client: OpsClient;

  beforeEach(() => {
    resetMockIds();
    client = new OpsClient({
      baseUrl: BASE_URL,
      apiKey: TEST_API_KEY,
    });
  });

  describe('constructor', () => {
    it('should create client with API key', () => {
      expect(client.isAuthenticated()).toBe(true);
      expect(client.getAuthType()).toBe('api_key');
    });

    it('should create client without credentials', () => {
      // Clear env vars so auto-load doesn't pick them up
      vi.stubEnv('ULUOPS_API_KEY', '');
      const unauthClient = new OpsClient({ baseUrl: BASE_URL });
      expect(unauthClient.isAuthenticated()).toBe(false);
      expect(unauthClient.getAuthType()).toBeNull();
    });
  });

  describe('auth operations', () => {
    it('should register a new user', async () => {
      const mockRegister = createMockRegisterResponse({ email: 'test@example.com' });
      nock(BASE_URL)
        .post('/auth/register', { email: 'test@example.com', password: 'Password123' })
        .reply(201, { data: mockRegister });

      const result = await client.auth.register({
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.email).toBe('test@example.com');
    });

    it('should login and return token', async () => {
      const mockLogin = createMockLoginResponse();
      nock(BASE_URL)
        .post('/auth/login', { email: 'test@example.com', password: 'password123' })
        .reply(200, { data: mockLogin });

      const result = await client.auth.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.sessionToken).toBeDefined();
    });

    it('should get current user', async () => {
      const mockUser = createMockAuthUser({ email: 'test@example.com' });
      nock(BASE_URL)
        .get('/auth/me')
        .reply(200, { data: mockUser });

      const user = await client.auth.getMe();

      expect(user.email).toBe('test@example.com');
    });

    it('should list API keys', async () => {
      const mockKey = createMockPublicApiKey({ name: 'Test Key' });
      nock(BASE_URL)
        .get('/auth/keys')
        .reply(200, { data: [mockKey] });

      const keys = await client.auth.listApiKeys();

      expect(keys).toHaveLength(1);
      expect(keys[0].name).toBe('Test Key');
    });

    it('should create API key', async () => {
      const mockCreated = createMockApiKeyCreated();
      nock(BASE_URL)
        .post('/auth/keys', { name: 'New Key' })
        .reply(201, { data: mockCreated });

      const result = await client.auth.createApiKey({ name: 'New Key' });

      expect(result.key).toBeDefined();
    });
  });

  describe('project operations', () => {
    it('should list projects', async () => {
      nock(BASE_URL)
        .get('/projects')
        .reply(200, {
          data: [
            createMockProject({ name: 'Project A' }),
            createMockProject({ name: 'Project B' }),
          ],
        });

      const projects = await client.projects.list();

      expect(projects).toHaveLength(2);
      expect(projects[0].name).toBe('Project A');
    });

    it('should get project by ID or name', async () => {
      const mockProj = createMockProject({ name: 'Project A' });
      nock(BASE_URL)
        .get(`/projects/${mockProj.id}`)
        .reply(200, { data: mockProj });

      const project = await client.projects.get(mockProj.id);

      expect(project.name).toBe('Project A');
    });

    it('should create project', async () => {
      const mockProj = createMockProject({ name: 'New Project' });
      nock(BASE_URL)
        .post('/projects', { name: 'New Project' })
        .reply(201, { data: mockProj });

      const project = await client.projects.create({ name: 'New Project' });

      expect(project.name).toBe('New Project');
    });

    it('should get project summary', async () => {
      const mockSummary = createMockProjectSummary({ totalRuns: 10, openIssues: 5, totalIssues: 25 });
      nock(BASE_URL)
        .get(`/projects/${mockSummary.project.id}/summary`)
        .reply(200, { data: mockSummary });

      const summary = await client.projects.getSummary(mockSummary.project.id);

      expect(summary.stats.totalRuns).toBe(10);
      expect(summary.stats.openIssues).toBe(5);
    });

    it('should get project trends', async () => {
      const mockTrends = {
        project: createMockProject(),
        days: 30,
        daily: [
          { date: '2024-01-01', total: 10, critical: 2, new: 5, resolved: 3 },
          { date: '2024-01-02', total: 8, critical: 1, new: 3, resolved: 4 },
        ],
        summary: { averageNew: 4, averageResolved: 3.5, netChange: 0.5, trendDirection: 'stable' as const },
      };
      nock(BASE_URL)
        .get('/projects/proj-1/trends')
        .reply(200, { data: mockTrends });

      const trends = await client.projects.getTrends('proj-1');

      expect(trends.daily).toHaveLength(2);
      expect(trends.daily[0].total).toBe(10);
    });
  });

  describe('run operations', () => {
    it('should save validation run', async () => {
      const mockRun = createMockRun({ runNumber: 1 });
      nock(BASE_URL)
        .post('/runs')
        .reply(201, {
          data: {
            run: mockRun,
            agents: [createMockAgentSnapshot({ runId: mockRun.id })],
            correlation: { newIssues: 3, recurringIssues: 1, regressions: 0 },
            deduplicated: false,
          },
        });

      const result = await client.runs.save({
        project: 'my-project',
        workflowType: 'post-implementation',
        agents: [
          { name: 'code-validator', score: 85, decision: 'PASS' },
        ],
        recommendations: [],
      });

      expect(result.run.runNumber).toBe(1);
    });

    it('should get latest run', async () => {
      const mockRun = createMockRun({ runNumber: 5, workflowType: 'ship' });
      nock(BASE_URL)
        .get('/runs/project/proj-1/latest')
        .reply(200, {
          data: mockRun,
        });

      const run = await client.runs.getLatest('proj-1');

      expect(run.runNumber).toBe(5);
    });

    it('should list runs by project', async () => {
      nock(BASE_URL)
        .get('/runs/project/proj-1')
        .reply(200, {
          data: [
            createMockRunSummary({ runNumber: 1 }),
            createMockRunSummary({ runNumber: 2 }),
          ],
        });

      const runs = await client.runs.listByProject('proj-1');

      expect(runs).toHaveLength(2);
    });

    it('should diff two runs', async () => {
      const baseRun = createMockRun({ runNumber: 1, workflowType: 'ship', averageScore: 90 });
      const compareRun = createMockRun({ runNumber: 2, workflowType: 'ship', averageScore: 95 });
      nock(BASE_URL)
        .get('/runs/diff')
        .query({ project: 'proj-1', base_run: 1, compare_run: 2 })
        .reply(200, {
          data: {
            baseRun,
            compareRun,
            fixed: [{ issueId: '00000000-0000-4000-a000-000000000001', title: 'Fixed bug' }],
            new: [{ issueId: '00000000-0000-4000-a000-000000000002', title: 'New issue' }],
            unchanged: [],
            agentChanges: [],
          },
        });

      const diff = await client.runs.diff({
        project: 'proj-1',
        baseRun: 1,
        compareRun: 2,
      });

      expect(diff.fixed).toHaveLength(1);
      expect(diff.fixed[0].title).toBe('Fixed bug');
      expect(diff.new).toHaveLength(1);
      expect(diff.baseRun.runNumber).toBe(1);
      expect(diff.compareRun.runNumber).toBe(2);
    });
  });

  describe('issue operations', () => {
    it('should create user issue', async () => {
      const mockIssue = createMockIssue({ title: 'Manual issue', priority: 'critical' });
      nock(BASE_URL)
        .post('/issues')
        .reply(201, { data: mockIssue });

      const issue = await client.issues.create({
        project: 'proj-1',
        title: 'Manual issue',
        priority: 'critical',
      });

      expect(issue.title).toBe('Manual issue');
    });

    it('should search issues', async () => {
      nock(BASE_URL)
        .get('/issues/search')
        .query({ query: 'authentication' })
        .reply(200, {
          data: [
            createMockIssue({ title: 'Auth bug' }),
            createMockIssue({ title: 'Login authentication issue' }),
          ],
        });

      const issues = await client.issues.search({ query: 'authentication' });

      expect(issues).toHaveLength(2);
    });

    it('should get issue details', async () => {
      const mockIssue = createMockIssue({ title: 'Bug' });
      nock(BASE_URL)
        .get(`/issues/${mockIssue.id}/details`)
        .reply(200, {
          data: {
            issue: mockIssue,
            occurrences: [],
            notes: [],
            history: [],
          },
        });

      const details = await client.issues.getDetails(mockIssue.id);

      expect(details.issue.title).toBe('Bug');
    });

    it('should update issue status', async () => {
      const mockIssue = createMockIssue({ status: 'completed' });
      nock(BASE_URL)
        .patch(`/issues/${mockIssue.id}/status`, { status: 'completed', reason: 'Fixed' })
        .reply(200, { data: mockIssue });

      const issue = await client.issues.updateStatus(mockIssue.id, {
        status: 'completed',
        reason: 'Fixed',
      });

      expect(issue.status).toBe('completed');
    });

    it('should add note to issue', async () => {
      const mockNote = {
        id: '00000000-0000-4000-a000-000000000061',
        issueId: '00000000-0000-4000-a000-000000000021',
        content: 'This is a note',
        noteType: 'context',
        createdBy: null,
        createdAt: new Date().toISOString(),
      };
      nock(BASE_URL)
        .post('/issues/issue-1/notes', { content: 'This is a note', noteType: 'context' })
        .reply(201, { data: mockNote });

      const note = await client.issues.addNote('issue-1', {
        content: 'This is a note',
        noteType: 'context',
      });

      expect(note.content).toBe('This is a note');
    });
  });

  describe('analytics operations', () => {
    it('should get agent performance', async () => {
      nock(BASE_URL)
        .get('/analytics/agents/performance')
        .reply(200, {
          data: [
            { name: 'code-validator', totalRuns: 100, averageScore: 85, passRate: 92, totalIssuesFound: 250 },
            { name: 'test-architect', totalRuns: 80, averageScore: 78, passRate: 85, totalIssuesFound: 180 },
          ],
        });

      const perf = await client.analytics.getAgentPerformance();

      expect(perf).toHaveLength(2);
      expect(perf[0].averageScore).toBe(85);
    });

    it('should get burndown data', async () => {
      const emptyTrend = { netChange: 0, trend: 'stable', avgDailyChange: 0, confidence: 'low' as const, sampleSize: 1, rSquared: 0, standardError: 0, confidenceInterval: [0, 0] as [number, number], outliers: [], diagnostics: null, ciReliable: false, warnings: [], weeklyPatternDetected: false };
      nock(BASE_URL)
        .get('/analytics/taxonomy/burndown')
        .reply(200, {
          data: {
            timeSeries: [{ date: '2024-01-01', STR: 5, SEM: 10, PRA: 3, EPI: 2, total: 20 }],
            trends: { STR: emptyTrend, SEM: emptyTrend, PRA: emptyTrend, EPI: emptyTrend },
          },
        });

      const burndown = await client.analytics.getBurndown();

      expect(burndown.timeSeries).toHaveLength(1);
    });

    it('should get velocity metrics', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/velocity')
        .reply(200, {
          data: {
            items: [{ domain: 'STR', mode: 'OMI', failureCode: 'STR-OMI', currentCount: 5, previousCount: 10, velocityPercent: -50, alert: false, sparkline: [10, 8, 6, 5], trendReliability: 'high' }],
            summary: { improving: ['STR-OMI'], stable: [], degrading: [], mostImproved: 'STR-OMI', mostConcerning: null },
          },
        });

      const velocity = await client.analytics.getVelocity();

      expect(velocity.items[0].failureCode).toBe('STR-OMI');
    });
  });

  describe('taxonomy operations', () => {
    it('should get taxonomy schema', async () => {
      nock(BASE_URL)
        .get('/taxonomy')
        .reply(200, {
          data: {
            domains: [
              { code: 'STR', name: 'Structural', description: 'Structural issues', modes: [{ code: 'OMI', name: 'Omission', description: 'Missing elements' }] },
              { code: 'SEM', name: 'Semantic', description: 'Semantic issues', modes: [{ code: 'VAL', name: 'Validation', description: 'Validation issues' }] },
            ],
            severities: [{ code: 'C', name: 'critical', weight: 10 }, { code: 'H', name: 'high', weight: 5 }],
            priorities: ['critical', 'high', 'suggested', 'backlog'],
            statuses: ['open', 'completed'],
            failureCodePattern: { pattern: 'x', format: 'x', example: 'x' },
          },
        });

      const taxonomy = await client.taxonomy.get();

      expect(taxonomy.domains).toHaveLength(2);
      expect(taxonomy.severities[0]!.name).toBe('critical');
      expect(taxonomy.statuses).toContain('open');
      expect(taxonomy.failureCodePattern).toBeDefined();
    });
  });

  describe('request body transformation', () => {
    it('should send camelCase in save run request', async () => {
      // Verify the exact request body uses camelCase (no snake_case conversion)
      nock(BASE_URL)
        .post('/runs', (body) => {
          // Verify camelCase for top-level fields
          expect(body.workflowType).toBe('post-implementation');
          expect(body.project).toBe('my-project');
          // Verify agent tokens stay camelCase
          expect(body.agents[0].name).toBe('code-validator');
          expect(body.agents[0].tokens.inputTokens).toBe(1000);
          expect(body.agents[0].tokens.outputTokens).toBe(500);
          expect(body.agents[0].tokens.cacheCreationTokens).toBe(100);
          expect(body.agents[0].durationMs).toBe(5000);
          // Verify recommendation fields stay camelCase
          expect(body.recommendations[0].failureCode).toBe('SEM-VAL/H');
          expect(body.recommendations[0].failureDomain).toBe('SEM');
          expect(body.recommendations[0].filePath).toBe('src/index.ts');
          expect(body.recommendations[0].lineNumber).toBe(42);
          return true;
        })
        .reply(201, {
          data: {
            run: createMockRun({ runNumber: 1 }),
            agents: [createMockAgentSnapshot()],
            correlation: { newIssues: 1, recurringIssues: 0, regressions: 0 },
            deduplicated: false,
          },
        });

      await client.runs.save({
        project: 'my-project',
        workflowType: 'post-implementation',
        agents: [
          {
            name: 'code-validator',
            score: 85,
            decision: 'PASS',
            tokens: {
              inputTokens: 1000,
              outputTokens: 500,
              cacheCreationTokens: 100,
            },
            durationMs: 5000,
          },
        ],
        recommendations: [
          {
            agent: 'code-validator',
            title: 'Test issue',
            priority: 'critical',
            failureCode: 'SEM-VAL/H',
            failureDomain: 'SEM',
            filePath: 'src/index.ts',
            lineNumber: 42,
          },
        ],
      });
    });

    it('should transform camelCase query params to snake_case', async () => {
      // Verify query param transformation in project trends
      const mockTrends = {
        project: createMockProject(),
        days: 30,
        daily: [],
        summary: { averageNew: 0, averageResolved: 0, netChange: 0, trendDirection: 'stable' as const },
      };
      nock(BASE_URL)
        .get('/projects/proj-1/trends')
        .query({ days: 30 })
        .reply(200, { data: mockTrends });

      await client.projects.getTrends('proj-1', { days: 30 });
    });

    it('should send issue note with camelCase noteType', async () => {
      nock(BASE_URL)
        .post('/issues/issue-1/notes', (body) => {
          expect(body.noteType).toBe('resolution');
          expect(body.content).toBe('Fixed the bug');
          return true;
        })
        .reply(201, {
          data: {
            id: '00000000-0000-4000-a000-000000000062',
            issueId: '00000000-0000-4000-a000-000000000021',
            content: 'Fixed the bug',
            noteType: 'resolution',
            createdBy: null,
            createdAt: new Date().toISOString(),
          },
        });

      await client.issues.addNote('issue-1', {
        content: 'Fixed the bug',
        noteType: 'resolution',
      });
    });
  });

  describe('pagination boundary tests', () => {
    it('should handle empty results', async () => {
      nock(BASE_URL).get('/projects').reply(200, { data: [] });

      const projects = await client.projects.list();

      expect(projects).toEqual([]);
      expect(projects).toHaveLength(0);
    });

    it('should handle project issues with all filter params', async () => {
      // Note: toApiQuery converts camelCase to snake_case for API
      nock(BASE_URL)
        .get('/projects/proj-1/issues')
        .query({
          status: 'open',
          priority: 'critical',
          severity: 'high',
          limit: 20,
          offset: 0,
          include_resolved: false,
        })
        .reply(200, {
          data: [createMockIssue({ title: 'Critical issue', status: 'open', priority: 'critical' })],
        });

      const issues = await client.projects.listIssues('proj-1', {
        status: 'open',
        priority: 'critical',
        severity: 'high',
        limit: 20,
        offset: 0,
        includeResolved: false,
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].status).toBe('open');
    });

    it('should handle run list with workflow filter', async () => {
      // Note: toApiQuery converts camelCase to snake_case for API
      nock(BASE_URL)
        .get('/runs/project/proj-1')
        .query({ workflow_type: 'ship', limit: 5 })
        .reply(200, {
          data: [
            createMockRunSummary({ runNumber: 1, workflowType: 'ship' }),
            createMockRunSummary({ runNumber: 2, workflowType: 'ship' }),
          ],
        });

      const runs = await client.runs.listByProject('proj-1', {
        workflowType: 'ship',
        limit: 5,
      });

      expect(runs).toHaveLength(2);
      expect(runs.every((r) => r.workflowType === 'ship')).toBe(true);
    });
  });
});
