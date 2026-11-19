import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'linkprofile/src/build.js';
import { listThemes } from 'linkprofile/src/themes.js';

// Display order on the homepage.
export const HOMEPAGE_THEMES = ['classic', 'bento', 'cover', 'editorial', 'crimson'];

const THEME_LINE = '  theme: classic';

export function checkHomepageThemes(listed, builtIn) {
  const missing = builtIn.filter((t) => !listed.includes(t));
  const extra = listed.filter((t) => !builtIn.includes(t));
  if (!missing.length && !extra.length) return null;
  const parts = [];
  if (missing.length) parts.push(`missing from the homepage: ${missing.join(', ')}`);
  if (extra.length) parts.push(`on the homepage but not built in: ${extra.join(', ')}`);
  return `Homepage themes out of sync with linkprofile (${parts.join('; ')}). Update HOMEPAGE_THEMES in site/lib/demos.mjs and src/index.html.`;
}

export async function buildDemos({ starterDir, outDir }) {
  const names = listThemes().map((t) => t.name);
  for (const theme of names) {
    const work = await mkdtemp(join(tmpdir(), 'lp-demo-'));
    try {
      await cp(starterDir, work, { recursive: true });
      const configPath = join(work, 'profile.hjson');
      const source = await readFile(configPath, 'utf8');
      if (!source.includes(THEME_LINE)) throw new Error(`starter/profile.hjson has no "${THEME_LINE.trim()}" line to replace`);
      await writeFile(configPath, source.replace(THEME_LINE, `  theme: ${theme}`));
      await build({ config: configPath, out: join(outDir, 'demos', theme), cwd: work });
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
  return names;
}
