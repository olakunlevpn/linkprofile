import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProfile } from '../src/parse.js';
import { BuildError } from '../src/issues.js';

function catchErr(src, file = 'p.hjson') {
  try {
    parseProfile(src, file);
  } catch (e) {
    return e;
  }
  return undefined;
}

test('parses multi-line objects and comments', () => {
  assert.deepEqual(parseProfile('{\n # c\n name: vyshnav\n}', 'p.hjson'), { name: 'vyshnav' });
});

test('one-line unquoted object gives line/column and the one-line hint', () => {
  const err = catchErr('{\n links: [\n  { title: A, url: https://a.com }\n ]\n}');
  assert.ok(err instanceof BuildError);
  const issue = err.issues[0];
  assert.equal(issue.level, 'error');
  assert.equal(issue.line, 4);
  assert.equal(issue.file, 'p.hjson');
  assert.equal(issue.sourceLine, ' ]');
  assert.match(issue.hint, /each field on its own line|quote/i);
});

test('unquoted # colour gives the colour hint', () => {
  const err = catchErr('{\n color: #34d399\n}');
  assert.ok(err instanceof BuildError);
  assert.match(err.issues[0].hint, /quote.*colou?r/i);
});

test('CRLF and BOM parse identically and keep line numbers', () => {
  const lf = '{\n name: a\n bio: b\n}';
  assert.deepEqual(parseProfile('﻿' + lf.replace(/\n/g, '\r\n'), 'p'), parseProfile(lf, 'p'));
  const bad = '{\r\n name: a\r\n ]\r\n}';
  const err = catchErr(bad);
  assert.ok(err instanceof BuildError);
  assert.equal(err.issues[0].line, 3);
  assert.equal(err.issues[0].sourceLine, ' ]');
});

test('empty file is a clear error', () => {
  for (const src of ['', '   ']) {
    const err = catchErr(src);
    assert.ok(err instanceof BuildError);
    assert.match(err.issues[0].message, /empty/i);
  }
});

test('top level must be an object', () => {
  const err = catchErr('[1,2]');
  assert.ok(err instanceof BuildError);
  assert.match(err.issues[0].message, /must be an object/i);
});

test('unquoted one-line object inside an object points at the culprit line', () => {
  const src = '{\n name: Ann\n meta: { title: Ann links, description: hi }\n bio: x\n links: [\n ]\n}';
  const issue = catchErr(src).issues[0];
  assert.equal(issue.line, 3);
  assert.equal(issue.sourceLine, ' meta: { title: Ann links, description: hi }');
  assert.match(issue.hint, /each field on its own line|quote/i);
  assert.match(issue.message, /line 3/);
});

test('unquoted theme long form gets the one-line hint', () => {
  const src = '{\n theme: { name: classic, options: { accent: "#fff" } }\n name: Ann\n}';
  const issue = catchErr(src).issues[0];
  assert.equal(issue.line, 2);
  assert.match(issue.sourceLine, /theme: \{ name: classic/);
  assert.match(issue.hint, /own line|quote/i);
});
