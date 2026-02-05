import type { OpsHttpClient } from '../http/http-client.js';
import type { TaxonomySchema } from '../types/analytics.js';

/**
 * Get the failure taxonomy schema (reference data)
 */
export async function get(client: OpsHttpClient): Promise<TaxonomySchema> {
  return client.get<TaxonomySchema>('/taxonomy');
}
