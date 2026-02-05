import type { AxiosInstance } from 'axios';
import { API_KEY_PREFIX } from '../config/constants.js';
import { UnauthorizedError } from '../errors/errors.js';

/**
 * Authentication strategy interface
 */
export interface AuthStrategy {
  /**
   * Get the Authorization header value
   */
  getAuthorizationHeader(): string;

  /**
   * Check if credentials can be refreshed (re-login)
   */
  canRefresh(): boolean;

  /**
   * Refresh the credentials (re-login)
   */
  refresh(): Promise<void>;

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean;

  /**
   * Get the authentication type
   */
  getType(): 'api_key' | 'session';
}

/**
 * Configuration for creating an auth strategy
 */
export interface AuthConfig {
  apiKey?: string;
  email?: string;
  password?: string;
  sessionToken?: string;
  httpClient?: AxiosInstance;
  onTokenRefresh?: (token: string) => void;
}

/**
 * API key authentication strategy
 */
export class ApiKeyAuth implements AuthStrategy {
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    if (!apiKey.startsWith(API_KEY_PREFIX)) {
      throw new Error(`Invalid API key format. Expected prefix: ${API_KEY_PREFIX}`);
    }
  }

  getAuthorizationHeader(): string {
    return `Bearer ${this.apiKey}`;
  }

  canRefresh(): boolean {
    return false; // API keys don't refresh
  }

  async refresh(): Promise<void> {
    throw new Error('API keys cannot be refreshed');
  }

  isAuthenticated(): boolean {
    return true; // If we have a key, we're authenticated
  }

  getType(): 'api_key' {
    return 'api_key';
  }
}

/**
 * JWT session authentication strategy
 */
export class JwtSessionAuth implements AuthStrategy {
  private sessionToken: string | null;
  private expiresAt: Date | null = null;

  constructor(
    private readonly httpClient: AxiosInstance,
    private readonly credentials: { email: string; password: string },
    private readonly onTokenRefresh?: (token: string) => void,
    initialToken?: string
  ) {
    this.sessionToken = initialToken ?? null;
  }

  /**
   * Login and get a new session token
   */
  async login(): Promise<string> {
    const response = await this.httpClient.post('/auth/login', {
      email: this.credentials.email,
      password: this.credentials.password,
    });

    const { sessionToken, expiresAt } = response.data.data as {
      sessionToken: string;
      expiresAt: string;
    };

    this.sessionToken = sessionToken;
    this.expiresAt = new Date(expiresAt);

    // Notify listeners of new token
    this.onTokenRefresh?.(sessionToken);

    return sessionToken;
  }

  getAuthorizationHeader(): string {
    if (!this.sessionToken) {
      throw new UnauthorizedError('Not authenticated. Call login() first.');
    }
    return `Bearer ${this.sessionToken}`;
  }

  canRefresh(): boolean {
    return true; // Can always re-login with email/password
  }

  async refresh(): Promise<void> {
    await this.login();
  }

  isAuthenticated(): boolean {
    if (!this.sessionToken) return false;

    // Check if token is expired
    if (this.expiresAt && this.expiresAt <= new Date()) {
      this.sessionToken = null;
      return false;
    }

    return true;
  }

  getType(): 'session' {
    return 'session';
  }

  /**
   * Get the current session token (for storage)
   */
  getSessionToken(): string | null {
    return this.sessionToken;
  }

  /**
   * Get the token expiration time
   */
  getExpiresAt(): Date | null {
    return this.expiresAt;
  }

  /**
   * Clear the session (logout)
   */
  clearSession(): void {
    this.sessionToken = null;
    this.expiresAt = null;
  }
}

/**
 * Create an auth strategy from config
 */
export function createAuthStrategy(config: AuthConfig): AuthStrategy {
  // Priority 1: API key
  if (config.apiKey) {
    return new ApiKeyAuth(config.apiKey);
  }

  // Priority 2: Session token (already logged in)
  if (config.sessionToken && config.httpClient) {
    return new JwtSessionAuth(
      config.httpClient,
      { email: '', password: '' }, // Won't be used since we have a token
      config.onTokenRefresh,
      config.sessionToken
    );
  }

  // Priority 3: Email/password for session auth
  if (config.email && config.password && config.httpClient) {
    return new JwtSessionAuth(config.httpClient, { email: config.email, password: config.password }, config.onTokenRefresh);
  }

  throw new Error(
    'No valid credentials provided. Supply apiKey, sessionToken, or email/password.'
  );
}
