import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../src/build.js';
import { linkIconNames } from '../src/icons.js';
import { isDarkColor } from '../src/color.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const starter = path.join(here, '..', '..', '..', 'starter');
const themeDir = path.join(here, '..', 'themes', 'classic');
const fixtureImages = path.join(here, 'fixtures', 'sample', 'images');

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'lp-classic-'));
const count = (s, re) => (s.match(re) ?? []).length;
const normalise = (html) => html.replace(/(<meta name="generator" content="linkprofile )[^"]*"/, '$1VERSION"');

// Builds the starter (or an inline profile, with the sample fixture's images) into a fresh dir.
async function buildClassic(profileText) {
  let cwd = starter;
  if (profileText !== undefined) {
    cwd = await tmp();
    await fs.cp(fixtureImages, path.join(cwd, 'images'), { recursive: true });
    await fs.writeFile(path.join(cwd, 'profile.hjson'), profileText);
  }
  const out = await tmp();
  const result = await build({ cwd, out, url: 'https://example.github.io/links' });
  const html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
  const css = await fs.readFile(path.join(out, 'theme', 'style.css'), 'utf8');
  return { out, html, css, result };
}

test('starter snapshot (classic)', async () => {
  const { html } = await buildClassic();
  const actual = normalise(html);
  const file = path.join(here, 'snapshots', 'starter.html');
  if (process.env.UPDATE_SNAPSHOTS === '1') {
    await fs.writeFile(file, actual);
    return;
  }
  assert.equal(actual, await fs.readFile(file, 'utf8'));
});

test('classic is the default theme', async () => {
  const { result } = await buildClassic('{\n  name: Ann\n}\n');
  assert.equal(result.theme, 'classic');
  assert.deepEqual(result.warnings, []);
  const starterResult = await buildClassic();
  assert.equal(starterResult.result.theme, 'classic');
});

test('build output includes the stylesheet and self-hosted Space Grotesk 400-700', async () => {
  const { out, css } = await buildClassic();
  for (const w of [400, 500, 600, 700]) {
    await fs.access(path.join(out, `theme/assets/fonts/space-grotesk-latin-${w}-normal.woff2`));
    assert.match(css, new RegExp(`url\\("assets/fonts/space-grotesk-latin-${w}-normal\\.woff2"\\)`));
  }
  await fs.access(path.join(out, 'theme/assets/fonts/OFL.txt'));
});

test('no external requests; the only script is the inline toggle', async () => {
  const { html, css } = await buildClassic();
  assert.doesNotMatch(css, /@import/);
  assert.doesNotMatch(css, /url\(\s*["']?(?:https?:|\/)/i);
  assert.doesNotMatch(html, /fonts\.googleapis|tailwindcss|dicebear|onerror/);
  assert.doesNotMatch(html, /(?:src|href)="\//);
  assert.equal(count(html, /<script/g), 1);
  assert.match(html, /<script>\n[\s\S]*?<\/script>/);
  assert.doesNotMatch(html, /<script[^>]*\ssrc=/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.match(script, /try \{ saved = localStorage\.getItem\('linkprofile-theme'\); \} catch/);
  assert.match(script, /try \{ localStorage\.setItem\('linkprofile-theme', saved\); \} catch/);
  assert.match(script, /classList\.toggle\('dark', dark\)/);
});

test('the inline script is static: no profile data reaches it', async () => {
  const script = (html) => html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const a = await buildClassic();
  const b = await buildClassic('{\n  theme: { name: "classic", options: { accent: "#ff0066" } }\n  name: </script><script>alert(1)</script>\n  bio: "\'; alert(1); //"\n}\n');
  assert.equal(script(b.html), script(a.html));
  assert.equal(count(b.html, /<script/g), 1);
});

test('without JavaScript the page renders: toggle hidden, colours follow the system', async () => {
  const { html, css } = await buildClassic();
  assert.match(html, /<html lang="en" data-mode="auto">/);
  const button = html.match(/<button[^>]*>/)[0];
  assert.match(button, /\shidden>$/);
  assert.match(button, /aria-label="Dark mode"/);
  assert.match(button, /aria-pressed="false"/);
  assert.match(button, /type="button"/);
  assert.match(css, /\.theme-toggle\[hidden\] \{\s*display: none;/);
  // Every link and social is plain markup, present without the script.
  assert.equal(count(html, /<a\s/g), 10);
  const darkQueries = [...css.matchAll(/@media \(prefers-color-scheme: dark\) \{\s*([^{]*)\{/g)].map((m) => m[1].trim());
  assert.deepEqual(darkQueries, [':root[data-mode="auto"]:not(.light)']);
  assert.match(css, /:root\[data-mode="dark"\],\n:root\.dark \{[^}]*--page: #121214;/);
});

test('forced mode or toggle: false drops the toggle and the script', async () => {
  for (const options of ['{ mode: "light" }', '{ mode: "dark" }', '{ toggle: false }', '{ mode: "dark", toggle: true }']) {
    const { html, result } = await buildClassic(`{\n  theme: { name: "classic", options: ${options} }\n  name: Ann\n}\n`);
    assert.deepEqual(result.warnings, []);
    assert.doesNotMatch(html, /<script|<button/, options);
  }
  const { html } = await buildClassic('{\n  theme: { name: "classic", options: { mode: "dark" } }\n  name: Ann\n}\n');
  assert.match(html, /<html lang="en" data-mode="dark">/);
});

test('invalid mode or toggle is an error with a suggestion', async () => {
  await assert.rejects(buildClassic('{\n  theme: { name: "classic", options: { mode: "drak" } }\n  name: Ann\n}\n'), (e) => {
    const issue = e.issues.find((i) => i.level === 'error');
    assert.equal(issue.path, 'theme.options.mode');
    assert.equal(issue.message, '"mode" must be one of auto, light, dark, got "drak"');
    assert.equal(issue.hint, 'Did you mean "dark"?');
    return true;
  });
  await assert.rejects(buildClassic('{\n  theme: { name: "classic", options: { toggle: "no" } }\n  name: Ann\n}\n'), (e) => {
    const issue = e.issues.find((i) => i.level === 'error');
    assert.equal(issue.path, 'theme.options.toggle');
    assert.equal(issue.message, '"toggle" must be one of true, false, got "no"');
    return true;
  });
});

test('minimal profile has no empty sections', async () => {
  const { html } = await buildClassic('{\n  name: Ann\n  links_title: Featured Links\n}\n');
  assert.match(html, /<h1 class="name">Ann<span class="dot" aria-hidden="true"><\/span><\/h1>/);
  for (const cls of ['socials', 'links-title', 'links', 'bio']) assert.doesNotMatch(html, new RegExp(`class="${cls}"`));
  assert.doesNotMatch(html, /<img|Featured Links/);
});

test('text is escaped exactly once', async () => {
  const { html } = await buildClassic('{\n  name: A & B <i>\n  bio: Tom & Jerry\n  links: [\n    {\n      title: Q&A\n      url: https://ann.example/?a=1&b=2\n    }\n  ]\n}\n');
  assert.match(html, /<h1 class="name">A &amp; B &lt;i&gt;<span/);
  assert.match(html, /<p class="bio">Tom &amp; Jerry<\/p>/);
  assert.match(html, /<span class="link-title">Q&amp;A<\/span>/);
  assert.match(html, /href="https:\/\/ann\.example\/\?a=1&amp;b=2"/);
  assert.doesNotMatch(html, /&amp;amp;/);
});

test('socials open in a new tab like the design; links open in the same tab', async () => {
  const { html } = await buildClassic(`{
  name: Ann
  socials: [
    { type: "github", url: "https://github.com/ann" }
    { type: "email", url: "mailto:ann@example.com" }
  ]
  links: [
    {
      title: Site
      url: https://ann.example/
    }
    {
      title: Mail
      url: mailto:ann@example.com
    }
  ]
}
`);
  assert.match(html, /<a href="https:\/\/github\.com\/ann" aria-label="GitHub" target="_blank" rel="noopener noreferrer">/);
  assert.match(html, /<a href="mailto:ann@example\.com" aria-label="Email">/);
  assert.match(html, /<a class="link" href="https:\/\/ann\.example\/" rel="noopener">/);
  assert.match(html, /<a class="link" href="mailto:ann@example\.com">/);
  assert.equal(count(html, /target=/g), 1);
});

test('starter uses the design artwork, palette by position, and the accent dot', async () => {
  const { html } = await buildClassic();
  const icons = [...html.matchAll(/<span class="link-icon ([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(icons, ['is-art palette-0', 'is-art palette-1', 'is-art palette-2', 'is-art palette-3', 'is-art palette-4']);
  assert.match(html, /style="--accent: #3bd3a2"/);
  assert.match(html, /<img class="avatar" src="images\/avatar\.png" alt="" width="76" height="76">/);
});

test('icon fallbacks: image, lucide glyph on a frame, initial letter; link colours', async () => {
  const { html, css } = await buildClassic(`{
  theme: { name: "classic", options: { accent: "#ff0066" } }
  name: Ann
  links: [
    {
      title: Shop
      url: https://shop.example/
      image: images/shop.png
    }
    {
      title: Launch
      url: https://ann.example/launch
      icon: rocket
      color: "#fde68a"
    }
    {
      title: zines
      url: https://zines.example/
      color: "#000000"
    }
  ]
}
`);
  assert.match(html, /style="--accent: #ff0066"/);
  const items = html.match(/<li class="link-item">[\s\S]*?<\/li>/g);
  assert.equal(items.length, 3);
  assert.match(items[0], /<span class="link-icon is-image palette-0"><img src="images\/shop\.png" alt="" width="28" height="28">/);
  assert.match(items[1], /<span class="link-icon is-glyph custom" style="--tone-a: #fde68a"><svg class="link-frame"[^>]*>.*?<\/svg><svg[^>]*fill="none"[^>]*stroke="currentColor"/s);
  assert.match(items[2], /<span class="link-icon is-initial custom ink-light" style="--tone-a: #000000"><svg class="link-frame"[^>]*>.*?<\/svg><span class="link-initial" aria-hidden="true">Z<\/span>/s);
  const ink = css.match(/\.ink-light \{[^}]*--icon-ink: (#[0-9a-f]{6});/)?.[1];
  assert.equal(isDarkColor(ink), false);
});

test('classic icon artwork: the thirteen drawings, recoloured through icon-stroke / icon-fill', async () => {
  const dir = path.join(themeDir, 'icons');
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.svg')).sort();
  assert.deepEqual(files, ['book-open', 'calendar', 'camera', 'clock', 'globe', 'heart', 'link', 'mail', 'music', 'pencil', 'play', 'shopping-bag', 'shopping-cart'].map((n) => n + '.svg'));
  const lucide = new Set(linkIconNames());
  for (const f of files) {
    assert.ok(lucide.has(f.slice(0, -4)), f);
    const svg = await fs.readFile(path.join(dir, f), 'utf8');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24"/, f);
    assert.doesNotMatch(svg, /\sid=|<script|href=|url\(/i, f);
    assert.ok(svg.indexOf('class="horizon"') > 0 && svg.indexOf('class="horizon"') < svg.indexOf('class="tone-b"'), f);
    assert.match(svg, /class="icon-stroke"/, f);
    // Every ink-coloured shape outside a group carries a class the dark mode recolours.
    for (const el of svg.match(/^ {2}<(?:path|circle|rect|ellipse|g)\b[^>]*>/gm)) {
      assert.match(el, /class="(?:horizon|tone-a|tone-b|cut|icon-stroke|icon-fill)"|<g transform/, `${f}: ${el}`);
    }
  }
  // The design's five drawings use plain (butt) line ends, unlike the other drawings' rounded ones.
  for (const name of ['globe', 'pencil', 'mail', 'shopping-cart', 'clock']) {
    assert.doesNotMatch(await fs.readFile(path.join(dir, `${name}.svg`), 'utf8'), /stroke-linecap="round"/, name);
  }
});

test('accessibility: focus rings and reduced motion', async () => {
  const { css } = await buildClassic();
  assert.match(css, /a:focus-visible,\nbutton:focus-visible \{\s*outline: 2px solid/);
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*$/)[0];
  assert.match(reduced, /\.link:hover,[\s\S]*transform: none;/);
  assert.match(reduced, /\.theme-toggle:hover/);
});
