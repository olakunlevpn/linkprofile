// Colours as profiles and theme options accept them: hex, #rgb or #rrggbb.
const COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const isColor = (v) => typeof v === 'string' && COLOR.test(v);

export const colorMessage = (key, value) => `"${key}" must be a hex colour like #rgb or #rrggbb, got ${JSON.stringify(value)}`;

// Most bad colours are unquoted ones: Hjson reads the # as the start of a comment.
export const colorHint = (key, example) =>
  `Colours must be quoted, e.g. ${key}: "${example}". Unquoted, Hjson treats # as a comment and reads the next line as the value.`;

// WCAG relative luminance of a valid hex colour.
function luminance(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// True when white has more contrast against the colour than black does,
// so text or glyphs drawn on it should be light.
export function isDarkColor(hex) {
  const l = luminance(hex);
  return 1.05 / (l + 0.05) > (l + 0.05) / 0.05;
}
