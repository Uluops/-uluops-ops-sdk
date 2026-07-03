/**
 * Cross-SDK verification for the 0.14.0 security-event channel.
 *
 * Drives the REAL OpsHttpClient and RegistryHttpClient (from their built dist)
 * against a local http server and asserts that the security-event surface each
 * SDK re-exports from @uluops/sdk-core@0.14.0 actually works end-to-end:
 *   - onSecurityEvent fires `auth_failure` on a rejected credential (401)
 *   - onSecurityEvent fires `redirect_rejected` AND a `RedirectError` is thrown
 *     (non-retryable) on an upstream 3xx
 *   - each SDK's own re-exported isRedirectError recognizes its own RedirectError
 *   - the high-level clients (OpsClient / RegistryClient) accept onSecurityEvent
 *
 * This is a local dev tool (not shipped — scripts/ is excluded from the tarball).
 * Requires both packages built:
 *   (cd ../-uluops-ops-sdk && npm run build) && (cd ../-uluops-registry-sdk && npm run build)
 *   node scripts/verify-sdk-security-events.mjs
 * Exit 0 = both SDKs verified; 1 = a gap.
 */
import http from 'node:http';

// ops-sdk: root re-exports OpsHttpClient/OpsClient/RedirectError/isRedirectError
import {
  OpsHttpClient,
  OpsClient,
  isRedirectError as opsIsRedirectError,
  NetworkError as OpsNetworkError,
} from '../dist/index.js';
// registry-sdk: client from root; RedirectError/isRedirectError are subpath-only
import { RegistryHttpClient, RegistryClient } from '../../-uluops-registry-sdk/dist/index.js';
import {
  isRedirectError as regIsRedirectError,
  NetworkError as RegNetworkError,
} from '../../-uluops-registry-sdk/dist/errors/index.js';

const PORT = 4611;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;
const API_KEY = 'ulr_verify_key_00000000'; // ulr_ + 18 = 22 chars

const label = (s) => `\x1b[36m${s}\x1b[0m`;
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;

// --- local server: 401 on /e401, 302 on /redirect, 200 otherwise ---------
const server = http.createServer((req, res) => {
  if (req.url.endsWith('/e401')) {
    res.writeHead(401, { 'content-type': 'application/json', 'x-request-id': 'verify-req-1' });
    return res.end(JSON.stringify({ error: { message: 'rejected' } }));
  }
  if (req.url.endsWith('/redirect')) {
    res.writeHead(302, { location: 'https://evil.example/steal' });
    return res.end();
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ data: 'ok' }));
});

let failures = 0;
const assert = (cond, msg) => {
  if (cond) {
    console.log(`  ${ok('✓')} ${msg}`);
  } else {
    console.log(`  ${bad('✗')} ${msg}`);
    failures++;
  }
};

/**
 * @param name    display label
 * @param HttpCls the SDK's low-level HttpClient subclass
 * @param isRedir the SDK's own re-exported isRedirectError guard
 * @param NetErr  the SDK's own NetworkError (to prove RedirectError is distinct)
 * @param HighCls the SDK's high-level client (to prove config acceptance)
 */
async function verifySdk(name, HttpCls, isRedir, NetErr, HighCls) {
  console.log(`\n${label('■ ' + name)}`);
  const events = [];
  const client = new HttpCls({ baseUrl: BASE, apiKey: API_KEY, onSecurityEvent: (e) => events.push(e) });

  // 1. auth_failure on 401
  await client.get('/e401').catch(() => {});
  const af = events.find((e) => e.type === 'auth_failure');
  assert(!!af, 'auth_failure emitted on 401');
  assert(af?.authType === 'api_key' && af?.requestId === 'verify-req-1', 'auth_failure carries authType + server requestId');

  // 2. redirect_rejected + RedirectError (non-retryable, distinct from NetworkError)
  const err = await client.get('/redirect').catch((e) => e);
  assert(isRedir(err), 'redirect throws RedirectError (via the SDK’s own isRedirectError)');
  assert(!(err instanceof NetErr), 'RedirectError is NOT a NetworkError');
  assert(typeof err?.isRetryable === 'function' && err.isRetryable() === false, 'RedirectError is non-retryable');
  assert(events.some((e) => e.type === 'redirect_rejected'), 'redirect_rejected event emitted');

  // 3. high-level client accepts onSecurityEvent (wiring check)
  let highOk = false;
  try {
    const hc = new HighCls({ baseUrl: BASE, apiKey: API_KEY, onSecurityEvent: () => {} });
    highOk = typeof hc === 'object';
  } catch { /* ignore */ }
  assert(highOk, `${HighCls.name} accepts onSecurityEvent (high-level wiring)`);
}

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
console.log(`local server on ${BASE}`);

try {
  await verifySdk('@uluops/ops-sdk', OpsHttpClient, opsIsRedirectError, OpsNetworkError, OpsClient);
  await verifySdk('@uluops/registry-sdk', RegistryHttpClient, regIsRedirectError, RegNetworkError, RegistryClient);

  console.log('\n' + '─'.repeat(56));
  if (failures === 0) {
    console.log(ok('✓ BOTH SDKs verified — security-event channel works end-to-end'));
  } else {
    console.log(bad(`✗ ${failures} assertion(s) failed`));
    process.exitCode = 1;
  }
} catch (e) {
  console.log(bad(`\n✗ error: ${e.message}`));
  process.exitCode = 1;
} finally {
  server.close();
}
