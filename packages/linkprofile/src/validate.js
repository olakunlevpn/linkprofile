import fs from 'node:fs';
import path from 'node:path';
import { suggest } from './suggest.js';
import { getSocialIcon, hasSocialIcon, hasLinkIcon, socialIconNames, linkIconNames } from './icons.js';
import { isColor, colorMessage, colorHint } from './color.js';

const TOP_KEYS = ['theme', 'url', 'name', 'avatar', 'bio', 'socials', 'links_title', 'links', 'meta'];
const URL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const isRemote = (v) => /^https?:\/\//i.test(v);
const QUOTE_HINT = 'If it is meant to be text, put it in quotes.';
// Hjson reads 2024 as a number; free-text fields accept finite numbers as text.
const freeText = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : v);
const COMMENT_HINT = 'In Hjson, a comment after an unquoted value becomes part of it. Put the comment on its own line, or quote the value.';
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';

function parseUrl(value, protocols) {
  try {
    const u = new URL(value);
    return protocols.includes(u.protocol) ? u : null;
  } catch {
    return null;
  }
}

// Site URL without trailing slashes, or null when it is not a valid http(s) URL.
export function normaliseSiteUrl(value) {
  const v = String(value).trim();
  return parseUrl(v, ['http:', 'https:']) ? v.replace(/\/+$/, '') : null;
}

