import type { z } from 'zod';
import type {
  AgentPerformanceResponseSchema,
  AgentLifecycleEntryResponseSchema,
  AgentReliabilityResponseSchema,
  AgentReliabilityResultResponseSchema,
  ResolutionRateResponseSchema,
  FileHotspotResponseSchema,
  TaxonomyDistributionResponseSchema,
  OutlierPointResponseSchema,
  ResidualDiagnosticsResponseSchema,
  DomainTrendResponseSchema,
  BurndownDataPointResponseSchema,
  BurndownResultResponseSchema,
  VelocityItemResponseSchema,
  VelocitySummaryResponseSchema,
  VelocityResultResponseSchema,
  DiscoveryDomainBreakdownSchema,
  DiscoveryTimelinePointResponseSchema,
  DiscoverySummaryResponseSchema,
  DiscoveryResultResponseSchema,
  AgentMatrixRowResponseSchema,
  BlindSpotResponseSchema,
  SinglePointFailureResponseSchema,
  HighOverlapResponseSchema,
  MatrixAnalysisResponseSchema,
  AgentMatrixResultResponseSchema,
  TrendSummaryResponseSchema,
  PeriodResponseSchema,
  FullTaxonomyAnalyticsResponseSchema,
} from './response-schemas.js';
import type { Granularity, DiscoveryGroupBy } from './enums.js';

// ============================================
// Single source of truth
//
// Every analytics response type below is derived from its Zod schema in
// response-schemas.ts via `z.infer`, so the public type can never drift from
// the shape the SDK actually parses at runtime. The only hand-written
// interfaces are query-option shapes (no wire representation) and `AgentInfo`
// (a client-side projection with no API endpoint, hence no schema).
// ============================================

/**
 * Common query options for analytics endpoints
 */
export interface AnalyticsQuery {
  project?: string;
  days?: number; // 1-365, default 30
  limit?: number; // 1-100
}

/** Time period metadata — derived from `PeriodResponseSchema`. */
export type Period = z.infer<typeof PeriodResponseSchema>;

// ============================================
// AGENT ANALYTICS
// ============================================

/**
 * Simplified agent info — a client-side projection built by `listAgents` from
 * agent performance data. No API endpoint returns this shape directly, so it
 * has no response schema.
 * @see {@link AgentInput} in runs.ts for the full agent projection map.
 */
export interface AgentInfo {
  name: string;
  totalRuns: number;
  averageScore: number;
  passRate: number;
}

/** Agent performance metrics — derived from `AgentPerformanceResponseSchema`. */
export type AgentPerformance = z.infer<typeof AgentPerformanceResponseSchema>;

/** Agent lifecycle entry (version trajectory across time) — derived from `AgentLifecycleEntryResponseSchema`. */
export type AgentLifecycleEntry = z.infer<typeof AgentLifecycleEntryResponseSchema>;

/** Agent reliability stats (per-agent element) — derived from `AgentReliabilityResponseSchema`. */
export type AgentReliability = z.infer<typeof AgentReliabilityResponseSchema>;

/**
 * Agent reliability query options
 */
export interface AgentReliabilityQuery {
  agent?: string;
  project?: string;
  days?: number;
}

// ============================================
// RESOLUTION ANALYTICS
// ============================================

/** Project resolution rate — derived from `ResolutionRateResponseSchema`. */
export type ResolutionRate = z.infer<typeof ResolutionRateResponseSchema>;

// ============================================
// FILE ANALYTICS
// ============================================

/** File hotspot (files with the most issues) — derived from `FileHotspotResponseSchema`. */
export type FileHotspot = z.infer<typeof FileHotspotResponseSchema>;

// ============================================
// TAXONOMY ANALYTICS
// ============================================

/** Basic taxonomy distribution — derived from `TaxonomyDistributionResponseSchema`. */
export type TaxonomyDistribution = z.infer<typeof TaxonomyDistributionResponseSchema>;

/**
 * Full taxonomy analytics (all aggregations from `/analytics/taxonomy/full`).
 * Derived from `FullTaxonomyAnalyticsResponseSchema`.
 *
 * Note: The SDK HttpClient auto-unwraps the API's `{ data }` envelope, so this
 * type represents the unwrapped content, not the raw API response.
 */
export type FullTaxonomyAnalytics = z.infer<typeof FullTaxonomyAnalyticsResponseSchema>;

// ============================================
// BURNDOWN ANALYTICS
// ============================================

/**
 * Burndown time-series data point — derived from `BurndownDataPointResponseSchema`.
 * Domain fields are dynamic — includes well-known domains (STR, SEM, PRA, EPI)
 * plus any server-defined domains.
 */
export type BurndownDataPoint = z.infer<typeof BurndownDataPointResponseSchema>;

/** Outlier detection result — derived from `OutlierPointResponseSchema`. */
export type OutlierPoint = z.infer<typeof OutlierPointResponseSchema>;

/** Residual diagnostics for trend reliability — derived from `ResidualDiagnosticsResponseSchema`. */
export type ResidualDiagnostics = z.infer<typeof ResidualDiagnosticsResponseSchema>;

/** Domain trend analysis — derived from `DomainTrendResponseSchema`. */
export type DomainTrend = z.infer<typeof DomainTrendResponseSchema>;

/** Burndown result — derived from `BurndownResultResponseSchema`. */
export type BurndownResult = z.infer<typeof BurndownResultResponseSchema>;

/**
 * Burndown query options
 */
export interface BurndownQuery extends AnalyticsQuery {
  granularity?: Granularity;
}

