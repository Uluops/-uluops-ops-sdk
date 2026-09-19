import type { WithResponseContext } from '@uluops/sdk-core/http';
export type { ResponseContext, WithResponseContext } from '@uluops/sdk-core/http';
export type ContextResult<T, C extends boolean> = C extends true ? WithResponseContext<T> : T;

/**
 * Org scoping for a single call (project-org-routing-and-rehome spec §3.2, D12).
 *
 * Every project, run, issue and analytics operation accepts this as its last
 * argument. `org` is the target org's slug and becomes the `X-Org-Slug`
 * header on that one request, overriding the client-level `orgSlug`.
 *
 * Omission sends no per-call org override. A bound API key resolves to its bound
 * org; other credentials use server defaults. Only response context establishes
 * the effective org. Never infer it from omission or a project name.
 */
export interface OrgScopedOptions<C extends boolean = false> {
  /** Return data plus authenticated context from this operation's final response. */
  withResponseContext?: C;
  /** Org slug (1–100 chars: alphanumeric, hyphen, underscore). */
  org?: string;
}

/** Run write/preview options: client-side validation escape hatch + org scope. */
export interface RunCallOptions<C extends boolean = false> extends OrgScopedOptions<C> {
  /**
   * Skip the SDK's input validation. A convenience escape for pre-validated
   * callers (MCP, autosave hooks); the server validates regardless.
   */
  _skipClientValidation?: boolean;
}
