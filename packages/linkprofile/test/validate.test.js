import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProfile } from '../src/validate.js';

const ctx = { baseDir: path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures') };
const errors = (issues) => issues.filter((i) => i.level === 'error');
const run = (raw) => validateProfile(raw, ctx);

test('minimal profile fills defaults', () => {
  const { profile, issues } = run({ name: 'a' });
  assert.deepEqual(issues, []);
  assert.deepEqual(profile.theme, { name: 'classic', options: {} });
  assert.deepEqual(profile.socials, []);
  assert.deepEqual(profile.links, []);
  assert.equal(profile.meta.title, 'a');
  assert.equal(profile.meta.description, 'Links from a');
  assert.equal(profile.meta.favicon, null);
  assert.deepEqual(profile.localFiles, []);
});

test('theme string and long form', () => {
  assert.equal(run({ name: 'a', theme: 'minimal' }).profile.theme.name, 'minimal');
  const { profile } = run({ name: 'a', theme: { name: 'classic', options: { accent: '#fff' } } });
  assert.equal(profile.theme.options.accent, '#fff');
});

test('missing name', () => {
  const { profile, issues } = run({});
  assert.equal(profile, null);
  assert.equal(issues[0].path, 'name');
  assert.match(issues[0].message, /required/);
});

test('all errors reported together', () => {
  const { issues } = run({ links: [{ title: 'A' }, { url: 'https://x' }] });
  assert.equal(errors(issues).length, 3);
});

test('link path labels use title', () => {
  const { issues } = run({ name: 'a', links: [{ title: 'x', url: 'https://x' }, { title: 'Newsletter' }] });
  assert.equal(issues[0].path, 'links[1] ("Newsletter")');
  assert.equal(issues[0].message, '"url" is required');
});

test('rejects javascript: and relative urls; accepts mailto/tel', () => {
  const bad = (url) => errors(run({ name: 'a', links: [{ title: 't', url }] }).issues).length;
  assert.equal(bad('javascript:alert(1)'), 1);
  assert.equal(bad('/relative'), 1);
  assert.equal(bad('mailto:a@b.c'), 0);
  assert.equal(bad('tel:+123'), 0);
  assert.equal(bad('https://x.y'), 0);
});

test('external flag', () => {
  const { profile } = run({ name: 'a', links: [{ title: 't', url: 'https://x.y' }, { title: 'm', url: 'mailto:a@b.c' }] });
  assert.deepEqual(profile.links.map((l) => l.external), [true, false]);
});

test('unknown social type suggests; type and label normalised', () => {
  const { issues } = run({ name: 'a', socials: [{ type: 'githb', url: 'https://github.com/x' }] });
  assert.equal(errors(issues).length, 1);
  assert.match(issues[0].hint, /Did you mean "github"/);
  const { profile } = run({ name: 'a', socials: [{ type: 'GitHub', url: 'https://github.com/x' }, { type: 'twitter', url: 'https://x.com/a', label: 'Me' }] });
  assert.equal(profile.socials[0].type, 'github');
  assert.equal(profile.socials[0].label, 'GitHub');
  assert.equal(profile.socials[1].type, 'twitter');
  assert.equal(profile.socials[1].label, 'Me');
});

test('unknown link icon suggests', () => {
  const { issues } = run({ name: 'a', links: [{ title: 't', url: 'https://x.y', icon: 'glob' }] });
  assert.match(issues[0].hint, /"globe"/);
});

test('icon and image together is an error', () => {
  const { issues } = run({ name: 'a', links: [{ title: 't', url: 'https://x.y', icon: 'globe', image: 'images/shop.png' }] });
  assert.equal(errors(issues).length, 1);
});

test('color must be #rgb or #rrggbb', () => {
  const link = (color) => ({ name: 'a', links: [{ title: 't', url: 'https://x.y', icon: 'globe', color }] });
  const { issues } = run(link('red'));
  assert.equal(errors(issues).length, 1);
  assert.match(issues[0].hint, /quoted/);
  assert.match(issues[0].hint, /color: "#34d399"/);
  assert.deepEqual(run(link('#34d399')).issues, []);
  assert.deepEqual(run(link('#abc')).issues, []);
});

test('unknown top-level key warns with suggestion, profile still returned', () => {
  const { profile, issues } = run({ name: 'a', lnks: [] });
  assert.ok(profile);
  assert.equal(issues[0].level, 'warning');
  assert.match(issues[0].hint, /"links"/);
});

test('Jekyll-style paths resolve relative to baseDir', () => {
  for (const p of ['/images/avatar.png', './images/avatar.png', 'images/avatar.png']) {
    const { profile } = run({ name: 'a', avatar: p });
    assert.equal(profile.avatar, 'images/avatar.png');
    assert.deepEqual(profile.localFiles, ['images/avatar.png']);
  }
});

test('path escaping baseDir is an error', () => {
  const { issues } = run({ name: 'a', avatar: '../secret.png' });
  assert.match(issues[0].message, /outside/);
});

test('missing local file is an error naming the looked-up path', () => {
  const { issues } = run({ name: 'a', avatar: 'images/nope.png' });
  assert.equal(issues[0].level, 'error');
  assert.match(issues[0].message, /images\/nope\.png/);
});

test('remote avatar kept as-is and not in localFiles', () => {
  const { profile } = run({ name: 'a', avatar: 'https://x/a.png' });
  assert.equal(profile.avatar, 'https://x/a.png');
  assert.deepEqual(profile.localFiles, []);
});

test('svg avatar warns about link previews', () => {
  const { profile, issues } = run({ name: 'a', avatar: 'images/a.svg' });
  assert.ok(profile);
  assert.equal(issues[0].level, 'warning');
  assert.match(issues[0].message, /link previews/);
});

test('url trailing slash removed', () => {
  assert.equal(run({ name: 'a', url: 'https://u.github.io/links/' }).profile.url, 'https://u.github.io/links');
});

test('localFiles deduped across avatar, link images, favicon', () => {
  const { profile } = run({
    name: 'a', avatar: 'images/avatar.png', meta: { favicon: 'images/avatar.png' },
    links: [{ title: 't', url: 'https://x.y', image: 'images/shop.png' }],
  });
  assert.deepEqual(profile.localFiles, ['images/avatar.png', 'images/shop.png']);
});

test('meta overrides and bio-derived description', () => {
  assert.equal(run({ name: 'a', bio: 'hi' }).profile.meta.description, 'hi');
  const { profile } = run({ name: 'a', meta: { title: 'T', description: 'D' } });
  assert.equal(profile.meta.title, 'T');
  assert.equal(profile.meta.description, 'D');
});

test('wrong types are errors, not crashes', () => {
  const { profile, issues } = run({ name: true, links: 'x', socials: {} });
  assert.equal(profile, null);
  assert.equal(errors(issues).length, 3);
  assert.equal(run(null).profile, null);
});

test('empty, project-root and directory asset paths are errors', () => {
  for (const p of ['', '  ', '.', './', '/', 'images', 'images/']) {
    const { profile, issues } = run({ name: 'a', avatar: p });
    assert.equal(profile, null, JSON.stringify(p));
    assert.equal(errors(issues).length, 1);
  }
  assert.equal(run({ name: 'a', links: [{ title: 't', url: 'https://x.y', image: 'images' }] }).profile, null);
  assert.equal(run({ name: 'a', meta: { favicon: '.' } }).profile, null);
});

test('file named with leading dots is allowed by containment check', () => {
  assert.match(run({ name: 'a', avatar: '..nope.png' }).issues[0].message, /not found/);
});

test('symlink pointing outside baseDir is rejected', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-'));
  const base = path.join(dir, 'base');
  fs.mkdirSync(base);
  fs.writeFileSync(path.join(dir, 'secret.png'), 'x');
  fs.symlinkSync(path.join(dir, 'secret.png'), path.join(base, 'link.png'));
  const { issues } = validateProfile({ name: 'a', avatar: 'link.png' }, { baseDir: base });
  assert.match(issues[0].message, /outside/);
  fs.rmSync(dir, { recursive: true });
});

