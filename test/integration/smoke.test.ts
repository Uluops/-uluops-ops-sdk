/**
 * Integration Smoke Tests
 *
 * These tests run against the real API when INTEGRATION_TEST_API_URL
 * and INTEGRATION_TEST_API_KEY environment variables are set.
 *
 * Run with: INTEGRATION_TEST_API_URL=http://localhost:3100/api/v1 \
 *           INTEGRATION_TEST_API_KEY=ulr_xxx npm test test/integration
 *
 * These tests validate:
 * - Actual serialization/deserialization works correctly
 * - Response shapes match our schemas
 * - Error handling works with real API responses
 * - Headers are properly set and handled
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import nock from 'nock';
import { OpsHttpClient } from '../../src/http/http-client.js';
import * as projectOps from '../../src/operations/projects.js';
import * as issueOps from '../../src/operations/issues.js';
import {
  integration,
  INTEGRATION_TEST_CONFIG,
  assertMatchesSchema,
  ProjectResponseSchema,
  IssueResponseSchema,
} from '../contract-helpers.js';
import { OpsApiError } from '../../src/errors/errors.js';
import { InputValidationError } from '../../src/config/validators.js';

// Skip entire file if integration tests not enabled
if (!INTEGRATION_TEST_CONFIG.enabled) {
  describe.skip('Integration Smoke Tests', () => {
    it('skipped - set INTEGRATION_TEST_API_URL and INTEGRATION_TEST_API_KEY to enable', () => {});
  });
} else {
  describe('Integration Smoke Tests', () => {
    let client: OpsHttpClient;
    let testProjectId: string | null = null;
    const testProjectName = `sdk-integration-test-${Date.now()}`;

    beforeAll(() => {
      client = new OpsHttpClient({
        baseUrl: INTEGRATION_TEST_CONFIG.apiUrl,
        apiKey: INTEGRATION_TEST_CONFIG.apiKey,
      });
    });

    // Override the global setup.ts which calls nock.disableNetConnect()
    beforeEach(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    afterAll(async () => {
      // Cleanup: delete test project if created
      if (testProjectId) {
        try {
          await projectOps.deleteProject(client, testProjectId, {
            confirm: true,
            confirmationPhrase: testProjectName,
          });
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    describe('Project Operations', () => {
      it('should list projects with correct response shape', async () => {
        const projects = await projectOps.list(client);

        expect(Array.isArray(projects)).toBe(true);

        // Validate each project matches schema
        for (const project of projects.slice(0, 3)) {
          assertMatchesSchema(project, ProjectResponseSchema, 'Listed project');
        }
      });

      it('should create a project with correct response shape', async () => {
        const project = await projectOps.create(client, { name: testProjectName });

        testProjectId = project.id;

        // Validate response shape
        assertMatchesSchema(project, ProjectResponseSchema, 'Created project');
        expect(project.name).toBe(testProjectName);
      });

      it('should get project by ID with correct response shape', async () => {
        if (!testProjectId) {
          throw new Error('Test project not created');
        }

        const project = await projectOps.get(client, testProjectId);

        assertMatchesSchema(project, ProjectResponseSchema, 'Fetched project');
        expect(project.id).toBe(testProjectId);
      });

      it('should get project summary', async () => {
        if (!testProjectId) {
          throw new Error('Test project not created');
        }

        const summary = await projectOps.getSummary(client, testProjectId);

        expect(summary.stats).toBeDefined();
        expect(typeof summary.stats.totalRuns).toBe('number');
        expect(typeof summary.stats.totalIssues).toBe('number');
        expect(typeof summary.stats.openIssues).toBe('number');
      });

      it('should handle forbidden error for non-existent project', async () => {
        try {
          await projectOps.get(client, 'non-existent-project-id-12345');
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(OpsApiError);
          // API returns 403 (FORBIDDEN) for projects the user doesn't own
          expect((error as OpsApiError).statusCode).toBe(403);
        }
      });
    });

    describe('Issue Operations', () => {
      it('should search issues with correct response shape', async () => {
        const issues = await issueOps.search(client, { query: 'test', limit: 5 });

        expect(Array.isArray(issues)).toBe(true);

        // Validate each issue matches schema
        for (const issue of issues) {
          assertMatchesSchema(issue, IssueResponseSchema, 'Searched issue');
        }
      });

      it('should handle empty search results', async () => {
        const issues = await issueOps.search(client, {
          query: 'zzz-nonexistent-query-zzz-' + Date.now(),
          limit: 5,
        });

        expect(Array.isArray(issues)).toBe(true);
        expect(issues.length).toBe(0);
      });
    });

    describe('Error Handling', () => {
      it('should reject invalid input with client-side validation', async () => {
        try {
          // Empty title fails client-side Zod validation before hitting the API
          await issueOps.create(client, {
            project: testProjectId ?? 'test',
            title: '', // Empty title should fail validation
            priority: 'critical',
          });
          expect.fail('Should have thrown validation error');
        } catch (error) {
          expect(error).toBeInstanceOf(InputValidationError);
          expect((error as InputValidationError).message).toBeTruthy();
        }
      });

      it('should handle unauthorized requests', async () => {
        const badClient = new OpsHttpClient({
          baseUrl: INTEGRATION_TEST_CONFIG.apiUrl,
          apiKey: 'ulr_definitely-invalid-api-key-that-is-long-enough',
        });

        try {
          await projectOps.list(badClient);
          expect.fail('Should have thrown unauthorized error');
        } catch (error) {
          expect(error).toBeInstanceOf(OpsApiError);
          expect((error as OpsApiError).statusCode).toBe(401);
        }
      });
    });

    describe('Request Headers', () => {
      it('should include proper headers in requests', async () => {
        // This test verifies that the client properly sets headers
        // by making a successful authenticated request
        const projects = await projectOps.list(client);

        // If we got here without auth errors, headers were set correctly
        expect(Array.isArray(projects)).toBe(true);
      });
    });
  });
}
