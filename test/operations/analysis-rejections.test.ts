/**
 * T13 — ops-uluops-api analysis-never-loses-the-run spec v0.2.2, phase R1.
 *
 * The server (R2) will keep the run and reject a bad agent's analysis,
 * reporting it as `analysisWrite.rejected[]` on save, `wouldReject[]` on
 * validate, and `rejections[]` / `rejectionsTotal` on GET /runs/:id/analysis.
 * `z.object()` strips undeclared keys, so an SDK that does not declare them
 * hands callers a response with the rejection silently removed. R1 declares
 * them before R2 ships.
 *
 * Every test goes through the public operation (nock at the HTTP boundary),
 * so it exercises the schema the operation really parses with. Negative
 * control: against 7.1.0 (c433418) the keep-tests fail, because the fields
 * come back undefined.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as runOps from '../../src/operations/runs.js';
import { BASE_URL, TEST_API_KEY } from '../setup.js';
import { createMockRun, createMockAgentSnapshot, resetMockIds } from '../contract-helpers.js';

const ENTRY_INVALID = {
  agentName: 'code-validator',
  reason: 'entry_invalid',
  recordsRejected: 3,
  summariesRejected: 1,
  detail: {
    issues: [{ array: 'records', index: 2, path: ['recordId'], code: 'too_small', message: 'Too small' }],
    issuesTotal: 1,
  },
};

// A reason this SDK has never seen (spec review A9): it must parse, not throw.
const UNSEEN_REASON = {
  agentName: 'security-analyst',
  reason: 'reason_added_after_this_sdk',
  recordsRejected: 0,
  summariesRejected: 1,
  detail: {},
};

// The folded row past the server's 20-row cap (spec v0.2.2): its own reason,
// null agent, count-shaped detail.
const FOLDED = {
  agentName: null,
  reason: 'units_omitted',
  recordsRejected: 40,
  summariesRejected: 5,
  detail: { unitsOmitted: 5, recordsRejected: 40, summariesRejected: 5 },
};

const REJECTED = [ENTRY_INVALID, UNSEEN_REASON, FOLDED];

const ANALYSIS_INPUT = {
  project: 'my-project',
  workflowType: 'post-implementation',
  agents: [{ name: 'code-validator', score: 85, decision: 'PASS' }],
  recommendations: [],
  analysisRecords: [{ recordType: 'finding', recordId: 'f-1', title: 'A finding', data: { note: 'x' } }],
};

function echo(rejected?: unknown[]) {
  return {
    recordMode: 'initial',
    supersededRecords: 0,
    supersededSummaries: 0,
    createdRecords: 1,
    createdSummaries: 0,
    ...(rejected === undefined ? {} : { rejected }),
  };
}

function saveReply(analysisWrite: unknown, deduplicated = false) {
  const run = createMockRun({ runNumber: 7 });
  return {
    data: {
      run,
      agents: [createMockAgentSnapshot({ runId: run.id })],
      correlation: { newIssues: 0, recurringIssues: 0, regressions: 0 },
      deduplicated,
    },
    analysisWrite,
  };
}

describe('T13: analysis rejections survive the SDK parse (spec R1)', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    resetMockIds();
    client = new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
  });

  it('save keeps analysisWrite.rejected, including an unseen reason and the folded row', async () => {
    nock(BASE_URL).post('/runs').reply(201, saveReply(echo(REJECTED)));
    const result = await runOps.save(client, ANALYSIS_INPUT);
    expect(result.analysisWrite?.rejected).toHaveLength(3);
    expect(result.analysisWrite?.rejected).toEqual(REJECTED);
  });

  it('a deduplicated replay keeps the rejected[] rebuilt from storage', async () => {
    nock(BASE_URL).post('/runs').reply(200, saveReply(echo([ENTRY_INVALID]), true));
    const result = await runOps.save(client, ANALYSIS_INPUT);
    expect(result.deduplicated).toBe(true);
    expect(result.analysisWrite?.rejected).toEqual([ENTRY_INVALID]);
  });

  it('validate keeps wouldReject[]', async () => {
    nock(BASE_URL).post('/runs/validate').reply(200, {
      data: {
        wouldCreate: 0,
        wouldUpdate: 0,
        wouldRegress: 0,
        validationErrors: [],
        preview: { newIssues: [], recurringIssues: [], regressions: [] },
        wouldReject: [ENTRY_INVALID],
      },
    });
    const result = await runOps.validate(client, ANALYSIS_INPUT);
    expect(result.wouldReject).toEqual([ENTRY_INVALID]);
  });

  it('validate reads the prediction from wouldReject, not from a past-tense rejected key (spec v0.2.2)', async () => {
    nock(BASE_URL).post('/runs/validate').reply(200, {
      data: {
        wouldCreate: 0,
        wouldUpdate: 0,
        wouldRegress: 0,
        validationErrors: [],
        preview: { newIssues: [], recurringIssues: [], regressions: [] },
        rejected: [ENTRY_INVALID],
      },
    });
    const result = await runOps.validate(client, ANALYSIS_INPUT);
    expect(result.wouldReject).toBeUndefined();
    expect(result).not.toHaveProperty('rejected');
  });

  it('getAnalysis keeps rejections[] (with createdAt) and rejectionsTotal', async () => {
    const runId = '3f1d3f1d-0000-4000-8000-0000000000aa';
    const stored = REJECTED.map(r => ({ ...r, createdAt: '2026-11-03T01:00:00.000Z' }));
    nock(BASE_URL).get(`/runs/${runId}/analysis`).reply(200, {
      data: { records: [], summaries: [], recordsTotal: 0, summariesTotal: 0, rejections: stored, rejectionsTotal: 3 },
    });
    const result = await runOps.getAnalysis(client, runId);
    expect(result.rejectionsTotal).toBe(3);
    expect(result.rejections).toEqual(stored);
  });

  describe('servers before R2 still parse', () => {
    it('save without rejected[]', async () => {
      nock(BASE_URL).post('/runs').reply(201, saveReply(echo()));
      const result = await runOps.save(client, ANALYSIS_INPUT);
      expect(result.analysisWrite?.createdRecords).toBe(1);
      expect(result.analysisWrite?.rejected).toBeUndefined();
    });

    it('getAnalysis without rejections', async () => {
      const runId = '3f1d3f1d-0000-4000-8000-0000000000ab';
      nock(BASE_URL).get(`/runs/${runId}/analysis`).reply(200, {
        data: { records: [], summaries: [], recordsTotal: 0, summariesTotal: 0 },
      });
      const result = await runOps.getAnalysis(client, runId);
      expect(result.rejections).toBeUndefined();
      expect(result.rejectionsTotal).toBeUndefined();
    });
  });

  // The instrument can fail: the item schema checks its fields rather than
  // accepting anything, so a malformed rejection is a parse error, not data.
  describe('controls: a malformed rejection is refused', () => {
    it.each([
      ['reason missing', { ...ENTRY_INVALID, reason: undefined }],
      ['reason not a string', { ...ENTRY_INVALID, reason: 3 }],
      ['negative count', { ...ENTRY_INVALID, recordsRejected: -1 }],
      ['detail not an object', { ...ENTRY_INVALID, detail: 'bad' }],
    ])('%s', async (_label, bad) => {
      nock(BASE_URL).post('/runs').reply(201, saveReply(echo([bad])));
      await expect(runOps.save(client, ANALYSIS_INPUT)).rejects.toThrow();
    });
  });
});
