export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const KEY = /^(\s*)("[^"]*"|[A-Za-z_][\w.-]*)(\s*:)(?=\s|$)/;

export function highlightHjson(code) {
  return code
    .split('\n')
    .map((line) => {
      if (/^\s*#/.test(line)) return `<span class="text-white/40">${escapeHtml(line)}</span>`;
      const m = KEY.exec(line);
      if (!m) return escapeHtml(line);
      const [whole, indent, key, colon] = m;
      return `${indent}<span class="text-mint">${escapeHtml(key)}</span>${colon}${escapeHtml(line.slice(whole.length))}`;
    })
    .join('\n');
}
