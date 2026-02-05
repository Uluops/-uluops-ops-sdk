import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleError, createUnauthenticatedContext, type GlobalOptions } from '../../src/cli/context.js';
import { OpsApiError } from '../../src/errors/errors.js';

describe('CLI Context', () => {
  describe('createUnauthenticatedContext', () => {
    it('should create context with default values', () => {
      const options: GlobalOptions = {};
      const ctx = createUnauthenticatedContext(options);

      expect(ctx.json).toBe(false);
      expect(ctx.debug).toBe(false);
      expect(ctx.quiet).toBe(false);
      expect(ctx.baseUrl).toBeTruthy();
    });

    it('should respect json option', () => {
      const options: GlobalOptions = { json: true };
      const ctx = createUnauthenticatedContext(options);

      expect(ctx.json).toBe(true);
    });

    it('should respect debug option', () => {
      const options: GlobalOptions = { debug: true };
      const ctx = createUnauthenticatedContext(options);

      expect(ctx.debug).toBe(true);
    });

    it('should respect quiet option', () => {
      const options: GlobalOptions = { quiet: true };
      const ctx = createUnauthenticatedContext(options);

      expect(ctx.quiet).toBe(true);
    });

    it('should use custom baseUrl', () => {
      const options: GlobalOptions = { baseUrl: 'https://custom.api.com' };
      const ctx = createUnauthenticatedContext(options);

      expect(ctx.baseUrl).toBe('https://custom.api.com');
    });
  });

  describe('handleError', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let processExitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    describe('OpsApiError handling', () => {
      it('should output JSON for API errors when ctx.json is true', () => {
        // OpsApiError(statusCode, message, code?, details?, requestId?)
        const error = new OpsApiError(400, 'Bad request', 'VALIDATION_ERROR');

        expect(() => handleError(error, { json: true, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"message"'));
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should output human-readable message for API errors when ctx.json is false', () => {
        const error = new OpsApiError(404, 'Resource not found', 'NOT_FOUND');

        expect(() => handleError(error, { json: false, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Resource not found');
      });

      it('should show hint for 401 errors', () => {
        const error = new OpsApiError(401, 'Unauthorized', 'UNAUTHORIZED');

        expect(() => handleError(error, { json: false, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('credentials may be invalid'));
      });

      it('should show hint for 404 errors', () => {
        const error = new OpsApiError(404, 'Not found', 'NOT_FOUND');

        expect(() => handleError(error, { json: false, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('resource was not found'));
      });

      it('should show hint for 400 validation errors', () => {
        const error = new OpsApiError(400, 'Validation failed', 'VALIDATION_ERROR');

        expect(() => handleError(error, { json: false, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid input'));
      });

      it('should show hint for 429 rate limit errors', () => {
        const error = new OpsApiError(429, 'Rate limited', 'RATE_LIMITED');

        expect(() => handleError(error, { json: false, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Rate limited'));
      });

      it('should show details in debug mode', () => {
        const error = new OpsApiError(500, 'Failed', 'SERVER_ERROR', { field: 'test', value: 123 });

        expect(() => handleError(error, { json: false, debug: true })).toThrow('process.exit called');
        // Details are logged in a separate call
        const allCalls = consoleErrorSpy.mock.calls.flat().join(' ');
        expect(allCalls).toContain('Details:');
      });

      it('should sanitize sensitive data in details', () => {
        const error = new OpsApiError(500, 'Failed', 'SERVER_ERROR', { apiKey: 'secret-key-12345', data: 'normal' });

        expect(() => handleError(error, { json: false, debug: true })).toThrow('process.exit called');
        // Should contain [REDACTED] for sensitive fields
        const calls = consoleErrorSpy.mock.calls.flat().join(' ');
        expect(calls).toContain('[REDACTED]');
        expect(calls).not.toContain('secret-key-12345');
      });

      it('should show request ID when available', () => {
        const error = new OpsApiError(500, 'Failed', 'SERVER_ERROR', undefined, 'req-12345');

        expect(() => handleError(error, { json: false, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Request ID: req-12345'));
      });
    });

    describe('Generic error handling', () => {
      it('should output JSON for generic errors when ctx.json is true', () => {
        const error = new Error('Generic error');

        expect(() => handleError(error, { json: true, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"error"'));
      });

      it('should output message for generic errors when ctx.json is false', () => {
        const error = new Error('Something went wrong');

        expect(() => handleError(error, { json: false, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Something went wrong');
      });

      it('should show hint for connection errors', () => {
        const error = new Error('ECONNREFUSED: Connection refused');

        expect(() => handleError(error, { json: false, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot connect'));
      });

      it('should show hint for network errors', () => {
        const error = new Error('network error occurred');

        expect(() => handleError(error, { json: false, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot connect'));
      });

      it('should show stack trace in debug mode for generic errors', () => {
        const error = new Error('Debug me');

        expect(() => handleError(error, { json: false, debug: true })).toThrow('process.exit called');
        // Stack trace is logged in a separate call
        const allCalls = consoleErrorSpy.mock.calls.flat().join(' ');
        expect(allCalls).toContain('Stack trace:');
      });

      it('should handle non-Error objects', () => {
        const error = 'string error';

        expect(() => handleError(error, { json: false, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error: string error');
      });

      it('should handle objects without message', () => {
        const error = { code: 'UNKNOWN' };

        expect(() => handleError(error, { json: false, debug: false })).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('Exit behavior', () => {
      it('should always exit with code 1', () => {
        const error = new Error('test');

        expect(() => handleError(error, { json: false, debug: false })).toThrow('process.exit called');
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });
    });
  });
});
