import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as issueOps from '../../src/operations/issues.js';
import { BASE_URL } from '../setup.js';

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
      nock(BASE_URL)
        .post('/issues', {
          project: 'proj-1',
          title: 'Manual bug report',
          priority: 'critical',
        })
        .reply(201, {
          data: {
            id: 'issue-1',
            title: 'Manual bug report',
            priority: 'critical',
            validator: 'user-submitted',
          },
        });

      const issue = await issueOps.create(client, {
        project: 'proj-1',
        title: 'Manual bug report',
        priority: 'critical',
      });

      expect(issue.title).toBe('Manual bug report');
      expect(issue.priority).toBe('critical');
    });

    it('should create issue with full metadata', async () => {
      nock(BASE_URL)
        .post('/issues', (body) => {
          return (
            body.project === 'proj-1' &&
            body.title === 'Security vulnerability' &&
            body.severity === 'critical' &&
            body.failure_code === 'SEM-VAL/C' &&
            body.file_path === 'src/auth.ts'
          );
        })
        .reply(201, {
          data: {
            id: 'issue-2',
            title: 'Security vulnerability',
            severity: 'critical',
          },
        });

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
      nock(BASE_URL)
        .get('/issues/search')
        .query({ query: 'authentication' })
        .reply(200, {
          data: [
            { id: 'issue-1', title: 'Auth token validation' },
            { id: 'issue-2', title: 'Authentication flow bug' },
          ],
        });

      const issues = await issueOps.search(client, { query: 'authentication' });

      expect(issues).toHaveLength(2);
    });

    it('should search with filters', async () => {
      nock(BASE_URL)
        .get('/issues/search')
        .query({
          query: 'bug',
          projects: 'proj-1,proj-2',
          status: 'open',
          priority: 'critical',
        })
        .reply(200, {
          data: [{ id: 'issue-1', title: 'Critical bug' }],
        });

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
      nock(BASE_URL)
        .get('/issues/by-fingerprint/abc123def456')
        .query({ project: 'proj-1' })
        .reply(200, {
          data: {
            id: 'issue-1',
            fingerprint: 'abc123def456',
            title: 'Found issue',
          },
        });

      const issue = await issueOps.getByFingerprint(client, 'abc123def456', 'proj-1');

      expect(issue.fingerprint).toBe('abc123def456');
    });
  });

  describe('updateStatusByFingerprint', () => {
    it('should update status by fingerprint', async () => {
      nock(BASE_URL)
        .patch('/issues/by-fingerprint/abc123/status')
        .query({ project: 'proj-1' })
        .reply(200, {
          data: { issueId: 'issue-1', previousStatus: 'open', newStatus: 'completed' },
        });

      const result = await issueOps.updateStatusByFingerprint(
        client,
        'abc123',
        'proj-1',
        { status: 'completed', reason: 'Fixed in latest release' }
      );

      expect(result.newStatus).toBe('completed');
    });
  });

  describe('get', () => {
    it('should get issue by ID', async () => {
      nock(BASE_URL)
        .get('/issues/issue-uuid-123')
        .reply(200, {
          data: { id: 'issue-uuid-123', title: 'Some bug', status: 'open' },
        });

      const issue = await issueOps.get(client, 'issue-uuid-123');

      expect(issue.id).toBe('issue-uuid-123');
      expect(issue.status).toBe('open');
    });
  });

  describe('getDetails', () => {
    it('should get full issue details', async () => {
      nock(BASE_URL)
        .get('/issues/issue-1/details')
        .reply(200, {
          data: {
            issue: { id: 'issue-1', title: 'Bug' },
            occurrences: [
              { runId: 'run-1', timestamp: '2024-01-01' },
              { runId: 'run-5', timestamp: '2024-01-05' },
            ],
            notes: [{ id: 'note-1', content: 'Working on it' }],
            statusHistory: [
              { from: null, to: 'open', timestamp: '2024-01-01' },
            ],
          },
        });

      const details = await issueOps.getDetails(client, 'issue-1');

      expect(details.occurrences).toHaveLength(2);
      expect(details.notes).toHaveLength(1);
    });
  });

  describe('getHistory', () => {
    it('should get issue status history', async () => {
      nock(BASE_URL)
        .get('/issues/issue-1/history')
        .reply(200, {
          data: [
            { from: null, to: 'open', timestamp: '2024-01-01', reason: null },
            { from: 'open', to: 'completed', timestamp: '2024-01-10', reason: 'Fixed' },
          ],
        });

      const history = await issueOps.getHistory(client, 'issue-1');

      expect(history).toHaveLength(2);
      expect(history[1].to).toBe('completed');
    });
  });

  describe('updateStatus', () => {
    it('should update issue status', async () => {
      nock(BASE_URL)
        .patch('/issues/issue-1/status', {
          status: 'completed',
          reason: 'Fixed in PR #123',
        })
        .reply(200, {
          data: { id: 'issue-1', status: 'completed' },
        });

      const issue = await issueOps.updateStatus(client, 'issue-1', {
        status: 'completed',
        reason: 'Fixed in PR #123',
      });

      expect(issue.status).toBe('completed');
    });

    it('should update status without reason', async () => {
      nock(BASE_URL)
        .patch('/issues/issue-1/status', { status: 'wontfix' })
        .reply(200, {
          data: { id: 'issue-1', status: 'wontfix' },
        });

      const issue = await issueOps.updateStatus(client, 'issue-1', {
        status: 'wontfix',
      });

      expect(issue.status).toBe('wontfix');
    });
  });

  describe('edit', () => {
    it('should edit issue metadata', async () => {
      nock(BASE_URL)
        .patch('/issues/issue-1', {
          title: 'Updated title',
          severity: 'high',
        })
        .reply(200, {
          data: { id: 'issue-1', title: 'Updated title', severity: 'high' },
        });

      const issue = await issueOps.edit(client, 'issue-1', {
        title: 'Updated title',
        severity: 'high',
      });

      expect(issue.title).toBe('Updated title');
      expect(issue.severity).toBe('high');
    });

    it('should update file location', async () => {
      nock(BASE_URL)
        .patch('/issues/issue-1', {
          file_path: 'src/new-location.ts',
          line_number: 100,
        })
        .reply(200, {
          data: { id: 'issue-1', filePath: 'src/new-location.ts', lineNumber: 100 },
        });

      const issue = await issueOps.edit(client, 'issue-1', {
        filePath: 'src/new-location.ts',
        lineNumber: 100,
      });

      expect(issue.filePath).toBe('src/new-location.ts');
    });
  });

  describe('addNote', () => {
    it('should add note to issue', async () => {
      nock(BASE_URL)
        .post('/issues/issue-1/notes', {
          content: 'Investigation notes here',
          note_type: 'context',
        })
        .reply(201, {
          data: {
            id: 'note-1',
            content: 'Investigation notes here',
            noteType: 'context',
            createdAt: '2024-01-15',
          },
        });

      const note = await issueOps.addNote(client, 'issue-1', {
        content: 'Investigation notes here',
        noteType: 'context',
      });

      expect(note.content).toBe('Investigation notes here');
    });

    it('should add resolution note', async () => {
      nock(BASE_URL)
        .post('/issues/issue-1/notes', {
          content: 'Fixed by updating validation logic',
          note_type: 'resolution',
          created_by: 'developer@example.com',
        })
        .reply(201, {
          data: {
            id: 'note-2',
            content: 'Fixed by updating validation logic',
            noteType: 'resolution',
          },
        });

      const note = await issueOps.addNote(client, 'issue-1', {
        content: 'Fixed by updating validation logic',
        noteType: 'resolution',
        createdBy: 'developer@example.com',
      });

      expect(note.noteType).toBe('resolution');
    });
  });

  describe('restore', () => {
    it('should restore deleted issue', async () => {
      nock(BASE_URL)
        .post('/issues/issue-1/restore')
        .reply(200, {
          data: { id: 'issue-1', status: 'open', deletedAt: null },
        });

      const issue = await issueOps.restore(client, 'issue-1');

      expect(issue.deletedAt).toBeNull();
    });
  });

  describe('undoLastChange', () => {
    it('should undo last status change', async () => {
      nock(BASE_URL)
        .post('/issues/issue-1/undo')
        .reply(200, {
          data: { id: 'issue-1', status: 'open' },
        });

      const issue = await issueOps.undoLastChange(client, 'issue-1');

      expect(issue.status).toBe('open');
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should bulk update issue statuses', async () => {
      nock(BASE_URL)
        .post('/issues/bulk-status', {
          updates: [
            { issue_id: 'issue-1', status: 'completed', reason: 'Fixed' },
            { issue_id: 'issue-2', status: 'wontfix', reason: 'By design' },
          ],
        })
        .reply(200, {
          data: [
            { issueId: 'issue-1', success: true },
            { issueId: 'issue-2', success: true },
          ],
        });

      const results = await issueOps.bulkUpdateStatus(client, [
        { issueId: 'issue-1', status: 'completed', reason: 'Fixed' },
        { issueId: 'issue-2', status: 'wontfix', reason: 'By design' },
      ]);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe('listByProject', () => {
    it('should list issues in a project', async () => {
      nock(BASE_URL)
        .get('/issues/project/proj-1')
        .reply(200, {
          data: [
            { id: 'issue-1', title: 'Bug 1' },
            { id: 'issue-2', title: 'Bug 2' },
          ],
        });

      const issues = await issueOps.listByProject(client, 'proj-1');

      expect(issues).toHaveLength(2);
    });

    it('should list issues with filters', async () => {
      nock(BASE_URL)
        .get('/issues/project/proj-1')
        .query({
          status: 'open',
          priority: 'critical',
          failure_domain: 'SEM',
          limit: 10,
        })
        .reply(200, {
          data: [{ id: 'issue-1', title: 'Critical semantic issue' }],
        });

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
