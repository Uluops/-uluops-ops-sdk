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
 *
 * @remarks
 * Values of `'all'` are intentionally stripped — the API interprets an absent
 * filter parameter as "return all", so `status: 'all'` and omitting `status`
 * produce the same result. This convention is used by `StatusFilter` and
 * `PriorityFilter` union types which include `'all'` for consumer ergonomics.
 */
export function toApiQuery(query: object | undefined): _QP | undefined {
  if (!query) return undefined;
  const params: _QP = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (value === 'all') continue; // 'all' means no filter — omit the param
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params[toSnakeCase(key)] = value;
    } else if (Array.isArray(value)) {
      // Serialize arrays as comma-separated values (common API convention)
      const primitives = value.filter(v => typeof v === 'string' || typeof v === 'number');
      if (primitives.length > 0) {
        params[toSnakeCase(key)] = primitives.join(',');
      }
    }
    // Objects and other non-primitive values are intentionally skipped
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

/**
 * HTTP client configuration — shared base for OpsClient and OpsHttpClient.
 * OpsClientConfig extends this with higher-level options.
 */
export interface HttpClientConfig {
  /** API base URL (defaults to production; localhost:3100 when NODE_ENV=development) */
  baseUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Number of retries for transient errors */
  retries?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** API key for authentication (preferred) */
  apiKey?: string;
  /** Email for session-based auth */
  email?: string;
  /** Password for session-based auth */
  password?: string;
  /** Existing session token */
  sessionToken?: string;
  /** Callback when session token is refreshed */
  onTokenRefresh?: (token: string) => void;
  /** Org slug for multi-tenancy — sets X-Org-Slug header on all requests */
  orgSlug?: string;
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
      defaultHeaders: {
        ...(config.orgSlug ? { 'X-Org-Slug': config.orgSlug } : {}),
      },
    });
  }
}
