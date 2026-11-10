import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// The retained Weixin bridge delegates navigation to the shared command seam.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const BRIDGES = ['src/channels/weixin/weixin-bridge.mjs'];

for (const bridge of BRIDGES) {
  test(`${bridge} dispatches the shared session-navigation commands`, () => {
    const source = readFileSync(join(repoRoot, bridge), 'utf8');
    assert.match(source, /session-nav-command\.mjs/, `${bridge} must import the shared seam`);
    assert.match(source, /\bisSessionNavCommand\s*\(/, `${bridge} must detect session-navigation commands`);
    assert.match(source, /\brunSessionNavTextCommand\s*\(/, `${bridge} must dispatch through the shared seam`);
  });
}
