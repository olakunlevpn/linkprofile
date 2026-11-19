import { readdir, readFile, stat } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';

const CSS_URL = /url\(\s*(["']?)([^)"']*)\1\s*\)/gi;
const CSS_IMPORT = /@import\s+(?:url\(\s*)?(["'])([^"']*)\1/gi;
const NOT_FILE = /^(?:mailto:|tel:|data:|javascript:)/i;
const EXTERNAL = /^(?:https?:)?\/\//i;

async function siteFiles(dir, root = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(root, full).split(sep).join('/');
    if (entry.isDirectory()) {
      if (rel === 'demos') continue; // linkprofile tests its own themes
      out.push(...(await siteFiles(full, root)));
    } else if (/\.(?:html|css)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const decode = (s) => s.replace(/&amp;/g, '&');

// The one page allowed a script: the homepage loads its own bundled animation script
// (a relative <script src>, no inline code). Every other page ships no JavaScript.
const SCRIPT_PAGE = 'index.html';
const SCRIPT_SRC = 'assets/js/home.js';

// For spotting javascript: URLs: decode character references, then drop whitespace and
// control characters (browsers ignore them inside a URL scheme).
const NAMED = { colon: ':', tab: '\t', newline: '\n', amp: '&', lpar: '(', rpar: ')', sol: '/' };
const scriptUrl = (value) => /^javascript:/i.test(value
  .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m)
  .replace(/[\u0000-\u0020\u007f]/g, ''));

// Minimal HTML tokenizer: elements with their attributes, plus the raw text of <style> blocks
// (and of <script> blocks, as the element's `text`).
// Skips comments, treats <script>/<style> bodies as raw text, and honours '>' inside quoted values.
function parseHtml(html) {
  const elements = [];
  const styles = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    if (html.startsWith('<!--', lt)) {
      // As in browsers, "<!-->" and "<!--->" are complete (empty) comments.
      if (html.startsWith('<!-->', lt)) { i = lt + 5; continue; }
      if (html.startsWith('<!--->', lt)) { i = lt + 6; continue; }
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    const nameMatch = /^<([a-zA-Z][^\s/>]*)/.exec(html.slice(lt, lt + 64));
    if (!nameMatch) { i = lt + 1; continue; }
    const tag = nameMatch[1].toLowerCase();
    const attrs = new Map();
    let j = lt + nameMatch[0].length;
    while (j < html.length && html[j] !== '>') {
      if (/[\s/]/.test(html[j])) { j++; continue; }
      const start = j;
      while (j < html.length && !/[\s=/>]/.test(html[j])) j++;
      const name = html.slice(start, j).toLowerCase();
      while (j < html.length && /\s/.test(html[j])) j++;
      let value = '';
      if (html[j] === '=') {
        j++;
        while (j < html.length && /\s/.test(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") {
          const end = html.indexOf(q, j + 1);
          value = html.slice(j + 1, end === -1 ? html.length : end);
          j = end === -1 ? html.length : end + 1;
        } else {
          const vs = j;
          while (j < html.length && !/[\s>]/.test(html[j])) j++;
          value = html.slice(vs, j);
        }
      }
      if (name && !attrs.has(name)) attrs.set(name, decode(value));
    }
    i = j + 1;
    elements.push({ tag, attrs });
    if (tag === 'script' || tag === 'style') {
      const close = new RegExp(`</${tag}`, 'i').exec(html.slice(i));
      const end = close ? i + close.index : html.length;
      if (tag === 'style') styles.push(html.slice(i, end));
      else elements[elements.length - 1].text = html.slice(i, end);
      i = end;
    }
  }
  return { elements, styles };
}

async function exists(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

// Returns [{ file, message }] for every problem found in the built pages (demos excluded).
// 404.html is served from any depth, so it is checked for absolute links under siteBase instead of relative ones.
export async function checkSite(distDir, { siteBase } = {}) {
  const problems = [];
  const files = await siteFiles(distDir);
  const resolveLocal = async (file, path) => {
    let decoded = path;
    try { decoded = decodeURI(path); } catch { /* keep raw */ }
    let resolved = posix.normalize(posix.join(posix.dirname(file), decoded));
    if (resolved === '..' || resolved.startsWith('../')) return { error: 'escapes the site folder' };
    if (resolved === '.' || resolved.endsWith('/')) resolved = posix.join(resolved, 'index.html');
    if (await exists(join(distDir, resolved))) return { target: resolved };
    const asDir = posix.join(resolved, 'index.html');
    if (await exists(join(distDir, asDir))) return { target: asDir };
    return { error: `no ${resolved}` };
  };
  const idCache = new Map();
  const idsOf = async (rel) => {
    if (!idCache.has(rel)) {
      const { elements } = parseHtml(await readFile(join(distDir, rel), 'utf8'));
      idCache.set(rel, new Set(elements.filter((e) => e.attrs.has('id')).map((e) => e.attrs.get('id'))));
    }
    return idCache.get(rel);
  };

  for (const file of files) {
    const html = await readFile(join(distDir, file), 'utf8');
    const report = (message) => problems.push({ file, message });
    const is404 = file === '404.html';

    const isCss = file.endsWith('.css');
    const parsed = isCss ? null : parseHtml(html);
    const scripts = parsed ? parsed.elements.filter((e) => e.tag === 'script') : [];
    if (scripts.length && file !== SCRIPT_PAGE) report('contains a <script> tag');
    else if (scripts.length > 1) report('has more than one <script> (only the bundled assets/js script is allowed)');
    else if (scripts.length && (!scripts[0].attrs.get('src')?.trim() || scripts[0].text.trim())) {
      report('has an inline <script> (only a <script src> pointing at a local file is allowed)');
    } else if (scripts.length && /^[a-z][a-z0-9+.-]*:/i.test(scripts[0].attrs.get('src').trim())) {
      report(`<script src="${scripts[0].attrs.get('src')}"> is not a local file`);
    } else if (scripts.length && scripts[0].attrs.get('src').trim() !== SCRIPT_SRC) {
      report(`<script src="${scripts[0].attrs.get('src')}"> must be <script src="${SCRIPT_SRC}">`);
    } else if (scripts.length && !['', 'text/javascript'].includes((scripts[0].attrs.get('type') ?? '').trim().toLowerCase())) {
      report(`<script type="${scripts[0].attrs.get('type')}"> is not allowed (a classic script only)`);
    }
    for (const { tag, attrs } of parsed?.elements ?? []) {
      for (const [attr, value] of attrs) {
        if (attr.startsWith('on')) report(`event handler attribute <${tag} ${attr}>`);
        else if (attr === 'srcdoc') report(`srcdoc attribute on <${tag}>`);
        else if (scriptUrl(value)) report(`javascript: URL in <${tag} ${attr}>`);
      }
    }
    const cssTexts = isCss ? [html] : [
      ...parsed.styles,
      ...parsed.elements.filter((e) => e.attrs.has('style')).map((e) => e.attrs.get('style')),
    ];
    for (const css of cssTexts) {
      for (const m of css.matchAll(CSS_IMPORT)) {
        if (EXTERNAL.test(m[2].trim())) report(`external CSS @import ${m[2]}`);
      }
      for (const m of css.matchAll(CSS_URL)) {
        const url = decode(m[2]).trim();
        if (url === '' || url.startsWith('#') || /^(?:data|blob):/i.test(url)) continue;
        if (EXTERNAL.test(url)) { report(`external CSS url(${url})`); continue; }
        if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('/')) continue; // 404 fonts are SITE_BASE-absolute
        const r = await resolveLocal(file, url.split(/[?#]/)[0]);
        if (r.error) report(`broken CSS url(${url}) (${r.error})`);
      }
    }
    if (isCss) continue;

    for (const { tag: name, attrs } of parsed.elements) {
      for (const attr of ['href', 'src', 'poster', 'data', 'srcset']) {
        if (!attrs.has(attr)) continue;
        const raw = attrs.get(attr).trim();
        if (attr === 'srcset') {
          for (const candidate of raw.split(/,\s+/)) {
            const u = candidate.trim().split(/\s+/)[0];
            if (!u || /^data:/i.test(u)) continue;
            if (EXTERNAL.test(u)) report(`external resource <${name} srcset="${u}">`);
            else if (!is404 && !/^[a-z][a-z0-9+.-]*:/i.test(u) && !u.startsWith('/')) {
              const r = await resolveLocal(file, u.split(/[?#]/)[0]);
              if (r.error) report(`broken srcset URL "${u}" (${r.error})`);
            }
          }
          continue;
        }
        const url = raw;
        const isResource = name !== 'a' && name !== 'area';
        if (isResource && EXTERNAL.test(url)) { report(`external resource <${name} ${attr}="${url}">`); continue; }
        if (NOT_FILE.test(url) || /^[a-z][a-z0-9+.-]*:/i.test(url)) continue; // mailto:, tel:, https:// links
        if (is404) {
          if (siteBase && url !== '' && !url.startsWith('#') && !url.startsWith(siteBase)) {
            report(`link "${url}" does not start with ${siteBase}`);
          }
          continue;
        }
        if (url.startsWith('//') || url.startsWith('/')) { report(`absolute URL "${url}" (use a relative URL)`); continue; }

        const hashAt = url.indexOf('#');
        const hash = hashAt === -1 ? '' : url.slice(hashAt + 1);
        const path = (hashAt === -1 ? url : url.slice(0, hashAt)).split('?')[0];
        let target = file;
        if (path) {
          const r = await resolveLocal(file, path);
          if (r.error === 'escapes the site folder') { report(`"${url}" escapes the site folder`); continue; }
          if (r.error) { report(`broken link "${url}" (${r.error})`); continue; }
          target = r.target;
        }
        if (hash && attr === 'href' && target.endsWith('.html')) {
          let id = hash;
          try { id = decodeURIComponent(hash); } catch { /* keep raw */ }
          if (!(await idsOf(target)).has(id)) report(`missing anchor "${url}" (no id="${id}" in ${target})`);
        }
      }
    }
  }
  return problems;
}
