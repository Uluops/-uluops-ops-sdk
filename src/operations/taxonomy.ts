import type { OpsHttpClient } from '../http/http-client.js';
import type { TaxonomyResponse } from '../types/analytics.js';
import { TaxonomyResponseSchema } from '../types/response-schemas.js';

/**
 * Get the failure taxonomy (reference data)
 */
export async function get(client: OpsHttpClient): Promise<TaxonomyResponse> {
  return client.get('/taxonomy', undefined, { schema: TaxonomyResponseSchema });
}
