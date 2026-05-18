import type { FailureDomain, Trend, Granularity, DiscoveryGroupBy } from './enums.js';

/**
 * Common query options for analytics endpoints
 */
export interface AnalyticsQuery {
  project?: string;
  days?: number; // 1-365, default 30
  limit?: number; // 1-100
}

/**
 * Time period metadata
 */
export interface Period {
  start: string;
  end: string;
  days: number;
}

// ============================================
// AGENT ANALYTICS
// ============================================

/**
 * Simplified agent info (from performance data)
 */
export interface AgentInfo {
  name: string;
  totalRuns: number;
  avgScore: number;
  passRate: number;
}

/**
 * Agent performance metrics
 */
export interface AgentPerformance {
  name: string;
  totalRuns: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  passRate: number;
  avgDurationMs: number | null;
  totalIssuesFound: number;
}

/**
 * Agent lifecycle entry — version trajectory across time
 */
export interface AgentLifecycleEntry {
  name: string;
  definitionVersion: string;
  firstSeenAt: string;
  runs: number;
  avgScore: number;
  passRate: number;
}

/**
 * Agent reliability stats
 */
export interface AgentReliability {
  name: string;
  totalIssues: number;
  falsePositiveRate: number;
  resolutionRate: number;
  avgTimeToResolveDays: number | null;
  reliabilityScore: number;
}

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

/**
 * Project resolution rate
 */
export interface ResolutionRate {
  project: string;
  totalIssues: number;
  resolvedIssues: number;
  resolutionRate: number;
  avgTimeToResolveDays: number | null;
}

// ============================================
// FILE ANALYTICS
// ============================================

/**
 * File hotspot (files with most issues)
 */
export interface FileHotspot {
  filePath: string;
  totalIssues: number;
  openIssues: number;
  resolvedIssues: number;
  topAgents: string[];
}

// ============================================
// TAXONOMY ANALYTICS
// ============================================

/**
 * Basic taxonomy distribution
 */
export interface TaxonomyDistribution {
  domain: FailureDomain;
  mode: string;
  count: number;
  percentage: number;
}

/**
 * Full taxonomy analytics (all aggregations from /analytics/taxonomy/full)
 *
 * Note: The SDK HttpClient auto-unwraps the API's `{ data }` envelope,
 * so this type represents the unwrapped content, not the raw API response.
 */
