/**
 * Minimal interface for HTTP POST requests.
 * Used to decouple auth strategies from the main HTTP client implementation.
 *
 * The response structure matches the API's standard format: { data: T }
 */
export interface FetchClient {
  /**
   * Make a POST request
   * @param url - The endpoint path (e.g., '/auth/login')
   * @param body - The request body to send as JSON
   * @returns Response with data wrapper: { data: { data: T } }
   */
  post<T>(url: string, body: object): Promise<{ data: { data: T } }>;
}
