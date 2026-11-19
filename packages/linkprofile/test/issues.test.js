import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatIssues, BuildError } from '../src/issues.js';

test('formats file:line:column, source line, caret and hint', () => {
  const out = formatIssues([{ level: 'error', message: 'Bad thing', file: 'profile.hjson', line: 5, column: 3, sourceLine: '  oops', hint: 'Do X' }], { color: false });
  assert.match(out, /profile\.hjson:5:3/);
  assert.match(out, /  oops\n\s+\^/);
  assert.match(out, /Hint: Do X/);
});
test('formats path-based issues', () => {
  const out = formatIssues([{ level: 'error', path: 'links[2] ("Newsletter")', message: '"url" is required' }], { color: false });
  assert.match(out, /links\[2\] \("Newsletter"\): "url" is required/);
});
test('errors before warnings, with a count line', () => {
  const out = formatIssues([{ level: 'warning', message: 'w' }, { level: 'error', message: 'e' }], { color: false });
  assert.ok(out.indexOf('e') < out.indexOf('w'));
  assert.match(out, /1 error, 1 warning/);
});
test('BuildError carries issues', () => {
  const e = new BuildError([{ level: 'error', message: 'm' }]);
  assert.equal(e.issues.length, 1);
  assert.equal(e.message, 'm');
});
test('color option wraps level in ANSI codes', () => {
  const out = formatIssues([{ level: 'error', message: 'e' }, { level: 'warning', message: 'w' }], { color: true });
  assert.match(out, /\x1b\[31m/);
  assert.match(out, /\x1b\[33m/);
});
