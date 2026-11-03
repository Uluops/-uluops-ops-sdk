/**
 * T14 — ops-uluops-api analysis-never-loses-the-run spec v0.2.3, phase R3.
 *
 * Since ops-api R2 the server judges analysis per agent: an invalid entry costs
 * that agent's analysis, reported in `analysisWrite.rejected`, and the run is
 * kept. Until 7.3.0 the SDK judged every entry first, so the same payload threw
 * `InputValidationError` before any request and no run existed — the whole-run
 * loss R2 removed on the server, re-created on the client (spec review run #1,
 * C1/A1). The save and validate paths now check the envelope only: arrays,
 * objects, and the count caps.
 *
 * Every test goes through the public operation, with nock at the HTTP boundary,
 * and asserts on the body the server RECEIVED: "did not throw" alone would pass
 * on an SDK that silently dropped the bad entry.
 *
 * Negative control: on 7.2.0 (d027295) every "reaches the server" case throws
 * `InputValidationError` and nock records no request.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as runOps from '../../src/operations/runs.js';
import { InputValidationError } from '../../src/errors/index.js';
import { BASE_URL, TEST_API_KEY } from '../setup.js';
import { createMockRun, createMockAgentSnapshot, resetMockIds } from '../contract-helpers.js';

const base = {
  project: 'my-project',
  workflowType: 'post-implementation',
  agents: [{ name: 'agent-a', score: 80, decision: 'PASS' }, { name: 'agent-b', score: 80, decision: 'PASS' }],
  recommendations: [],
};
const goodRecord = { agentName: 'agent-b', recordType: 'finding', recordId: 'b-1', title: 'kept', data: { n: 1 } };

// Entries 7.2.0 refused client-side. Each is something the server judges per agent.
const BAD_RECORDS: Array<[string, Record<string, unknown>]> = [
  ['recordId missing', { agentName: 'agent-a', recordType: 'finding', title: 't', data: {} }],
  ['empty agentName (server A4: counts as absent)', { agentName: '', recordType: 'finding', recordId: 'a-1', title: 't', data: {} }],
  ['agentName over 100 characters', { agentName: 'a'.repeat(101), recordType: 'finding', recordId: 'a-1', title: 't', data: {} }],
  ['unknown agentType', { agentName: 'agent-a', agentType: 'guess', recordType: 'finding', recordId: 'a-1', title: 't', data: {} }],
  ['title over 500 characters', { agentName: 'agent-a', recordType: 'finding', recordId: 'a-1', title: 't'.repeat(501), data: {} }],
  ['data not an object', { agentName: 'agent-a', recordType: 'finding', recordId: 'a-1', title: 't', data: 'oops' }],
];
const BAD_SUMMARY = { agentName: 'agent-a', score: 80 }; // decision missing

const REJECTED_A = {
  agentName: 'agent-a',
  reason: 'entry_invalid',
  recordsRejected: 1,
  summariesRejected: 0,
  detail: { issues: [{ array: 'records', index: 0, path: ['recordId'], code: 'invalid_type', message: 'Required' }], issuesTotal: 1 },
};

function saveReply() {
  const run = createMockRun({ runNumber: 3 });
  return {
    data: { run, agents: [createMockAgentSnapshot({ runId: run.id })], correlation: { newIssues: 0, recurringIssues: 0, regressions: 0 }, deduplicated: false },
    analysisWrite: { recordMode: 'initial', supersededRecords: 0, supersededSummaries: 0, createdRecords: 1, createdSummaries: 0, rejected: [REJECTED_A] },
  };
}

describe('T14: save and validate send invalid analysis entries to the server (spec R3)', () => {
  let client: OpsHttpClient;
  let sent: Record<string, unknown> | undefined;

  beforeEach(() => {
    resetMockIds();
    sent = undefined;
    client = new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
  });
  afterEach(() => nock.cleanAll());

  it.each(BAD_RECORDS)('save: %s reaches the server and the result carries rejected', async (_label, bad) => {
    nock(BASE_URL).post('/runs', (body: Record<string, unknown>) => { sent = body; return true; }).reply(201, saveReply());
    const result = await runOps.save(client, { ...base, analysisRecords: [bad, goodRecord] } as never);
    // The server saw both entries, the bad one byte-for-byte: nothing dropped or repaired.
    expect(sent?.['analysisRecords']).toEqual([bad, goodRecord]);
    expect(result.analysisWrite?.rejected).toEqual([REJECTED_A]);
  });

  it('save: a summary missing its decision reaches the server', async () => {
    nock(BASE_URL).post('/runs', (body: Record<string, unknown>) => { sent = body; return true; }).reply(201, saveReply());
    await runOps.save(client, { ...base, analysisSummary: [BAD_SUMMARY, { agentName: 'agent-b', decision: 'PASS' }] } as never);
    expect(sent?.['analysisSummary']).toEqual([BAD_SUMMARY, { agentName: 'agent-b', decision: 'PASS' }]);
  });

  it('save: the single-object summary form with an invalid body reaches the server', async () => {
    nock(BASE_URL).post('/runs', (body: Record<string, unknown>) => { sent = body; return true; }).reply(201, saveReply());
    await runOps.save(client, { ...base, analysisSummary: BAD_SUMMARY } as never);
    expect(sent?.['analysisSummary']).toEqual(BAD_SUMMARY);
  });

  it('validate: an invalid entry reaches /runs/validate, so the server can predict wouldReject', async () => {
    nock(BASE_URL).post('/runs/validate', (body: Record<string, unknown>) => { sent = body; return true; }).reply(200, {
      data: {
        wouldCreate: 0, wouldUpdate: 0, wouldRegress: 0, validationErrors: [],
        preview: { newIssues: [], recurringIssues: [], regressions: [] },
        wouldReject: [REJECTED_A],
      },
    });
    const result = await runOps.validate(client, { ...base, analysisRecords: [BAD_RECORDS[0]![1], goodRecord] } as never);
    expect(sent?.['analysisRecords']).toEqual([BAD_RECORDS[0]![1], goodRecord]);
    expect(result.wouldReject).toEqual([REJECTED_A]);
  });

  // The envelope is still the client's: these are 400s on the server too (spec §3.4),
  // and they must fail before a request so the run is not created half-understood.
  describe('the envelope is still checked client-side', () => {
    const entries = (n: number) => Array.from({ length: n }, (_v, i) => ({ ...goodRecord, recordId: `r-${String(i)}` }));
    it.each([
      ['101 records', { analysisRecords: entries(101) }],
      ['21 summaries', { analysisSummary: Array.from({ length: 21 }, () => ({ decision: 'PASS' })) }],
      ['records not an array', { analysisRecords: { recordId: 'x' } }],
      ['a record that is not an object', { analysisRecords: ['finding'] }],
      ['a summary that is not an object', { analysisSummary: [42] }],
    ])('%s throws InputValidationError and sends nothing', async (_label, analysis) => {
      const scope = nock(BASE_URL).post('/runs').reply(201, saveReply());
      await expect(runOps.save(client, { ...base, ...analysis } as never)).rejects.toBeInstanceOf(InputValidationError);
      expect(scope.isDone()).toBe(false);
    });

    it('100 records pass (the cap is inclusive)', async () => {
      nock(BASE_URL).post('/runs').reply(201, saveReply());
      await expect(runOps.save(client, { ...base, analysisRecords: entries(100) })).resolves.toBeDefined();
    });
  });

  // The update path stays strict (spec §3.7, ruling 3): an update creates no run, so
  // refusing the request loses nothing already stored.
  it('update: an invalid entry still throws InputValidationError before any request', async () => {
    const scope = nock(BASE_URL).patch(/\/runs/).reply(200, {});
    await expect(runOps.update(client, { project: 'my-project', runNumber: 3, analysisRecords: [BAD_RECORDS[0]![1]] } as never))
      .rejects.toBeInstanceOf(InputValidationError);
    expect(scope.isDone()).toBe(false);
  });
});
