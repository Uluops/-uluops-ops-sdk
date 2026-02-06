import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as issueOps from '../../src/operations/issues.js';
import {
  BASE_URL,
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
  IssueDetailsResponseSchema,
  IssueNoteResponseSchema,
  StatusHistoryResponseSchema,
  StatusUpdateResultResponseSchema,
  BulkStatusUpdateResultResponseSchema,
} from '../contract-helpers.js';

describe('Issue Operations', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: 'ulr_test-api-key-12345',
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
          project: 'proj-1',
          title: 'Manual bug report',
          priority: 'critical',
        })
        .reply(201, { data: mockIssue });

      const issue = await issueOps.create(client, {
        project: 'proj-1',
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
            body.project === 'proj-1' &&
            body.title === 'Security vulnerability' &&
            body.severity === 'critical' &&
            body.failureCode === 'SEM-VAL/C' &&
            body.filePath === 'src/auth.ts'
          );
        })
        .reply(201, { data: mockIssue });

      const issue = await issueOps.create(client, {
        project: 'proj-1',
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
    });

    it('should search with filters', async () => {
      const mockIssues = [createMockIssue({ title: 'Critical bug' })];

      nock(BASE_URL)
        .get('/issues/search')
        .query({
          query: 'bug',
          projects: 'proj-1,proj-2',
          status: 'open',
          priority: 'critical',
        })
        .reply(200, { data: mockIssues });

      const issues = await issueOps.search(client, {
        query: 'bug',
        projects: ['proj-1', 'proj-2'],
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
        .query({ project: 'proj-1' })
        .reply(200, { data: mockIssue });

      const issue = await issueOps.getByFingerprint(client, 'abc123def456', 'proj-1');

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
        .query({ project: 'proj-1' })
        .reply(200, { data: mockResult });

      const result = await issueOps.updateStatusByFingerprint(client, 'abc123', 'proj-1', {
        status: 'completed',
        reason: 'Fixed in latest release',
      });

      expect(result.newStatus).toBe('completed');
    });
  });

  describe('get', () => {
    it('should get issue by ID', async () => {
      const issueId = '11111111-1111-1111-1111-111111111111';
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
      const issueId = '22222222-2222-2222-2222-222222222222';
      const runId1 = '33333333-3333-3333-3333-333333333331';
      const runId2 = '33333333-3333-3333-3333-333333333332';
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
      expect(details.notes).toHaveLength(1);
    });
  });

  describe('getHistory', () => {
    it('should get issue status history', async () => {
      const issueId = '99999999-9999-9999-9999-999999999991';
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
      expect(history[1].to).toBe('completed');
    });
  });

  describe('updateStatus', () => {
    it('should update issue status', async () => {
      const issueId = '44444444-4444-4444-4444-444444444441';
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
      const issueId = '44444444-4444-4444-4444-444444444442';
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

  describe('edit', () => {
    it('should edit issue metadata', async () => {
      const issueId = '55555555-5555-5555-5555-555555555551';
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

      const issue = await issueOps.edit(client, issueId, {
        title: 'Updated title',
        severity: 'high',
      });

      expect(issue.title).toBe('Updated title');
      expect(issue.severity).toBe('high');
    });

    it('should update file location', async () => {
      const issueId = '55555555-5555-5555-5555-555555555552';
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

      const issue = await issueOps.edit(client, issueId, {
        filePath: 'src/new-location.ts',
        lineNumber: 100,
      });

      expect(issue.filePath).toBe('src/new-location.ts');
    });
  });

  describe('addNote', () => {
    it('should add note to issue', async () => {
      const issueId = '66666666-6666-6666-6666-666666666661';
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
      const issueId = '66666666-6666-6666-6666-666666666662';
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
      const issueId = '77777777-7777-7777-7777-777777777771';
      const mockIssue = createMockIssue({ id: issueId, status: 'open', deletedAt: null });

      mockValidatedEndpoint(BASE_URL, 'post', `/issues/${issueId}/restore`, mockIssue, IssueResponseSchema);

      const issue = await issueOps.restore(client, issueId);

      expect(issue.deletedAt).toBeNull();
    });
  });

  describe('undoLastChange', () => {
    it('should undo last status change', async () => {
      const issueId = '88888888-8888-8888-8888-888888888881';
      const mockIssue = createMockIssue({ id: issueId, status: 'open' });

      mockValidatedEndpoint(BASE_URL, 'post', `/issues/${issueId}/undo`, mockIssue, IssueResponseSchema);

      const issue = await issueOps.undoLastChange(client, issueId);

      expect(issue.status).toBe('open');
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should bulk update issue statuses', async () => {
      const issueId1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const issueId2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const mockResults = [
        createMockBulkStatusUpdateResult({ issueId: issueId1, success: true }),
        createMockBulkStatusUpdateResult({ issueId: issueId2, success: true }),
      ];

      nock(BASE_URL)
        .post('/issues/bulk-status', {
          updates: [
            { issueId: issueId1, status: 'completed', reason: 'Fixed' },
            { issueId: issueId2, status: 'wontfix', reason: 'By design' },
          ],
        })
        .reply(200, { data: mockResults });

      const results = await issueOps.bulkUpdateStatus(client, [
        { issueId: issueId1, status: 'completed', reason: 'Fixed' },
        { issueId: issueId2, status: 'wontfix', reason: 'By design' },
      ]);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
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
        '/projects/proj-1/issues',
        mockIssues,
        IssueResponseSchema
      );

      const issues = await issueOps.listByProject(client, 'proj-1');

      expect(issues).toHaveLength(2);
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
        .get('/projects/proj-1/issues')
        .query({
          status: 'open',
          priority: 'critical',
          failureDomain: 'SEM',
          limit: 10,
        })
        .reply(200, { data: mockIssues });

      const issues = await issueOps.listByProject(client, 'proj-1', {
        status: 'open',
        priority: 'critical',
        failureDomain: 'SEM',
        limit: 10,
      });

      expect(issues).toHaveLength(1);
    });
  });
});
