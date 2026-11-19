import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from './build.mjs';

const siteDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(siteDir, 'dist');
const port = Number(process.env.PORT ?? 4100);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
};

async function resolveFile(urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^[/\\]+/, '');
  let file = join(distDir, rel);
  if (file !== distDir && !file.startsWith(distDir + sep)) return null;
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    return (await stat(file)).isFile() ? file : null;
  } catch { return null; }
}

const server = createServer(async (req, res) => {
  try {
    const file = await resolveFile(new URL(req.url, 'http://x').pathname);
    const status = file ? 200 : 404;
    const body = await readFile(file ?? join(distDir, '404.html'));
    res.writeHead(status, { 'content-type': TYPES[extname(file ?? '.html')] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
});

let building = false;
let queued = false;
async function rebuild() {
  if (building) { queued = true; return; }
  building = true;
  try {
    await buildSite({ siteBase: process.env.SITE_BASE ?? '/' });
    console.log('Built');
  } catch (err) {
    console.error(err.message);
  }
  building = false;
  if (queued) { queued = false; await rebuild(); }
}

let timer;
function schedule(_event, name) {
  if (name && /^(dist|node_modules)([/\\]|$)/.test(name)) return;
  clearTimeout(timer);
  timer = setTimeout(rebuild, 200);
}

await rebuild();
for (const dir of [siteDir, join(siteDir, '../starter'), join(siteDir, '../packages/linkprofile/themes')]) {
  if (!existsSync(dir)) continue;
  try {
    watch(dir, { recursive: true }, schedule).on('error', (err) => console.error(`watch ${dir}: ${err.message}`));
  } catch (err) {
    console.error(`watch ${dir}: ${err.message}`);
  }
}
server.listen(port, '127.0.0.1', () => console.log(`Site at http://127.0.0.1:${port}`));
