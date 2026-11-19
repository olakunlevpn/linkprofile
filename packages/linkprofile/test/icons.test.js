import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { getSocialIcon, hasSocialIcon, getLinkIcon, hasLinkIcon, getThemeIcon, socialIconNames, linkIconNames } from '../src/icons.js';
import { defaultThemesDir } from '../src/themes.js';

test('simple-icons brand', () => { const i = getSocialIcon('github'); assert.equal(i.title, 'GitHub'); assert.match(i.svg, /^<svg[^>]*viewBox="0 0 24 24"/); assert.match(i.svg, /fill="currentColor"/); assert.doesNotMatch(i.svg, /<title>/); });
test('twitter aliases to x', () => assert.equal(getSocialIcon('twitter').title, 'X'));
test('bundled linkedin', () => assert.equal(getSocialIcon('linkedin').title, 'LinkedIn'));
test('figma and dribbble use the bundled solid glyphs', () => {
  for (const [type, title] of [['figma', 'Figma'], ['dribbble', 'Dribbble']]) {
    const i = getSocialIcon(type);
    assert.equal(i.title, title);
    assert.match(i.svg, /^<svg[^>]*aria-hidden="true" focusable="false" fill="currentColor">/);
    assert.doesNotMatch(i.svg, /<title>|role=/);
  }
  assert.match(getSocialIcon('dribbble').svg, /fill-rule="evenodd"/);
});
test('email uses lucide mail', () => { const i = getSocialIcon('email'); assert.match(i.svg, /<svg/); assert.equal(i.title, 'Email'); });
test('website uses globe', () => assert.equal(getSocialIcon('website').title, 'Website'));
test('case-insensitive', () => assert.ok(hasSocialIcon('GitHub')));
test('unknown social is null', () => { assert.equal(getSocialIcon('notabrand'), null); assert.equal(hasSocialIcon('notabrand'), false); });
test('lucide link icon, license comment stripped', () => { const s = getLinkIcon('globe'); assert.match(s, /^<svg/); assert.doesNotMatch(s, /@license/); assert.match(s, /fill="none"/); assert.doesNotMatch(s, /\sclass=|\swidth=/); });
test('unknown link icon is null', () => { assert.equal(getLinkIcon('nope-icon'), null); assert.equal(hasLinkIcon('nope-icon'), false); });
test('path traversal is rejected', () => assert.equal(getLinkIcon('../package'), null));
test('svgs are marked decorative', () => { assert.match(getLinkIcon('mail'), /aria-hidden="true" focusable="false"/); assert.match(getSocialIcon('linkedin').svg, /aria-hidden="true"/); });
test('name lists are non-empty and include aliases', () => { assert.ok(socialIconNames().includes('twitter')); assert.ok(socialIconNames().includes('linkedin')); assert.ok(linkIconNames().includes('shopping-cart')); });
test('titles are decoded to plain text', () => {
  assert.equal(getSocialIcon('atandt').title, 'AT&T');
  assert.equal(getSocialIcon('aeromexico').title, 'Aeroméxico');
  assert.equal(getSocialIcon('handm').title, 'H&M');
});
test('prototype keys do not resolve', () => { assert.equal(getSocialIcon('constructor'), null); assert.equal(getSocialIcon('__proto__'), null); });
test('every listed name resolves', () => {
  for (const n of socialIconNames()) assert.ok(getSocialIcon(n), `social ${n}`);
  for (const n of linkIconNames()) assert.ok(getLinkIcon(n), `link ${n}`);
});

const classic = path.join(defaultThemesDir, 'classic');
test('theme icon: artwork from <theme>/icons, cleaned and decorative', () => {
  const s = getThemeIcon(classic, 'Globe');
  assert.match(s, /^<svg[^>]* aria-hidden="true" focusable="false"/);
  assert.match(s, /class="horizon"/);
});
test('theme icon: null without artwork, without a theme dir, or for unsafe names', () => {
  assert.equal(getThemeIcon(classic, 'rocket'), null);
  assert.equal(getThemeIcon(null, 'globe'), null);
  assert.equal(getThemeIcon(classic, '../theme'), null);
  assert.equal(getThemeIcon(classic, '__proto__'), null);
});
