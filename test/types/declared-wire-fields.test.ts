/**
 * 6.14.0 — fields the ops-api strip guard found the SDK dropping (tracker a6cc132a).
 *
 * The values below are copied from LIVE wire bodies captured by the guard on 2026-10-03
 * (ops-api contract suite against a built server), not derived from these schemas — a
 * fixture built from the schema it validates agrees with it by construction (see the
 * RegisterResponseSchema history in response-schemas.ts). Each case asserts the field
 * SURVIVES the parse with its value; 6.13.0 parsed every one of these and dropped the key.
 */
import { describe, it, expect } from 'vitest';
import {
  AuthUserResponseSchema,
  RunWriteEchoResponseSchema,
  CorrelationResultResponseSchema,
  OccurrenceResponseSchema,
  TaxonomyResponseSchema,
} from '../../src/types/response-schemas.js';

const T = '2026-10-03T02:00:00.000Z';
const U = '11111111-1111-4111-8111-111111111111';

describe('6.14.0: fields that survived the wire but not the parse', () => {
  it('AuthUser keeps requiresReattestation and usernameConfirmed (/auth/me, /auth/register user)', () => {
    const wire = { id: U, email: 'c@ci.uluops.local', role: 'user', subscriptionTier: 'free', createdAt: T, updatedAt: T, requiresReattestation: false, usernameConfirmed: false };
    const parsed = AuthUserResponseSchema.parse(wire);
    expect(parsed.requiresReattestation).toBe(false);
    expect(parsed.usernameConfirmed).toBe(false);
  });

  it('the run write echo keeps the persisted counters, NULL and 0 kept distinct', () => {
    const wire = {
      id: U, projectId: U, authorId: null, runNumber: 1, workflowType: 'contract-job', timestamp: T,
      allGatesPassed: true, averageScore: 91, rawMarkdown: null, archivedAt: null, archiveReason: null,
      idempotencyKey: null, payloadHash: null, definitionType: 'agent', definitionName: 'code-validator',
      definitionVersion: '1.0.0', definitionHash: null, definitionId: null, registrySyncedAt: null,
      createdAt: T, updatedAt: T,
      payloadHashVersion: 'legacy-v1', projectInferred: null,
      newIssuesCount: 1, recurringIssuesCount: 0, regressionsCount: 0, observedCount: 0, clusteredOccurrencesCount: null,
    };
    const parsed = RunWriteEchoResponseSchema.parse(wire);
    expect(parsed).toMatchObject({ payloadHashVersion: 'legacy-v1', projectInferred: null, newIssuesCount: 1, recurringIssuesCount: 0, regressionsCount: 0, observedCount: 0 });
    expect(parsed).toHaveProperty('clusteredOccurrencesCount', null);
  });

  it('correlation keeps duplicatesSkipped', () => {
    expect(CorrelationResultResponseSchema.parse({ newIssues: 1, recurringIssues: 0, regressions: 0, observed: 0, duplicatesSkipped: 0 }).duplicatesSkipped).toBe(0);
  });

  it('an occurrence keeps convergenceClusterId (null included)', () => {
    const wire = { id: U, issueId: U, runId: U, agentName: 'code-validator', description: null, filePath: 'src/x.ts', lineNumber: 1, classificationConfidence: null, classifiedBy: null, correlationStatus: 'new', convergenceClusterId: null, createdAt: T };
    expect(OccurrenceResponseSchema.parse(wire)).toHaveProperty('convergenceClusterId', null);
  });

  it('taxonomy keeps source{} and failureCodePattern.note/validCodes', () => {
    const wire = {
      domains: [], severities: [], priorities: [], statuses: [],
      failureCodePattern: { pattern: '^x$', format: 'DOMAIN-MODE/SEV', example: 'STR-OMI/H', note: 'a format floor, not a membership test', validCodes: ['STR-OMI', 'SEM-INC'] },
      source: { package: '@uluops/taxonomy', version: '1.1.0', database: 'in-sync' },
    };
    const parsed = TaxonomyResponseSchema.parse(wire);
    expect(parsed.source).toEqual({ package: '@uluops/taxonomy', version: '1.1.0', database: 'in-sync' });
    expect(parsed.failureCodePattern.validCodes).toEqual(['STR-OMI', 'SEM-INC']);
    expect(parsed.failureCodePattern.note).toContain('format floor');
  });

  it('CONTROL: every addition is optional — a pre-6.14 API body (none of the new keys) still parses', () => {
    expect(() => AuthUserResponseSchema.parse({ id: U, email: 'c@ci.uluops.local', role: 'user', subscriptionTier: 'free', createdAt: T, updatedAt: T })).not.toThrow();
    expect(() => TaxonomyResponseSchema.parse({ domains: [], severities: [], priorities: [], statuses: [], failureCodePattern: { pattern: 'x', format: 'y', example: 'z' } })).not.toThrow();
  });
});
