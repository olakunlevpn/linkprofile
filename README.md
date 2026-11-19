# linkprofile

[![npm version](https://img.shields.io/npm/v/linkprofile.svg?style=flat-square)](https://www.npmjs.com/package/linkprofile)
[![npm downloads](https://img.shields.io/npm/dt/linkprofile.svg?style=flat-square)](https://www.npmjs.com/package/linkprofile)
[![GitHub stars](https://img.shields.io/github/stars/olakunlevpn/linkprofile.svg?style=flat-square)](https://github.com/olakunlevpn/linkprofile)
[![CI](https://img.shields.io/github/actions/workflow/status/olakunlevpn/linkprofile/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/olakunlevpn/linkprofile/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/olakunlevpn/linkprofile.svg?style=flat-square)](https://github.com/olakunlevpn/linkprofile/blob/main/LICENSE)

Turn a profile file into a personal link-in-bio page on GitHub Pages.

## Introduction

linkprofile is a static site generator built for link pages. You edit a single configuration file in Hjson, push your commit, and GitHub Pages publishes the site automatically. No tracking scripts and no monthly fee.

Your live site runs entirely from self-hosted static HTML and CSS. You can keep it on GitHub Pages for free or attach your own domain name.

## Quick start

You can use the ready-made template without installing anything locally.

Open the starter repository on GitHub and click **Use this template**:

https://github.com/olakunlevpn/linkprofile-starter

If you prefer working on your computer, you can initialize a project with the CLI:

```bash
npx linkprofile init
```

This writes a starter `profile.hjson` file and a placeholder avatar image in your current folder.

## Everyday commands

You can preview your page locally with live reload:

```bash
npx linkprofile preview
```

To compile your site into the `dist/` directory:

```bash
npx linkprofile build
```

To view all built-in themes from the command line:

```bash
npx linkprofile themes
```

## How it works

Your whole profile lives inside `profile.hjson`. Here's a quick example:

```hjson
name: Ada Lovelace
bio: Writer of the first program. Fond of engines.
theme: classic

links: [
  {
    title: My personal site
    url: https://example.com
    icon: globe
  }
  {
    title: Source code
    url: https://github.com/you
    icon: github
  }
]

socials: [
  { type: github, url: https://github.com/you }
  { type: email, url: mailto:you@example.com }
]
```

When you push a change to GitHub, a GitHub Actions workflow runs the generator and deploys the finished static site.

## Themes

Five themes come built in out of the box:

- `classic` (default): clean rounded links with an optional light and dark mode toggle.
- `bento`: frosted tiles laid out in an asymmetrical grid.
- `cover`: high-contrast banner with an overlapping portrait photo.
- `crimson`: dark background with scarlet accents and direct host labels.
- `editorial`: warm gradient canvas with card-style links.

You can preview every theme on the official documentation site.

## Documentation

Read the full guides, theme configuration options, and Hjson reference on the website:

https://olakunlevpn.github.io/linkprofile/docs/

## License

This project is open-source software licensed under the [MIT license](https://github.com/olakunlevpn/linkprofile/blob/main/LICENSE).
