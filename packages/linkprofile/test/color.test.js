import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isColor, isDarkColor } from '../src/color.js';

test('isColor: #rgb or #rrggbb strings only', () => {
  for (const v of ['#000', '#3bd3a2', '#ABCDEF']) assert.equal(isColor(v), true, v);
  for (const v of ['#12345', '#3bd3a2;', 'teal', 'rgb(0,0,0)', '', 12, null, undefined]) assert.equal(isColor(v), false, String(v));
});

test('isDarkColor: true when white contrasts more than black (WCAG luminance)', () => {
  for (const v of ['#000', '#000000', '#7c3aed', '#2563eb', '#1e3a8a', '#B91C1C']) assert.equal(isDarkColor(v), true, v);
  for (const v of ['#fff', '#34d399', '#ff6b6b', '#ef4444', '#fde16d', '#3bd3a2']) assert.equal(isDarkColor(v), false, v);
});
