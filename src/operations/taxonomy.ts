import type { OpsHttpClient } from '../http/http-client.js';
import type { TaxonomySchema } from '../types/analytics.js';
import { TaxonomyResponseSchema } from '../types/response-schemas.js';

/**
 * Get the failure taxonomy schema (reference data)
 */
export async function get(client: OpsHttpClient): Promise<TaxonomySchema> {
  return client.get('/taxonomy', undefined, { schema: TaxonomyResponseSchema });
}
