import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../lib/markdown.mjs';
import { highlightHjson } from '../lib/hjson-highlight.mjs';

const fm = (body, title = 'Getting started') => `---\ntitle: ${title}\ndescription: A short page.\n---\n${body}`;
const resolveLink = (slug, hash) => (slug === 'nope' ? null : `../${slug}/${hash ? '#' + hash : ''}`);
const render = (body, title) => renderMarkdown(fm(body, title), { file: 'getting-started.md', resolveLink });

test('front matter, title and description', () => {
  const r = render('Hello.');
  assert.equal(r.title, 'Getting started');
  assert.equal(r.description, 'A short page.');
  assert.match(r.html, /<p>Hello\.<\/p>/);
});

test('missing title throws naming the file', () => {
  assert.throws(() => renderMarkdown('Hello', { file: 'x.md', resolveLink }), /x\.md/);
});

test('heading ids are unique slugs', () => {
  const r = render('## Edit profile.hjson\n\n## Edit profile.hjson\n');
  assert.match(r.html, /<h2 id="edit-profilehjson"[^>]*>Edit profile\.hjson<\/h2>/);
  assert.match(r.html, /<h2 id="edit-profilehjson-2"/);
});

test('toc has h2 and step h3 in order', () => {
  const r = render('<!-- steps -->\n1. **Copy the starter**\n   Open it.\n2. **Turn on Pages**\n   Click.\n\n## Next\n');
  assert.deepEqual(r.toc, [
    { id: 'copy-the-starter', text: 'Copy the starter', level: 3 },
    { id: 'turn-on-pages', text: 'Turn on Pages', level: 3 },
    { id: 'next', text: 'Next', level: 2 },
  ]);
});

test('note and tip callouts', () => {
  const r = render('> [!NOTE]\n> You need an account.\n\n> [!TIP]\n> **Three rules**\n> - one\n> - two\n');
  assert.match(r.html, /border-line bg-white/);
  assert.match(r.html, /You need an account\./);
  assert.match(r.html, /bg-mint-soft/);
  assert.match(r.html, /<li>one<\/li>/);
  assert.doesNotMatch(r.html, /\[!NOTE\]|\[!TIP\]/);
});

test('steps list', () => {
  const r = render('<!-- steps -->\n1. **Copy the starter**\n   Open the page and click <kbd>Use this template</kbd>.\n\n   ```hjson\n   name: A\n   ```\n2. **Next**\n   Done.\n');
  assert.match(r.html, /<ol class="steps/);
  assert.match(r.html, /<h3 id="copy-the-starter">Copy the starter<\/h3>/);
  assert.match(r.html, /<kbd>Use this template<\/kbd>/);
  assert.match(r.html, /<pre class="[^"]*overflow-x-auto/);
  assert.doesNotMatch(r.html, /steps -->/);
});

test('cards list', () => {
  const r = render('<!-- cards -->\n- [Pick a theme](themes.md) — Five looks.\n- [Avatar](themes.md#mode) — Use `avatar`.\n');
  assert.equal((r.html.match(/<a /g) || []).length, 2);
  assert.match(r.html, /<span class="block text-\[17px\] font-semibold !text-ink">Pick a theme<\/span>/);
  assert.match(r.html, /<span class="mt-1 block[^"]*">Five looks\.<\/span>/);
  assert.match(r.html, /href="\.\.\/themes\/#mode"/);
  assert.match(r.html, /<code>avatar<\/code>/);
});

test('hjson highlighting escapes once', () =>
  assert.equal(highlightHjson('# c\nname: A & <B>'), '<span class="text-white/40"># c</span>\n<span class="text-mint">name</span>: A &amp; &lt;B&gt;'));

test('hjson leaves urls and indented keys right', () => {
  assert.equal(highlightHjson('  url: https://x.io\nhttps://y'), '  <span class="text-mint">url</span>: https://x.io\nhttps://y');
});

test('code blocks scroll inside their panel', () => {
  const r = render('```hjson\nname: Ada\n```\n\n```sh\necho "<hi>"\n```\n');
  assert.equal((r.html.match(/<pre class="[^"]*overflow-x-auto[^"]*"><code>/g) || []).length, 2);
  assert.match(r.html, /<span class="text-mint">name<\/span>: Ada/);
  assert.match(r.html, /echo &quot;&lt;hi&gt;&quot;/);
});

test('md links resolved', () => {
  const r = render('See [modes](themes.md#mode) and [ext](https://example.com).');
  assert.match(r.html, /href="\.\.\/themes\/#mode"/);
  assert.match(r.html, /href="https:\/\/example\.com"/);
  assert.deepEqual(r.links, ['themes.md#mode']);
});

test('broken md link throws naming the file', () => {
  assert.throws(() => render('See [x](nope.md).'), /getting-started\.md.*nope\.md/);
});

test('raw html in markdown is escaped, not injected', () => {
  const r = render('a <b>c</b> & d\n\n<div onclick="x">hi</div>\n\n<!-- generated: x -->\n');
  assert.match(r.html, /a &lt;b&gt;c&lt;\/b&gt; &amp; d/);
  assert.doesNotMatch(r.html, /<b>|<div|<!--/);
});

test('entities in headings are decoded once', () => {
  const r = render('## A &amp; B\n');
  assert.match(r.html, /<h2 id="a-b">A &amp; B<\/h2>/);
  assert.deepEqual(r.toc, [{ id: 'a-b', text: 'A & B', level: 2 }]);
});

test('disallowed link schemes throw naming file and href', () => {
  for (const href of ['javascript:alert(1)', 'JaVaScRiPt:x', 'data:text/html,x', 'vbscript:x', '&#106;avascript:x', 'javascript&colon;alert(1)', 'java&Tab;script:x', 'jav&#x09;ascript:x']) {
    assert.throws(() => render(`[x](<${href}>)`), (e) => /getting-started\.md/.test(e.message) && e.message.includes(href));
  }
  assert.throws(() => render('![x](data:image/png;base64,AA)'), /getting-started\.md.*data:/);
  assert.throws(() => render('<!-- cards -->\n- [T](javascript:x) — d\n'), /getting-started\.md.*javascript:/);
});

test('allowed link forms pass', () => {
  const r = render('[a](https://x.io) [b](mailto:a@b.c) [c](#top) [d](../x/) [e](HTTP://X.IO) [f](tel:+15551234) [g](themes.md?x=a&b) [h](https://e.com/?a=1&b=2) [i](../x/#y)');
  assert.match(r.html, /mailto:a@b\.c/);
  assert.match(r.html, /tel:\+15551234/);
  assert.match(r.html, /href="https:\/\/e\.com\/\?a=1&amp;b=2"/);
  assert.match(r.html, /href="\.\.\/x\/#y"/);
});

test('invalid-example marker is swallowed and the code block still renders', () => {
  const r = render('<!-- invalid-example -->\n```hjson\nname: Ada # me\n```\n');
  assert.doesNotMatch(r.html, /invalid-example/);
  assert.match(r.html, /<pre class="[^"]*"><code>/);
});

test('demos marker passes through as a comment for the docs build', () => {
  const r = render('Intro.\n\n<!-- demos -->\n\nAfter.\n');
  assert.match(r.html, /^<!-- demos -->$/m);
});

test('other comments are still escaped', () => {
  const r = render('<!-- note to self -->\n');
  assert.doesNotMatch(r.html, /<!--/);
});
