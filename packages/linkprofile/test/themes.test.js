// Contract checks run against every built-in theme, so a new theme is covered as soon as it is added.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Hjson from 'hjson';
import { build } from '../src/build.js';
import { listThemes, loadTheme } from '../src/themes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const starter = path.join(here, '..', '..', '..', 'starter');
const themes = listThemes().map((t) => t.name);
const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'lp-themes-'));

// Builds the starter profile with its theme line replaced, or `profileText` with the starter's images.
async function buildWith(theme, profileText) {
  const cwd = await tmp();
  await fs.cp(path.join(starter, 'images'), path.join(cwd, 'images'), { recursive: true });
  let text = profileText ?? (await fs.readFile(path.join(starter, 'profile.hjson'), 'utf8'));
  const themeLine = `  theme: ${JSON.stringify(theme)}`;
  if (/^ {2}theme: classic$/m.test(text)) text = text.replace(/^ {2}theme: classic$/m, themeLine);
  else if (!/^\s*theme:/m.test(text)) text = text.replace(/^\{\n/, `{\n${themeLine}\n`);
  await fs.writeFile(path.join(cwd, 'profile.hjson'), text);
  const out = await tmp();
  const result = await build({ cwd, out });
  const html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
  const css = await fs.readFile(path.join(out, 'theme', 'style.css'), 'utf8');
  return { cwd, out, result, html, css };
}

const starterProfile = Hjson.parse(await fs.readFile(path.join(starter, 'profile.hjson'), 'utf8'));
const userUrls = new Set([...starterProfile.links.map((l) => l.url), ...starterProfile.socials.map((s) => s.url)]);

test('the built-in themes are classic, bento, cover, crimson and editorial', () => {
  assert.deepEqual(themes, ['bento', 'classic', 'cover', 'crimson', 'editorial']);
});

for (const name of themes) {
  test(`${name}: builds the starter profile with zero warnings`, async () => {
    const { result } = await buildWith(name);
    assert.equal(result.theme, name);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.links, starterProfile.links.length);
    assert.equal(result.socials, starterProfile.socials.length);
  });

  test(`${name}: makes no external requests and links assets relatively`, async () => {
    const { html, css } = await buildWith(name);
    assert.doesNotMatch(css, /https?:\/\//, 'style.css must not reference other origins');
    assert.doesNotMatch(css, /@import/);
    for (const [, url] of css.matchAll(/url\(\s*["']?([^"')]+)/g)) {
      assert.doesNotMatch(url, /^(?:[a-z][a-z0-9+.-]*:|\/)/i, `style.css url(${url}) must be relative`);
    }
    for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
      assert.doesNotMatch(tag, /href="(?:[a-z][a-z0-9+.-]*:|\/)/i, `${tag} must be relative`);
    }
    // Every src/href is either a link or social from the profile, or a relative path.
    for (const [, attr, url] of html.matchAll(/\b(src|href)="([^"]*)"/g)) {
      if (attr === 'href' && userUrls.has(url)) continue;
      assert.doesNotMatch(url, /^(?:[a-z][a-z0-9+.-]*:|\/)/i, `${attr}="${url}" must be relative`);
    }
    // Nothing anywhere in the page (inline <style>, style="" attributes, any attribute or text)
    // points at another origin, except the profile's own links and the SVG namespace.
    const scrubbed = html
      .replace(/\shref="([^"]*)"/g, (m, url) => (userUrls.has(url) ? '' : m))
      .replace(/\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '');
    assert.doesNotMatch(scrubbed, /(?:[a-z][a-z0-9+.-]*:)?\/\/[a-z0-9]/i, 'the page must not reference other origins');
    assert.doesNotMatch(html, /@import/);
    for (const [, url] of html.matchAll(/url\(\s*(?:&#39;|&quot;|["'])?([^"')&]+)/g)) {
      assert.doesNotMatch(url, /^(?:[a-z][a-z0-9+.-]*:|\/)/i, `url(${url}) in the page must be relative`);
    }
    // Only classic has a script: its inline light/dark toggle.
    const scripts = html.match(/<script\b[^>]*>/gi) ?? [];
    if (name === 'classic') {
      assert.deepEqual(scripts, ['<script>']);
    } else {
      assert.deepEqual(scripts, []);
    }
  });

  test(`${name}: every url() in the stylesheet points at a file the build wrote`, async () => {
    const { out, css } = await buildWith(name);
    const themeOut = path.join(out, 'theme');
    for (const [, url] of css.matchAll(/url\(\s*["']?([^"')]+)/g)) {
      const file = path.resolve(themeOut, url);
      assert.ok(file.startsWith(themeOut + path.sep), `url(${url}) must stay inside theme/`);
      await assert.doesNotReject(fs.access(file), `url(${url}) must exist in the build`);
    }
  });

  test(`${name}: light, dark and auto are styled; auto follows the system with the dark palette`, async () => {
    const theme = loadTheme(name);
    const css = (await fs.readFile(path.join(theme.dir, 'style.css'), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.deepEqual([...(theme.choices.mode ?? [])].sort(), ['auto', 'dark', 'light']);
    // Light is the base palette; dark and auto need their own selectors.
    for (const mode of ['dark', 'auto']) assert.match(css, new RegExp(`\\[data-mode="${mode}"\\]`), `no [data-mode="${mode}"] selector`);
    const media = /@media \(prefers-color-scheme: dark\)\s*\{\s*([^{}]*)\{([^{}]*)\}\s*\}/.exec(css);
    assert.ok(media, 'auto needs a prefers-color-scheme: dark block');
    assert.match(media[1], /\[data-mode="auto"\]/, 'the prefers-color-scheme: dark block must be scoped to [data-mode="auto"]');
    const props = (decls) => [...decls.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => `${m[1]}: ${m[2].trim()}`).sort();
    const outside = css.replace(media[0], '');
    const dark = [...outside.matchAll(/([^{}]*\[data-mode="dark"\][^{}]*)\{([^{}]*)\}/g)].flatMap((m) => props(m[2]));
    assert.ok(dark.length > 0, 'the [data-mode="dark"] rules must set the dark palette');
    assert.deepEqual(props(media[2]), dark.sort(), 'auto-dark and dark palettes must match');
  });

  test(`${name}: the accent option drives the stylesheet`, async () => {
    const theme = loadTheme(name);
    const text = `{\n  theme: { name: ${JSON.stringify(name)}, options: { accent: "#123456" } }\n  name: Ann\n}\n`;
    const { html, css, result } = await buildWith(name, text);
    assert.deepEqual(result.warnings, []);
    assert.match(html, /--accent: #123456/);
    assert.match(css, /var\(--accent[,)]/);
    // The default accent may only appear as a var() fallback, not hard-coded in its place.
    const literal = css.replace(/var\(--accent,\s*#[0-9a-f]+\)/gi, '');
    assert.ok(!literal.toLowerCase().includes(theme.options.accent.toLowerCase()), `the default accent ${theme.options.accent} is hard-coded in style.css`);
  });

  test(`${name}: has focus-visible and reduced-motion styles`, async () => {
    const { css } = await buildWith(name);
    assert.match(css, /:focus-visible\s*[,{]/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\b(?:transition|animation)\s*:\s*none/);
  });

  test(`${name}: a name-only profile has no empty sections`, async () => {
    const { html, result } = await buildWith(name, '{\n  name: Ann\n  links_title: Featured Links\n}\n');
    assert.deepEqual(result.warnings, []);
    assert.match(html, /<h1[^>]*>Ann</);
    assert.doesNotMatch(html, /<img/);
    assert.doesNotMatch(html, /<a\s/, 'no links or socials to render');
    assert.doesNotMatch(html, /<(ul|ol|nav)\b/, 'no empty lists');
    assert.doesNotMatch(html, /Featured Links/, 'no links heading without links');
    // Any element left empty must be decoration hidden from assistive tech.
    for (const [tag] of html.matchAll(/<(div|section|header|footer|p|h2|span)\b[^>]*>\s*<\/\1>/g)) {
      assert.match(tag, /aria-hidden="true"/, `empty element ${tag}`);
    }
  });

  test(`${name}: text is escaped exactly once`, async () => {
    const { html } = await buildWith(name, '{\n  name: Ann & <Bob> "B"\n  bio: Fish & chips <b>\n  links: [\n    {\n      title: Q&A <now>\n      url: https://ann.example/?a=1&b=2\n    }\n  ]\n}\n');
    assert.match(html, />Ann &amp; &lt;Bob&gt; &#34;B&#34;</);
    assert.match(html, />Fish &amp; chips &lt;b&gt;</);
    assert.match(html, />Q&amp;A &lt;now&gt;</);
    assert.match(html, /href="https:\/\/ann\.example\/\?a=1&amp;b=2"/);
    assert.doesNotMatch(html, /&amp;(?:amp|lt|gt|quot|#\d+);/);
    assert.doesNotMatch(html, /<Bob>|<now>|<b>/);
  });

  test(`${name}: outlined social icons (email, website) are not filled in`, async () => {
    const text = '{\n  name: Ann\n  socials: [\n    { type: "email", url: "mailto:ann@example.com" }\n    { type: "website", url: "https://ann.example" }\n  ]\n}\n';
    const { html, css, result } = await buildWith(name, text);
    assert.deepEqual(result.warnings, []);
    const svgs = [...html.matchAll(/<a\b[^>]*href="(?:mailto:ann@example\.com|https:\/\/ann\.example)"[^>]*>\s*(<svg\b[^>]*>)/g)].map((m) => m[1]);
    assert.equal(svgs.length, 2);
    for (const tag of svgs) assert.match(tag, /\sfill="none"/);
    // CSS fill on the <svg> element itself would override that fill="none" (brand icons carry
    // their own fill="currentColor"), so no rule aimed at an svg element may set fill.
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g);
    for (const [, selector, body] of rules) {
      if (!/\bfill\s*:/.test(body)) continue;
      for (const sel of selector.split(',')) assert.doesNotMatch(sel.trim(), /\bsvg$/, `${sel.trim()} sets fill on an svg element`);
    }
  });

  test(`${name}: every choice of every option builds`, async () => {
    const theme = loadTheme(name);
    for (const [option, values] of Object.entries(theme.choices)) {
      for (const value of values) {
        const text = `{\n  theme: { name: ${JSON.stringify(name)}, options: { ${option}: ${JSON.stringify(value)} } }\n  name: Ann\n}\n`;
        const { html, result } = await buildWith(name, text);
        assert.deepEqual(result.warnings, [], `${option}: ${value}`);
        if (option === 'mode') assert.match(html, new RegExp(`<html lang="en" data-mode="${value}">`));
      }
    }
  });
}

for (const [name, cls] of [['editorial', 'ed-link-url'], ['crimson', 'cr-link-url']]) {
  test(`${name}: shows the host of http(s) links, never credentials, and the address of mailto/tel links`, async () => {
    const links = [
      ['https://user:secret@ann.example:8080/x?y=1#z', 'ann.example:8080'],
      ['https://r.example/go?u=https://other.example', 'r.example'],
      ['mailto:ann@example.com?subject=hi', 'ann@example.com'],
      ['tel:+1-555-0100', '+1-555-0100'],
    ];
    const text = `{\n  name: Ann\n  links: [\n${links.map(([url], i) => `    { title: "L${i}", url: "${url}" }`).join('\n')}\n  ]\n}\n`;
    const { html } = await buildWith(name, text);
    const shown = [...html.matchAll(new RegExp(`<span class="${cls}">([^<]*)</span>`, 'g'))].map((m) => m[1]);
    assert.deepEqual(shown, links.map(([, host]) => host));
    assert.doesNotMatch(html, new RegExp(`<span class="${cls}">[^<]*(?:secret|user)`));
  });
}
