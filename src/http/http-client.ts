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

import { type QueryParams as _QP } from '@uluops/sdk-core/utils';
import { toSnakeCase } from '../utils/helpers.js';

/**
 * Convert a camelCase query object to snake_case QueryParams for the API.
 * Strips 'all' values (API doesn't accept 'all' as a filter — omit to get all).
 */
export function toApiQuery(query: object | undefined): _QP | undefined {
  if (!query) return undefined;
  const params: _QP = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (value === 'all') continue; // 'all' means no filter — omit the param
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params[toSnakeCase(key)] = value;
    }
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

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
