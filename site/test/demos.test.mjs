import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listThemes } from 'linkprofile/src/themes.js';
import { buildDemos, checkHomepageThemes, HOMEPAGE_THEMES } from '../lib/demos.mjs';
import { buildSite } from '../build.mjs';

const starterDir = fileURLToPath(new URL('../../starter', import.meta.url));
const names = () => listThemes().map((t) => t.name);

async function tmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'lp-demos-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('a demo per built-in theme', () => tmp(async (dist) => {
  const built = await buildDemos({ starterDir, outDir: dist });
  assert.deepEqual([...built].sort(), names().sort());
  for (const t of names()) {
    const html = await readFile(join(dist, 'demos', t, 'index.html'), 'utf8');
    assert.match(html, /data-mode/);
    assert.match(html, /Your Name/);
  }
}));

test('demo uses that theme', () => tmp(async (dist) => {
  await buildDemos({ starterDir, outDir: dist });
  assert.ok(existsSync(join(dist, 'demos/crimson/theme/style.css')));
  assert.match(await readFile(join(dist, 'demos/crimson/theme/style.css'), 'utf8'), /\.cr-/);
}));

test('homepage theme list matches', () => assert.equal(checkHomepageThemes(HOMEPAGE_THEMES, names()), null));
test('new theme not on homepage fails', () => assert.match(checkHomepageThemes(HOMEPAGE_THEMES, [...names(), 'neon']), /neon/));
test('theme removed from built-ins fails', () => assert.match(checkHomepageThemes(HOMEPAGE_THEMES, ['classic']), /bento/));

test('homepage built with relative demo iframes', () => tmp(async (dist) => {
  await buildSite({ outDir: dist });
  const html = await readFile(join(dist, 'index.html'), 'utf8');
  const fan = html.slice(html.indexOf('<div id="themes"'), html.indexOf('data-hero="note"'));
  const iframes = [...fan.matchAll(/<iframe src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(iframes, HOMEPAGE_THEMES.map((t) => `demos/${t}/`));
  for (const t of HOMEPAGE_THEMES) {
    assert.ok(html.includes(`<a href="demos/${t}/" class="group shrink-0 snap-start" aria-label="Open the ${t} theme demo">`));
  }
  assert.doesNotMatch(html, /outline-none/);
  assert.ok(html.includes('role="group" aria-label="Theme demos"'));
  assert.match(html, /<div id="themes" role="group" aria-label="Theme demos" class="[^"]*\bscroll-px-2\b/);
  const themes = await readFile(join(dist, 'docs/themes/index.html'), 'utf8');
  assert.match(themes, /<div role="group" aria-label="Theme demos" class="[^"]*\bscroll-px-2\b/);
  assert.doesNotMatch(themes, /outline-none/);
  assert.ok(html.includes('href="docs/"'));
  assert.ok(html.includes('href="assets/site.css"'));
  assert.doesNotMatch(html, /cdn\.|fonts\.googleapis/);
  const css = await readFile(join(dist, 'assets/site.css'), 'utf8');
  assert.match(css, /\.bg-paper/);
  assert.match(css, /\.phone/);
}));