export interface FullTaxonomyAnalytics {
  byDomain: Array<{
    domain: FailureDomain;
    label: string;
    count: number;
    percentage: number;
  }>;
  bySeverity: Array<{
    severity: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  byMode: Array<{
    mode: string;
    label: string;
    domain: FailureDomain;
    domainLabel: string;
    count: number;
    percentage: number;
  }>;
  topCodes: Array<{
    code: string;
    domain: string;
    mode: string;
    severity: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  heatmapData: Array<{
    domain: string;
    domainLabel: string;
    mode: string;
    modeLabel: string;
    count: number;
    percentage: number;
    intensity: number;
  }>;
  totals: {
    totalIssues: number;
    classifiedIssues: number;
    unclassifiedIssues: number;
    classificationRate: number;
  };
  period: Period;
}

// ============================================
// BURNDOWN ANALYTICS
// ============================================

/**
 * Burndown time series data point
 */
export interface BurndownDataPoint {
  date: string;
  STR: number;
  SEM: number;
  PRA: number;
  EPI: number;
  total: number;
}

/**
 * Outlier detection result
 */
export interface OutlierPoint {
  date: string;
  value: number;
  direction: 'high' | 'low';
}

/**
 * Residual diagnostics for trend reliability
 */
export interface ResidualDiagnostics {
  durbinWatson: number;
  autocorrelation: 'none' | 'positive' | 'negative' | 'inconclusive';
  varianceRatio: number | null;
  heteroscedasticity: 'constant' | 'increasing' | 'decreasing' | 'inconclusive';
  skewness: number;
  runsTestZ: number;
  assumptionScore: number;
  warnings: string[];
}

/**
 * Domain trend analysis
 */
export interface DomainTrend {
  netChange: number;
  trend: Trend;
  avgDailyChange: number;
  confidence: 'high' | 'medium' | 'low';
  sampleSize: number;
  rSquared: number;
  standardError: number;
  confidenceInterval: [number, number];
  outliers: OutlierPoint[];
  diagnostics: ResidualDiagnostics | null;
  ciReliable: boolean;
  warnings: string[];
  weeklyPatternDetected: boolean;
}

/**
 * Burndown result
 */
export interface BurndownResult {
  timeSeries: BurndownDataPoint[];
  trends: {
    STR: DomainTrend;
    SEM: DomainTrend;
    PRA: DomainTrend;
    EPI: DomainTrend;
  };
  period: Period;
}

/**
 * Burndown query options
 */
export interface BurndownQuery extends AnalyticsQuery {
  granularity?: Granularity;
}

// ============================================
// VELOCITY ANALYTICS
// ============================================

/**
 * Velocity item (rate of change per failure mode)
 */
export interface VelocityItem {
  domain: FailureDomain;
  mode: string;
  failureCode: string;
  currentCount: number;
  previousCount: number;
  velocityPercent: number;
  alert: boolean;
  sparkline: number[];
  trendReliability: 'high' | 'medium' | 'low';
}

/**
 * Velocity summary
 */
export interface VelocitySummary {
  improving: string[];
  stable: string[];
  degrading: string[];
  mostImproved: string | null;
  mostConcerning: string | null;
}

/**
 * Velocity result
 */
export interface VelocityResult {
  items: VelocityItem[];
  summary: VelocitySummary;
  period: Period;
}

/**
 * Velocity query options
 */
export interface VelocityQuery extends AnalyticsQuery {
  alertThreshold?: number; // 10-500, default 50
}

// ============================================
// DISCOVERY ANALYTICS
// ============================================

/**
 * Domain breakdown for discovery
 */
export interface DiscoveryDomainBreakdown {
  new: number;
  recurring: number;
}

/**
 * Discovery timeline point
 */
export interface DiscoveryTimelinePoint {
  period: string;
  newIssues: number;
  recurringIssues: number;
  domains: Record<FailureDomain, DiscoveryDomainBreakdown>;
}

/**
 * Discovery summary
 */
export interface DiscoverySummary {
  totalNew: number;
  totalRecurring: number;
  newToRecurringRatio: number | null;
  peakNewPeriod: { period: string; count: number } | null;
}

/**
 * Discovery result
 */
export interface DiscoveryResult {
  timeline: DiscoveryTimelinePoint[];
  summary: DiscoverySummary;
  period: Period;
}

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
 * Agent matrix row
 */
export interface AgentMatrixRow {
  agent: string;
  domains: Record<FailureDomain, number>;
  total: number;
  coverage: number;
  coveragePercent: number;
}

/**
 * Blind spot (agent missing domain coverage)
 */
export interface BlindSpot {
  agent: string;
  missingDomains: FailureDomain[];
}

/**
 * Single point of failure (only one agent detects)
 */
export interface SinglePointFailure {
  domain: FailureDomain;
  mode: string;
  onlyAgent: string;
}

/**
 * High overlap (multiple agents detect same thing)
 */
export interface HighOverlap {
  mode: string;
  agentCount: number;
  agents: string[];
}

/**
 * Matrix coverage analysis
 */
export interface MatrixAnalysis {
  blindSpots: BlindSpot[];
  singlePoints: SinglePointFailure[];
  highOverlap: HighOverlap[];
}

/**
 * Agent matrix result
 */
export interface AgentMatrixResult {
  matrix: AgentMatrixRow[];
  analysis: MatrixAnalysis;
}

/**
 * Agent matrix query options
 */
export interface AgentMatrixQuery extends AnalyticsQuery {
  minIssues?: number; // 1-1000, default 5
}

// ============================================
// TREND ANALYTICS
// ============================================

/**
 * Weekly trend summary — one entry per period (e.g., "Week 1", "Week 2").
 */
export interface TrendSummary {
  period: string;
  newIssues: number;
  resolvedIssues: number;
  regressions: number;
  averageScore: number;
}

// ============================================
// CROSS-PROJECT ANALYTICS
// ============================================

/**
 * Cross-project pattern (shared issues across projects)
 */
export interface CrossProjectPattern {
  pattern: string;
  projects: string[];
  projectCount: number;
  totalOccurrences: number;
  severity: string;
}

// ============================================
// REGRESSION ANALYTICS
// ============================================

/**
 * Regression analysis entry (issues that regressed after resolution)
 */
export interface RegressionEntry {
  issueId: string;
  title: string;
  project: string;
  timesRegressed: number;
  lastRegression: string;
  agent: string;
}

// ============================================
// COST ANALYTICS
// ============================================

/**
 * Cost analysis entry (token usage and cost per agent/project)
 */
export interface CostEntry {
  name: string;
  totalRuns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEffectiveTokens: number;
  estimatedCost: number;
}

// ============================================
// CATEGORY ANALYTICS
// ============================================

/**
 * Category performance entry (issue resolution by category)
 */
export interface CategoryPerformanceEntry {
  category: string;
  totalIssues: number;
  resolvedIssues: number;
  resolutionRate: number;
  avgTimeToResolveDays: number | null;
}

// ============================================
// TAXONOMY
// ============================================

/**
 * Failure taxonomy reference data (domains, modes, severities).
 * Derived from TaxonomyResponseSchema — see response-schemas.ts.
 */
export type { TaxonomyResponse } from './response-schemas.js';
