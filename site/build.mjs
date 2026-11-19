import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { checkSite } from './lib/checks.mjs';
import { buildDocs } from './lib/docs.mjs';
import { buildDemos, checkHomepageThemes, HOMEPAGE_THEMES } from './lib/demos.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const run = promisify(execFile);
const siteDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(siteDir, 'dist');
const require = createRequire(import.meta.url);
const tailwindBin = join(dirname(require.resolve('@tailwindcss/cli/package.json')), 'dist/index.mjs');
const gsapFile = join(dirname(require.resolve('gsap/package.json')), 'dist/gsap.min.js');

function isInside(parent, dir) {
  const rel = relative(parent, dir);
  return !rel.startsWith('..') && !isAbsolute(rel);
}

export async function buildSite({
  outDir = join(siteDir, 'dist'),
  siteBase = process.env.SITE_BASE ?? '/linkprofile/',
} = {}) {
  if (!/^\/(?:[^/\s]+\/)*$/.test(siteBase)) throw new Error(`siteBase must start and end with "/", got "${siteBase}"`);
  outDir = resolve(outDir);
  // Wipe only site/dist (or inside it). Other paths under site/ are sources and must never be deleted;
  // a directory outside site/ (e.g. a temp dir) is left for the caller to manage.
  if (isInside(distDir, outDir)) await rm(outDir, { recursive: true, force: true });
  else if (isInside(siteDir, outDir)) throw new Error(`Refusing to build into ${outDir}: inside site/ but not site/dist`);
  await mkdir(join(outDir, 'assets'), { recursive: true });

  const themes = await buildDemos({ starterDir: join(siteDir, '../starter'), outDir });
  const mismatch = checkHomepageThemes(HOMEPAGE_THEMES, themes);
  if (mismatch) throw new Error(mismatch);
  await cp(join(siteDir, 'src/index.html'), join(outDir, 'index.html'));
  // The homepage's only script: GSAP (keeping its licence header) followed by src/home.js, self-hosted.
  await mkdir(join(outDir, 'assets/js'), { recursive: true });
  const [gsap, home] = await Promise.all([readFile(gsapFile, 'utf8'), readFile(join(siteDir, 'src/home.js'), 'utf8')]);
  await writeFile(join(outDir, 'assets/js/home.js'), `${gsap.trimEnd()}\n${home}`);

  const notFound = await readFile(join(siteDir, 'src/404.html'), 'utf8');
  await writeFile(join(outDir, '404.html'), notFound.replaceAll('{{SITE_BASE}}', siteBase));

  const docs = await buildDocs({ docsDir: join(siteDir, 'docs'), outDir });

  // Fonts and their OFL licence texts travel together.
  await cp(join(siteDir, 'src/fonts'), join(outDir, 'assets/fonts'), { recursive: true });
  await run(process.execPath, [
    tailwindBin,
    '-i', join(siteDir, 'src/styles.css'),
    '-o', join(outDir, 'assets/site.css'),
    '--minify',
  ], { cwd: siteDir });

  // Keep the MIT notice but drop the URL from Tailwind's banner.
  const cssPath = join(outDir, 'assets/site.css');
  const css = await readFile(cssPath, 'utf8');
  await writeFile(cssPath, css.replace(/^\/\*!([^*]*?)\s*\|\s*https?:\/\/\S+\s*\*\//, '/*!$1 */'));

  const problems = await checkSite(outDir, { siteBase });
  if (problems.length) {
    throw new Error(`Site checks failed:\n${problems.map((p) => `  ${p.file}: ${p.message}`).join('\n')}`);
  }

  return { outDir, pages: ['index.html', ...docs.map((f) => relative(outDir, f))], themes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildSite().then(({ pages, themes }) => {
    console.log(`Built site/dist: ${pages.length - 1} docs pages, ${themes.length} theme demos`);
  }).catch((err) => {
    console.error(`Build failed: ${err.message}`);
    process.exit(1);
  });
}
