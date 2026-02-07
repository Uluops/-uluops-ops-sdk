/**
 * OpsHttpClient — thin subclass of sdk-core's HttpClient
 *
 * Passes ops-sdk defaults (baseUrl, sdkName, loggerPrefix).
 * Keeps the same public HttpClientConfig interface for consumers.
 */

import { HttpClient } from '@uluops/sdk-core/http';
import { DEFAULT_BASE_URL, SDK_VERSION } from '../config/constants.js';

// Re-export query utilities so operations can continue to import from here
export { toQuery, type QueryParams, type QueryParamValue } from '@uluops/sdk-core/utils';

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
export class OpsHttpClient extends HttpClient {
  constructor(config: HttpClientConfig = {}) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      sdkName: '@uluops/ops-sdk',
      sdkVersion: SDK_VERSION,
      loggerPrefix: '[ops-sdk:http]',
    });
  }
}
