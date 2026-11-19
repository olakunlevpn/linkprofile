import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../src/build.js';
import { BuildError } from '../src/issues.js';

const fx = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const themesDir = path.join(fx, 'themes');
const PROFILE = `{
  theme: plain
  name: Ann
  avatar: images/avatar.png
  links: [
    {
      title: Shop
      url: https://shop.example/
      image: images/shop.png
    }
  ]
  socials: [
    {
      type: github
      url: https://github.com/ann
    }
  ]
}
`;

async function project(profile = PROFILE) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lp-build-'));
  await fs.cp(path.join(fx, 'images'), path.join(cwd, 'images'), { recursive: true });
  await fs.writeFile(path.join(cwd, 'profile.hjson'), profile);
  await fs.writeFile(path.join(cwd, 'notes.txt'), 'secret');
  return cwd;
}
const exists = (p) => fs.access(p).then(() => true, () => false);
const run = (cwd, extra = {}) => build({ cwd, themesDir, ...extra });

test('writes index.html, theme css/assets, referenced images', async () => {
  const cwd = await project();
  const r = await run(cwd);
  const out = path.join(cwd, 'dist');
  assert.equal(r.outDir, out);
  assert.equal(r.theme, 'plain');
  assert.equal(r.links, 1);
  assert.equal(r.socials, 1);
  assert.ok(await exists(path.join(out, 'index.html')));
  assert.ok(await exists(path.join(out, 'theme/style.css')));
  assert.ok(await exists(path.join(out, 'images/avatar.png')));
  assert.ok(await exists(path.join(out, 'images/shop.png')));
  assert.ok(!(await exists(path.join(out, 'images/a.svg'))));
});

test('unreferenced files in baseDir are not copied', async () => {
  const cwd = await project();
  await run(cwd);
  assert.ok(!(await exists(path.join(cwd, 'dist/notes.txt'))));
});

test('public/ copied as-is; generated files win on collision with a warning', async () => {
  const cwd = await project();
  await fs.mkdir(path.join(cwd, 'public'));
  await fs.writeFile(path.join(cwd, 'public/CNAME'), 'ann.example');
  await fs.writeFile(path.join(cwd, 'public/index.html'), 'OLD');
  const r = await run(cwd);
  assert.equal(await fs.readFile(path.join(cwd, 'dist/CNAME'), 'utf8'), 'ann.example');
  assert.match(await fs.readFile(path.join(cwd, 'dist/index.html'), 'utf8'), /Ann/);
  const w = r.warnings.filter((i) => /index\.html/.test(i.message));
  assert.equal(w.length, 1);
  assert.equal(w[0].level, 'warning');
});

test('missing config file suggests init', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lp-build-'));
  await assert.rejects(run(cwd), (e) => e instanceof BuildError && e.message.includes('profile.hjson') && /npx linkprofile init/.test(e.message + (e.issues[0].hint ?? '')));
});

test('validation errors abort before touching out', async () => {
  const cwd = await project('{ links: [] }');
  await fs.mkdir(path.join(cwd, 'dist'));
  await fs.writeFile(path.join(cwd, 'dist/keep.txt'), 'x');
  await assert.rejects(run(cwd), BuildError);
  assert.ok(await exists(path.join(cwd, 'dist/keep.txt')));
});

test('stale files from a previous build are removed', async () => {
  const cwd = await project();
  await run(cwd);
  await fs.writeFile(path.join(cwd, 'dist/old.html'), 'x');
  await run(cwd);
  assert.ok(!(await exists(path.join(cwd, 'dist/old.html'))));
  assert.ok(await exists(path.join(cwd, 'dist/.linkprofile')));
});

test('refuses dangerous out dirs', async () => {
  const cwd = await project();
  await fs.mkdir(path.join(cwd, 'public/sub'), { recursive: true });
  for (const out of ['.', '..', '/', cwd, 'images', 'public', 'public/sub']) {
    await assert.rejects(run(cwd, { out }), (e) => e instanceof BuildError && /refus/i.test(e.message), `out=${out}`);
  }
  assert.ok(await exists(path.join(cwd, 'images/avatar.png')));
  assert.ok(await exists(path.join(cwd, 'profile.hjson')));
});

test('refuses out dir that contains baseDir when config is in a subfolder', async () => {
  const cwd = await project();
  await fs.mkdir(path.join(cwd, 'site'));
  await fs.rename(path.join(cwd, 'images'), path.join(cwd, 'site/images'));
  await fs.rename(path.join(cwd, 'profile.hjson'), path.join(cwd, 'site/profile.hjson'));
  await assert.rejects(run(cwd, { config: 'site/profile.hjson', out: 'site' }), /refus/i);
  const r = await run(cwd, { config: 'site/profile.hjson', out: 'dist' });
  assert.equal(r.outDir, path.join(cwd, 'dist'));
  assert.ok(await exists(path.join(cwd, 'dist/images/avatar.png')));
});

