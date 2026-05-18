import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { SDK_VERSION } from '../../src/config/constants.js';

const require = createRequire(import.meta.url);

describe('Constants', () => {
  it('SDK_VERSION matches package.json version', () => {
    const pkg = require('../../package.json');
    expect(SDK_VERSION).toBe(pkg.version);
  });
});