test('urls are trimmed and external derived from protocol', () => {
  const { profile } = run({ name: 'a', links: [{ title: 't', url: ' HTTPS://x.y ' }] });
  assert.equal(profile.links[0].url, 'HTTPS://x.y');
  assert.equal(profile.links[0].external, true);
});

test('warns when a value contains " #" (comment swallowed by Hjson)', () => {
  const { profile, issues } = run({
    name: 'a',
    bio: 'hello  # my bio',
    links: [{ title: 'T', url: 'https://x.example/', icon: 'globe' }],
    meta: { description: 'fine#1' },
  });
  assert.ok(profile);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].level, 'warning');
  assert.equal(issues[0].path, 'bio');
  assert.match(issues[0].message, /contains " #"/);
  assert.match(issues[0].hint, /own line/);
});

test('warning path points into lists and objects', () => {
  const { issues } = run({ name: 'a', links: [{ title: 'T # x', url: 'https://x.example/' }] });
  assert.equal(issues.find((i) => i.level === 'warning').path, 'links[0].title');
});

test('missing file whose path contains " #" hints at the comment pitfall', () => {
  const { issues } = run({ name: 'a', avatar: 'images/avatar.png  # note' });
  const err = errors(issues)[0];
  assert.match(err.message, /not found/);
  assert.match(err.hint, /comment/i);
  assert.ok(issues.some((i) => i.level === 'warning' && i.path === 'avatar'));
});

