/**
 * OpsHttpClient — HTTP subclass of sdk-core's HttpClient.
 *
 * Passes ops-sdk defaults (baseUrl, sdkName, loggerPrefix) and adds
 * multi-tenancy headers. The SDK's substantial surface — input validation,
 * Zod response schemas, analytics operations, auth management — lives
 * above this layer.
 */

import { HttpClient } from '@uluops/sdk-core/http';
import type { SecurityEventHandler } from '@uluops/sdk-core/http';
import { DEFAULT_BASE_URL, SDK_VERSION } from '../config/constants.js';
import { InputValidationError } from '../config/validators.js';

// Re-export query utilities so operations can continue to import from here
export { toQuery, type QueryParams, type QueryParamValue } from '@uluops/sdk-core/utils';

// Re-export the structured security-event types so consumers can type their
// onSecurityEvent handler (the channel is forwarded to sdk-core via the config
// spread in the OpsHttpClient constructor).
export type {
  SecurityEvent,
  SecurityEventType,
  SecurityEventHandler,
  AuthType,
  AuthFailureEvent,
  RedirectRejectedEvent,
  TokenRefreshFailedEvent,
  AuthStrategyReplacedEvent,
} from '@uluops/sdk-core/http';

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
 *
 * `'all'` is passed through as a literal because the API's `/issues` endpoint
 * defaults to open-only when status is absent. The repository layer treats
 * `status=all` as the explicit "no status filter" sentinel.
 */
export function toApiQuery(query: object | undefined): _QP | undefined {
  if (!query) return undefined;
  const params: _QP = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
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
  /** Called when rate limit remaining drops below threshold (default: 10%) */
  onRateLimitApproaching?: (info: import('@uluops/sdk-core').RateLimitInfo) => void;
  /** Ratio of remaining/limit that triggers the rate limit callback (default: 0.1) */
  rateLimitThreshold?: number;
  /** Called before each retry attempt with attempt info and backoff delay */
  onRetry?: (info: { attempt: number; maxAttempts: number; error: Error; delayMs: number }) => void;
  /**
   * Called when a security-relevant event occurs — a rejected credential, a
   * blocked upstream redirect, a failed token refresh, or a credential swap.
   * Structured, routable telemetry (see `SecurityEvent`). Forwarded to sdk-core.
   */
  onSecurityEvent?: SecurityEventHandler;
  /** Org slug for multi-tenancy — sets X-Org-Slug header on all requests */
  orgSlug?: string;
}

/** Alphanumeric + hyphens/underscores, 1–100 chars */
export const ORG_SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;

/** The header the tracker's org-context middleware reads (after `:slug` and `X-Org-Id`). */
export const ORG_SLUG_HEADER = 'X-Org-Slug';

function assertOrgSlug(value: string, path: string): void {
  if (!ORG_SLUG_PATTERN.test(value)) {
    throw new InputValidationError(
      `Invalid ${path}: must be 1-100 alphanumeric characters, hyphens, or underscores`,
      [{ code: 'custom', path: [path], message: 'must be 1-100 alphanumeric characters, hyphens, or underscores' }]
    );
  }
}

/**
 * HTTP client for ops-uluops-api using native fetch
 */
export class OpsHttpClient extends HttpClient {
  /**
   * Construct a low-level HTTP client for ops-uluops-api.
   *
   * @param config - {@link HttpClientConfig}. When `orgSlug` is provided it is
   *   validated against `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$` and set as the
   *   `X-Org-Slug` header on every request; the strict pattern prevents header
   *   injection via CRLF or whitespace.
   * @throws {InputValidationError} If `orgSlug` is present but not 1–100
   *   alphanumeric characters, hyphens, or underscores.
   */
  /**
   * Per-call org override (project-org-routing-and-rehome spec §3.2, 6.2.0).
   * Set only on views minted by {@link withOrg}; the root client never has one.
   */
  private orgOverride?: string;
  /**
   * Set instead of throwing when `withOrg` is handed an invalid slug: every
   * method on OpsClient returns a Promise, so the caller's `.catch`/`await`
   * must see the error — a synchronous throw from inside a non-async arrow
   * would escape both. Surfaced as a rejection of the view's first request.
   */
  private orgInvalid?: InputValidationError;

