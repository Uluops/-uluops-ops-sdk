import { describe, it, expect } from 'vitest';
import {
  OpsApiError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  NetworkError,
  TimeoutError,
  createErrorFromStatus,
  isOpsApiError,
} from '../../src/errors/errors.js';
import { HTTP_STATUS, ERROR_CODES } from '../../src/config/constants.js';

describe('Error Classes', () => {
  describe('OpsApiError', () => {
    it('should set all constructor properties', () => {
      const details = { field: 'email' };
      const error = new OpsApiError(400, 'Bad request', 'VALIDATION_ERROR', details, 'req-123');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad request');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'email' });
      expect(error.requestId).toBe('req-123');
      expect(error.name).toBe('OpsApiError');
    });

    it('should default code to UNKNOWN when not provided', () => {
      const error = new OpsApiError(500, 'Server error');
      expect(error.code).toBe(ERROR_CODES.UNKNOWN);
    });

    it('should be an instance of Error', () => {
      const error = new OpsApiError(500, 'test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OpsApiError);
    });

    it('should have a stack trace', () => {
      const error = new OpsApiError(500, 'test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('OpsApiError');
    });

    describe('isRetryable', () => {
      it('should return true for 502 Bad Gateway', () => {
        expect(new OpsApiError(HTTP_STATUS.BAD_GATEWAY, 'err').isRetryable()).toBe(true);
      });

      it('should return true for 503 Service Unavailable', () => {
        expect(new OpsApiError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'err').isRetryable()).toBe(true);
      });

      it('should return true for 504 Gateway Timeout', () => {
        expect(new OpsApiError(HTTP_STATUS.GATEWAY_TIMEOUT, 'err').isRetryable()).toBe(true);
      });

      it('should return true for 429 Too Many Requests', () => {
        expect(new OpsApiError(HTTP_STATUS.TOO_MANY_REQUESTS, 'err').isRetryable()).toBe(true);
      });

      it('should return false for 400 Bad Request', () => {
        expect(new OpsApiError(HTTP_STATUS.BAD_REQUEST, 'err').isRetryable()).toBe(false);
      });

      it('should return false for 401 Unauthorized', () => {
        expect(new OpsApiError(HTTP_STATUS.UNAUTHORIZED, 'err').isRetryable()).toBe(false);
      });

      it('should return false for 404 Not Found', () => {
        expect(new OpsApiError(HTTP_STATUS.NOT_FOUND, 'err').isRetryable()).toBe(false);
      });

      it('should return false for 500 Internal Server Error', () => {
        expect(new OpsApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'err').isRetryable()).toBe(false);
      });
    });

    describe('toJSON', () => {
      it('should serialize all fields', () => {
        const error = new OpsApiError(422, 'Unprocessable', 'VALIDATION_ERROR', { field: 'name' }, 'req-456');
        const json = error.toJSON();

        expect(json).toEqual({
          name: 'OpsApiError',
          message: 'Unprocessable',
          statusCode: 422,
          code: 'VALIDATION_ERROR',
          details: { field: 'name' },
          requestId: 'req-456',
        });
      });

      it('should handle undefined optional fields', () => {
        const error = new OpsApiError(500, 'Server error');
        const json = error.toJSON();

        expect(json.details).toBeUndefined();
        expect(json.requestId).toBeUndefined();
      });
    });
  });

  describe('ValidationError', () => {
    it('should set status 400 and VALIDATION_ERROR code', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.name).toBe('ValidationError');
    });

    it('should accept details', () => {
      const details = { fields: ['email', 'password'] };
      const error = new ValidationError('Invalid input', details);
      expect(error.details).toEqual(details);
    });

    it('should be an instance of OpsApiError', () => {
      expect(new ValidationError('test')).toBeInstanceOf(OpsApiError);
    });
  });

  describe('UnauthorizedError', () => {
    it('should use default message', () => {
      const error = new UnauthorizedError();
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should accept custom message', () => {
      const error = new UnauthorizedError('Token expired');
      expect(error.message).toBe('Token expired');
    });
  });

  describe('ForbiddenError', () => {
    it('should use default message', () => {
      const error = new ForbiddenError();
      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      expect(error.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(error.name).toBe('ForbiddenError');
    });

    it('should accept custom message', () => {
      const error = new ForbiddenError('Admin only');
      expect(error.message).toBe('Admin only');
    });
  });

  describe('NotFoundError', () => {
    it('should format message with resource only', () => {
      const error = new NotFoundError('Project');
      expect(error.message).toBe('Project not found');
      expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
      expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(error.name).toBe('NotFoundError');
    });

    it('should format message with resource and identifier', () => {
      const error = new NotFoundError('Project', 'my-project');
      expect(error.message).toBe("Project 'my-project' not found");
      expect(error.details).toEqual({ id: 'my-project' });
    });

    it('should have no details without identifier', () => {
      const error = new NotFoundError('Issue');
      expect(error.details).toBeUndefined();
    });
  });

  describe('ConflictError', () => {
    it('should set status 409 and CONFLICT code', () => {
      const error = new ConflictError('Already exists');
      expect(error.statusCode).toBe(HTTP_STATUS.CONFLICT);
      expect(error.code).toBe(ERROR_CODES.CONFLICT);
      expect(error.name).toBe('ConflictError');
    });

    it('should accept details', () => {
      const error = new ConflictError('Duplicate', { existing: 'proj-1' });
      expect(error.details).toEqual({ existing: 'proj-1' });
    });
  });

  describe('RateLimitError', () => {
    it('should format message with retryAfter', () => {
      const error = new RateLimitError(60);
      expect(error.message).toBe('Rate limit exceeded. Retry after 60 seconds');
      expect(error.statusCode).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
      expect(error.code).toBe(ERROR_CODES.RATE_LIMITED);
      expect(error.details).toEqual({ retryAfter: 60 });
      expect(error.name).toBe('RateLimitError');
    });

    it('should use generic message without retryAfter', () => {
      const error = new RateLimitError();
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.details).toEqual({ retryAfter: undefined });
    });

    it('should be retryable', () => {
      expect(new RateLimitError(30).isRetryable()).toBe(true);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should use default message', () => {
      const error = new ServiceUnavailableError();
      expect(error.message).toBe('Service temporarily unavailable');
      expect(error.statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
      expect(error.name).toBe('ServiceUnavailableError');
    });

    it('should accept custom message', () => {
      const error = new ServiceUnavailableError('Maintenance window');
      expect(error.message).toBe('Maintenance window');
    });

    it('should be retryable', () => {
      expect(new ServiceUnavailableError().isRetryable()).toBe(true);
    });
  });

  describe('NetworkError', () => {
    it('should set status 0 and NETWORK_ERROR code', () => {
      const error = new NetworkError('ECONNREFUSED');
      expect(error.statusCode).toBe(0);
      expect(error.code).toBe(ERROR_CODES.NETWORK_ERROR);
      expect(error.message).toBe('ECONNREFUSED');
      expect(error.name).toBe('NetworkError');
    });

    it('should not be retryable', () => {
      expect(new NetworkError('test').isRetryable()).toBe(false);
    });
  });

  describe('TimeoutError', () => {
    it('should format message with timeout value', () => {
      const error = new TimeoutError(30000);
      expect(error.message).toBe('Request timed out after 30000ms');
      expect(error.statusCode).toBe(0);
      expect(error.code).toBe(ERROR_CODES.TIMEOUT);
      expect(error.details).toEqual({ timeoutMs: 30000 });
      expect(error.name).toBe('TimeoutError');
    });

    it('should not be retryable', () => {
      expect(new TimeoutError(5000).isRetryable()).toBe(false);
    });
  });

  describe('createErrorFromStatus', () => {
    it('should create ValidationError for 400', () => {
      const error = createErrorFromStatus(400, 'Bad request', undefined, { field: 'email' });
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create UnauthorizedError for 401', () => {
      const error = createErrorFromStatus(401, 'Invalid token');
      expect(error).toBeInstanceOf(UnauthorizedError);
    });

    it('should create ForbiddenError for 403', () => {
      const error = createErrorFromStatus(403, 'Forbidden');
      expect(error).toBeInstanceOf(ForbiddenError);
    });

    it('should create NotFoundError for 404', () => {
      const error = createErrorFromStatus(404, 'Not found');
      expect(error).toBeInstanceOf(NotFoundError);
    });

    it('should create ConflictError for 409', () => {
      const error = createErrorFromStatus(409, 'Conflict', undefined, { existing: 'id' });
      expect(error).toBeInstanceOf(ConflictError);
    });

    it('should create RateLimitError for 429 with retryAfter', () => {
      const error = createErrorFromStatus(429, 'Rate limited', undefined, { retryAfter: 30 });
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.details).toEqual({ retryAfter: 30 });
    });

    it('should create RateLimitError for 429 without retryAfter', () => {
      const error = createErrorFromStatus(429, 'Rate limited');
      expect(error).toBeInstanceOf(RateLimitError);
    });

    it('should create ServiceUnavailableError for 503', () => {
      const error = createErrorFromStatus(503, 'Unavailable');
      expect(error).toBeInstanceOf(ServiceUnavailableError);
    });

    it('should create ServiceUnavailableError for 502', () => {
      const error = createErrorFromStatus(502, 'Bad gateway');
      expect(error).toBeInstanceOf(ServiceUnavailableError);
    });

    it('should create ServiceUnavailableError for 504', () => {
      const error = createErrorFromStatus(504, 'Gateway timeout');
      expect(error).toBeInstanceOf(ServiceUnavailableError);
    });

    it('should create generic OpsApiError for unknown status codes', () => {
      const error = createErrorFromStatus(418, "I'm a teapot", 'TEAPOT', { brew: 'coffee' }, 'req-789');
      expect(error).toBeInstanceOf(OpsApiError);
      expect(error.statusCode).toBe(418);
      expect(error.code).toBe('TEAPOT');
      expect(error.requestId).toBe('req-789');
    });

    it('should pass details and requestId to generic fallback', () => {
      const error = createErrorFromStatus(500, 'Internal error', 'INTERNAL', { trace: 'abc' }, 'req-000');
      expect(error.details).toEqual({ trace: 'abc' });
      expect(error.requestId).toBe('req-000');
    });
  });

  describe('isOpsApiError', () => {
    it('should return true for OpsApiError instances', () => {
      expect(isOpsApiError(new OpsApiError(500, 'test'))).toBe(true);
    });

    it('should return true for subclass instances', () => {
      expect(isOpsApiError(new ValidationError('test'))).toBe(true);
      expect(isOpsApiError(new NotFoundError('Resource'))).toBe(true);
      expect(isOpsApiError(new RateLimitError(60))).toBe(true);
      expect(isOpsApiError(new TimeoutError(5000))).toBe(true);
      expect(isOpsApiError(new NetworkError('test'))).toBe(true);
    });

    it('should return false for plain Error', () => {
      expect(isOpsApiError(new Error('test'))).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isOpsApiError(null)).toBe(false);
      expect(isOpsApiError(undefined)).toBe(false);
      expect(isOpsApiError('string')).toBe(false);
      expect(isOpsApiError(42)).toBe(false);
      expect(isOpsApiError({})).toBe(false);
    });
  });
});
