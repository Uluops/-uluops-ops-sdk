import { describe, it, expect } from 'vitest';
import { redactSensitive, sanitizeForDisplay } from '../../src/utils/logger.js';

describe('Logger Utilities', () => {
  describe('redactSensitive', () => {
    it('should redact most of the string showing last 4 characters', () => {
      expect(redactSensitive('ulr_abc123xyz456')).toBe('************z456');
    });

    it('should return [REDACTED] for short strings', () => {
      expect(redactSensitive('abc')).toBe('[REDACTED]');
      expect(redactSensitive('abcd')).toBe('[REDACTED]');
    });

    it('should redact at the boundary (length=5 is first non-redacted)', () => {
      const result = redactSensitive('abcde');
      expect(result).not.toBe('[REDACTED]');
      expect(result).toBe('*bcde');
    });

    it('should handle custom showLast parameter', () => {
      expect(redactSensitive('secretvalue', 2)).toBe('*********ue');
    });

    it('should limit asterisks to 20 for very long strings', () => {
      const longString = 'a'.repeat(50);
      const result = redactSensitive(longString);
      expect(result).toBe('********************aaaa');
    });
  });

  describe('sanitizeForDisplay', () => {
    it('should redact password fields', () => {
      const input = { email: 'test@example.com', password: 'secret123' };
      const result = sanitizeForDisplay(input);
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('[REDACTED]');
    });

    it('should redact apiKey fields', () => {
      const input = { apiKey: 'ulr_secretkey', name: 'test' };
      const result = sanitizeForDisplay(input);
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.name).toBe('test');
    });

    it('should redact token fields', () => {
      const input = { token: 'abc123', sessionToken: 'xyz789' };
      const result = sanitizeForDisplay(input);
      expect(result.token).toBe('[REDACTED]');
      expect(result.sessionToken).toBe('[REDACTED]');
    });

    it('should redact snake_case sensitive fields', () => {
      const input = { api_key: 'secret', session_token: 'token123' };
      const result = sanitizeForDisplay(input);
      expect(result.api_key).toBe('[REDACTED]');
      expect(result.session_token).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const input = {
        user: { email: 'test@example.com', password: 'secret' },
        config: { apiKey: 'key123' },
      };
      const result = sanitizeForDisplay(input);
      expect((result.user as Record<string, unknown>).email).toBe('test@example.com');
      expect((result.user as Record<string, unknown>).password).toBe('[REDACTED]');
      expect((result.config as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    });

    it('should handle arrays with objects', () => {
      const input = {
        credentials: [
          { type: 'api', apiKey: 'key1' },
          { type: 'session', token: 'token1' },
        ],
      };
      const result = sanitizeForDisplay(input);
      const creds = result.credentials as Record<string, unknown>[];
      expect(creds[0].type).toBe('api');
      expect(creds[0].apiKey).toBe('[REDACTED]');
      expect(creds[1].type).toBe('session');
      expect(creds[1].token).toBe('[REDACTED]');
    });

    it('should preserve non-sensitive fields', () => {
      const input = { name: 'test', count: 42, active: true, data: null };
      const result = sanitizeForDisplay(input);
      expect(result).toEqual(input);
    });

    it('should handle empty objects', () => {
      expect(sanitizeForDisplay({})).toEqual({});
    });

    it('should handle case variations of sensitive keys', () => {
      const input = { Authorization: 'Bearer xyz', CREDENTIALS: 'secret' };
      const result = sanitizeForDisplay(input);
      expect(result.Authorization).toBe('[REDACTED]');
      expect(result.CREDENTIALS).toBe('[REDACTED]');
    });
  });
});