  constructor(config: HttpClientConfig = {}) {
    if (config.orgSlug) assertOrgSlug(config.orgSlug, 'orgSlug');
    super({
      ...config,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      sdkName: '@uluops/ops-sdk',
      sdkVersion: SDK_VERSION,
      loggerPrefix: '[ops-sdk:http]',
      defaultHeaders: {
        ...(config.orgSlug ? { [ORG_SLUG_HEADER]: config.orgSlug } : {}),
      },
    });
  }

  /**
   * A view of this client whose every request carries `X-Org-Slug: <org>`,
   * overriding the constructor-level `orgSlug` (per-request headers win over
   * `defaultHeaders` in sdk-core). The view shares this client's auth
   * strategy, fetch adapter and configuration — it is the same client, seen
   * through one org — so a session installed on the root is honoured here.
   *
   * Precedence on the wire, lowest to highest: personal org (no header) <
   * constructor `orgSlug` < this per-call `org`. An API key BOUND to an org
   * ignores both headers and 403s (`ORG_ACCESS_DENIED`) if they name a
   * different org — that is the platform's rule, surfaced verbatim.
   *
   * An invalid `org` (not 1–100 alphanumeric characters, hyphens, or
   * underscores — the same pattern as `orgSlug`; it is a header value, so
   * CRLF/whitespace can never reach the wire) does not throw here: the view's
   * requests REJECT with `InputValidationError` before anything is sent, so
   * `await client.projects.list({ org })` fails the way every other input
   * error does.
   */
  withOrg(org: string): OpsHttpClient {
    // `"personal"` is the reserved no-org value (the same sentinel the
    // workspace file uses): the root client, no per-call header. It does not
    // cancel a constructor-level `orgSlug` — that is a defaultHeader sdk-core
    // always sends; callers that need "personal despite a constructor org"
    // construct without one (the tracker MCP has none since 2.1.0).
    if (org === 'personal') return this;
    // Prototype-chained view: reads (auth strategy, adapter, config) fall
    // through to this instance; only the override fields are set on the view.
    // sdk-core's verbs (get/post/patch/put/delete) all delegate to `request`,
    // so the override below covers every operation without touching them.
    const view: OpsHttpClient = Object.create(this) as OpsHttpClient;
    try {
      assertOrgSlug(org, 'org');
      view.orgOverride = org;
    } catch (err) {
      view.orgInvalid = err as InputValidationError;
    }
    return view;
  }

  /** The org this view is scoped to, or `undefined` on the root client. */
  get scopedOrg(): string | undefined {
    return this.orgOverride;
  }

  override request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: object,
    options?: {
      params?: object;
      retries?: number;
      retryMutations?: boolean;
      headers?: Record<string, string>;
      skipAuth?: boolean;
      rawEnvelope?: boolean;
    }
  ): Promise<T> {
    if (this.orgInvalid) return Promise.reject(this.orgInvalid);
    if (this.orgOverride === undefined) return super.request<T>(method, endpoint, data, options);
    // The per-call org is set LAST so a caller-supplied header cannot outrank
    // it, and an org header in `options.headers` is refused outright: until
    // 6.3.1 the spread order let `options.headers` win, and `X-Org-Id`
    // outranks `X-Org-Slug` on the server, so a smuggled header would have
    // silently redirected a scoped call (run #187, circumvention A7 /
    // trust-boundary F7 — no live caller did this; the invariant held by luck).
    const smuggled = Object.keys(options?.headers ?? {}).find((h) => /^x-org-(slug|id)$/i.test(h));
    if (smuggled !== undefined) {
      return Promise.reject(new InputValidationError(
        `Refusing request header ${smuggled} on an org-scoped call: the per-call org (${this.orgOverride}) is the only org channel`,
        [{ code: 'custom', path: ['headers', smuggled], message: 'org headers may not be set per request on a scoped view' }]
      ));
    }
    return super.request<T>(method, endpoint, data, {
      ...options,
      headers: { ...(options?.headers ?? {}), [ORG_SLUG_HEADER]: this.orgOverride },
    });
  }
}
