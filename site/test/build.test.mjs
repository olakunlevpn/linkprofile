import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../build.mjs';

async function withBuild(fn) {
  const outDir = await mkdtemp(join(tmpdir(), 'lp-site-'));
  try {
    await buildSite({ outDir });
    await fn(outDir);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

test('builds CSS and fonts', () => withBuild(async (outDir) => {
  const css = await readFile(join(outDir, 'assets/site.css'), 'utf8');
  assert.match(css, /--color-mint/);
  assert.match(css, /\.bg-paper/);
  const fonts = (await readdir(join(outDir, 'assets/fonts'))).filter((f) => f.endsWith('.woff2'));
  assert.equal(fonts.length, 6);
  const all = await readdir(join(outDir, 'assets/fonts'));
  assert.ok(all.includes('OFL-space-grotesk.txt') && all.includes('OFL-jetbrains-mono.txt'));
  assert.match(css, /^\/\*! tailwindcss v[\d.]+ \| MIT License \*\//);
}));

test('CSS has no external urls', () => withBuild(async (outDir) => {
  const css = await readFile(join(outDir, 'assets/site.css'), 'utf8');
  assert.doesNotMatch(css, /http/);
  assert.doesNotMatch(css, /@import/);
  assert.match(css, /url\(["']?fonts\//);
}));

test('docs prose sits in the components layer and styles the lead paragraph', () => withBuild(async (outDir) => {
  const css = await readFile(join(outDir, 'assets/site.css'), 'utf8');
  const layer = css.match(/@layer components\{(.*?)\}@layer utilities/s);
  assert.ok(layer && layer[1].includes('.prose-doc p'), 'prose rules not in components layer');
  assert.match(css, /\.prose-doc>h1\+p\{/);
  const html = await readFile(join(outDir, 'docs/getting-started/index.html'), 'utf8');
  assert.match(html, /text-mint-deep/);
  const opts = await readFile(join(outDir, 'docs/theme-options/index.html'), 'utf8');
  const order = ['classic', 'bento', 'cover', 'editorial', 'crimson'].map((n) => opts.indexOf(`id="${n}"`));
  assert.ok(order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), `theme order ${order}`);
}));

test('refuses an outDir inside site/ but outside site/dist', async () => {
  const src = fileURLToPath(new URL('../src', import.meta.url));
  await assert.rejects(buildSite({ outDir: src }), /Refusing/);
  assert.ok(existsSync(join(src, 'styles.css')));
});

test('homepage loads one bundled script: GSAP (licence header first) plus home.js', () => withBuild(async (outDir) => {
  const js = await readFile(join(outDir, 'assets/js/home.js'), 'utf8');
  assert.match(js, /^\/\*!\n \* GSAP 3\.\d+\.\d+\n/);
  assert.match(js, /@license Copyright/);
  const own = await readFile(fileURLToPath(new URL('../src/home.js', import.meta.url)), 'utf8');
  assert.ok(js.endsWith(own), 'site/src/home.js is not appended');
  assert.doesNotMatch(js, /sourceMappingURL|ScrollTrigger\.min/);
  // The site's own script makes no requests of its own and names no other site.
  assert.doesNotMatch(own, /https?:|\/\/[a-z]|fetch\(|import\(|XMLHttpRequest|localStorage|document\.cookie/);
  const html = await readFile(join(outDir, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(scripts, ['<script src="assets/js/home.js" defer></script>'.replace('</script>', '')]);
  assert.match(html, /<script src="assets\/js\/home\.js" defer><\/script>/);
  for (const page of ['docs/index.html', 'docs/getting-started/index.html', '404.html']) {
    assert.doesNotMatch(await readFile(join(outDir, page), 'utf8'), /<script/, page);
  }
}));
