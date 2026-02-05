import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import {
  getGlobalConfigDir,
  getCredentialsPath,
  loadStoredCredentials,
  loadCredentials,
  loadConfig,
  isApiKey,
  validateCredentials,
} from '../../src/config/loaders.js';
import { ENV_VARS } from '../../src/config/constants.js';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

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

  describe('loadStoredCredentials', () => {
    it('should return null when credentials file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      const result = loadStoredCredentials();
      expect(result).toBeNull();
    });

    it('should load API key from default profile', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          default: {
            type: 'api_key',
            apiKey: 'ulr_test-key',
          },
        })
      );

      const result = loadStoredCredentials();
      expect(result).toEqual({
        apiKey: 'ulr_test-key',
        sessionToken: undefined,
        email: undefined,
      });
    });

    it('should load session token from default profile', () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          default: {
            type: 'session',
            sessionToken: 'jwt-token-here',
            expiresAt: futureDate,
            email: 'user@example.com',
          },
        })
      );

      const result = loadStoredCredentials();
      expect(result).toEqual({
        apiKey: undefined,
        sessionToken: 'jwt-token-here',
        email: 'user@example.com',
      });
    });

    it('should return null for expired session token', () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          default: {
            type: 'session',
            sessionToken: 'expired-token',
            expiresAt: pastDate,
          },
        })
      );

      const result = loadStoredCredentials();
      expect(result).toBeNull();
    });

    it('should load credentials from a named profile', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          default: { type: 'api_key', apiKey: 'ulr_default-key' },
          staging: { type: 'api_key', apiKey: 'ulr_staging-key' },
        })
      );

      const result = loadStoredCredentials('staging');
      expect(result?.apiKey).toBe('ulr_staging-key');
    });

    it('should return null for missing profile', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          default: { type: 'api_key', apiKey: 'ulr_key' },
        })
      );

      const result = loadStoredCredentials('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null and not throw on malformed JSON', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not valid json{{{');

      const result = loadStoredCredentials();
      expect(result).toBeNull();
    });

    it('should return null when readFileSync throws', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = loadStoredCredentials();
      expect(result).toBeNull();
    });
  });

  describe('loadCredentials', () => {
    it('should prioritize explicit apiKey over everything', () => {
      process.env[ENV_VARS.API_KEY] = 'ulr_env-key';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ default: { type: 'api_key', apiKey: 'ulr_stored-key' } })
      );

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
      mockExistsSync.mockReturnValue(false);

      const result = loadCredentials();
      expect(result).toEqual({ apiKey: 'ulr_env-key' });
    });

    it('should fall back to env var email/password', () => {
      process.env[ENV_VARS.EMAIL] = 'env@example.com';
      process.env[ENV_VARS.PASSWORD] = 'env-pass';
      mockExistsSync.mockReturnValue(false);

      const result = loadCredentials();
      expect(result).toEqual({ email: 'env@example.com', password: 'env-pass' });
    });

    it('should fall back to stored API key credentials', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ default: { type: 'api_key', apiKey: 'ulr_stored-key' } })
      );

      const result = loadCredentials();
      expect(result).toEqual({ apiKey: 'ulr_stored-key' });
    });

    it('should fall back to stored session token', () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          default: {
            type: 'session',
            sessionToken: 'jwt-token',
            expiresAt: futureDate,
            email: 'stored@example.com',
          },
        })
      );

      const result = loadCredentials();
      expect(result).toEqual({ sessionToken: 'jwt-token', email: 'stored@example.com' });
    });

    it('should return empty object when no credentials found', () => {
      mockExistsSync.mockReturnValue(false);
      const result = loadCredentials();
      expect(result).toEqual({});
    });

    it('should require both email and password for explicit credentials', () => {
      // Only email, no password - should not match explicit
      const result = loadCredentials({ email: 'test@example.com' });
      // Falls through to env vars / stored
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('loadConfig', () => {
    it('should return full config with defaults', () => {
      mockExistsSync.mockReturnValue(false);

      const config = loadConfig();
      expect(config).toHaveProperty('baseUrl');
      expect(config).toHaveProperty('credentials');
      expect(config).toHaveProperty('debug', false);
      expect(config.baseUrl).toContain('localhost');
    });

    it('should use explicit baseUrl', () => {
      mockExistsSync.mockReturnValue(false);

      const config = loadConfig({ baseUrl: 'https://api.example.com/v1' });
      expect(config.baseUrl).toBe('https://api.example.com/v1');
    });

    it('should use env var baseUrl', () => {
      process.env[ENV_VARS.BASE_URL] = 'https://env.example.com/v1';
      mockExistsSync.mockReturnValue(false);

      const config = loadConfig();
      expect(config.baseUrl).toBe('https://env.example.com/v1');
    });

    it('should enable debug from env var', () => {
      process.env[ENV_VARS.DEBUG] = 'true';
      mockExistsSync.mockReturnValue(false);

      const config = loadConfig();
      expect(config.debug).toBe(true);
    });

    it('should enable debug from explicit option', () => {
      mockExistsSync.mockReturnValue(false);

      const config = loadConfig({ debug: true });
      expect(config.debug).toBe(true);
    });

    it('should pass through timeout and retries', () => {
      mockExistsSync.mockReturnValue(false);

      const config = loadConfig({ timeout: 5000, retries: 5 });
      expect(config.timeout).toBe(5000);
      expect(config.retries).toBe(5);
    });

    it('should load credentials through priority chain', () => {
      mockExistsSync.mockReturnValue(false);

      const config = loadConfig({ apiKey: 'ulr_my-key' });
      expect(config.credentials).toEqual({ apiKey: 'ulr_my-key' });
    });
  });

  describe('isApiKey', () => {
    it('should return true for valid API key prefix', () => {
      expect(isApiKey('ulr_abc123')).toBe(true);
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