const ogUrl = async (cwd) => (await fs.readFile(path.join(cwd, 'dist/index.html'), 'utf8')).match(/og:url" content="([^"]*)"/)?.[1];

test('--url used when profile has none; profile url wins', async () => {
  const a = await project();
  await run(a, { url: 'https://u.github.io/repo/' });
  assert.equal(await ogUrl(a), 'https://u.github.io/repo/');
  const b = await project(PROFILE.replace('name: Ann', 'name: Ann\n  url: "https://mine.example"'));
  await run(b, { url: 'https://other.example' });
  assert.equal(await ogUrl(b), 'https://mine.example/');
});

test('invalid --url is a BuildError', async () => {
  const cwd = await project();
  await assert.rejects(run(cwd, { url: 'ftp://x.example' }), BuildError);
  await assert.rejects(run(cwd, { url: 'not a url' }), BuildError);
});

test('returns summary with warnings', async () => {
  const cwd = await project(PROFILE.replace('name: Ann', 'name: Ann\n  bogus: 1'));
  const r = await run(cwd);
  assert.equal(r.warnings.length, 1);
  assert.equal(r.warnings[0].level, 'warning');
});

test('refuses --out pointing at a file; files stay intact', async () => {
  const cwd = await project();
  for (const out of ['profile.hjson', 'images/avatar.png', 'notes.txt']) {
    await assert.rejects(run(cwd, { out }), (e) => e instanceof BuildError && /refus/i.test(e.message), `out=${out}`);
  }
  assert.ok(await exists(path.join(cwd, 'profile.hjson')));
  assert.ok(await exists(path.join(cwd, 'images/avatar.png')));
  assert.ok(await exists(path.join(cwd, 'notes.txt')));
});

test('refuses out dir reached through a symlink', async () => {
  const cwd = await project();
  await fs.symlink(cwd, path.join(cwd, 'link'));
  await assert.rejects(run(cwd, { out: 'link/images' }), /refus/i);
  await assert.rejects(run(cwd, { out: 'link' }), /refus/i);
  const viaLink = await fs.mkdtemp(path.join(os.tmpdir(), 'lp-link-'));
  const alias = path.join(viaLink, 'alias');
  await fs.symlink(cwd, alias);
  await assert.rejects(run(alias, { out: 'images' }), /refus/i);
  assert.ok(await exists(path.join(cwd, 'images/avatar.png')));
});

test('refuses non-empty out dir without a linkprofile marker; rebuild works', async () => {
  const cwd = await project();
  await fs.mkdir(path.join(cwd, 'src'));
  await fs.writeFile(path.join(cwd, 'src/code.js'), 'x');
  await assert.rejects(run(cwd, { out: 'src' }), (e) => e instanceof BuildError && /isn't a previous linkprofile build/.test(e.message) && /Delete it yourself/.test(e.issues[0].hint));
  assert.ok(await exists(path.join(cwd, 'src/code.js')));
  await fs.mkdir(path.join(cwd, 'empty'));
  await run(cwd, { out: 'empty' });
  await run(cwd);
  await run(cwd);
});

test('marker is written before anything can fail, so a failed build can be retried', async () => {
  const cwd = await project();
  const broken = await fs.mkdtemp(path.join(os.tmpdir(), 'lp-themes-'));
  await fs.cp(path.join(themesDir, 'plain'), path.join(broken, 'plain'), { recursive: true });
  await fs.rm(path.join(broken, 'plain', 'style.css'));
  await assert.rejects(run(cwd, { themesDir: broken }));
  assert.ok(await exists(path.join(cwd, 'dist', '.linkprofile')));
  await run(cwd);
  assert.ok(await exists(path.join(cwd, 'dist', 'index.html')));
});

test('issue file is shown relative to cwd', async () => {
  const cwd = await project('{\n name: Ann\n bogus: 1\n links: 5\n}');
  await assert.rejects(run(cwd), (e) => e.issues.every((i) => i.file === 'profile.hjson'));
  const cwd2 = await project('{\n name: [\n}');
  await assert.rejects(run(cwd2), (e) => e.issues[0].file === 'profile.hjson');
  const r = await run(await project('{\n theme: plain\n name: Ann\n bogus: 1\n}'));
  assert.equal(r.warnings[0].file, 'profile.hjson');
});

test('whitespace-only meta title and bio never produce an empty <title> or description', async () => {
  const cwd = await project(PROFILE.replace('name: Ann', 'name: Ann\n  bio: "   "\n  meta: {\n    title: "  "\n  }'));
  await run(cwd);
  const html = await fs.readFile(path.join(cwd, 'dist/index.html'), 'utf8');
  assert.match(html, /<title>Ann<\/title>/);
  assert.match(html, /<meta name="description" content="Links from Ann">/);
});

test('unknown theme options come back as warnings', async () => {
  const cwd = await project(PROFILE.replace('theme: plain', 'theme: { name: "plain", options: { shap: "square" } }'));
  const r = await run(cwd);
  assert.equal(r.warnings.length, 1);
  assert.equal(r.warnings[0].path, 'theme.options.shap');
  assert.equal(r.warnings[0].hint, 'Did you mean "shape"?');
});
