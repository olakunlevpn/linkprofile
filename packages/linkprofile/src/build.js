import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BuildError } from './issues.js';
import { parseProfile } from './parse.js';
import { validateProfile, normaliseSiteUrl } from './validate.js';
import { loadTheme, checkThemeOptions } from './themes.js';
import { renderPage } from './render.js';

const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const fail = (message, extra = {}) => new BuildError([{ level: 'error', message, ...extra }]);

// true when `outer` equals `inner` or is one of its ancestors
const contains = (outer, inner) => {
  const rel = path.relative(outer, inner);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

function siteUrlFromFlag(url) {
  const normalised = normaliseSiteUrl(url);
  if (!normalised) {
    throw fail(`Invalid --url "${url}"`, { hint: 'Use a full http(s) URL such as https://user.github.io/repo' });
  }
  return normalised;
}

// realpath of the deepest existing ancestor, with the non-existent tail re-appended
function realish(p) {
  const tail = [];
  let cur = p;
  for (;;) {
    try {
      return path.join(fs.realpathSync(cur), ...tail.reverse());
    } catch (e) {
      const parent = path.dirname(cur);
      if (parent === cur) return p;
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

const MARKER = '.linkprofile';

function assertSafeOutDir(outDirIn, { cwd, baseDir, publicDir, configPath, localFiles }) {
  const outDir = realish(outDirIn);
  const refuse = (why) => fail(`Refusing to use "${outDirIn}" as the output directory: ${why}`, { hint: 'Pick a dedicated folder, e.g. --out dist' });
  if (outDir === path.parse(outDir).root) throw refuse('it is the filesystem root');
  if (contains(outDir, realish(cwd))) throw refuse('it is or contains the current directory');
  if (contains(outDir, realish(baseDir))) throw refuse('it is or contains the folder holding your profile');
  if (contains(realish(publicDir), outDir)) throw refuse('it is inside public/');
  if (contains(outDir, realish(configPath))) throw refuse('it would delete your config file');
  for (const f of localFiles) {
    if (contains(outDir, realish(path.join(baseDir, f)))) throw refuse(`it would delete your source file "${f}"`);
  }
  if (fs.existsSync(outDirIn)) {
    if (!fs.statSync(outDirIn).isDirectory()) throw refuse('it exists and is not a directory');
    if (fs.readdirSync(outDirIn).length > 0 && !fs.existsSync(path.join(outDirIn, MARKER))) {
      throw fail(`Refusing to empty "${outDirIn}": it isn't a previous linkprofile build`, { hint: 'Delete it yourself or choose another --out folder.' });
    }
  }
}

export async function build(opts = {}) {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const configPath = path.resolve(cwd, opts.config ?? 'profile.hjson');
  const outDir = path.resolve(cwd, opts.out ?? 'dist');
  const baseDir = path.dirname(configPath);
  const publicDir = path.join(baseDir, 'public');

  const shown = path.relative(cwd, configPath);
  const file = shown.startsWith('..') || path.isAbsolute(shown) ? configPath : shown;
  let text;
  try {
    text = fs.readFileSync(configPath, 'utf8');
  } catch (e) {
    const hint = 'Run `npx linkprofile init` to create one';
    if (e.code === 'ENOENT') throw fail(`Config file not found: ${configPath}. ${hint}`, { file, hint });
    throw fail(`Cannot read config file ${configPath}: ${e.message}`, { file });
  }

  const raw = parseProfile(text, file);
  const { profile, issues } = validateProfile(raw, { baseDir, file });
  if (!profile) throw new BuildError(issues);
  const warnings = issues.filter((i) => i.level === 'warning');

  if (!profile.url && opts.url) profile.url = siteUrlFromFlag(opts.url);

  const theme = loadTheme(profile.theme.name, opts.themesDir);
  const optionIssues = checkThemeOptions(theme, profile.theme.options, file);
  if (optionIssues.some((i) => i.level === 'error')) throw new BuildError([...issues, ...optionIssues]);
  warnings.push(...optionIssues);
  const { version } = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const html = await renderPage(profile, theme, { version });

  assertSafeOutDir(outDir, { cwd, baseDir, publicDir, configPath, localFiles: profile.localFiles });

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, MARKER), '');
  if (fs.existsSync(publicDir) && fs.statSync(publicDir).isDirectory()) {
    fs.cpSync(publicDir, outDir, { recursive: true });
  }

  const put = (rel, write) => {
    const dest = path.join(outDir, rel);
    if (fs.existsSync(dest)) {
      warnings.push({ level: 'warning', message: `Generated file "${rel}" replaces an existing file in the output (e.g. from public/)` });
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    write(dest);
  };
  const putFile = (rel, src) => put(rel, (dest) => fs.cpSync(src, dest, { recursive: true, force: true }));

  put('index.html', (dest) => fs.writeFileSync(dest, html));
  putFile('theme/style.css', path.join(theme.dir, 'style.css'));
  const assets = path.join(theme.dir, 'assets');
  if (fs.existsSync(assets)) {
    for (const f of fs.readdirSync(assets, { recursive: true })) {
      if (fs.statSync(path.join(assets, f)).isFile()) putFile(path.join('theme/assets', f), path.join(assets, f));
    }
  }
  for (const f of profile.localFiles) putFile(f, path.join(baseDir, f));

  return { theme: theme.name, links: profile.links.length, socials: profile.socials.length, outDir, warnings };
}
