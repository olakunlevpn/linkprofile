import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFile(root + p, 'utf8');
const actions = (yml) => new Set([...yml.matchAll(/uses:\s*(actions\/[\w-]+@v\d+)/g)].map((m) => m[1]));

test('site workflow builds site/dist and deploys', async () => {
  const yml = await read('.github/workflows/site.yml');
  const starter = await read('starter/.github/workflows/deploy.yml');
  for (const needle of [
    'npm run build -w linkprofile-site', 'path: site/dist', 'pages: write', 'id-token: write',
    'environment:', 'github-pages', 'SITE_BASE: /linkprofile/', 'npm ci', 'node-version: 24',
    'site/**', 'starter/**', 'workflow_dispatch', 'types: [published]',
  ]) assert.ok(yml.includes(needle), `site.yml missing ${needle}`);
  assert.ok(!yml.includes('packages/linkprofile/**'), 'package changes deploy only through a release');
  const have = actions(starter);
  for (const a of actions(yml)) assert.ok(have.has(a), `${a} differs from the starter workflow`);
});

test('ci checks the tarball contains only allowed paths', async () => {
  const yml = await read('.github/workflows/ci.yml');
  assert.ok(yml.includes('npm run build -w linkprofile-site'));
  assert.ok(yml.includes('npm pack --dry-run -w linkprofile --json'));
  // Run the CI check's own script against sample file lists.
  const script = yml.match(/node -e "(.*)" "\$RUNNER_TEMP\/pack\.json"/)[1].replaceAll('\\\\', '\\');
  const check = (paths) => {
    const dir = mkdtempSync(join(tmpdir(), 'pack-'));
    const file = join(dir, 'pack.json');
    writeFileSync(file, JSON.stringify([{ files: paths.map((path) => ({ path })) }]));
    return spawnSync(process.execPath, ['-e', script, file], { encoding: 'utf8' });
  };
  const good = ['bin/linkprofile.js', 'src/a.js', 'themes/crimson/x.css', 'package.json', 'README.md', 'LICENSE'];
  assert.equal(check(good).status, 0);
  assert.notEqual(check([...good, 'site/build.mjs']).status, 0);
  assert.notEqual(check([...good, 'test/x.js']).status, 0);
});
