import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { loadNav } from './nav.mjs';
import { expandGenerated } from './generated.mjs';
import { DEMOS_MARKER, renderMarkdown } from './markdown.mjs';
import { relativeHref } from './paths.mjs';
import { HOMEPAGE_THEMES } from './demos.mjs';

const layoutsDir = join(dirname(fileURLToPath(import.meta.url)), '../src/layouts');
const engine = new Liquid({ root: layoutsDir, extname: '.liquid', outputEscape: 'escape' });

// The homepage phone component, one per theme, linking to the built demos.
function demoGrid(outFile) {
  const phones = HOMEPAGE_THEMES.map((theme) => {
    const href = relativeHref(outFile, `demos/${theme}/`);
    const note = theme === 'classic' ? ' <span class="font-normal text-muted">default</span>' : '';
    return `<a href="${href}" class="group shrink-0 snap-start !no-underline" aria-label="Open the ${theme} theme demo">
<div class="phone"><div class="screen"><iframe src="${href}" title="${theme} theme" loading="lazy" tabindex="-1"></iframe></div></div>
<p class="!mt-3 text-[15px] font-medium !text-ink">${theme}${note}</p>
</a>`;
  });
  return `<div role="group" aria-label="Theme demos" class="-mx-2 mt-8 flex scroll-px-2 snap-x snap-mandatory flex-nowrap gap-x-5 overflow-x-auto px-2 pb-6 pt-4 sm:mx-0 sm:px-0 sm:snap-none sm:flex-wrap sm:gap-y-8 sm:overflow-visible sm:pt-0">\n${phones.join('\n')}\n</div>\n`;
}

export async function buildDocs({ docsDir, outDir }) {
  const nav = loadNav(join(docsDir, 'nav.json'));
  const slugs = new Set(nav.pages.map((p) => p.slug));
  const files = (await readdir(docsDir)).filter((f) => f.endsWith('.md'));
  for (const f of files) {
    if (!slugs.has(f.slice(0, -3))) throw new Error(`${join(docsDir, f)} is not listed in nav.json`);
  }
  const have = new Set(files.map((f) => f.slice(0, -3)));
  for (const p of nav.pages) {
    if (!have.has(p.slug)) throw new Error(`nav.json lists "${p.slug}" but ${join(docsDir, `${p.slug}.md`)} does not exist`);
  }

  // Check every cross-page anchor against the headings the target page really has.
  const ids = new Map();
  const pre = [];
  for (const p of nav.pages) {
    const mdFile = join(docsDir, `${p.slug}.md`);
    const doc = renderMarkdown(expandGenerated(await readFile(mdFile, 'utf8')), { file: mdFile, resolveLink: () => '' });
    ids.set(p.slug, new Set(doc.ids));
    pre.push({ mdFile, links: doc.links });
  }
  for (const { mdFile, links } of pre) {
    for (const href of links) {
      const [, slug, hash] = /^([^#]+)\.md(?:#(.*))?$/.exec(href);
      if (!ids.has(slug)) throw new Error(`${mdFile}: link "${href}" does not match any docs page`);
      if (hash && !ids.get(slug).has(hash)) throw new Error(`${mdFile}: link "${href}" points to a heading that does not exist in ${slug}.md`);
    }
  }

  const written = [];
  const renderPage = async (page, index, outFile) => {
    const mdFile = join(docsDir, `${page.slug}.md`);
    const source = expandGenerated(await readFile(mdFile, 'utf8'));
    const doc = renderMarkdown(source, {
      file: mdFile,
      resolveLink: (slug, hash) => (slugs.has(slug) ? relativeHref(outFile, `docs/${slug}/${hash ? `#${hash}` : ''}`) : null),
    });
    const href = (p) => relativeHref(outFile, `docs/${p.slug}/`);
    const link = (p) => (p ? { title: p.title, href: href(p) } : null);
    const html = await engine.renderFile('docs', {
      title: doc.title,
      description: doc.description,
      group: page.group,
      slug: page.slug,
      article: doc.html.replaceAll(DEMOS_MARKER, () => demoGrid(outFile)),
      toc: doc.toc,
      stylesheet: relativeHref(outFile, 'assets/site.css'),
      home: relativeHref(outFile, 'index.html'),
      themesHref: relativeHref(outFile, 'index.html#themes'),
      docsHref: relativeHref(outFile, 'docs/'),
      groups: nav.groups.map((g) => ({
        title: g.title,
        pages: g.pages.map((p) => ({ title: p.title, href: href(p), current: p.slug === page.slug })),
      })),
      prev: link(nav.pages[index - 1]),
      next: link(nav.pages[index + 1]),
    });
    const target = join(outDir, outFile);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html);
    written.push(target);
  };

  for (const [i, p] of nav.pages.entries()) await renderPage(p, i, `docs/${p.slug}/index.html`);
  await renderPage(nav.pages[0], 0, 'docs/index.html');
  return written;
}
