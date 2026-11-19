import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { build } from './build.js';
import { listThemes } from './themes.js';
import { BuildError, formatIssues, plural } from './issues.js';

const srcDir = path.dirname(fileURLToPath(import.meta.url));

const USAGE = `Usage: linkprofile <command> [options]

Commands:
  build     Build the site from profile.hjson into dist/
              --config <path>   profile file (default: profile.hjson)
              --out <dir>       output folder (default: dist)
              --url <url>       public site URL, used if the profile has none
  preview   Build, serve locally and rebuild on changes
              --config <path>   profile file (default: profile.hjson)
              --port <number>   port (default: 4000)
  init      Write a starter profile.hjson and images/avatar.png
  themes    List built-in themes

Options:
  --version   Print the version
  --help      Print this help
  --debug     Show stack traces on errors
`;

const OPTIONS = {
  config: { type: 'string' },
  out: { type: 'string' },
  url: { type: 'string' },
  port: { type: 'string' },
  debug: { type: 'boolean' },
  help: { type: 'boolean' },
  version: { type: 'boolean' },
};

class UsageError extends Error {}

const version = () => JSON.parse(fs.readFileSync(path.join(srcDir, '..', 'package.json'), 'utf8')).version;

function init({ cwd, stdout, stderr, color }) {
  const target = path.join(cwd, 'profile.hjson');
  try {
    fs.writeFileSync(target, fs.readFileSync(path.join(srcDir, 'init-template.hjson')), { flag: 'wx' });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    stderr.write(`${formatIssues([{
      level: 'error',
      file: target,
      message: 'profile.hjson already exists, so nothing was written',
      hint: 'Edit it, or delete it and run `linkprofile init` again.',
    }], { color })}\n`);
    return 1;
  }
  const avatar = path.join(cwd, 'images', 'avatar.png');
  const wroteAvatar = !fs.existsSync(avatar);
  if (wroteAvatar) {
    fs.mkdirSync(path.dirname(avatar), { recursive: true });
    fs.copyFileSync(path.join(srcDir, 'init-assets', 'avatar.png'), avatar);
  }
  stdout.write(`Created profile.hjson${wroteAvatar ? ' and images/avatar.png' : ''}.\n`);
  stdout.write('Edit profile.hjson, then run `npx linkprofile build`.\n');
  return 0;
}

function themes({ stdout }) {
  const list = listThemes();
  const width = Math.max(0, ...list.map((t) => t.name.length));
  for (const t of list) stdout.write(`${t.name.padEnd(width)}  ${t.description ?? ''}\n`.replace(/ +\n$/, '\n'));
  return 0;
}

async function buildCommand(values, { cwd, stdout, stderr, color }) {
  const result = await build({ config: values.config, out: values.out, url: values.url, cwd });
  if (result.warnings.length) stderr.write(`${formatIssues(result.warnings, { color })}\n`);
  stdout.write(`Built ${path.relative(cwd, result.outDir) || '.'}/ with ${plural(result.links, 'link')} and ${plural(result.socials, 'social')}, using theme ${result.theme}\n`);
  return 0;
}

async function previewCommand(values, { cwd, stdout, stderr, color }) {
  const port = values.port === undefined ? 4000 : values.port.trim() === '' ? NaN : Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new UsageError(`Invalid --port "${values.port}"`);
  const { startPreview } = await import('./preview.js');
  let preview;
  try {
    preview = await startPreview({ config: values.config, cwd, port });
  } catch (e) {
    if (e.code === 'EADDRINUSE') {
      stderr.write(`${formatIssues([{
        level: 'error',
        message: `Port ${port} is already in use`,
        hint: 'Try another port with `linkprofile preview --port 4001`.',
      }], { color })}\n`);
      return 1;
    }
    throw e;
  }
  const onBuild = (r) => {
    if (r.warnings.length) stderr.write(`${formatIssues(r.warnings, { color })}\n`);
  };
  const onError = (e) => {
    stderr.write(`${e instanceof BuildError ? formatIssues(e.issues, { color }) : `error: ${e.message}`}\n`);
  };
  preview.events.on('build', onBuild);
  preview.events.on('error', onError);
  if (preview.initial.summary) onBuild(preview.initial.summary);
  if (preview.initial.error) onError(preview.initial.error);
  stdout.write(`Preview at ${preview.url}\n`);
  await new Promise((resolve) => {
    const stop = () => resolve();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
  await preview.close();
  return 0;
}

const COMMANDS = {
  build: buildCommand,
  preview: previewCommand,
  init: async (_values, ctx) => init(ctx),
  themes: async (_values, ctx) => themes(ctx),
};

export async function main(argv, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const cwd = path.resolve(io.cwd ?? process.cwd());
  const color = Boolean(stderr.isTTY) && !process.env.NO_COLOR;
  const ctx = { cwd, stdout, stderr, color };
  let debug = argv.includes('--debug');

  try {
    let parsed;
    try {
      parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
    } catch (e) {
      throw new UsageError(e.message);
    }
    const { values, positionals } = parsed;
    debug = Boolean(values.debug);
    if (values.version) {
      stdout.write(`${version()}\n`);
      return 0;
    }
    if (values.help || positionals.length === 0) {
      (values.help ? stdout : stderr).write(USAGE);
      return values.help ? 0 : 2;
    }
    const [command, ...extra] = positionals;
    const run = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : null;
    if (!run) throw new UsageError(`Unknown command "${command}"`);
    if (extra.length) throw new UsageError(`Unexpected argument "${extra[0]}"`);
    return await run(values, ctx);
  } catch (e) {
    if (e instanceof UsageError) {
      stderr.write(`${e.message}\n\n${USAGE}`);
      return 2;
    }
    if (e instanceof BuildError) stderr.write(`${formatIssues(e.issues, { color })}\n`);
    else stderr.write(`error: ${e.message}\n`);
    if (debug) stderr.write(`\n${e.stack}\n`);
    return 1;
  }
}
