#!/usr/bin/env node
/**
 * Packed-tarball behavioural check for the update-run surface (5.18.0+).
 *
 * Validates the PUBLISHED SHAPE — packs the current tree, installs the
 * tarball into a scratch consumer, and exercises it over a local HTTP stub —
 * so exports-map mistakes, files-field omissions, and wire-shape regressions
 * are caught before npm ever sees them. `file:` links and direct src imports
 * cannot catch these; that is the whole reason this script exists.
 *
 * Checks:
 *   1. archivedReason wire key (tracker d21e0a57): the archive reason must
 *      arrive under the key the API reads; the stripped `archiveReason`
 *      spelling must not be sent.
 *   2. §3.9 echo assertion: analysis-bearing update with a replace echo
 *      succeeds; an echo-less (pre-1a) reply throws the exported
 *      AnalysisEchoMismatchError with reason 'missing-echo' and the run
 *      attached.
 *   3. previewUpdate exists, hits POST /runs/update-preview, and parses the
 *      plan including wouldRetireRecordIds.
 *   4. Empty-array analysis (`analysisRecords: []`) does NOT demand an echo —
 *      the API's hasAnalysis predicate is `length > 0`, so a healthy 1a
 *      server replies without one; the SDK predicate must agree or the alarm
 *      fires falsely against production (the F1 class).
 *   5. record_write_mode reaches the wire and a matching merge echo is
 *      accepted (1b) — a stripped mode is the §3.9 silent-strip skew.
 *   6. updateWithEcho returns { run, analysisWrite } (F17) — success-path
 *      visibility of the superseded/created counts.
 *
 * Control mode — REQUIRED reading before trusting a green run:
 *   `node scripts/verify-update-run-tarball.mjs --control 5.17.0`
 *   installs the named PUBLISHED version instead of packing the tree, and
 *   expects checks 1, 2b, 3, 5, 6 to FAIL (pre-5.18/5.19 behavior) while
 *   the harness itself still runs. A control run where nothing fails means the instrument is
 *   inert — do not trust the normal run either. (House rule: a check that
 *   cannot fail proves nothing.)
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import assert from 'node:assert';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const controlIdx = process.argv.indexOf('--control');
const controlVersion = controlIdx !== -1 ? process.argv[controlIdx + 1] : null;
if (controlIdx !== -1 && !controlVersion) {
  console.error('--control requires a published version, e.g. --control 5.17.0');
  process.exit(2);
}

const workDir = mkdtempSync(join(tmpdir(), 'ops-sdk-tarball-check-'));
process.on('exit', () => rmSync(workDir, { recursive: true, force: true }));

let installSpec;
if (controlVersion) {
  installSpec = `@uluops/ops-sdk@${controlVersion}`;
  console.log(`CONTROL RUN against published ${installSpec} — checks 1, 2b, 3, 5, 6 MUST fail.`);
} else {
  execSync('npm pack --silent', { cwd: pkgRoot, stdio: ['ignore', 'ignore', 'inherit'] });
  const tgz = readdirSync(pkgRoot).find((f) => /^uluops-ops-sdk-.*\.tgz$/.test(f));
  assert.ok(tgz, 'npm pack produced no tarball');
  installSpec = join(pkgRoot, tgz);
  process.on('exit', () => rmSync(installSpec, { force: true }));
}

execSync('npm init -y', { cwd: workDir, stdio: 'ignore' });
execSync(`npm install ${JSON.stringify(installSpec)} --silent --no-audit --no-fund --registry https://registry.npmjs.org/`, {
  cwd: workDir, stdio: ['ignore', 'ignore', 'inherit'],
});

const sdk = await import(join(workDir, 'node_modules', '@uluops', 'ops-sdk', 'dist', 'index.js'));
const { OpsClient } = sdk;

const seen = {};
const run = {
  id: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  authorId: null, runNumber: 5, workflowType: 'post-implementation',
  timestamp: '2026-08-20T00:00:00.000Z', allGatesPassed: true, averageScore: 90,
  rawMarkdown: null, archivedAt: null, archiveReason: null, idempotencyKey: null,
  payloadHash: null, definitionType: null, definitionName: null, definitionVersion: null,
  definitionHash: null, definitionId: null, registrySyncedAt: null,
  createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-08-20T00:00:00.000Z',
};

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const parsed = body ? JSON.parse(body) : {};
    res.setHeader('content-type', 'application/json');
    if (req.method === 'PATCH' && req.url === '/api/v1/runs/update') {
      seen.updateBody = parsed;
      // Faithful mirror of the API's hasAnalysis predicate (mutations.ts):
      // entries required, length > 0 — an empty array is NOT analysis-bearing.
      const summaries = parsed.analysisSummary === undefined ? []
        : Array.isArray(parsed.analysisSummary) ? parsed.analysisSummary : [parsed.analysisSummary];
      const hasAnalysis = (parsed.analysisRecords?.length ?? 0) > 0 || summaries.length > 0;
      // In-payload marker: a record titled ECHOLESS simulates a pre-1a API.
      const echoless = parsed.analysisRecords?.some((r) => r.title === 'ECHOLESS');
      const payload = { data: run };
      if (hasAnalysis && !echoless) {
        // 1b: echo the caller's mode, defaulted — like the live API.
        payload.analysisWrite = { recordMode: parsed.recordWriteMode ?? 'replace', supersededRecords: 1, supersededSummaries: 0, createdRecords: 1, createdSummaries: 0 };
      }
      res.end(JSON.stringify(payload));
      return;
    }
    if (req.method === 'POST' && req.url === '/api/v1/runs/update-preview') {
      seen.previewBody = parsed;
      res.end(JSON.stringify({ data: { preview: true, recordMode: 'replace', byAgent: {
        'aristotle-analyst': { wouldSupersedeRecords: 1, wouldSupersedeSummaries: 0, wouldCreateRecords: 1, wouldCreateSummaries: 0, wouldRetireRecordIds: ['F-9'] },
      } } }));
      return;
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ error: { message: `unstubbed ${req.method} ${req.url}` } }));
  });
});

await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
const client = new OpsClient({ baseUrl: base, apiKey: 'ulr_test_key_000000000000' });
const record = { agentName: 'aristotle-analyst', recordType: 'finding', recordId: 'F-1', title: 'T', data: {} };

let failures = 0;
const check = (name, fn) => Promise.resolve().then(fn).then(
  () => console.log(`PASS  ${name}`),
  (e) => { failures++; console.log(`FAIL  ${name}: ${e.message}`); }
);

await check('1. archivedReason reaches the wire (archiveReason not sent)', async () => {
  await client.runs.update({ project: 'p', runNumber: 5, archivedAt: '2026-08-20T00:00:00.000Z', archiveReason: 'why' });
  assert.strictEqual(seen.updateBody.archivedReason, 'why', 'archivedReason missing from wire body');
  assert.strictEqual(seen.updateBody.archiveReason, undefined, 'stripped-key archiveReason still sent');
});

await check('2a. analysis-bearing update succeeds with replace echo', async () => {
  const r = await client.runs.update({ project: 'p', runNumber: 5, analysisRecords: [record] });
  assert.strictEqual(r.runNumber, 5);
});

await check('2b. echo-less (old-API) reply throws AnalysisEchoMismatchError carrying the run', async () => {
  const { AnalysisEchoMismatchError } = sdk;
  assert.ok(AnalysisEchoMismatchError, 'AnalysisEchoMismatchError not exported');
  let threw = null;
  try {
    await client.runs.update({ project: 'p', runNumber: 5, analysisRecords: [{ ...record, title: 'ECHOLESS' }] });
  } catch (e) { threw = e; }
  assert.ok(threw instanceof AnalysisEchoMismatchError, `expected AnalysisEchoMismatchError, got ${threw && threw.name}`);
  assert.strictEqual(threw.reason, 'missing-echo');
  assert.strictEqual(threw.run?.runNumber, 5, 'error does not carry the landed run');
});

await check('3. previewUpdate hits POST /runs/update-preview and parses the plan', async () => {
  assert.ok(typeof client.runs.previewUpdate === 'function', 'previewUpdate method absent');
  const plan = await client.runs.previewUpdate({ project: 'p', runNumber: 5, analysisRecords: [record] });
  assert.strictEqual(plan.preview, true);
  assert.deepStrictEqual(plan.byAgent['aristotle-analyst'].wouldRetireRecordIds, ['F-9']);
});

await check('4. analysisRecords: [] does not demand an echo (F1 — healthy-1a false alarm)', async () => {
  const r = await client.runs.update({ project: 'p', runNumber: 5, analysisRecords: [], averageScore: 91 });
  assert.strictEqual(r.runNumber, 5);
});

await check('5. record_write_mode reaches the wire; matching merge echo accepted (1b)', async () => {
  const r = await client.runs.update({ project: 'p', runNumber: 5, recordWriteMode: 'merge', analysisRecords: [record] });
  assert.strictEqual(r.runNumber, 5);
  assert.strictEqual(seen.updateBody.recordWriteMode, 'merge', 'mode missing from wire body');
});

await check('6. updateWithEcho returns { run, analysisWrite } (F17)', async () => {
  assert.ok(typeof client.runs.updateWithEcho === 'function', 'updateWithEcho method absent');
  const r = await client.runs.updateWithEcho({ project: 'p', runNumber: 5, analysisRecords: [record] });
  assert.strictEqual(r.run.runNumber, 5);
  assert.strictEqual(r.analysisWrite?.recordMode, 'replace', 'echo not surfaced on success path');
});

server.close();

if (controlVersion) {
  // 2a and 4 legitimately pass on old SDKs (they never asserted the echo);
  // 1, 2b, 3 encode 5.18.0 behavior and 5, 6 encode 5.19.0 — all MUST have
  // failed against the 5.17.0 control.
  const expectedFailures = 5;
  if (failures === expectedFailures) {
    console.log(`CONTROL OK — exactly the ${expectedFailures} new-behavior checks failed against ${controlVersion}; the instrument can fire.`);
    process.exit(0);
  }
  console.log(`CONTROL BROKEN — expected ${expectedFailures} failures against ${controlVersion}, saw ${failures}. Do not trust a green normal run.`);
  process.exit(1);
}

console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
