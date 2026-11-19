import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDocs } from '../lib/docs.mjs';
import { expandGenerated } from '../lib/generated.mjs';
import { buildSite } from '../build.mjs';
import { loadNav } from '../lib/nav.mjs';
import { HOMEPAGE_THEMES } from '../lib/demos.mjs';

const docsDir = join(dirname(fileURLToPath(import.meta.url)), '../docs');
const nav = loadNav(join(docsDir, 'nav.json'));

async function withTemp(fn, { copyDocs = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'lp-docs-'));
  const docs = join(root, 'docs-src');
  const out = join(root, 'out');
  try {
    if (copyDocs) await cp(docsDir, docs, { recursive: true });
    await fn({ docs, out });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const read = (out, p) => readFile(join(out, p), 'utf8');

test('every nav page is generated with pretty URL', () => withTemp(async ({ docs, out }) => {
  const files = await buildDocs({ docsDir: docs, outDir: out });
  assert.equal(nav.pages.length, 15);
  for (const p of nav.pages) assert.ok(existsSync(join(out, `docs/${p.slug}/index.html`)), p.slug);
  assert.ok(existsSync(join(out, 'docs/index.html')));
  assert.equal(files.length, 16);
}));

test('docs/index.html is the first page rendered for its own depth', () => withTemp(async ({ docs, out }) => {
  await buildDocs({ docsDir: docs, outDir: out });
  const html = await read(out, 'docs/index.html');
  assert.match(html, /href="\.\.\/assets\/site\.css"/);
  assert.match(html, /<h1[^>]*>What linkprofile is<\/h1>/);
  assert.match(html, /href="getting-started\/"/);
}));

test('page missing from nav fails', () => withTemp(async ({ docs, out }) => {
  await writeFile(join(docs, 'orphan.md'), '---\ntitle: Orphan\ndescription: x\n---\nHi.\n');
  await assert.rejects(buildDocs({ docsDir: docs, outDir: out }), /orphan\.md/);
}));

test('nav page without file fails', () => withTemp(async ({ docs, out }) => {
  await rm(join(docs, 'command-line.md'));
  await assert.rejects(buildDocs({ docsDir: docs, outDir: out }), /command-line/);
}));

test('duplicate slugs in nav fail', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lp-nav-'));
  try {
    const f = join(root, 'nav.json');
    await writeFile(f, JSON.stringify({ groups: [{ title: 'A', pages: [['a', 'A'], ['a', 'B']] }] }));
    assert.throws(() => loadNav(f), /duplicate.*a/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('sidebar marks the current page', () => withTemp(async ({ docs, out }) => {
  await buildDocs({ docsDir: docs, outDir: out });
  const html = await read(out, 'docs/getting-started/index.html');
  const current = html.match(/aria-current="page"/g) ?? [];
  // sidebar and mobile menu each carry the same nav
  assert.equal(current.length, 2);
  for (const m of html.matchAll(/<a [^>]*aria-current="page"[^>]*>([^<]*)</g)) assert.equal(m[1], 'Getting started');
}));

test('prev/next follow nav order', () => withTemp(async ({ docs, out }) => {
  await buildDocs({ docsDir: docs, outDir: out });
  const first = await read(out, 'docs/what-is-linkprofile/index.html');
  assert.doesNotMatch(first, /Previous<span/);
  assert.match(first, /Next<span[^>]*>Getting started</);
  const mid = await read(out, 'docs/getting-started/index.html');
  assert.match(mid, /Previous<span[^>]*>What linkprofile is</);
  assert.match(mid, /Next<span[^>]*>Editing your page</);
  const last = await read(out, 'docs/command-line/index.html');
  assert.match(last, /Previous<span[^>]*>Icon names</);
  assert.doesNotMatch(last, /Next<span/);
}));

test('relative asset and page URLs', () => withTemp(async ({ docs, out }) => {
  await buildDocs({ docsDir: docs, outDir: out });
  const html = await read(out, 'docs/getting-started/index.html');
  assert.match(html, /href="\.\.\/\.\.\/assets\/site\.css"/);
  assert.match(html, /href="\.\.\/themes\/"/);
  assert.match(html, /href="\.\.\/\.\.\/index\.html"/);
  assert.doesNotMatch(html, /href="\/|href="https:\/\/fonts|cdn\./);
}));

test('mobile menu disclosure present', () => withTemp(async ({ docs, out }) => {
  await buildDocs({ docsDir: docs, outDir: out });
  const html = await read(out, 'docs/themes/index.html');
  const m = /<details class="[^"]*lg:hidden[^"]*">([\s\S]*?)<\/details>/.exec(html);
  assert.ok(m);
  assert.match(m[1], /Menu/);
  assert.match(m[1], /href="\.\.\/getting-started\/"/);
}));

test('titles escaped once', () => withTemp(async ({ docs, out }) => {
  await writeFile(join(docs, 'links-and-icons.md'), '---\ntitle: Links & <icons>\ndescription: A "quoted" & <b>d</b>\n---\n## Tom & <Jerry>\n\nText.\n');
  const nj = join(docs, 'nav.json');
  await writeFile(nj, (await readFile(nj, 'utf8')).replace('"Links and icons"', '"Links & <icons>"'));
  await buildDocs({ docsDir: docs, outDir: out });
  const html = await read(out, 'docs/links-and-icons/index.html');
  assert.match(html, /<title>Links &amp; &lt;icons&gt; — linkprofile docs<\/title>/);
  assert.match(html, />Links &amp; &lt;icons&gt;</);
  assert.match(html, /<meta name="description" content="A &#34;quoted&#34; &amp; &lt;b&gt;d&lt;\/b&gt;">/);
  assert.match(html, /href="#tom-jerry"[^>]*>Tom &amp; &lt;Jerry&gt;</);
  assert.doesNotMatch(html, /&amp;amp;|&amp;lt;/);
  const other = await read(out, 'docs/social-profiles/index.html');
  assert.match(other, /Previous<span[^>]*>Links &amp; &lt;icons&gt;</);
}));

test('generated theme options match theme.json', () => {
  const md = expandGenerated('<!-- generated: theme-options -->');
  assert.match(md, /^\| `mode` \| auto, light, dark \| `auto` \|$/m);
  const crimson = md.slice(md.indexOf('crimson'));
  assert.match(crimson, /^\| `mode` \| dark, light, auto \| `dark` \|$/m);
  assert.match(md, /^\| `toggle` \| true, false \| `true` \|$/m);
  assert.match(md, /^\| `accent` \| a colour \| `#3bd3a2` \|$/m);
});

test('generated social types resolve', () => {
  const md = expandGenerated('<!-- generated: social-types -->');
  assert.match(md, /^\| `twitter` \| X \|$/m);
  assert.match(md, /^\| `github` \| GitHub \|$/m);
});

test('generated classic artwork lists svg names', () => {
  const md = expandGenerated('<!-- generated: classic-artwork -->');
  assert.match(md, /`book-open`/);
  assert.doesNotMatch(md, /\.svg/);
});

test('unknown generated name throws', () => {
  assert.throws(() => expandGenerated('<!-- generated: nope -->'), /nope/);
});

test('code blocks scroll and no script tags in docs pages', () => withTemp(async ({ docs, out }) => {
  await buildDocs({ docsDir: docs, outDir: out });
  for (const p of nav.pages) {
    const html = await read(out, `docs/${p.slug}/index.html`);
    assert.doesNotMatch(html, /<script/i, p.slug);
  }
  const opts = await read(out, 'docs/theme-options/index.html');
  assert.match(opts, /<table/);
  assert.match(opts, /<td><code>mode<\/code>/);
}));

test('markdown link to another docs page resolves relatively', () => withTemp(async ({ docs, out }) => {
  await writeFile(join(docs, 'themes.md'), '---\ntitle: Themes, colours and dark mode\ndescription: x\n---\n## Colours\n\nText.\n');
  await writeFile(join(docs, 'preview-locally.md'), '---\ntitle: Preview on your computer\ndescription: x\n---\nSee [themes](themes.md#colours).\n');
  await buildDocs({ docsDir: docs, outDir: out });
  assert.match(await read(out, 'docs/preview-locally/index.html'), /href="\.\.\/themes\/#colours"/);
}));

test('code blocks scroll sideways inside their panel', () => withTemp(async ({ docs, out }) => {
  await writeFile(join(docs, 'writing-hjson.md'), '---\ntitle: Writing Hjson without mistakes\ndescription: x\n---\n```hjson\nname: Ada\n```\n');
  await buildDocs({ docsDir: docs, outDir: out });
  assert.match(await read(out, 'docs/writing-hjson/index.html'), /<pre class="[^"]*overflow-x-auto/);
}));

test('link to a missing page fails naming the page file', () => withTemp(async ({ docs, out }) => {
  await writeFile(join(docs, 'writing-hjson.md'), '---\ntitle: Writing Hjson without mistakes\ndescription: x\n---\n[x](nope.md)\n');
  await assert.rejects(buildDocs({ docsDir: docs, outDir: out }), /writing-hjson\.md.*nope\.md/);
}));

test('link to a missing heading fails naming the page file', () => withTemp(async ({ docs, out }) => {
  await writeFile(join(docs, 'writing-hjson.md'), '---\ntitle: Writing Hjson without mistakes\ndescription: x\n---\n[x](themes.md#missing)\n');
  await assert.rejects(buildDocs({ docsDir: docs, outDir: out }), /writing-hjson\.md.*themes\.md#missing/);
}));

test('menu lists the page toc and the same nav as the sidebar', () => withTemp(async ({ docs, out }) => {
  await writeFile(join(docs, 'writing-hjson.md'), '---\ntitle: Writing Hjson without mistakes\ndescription: x\n---\n## First part\n\nText.\n');
  await writeFile(join(docs, 'custom-domain.md'), '---\ntitle: Use your own domain\ndescription: x\n---\nNo headings here.\n');
  await buildDocs({ docsDir: docs, outDir: out });
  const html = await read(out, 'docs/writing-hjson/index.html');
  const menu = /<details[\s\S]*?<\/details>/.exec(html)[0];
  assert.match(menu, /On this page[\s\S]*href="#first-part"/);
  const plain = await read(out, 'docs/custom-domain/index.html');
  assert.doesNotMatch(/<details[\s\S]*?<\/details>/.exec(plain)[0], /On this page/);
}));

test('built CSS contains a :target rule for prose headings', async () => {
  const out = await mkdtemp(join(tmpdir(), 'lp-css-'));
  try {
    await buildSite({ outDir: out });
    const css = await readFile(join(out, 'assets/site.css'), 'utf8');
    assert.match(css, /\.prose-doc :is\(h2,\s*h3\):target/);
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('link with anchor to a missing page names the page file', () => withTemp(async ({ docs, out }) => {
  await writeFile(join(docs, 'writing-hjson.md'), '---\ntitle: Writing Hjson without mistakes\ndescription: x\n---\n[x](nope.md#foo)\n');
  await assert.rejects(buildDocs({ docsDir: docs, outDir: out }), /writing-hjson\.md.*nope\.md#foo/);
}));

test('anchor to an h4 heading is accepted', () => withTemp(async ({ docs, out }) => {
  await writeFile(join(docs, 'themes.md'), '---\ntitle: Themes, colours and dark mode\ndescription: x\n---\n## Top\n\n#### Deep sub\n\nText.\n');
  await writeFile(join(docs, 'writing-hjson.md'), '---\ntitle: Writing Hjson without mistakes\ndescription: x\n---\n[x](themes.md#deep-sub)\n');
  await buildDocs({ docsDir: docs, outDir: out });
  assert.match(await read(out, 'docs/writing-hjson/index.html'), /href="\.\.\/themes\/#deep-sub"/);
}));

test('demos marker expands to a phone per theme in homepage order', () => withTemp(async ({ docs, out }) => {
  await writeFile(join(docs, 'themes.md'), '---\ntitle: Themes, colours and dark mode\ndescription: x\n---\nIntro.\n\n<!-- demos -->\n\nAfter.\n');
  await buildDocs({ docsDir: docs, outDir: out });
  const html = await read(out, 'docs/themes/index.html');
  assert.doesNotMatch(html, /<!-- demos -->|&lt;!--/);
  const frames = [...html.matchAll(/<div class="phone"><div class="screen"><iframe src="([^"]+)" title="(\w+) theme" loading="lazy" tabindex="-1"><\/iframe><\/div><\/div>/g)];
  assert.deepEqual(frames.map((m) => m[1]), HOMEPAGE_THEMES.map((t) => `../../demos/${t}/`));
  for (const t of HOMEPAGE_THEMES) assert.match(html, new RegExp(`<a href="\\.\\./\\.\\./demos/${t}/"[^>]*aria-label="Open the ${t} theme demo"`));
}));
