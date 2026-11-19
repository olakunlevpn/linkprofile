import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../build.mjs';

let dist;
let html;
let steps;
before(async () => {
  dist = await mkdtemp(join(tmpdir(), 'lp-home-'));
  await buildSite({ outDir: dist });
  html = await readFile(join(dist, 'index.html'), 'utf8');
  steps = html.slice(html.indexOf('<!-- How it works'), html.indexOf('<!-- Why -->'));
});
after(() => rm(dist, { recursive: true, force: true }));

const panelText = (s) => s.match(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/)[1]
  .replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('"Live in about five minutes" has the three steps beside a static profile.hjson panel', () => {
  assert.match(steps, /Live in about five minutes\./);
  for (const step of ['Use the template', 'Edit profile.hjson', 'Commit your change']) assert.ok(steps.includes(step), step);
  const text = panelText(steps);
  assert.match(text, /# Pick a look: classic, bento, cover, editorial or crimson/);
  assert.match(text, /^theme: crimson$/m);
  assert.doesNotMatch(steps, /<button|<iframe/);
});

test('the homepage requests nothing from other sites', () => {
  for (const m of html.matchAll(/<(?:script|link|img|iframe|source|video|audio)\b[^>]*\s(?:src|href)="([^"]+)"/g)) {
    assert.doesNotMatch(m[1], /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i, m[0]);
  }
});
