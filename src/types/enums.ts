/**
 * Issue priority levels
 */
export const Priority = {
  Critical: 'critical',
  Suggested: 'suggested',
  Backlog: 'backlog',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];
export const PRIORITIES = ['critical', 'suggested', 'backlog'] as const;

/**
 * Issue status values
 */
export const Status = {
  Open: 'open',
  Completed: 'completed',
  Deferred: 'deferred',
  Wontfix: 'wontfix',
  Merged: 'merged',
  FalsePositive: 'false-positive',
} as const;
export type Status = (typeof Status)[keyof typeof Status];
export const STATUSES = ['open', 'completed', 'deferred', 'wontfix', 'merged', 'false-positive'] as const;

/**
 * Status filter type (includes 'all' for query parameters)
 */
export type StatusFilter = Status | 'all';

/**
 * Issue severity levels
 */
export const Severity = {
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
  Info: 'info',
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];
export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;

/**
 * Failure taxonomy domains
 */
export const FailureDomain = {
  STR: 'STR', // Structural
  SEM: 'SEM', // Semantic
  PRA: 'PRA', // Pragmatic
  EPI: 'EPI', // Epistemic
} as const;
export type FailureDomain = (typeof FailureDomain)[keyof typeof FailureDomain];
export const FAILURE_DOMAINS = ['STR', 'SEM', 'PRA', 'EPI'] as const;

/**
 * Failure severity codes (single letter)
 */
export const FailureSeverityCode = {
  Critical: 'C',
  High: 'H',
  Medium: 'M',
  Low: 'L',
  Info: 'I',
} as const;
export type FailureSeverityCode = (typeof FailureSeverityCode)[keyof typeof FailureSeverityCode];
export const FAILURE_SEVERITY_CODES = ['C', 'H', 'M', 'L', 'I'] as const;

/**
 * Issue types
 */
export const IssueType = {
  Feature: 'feature',
  Bug: 'bug',
  Refactor: 'refactor',
  Config: 'config',
  Docs: 'docs',
  Infra: 'infra',
  Security: 'security',
  Test: 'test',
} as const;
export type IssueType = (typeof IssueType)[keyof typeof IssueType];
export const ISSUE_TYPES = [
  'feature',
  'bug',
  'refactor',
  'config',
  'docs',
  'infra',
  'security',
  'test',
] as const;

/**
 * Issue note types
 */
export const NoteType = {
  Context: 'context',
  Resolution: 'resolution',
  Blocker: 'blocker',
} as const;
export type NoteType = (typeof NoteType)[keyof typeof NoteType];
export const NOTE_TYPES = ['context', 'resolution', 'blocker'] as const;

/**
 * Classification confidence levels
 */
export const ClassificationConfidence = {
  High: 'high',
  Medium: 'medium',
  Low: 'low',
} as const;
export type ClassificationConfidence =
  (typeof ClassificationConfidence)[keyof typeof ClassificationConfidence];

/**
 * Classification sources
 */
export const ClassifiedBy = {
  Validator: 'validator',
  Classifier: 'classifier',
  Human: 'human',
} as const;
export type ClassifiedBy = (typeof ClassifiedBy)[keyof typeof ClassifiedBy];

/**
 * User roles
 */
export const UserRole = {
  Viewer: 'viewer',
  Developer: 'developer',
  Publisher: 'publisher',
  Admin: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const USER_ROLES = ['viewer', 'developer', 'publisher', 'admin'] as const;

/**
 * Subscription tiers
 */
export const SubscriptionTier = {
  Free: 'free',
  Pro: 'pro',
  Enterprise: 'enterprise',
} as const;
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];
export const SUBSCRIPTION_TIERS = ['free', 'pro', 'enterprise'] as const;

/**
 * Avatar MIME types
 */
export const AvatarMimeType = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  WebP: 'image/webp',
} as const;
export type AvatarMimeType = (typeof AvatarMimeType)[keyof typeof AvatarMimeType];
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;

/**
 * Trend directions for analytics
 */
export const Trend = {
  Improving: 'improving',
  Stable: 'stable',
  Degrading: 'degrading',
} as const;
export type Trend = (typeof Trend)[keyof typeof Trend];

/**
 * Time granularity for analytics
 */
export const Granularity = {
  Daily: 'daily',
  Weekly: 'weekly',
} as const;
export type Granularity = (typeof Granularity)[keyof typeof Granularity];

/**
 * Discovery grouping options
 */
export const DiscoveryGroupBy = {
  Day: 'day',
  Week: 'week',
  Month: 'month',
} as const;
export type DiscoveryGroupBy = (typeof DiscoveryGroupBy)[keyof typeof DiscoveryGroupBy];

/**
 * Bulk operation failure reasons
 */
export const BulkFailureReason = {
  NotFound: 'NOT_FOUND',
  SelfDeactivate: 'SELF_DEACTIVATE',
  LastAdmin: 'LAST_ADMIN',
  AlreadyDeactivated: 'ALREADY_DEACTIVATED',
} as const;
export type BulkFailureReason = (typeof BulkFailureReason)[keyof typeof BulkFailureReason];

/**
 * Failure code regex pattern
 * Format: DOMAIN-MODE/SEVERITY (e.g., SEM-VAL/H)
 */
export const FAILURE_CODE_PATTERN = /^(STR|SEM|PRA|EPI)-[A-Z]{3}\/[CHMLI]$/;

/**
 * Failure mode pattern (without severity)
 * Format: DOMAIN-MODE (e.g., SEM-VAL)
 */
export const FAILURE_MODE_PATTERN = /^(STR|SEM|PRA|EPI)-[A-Z]{3}$/;

/**
 * Map severity codes to severity values
 */
export const SEVERITY_CODE_MAP: Record<FailureSeverityCode, Severity> = {
  C: 'critical',
  H: 'high',
  M: 'medium',
  L: 'low',
  I: 'info',
};

/**
 * Convert severity code to severity value
 */
export function severityFromCode(code: string | null | undefined): Severity | null {
  if (!code || !(code in SEVERITY_CODE_MAP)) return null;
  return SEVERITY_CODE_MAP[code as FailureSeverityCode];
}

/**
 * Parse a failure code into its components
 */
export function parseFailureCode(code: string): {
  domain: FailureDomain;
  mode: string;
  severityCode: FailureSeverityCode;
} | null {
  if (!FAILURE_CODE_PATTERN.test(code)) return null;

  const slashIndex = code.indexOf('/');
  const dashIndex = code.indexOf('-');

  // These checks are technically redundant due to regex validation,
  // but satisfy TypeScript and provide runtime safety
  if (slashIndex === -1 || dashIndex === -1) return null;

  const domain = code.slice(0, dashIndex);
  const mode = code.slice(dashIndex + 1, slashIndex);
  const severityCode = code.slice(slashIndex + 1);

  if (!FAILURE_DOMAINS.includes(domain as FailureDomain)) return null;
  if (!FAILURE_SEVERITY_CODES.includes(severityCode as FailureSeverityCode)) return null;

  return {
    domain: domain as FailureDomain,
    mode,
    severityCode: severityCode as FailureSeverityCode,
  };
}

/**
 * Build a failure code from components
 */
export function buildFailureCode(
  domain: FailureDomain,
  mode: string,
  severityCode: FailureSeverityCode
): string {
  return `${domain}-${mode}/${severityCode}`;
}
