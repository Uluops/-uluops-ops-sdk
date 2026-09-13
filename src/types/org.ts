/**
 * Org scoping for a single call (project-org-routing-and-rehome spec §3.2, D12).
 *
 * Every project, run, issue and analytics operation accepts this as its last
 * argument. `org` is the target org's slug and becomes the `X-Org-Slug`
 * header on that one request, overriding the client-level `orgSlug`.
 *
 * Omit it to use the client's `orgSlug`, or — with neither — the key-holder's
 * personal org. The API never infers an org from a project name (spec D2):
 * a request that names no org creates or targets the PERSONAL project of that
 * name, even when a work org has a project by the same name. Name the org.
 */
export interface OrgScopedOptions {
  /** Org slug (1–100 chars: alphanumeric, hyphen, underscore). */
  org?: string;
}

/** Run write/preview options: client-side validation escape hatch + org scope. */
export interface RunCallOptions extends OrgScopedOptions {
  /**
   * Skip the SDK's input validation. A convenience escape for pre-validated
   * callers (MCP, autosave hooks); the server validates regardless.
   */
  _skipClientValidation?: boolean;
}
