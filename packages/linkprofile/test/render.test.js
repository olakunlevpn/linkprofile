import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listThemes, loadTheme, checkThemeOptions } from '../src/themes.js';
import { renderPage, buildContext } from '../src/render.js';
import { BuildError } from '../src/issues.js';

const fx = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'themes');
const plain = loadTheme('plain', fx);
const v = { version: '9.9.9' };
const p = (over = {}) => ({
  theme: { name: 'plain', options: {} },
  url: null,
  name: 'Ann',
  avatar: null,
  bio: null,
  socials: [],
  links_title: null,
  links: [],
  meta: { title: 'Ann', description: 'Links from Ann', favicon: null },
  localFiles: [],
  ...over,
});
const link = (over = {}) => ({ title: 'T', url: 'https://x.com/', icon: null, image: null, color: null, external: true, ...over });

test('lists and loads themes', () => {
  assert.ok(listThemes(fx).some((t) => t.name === 'plain'));
  const t = loadTheme('plain', fx);
  assert.equal(t.name, 'plain');
  assert.equal(t.dir, path.join(fx, 'plain'));
});

test('unknown theme lists available', () => {
  assert.throws(
    () => loadTheme('plian', fx),
    (e) => e instanceof BuildError && /Did you mean "plain"/.test(e.issues[0].hint) && /Available: plain/.test(e.issues[0].hint),
  );
});

test('the removed "card" theme is an unknown theme and the error lists the built-ins', () => {
  assert.throws(
    () => loadTheme('card'),
    (e) => e instanceof BuildError && /Available: bento, classic, cover, crimson, editorial/.test(e.issues[0].hint),
  );
});

test('theme options merge defaults with profile options', async () => {
  const html = await renderPage(p({ theme: { name: 'plain', options: { accent: '#fff' } } }), plain, v);
  assert.match(html, /data-accent="#fff"/);
  assert.match(html, /data-shape="round"/);
});

test('special characters escaped exactly once', async () => {
  const name = 'A & B <script>x</script> 🎨 Zoë';
  const html = await renderPage(p({ name, meta: { title: name, description: name, favicon: null } }), plain, v);
  assert.match(html, /A &amp; B &lt;script&gt;x&lt;\/script&gt; 🎨 Zoë/);
  assert.doesNotMatch(html, /&amp;amp;|<script>x/);
  assert.match(html, /<meta charset="utf-8">/i);
});

