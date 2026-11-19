import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { build } from './build.js';
import { BuildError, formatIssues } from './issues.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const EVENTS_PATH = '/__linkprofile/events';
const RELOAD_SCRIPT = `<script>new EventSource('${EVENTS_PATH}').addEventListener('reload', function () { location.reload(); });</script>`;
const IGNORED_DIRS = new Set(['node_modules', '.git']);

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const inject = (html) => (html.includes('</body>') ? html.replace('</body>', `${RELOAD_SCRIPT}</body>`) : html + RELOAD_SCRIPT);

function errorPage(error) {
  const text = error instanceof BuildError ? formatIssues(error.issues, { color: false }) : `error: ${error?.message ?? error}`;
  return inject(`<!doctype html><html><head><meta charset="utf-8"><title>linkprofile: build failed</title>
<style>body{font:16px system-ui,sans-serif;margin:2rem;color:#222}pre{background:#fdf0f0;border:1px solid #e3b4b4;padding:1rem;white-space:pre-wrap;border-radius:6px}</style></head>
<body><h1>Build failed</h1><p>Fix profile.hjson and save; this page reloads on its own.</p><pre>${escapeHtml(text)}</pre></body></html>`);
}

export async function startPreview({ config = 'profile.hjson', cwd = process.cwd(), port = 0 } = {}) {
  const configPath = path.resolve(cwd, config);
  const baseDir = path.dirname(configPath);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkprofile-preview-'));
  const events = new EventEmitter();
  const clients = new Set();
  let lastError = null;
  let lastSummary = null;
  let closed = false;

  let building = false;
  let again = false;
  async function rebuild() {
    if (building) {
      again = true;
      return;
    }
    building = true;
    try {
      do {
        again = false;
        try {
          const summary = await build({ config: configPath, out: outDir, cwd });
          lastError = null;
          lastSummary = summary;
        } catch (e) {
          lastError = e;
        }
        if (!closed) {
          try {
            if (lastError) {
              if (events.listenerCount('error')) events.emit('error', lastError);
            } else events.emit('build', lastSummary);
          } catch (e) {
            process.stderr.write(`preview listener failed: ${e?.message ?? e}\n`);
          }
        }
        if (!closed) for (const res of clients) res.write('event: reload\ndata: now\n\n');
      } while (again && !closed);
    } finally {
      building = false;
    }
  }

  const send = (res, status, type, body) => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  };

  const server = http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return send(res, 400, TYPES['.txt'], 'Bad request');
    }
    if (pathname === EVENTS_PATH) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
      res.on('close', () => clients.delete(res));
      return;
    }
    if (pathname.includes('\0')) return send(res, 400, TYPES['.txt'], 'Bad request');
    const rel = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const file = path.resolve(outDir, `.${rel}`);
    const inside = path.relative(outDir, file);
    if (inside.startsWith('..') || path.isAbsolute(inside)) return send(res, 404, TYPES['.txt'], 'Not found');
    const isIndex = inside === 'index.html';
    if (isIndex && lastError) return send(res, 500, TYPES['.html'], errorPage(lastError));
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, TYPES['.txt'], 'Not found');
      const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
      send(res, 200, type, isIndex ? inject(data.toString('utf8')) : data);
    });
  });

  await rebuild();

  let timer = null;
  const watcher = fs.watch(baseDir, { recursive: true }, (_type, name) => {
    if (closed || !name) return;
    const abs = path.resolve(baseDir, String(name));
    if (abs === outDir || abs.startsWith(outDir + path.sep)) return;
    if (path.relative(baseDir, abs).split(path.sep).some((p) => IGNORED_DIRS.has(p))) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 100);
  });
  watcher.on('error', () => {});

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
  } catch (e) {
    closed = true;
    watcher.close();
    fs.rmSync(outDir, { recursive: true, force: true });
    throw e;
  }

  const url = `http://127.0.0.1:${server.address().port}`;

  async function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    watcher.close();
    for (const res of clients) res.end();
    clients.clear();
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
    while (building) await new Promise((r) => setTimeout(r, 10));
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  return { url, outDir, close, events, initial: { summary: lastSummary, error: lastError } };
}
