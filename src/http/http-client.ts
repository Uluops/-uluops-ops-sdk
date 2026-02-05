import axios, { type AxiosInstance, type AxiosError, type AxiosRequestConfig } from 'axios';
import {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT,
  DEFAULT_RETRY_COUNT,
  BACKOFF_BASE_MS,
  MAX_BACKOFF_MS,
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
 * HTTP client for ops-uluops-api
 */
export class OpsHttpClient {
  private readonly client: AxiosInstance;
  private readonly authStrategy: AuthStrategy | null;
  private readonly logger: Logger;
  private readonly retries: number;

  constructor(config: HttpClientConfig = {}) {
    this.logger = createLogger(config.debug ?? false);
    this.retries = config.retries ?? DEFAULT_RETRY_COUNT;

    // Create axios instance
    this.client = axios.create({
      baseURL: config.baseUrl ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
    });

    // Create auth strategy if credentials provided
    const hasCredentials = config.apiKey || config.sessionToken || (config.email && config.password);
    if (hasCredentials) {
      const authConfig: AuthConfig = {
        apiKey: config.apiKey,
        email: config.email,
        password: config.password,
        sessionToken: config.sessionToken,
        httpClient: this.client,
        onTokenRefresh: config.onTokenRefresh,
      };
      this.authStrategy = createAuthStrategy(authConfig);

      // Add request interceptor for auth
      this.client.interceptors.request.use((requestConfig) => {
        if (this.authStrategy) {
          requestConfig.headers.Authorization = this.authStrategy.getAuthorizationHeader();
        }
        return requestConfig;
      });
    } else {
      this.authStrategy = null;
    }

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `${response.config.method?.toUpperCase()} ${response.config.url} -> ${response.status}`
        );
        return response;
      },
      (error) => {
        if (axios.isAxiosError(error)) {
          this.logger.debug(
            `${error.config?.method?.toUpperCase()} ${error.config?.url} -> ${error.response?.status ?? 'NETWORK_ERROR'}`
          );
        }
        throw error;
      }
    );
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
        const config: AxiosRequestConfig = {
          method,
          url: endpoint,
          headers: options?.headers,
        };

        if (method === 'GET') {
          config.params = data;
        } else {
          config.data = data;
          config.params = options?.params;
        }

        const response = await this.client.request<{ data: T }>(config);
        return response.data.data;
      } catch (error) {
        lastError = this.handleError(error);

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

        // Handle 401 with token refresh
        if (
          lastError instanceof UnauthorizedError &&
          this.authStrategy?.canRefresh() &&
          attempt === 1
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
   * Make a request that returns the full response (for non-standard responses)
   */
  async requestRaw<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: object,
    options?: { params?: object; headers?: Record<string, string> }
  ): Promise<T> {
    const config: AxiosRequestConfig = {
      method,
      url: endpoint,
      headers: options?.headers,
    };

    if (method === 'GET') {
      config.params = data;
    } else {
      config.data = data;
      config.params = options?.params;
    }

    try {
      const response = await this.client.request<T>(config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
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
   * Transform axios error to OpsApiError
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      return this.handleAxiosError(error);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }

  /**
   * Handle axios-specific errors
   */
  private handleAxiosError(error: AxiosError): Error {
    const { response, code, config } = error;

    // Network errors
    if (code === 'ECONNABORTED') {
      return new TimeoutError(config?.timeout ?? DEFAULT_TIMEOUT);
    }

    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      return new NetworkError(`Cannot connect to ${config?.baseURL}`);
    }

    if (!response) {
      return new NetworkError(error.message);
    }

    // Server errors
    const { status, data, headers } = response;
    const apiError = (data as { error?: { code?: string; message?: string; details?: Record<string, unknown> } })?.error;
    const requestId = headers['x-request-id'] as string | undefined;

    return createErrorFromStatus(
      status,
      apiError?.message ?? error.message,
      apiError?.code,
      apiError?.details,
      requestId
    );
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
    // Add jitter (10-20% random)
    const jitter = delay * (0.1 + Math.random() * 0.1);
    return Math.min(delay + jitter, MAX_BACKOFF_MS);
  }
}
