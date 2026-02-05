/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  pagination?: Pagination;
}

/**
 * Pagination metadata
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Error response from API
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    stack?: string;
  };
}

/**
 * List response with count
 */
export interface ListResponse<T> {
  data: T[];
  count: number;
}

/**
 * Created response (201)
 */
export interface CreatedResponse<T> {
  data: T;
  meta?: {
    created: boolean;
  };
  message?: string;
}

/**
 * Delete confirmation response
 */
export interface DeleteResponse {
  message: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  database: {
    connected: boolean;
    latencyMs: number;
  };
}

/**
 * Generic message response
 */
export interface MessageResponse {
  message: string;
}

/**
 * Binary response metadata (for avatars, etc.)
 */
export interface BinaryResponse {
  data: Buffer;
  contentType: string;
}
