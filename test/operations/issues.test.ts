import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as issueOps from '../../src/operations/issues.js';
import {
  BASE_URL,
  TEST_API_KEY,
  createMockIssue,
  createMockIssueDetails,
  createMockIssueNote,
  createMockStatusHistory,
  createMockStatusUpdateResult,
  createMockBulkStatusUpdateResult,
  mockValidatedEndpoint,
  mockValidatedListEndpoint,
  IssueResponseSchema,
} from '../setup.js';
import {
  TEST_IDS,
  IssueDetailsResponseSchema,
  IssueNoteResponseSchema,
  StatusHistoryResponseSchema,
  StatusUpdateResultResponseSchema,
  BulkStatusUpdateResultResponseSchema,
  resetMockIds,
} from '../contract-helpers.js';

describe('Issue Operations', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    resetMockIds();
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: TEST_API_KEY,
    });
  });

  describe('create', () => {
    it('should create a user-submitted issue', async () => {
      const mockIssue = createMockIssue({
        title: 'Manual bug report',
        priority: 'critical',
        validator: 'user-submitted',
      });

      nock(BASE_URL)
        .post('/issues', {
          project: TEST_IDS.proj1,
          title: 'Manual bug report',
          priority: 'critical',
        })
        .reply(201, { data: mockIssue });

      const issue = await issueOps.create(client, {
        project: TEST_IDS.proj1,
        title: 'Manual bug report',
        priority: 'critical',
      });

      expect(issue.title).toBe('Manual bug report');
      expect(issue.priority).toBe('critical');
    });

    it('should create issue with full metadata', async () => {
      const mockIssue = createMockIssue({
        title: 'Security vulnerability',
        severity: 'critical',
        failureCode: 'SEM-VAL/C',
        filePath: 'src/auth.ts',
      });

      nock(BASE_URL)
        .post('/issues', (body) => {
          return (
            body.project === TEST_IDS.proj1 &&
            body.title === 'Security vulnerability' &&
            body.severity === 'critical' &&
            body.failureCode === 'SEM-VAL/C' &&
            body.filePath === 'src/auth.ts'
          );
        })
        .reply(201, { data: mockIssue });

      const issue = await issueOps.create(client, {
        project: TEST_IDS.proj1,
        title: 'Security vulnerability',
        priority: 'critical',
        severity: 'critical',
        failureCode: 'SEM-VAL/C',
        failureDomain: 'SEM',
        filePath: 'src/auth.ts',
        lineNumber: 42,
      });

      expect(issue.severity).toBe('critical');
    });
  });

  describe('search', () => {
    it('should search issues by query', async () => {
      const mockIssues = [
        createMockIssue({ title: 'Auth token validation' }),
        createMockIssue({ title: 'Authentication flow bug' }),
      ];

      nock(BASE_URL)
        .get('/issues/search')
        .query({ query: 'authentication' })
        .reply(200, { data: mockIssues });

      const issues = await issueOps.search(client, { query: 'authentication' });

      expect(issues).toHaveLength(2);
      expect(issues[0].title).toBe('Auth token validation');
      expect(issues[1].title).toBe('Authentication flow bug');
    });

    it('should search with filters', async () => {
      const mockIssues = [createMockIssue({ title: 'Critical bug' })];

      nock(BASE_URL)
        .get('/issues/search')
        .query({
          query: 'bug',
          projects: `${TEST_IDS.proj1},${TEST_IDS.proj2}`,
          status: 'open',
          priority: 'critical',
        })
        .reply(200, { data: mockIssues });

      const issues = await issueOps.search(client, {
        query: 'bug',
        projects: [TEST_IDS.proj1, TEST_IDS.proj2],
        status: 'open',
        priority: 'critical',
      });

      expect(issues).toHaveLength(1);
    });
  });

  describe('getByFingerprint', () => {
    it('should get issue by fingerprint', async () => {
      const mockIssue = createMockIssue({ fingerprint: 'abc123def456', title: 'Found issue' });

      nock(BASE_URL)
        .get('/issues/by-fingerprint/abc123def456')
        .query({ project: TEST_IDS.proj1 })
        .reply(200, { data: mockIssue });

      const issue = await issueOps.getByFingerprint(client, 'abc123def456', TEST_IDS.proj1);

      expect(issue.fingerprint).toBe('abc123def456');
    });
  });

  describe('updateStatusByFingerprint', () => {
    it('should update status by fingerprint', async () => {
      const mockResult = createMockStatusUpdateResult({
        previousStatus: 'open',
        newStatus: 'completed',
      });

      nock(BASE_URL)
        .patch('/issues/by-fingerprint/abc123/status')
        .query({ project: TEST_IDS.proj1 })
        .reply(200, { data: mockResult });

      const result = await issueOps.updateStatusByFingerprint(client, 'abc123', TEST_IDS.proj1, {
        status: 'completed',
        reason: 'Fixed in latest release',
      });

      expect(result.newStatus).toBe('completed');
    });
  });

  describe('get', () => {
    it('should get issue by ID', async () => {
      const issueId = TEST_IDS.issue1;
      const mockIssue = createMockIssue({
        id: issueId,
        title: 'Some bug',
        status: 'open',
      });

      mockValidatedEndpoint(
        BASE_URL,
        'get',
        `/issues/${issueId}`,
        mockIssue,
        IssueResponseSchema
      );

      const issue = await issueOps.get(client, issueId);

      expect(issue.id).toBe(issueId);
      expect(issue.status).toBe('open');
    });
  });

  describe('getDetails', () => {
    it('should get full issue details', async () => {
      const issueId = TEST_IDS.issue2;
      const runId1 = TEST_IDS.run1;
      const runId2 = TEST_IDS.run2;
      const mockDetails = createMockIssueDetails();
      // Override to ensure we get the expected data with valid UUIDs
      mockDetails.occurrences = [
        { ...mockDetails.occurrences[0], runId: runId1 },
        { ...mockDetails.occurrences[0], runId: runId2 },
      ];
      mockDetails.notes = [{ ...mockDetails.notes[0], content: 'Working on it' }];

      mockValidatedEndpoint(
        BASE_URL,
        'get',
        `/issues/${issueId}/details`,
        mockDetails,
        IssueDetailsResponseSchema
      );

      const details = await issueOps.getDetails(client, issueId);

      expect(details.occurrences).toHaveLength(2);
      expect(details.occurrences[0].runId).toBe(runId1);
      expect(details.occurrences[1].runId).toBe(runId2);
      expect(details.notes).toHaveLength(1);
      expect(details.notes[0].content).toBe('Working on it');
      expect(details.issue).toBeDefined();
    });
  });

  describe('getHistory', () => {
    it('should get issue status history', async () => {
      const issueId = '00000000-0000-4000-a000-000000000091';
      const mockHistory = [
        createMockStatusHistory({ from: null, to: 'open', reason: null }),
        createMockStatusHistory({
          from: 'open',
          to: 'completed',
          oldStatus: 'open',
          newStatus: 'completed',
          reason: 'Fixed',
        }),
      ];

      mockValidatedListEndpoint(
        BASE_URL,
        'get',
        `/issues/${issueId}/history`,
        mockHistory,
        StatusHistoryResponseSchema
      );

      const history = await issueOps.getHistory(client, issueId);

      expect(history).toHaveLength(2);
      expect(history[0].from).toBeNull();
      expect(history[0].to).toBe('open');
      expect(history[1].from).toBe('open');
      expect(history[1].to).toBe('completed');
      expect(history[1].reason).toBe('Fixed');
    });
  });

  describe('updateStatus', () => {
    it('should update issue status', async () => {
      const issueId = '00000000-0000-4000-a000-000000000092';
      const mockIssue = createMockIssue({ id: issueId, status: 'completed' });

      nock(BASE_URL)
        .patch(`/issues/${issueId}/status`, {
          status: 'completed',
          reason: 'Fixed in PR #123',
        })
        .reply(200, { data: mockIssue });

      const issue = await issueOps.updateStatus(client, issueId, {
        status: 'completed',
        reason: 'Fixed in PR #123',
      });

      expect(issue.status).toBe('completed');
    });

    it('should update status without reason', async () => {
      const issueId = '00000000-0000-4000-a000-000000000093';
      const mockIssue = createMockIssue({ id: issueId, status: 'wontfix' });

      nock(BASE_URL)
        .patch(`/issues/${issueId}/status`, { status: 'wontfix' })
        .reply(200, { data: mockIssue });

      const issue = await issueOps.updateStatus(client, issueId, {
        status: 'wontfix',
      });

      expect(issue.status).toBe('wontfix');
    });
  });

  describe('update', () => {
    it('should update issue metadata', async () => {
      const issueId = '00000000-0000-4000-a000-000000000094';
      const mockIssue = createMockIssue({
        id: issueId,
        title: 'Updated title',
        severity: 'high',
      });

      nock(BASE_URL)
        .patch(`/issues/${issueId}`, {
          title: 'Updated title',
          severity: 'high',
        })
        .reply(200, { data: mockIssue });

      const issue = await issueOps.update(client, issueId, {
        title: 'Updated title',
        severity: 'high',
      });

      expect(issue.title).toBe('Updated title');
      expect(issue.severity).toBe('high');
    });

    it('should update file location', async () => {
      const issueId = '00000000-0000-4000-a000-000000000095';
      const mockIssue = createMockIssue({
        id: issueId,
        filePath: 'src/new-location.ts',
        lineNumber: 100,
      });

      nock(BASE_URL)
        .patch(`/issues/${issueId}`, {
          filePath: 'src/new-location.ts',
          lineNumber: 100,
        })
        .reply(200, { data: mockIssue });

      const issue = await issueOps.update(client, issueId, {
        filePath: 'src/new-location.ts',
        lineNumber: 100,
      });

      expect(issue.filePath).toBe('src/new-location.ts');
    });
  });

  describe('addNote', () => {
    it('should add note to issue', async () => {
      const issueId = '00000000-0000-4000-a000-000000000096';
      const mockNote = createMockIssueNote({
        content: 'Investigation notes here',
        noteType: 'context',
      });

      nock(BASE_URL)
        .post(`/issues/${issueId}/notes`, {
          content: 'Investigation notes here',
          noteType: 'context',
        })
        .reply(201, { data: mockNote });

      const note = await issueOps.addNote(client, issueId, {
        content: 'Investigation notes here',
        noteType: 'context',
      });

      expect(note.content).toBe('Investigation notes here');
    });

    it('should add resolution note', async () => {
      const issueId = '00000000-0000-4000-a000-000000000097';
      const mockNote = createMockIssueNote({
        content: 'Fixed by updating validation logic',
        noteType: 'resolution',
      });

      nock(BASE_URL)
        .post(`/issues/${issueId}/notes`, {
          content: 'Fixed by updating validation logic',
          noteType: 'resolution',
          createdBy: 'developer@example.com',
        })
        .reply(201, { data: mockNote });

      const note = await issueOps.addNote(client, issueId, {
        content: 'Fixed by updating validation logic',
        noteType: 'resolution',
        createdBy: 'developer@example.com',
      });

      expect(note.noteType).toBe('resolution');
    });
  });

  describe('restore', () => {
    it('should restore deleted issue', async () => {
      const issueId = '00000000-0000-4000-a000-000000000098';
      const mockIssue = createMockIssue({ id: issueId, status: 'open', deletedAt: null });

      mockValidatedEndpoint(BASE_URL, 'post', `/issues/${issueId}/restore`, mockIssue, IssueResponseSchema);

      const issue = await issueOps.restore(client, issueId);

      expect(issue.deletedAt).toBeNull();
    });
  });

  describe('undoLastChange', () => {
    it('should undo last status change', async () => {
      const issueId = '00000000-0000-4000-a000-000000000099';
      const mockIssue = createMockIssue({ id: issueId, status: 'open' });

      mockValidatedEndpoint(BASE_URL, 'post', `/issues/${issueId}/undo`, mockIssue, IssueResponseSchema);

      const issue = await issueOps.undoLastChange(client, issueId);

      expect(issue.status).toBe('open');
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should bulk update issue statuses', async () => {
      const issueId1 = TEST_IDS.issue1;
      const issueId2 = TEST_IDS.issue2;

      nock(BASE_URL)
        .post('/issues/bulk-status', {
          updates: [
            { issueId: issueId1, status: 'completed', reason: 'Fixed' },
            { issueId: issueId2, status: 'wontfix', reason: 'By design' },
          ],
        })
        .reply(200, { data: { updated: 2, failed: [] } });

      const result = await issueOps.bulkUpdateStatus(client, [
        { issueId: issueId1, status: 'completed', reason: 'Fixed' },
        { issueId: issueId2, status: 'wontfix', reason: 'By design' },
      ]);

      expect(result.updated).toBe(2);
      expect(result.failed).toHaveLength(0);
    });
  });

  describe('listByProject', () => {
    it('should list issues in a project', async () => {
      const mockIssues = [
        createMockIssue({ title: 'Bug 1' }),
        createMockIssue({ title: 'Bug 2' }),
      ];

      mockValidatedListEndpoint(
        BASE_URL,
        'get',
        `/projects/${TEST_IDS.proj1}/issues`,
        mockIssues,
        IssueResponseSchema
      );

      const issues = await issueOps.listByProject(client, TEST_IDS.proj1);

      expect(issues).toHaveLength(2);
      expect(issues[0].title).toBe('Bug 1');
      expect(issues[1].title).toBe('Bug 2');
    });

    it('should list issues with filters', async () => {
      const mockIssues = [
        createMockIssue({
          title: 'Critical semantic issue',
          priority: 'critical',
          failureDomain: 'SEM',
        }),
      ];

      nock(BASE_URL)
        .get(`/projects/${TEST_IDS.proj1}/issues`)
        .query({
          status: 'open',
          priority: 'critical',
          failure_domain: 'SEM',
          limit: 10,
        })
        .reply(200, { data: mockIssues });

      const issues = await issueOps.listByProject(client, TEST_IDS.proj1, {
        status: 'open',
        priority: 'critical',
        failureDomain: 'SEM',
        limit: 10,
      });

      expect(issues).toHaveLength(1);
    });
  });
});
