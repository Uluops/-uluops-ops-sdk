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
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

        expect(typeof summary.totalIssues).toBe('number');
        expect(typeof summary.openIssues).toBe('number');
        expect(typeof summary.totalRuns).toBe('number');
      });

      it('should handle not found error correctly', async () => {
        try {
          await projectOps.get(client, 'non-existent-project-id-12345');
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(OpsApiError);
          expect((error as OpsApiError).statusCode).toBe(404);
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
      it('should parse error responses correctly', async () => {
        try {
          // Try to create issue without required fields
          await issueOps.create(client, {
            project: testProjectId ?? 'test',
            title: '', // Empty title should fail validation
            priority: 'critical',
          });
          expect.fail('Should have thrown validation error');
        } catch (error) {
          expect(error).toBeInstanceOf(OpsApiError);
          // Error should have a code and message
          const apiError = error as OpsApiError;
          expect(apiError.message).toBeTruthy();
        }
      });

      it('should handle unauthorized requests', async () => {
        const badClient = new OpsHttpClient({
          baseUrl: INTEGRATION_TEST_CONFIG.apiUrl,
          apiKey: 'ulr_invalid-api-key',
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
