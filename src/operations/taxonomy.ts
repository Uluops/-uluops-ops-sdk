import type { OpsHttpClient } from '../http/http-client.js';
import type { TaxonomyResponse } from '../types/analytics.js';
import { TaxonomyResponseSchema } from '../types/response-schemas.js';

/**
 * Get the failure taxonomy reference data (domains, modes, severities).
 *
 * @param client - HTTP client instance
 * @returns Taxonomy with domains, modes, and severity definitions
 * @throws {UnauthorizedError} If client is not authenticated
 */
export async function get(client: OpsHttpClient): Promise<TaxonomyResponse> {
  return TaxonomyResponseSchema.parse(await client.get<unknown>('/taxonomy', undefined));
}
