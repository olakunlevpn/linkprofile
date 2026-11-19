import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest } from '../src/suggest.js';

test('suggests close match', () => assert.equal(suggest('lnks', ['links', 'name', 'bio']), 'links'));
test('case-insensitive', () => assert.equal(suggest('GitHub', ['github', 'gitlab']), 'github'));
test('null when nothing within distance 2', () => assert.equal(suggest('zzzzzz', ['links']), null));
