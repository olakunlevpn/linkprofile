import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativeHref } from '../lib/paths.mjs';

test('relativeHref from nested page', () => assert.equal(relativeHref('docs/getting-started/index.html', 'assets/site.css'), '../../assets/site.css'));
test('relativeHref from root', () => assert.equal(relativeHref('index.html', 'docs/'), 'docs/'));
test('relativeHref keeps #hash', () => assert.equal(relativeHref('docs/a/index.html', 'docs/b/#x'), '../b/#x'));