// ============================================
// VELOCITY ANALYTICS
// ============================================

/** Velocity item (rate of change per failure mode) — derived from `VelocityItemResponseSchema`. */
export type VelocityItem = z.infer<typeof VelocityItemResponseSchema>;

/** Velocity summary — derived from `VelocitySummaryResponseSchema`. */
export type VelocitySummary = z.infer<typeof VelocitySummaryResponseSchema>;

/** Velocity result — derived from `VelocityResultResponseSchema`. */
export type VelocityResult = z.infer<typeof VelocityResultResponseSchema>;

/**
 * Velocity query options
 */
export interface VelocityQuery extends AnalyticsQuery {
  alertThreshold?: number; // 10-500, default 50
}

// ============================================
// DISCOVERY ANALYTICS
// ============================================

/** Domain breakdown for discovery — derived from `DiscoveryDomainBreakdownSchema`. */
export type DiscoveryDomainBreakdown = z.infer<typeof DiscoveryDomainBreakdownSchema>;

/** Discovery timeline point — derived from `DiscoveryTimelinePointResponseSchema`. */
export type DiscoveryTimelinePoint = z.infer<typeof DiscoveryTimelinePointResponseSchema>;

/** Discovery summary — derived from `DiscoverySummaryResponseSchema`. */
export type DiscoverySummary = z.infer<typeof DiscoverySummaryResponseSchema>;

/** Discovery result — derived from `DiscoveryResultResponseSchema`. */
export type DiscoveryResult = z.infer<typeof DiscoveryResultResponseSchema>;

/**
 * Discovery query options
 */
export interface DiscoveryQuery extends AnalyticsQuery {
  groupBy?: DiscoveryGroupBy;
}

// ============================================
// AGENT MATRIX ANALYTICS
// ============================================

/**
 * Agent matrix row — coverage vector across failure domains.
 * Derived from `AgentMatrixRowResponseSchema`.
 * @see {@link AgentInput} in runs.ts for the full agent projection map.
 */
export type AgentMatrixRow = z.infer<typeof AgentMatrixRowResponseSchema>;

/** Blind spot (agent missing domain coverage) — derived from `BlindSpotResponseSchema`. */
export type BlindSpot = z.infer<typeof BlindSpotResponseSchema>;

/** Single point of failure (only one agent detects) — derived from `SinglePointFailureResponseSchema`. */
export type SinglePointFailure = z.infer<typeof SinglePointFailureResponseSchema>;

/** High overlap (multiple agents detect the same thing) — derived from `HighOverlapResponseSchema`. */
export type HighOverlap = z.infer<typeof HighOverlapResponseSchema>;

/** Matrix coverage analysis — derived from `MatrixAnalysisResponseSchema`. */
export type MatrixAnalysis = z.infer<typeof MatrixAnalysisResponseSchema>;

/** Agent matrix result — derived from `AgentMatrixResultResponseSchema`. */
export type AgentMatrixResult = z.infer<typeof AgentMatrixResultResponseSchema>;

/**
 * Agent matrix query options
 */
export interface AgentMatrixQuery extends AnalyticsQuery {
  minIssues?: number; // 1-1000, default 5
}

// ============================================
// TREND ANALYTICS
// ============================================

/** Weekly trend summary — one entry per period — derived from `TrendSummaryResponseSchema`. */
export type TrendSummary = z.infer<typeof TrendSummaryResponseSchema>;

// ============================================
// CLIENT RETURN-TYPE ALIASES
//
// Named `*Result` / `*Response` aliases used as the analytics method return
// types. Each derives from the same schema as its friendly-named twin above, so
// the two names are guaranteed identical — there is no second definition to
// drift from.
// ============================================

/** Agent reliability result from `GET /analytics/agent-reliability` */
export type AgentReliabilityResult = z.infer<typeof AgentReliabilityResultResponseSchema>;

/** Resolution rate entry from `GET /analytics/resolution-rates` */
export type ResolutionRateResult = z.infer<typeof ResolutionRateResponseSchema>;

/** File hotspot entry from `GET /analytics/file-hotspots` */
export type FileHotspotResult = z.infer<typeof FileHotspotResponseSchema>;

/** Taxonomy distribution entry from `GET /analytics/taxonomy` */
export type TaxonomyDistributionResult = z.infer<typeof TaxonomyDistributionResponseSchema>;

/** Full taxonomy analytics from `GET /analytics/taxonomy/full` */
export type FullTaxonomyAnalyticsResult = z.infer<typeof FullTaxonomyAnalyticsResponseSchema>;

/** Burndown result from `GET /analytics/burndown` */
export type BurndownResultResponse = z.infer<typeof BurndownResultResponseSchema>;

/** Velocity result from `GET /analytics/velocity` */
export type VelocityResultResponse = z.infer<typeof VelocityResultResponseSchema>;

/** Discovery result from `GET /analytics/discovery` */
export type DiscoveryResultResponse = z.infer<typeof DiscoveryResultResponseSchema>;

/** Agent matrix result from `GET /analytics/agent-matrix` */
export type AgentMatrixResultResponse = z.infer<typeof AgentMatrixResultResponseSchema>;

/** Trend summary entry from `GET /analytics/trends` */
export type TrendSummaryResult = z.infer<typeof TrendSummaryResponseSchema>;

// ============================================
// TAXONOMY
// ============================================

/**
 * Failure taxonomy reference data (domains, modes, severities).
 * Derived from TaxonomyResponseSchema — see response-schemas.ts.
 */
export type { TaxonomyResponse } from './response-schemas.js';
