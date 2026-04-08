import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsClient } from '../src/client.js';
import { BASE_URL, TEST_API_KEY } from './setup.js';

describe('OpsClient', () => {
  let client: OpsClient;

  beforeEach(() => {
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
      const unauthClient = new OpsClient({ baseUrl: BASE_URL });
      expect(unauthClient.isAuthenticated()).toBe(false);
      expect(unauthClient.getAuthType()).toBeNull();
    });
  });

  describe('auth operations', () => {
    it('should register a new user', async () => {
      nock(BASE_URL)
        .post('/auth/register', { email: 'test@example.com', password: 'Password123' })
        .reply(201, {
          data: {
            user: { id: 'user-1', email: 'test@example.com' },
            token: 'jwt-token-123',
          },
        });

      const result = await client.auth.register({
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBe('jwt-token-123');
    });

    it('should login and return token', async () => {
      nock(BASE_URL)
        .post('/auth/login', { email: 'test@example.com', password: 'password123' })
        .reply(200, {
          data: {
            user: { id: 'user-1', email: 'test@example.com' },
            token: 'jwt-token-456',
          },
        });

      const result = await client.auth.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.token).toBe('jwt-token-456');
    });

    it('should get current user', async () => {
      nock(BASE_URL)
        .get('/auth/me')
        .reply(200, {
          data: {
            id: 'user-1',
            email: 'test@example.com',
            role: 'user',
          },
        });

      const user = await client.auth.getMe();

      expect(user.id).toBe('user-1');
      expect(user.email).toBe('test@example.com');
    });

    it('should list API keys', async () => {
      nock(BASE_URL)
        .get('/auth/keys')
        .reply(200, {
          data: [
            { id: 'key-1', name: 'Test Key', prefix: 'ulr_test' },
          ],
        });

      const keys = await client.auth.listApiKeys();

      expect(keys).toHaveLength(1);
      expect(keys[0].name).toBe('Test Key');
    });

    it('should create API key', async () => {
      nock(BASE_URL)
        .post('/auth/keys', { name: 'New Key' })
        .reply(201, {
          data: {
            id: 'key-2',
            name: 'New Key',
            key: 'ulr_full-key-value',
          },
        });

      const result = await client.auth.createApiKey({ name: 'New Key' });

      expect(result.key).toBe('ulr_full-key-value');
    });
  });

  describe('project operations', () => {
    it('should list projects', async () => {
      nock(BASE_URL)
        .get('/projects')
        .reply(200, {
          data: [
            { id: 'proj-1', name: 'Project A' },
            { id: 'proj-2', name: 'Project B' },
          ],
        });

      const projects = await client.projects.list();

      expect(projects).toHaveLength(2);
      expect(projects[0].name).toBe('Project A');
    });

    it('should get project by ID or name', async () => {
      nock(BASE_URL)
        .get('/projects/proj-1')
        .reply(200, {
          data: { id: 'proj-1', name: 'Project A', createdAt: '2024-01-01' },
        });

      const project = await client.projects.get('proj-1');

      expect(project.id).toBe('proj-1');
      expect(project.name).toBe('Project A');
    });

    it('should create project', async () => {
      nock(BASE_URL)
        .post('/projects', { name: 'New Project' })
        .reply(201, {
          data: { id: 'proj-3', name: 'New Project' },
        });

      const project = await client.projects.create({ name: 'New Project' });

      expect(project.name).toBe('New Project');
    });

    it('should get project summary', async () => {
      nock(BASE_URL)
        .get('/projects/proj-1/summary')
        .reply(200, {
          data: {
            project: { id: 'proj-1', name: 'Project A' },
            totalRuns: 10,
            totalIssues: 25,
            openIssues: 5,
          },
        });

      const summary = await client.projects.getSummary('proj-1');

      expect(summary.totalRuns).toBe(10);
      expect(summary.openIssues).toBe(5);
    });

    it('should get project trends', async () => {
      nock(BASE_URL)
        .get('/projects/proj-1/trends')
        .reply(200, {
          data: [
            { date: '2024-01-01', openIssues: 10, closedIssues: 5 },
            { date: '2024-01-02', openIssues: 8, closedIssues: 7 },
          ],
        });

      const trends = await client.projects.getTrends('proj-1');

      expect(trends).toHaveLength(2);
      expect(trends[0].openIssues).toBe(10);
    });
  });

  describe('run operations', () => {
    it('should save validation run', async () => {
      nock(BASE_URL)
        .post('/runs')
        .reply(201, {
          data: {
            run: { id: 'run-1', runNumber: 1 },
            issues: { created: 3, updated: 1 },
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
      nock(BASE_URL)
        .get('/runs/project/proj-1/latest')
        .reply(200, {
          data: { id: 'run-5', runNumber: 5, workflowType: 'ship' },
        });

      const run = await client.runs.getLatest('proj-1');

      expect(run.runNumber).toBe(5);
    });

    it('should list runs by project', async () => {
      nock(BASE_URL)
        .get('/runs/project/proj-1')
        .reply(200, {
          data: [
            { id: 'run-1', runNumber: 1 },
            { id: 'run-2', runNumber: 2 },
          ],
        });

      const runs = await client.runs.listByProject('proj-1');

      expect(runs).toHaveLength(2);
    });

    it('should diff two runs', async () => {
      nock(BASE_URL)
        .get('/runs/diff')
        .query({ project: 'proj-1', baseRun: 1, compareRun: 2 })
        .reply(200, {
          data: {
            baseRun: { id: 'run-1', projectId: 'proj-1', runNumber: 1, workflowType: 'ship', timestamp: '2026-01-01T00:00:00Z', allGatesPassed: true, averageScore: 90, rawMarkdown: null, archivedAt: null, archiveReason: null, idempotencyKey: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
            compareRun: { id: 'run-2', projectId: 'proj-1', runNumber: 2, workflowType: 'ship', timestamp: '2026-01-02T00:00:00Z', allGatesPassed: true, averageScore: 95, rawMarkdown: null, archivedAt: null, archiveReason: null, idempotencyKey: null, createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
            fixed: [{ issueId: 'issue-1', title: 'Fixed bug' }],
            new: [{ issueId: 'issue-2', title: 'New issue' }],
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
      expect(diff.fixed[0].issueId).toBe('issue-1');
      expect(diff.new).toHaveLength(1);
      expect(diff.baseRun.runNumber).toBe(1);
      expect(diff.compareRun.runNumber).toBe(2);
    });
  });

  describe('issue operations', () => {
    it('should create user issue', async () => {
      nock(BASE_URL)
        .post('/issues')
        .reply(201, {
          data: {
            id: 'issue-1',
            title: 'Manual issue',
            priority: 'critical',
          },
        });

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
            { id: 'issue-1', title: 'Auth bug' },
            { id: 'issue-2', title: 'Login authentication issue' },
          ],
        });

      const issues = await client.issues.search({ query: 'authentication' });

      expect(issues).toHaveLength(2);
    });

    it('should get issue details', async () => {
      nock(BASE_URL)
        .get('/issues/issue-1/details')
        .reply(200, {
          data: {
            issue: { id: 'issue-1', title: 'Bug' },
            occurrences: 5,
            notes: [],
          },
        });

      const details = await client.issues.getDetails('issue-1');

      expect(details.occurrences).toBe(5);
    });

    it('should update issue status', async () => {
      nock(BASE_URL)
        .patch('/issues/issue-1/status', { status: 'completed', reason: 'Fixed' })
        .reply(200, {
          data: { id: 'issue-1', status: 'completed' },
        });

      const issue = await client.issues.updateStatus('issue-1', {
        status: 'completed',
        reason: 'Fixed',
      });

      expect(issue.status).toBe('completed');
    });

    it('should add note to issue', async () => {
      nock(BASE_URL)
        .post('/issues/issue-1/notes', { content: 'This is a note', noteType: 'context' })
        .reply(201, {
          data: { id: 'note-1', content: 'This is a note' },
        });

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
            { name: 'code-validator', avgScore: 85, totalRuns: 100 },
            { name: 'test-architect', avgScore: 78, totalRuns: 80 },
          ],
        });

      const perf = await client.analytics.getAgentPerformance();

      expect(perf).toHaveLength(2);
      expect(perf[0].avgScore).toBe(85);
    });

    it('should get burndown data', async () => {
      nock(BASE_URL)
        .get('/analytics/taxonomy/burndown')
        .reply(200, {
          data: {
            timeSeries: [
              { date: '2024-01-01', STR: 5, SEM: 10, PRA: 3, EPI: 2 },
            ],
            trends: { STR: 'declining', SEM: 'stable' },
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
            modes: [
              { mode: 'STR-OMI', velocity: -5, trend: 'improving' },
            ],
          },
        });

      const velocity = await client.analytics.getVelocity();

      expect(velocity.modes[0].mode).toBe('STR-OMI');
    });
  });

  describe('taxonomy operations', () => {
    it('should get taxonomy schema', async () => {
      nock(BASE_URL)
        .get('/taxonomy')
        .reply(200, {
          data: {
            domains: [
              { code: 'STR', name: 'Structural', modes: ['OMI', 'RED', 'MIS'] },
              { code: 'SEM', name: 'Semantic', modes: ['VAL', 'TYP', 'LOG'] },
            ],
            severities: ['critical', 'high', 'medium', 'low', 'info'],
          },
        });

      const taxonomy = await client.taxonomy.get();

      expect(taxonomy.domains).toHaveLength(2);
      expect(taxonomy.severities).toContain('critical');
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
            run: { id: 'run-1', runNumber: 1 },
            issues: { created: 1, updated: 0 },
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
      nock(BASE_URL)
        .get('/projects/proj-1/trends')
        .query({ days: 30 })
        .reply(200, { data: [] });

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
          data: { id: 'note-1', content: 'Fixed the bug', noteType: 'resolution' },
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
          data: [{ id: 'issue-1', title: 'Critical issue', status: 'open' }],
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
            { id: 'run-1', runNumber: 1, workflowType: 'ship' },
            { id: 'run-2', runNumber: 2, workflowType: 'ship' },
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
