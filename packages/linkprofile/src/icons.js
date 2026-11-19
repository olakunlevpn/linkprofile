import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const SOCIAL_ALIASES = { twitter: 'x' };
const LUCIDE_SOCIALS = {
  email: { icon: 'mail', title: 'Email' },
  mail: { icon: 'mail', title: 'Email' },
  website: { icon: 'globe', title: 'Website' },
};
// Brands missing from simple-icons, or drawn there as outlines where a solid glyph reads better.
const BUNDLED = {
  linkedin: { file: join(here, 'icons', 'linkedin.svg'), title: 'LinkedIn' },
  dribbble: { file: join(here, 'icons', 'dribbble.svg'), title: 'Dribbble' },
  figma: { file: join(here, 'icons', 'figma.svg'), title: 'Figma' },
};

const SAFE_NAME = /^[a-z0-9_-]+$/;
const normalize = (s) => String(s).toLowerCase().replace(/[\s.]/g, '');

const dirCache = new Map();
function listNames(key, resolveSample) {
  if (!dirCache.has(key)) {
    const base = dirname(require.resolve(resolveSample));
    dirCache.set(key, readdirSync(base).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort());
  }
  return dirCache.get(key);
}
const simpleNames = () => listNames('simple', 'simple-icons/icons/github.svg');
const lucideNames = () => listNames('lucide', 'lucide-static/icons/globe.svg');

function readSvg(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

function clean(raw, { fill } = {}) {
  let svg = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/<title>[\s\S]*?<\/title>/g, '').trim();
  svg = svg.replace(/^<svg([^>]*)>/, (_, attrs) => {
    attrs = attrs.replace(/\s(?:class|width|height|role)="[^"]*"/g, '');
    return `<svg${attrs} aria-hidden="true" focusable="false"${fill ? ' fill="currentColor"' : ''}>`;
  });
  return svg;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (m, hex, dec, name) => {
  if (name) return Object.hasOwn(ENTITIES, name) ? ENTITIES[name] : m;
  return String.fromCodePoint(hex ? parseInt(hex, 16) : Number(dec));
});
const titleOf = (raw) => {
  const t = raw.match(/<title>([\s\S]*?)<\/title>/)?.[1];
  return t === undefined ? null : decode(t.trim());
};

function lucideSvg(name) {
  if (!SAFE_NAME.test(name)) return null;
  let path;
  try { path = require.resolve(`lucide-static/icons/${name}.svg`); } catch { return null; }
  const raw = readSvg(path);
  return raw && clean(raw);
}

export function getSocialIcon(type) {
  const key = normalize(type);
  if (Object.hasOwn(LUCIDE_SOCIALS, key)) {
    const svg = lucideSvg(LUCIDE_SOCIALS[key].icon);
    return svg ? { type: key, title: LUCIDE_SOCIALS[key].title, svg } : null;
  }
  const slug = Object.hasOwn(SOCIAL_ALIASES, key) ? SOCIAL_ALIASES[key] : key;
  const bundled = Object.hasOwn(BUNDLED, slug) ? BUNDLED[slug] : null;
  const file = bundled?.file;
  let raw = null;
  if (file) raw = readSvg(file);
  else if (SAFE_NAME.test(slug)) {
    try { raw = readSvg(require.resolve(`simple-icons/icons/${slug}.svg`)); } catch { raw = null; }
  }
  if (!raw) return null;
  return { type: key, title: bundled?.title ?? titleOf(raw) ?? slug, svg: clean(raw, { fill: true }) };
}

export const hasSocialIcon = (type) => getSocialIcon(type) !== null;
export const getLinkIcon = (name) => lucideSvg(String(name).toLowerCase());
export const hasLinkIcon = (name) => getLinkIcon(name) !== null;

// A theme may ship its own artwork for named link icons as <theme>/icons/<name>.svg.
// Names are still validated against lucide, so lucide stays the fallback for every name.
export function getThemeIcon(themeDir, name) {
  const key = String(name).toLowerCase();
  if (!themeDir || !SAFE_NAME.test(key)) return null;
  const raw = readSvg(join(themeDir, 'icons', `${key}.svg`));
  return raw && clean(raw);
}

export function socialIconNames() {
  return [...new Set([...simpleNames(), ...Object.keys(SOCIAL_ALIASES), ...Object.keys(LUCIDE_SOCIALS), ...Object.keys(BUNDLED)])].sort();
}
export const linkIconNames = () => [...lucideNames()];
