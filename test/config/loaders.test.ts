import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { homedir } from 'node:os';
import {
  getGlobalConfigDir,
  getCredentialsPath,
  loadCredentials,
  loadConfig,
  isApiKey,
  validateCredentials,
} from '../../src/config/loaders.js';
import { ENV_VARS } from '../../src/config/constants.js';

// Mock dotenv to prevent real .env files from being loaded
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('Config Loaders', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    // Clear relevant env vars
    delete process.env[ENV_VARS.API_KEY];
    delete process.env[ENV_VARS.EMAIL];
    delete process.env[ENV_VARS.PASSWORD];
    delete process.env[ENV_VARS.BASE_URL];
    delete process.env[ENV_VARS.DEBUG];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getGlobalConfigDir', () => {
    it('should return path under home directory', () => {
      const dir = getGlobalConfigDir();
      expect(dir).toContain(homedir());
      expect(dir).toContain('.uluops');
    });
  });

  describe('getCredentialsPath', () => {
    it('should return path to credentials.json under home', () => {
      const path = getCredentialsPath();
      expect(path).toContain(homedir());
      expect(path).toContain('credentials.json');
    });
  });

  // Note: loadStoredCredentials tests removed — it's a direct re-export from
  // @uluops/sdk-core and tested in sdk-core's own test suite. Vitest's vi.mock('node:fs')
  // cannot intercept fs calls inside pre-compiled ESM in node_modules/.

  describe('loadCredentials', () => {
    it('should prioritize explicit apiKey over everything', () => {
      process.env[ENV_VARS.API_KEY] = 'ulr_env-key';

      const result = loadCredentials({ apiKey: 'ulr_explicit-key' });
      expect(result).toEqual({ apiKey: 'ulr_explicit-key' });
    });

    it('should prioritize explicit email/password over env vars', () => {
      process.env[ENV_VARS.EMAIL] = 'env@example.com';
      process.env[ENV_VARS.PASSWORD] = 'env-pass';

      const result = loadCredentials({ email: 'explicit@example.com', password: 'explicit-pass' });
      expect(result).toEqual({ email: 'explicit@example.com', password: 'explicit-pass' });
    });

    it('should fall back to env var API key', () => {
      process.env[ENV_VARS.API_KEY] = 'ulr_env-key';

      const result = loadCredentials();
      expect(result).toEqual({ apiKey: 'ulr_env-key' });
    });

    it('should fall back to env var email/password', () => {
      process.env[ENV_VARS.EMAIL] = 'env@example.com';
      process.env[ENV_VARS.PASSWORD] = 'env-pass';

      const result = loadCredentials();
      expect(result).toEqual({ email: 'env@example.com', password: 'env-pass' });
    });

    // Note: "stored credentials fallback" tests removed — they require mocking node:fs
    // inside sdk-core's compiled code, which Vitest cannot do for npm packages.
    // The stored credentials priority chain is tested in sdk-core's test suite.

    it('should require both email and password for explicit credentials', () => {
      // Only email, no password - should not match explicit
      const result = loadCredentials({ email: 'test@example.com' });
      // Falls through to env vars / stored
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('loadConfig', () => {
    it('should return full config with defaults', () => {
      const config = loadConfig();
      expect(config).toHaveProperty('baseUrl');
      expect(config).toHaveProperty('credentials');
      expect(config).toHaveProperty('debug', false);
      expect(config.baseUrl).toContain('api.uluops.ai');
    });

    it('should use explicit baseUrl', () => {
      const config = loadConfig({ baseUrl: 'https://api.example.com/v1' });
      expect(config.baseUrl).toBe('https://api.example.com/v1');
    });

    it('should use env var baseUrl', () => {
      process.env[ENV_VARS.BASE_URL] = 'https://env.example.com/v1';

      const config = loadConfig();
      expect(config.baseUrl).toBe('https://env.example.com/v1');
    });

    it('should enable debug from env var', () => {
      process.env[ENV_VARS.DEBUG] = 'true';

      const config = loadConfig();
      expect(config.debug).toBe(true);
    });

    it('should enable debug from explicit option', () => {
      const config = loadConfig({ debug: true });
      expect(config.debug).toBe(true);
    });

    it('should pass through timeout and retries', () => {
      const config = loadConfig({ timeout: 5000, retries: 5 });
      expect(config.timeout).toBe(5000);
      expect(config.retries).toBe(5);
    });

    it('should load credentials through priority chain', () => {
      const config = loadConfig({ apiKey: 'ulr_my-key' });
      expect(config.credentials).toEqual({ apiKey: 'ulr_my-key' });
    });
  });

  describe('isApiKey', () => {
    it('should return true for valid API key prefix', () => {
      // sdk-core >=0.13.0: isApiKey enforces the 20-char minimum (matches the
      // ApiKeyAuth constructor), so the key must be long enough.
      expect(isApiKey('ulr_abc123def456ghi789')).toBe(true);
    });

    it('should return false for invalid prefix', () => {
      expect(isApiKey('sk_abc123')).toBe(false);
      expect(isApiKey('abc123')).toBe(false);
      expect(isApiKey('')).toBe(false);
    });
  });

  describe('validateCredentials', () => {
    it('should not throw with API key', () => {
      expect(() => validateCredentials({ apiKey: 'ulr_key' })).not.toThrow();
    });

    it('should not throw with session token', () => {
      expect(() => validateCredentials({ sessionToken: 'jwt-token' })).not.toThrow();
    });

    it('should not throw with email and password', () => {
      expect(() =>
        validateCredentials({ email: 'user@example.com', password: 'pass' })
      ).not.toThrow();
    });

    it('should throw when no credentials present', () => {
      expect(() => validateCredentials({})).toThrow('No credentials found');
    });

    it('should throw with only email (no password)', () => {
      expect(() => validateCredentials({ email: 'user@example.com' })).toThrow(
        'No credentials found'
      );
    });

    it('should throw with only password (no email)', () => {
      expect(() => validateCredentials({ password: 'pass' })).toThrow('No credentials found');
    });
  });
});