test('meta partial emits og/twitter tags with absolute image when url known', async () => {
  const html = await renderPage(p({ url: 'https://u.github.io/links', avatar: 'images/avatar.png', meta: { title: 'Ann', description: 'D', favicon: 'images/f.ico' } }), plain, v);
  assert.match(html, /<meta property="og:image" content="https:\/\/u\.github\.io\/links\/images\/avatar\.png">/);
  assert.match(html, /<meta property="og:title" content="Ann">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/u\.github\.io\/links\/">/);
  assert.match(html, /<meta name="twitter:card" content="summary">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/u\.github\.io\/links\/">/);
  assert.match(html, /<link rel="icon" href="images\/f\.ico">/);
  assert.match(html, /<meta name="generator" content="linkprofile 9\.9\.9">/);
  assert.match(html, /<link rel="stylesheet" href="theme\/style\.css">/);
});

test('remote avatar is used as og:image even without url', async () => {
  const html = await renderPage(p({ avatar: 'https://cdn.example/a.png' }), plain, v);
  assert.match(html, /og:image" content="https:\/\/cdn\.example\/a\.png"/);
});

test('no url → no canonical and no og:image for local avatar', async () => {
  const html = await renderPage(p({ avatar: 'images/avatar.png' }), plain, v);
  assert.doesNotMatch(html, /canonical|og:image|og:url/);
  assert.match(html, /<img class="avatar" src="images\/avatar\.png"/);
});

test('external links get rel="noopener"; mailto does not', async () => {
  const html = await renderPage(p({ links: [link(), link({ title: 'Mail', url: 'mailto:a@b.c', external: false })] }), plain, v);
  assert.match(html, /<a href="https:\/\/x\.com\/" rel="noopener"/);
  assert.match(html, /<a href="mailto:a@b\.c">/);
});

test('svgs are inserted unescaped', async () => {
  const html = await renderPage(p({ socials: [{ type: 'github', url: 'https://github.com/a', label: 'GitHub' }], links: [link({ icon: 'mail' })] }), plain, v);
  assert.match(html, /<ul class="socials">\s*<li><a [^>]*><svg/);
  assert.match(html, /<ul class="links">\s*<li><a [^>]*><svg/);
  assert.doesNotMatch(html, /&lt;svg/);
});

test('all asset urls are relative', async () => {
  const html = await renderPage(p({ avatar: 'images/a.png', links: [link({ image: 'images/l.png' })], meta: { title: 'A', description: 'd', favicon: 'images/f.ico' } }), plain, v);
  assert.doesNotMatch(html, /(href|src)="\/(?!\/)/);
});

test('name-only profile renders no empty sections or broken img', async () => {
  const html = await renderPage(p(), plain, v);
  assert.doesNotMatch(html, /<img|<ul|<h2|class="bio"/);
  assert.match(html, /<h1>Ann<\/h1>/);
});

test('links_title only shown with links', async () => {
  assert.doesNotMatch(await renderPage(p({ links_title: 'Featured' }), plain, v), /Featured/);
  assert.match(await renderPage(p({ links_title: 'Featured', links: [link()] }), plain, v), /<h2>Featured<\/h2>/);
});

test('blank bio and links_title are treated as absent', async () => {
  const html = await renderPage(p({ bio: '', links_title: '  ', links: [link()] }), plain, v);
  assert.doesNotMatch(html, /class="bio"|<h2/);
});

test('renderPage works without opts; local avatar url is encoded', async () => {
  const html = await renderPage(p({ url: 'https://u.io/l', avatar: 'images/my pic.png' }), plain);
  assert.match(html, /og:image" content="https:\/\/u\.io\/l\/images\/my%20pic\.png"/);
});

test('links expose the icon name, the lucide svg and the theme artwork when the theme has it', () => {
  const links = (theme) => buildContext(p({ links: [link({ icon: 'Globe' }), link({ icon: 'rocket' }), link()] }), theme, v).profile.links;
  const [globe, rocket, none] = links(loadTheme('classic'));
  assert.equal(globe.icon, 'globe');
  assert.match(globe.icon_svg, /<svg[^>]*fill="none"/);
  assert.match(globe.theme_icon_svg, /class="horizon"/);
  assert.equal(rocket.icon, 'rocket');
  assert.match(rocket.icon_svg, /<svg/);
  assert.equal(rocket.theme_icon_svg, null);
  assert.equal(none.icon, null);
  assert.equal(none.icon_svg, null);
  assert.equal(none.theme_icon_svg, null);
  const [plainGlobe] = links(plain);
  assert.match(plainGlobe.icon_svg, /<svg/);
  assert.equal(plainGlobe.theme_icon_svg, null);
});

test('themes declare allowed option values in "choices"', () => {
  assert.deepEqual(loadTheme('classic').choices, { mode: ['auto', 'light', 'dark'], toggle: [true, false] });
  assert.deepEqual(plain.choices, {});
});

test('theme options: unknown keys warn, values outside "choices" are errors', () => {
  const classic = loadTheme('classic');
  assert.deepEqual(checkThemeOptions(classic, { mode: 'auto', accent: '#123456' }), []);
  assert.deepEqual(checkThemeOptions(classic, undefined), []);
  const [bad] = checkThemeOptions(classic, { mode: 'Dark' }, 'profile.hjson');
  assert.deepEqual(bad, { level: 'error', message: '"mode" must be one of auto, light, dark, got "Dark"', path: 'theme.options.mode', file: 'profile.hjson', hint: 'Did you mean "dark"?' });
  assert.equal(checkThemeOptions(classic, { mode: 1 })[0].hint, undefined);
  const [typo] = checkThemeOptions(classic, { mdoe: 'dark' });
  assert.equal(typo.level, 'warning');
  assert.equal(typo.path, 'theme.options.mdoe');
  assert.equal(typo.hint, 'Did you mean "mode"?');
  assert.equal(checkThemeOptions(classic, { banner: 'x' })[0].hint, 'Options for theme "classic": accent, mode, toggle');
});

test('typed theme options: a "color" option must be a hex colour, with a quote-it hint', () => {
  const classic = loadTheme('classic');
  assert.deepEqual(classic.types, { accent: 'color' });
  assert.deepEqual(plain.types, {});
  assert.deepEqual(checkThemeOptions(classic, { accent: '#ff6b6b' }), []);
  assert.deepEqual(checkThemeOptions(classic, { accent: '#ABC' }), []);
  const payload = 'red;background-image:url(https://evil.example/x.png)';
  const [bad, ...rest] = checkThemeOptions(classic, { accent: payload }, 'profile.hjson');
  assert.deepEqual(rest, []);
  assert.deepEqual(bad, {
    level: 'error',
    message: `"accent" must be a hex colour like #rgb or #rrggbb, got ${JSON.stringify(payload)}`,
    path: 'theme.options.accent',
    file: 'profile.hjson',
    hint: 'Colours must be quoted, e.g. accent: "#3bd3a2". Unquoted, Hjson treats # as a comment and reads the next line as the value.',
  });
  for (const value of ['tomato', '#12345', '#3bd3a2;', 12, null, true]) {
    assert.equal(checkThemeOptions(classic, { accent: value })[0]?.level, 'error', JSON.stringify(value));
  }
});

test('theme.json "types": an unknown type, or a default of the wrong type, is a theme error', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lp-types-'));
  const theme = async (name, manifest) => {
    await fs.mkdir(path.join(dir, name));
    await fs.writeFile(path.join(dir, name, 'theme.json'), JSON.stringify({ name, ...manifest }));
  };
  await theme('typo', { options: { accent: '#3bd3a2' }, types: { accent: 'colour' } });
  await theme('baddefault', { options: { accent: 'teal' }, types: { accent: 'color' } });
  await theme('nodefault', { options: {}, types: { accent: 'color' } });
  const message = (name) => {
    try {
      loadTheme(name, dir);
    } catch (e) {
      assert.ok(e instanceof BuildError);
      return e.issues[0].message;
    }
    return null;
  };
  assert.equal(message('typo'), 'Theme "typo" has an invalid theme.json: unknown type "colour" for option "accent" (supported: color)');
  assert.equal(message('baddefault'), 'Theme "baddefault" has an invalid theme.json: the default for option "accent" must be a color, got "teal"');
  assert.equal(message('nodefault'), null);
});

test('links say whether their colour is dark, so a theme can draw light glyphs on it', () => {
  const colors = ['#000000', '#7c3aed', '#34d399', '#FFF', undefined];
  const links = buildContext(p({ links: colors.map((color) => link(color ? { color } : {})) }), plain, v).profile.links;
  assert.deepEqual(links.map((l) => l.color_is_dark), [true, true, false, false, false]);
});

test('non-string choices (e.g. booleans) are checked without crashing the suggestion', () => {
  const theme = { name: 't', options: { toggle: true }, choices: { toggle: [true, false] }, types: {} };
  assert.deepEqual(checkThemeOptions(theme, { toggle: false }), []);
  const [bad] = checkThemeOptions(theme, { toggle: 'no' });
  assert.equal(bad.message, '"toggle" must be one of true, false, got "no"');
  assert.equal(bad.hint, undefined);
});