export function validateProfile(raw, ctx) {
  const { baseDir, file } = ctx;
  const issues = [];
  const localFiles = new Set();
  const add = (level, where, message, hint) => {
    const issue = { level, message, path: where };
    if (file) issue.file = file;
    if (hint) issue.hint = hint;
    issues.push(issue);
  };
  const error = (where, message, hint) => add('error', where, message, hint);

  const required = (obj, key, where) => {
    if (obj[key] === undefined || obj[key] === null || obj[key] === '') {
      error(where, `"${key}" is required`);
      return false;
    }
    return true;
  };

  // Returns the string value, or undefined after reporting a type error.
  const optString = (obj, key, where) => {
    if (obj[key] === undefined || obj[key] === null) return undefined;
    const v = freeText(obj[key]);
    if (typeof v !== 'string') {
      error(where, `"${key}" must be a string`, QUOTE_HINT);
      return undefined;
    }
    return v;
  };

  const warnUnknown = (obj, known, where) => {
    for (const key of Object.keys(obj)) {
      if (known.includes(key)) continue;
      const s = suggest(key, known);
      add('warning', `${where}.${key}`, `Unknown key "${key}" is ignored`, s ? `Did you mean "${s}"?` : `Known keys: ${known.join(', ')}`);
    }
  };

  const checkUrl = (value, key, where, protocols = URL_PROTOCOLS) => {
    if (typeof value !== 'string') {
      error(where, `"${key}" must be a string`, QUOTE_HINT);
      return null;
    }
    value = value.trim();
    if (!parseUrl(value, protocols)) {
      const allowed = protocols.length === 2 ? 'http(s)' : 'http(s), mailto: and tel:';
      error(where, `"${key}" is not a valid URL: ${value}`, `Use an absolute URL starting with ${allowed}.`);
      return null;
    }
    return value;
  };

  // Remote URL kept as-is; local path normalised, checked and recorded.
  const checkAsset = (value, key, where) => {
    if (typeof value !== 'string') {
      error(where, `"${key}" must be a string`, QUOTE_HINT);
      return null;
    }
    value = value.trim();
    if (isRemote(value)) return value;
    let rel = value;
    while (rel.startsWith('./') || rel.startsWith('/')) rel = rel.replace(/^\.?\//, '');
    const outside = () => error(where, `"${key}" points outside the project: ${value}`, 'Keep images inside the folder that holds profile.hjson.');
    const contained = (target) => {
      const r = path.relative(fs.realpathSync(baseDir), target);
      return r !== '' && r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r);
    };
    const abs = path.resolve(baseDir, rel);
    const inside = path.relative(baseDir, abs);
    if (inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside)) return outside(), null;
    const normalised = inside.split(path.sep).join('/');
    if (inside === '') {
      error(where, `"${key}" must be a file path, not empty or the project folder`, 'Point it at an image file, e.g. images/avatar.png.');
      return null;
    }
    let stat = null;
    try { stat = fs.statSync(abs); } catch { /* missing */ }
    if (!stat) {
      error(where, `"${key}" file not found: looked for ${normalised}`,
        /\s#/.test(normalised) ? COMMENT_HINT : 'Paths are relative to the folder that holds profile.hjson.');
      return null;
    }
    if (!stat.isFile()) {
      error(where, `"${key}" must be a file, but ${normalised} is a folder`, 'Point it at an image file.');
      return null;
    }
    if (!contained(fs.realpathSync(abs))) return outside(), null;
    localFiles.add(normalised);
    return normalised;
  };

  if (!isObject(raw)) {
    error(undefined, 'The profile must be an object of key: value pairs');
    return { profile: null, issues };
  }

  for (const key of Object.keys(raw)) {
    if (TOP_KEYS.includes(key)) continue;
    const s = suggest(key, TOP_KEYS);
    add('warning', key, `Unknown key "${key}" is ignored`, s ? `Did you mean "${s}"?` : `Known keys: ${TOP_KEYS.join(', ')}`);
  }

  // theme
  let theme = { name: 'classic', options: {} };
  if (raw.theme !== undefined && raw.theme !== null) {
    if (typeof raw.theme === 'string' && raw.theme.trim()) {
      theme = { name: raw.theme, options: {} };
    } else if (isObject(raw.theme) && nonEmpty(raw.theme.name)) {
      warnUnknown(raw.theme, ['name', 'options'], 'theme');
      if (raw.theme.options !== undefined && !isObject(raw.theme.options)) {
        error('theme', '"options" must be an object');
      } else {
        theme = { name: raw.theme.name, options: raw.theme.options ?? {} };
      }
    } else {
      error('theme', '"theme" must be a theme name or { name, options }');
    }
  }

  // url
  let siteUrl = null;
  if (raw.url !== undefined && raw.url !== null) {
    const v = checkUrl(raw.url, 'url', 'url', ['http:', 'https:']);
    if (v) siteUrl = normaliseSiteUrl(v);
  }

  // name
  let name = '';
  if (raw.name === undefined || raw.name === null || raw.name === '') error('name', '"name" is required');
  else if (typeof freeText(raw.name) !== 'string') error('name', '"name" must be a string', QUOTE_HINT);
  else if (!String(freeText(raw.name)).trim()) error('name', '"name" must not be empty');
  else name = freeText(raw.name);

  // avatar
  let avatar = null;
  if (raw.avatar !== undefined && raw.avatar !== null) {
    avatar = checkAsset(raw.avatar, 'avatar', 'avatar');
    if (avatar && /\.svg(\?.*)?$/i.test(avatar)) {
      add('warning', 'avatar', "Many sites don't show SVG images in link previews. Use a PNG or JPG for your avatar.");
    }
  }

  const bio = optString(raw, 'bio', 'bio') ?? null;
  const linksTitle = optString(raw, 'links_title', 'links_title') ?? null;

  // socials
  const socials = [];
  if (raw.socials !== undefined && raw.socials !== null) {
    if (!Array.isArray(raw.socials)) error('socials', '"socials" must be a list');
    else raw.socials.forEach((s, i) => {
      const p = `socials[${i}]`;
      if (!isObject(s)) return error(p, 'Each social must be an object with "type" and "url"');
      warnUnknown(s, ['type', 'url', 'label'], p);
      const hasType = required(s, 'type', p);
      const hasUrl = required(s, 'url', p);
      let type = null;
      if (hasType) {
        if (typeof s.type !== 'string') error(p, '"type" must be a string');
        else if (!hasSocialIcon(s.type)) {
          const sg = suggest(s.type, socialIconNames());
          error(p, `Unknown social type "${s.type}"`, sg ? `Did you mean "${sg}"?` : `Known types: ${socialIconNames().join(', ')}`);
        } else type = s.type.toLowerCase();
      }
      const url = hasUrl ? checkUrl(s.url, 'url', p) : null;
      const label = optString(s, 'label', p);
      if (type && url) socials.push({ type, url, label: label || getSocialIcon(type).title });
    });
  }

  // links
  const links = [];
  if (raw.links !== undefined && raw.links !== null) {
    if (!Array.isArray(raw.links)) error('links', '"links" must be a list');
    else raw.links.forEach((link, i) => {
      let p = `links[${i}]`;
      if (!isObject(link)) return error(p, 'Each link must be an object with "title" and "url"');
      warnUnknown(link, ['title', 'url', 'icon', 'image', 'color', 'colour'], p);
      const l = { ...link, title: freeText(link.title), color: link.color ?? link.colour };
      if (nonEmpty(l.title)) p += ` ("${l.title}")`;
      const hasTitle = required(l, 'title', p);
      const hasUrl = required(l, 'url', p);
      let ok = hasTitle && hasUrl;
      if (hasTitle && typeof l.title !== 'string') { error(p, '"title" must be a string', QUOTE_HINT); ok = false; }
      else if (hasTitle && !l.title.trim()) { error(p, '"title" must not be empty'); ok = false; }
      const url = hasUrl ? checkUrl(l.url, 'url', p) : null;
      if (hasUrl && !url) ok = false;

      let icon = null;
      let image = null;
      let color = null;
      const hasIcon = l.icon !== undefined && l.icon !== null;
      const hasImage = l.image !== undefined && l.image !== null;
      if (hasIcon && hasImage) {
        error(p, 'Use either "icon" or "image", not both', 'Remove one of them.');
        ok = false;
      } else {
        if (hasIcon) {
          if (typeof l.icon !== 'string') { error(p, '"icon" must be a string'); ok = false; }
          else if (!hasLinkIcon(l.icon)) {
            const sg = suggest(l.icon, linkIconNames());
            error(p, `Unknown icon "${l.icon}"`, sg ? `Did you mean "${sg}"?` : `Known icons: ${linkIconNames().join(', ')}`);
            ok = false;
          } else icon = l.icon;
        }
        if (hasImage) {
          image = checkAsset(l.image, 'image', p);
          if (image === null) ok = false;
        }
      }
      if (l.color !== undefined && l.color !== null) {
        if (!isColor(l.color)) {
          error(p, colorMessage('color', l.color), colorHint('color', '#34d399'));
          ok = false;
        } else color = l.color;
      }
      if (ok) links.push({ title: l.title, url, icon, image, color, external: /^https?:$/.test(new URL(url).protocol) });
    });
  }

  // meta
  let meta = {};
  if (raw.meta !== undefined && raw.meta !== null) {
    if (!isObject(raw.meta)) error('meta', '"meta" must be an object');
    else { meta = raw.meta; warnUnknown(meta, ['title', 'description', 'favicon'], 'meta'); }
  }
  const metaTitle = optString(meta, 'title', 'meta');
  const metaDescription = optString(meta, 'description', 'meta');
  let favicon = null;
  if (meta.favicon !== undefined && meta.favicon !== null) favicon = checkAsset(meta.favicon, 'favicon', 'meta');

  // A "# note" after an unquoted value silently becomes part of the value.
  // Free text may hold hashtags ("#travel"), so only "<space>#<space>" counts there.
  const FREE_TEXT = /^(name|bio|links_title|links\[\d+\]\.title|socials\[\d+\]\.label|meta\.(title|description))$/;
  const scan = (value, where) => {
    if (typeof value === 'string') {
      if ((FREE_TEXT.test(where) ? /\s#\s/ : /\s#/).test(value)) add('warning', where, 'This value contains " #" — it looks like a comment ended up inside the value.', COMMENT_HINT);
    } else if (Array.isArray(value)) value.forEach((v, i) => scan(v, `${where}[${i}]`));
    else if (isObject(value)) for (const [k, v] of Object.entries(value)) scan(v, where ? `${where}.${k}` : k);
  };
  scan(raw, '');

  if (issues.some((i) => i.level === 'error')) return { profile: null, issues };

  return {
    profile: {
      theme,
      url: siteUrl,
      name,
      avatar,
      bio,
      socials,
      links_title: linksTitle,
      links,
      meta: {
        title: nonEmpty(metaTitle) ? metaTitle : name,
        description: [metaDescription, bio].find(nonEmpty) ?? `Links from ${name}`,
        favicon,
      },
      localFiles: [...localFiles],
    },
    issues,
  };
}
