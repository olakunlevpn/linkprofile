import { Marked } from 'marked';
import { escapeHtml, highlightHjson } from './hjson-highlight.mjs';

const PRE_CLASS = 'overflow-x-auto';
const NOTE_ICON =
  '<svg class="mt-0.5 size-5 shrink-0 text-mint-deep" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/></svg>';
const MD_LINK = /^([A-Za-z0-9_-]+)\.md(?:#(.*))?$/;
// Comments with a meaning: swallowed (they only mark the next block for tests), or kept for docs.mjs to expand.
const SWALLOWED = new Set(['<!-- invalid-example -->']);
export const DEMOS_MARKER = '<!-- demos -->';

function parseFrontMatter(source, file) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  const data = {};
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
      if (kv) data[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, '$2');
    }
  }
  if (!data.title) throw new Error(`${file}: front matter is missing a title`);
  return { title: data.title, description: data.description ?? '', body: m ? source.slice(m[0].length) : source };
}

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[e.toLowerCase()] ?? whole;
  });
}

function plainText(tokens = []) {
  return decodeEntities(tokens.map((t) => (t.tokens ? plainText(t.tokens) : (t.text ?? ''))).join(''));
}

const SAFE_SCHEME = /^(https?|mailto|tel):/i;

// Before the first / ? # the browser may decode entities, so '&' and whitespace are never allowed there.
function isSafeHref(href) {
  const prefix = href.split(/[/?#]/, 1)[0];
  if (/[&\u0000-\u0020\u007f]/.test(prefix)) return false;
  return !prefix.includes(':') || SAFE_SCHEME.test(prefix);
}

export function slugify(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
}

export function renderMarkdown(source, { file, resolveLink }) {
  const { title, description, body } = parseFrontMatter(source, file);
  const toc = [];
  const ids = [];
  const links = [];
  const used = new Map();

  const uniqueId = (text) => {
    const base = slugify(text) || 'section';
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };

  const marked = new Marked({ gfm: true });
  const tokens = marked.lexer(body);

  // Pre-pass: markers and link resolution.
  const MARKERS = { '<!-- steps -->': 'steps', '<!-- cards -->': 'cards' };
  let pending = null;
  for (const t of tokens) {
    if (t.type === 'html' && MARKERS[t.text.trim()]) {
      pending = MARKERS[t.text.trim()];
      t.marker = true;
    } else if (t.type === 'list' && pending) {
      t.variant = pending;
      pending = null;
    } else if (t.type !== 'space') {
      pending = null;
    }
  }
  marked.walkTokens(tokens, (t) => {
    if (t.type !== 'link' && t.type !== 'image') return;
    if (!isSafeHref(t.href)) throw new Error(`${file}: link "${t.href}" uses a disallowed URL scheme`);
    if (t.type !== 'link') return;
    const m = MD_LINK.exec(t.href);
    if (!m) return;
    const resolved = resolveLink(m[1], m[2] ?? '');
    if (resolved == null) throw new Error(`${file}: link to "${t.href}" does not match any docs page`);
    links.push(t.href);
    t.href = resolved;
  });

  const heading = (level, text, inner) => {
    const id = uniqueId(text);
    ids.push(id);
    if (level === 2 || level === 3) toc.push({ id, text, level });
    return { id, html: `<h${level} id="${id}">${inner}</h${level}>\n` };
  };

  const stepsList = (parser, token) => {
    const items = token.items.map((item) => {
      const [first, ...rest] = item.tokens;
      const inline = first?.tokens ?? [];
      const strong = inline[0]?.type === 'strong' ? inline[0] : null;
      if (!strong) throw new Error(`${file}: each step must start with a **bold** title`);
      const h = heading(3, plainText(strong.tokens), parser.parseInline(strong.tokens));
      const after = inline.slice(1);
      if (after[0]?.type === 'text') after[0] = { ...after[0], text: after[0].text.replace(/^\s+/, ''), raw: after[0].raw.replace(/^\s+/, '') };
      const lead = after.length && plainText(after).trim() ? `<p>${parser.parseInline(after)}</p>\n` : '';
      return `<li>\n${h.html}${lead}${parser.parse(rest)}</li>\n`;
    });
    return `<ol class="steps mt-4">\n${items.join('')}</ol>\n`;
  };

  const cardsList = (parser, token) => {
    const cards = token.items.map((item) => {
      const inline = item.tokens[0]?.tokens ?? [];
      const link = inline[0];
      if (link?.type !== 'link') throw new Error(`${file}: each card must start with a [Title](link)`);
      const desc = inline.slice(1);
      if (desc[0]?.type === 'text') desc[0] = { ...desc[0], text: desc[0].text.replace(/^\s*[—–-]\s*/, '') };
      return `<a href="${escapeHtml(link.href)}" class="!no-underline group block rounded-xl border border-line bg-white p-5 hover:border-ink">
<span class="block text-[17px] font-semibold !text-ink">${parser.parseInline(link.tokens)}</span>
<span class="mt-1 block text-[15px] font-normal !text-muted">${parser.parseInline(desc)}</span>
</a>\n`;
    });
    return `<div class="mt-6 grid gap-4 sm:grid-cols-2">\n${cards.join('')}</div>\n`;
  };

  marked.use({
    renderer: {
      html({ text }) {
        if (MARKERS[text.trim()] || SWALLOWED.has(text.trim())) return '';
        if (text.trim() === DEMOS_MARKER) return `${DEMOS_MARKER}\n`;
        if (text === '<kbd>' || text === '</kbd>') return text;
        return escapeHtml(text);
      },
      heading({ tokens: inner, depth }) {
        return heading(depth, plainText(inner), this.parser.parseInline(inner)).html;
      },
      code({ text, lang }) {
        const isHjson = (lang ?? '').split(/\s/)[0] === 'hjson';
        return `<pre class="${PRE_CLASS}"><code>${isHjson ? highlightHjson(text) : escapeHtml(text)}</code></pre>\n`;
      },
      list(token) {
        if (token.variant === 'steps') return stepsList(this.parser, token);
        if (token.variant === 'cards') return cardsList(this.parser, token);
        const tag = token.ordered ? 'ol' : 'ul';
        const cls = token.ordered ? 'mt-4 list-decimal space-y-1 pl-5' : 'mt-4 list-disc space-y-1 pl-5';
        const start = token.ordered && token.start !== 1 ? ` start="${token.start}"` : '';
        const items = token.items.map((i) => this.listitem(i)).join('');
        return `<${tag} class="${cls}"${start}>\n${items}</${tag}>\n`;
      },
      blockquote({ tokens: inner }) {
        const first = inner[0];
        const m = first?.type === 'paragraph' && /^\[!(NOTE|TIP)\]\s*/.exec(first.text);
        if (!m) return `<blockquote class="mt-4 border-l-2 border-line pl-4">\n${this.parser.parse(inner)}</blockquote>\n`;
        const kind = m[1];
        const lead = first.tokens.slice();
        lead[0] = { ...lead[0], text: lead[0].text.replace(/^\[!(NOTE|TIP)\]\s*/, '') };
        if (!lead[0].text) lead.shift();
        const rest = inner.slice(1);
        const bodyHtml = this.parser.parse(rest);
        if (kind === 'NOTE') {
          const p = lead.length ? `<p class="!mt-0 !text-[15.5px]">${this.parser.parseInline(lead)}</p>\n` : '';
          return `<div class="mt-8 flex gap-4 rounded-xl border border-line bg-white p-5">\n${NOTE_ICON}\n<div class="min-w-0">\n${p}${bodyHtml}</div>\n</div>\n`;
        }
        const titled = lead.length === 1 && lead[0].type === 'strong';
        const p = lead.length ? `<p class="!mt-0${titled ? ' font-semibold !text-ink' : ''}">${this.parser.parseInline(lead)}</p>\n` : '';
        return `<div class="mt-5 rounded-xl bg-mint-soft p-5">\n${p}${bodyHtml}</div>\n`;
      },
    },
  });

  const html = marked.parser(tokens);
  return { title, description, html, toc, ids, links };
}
