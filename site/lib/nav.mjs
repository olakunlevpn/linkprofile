import { readFileSync } from 'node:fs';

export function loadNav(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const seen = new Set();
  const pages = [];
  const groups = raw.groups.map((g) => ({
    title: g.title,
    pages: g.pages.map(([slug, title]) => {
      if (seen.has(slug)) throw new Error(`${file}: duplicate slug "${slug}"`);
      seen.add(slug);
      pages.push({ slug, title, group: g.title });
      return { slug, title };
    }),
  }));
  return { groups, pages };
}
