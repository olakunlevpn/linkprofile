---
title: Command line
description: The linkprofile commands and their options.
---

The linkprofile commands and their options. You don't need any of them to publish with the starter: its workflow runs `build` for you. They need [Node.js](https://nodejs.org) 22 or newer; `npx` downloads linkprofile the first time you run it.

```text
npx linkprofile <command> [options]
```

| Command | What it does |
| --- | --- |
| `init` | Writes a starter `profile.hjson` and `images/avatar.png`. |
| `build` | Builds the page into a folder. |
| `preview` | Builds the page, serves it on your computer and rebuilds when files change. |
| `themes` | Lists the built-in themes. |

## init

```text
npx linkprofile init
```

Writes `profile.hjson` and `images/avatar.png` in the current folder: the same file and picture as the starter. If `profile.hjson` already exists, nothing is written and the command fails. An existing `images/avatar.png` is kept.

## build

```text
npx linkprofile build [--config <path>] [--out <dir>] [--url <url>]
```

| Option | Default | What it does |
| --- | --- | --- |
| `--config <path>` | `profile.hjson` | The profile to build. File paths in it are relative to its folder. |
| `--out <dir>` | `dist` | The folder to write the page to. |
| `--url <url>` | None | The page's public address, used when the profile has no `url`. Must start with `https://` or `http://`. |

The output folder holds:

- `index.html`, your page;
- `theme/`, the theme's stylesheet and files;
- the pictures your profile uses, at the same paths;
- everything in the `public` folder next to your profile, copied as it is;
- `.linkprofile`, an empty marker file.

If a file from `public` has the same path as a file linkprofile writes, linkprofile's file replaces it, with a warning.

On success, `build` prints a summary such as `Built dist/ with 5 links and 5 socials, using theme classic`. Warnings go before it.

### Output folder safety

`build` empties the output folder before writing to it, so it refuses folders that would lose your files. It stops with `Refusing to use "<dir>" as the output directory` if the folder:

- is the root of the disk;
- is, or contains, the current folder or the folder holding your profile;
- is inside `public`;
- would contain your profile or a picture it uses;
- exists and isn't a folder.

It stops with `Refusing to empty "<dir>": it isn't a previous linkprofile build` if the folder has files in it but no `.linkprofile` marker. Each build writes the marker, so building into the same folder again works. Delete the folder yourself, or choose another `--out`.

## preview

```text
npx linkprofile preview [--config <path>] [--port <number>]
```

| Option | Default | What it does |
| --- | --- | --- |
| `--config <path>` | `profile.hjson` | The profile to build. |
| `--port <number>` | `4000` | The port to serve on, from 0 to 65535. `0` picks a free one. |

Builds the page into a temporary folder, so `dist` is left alone, and serves it at the address it prints, such as `Preview at http://127.0.0.1:4000`. Only your computer can open it.

When any file in the profile's folder changes, the page rebuilds and the browser reloads. Changes in `node_modules` and `.git` are ignored. If a build fails, the browser shows the error instead of the page, and errors and warnings also appear in the terminal. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop.

If the port is taken, `preview` stops with `Port 4000 is already in use`; choose another with `--port`. [Preview on your computer](preview-locally.md) walks through it.

## themes

```text
npx linkprofile themes
```

Lists each built-in theme's name and a one-line description. [Theme options](theme-options.md) lists their options.

## Global options

| Option | What it does |
| --- | --- |
| `--help` | Prints the commands and options. |
| `--version` | Prints the linkprofile version. |
| `--debug` | On an error, also prints the stack trace. Useful when [reporting a problem](https://github.com/olakunlevpn/linkprofile/issues). |

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `1` | The command failed: an error in the profile, a missing file, an invalid `--url`, a refused output folder, a port in use, or `init` finding an existing `profile.hjson`. The message says which. |
| `2` | The command line itself is wrong: no command, an unknown command or option, an option without its value, an extra argument, or an invalid `--port`. linkprofile prints the problem and the usage. |

Errors and warnings go to standard error; summaries go to standard output. Colours are used only when standard error is a terminal; set `NO_COLOR` to turn them off.