test('an ordinary missing file keeps the path hint', () => {
  assert.match(errors(run({ name: 'a', avatar: 'nope.png' }).issues)[0].hint, /relative to the folder/);
});

test('hashtags in free-text fields do not warn', () => {
  const { issues } = run({ name: 'a', bio: 'Coffee #travel #photography', meta: { description: 'C #1 fan' } });
  assert.deepEqual(issues, []);
});

test('a swallowed comment in a free-text field warns', () => {
  const { issues } = run({ name: 'a', links_title: 'Featured Links   # label above links' });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, 'links_title');
});

test('path-like fields still warn on " #x"', () => {
  const { issues } = run({ name: 'a', avatar: 'images/avatar.png  #x' });
  assert.ok(issues.some((i) => i.level === 'warning' && i.path === 'avatar'));
  assert.match(errors(issues)[0].hint, /comment/i);
});

const warnings = (issues) => issues.filter((i) => i.level === 'warning');

test('unknown keys warn with did-you-mean in links, socials, meta and theme', () => {
  const { profile, issues } = run({
    name: 'a',
    theme: { name: 'classic', option: {} },
    meta: { titel: 'x' },
    socials: [{ type: 'github', url: 'https://github.com/a', lable: 'G' }],
    links: [{ title: 't', url: 'https://x.y', ico: 'globe' }],
  });
  assert.ok(profile);
  const w = warnings(issues);
  assert.equal(w.length, 4);
  const hint = (p) => w.find((i) => i.path === p)?.hint;
  assert.equal(hint('theme.option'), 'Did you mean "options"?');
  assert.equal(hint('meta.titel'), 'Did you mean "title"?');
  assert.equal(hint('socials[0].lable'), 'Did you mean "label"?');
  assert.equal(hint('links[0].ico'), 'Did you mean "icon"?');
});

test('colour is accepted as an alias of color without warning', () => {
  const { profile, issues } = run({ name: 'a', links: [{ title: 't', url: 'https://x.y', colour: '#abc' }] });
  assert.deepEqual(issues, []);
  assert.equal(profile.links[0].color, '#abc');
});

test('whitespace-only link title is an error', () => {
  const { profile, issues } = run({ name: 'a', links: [{ title: '   ', url: 'https://x.y' }] });
  assert.equal(profile, null);
  assert.match(errors(issues)[0].message, /title.*must not be empty/);
});

test('numbers are accepted as text in free-text fields only', () => {
  const { profile, issues } = run({
    name: 2024, bio: 42, links_title: 7,
    socials: [{ type: 'github', url: 'https://github.com/a', label: 1 }],
    links: [{ title: 2024, url: 'https://x.y' }],
    meta: { title: 1, description: 2 },
  });
  assert.deepEqual(issues, []);
  assert.equal(profile.name, '2024');
  assert.equal(profile.bio, '42');
  assert.equal(profile.links_title, '7');
  assert.equal(profile.socials[0].label, '1');
  assert.equal(profile.links[0].title, '2024');
  assert.equal(profile.meta.title, '1');
  assert.equal(profile.meta.description, '2');
  const bad = run({ name: 'a', avatar: 5, bio: true });
  assert.equal(bad.profile, null);
  assert.ok(errors(bad.issues).every((i) => /quotes/.test(i.hint)));
  assert.equal(errors(bad.issues).length, 2);
});

test('blank meta title and description fall back like missing ones', () => {
  const both = run({ name: 'Ann', bio: 'Hello', meta: { title: '   ', description: ' \t ' } }).profile.meta;
  assert.equal(both.title, 'Ann');
  assert.equal(both.description, 'Hello');
  const blankBio = run({ name: 'Ann', bio: '   ' }).profile.meta;
  assert.equal(blankBio.description, 'Links from Ann');
});
