import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HOMEPAGE_THEMES } from './demos.mjs';
import { listThemes, loadTheme } from 'linkprofile/src/themes.js';
import { getSocialIcon } from 'linkprofile/src/icons.js';

const SOCIAL_TYPES = ['x', 'twitter', 'github', 'gitlab', 'linkedin', 'instagram', 'youtube', 'tiktok', 'mastodon', 'bluesky', 'threads', 'facebook', 'figma', 'dribbble', 'behance', 'email', 'website'];

const cell = (s) => String(s).replace(/\|/g, '\\|');

function themeOptions() {
  const names = listThemes().map(({ name }) => name);
  const ordered = [...HOMEPAGE_THEMES.filter((n) => names.includes(n)), ...names.filter((n) => !HOMEPAGE_THEMES.includes(n)).sort()];
  return ordered.map((name) => {
    const theme = loadTheme(name);
    const rows = Object.entries(theme.options).map(([key, def]) => {
      const values = theme.choices[key]?.join(', ') ?? (theme.types[key] === 'color' ? 'a colour' : typeof def);
      return `| \`${cell(key)}\` | ${cell(values)} | \`${cell(def)}\` |`;
    });
    return `## ${name}\n\n${theme.description}${/[.!?]$/.test(theme.description) ? '' : '.'}\n\n| Option | Values | Default |\n| --- | --- | --- |\n${rows.join('\n')}\n`;
  }).join('\n');
}

function socialTypes() {
  const rows = SOCIAL_TYPES.map((type) => {
    const icon = getSocialIcon(type);
    if (!icon) throw new Error(`Social type "${type}" no longer resolves in linkprofile; update site/lib/generated.mjs`);
    return `| \`${type}\` | ${cell(icon.title)} |`;
  });
  return `| Type | Shown as |\n| --- | --- |\n${rows.join('\n')}\n`;
}

function classicArtwork() {
  const dir = join(loadTheme('classic').dir, 'icons');
  const names = readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort();
  return names.map((n) => `- \`${n}\``).join('\n') + '\n';
}

const GENERATORS = { 'theme-options': themeOptions, 'social-types': socialTypes, 'classic-artwork': classicArtwork };

export function expandGenerated(md) {
  return md.replace(/<!-- generated: ([^>]*?) -->/g, (_, name) => {
    const gen = Object.hasOwn(GENERATORS, name.trim()) ? GENERATORS[name.trim()] : null;
    if (!gen) throw new Error(`Unknown generated section "${name}" (known: ${Object.keys(GENERATORS).join(', ')})`);
    return gen();
  });
}
