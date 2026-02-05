import {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT,
  DEFAULT_RETRY_COUNT,
  BACKOFF_BASE_MS,
  MAX_BACKOFF_MS,
  JITTER_MIN,
  JITTER_MAX,
  USER_AGENT,
} from '../config/constants.js';
import {
  OpsApiError,
  createErrorFromStatus,
  NetworkError,
  TimeoutError,
  UnauthorizedError,
} from '../errors/errors.js';
import { createAuthStrategy, type AuthStrategy, type AuthConfig } from './auth-strategy.js';
import type { FetchClient } from './fetch-adapter.js';
import { createLogger, type Logger } from '../utils/logger.js';
import { sleep } from '../utils/helpers.js';

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  debug?: boolean;
  apiKey?: string;
  email?: string;
  password?: string;
  sessionToken?: string;
  onTokenRefresh?: (token: string) => void;
}

/**
 * HTTP client for ops-uluops-api using native fetch
 */
export class OpsHttpClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly authStrategy: AuthStrategy | null;
  private readonly logger: Logger;
  private readonly retries: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config: HttpClientConfig = {}) {
    this.logger = createLogger('[ops-sdk:http]', config.debug ?? false);
    this.retries = config.retries ?? DEFAULT_RETRY_COUNT;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    };

    // Create auth strategy if credentials provided
    const hasCredentials = config.apiKey || config.sessionToken || (config.email && config.password);
    if (hasCredentials) {
      const authConfig: AuthConfig = {
        apiKey: config.apiKey,
        email: config.email,
        password: config.password,
        sessionToken: config.sessionToken,
        httpClient: this.createFetchClient(),
        onTokenRefresh: config.onTokenRefresh,
      };
      this.authStrategy = createAuthStrategy(authConfig);
    } else {
      this.authStrategy = null;
    }
  }

  /**
   * Create a minimal FetchClient for auth strategy use (login/refresh)
   * This doesn't use auth headers since it's used for authentication itself
   */
  private createFetchClient(): FetchClient {
    return {
      post: async <T>(url: string, body: object) => {
        const fullUrl = new URL(url, this.baseUrl).toString();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetch(fullUrl, {
            method: 'POST',
            headers: this.defaultHeaders,
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw this.createHttpError(response.status, data, response.headers);
          }

          const data = await response.json();
          return { data } as { data: { data: T } };
        } catch (error) {
          throw this.handleFetchError(error);
        } finally {
          clearTimeout(timeoutId);
        }
      },
    };
  }

  /**
   * Make an authenticated request
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: object,
    options?: { params?: object; retries?: number; headers?: Record<string, string> }
  ): Promise<T> {
    const maxRetries = options?.retries ?? this.retries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.doFetch<T>(method, endpoint, data, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        const shouldRetry =
          lastError instanceof OpsApiError &&
          lastError.isRetryable() &&
          attempt < maxRetries;

        if (shouldRetry) {
          const delay = this.calculateBackoff(attempt);
          this.logger.debug(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
          await sleep(delay);
          continue;
        }

        // Handle 401 with token refresh (only on first attempt to prevent loops)
        const isFirstAttempt = attempt === 1;
        if (
          lastError instanceof UnauthorizedError &&
          this.authStrategy?.canRefresh() &&
          isFirstAttempt
        ) {
          try {
            this.logger.debug('Token expired, attempting refresh...');
            await this.authStrategy.refresh();
            continue; // Retry the request
          } catch {
            // Refresh failed, throw original error
          }
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error('Request failed');
  }

  /**
   * Execute a fetch request
   */
  private async doFetch<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: object,
    options?: { params?: object; headers?: Record<string, string> }
  ): Promise<T> {
    // Build URL with query params
    // Concatenate baseUrl and endpoint like axios does
    const url = new URL(this.buildUrl(endpoint));

    // For GET requests, data goes into query params
    // For other methods, params go into query string
    const queryParams = method === 'GET' ? data : options?.params;
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    // Build headers (replaces request interceptor)
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options?.headers,
    };
    if (this.authStrategy) {
      headers['Authorization'] = this.authStrategy.getAuthorizationHeader();
    }

    // Prepare request body
    const body = method !== 'GET' ? JSON.stringify(data) : undefined;

    // Fetch with timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      // Log response (replaces response interceptor)
      this.logger.debug(`${method} ${endpoint} -> ${response.status}`);

      // Handle errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createHttpError(response.status, errorData, response.headers);
      }

      const responseData = (await response.json()) as { data: T };
      return responseData.data;
    } catch (error) {
      // Log error responses
      if (error instanceof OpsApiError) {
        this.logger.debug(`${method} ${endpoint} -> ${error.statusCode ?? 'ERROR'}`);
      }
      throw this.handleFetchError(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Make a request that returns the full response (for non-standard responses)
   */
  async requestRaw<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: object,
    options?: { params?: object; headers?: Record<string, string> }
  ): Promise<T> {
    // Build URL with query params
    const url = new URL(this.buildUrl(endpoint));
    const queryParams = method === 'GET' ? data : options?.params;
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    // Build headers
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options?.headers,
    };
    if (this.authStrategy) {
      headers['Authorization'] = this.authStrategy.getAuthorizationHeader();
    }

    // Prepare request body
    const body = method !== 'GET' ? JSON.stringify(data) : undefined;

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createHttpError(response.status, errorData, response.headers);
      }

      return (await response.json()) as T;
    } catch (error) {
      throw this.handleFetchError(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * GET request helper
   */
  async get<T>(endpoint: string, params?: object): Promise<T> {
    return this.request<T>('GET', endpoint, params);
  }

  /**
   * POST request helper
   */
  async post<T>(endpoint: string, data?: object): Promise<T> {
    return this.request<T>('POST', endpoint, data);
  }

  /**
   * PATCH request helper
   */
  async patch<T>(endpoint: string, data?: object, options?: { params?: object }): Promise<T> {
    return this.request<T>('PATCH', endpoint, data, options);
  }

  /**
   * PUT request helper
   */
  async put<T>(endpoint: string, data?: object): Promise<T> {
    return this.request<T>('PUT', endpoint, data);
  }

  /**
   * DELETE request helper
   */
  async delete<T>(endpoint: string, data?: object): Promise<T> {
    return this.request<T>('DELETE', endpoint, data);
  }

  /**
   * Get the auth strategy (for session management)
   */
  getAuthStrategy(): AuthStrategy | null {
    return this.authStrategy;
  }

  /**
   * Create an HTTP error from response data
   */
  private createHttpError(
    status: number,
    data: unknown,
    headers: Headers
  ): OpsApiError {
    const apiError = (data as { error?: { code?: string; message?: string; details?: Record<string, unknown> } })?.error;
    const requestId = headers.get('x-request-id') ?? undefined;

    return createErrorFromStatus(
      status,
      apiError?.message ?? `HTTP ${status}`,
      apiError?.code,
      apiError?.details,
      requestId
    );
  }

  /**
   * Handle fetch-specific errors (network, timeout, etc.)
   */
  private handleFetchError(error: unknown): Error {
    // Already transformed to OpsApiError
    if (error instanceof OpsApiError) {
      return error;
    }

    // Timeout via AbortController
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new TimeoutError(this.timeout);
    }

    // Network errors (fetch throws TypeError for network issues)
    if (error instanceof TypeError) {
      return new NetworkError(error.message);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoff(attempt: number): number {
    const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
    const jitterRange = JITTER_MAX - JITTER_MIN;
    const jitter = delay * (JITTER_MIN + Math.random() * jitterRange);
    return Math.min(delay + jitter, MAX_BACKOFF_MS);
  }

  /**
   * Build full URL by concatenating baseUrl and endpoint like axios does.
   * Unlike `new URL(endpoint, baseUrl)`, this preserves the base path.
   */
  private buildUrl(endpoint: string): string {
    // Remove trailing slash from base, leading slash from endpoint, then join
    const base = this.baseUrl.replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${path}`;
  }
}
