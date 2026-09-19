import type { OpsClient } from '../src/client.js';
import type { OrgScopedOptions, WithResponseContext } from '../src/types/org.js';
import type { Project } from '../src/types/projects.js';

declare const client: OpsClient;
declare const dynamic: boolean;
const legacyOptions: OrgScopedOptions = { org: 'team' };
const plain: Promise<{ data: Project[]; total: number }> = client.projects.list(legacyOptions);
const wrapped: Promise<WithResponseContext<{ data: Project[]; total: number }>> = client.projects.list({ withResponseContext: true });
const either: Promise<{ data: Project[]; total: number } | WithResponseContext<{ data: Project[]; total: number }>> = client.projects.list({ withResponseContext: dynamic });
// @ts-expect-error An opted-in response requires unwrapping before using the page.
const wrong: Promise<{ data: Project[]; total: number }> = client.projects.list({ withResponseContext: true });
void [plain, wrapped, either, wrong];
