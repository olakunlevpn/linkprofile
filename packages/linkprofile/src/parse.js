import Hjson from 'hjson';
import { BuildError } from './issues.js';

const COLOUR_HINT = 'Colours must be in quotes, e.g. color: "#34d399" — an unquoted # starts a comment.';
const ONE_LINE_HINT =
  'In Hjson an unquoted value runs to the end of the line. Put each field on its own line, or put the values in quotes.';

function hintFor(lines, lineNo) {
  const candidates = [lines[lineNo - 1]];
  for (let i = lineNo - 2; i >= 0; i--) {
    if (lines[i].trim() !== '') {
      candidates.push(lines[i]);
      break;
    }
  }
  for (const line of candidates) {
    if (line == null) continue;
    if (/:\s*#[0-9a-f]{3,8}\b/i.test(line)) return COLOUR_HINT;
  }
  for (const line of candidates) {
    if (line == null) continue;
    if (line.includes('{') && line.includes(',') && line.includes(':')) return ONE_LINE_HINT;
  }
  return undefined;
}

// An unquoted one-line object, e.g. `{ title: A, url: https://a.com }`, can make
// Hjson fail far from the real mistake. Find the first line that looks like one.
const ONE_LINE_OBJECT = /\{\s*[^{}"'\n]*:[^"'\n]*,\s*[\w-]+\s*:/;
function findOneLineObject(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(#|\/\/)/.test(lines[i])) continue;
    const m = ONE_LINE_OBJECT.exec(lines[i]);
    if (m) return { line: i + 1, column: m.index + 1 };
  }
  return null;
}

export function parseProfile(text, file) {
  const source = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (source.trim() === '') {
    throw new BuildError([{ level: 'error', file, message: 'The profile file is empty.' }]);
  }
  let data;
  try {
    data = Hjson.parse(source);
  } catch (err) {
    const raw = String(err.message);
    const pos = /at line (\d+),(\d+)/.exec(raw);
    const issue = { level: 'error', file, message: raw.split(' at line')[0].trim() };
    if (pos) {
      const line = Number(pos[1]);
      const lines = source.split('\n');
      issue.line = line;
      issue.column = Number(pos[2]);
      issue.sourceLine = lines[line - 1] ?? '';
      const hint = hintFor(lines, line);
      if (hint) issue.hint = hint;
      if (!hint || /^End of input/.test(issue.message)) {
        const culprit = findOneLineObject(lines);
        if (culprit) {
          issue.message += ` (probably caused by line ${culprit.line})`;
          issue.line = culprit.line;
          issue.column = culprit.column;
          issue.sourceLine = lines[culprit.line - 1];
          issue.hint = ONE_LINE_HINT;
        }
      }
    }
    throw new BuildError([issue]);
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new BuildError([
      { level: 'error', file, message: 'The top level of the profile must be an object (key: value pairs).' },
    ]);
  }
  return data;
}
