import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BuildError } from './issues.js';
import { suggest } from './suggest.js';
import { isColor, colorMessage, colorHint } from './color.js';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Value types a theme can give its options in theme.json "types". Typed values can go
// into CSS (e.g. a style attribute), so they are checked rather than trusted.
const TYPES = {
  color: { check: isColor, message: colorMessage, hint: (key, fallback) => colorHint(key, isColor(fallback) ? fallback : '#34d399') },
};

export const defaultThemesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'themes');

function readManifest(dir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8'));
    if (m === null || typeof m !== 'object' || Array.isArray(m)) return { error: 'theme.json must be a JSON object' };
    return { manifest: m };
  } catch (e) {
    return { error: e.message };
  }
}

function themeNames(themesDir) {
  if (!fs.existsSync(themesDir)) return [];
  return fs
    .readdirSync(themesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(themesDir, e.name, 'theme.json')))
    .map((e) => e.name)
    .sort();
}

export function listThemes(themesDir = defaultThemesDir) {
  return themeNames(themesDir).map((name) => ({
    name,
    description: readManifest(path.join(themesDir, name)).manifest?.description ?? '',
  }));
}

export function loadTheme(name, themesDir = defaultThemesDir) {
  const names = themeNames(themesDir);
  if (!names.includes(name)) {
    const close = suggest(name, names);
    const hint = `${close ? `Did you mean "${close}"? ` : ''}Available: ${names.join(', ') || '(none)'}`;
    throw new BuildError([{ level: 'error', message: `Unknown theme "${name}"`, path: 'theme.name', hint }]);
  }
  const dir = path.join(themesDir, name);
  const invalid = (error) => new BuildError([{ level: 'error', message: `Theme "${name}" has an invalid theme.json: ${error}`, file: path.join(dir, 'theme.json') }]);
  const { manifest, error } = readManifest(dir);
  if (!manifest) throw invalid(error);
  const options = isObject(manifest.options) ? manifest.options : {};
  const choices = {};
  for (const [key, list] of Object.entries(isObject(manifest.choices) ? manifest.choices : {})) {
    if (Array.isArray(list)) choices[key] = list;
  }
  const types = {};
  for (const [key, type] of Object.entries(isObject(manifest.types) ? manifest.types : {})) {
    if (!Object.hasOwn(TYPES, type)) throw invalid(`unknown type ${JSON.stringify(type)} for option "${key}" (supported: ${Object.keys(TYPES).join(', ')})`);
    if (Object.hasOwn(options, key) && !TYPES[type].check(options[key])) {
      throw invalid(`the default for option "${key}" must be a ${type}, got ${JSON.stringify(options[key])}`);
    }
    types[key] = type;
  }
  return {
    name,
    description: manifest.description ?? '',
    version: manifest.version ?? '0.0.0',
    dir,
    options,
    choices,
    types,
  };
}

// Checks the profile's theme.options against the theme: unknown options warn (like unknown
// keys elsewhere); an option the theme lists in "choices" must be one of those values, and
// one it gives a type in "types" must be a value of that type.
export function checkThemeOptions(theme, options, file) {
  const issues = [];
  const add = (level, key, message, hint) => {
    const issue = { level, message, path: `theme.options.${key}` };
    if (file) issue.file = file;
    if (hint) issue.hint = hint;
    issues.push(issue);
  };
  const known = Object.keys(theme.options);
  for (const [key, value] of Object.entries(options ?? {})) {
    if (!Object.hasOwn(theme.options, key)) {
      const s = suggest(key, known);
      const list = known.length ? `Options for theme "${theme.name}": ${known.join(', ')}` : `Theme "${theme.name}" has no options`;
      add('warning', key, `Unknown option "${key}" is ignored`, s ? `Did you mean "${s}"?` : list);
      continue;
    }
    const allowed = Object.hasOwn(theme.choices, key) ? theme.choices[key] : null;
    if (allowed && !allowed.includes(value)) {
      const s = typeof value === 'string' ? suggest(value, allowed.filter((a) => typeof a === 'string')) : null;
      add('error', key, `"${key}" must be one of ${allowed.join(', ')}, got ${JSON.stringify(value)}`, s ? `Did you mean "${s}"?` : undefined);
    }
    const type = Object.hasOwn(theme.types, key) ? TYPES[theme.types[key]] : null;
    if (type && !type.check(value)) add('error', key, type.message(key, value), type.hint(key, theme.options[key]));
  }
  return issues;
}
