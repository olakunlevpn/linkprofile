import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProfile } from 'linkprofile/src/parse.js';
import { validateProfile } from 'linkprofile/src/validate.js';
import { listThemes, loadTheme, checkThemeOptions } from 'linkprofile/src/themes.js';

const docsDir = join(dirname(fileURLToPath(import.meta.url)), '../docs');
const docs = readdirSync(docsDir).filter((f) => f.endsWith('.md')).map((f) => ({ file: f, text: readFileSync(join(docsDir, f), 'utf8') }));
const page = (file) => docs.find((d) => d.file === file).text;
const CLI = fileURLToPath(import.meta.resolve('linkprofile/bin/linkprofile.js'));

// Every ```hjson fence, with whether the line above it marks it as a deliberately wrong example.
function hjsonExamples() {
  const out = [];
  for (const { file, text } of docs) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      // Fences inside list items are indented; the indent is not part of the example.
      const indent = /^( *)```hjson\s*$/.exec(lines[i])?.[1];
      if (indent === undefined) continue;
      const end = lines.findIndex((l, j) => j > i && /^ *```\s*$/.test(l));
      assert.ok(end > i, `${file}:${i + 1}: unclosed hjson fence`);
      let k = i - 1;
      while (k >= 0 && lines[k].trim() === '') k--;
      out.push({ where: `${file}:${i + 1}`, source: lines.slice(i + 1, end).map((l) => l.slice(indent.length)).join('\n'), invalid: lines[k]?.trim() === '<!-- invalid-example -->' });
      i = end;
    }
  }
  return out;
}

const LOCAL_FILE = /^[\w-]+(?:\/[\w.-]+)*\.\w+$/;

