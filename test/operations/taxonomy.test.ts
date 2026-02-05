import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as taxonomyOps from '../../src/operations/taxonomy.js';
import { BASE_URL } from '../setup.js';

describe('Taxonomy Operations', () => {
  let client: OpsHttpClient;

  beforeEach(() => {
    client = new OpsHttpClient({
      baseUrl: BASE_URL,
      apiKey: 'ulr_test-api-key-12345',
    });
  });

  describe('get', () => {
    it('should get the full taxonomy schema', async () => {
      nock(BASE_URL)
        .get('/taxonomy')
        .reply(200, {
          data: {
            version: '1.0.0',
            domains: [
              {
                code: 'STR',
                name: 'Structural',
                description: 'Structural issues in code organization',
                modes: [
                  { code: 'OMI', name: 'Omission', description: 'Missing required elements' },
                  { code: 'RED', name: 'Redundancy', description: 'Duplicate or unnecessary code' },
                  { code: 'MIS', name: 'Misplacement', description: 'Code in wrong location' },
                ],
              },
              {
                code: 'SEM',
                name: 'Semantic',
                description: 'Logic and meaning issues',
                modes: [
                  { code: 'VAL', name: 'Validation', description: 'Incorrect validation logic' },
                  { code: 'TYP', name: 'Type', description: 'Type-related issues' },
                  { code: 'LOG', name: 'Logic', description: 'Faulty business logic' },
                ],
              },
              {
                code: 'PRA',
                name: 'Pragmatic',
                description: 'Practical implementation issues',
                modes: [
                  { code: 'PER', name: 'Performance', description: 'Performance problems' },
                  { code: 'SEC', name: 'Security', description: 'Security vulnerabilities' },
                  { code: 'MAI', name: 'Maintainability', description: 'Hard to maintain code' },
                ],
              },
              {
                code: 'EPI',
                name: 'Epistemic',
                description: 'Knowledge and documentation issues',
                modes: [
                  { code: 'DOC', name: 'Documentation', description: 'Missing or incorrect docs' },
                  { code: 'NAM', name: 'Naming', description: 'Poor naming conventions' },
                  { code: 'CLR', name: 'Clarity', description: 'Unclear code or intent' },
                ],
              },
            ],
            severities: [
              { code: 'C', name: 'critical', weight: 10 },
              { code: 'H', name: 'high', weight: 5 },
              { code: 'M', name: 'medium', weight: 3 },
              { code: 'L', name: 'low', weight: 1 },
              { code: 'I', name: 'info', weight: 0 },
            ],
            priorities: ['critical', 'suggested', 'backlog'],
          },
        });

      const schema = await taxonomyOps.get(client);

      expect(schema.domains).toHaveLength(4);
      expect(schema.domains[0].code).toBe('STR');
      expect(schema.domains[0].modes).toHaveLength(3);
      expect(schema.severities).toHaveLength(5);
      expect(schema.priorities).toContain('critical');
    });

    it('should include all domain codes', async () => {
      nock(BASE_URL)
        .get('/taxonomy')
        .reply(200, {
          data: {
            domains: [
              { code: 'STR', name: 'Structural', modes: [] },
              { code: 'SEM', name: 'Semantic', modes: [] },
              { code: 'PRA', name: 'Pragmatic', modes: [] },
              { code: 'EPI', name: 'Epistemic', modes: [] },
            ],
            severities: [],
            priorities: [],
          },
        });

      const schema = await taxonomyOps.get(client);

      const domainCodes = schema.domains.map((d) => d.code);
      expect(domainCodes).toContain('STR');
      expect(domainCodes).toContain('SEM');
      expect(domainCodes).toContain('PRA');
      expect(domainCodes).toContain('EPI');
    });
  });
});
