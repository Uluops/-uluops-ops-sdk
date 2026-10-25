/**
 * Stored ids are not all RFC 9562 UUIDs; every schema that carries one must accept them.
 *
 * Why this file exists (zod-4 release train close-out, 7.0.1): zod 4's `.uuid()` requires an
 * RFC version nibble (1-8) and variant (8/9/a/b); zod 3's accepted any 8-4-4-4-12 hex. The
 * production census of 2026-10-25 (read-only, BIN_TO_UUID(id, 1)) found ids that fail zod 4's
 * check: the `system` org (version nibble 0, 48 projects), two users, issue and pipeline-run
 * authors. Both APIs and platform 2.0.0 moved every id site to `z.guid()`, zod 4's spelling of
 * zod 3's `.uuid()`. This SDK has been on zod 4 since 6.x and kept 54 `.uuid()` sites, so a
 * valid server response carrying one of those ids failed to parse — for `save_run`, after the
 * write had landed (`RunWriteEchoResponseSchema.authorId`).
 *
 * Negative control: on 7.0.0 (`.uuid()` kept) the census and every "reads" case fail. The
 * "still rejects" cases keep `z.guid()` from being mistaken for "accept any string".
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ProjectResponseSchema, IssueResponseSchema, RunWriteEchoResponseSchema,
} from '../src/types/response-schemas.js';
import { createMockProject, createMockIssue, createMockRun } from './setup.js';

/** Version nibble 0, RFC variant: the shape of the production `system` org id. */
const VERSION_ZERO = '5e0c1a2b-3c4d-0e5f-8a6b-7c8d9e0f1a2b';
/** Version 0 and variant 0: the shape of hand-written seed ids. */
const NON_RFC = 'aaaa0000-0000-0000-0000-000000000001';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const sources = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
});

describe('id census: no RFC-strict uuid() in src', () => {
  const files = sources(SRC);
  const count = (re: RegExp) => files.reduce((n, f) => n + (readFileSync(f, 'utf8').match(re)?.length ?? 0), 0);
  it('walks the source tree (the census is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(count(/z\.guid\(\)/g)).toBeGreaterThan(0);
  });
  it('has no .uuid() call', () => expect(count(/\.uuid\(/g)).toBe(0));
});

describe.each([
  ['version-0 id (system org shape)', VERSION_ZERO],
  ['non-RFC seed id', NON_RFC],
])('stored %s', (_label, id) => {
  it('reads a project', () => {
    const p = ProjectResponseSchema.parse({ ...createMockProject(), id, ownerId: id });
    expect([p.id, p.ownerId]).toEqual([id, id]);
  });
  it('reads an issue', () => {
    const i = IssueResponseSchema.parse({ ...createMockIssue(), id, projectId: id, firstSeenRunId: id, lastSeenRunId: id });
    expect([i.id, i.projectId]).toEqual([id, id]);
  });
  it('reads a save_run write echo whose author has this id', () => {
    const r = RunWriteEchoResponseSchema.parse({ ...createMockRun(), id, projectId: id, authorId: id });
    expect(r.authorId).toBe(id);
  });
});

describe('still rejects what was never an id', () => {
  it.each(['not-a-uuid', '5e0c1a2b3c4d0e5f8a6b7c8d9e0f1a2b', ''])('%j', bad => {
    expect(ProjectResponseSchema.safeParse({ ...createMockProject(), id: bad }).success).toBe(false);
  });
});
