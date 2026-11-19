import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'linkprofile.js');
const fixture = path.join(root, 'test', 'fixtures', 'sample');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lp-cli-'));
const run = (args, cwd, env = {}) =>
  spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
const project = () => {
  const dir = tmp();
  fs.cpSync(fixture, dir, { recursive: true });
  return dir;
};

test('build success prints summary and exits 0', () => {
  const dir = project();
  const r = run(['build'], dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Built .* 5 links .* theme classic/);
  assert.ok(fs.existsSync(path.join(dir, 'dist', 'index.html')));
});

test('build honours --config and --out', () => {
  const dir = project();
  fs.renameSync(path.join(dir, 'profile.hjson'), path.join(dir, 'me.hjson'));
  const r = run(['build', '--config', 'me.hjson', '--out', 'site'], dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'site', 'index.html')));
});

test('build errors: exit 1, formatted issues on stderr, no stack trace', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'profile.hjson'), '{\n  name: A\n  links: [ { title: A, url: B } ]\n}\n');
  const r = run(['build'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /profile\.hjson:\d+:\d+/);
  assert.doesNotMatch(r.stderr, /at .*\.js:\d+/);
});

test('--debug shows stack', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'profile.hjson'), '{ name: }');
  const r = run(['build', '--debug'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /at .*\.js:\d+/);
});

test('init writes profile.hjson that builds cleanly', () => {
  const dir = tmp();
  const init = run(['init'], dir);
  assert.equal(init.status, 0, init.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'profile.hjson')));
  assert.ok(fs.existsSync(path.join(dir, 'images', 'avatar.png')));
  const r = run(['build'], dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '', 'zero warnings');
  assert.match(r.stdout, /5 links and 5 socials/);
});

test('init refuses to overwrite', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'profile.hjson'), '{ name: keep }');
  const r = run(['init'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /already exists/);
  assert.equal(fs.readFileSync(path.join(dir, 'profile.hjson'), 'utf8'), '{ name: keep }');
});

test('themes lists every built-in theme', () => {
  const r = run(['themes'], tmp());
  assert.equal(r.status, 0);
  assert.match(r.stdout, /classic\s+Clean page with pill-shaped links/);
  assert.match(r.stdout, /bento\s+Frosted tiles in a two-column grid/);
  assert.match(r.stdout, /cover\s+Card under an accent banner/);
  assert.match(r.stdout, /crimson\s+Dark obsidian page with scarlet accents/);
  assert.match(r.stdout, /editorial\s+Bold headline on an accent gradient/);
});

test('unknown command → usage, exit 2', () => {
  const r = run(['frobnicate'], tmp());
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown command "frobnicate"/);
  assert.match(r.stderr, /Usage:/);
});

test('unknown flag → usage, exit 2', () => {
  const r = run(['build', '--nope'], tmp());
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage:/);
});

test('no command prints usage, exit 2; --help exits 0', () => {
  assert.equal(run([], tmp()).status, 2);
  const h = run(['--help'], tmp());
  assert.equal(h.status, 0);
  assert.match(h.stdout, /Usage:/);
});

test('preview prints its URL, then stops on SIGTERM with exit 0', async () => {
  const dir = project();
  const child = spawn(process.execPath, [bin, 'preview', '--port', '0'], { cwd: dir });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    const t = setInterval(() => out.includes('Preview at') && (clearInterval(t), resolve()), 20);
    child.once('exit', (c) => (clearInterval(t), reject(new Error(`preview exited early (${c})`))));
    setTimeout(() => (clearInterval(t), reject(new Error('preview start timeout'))), 10000).unref();
  });
  assert.match(out, /Preview at http:\/\/127\.0\.0\.1:\d+/);
  const code = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  assert.equal(await code, 0);
});

test('preview with port in use: exit 1 with --port hint', async () => {
  const dir = project();
  const blocker = net.createServer();
  await new Promise((r) => blocker.listen(0, '127.0.0.1', r));
  try {
    const r = spawnSync(process.execPath, [bin, 'preview', '--port', String(blocker.address().port)], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /already in use/);
    assert.match(r.stderr, /--port/);
  } finally {
    blocker.close();
  }
});

test('--version prints package version', () => {
  const r = run(['--version'], tmp());
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), version);
});

test('colour only when TTY and NO_COLOR unset', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'profile.hjson'), '{ name: }');
  const r = run(['build'], dir, { FORCE_COLOR: '1' });
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stderr, /\x1b\[/);
});