// Returns the issues an example produces (parse errors, validation errors and warnings, theme option issues).
// Image paths in valid examples stand for files the reader has uploaded; invalid ones get no files,
// so an example can show what happens when a file is missing.
function check(source, { withFiles = true } = {}) {
  let raw;
  try {
    raw = parseProfile(source, 'example.hjson');
  } catch (err) {
    return err.issues ?? [{ level: 'error', message: err.message }];
  }
  if (raw.name === undefined) raw = { name: 'Test', ...raw };
  const dir = mkdtempSync(join(tmpdir(), 'lp-content-'));
  try {
    const assets = withFiles ? [raw.avatar, raw.meta?.favicon, ...(Array.isArray(raw.links) ? raw.links.map((l) => l?.image) : [])] : [];
    for (const a of assets) {
      if (typeof a === 'string' && LOCAL_FILE.test(a)) {
        mkdirSync(join(dir, dirname(a)), { recursive: true });
        writeFileSync(join(dir, a), '');
      }
    }
    const { profile, issues } = validateProfile(raw, { baseDir: dir, file: 'example.hjson' });
    if (!profile) return issues;
    let theme;
    try {
      theme = loadTheme(profile.theme.name);
    } catch (err) {
      return [...issues, ...err.issues];
    }
    return [...issues, ...checkThemeOptions(theme, profile.theme.options)];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// What each deliberately wrong example (in order within its file) must fail with: the reason the text gives.
const INVALID_EXPECTED = {
  'links-and-icons.md': [/Colours must be (in quotes|quoted)/],
  'themes.md': [/unquoted value runs to the end of the line/],
  'when-your-page-doesnt-update.md': [
    /unquoted value runs to the end of the line/,
    /Colours must be in quotes/,
    /a comment after an unquoted value becomes part of it/,
    /file not found: looked for images\/me\.jpg/,
    /Unknown icon "calender".*Did you mean "calendar"/,
    /Unknown theme "bentoo".*Did you mean "bento"/,
  ],
  'writing-hjson.md': [
    /unquoted value runs to the end of the line/,
    /a comment after an unquoted value becomes part of it/,
    /Colours must be (in quotes|quoted)/,
    /missing '\]'/,
    /"title" must be a string.*put it in quotes/,
  ],
};

test('every hjson example in the docs parses and validates', () => {
  const examples = hjsonExamples();
  assert.ok(examples.length > 0);
  const failures = [];
  const seen = {};
  for (const ex of examples) {
    const issues = check(ex.source, { withFiles: !ex.invalid });
    if (ex.invalid) {
      const errors = issues.filter((i) => i.level === 'error');
      const file = ex.where.split(':')[0];
      const expected = INVALID_EXPECTED[file]?.[(seen[file] = (seen[file] ?? -1) + 1)];
      if (!errors.length) failures.push(`${ex.where}: marked invalid but produces no error`);
      else if (expected && !errors.some((i) => expected.test(`${i.message} ${i.hint ?? ''}`))) {
        failures.push(`${ex.where}: expected an error matching ${expected}, got ${errors.map((i) => `${i.message} (${i.hint ?? 'no hint'})`).join('; ')}`);
      }
      continue;
    }
    if (issues.length) failures.push(`${ex.where}: ${issues.map((i) => `${i.level}: ${i.message}`).join('; ')}`);
  }
  assert.deepEqual(failures, []);
});

test('the themes page names every built-in theme', () => {
  for (const { name } of listThemes()) assert.match(page('themes.md'), new RegExp(`\`${name}\``), name);
});

test('the mode defaults described on the themes page match theme.json', () => {
  const text = page('themes.md');
  const names = (text) => [...text.matchAll(/`([a-z]+)`/g)].map((m) => m[1]).filter((n) => n !== 'auto' && n !== 'dark').sort();
  const byMode = (mode) => listThemes().map(({ name }) => name).filter((n) => loadTheme(n).options.mode === mode).sort();
  const auto = /^(.*) use `auto` unless you choose otherwise\./m.exec(text);
  const dark = /([^.]*) are `dark` unless you choose otherwise\./m.exec(text);
  assert.ok(auto && dark, 'themes.md must state the auto and dark defaults');
  assert.deepEqual(names(auto[1].split('. ').at(-1)), byMode('auto'));
  assert.deepEqual(names(dark[1]), byMode('dark'));
  assert.deepEqual([...byMode('auto'), ...byMode('dark')].sort(), listThemes().map(({ name }) => name).sort(), 'every theme defaults to auto or dark');
  for (const { name } of listThemes()) {
    const bullet = new RegExp(`^- \`${name}\` .*$`, 'm').exec(text);
    assert.ok(bullet, `themes.md has no bullet for ${name}`);
    assert.equal(bullet[0].endsWith('Dark by default.'), loadTheme(name).options.mode === 'dark', `${name} bullet`);
  }
});

test('every CLI command and option is documented', () => {
  const help = spawnSync(process.execPath, [CLI, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  const commands = [...help.stdout.split(/\n\s*\n/).find((b) => b.startsWith('Commands:')).matchAll(/^ {2}([a-z]+) /gm)].map((m) => m[1]);
  const options = [...new Set(help.stdout.match(/--[a-z]+/g))];
  assert.deepEqual(commands, ['build', 'preview', 'init', 'themes']);
  const text = page('command-line.md');
  for (const name of commands) assert.ok(text.includes(`\`${name}\``), `command-line.md does not mention \`${name}\``);
  for (const option of options) assert.ok(text.includes(option), `command-line.md does not mention ${option}`);
});

test('every validated field is in the profile reference', () => {
  const fields = ['theme', 'url', 'name', 'avatar', 'bio', 'socials', 'links_title', 'links', 'meta', 'title', 'icon', 'image', 'color', 'colour', 'type', 'label', 'description', 'favicon', 'options'];
  const text = page('profile-reference.md');
  for (const f of fields) assert.ok(text.includes(`\`${f}\``), `profile-reference.md does not mention \`${f}\``);
});

test('quoted error messages are real', () => {
  const lines = page('when-your-page-doesnt-update.md').split('\n');
  const examples = hjsonExamples().filter((e) => e.where.startsWith('when-your-page-doesnt-update.md:'));
  let quotes = 0;
  const real = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== '```text error') continue;
    const end = lines.findIndex((l, j) => j > i && l === '```');
    const quoted = lines.slice(i + 1, end).join('\n');
    const example = examples.filter((e) => Number(e.where.split(':')[1]) < i + 1).at(-1);
    assert.ok(example?.invalid, `line ${i + 1}: an error quote needs a broken profile marked <!-- invalid-example --> above it`);
    const dir = mkdtempSync(join(tmpdir(), 'lp-errors-'));
    try {
      writeFileSync(join(dir, 'profile.hjson'), `${example.source}\n`);
      const run = spawnSync(process.execPath, [CLI, 'build'], { cwd: dir, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
      assert.equal(run.status, 1, `line ${i + 1}: the build should fail`);
      assert.equal(run.stderr.split('\n')[0], quoted.split('\n')[0], `line ${i + 1}: first line`);
      assert.ok(run.stderr.includes(quoted), `line ${i + 1}: quoted output differs from the real output:\n${run.stderr}`);
      real.push(run.stderr);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    quotes++;
    i = end;
  }
  assert.equal(quotes, 6);
  // Error lines quoted elsewhere on the page must come from one of the real outputs.
  for (const line of lines.filter((l) => l.startsWith('error: '))) assert.ok(real.some((r) => r.includes(line)), `not a real error line: ${line}`);
});
