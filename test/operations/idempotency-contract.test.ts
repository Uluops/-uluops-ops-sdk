import { describe, it, expect } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import { save } from '../../src/operations/runs.js';
import { UnsupportedContractError } from '../../src/errors/errors.js';
import { createMockRun } from '../contract-helpers.js';
import { BASE_URL, TEST_API_KEY } from '../setup.js';

const client = () => new OpsHttpClient({ baseUrl: BASE_URL, apiKey: TEST_API_KEY });
const input = { project: 'f20', workflowType: 'explore', agents: [{ name: 'explorer', score: 80, decision: 'OBSERVED' }], recommendations: [] };
const response = () => ({ data: { run: createMockRun(), agents: [], correlation: null, deduplicated: true } });

describe('F20 contract negotiation', () => {
  it('negotiates v2, forwards the selector and preserves replay metadata', async () => {
    const idempotency = { contract: 'report-v2', replayed: true, comparison: 'matched', excludedFields: [] };
    const scope = nock(BASE_URL).get('/capabilities').reply(200, { contracts: { idempotency: ['legacy-v1', 'report-v2'] } })
      .post('/runs', body => body.idempotencyContract === 'report-v2' && body.rawMarkdown === null)
      .reply(200, { data: { ...response().data, idempotency } });
    expect((await save(client(), { ...input, rawMarkdown: null, idempotencyContract: 'report-v2' })).idempotency).toEqual(idempotency);
    expect(scope.isDone()).toBe(true);
  });

  it.each([[404, { error: { code: 'NOT_FOUND', message: 'Not found' } }], [200, {}], [200, { contracts: { idempotency: ['legacy-v1'] } }]])
  ('refuses unsupported capability status %s before POST even with validation bypass', async (status, body) => {
    const scope = nock(BASE_URL).get('/capabilities').reply(status as number, body);
    await expect(save(client(), { ...input, idempotencyContract: 'report-v2' }, { _skipClientValidation: true }))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_CONTRACT', applicationState: 'not_applied' });
    expect(scope.isDone()).toBe(true);
  });

  it.each([[401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [404, 'ORG_NOT_FOUND']])
  ('preserves authorization failure %s/%s', async (status, code) => {
    nock(BASE_URL).get('/capabilities').reply(status, { error: { code, message: 'Scope unavailable' } });
    try {
      await save(client(), { ...input, idempotencyContract: 'report-v2' });
      expect.fail('Expected refusal');
    } catch (error) {
      expect(error).not.toBeInstanceOf(UnsupportedContractError);
      expect(error).toMatchObject({ statusCode: status, code });
    }
  });

  it('retains the same default key namespace and legacy default without capability calls', async () => {
    const keys: string[] = [];
    const scope = nock(BASE_URL).post('/runs', body => { keys.push(body.idempotencyKey); return !('idempotencyContract' in body); }).reply(200, response())
      .post('/runs', body => { keys.push(body.idempotencyKey); return body.idempotencyContract === 'legacy-v1'; }).reply(200, response())
      .get('/capabilities').reply(200, { contracts: { idempotency: ['report-v2'] } })
      .post('/runs', body => { keys.push(body.idempotencyKey); return body.idempotencyContract === 'report-v2'; }).reply(200, response());
    expect((await save(client(), input)).idempotency).toBeUndefined();
    await save(client(), { ...input, idempotencyContract: 'legacy-v1' });
    await save(client(), { ...input, idempotencyContract: 'report-v2' });
    expect(new Set(keys).size).toBe(1);
    expect(scope.isDone()).toBe(true);
  });

  it('does not reuse capabilities between scoped operation chains', async () => {
    const http = client();
    nock(BASE_URL).get('/capabilities').reply(200, { contracts: { idempotency: ['report-v2'] } })
      .post('/runs').reply(200, response())
      .get('/capabilities').reply(200, { contracts: {} });
    await save(http, { ...input, idempotencyContract: 'report-v2' });
    await expect(save(http, { ...input, idempotencyContract: 'report-v2' })).rejects.toBeInstanceOf(UnsupportedContractError);
  });
});
