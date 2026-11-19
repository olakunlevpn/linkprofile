import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../src/build.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.join(here, '..');
const starter = path.join(here, '..', '..', '..', 'starter');

test('starter profile and avatar match the init template', async () => {
  for (const [a, b] of [
    [path.join(pkg, 'src', 'init-template.hjson'), path.join(starter, 'profile.hjson')],
    [path.join(pkg, 'src', 'init-assets', 'avatar.png'), path.join(starter, 'images', 'avatar.png')],
  ]) {
    assert.ok((await fs.readFile(a)).equals(await fs.readFile(b)), `${b} differs from ${a}`);
  }
});

test('starter builds with zero warnings', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'lp-starter-'));
  const result = await build({ config: 'profile.hjson', out, cwd: starter });
  assert.deepEqual(result.warnings, []);
});

test('deploy workflow pins linkprofile@1 and Node 24, configure-pages before build', async () => {
  const yml = await fs.readFile(path.join(starter, '.github', 'workflows', 'deploy.yml'), 'utf8');
  assert.match(yml, /npx --yes linkprofile@1 build --url/);
  assert.match(yml, /node-version: 24/);
  const pagesAt = yml.indexOf('configure-pages');
  const buildAt = yml.indexOf('linkprofile@1');
  assert.ok(pagesAt > -1 && buildAt > -1);
  assert.ok(pagesAt < buildAt);
  for (const needle of ['steps.pages.outputs.base_url', 'pages: write', 'id-token: write', 'cancel-in-progress: false', 'github-pages']) {
    assert.ok(yml.includes(needle), `deploy.yml missing ${needle}`);
  }
});
