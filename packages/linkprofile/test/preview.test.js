import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { startPreview } from '../src/preview.js';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'sample');
const project = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-preview-'));
  fs.cpSync(fixture, dir, { recursive: true });
  return dir;
};
const withPreview = async (dir, fn) => {
  const p = await startPreview({ cwd: dir, port: 0 });
  try {
    await fn(p);
  } finally {
    await p.close();
  }
};

test('serves built page', async () => {
  await withPreview(project(), async (p) => {
    const res = await fetch(p.url);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /vyshnav/);
  });
});

test('injects live-reload script only in preview', async () => {
  const dir = project();
  await withPreview(dir, async (p) => {
    assert.match(await (await fetch(p.url)).text(), /EventSource\('\/__linkprofile\/events'\)/);
  });
});

test('rebuilds on profile change', async () => {
  const dir = project();
  await withPreview(dir, async (p) => {
    const built = once(p.events, 'build');
    const file = path.join(dir, 'profile.hjson');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('name: vyshnav', 'name: renamedperson'));
    await built;
    assert.match(await (await fetch(p.url)).text(), /renamedperson/);
  });
});

test('broken profile gives 500 error page with escaped issues; recovers after fix', async () => {
  const dir = project();
  const file = path.join(dir, 'profile.hjson');
  const good = fs.readFileSync(file, 'utf8');
  await withPreview(dir, async (p) => {
    const failed = once(p.events, 'error');
    const bad = good.replace('theme: classic', 'theme: "<script>alert(1)</script>"');
    assert.notEqual(bad, good);
    fs.writeFileSync(file, bad);
    await failed;
    const res = await fetch(p.url);
    assert.equal(res.status, 500);
    const body = await res.text();
    assert.ok(body.includes('&lt;script&gt;alert(1)'), body);
    assert.ok(!body.includes('<script>alert'));
    assert.match(body, /EventSource/);
    const fixed = once(p.events, 'build');
    fs.writeFileSync(file, good);
    await fixed;
    assert.equal((await fetch(p.url)).status, 200);
  });
});

test('does not write to the project dist/', async () => {
  const dir = project();
  await withPreview(dir, async (p) => {
    await fetch(p.url);
  });
  assert.equal(fs.existsSync(path.join(dir, 'dist')), false);
});

test('path traversal blocked, bad encoding does not crash', async () => {
  await withPreview(project(), async (p) => {
    const port = new URL(p.url).port;
    const { default: net } = await import('node:net');
    const raw = (target) => new Promise((resolve) => {
      const s = net.connect(Number(port), '127.0.0.1', () => s.write(`GET ${target} HTTP/1.0\r\n\r\n`));
      let data = '';
      s.on('data', (d) => (data += d));
      s.on('close', () => resolve(data.split(' ')[1]));
    });
    assert.equal(await raw('/../profile.hjson'), '404');
    assert.equal(await raw('/%2e%2e/profile.hjson'), '404');
    assert.equal(await raw('/%E0%A4%A'), '400');
    assert.equal((await fetch(p.url)).status, 200);
  });
});

test('close ends SSE connections and removes the temp dir', async () => {
  const p = await startPreview({ cwd: project(), port: 0 });
  assert.ok(fs.existsSync(p.outDir));
  const res = await fetch(`${p.url}/__linkprofile/events`);
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  await p.close();
  assert.equal(fs.existsSync(p.outDir), false);
  const reader = res.body.getReader();
  const drain = (async () => {
    for (;;) {
      const { done } = await reader.read().catch(() => ({ done: true }));
      if (done) return true;
    }
  })();
  const timeout = new Promise((r) => setTimeout(() => r(false), 3000).unref());
  assert.equal(await Promise.race([drain, timeout]), true, 'SSE stream did not end');
});
