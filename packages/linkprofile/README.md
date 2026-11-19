# linkprofile

Turn a `profile.hjson` file into a static link-in-bio page you can host on GitHub Pages.

```sh
npx linkprofile init      # write a starter profile.hjson and images/avatar.png
npx linkprofile build     # build the site into dist/
npx linkprofile preview   # serve it locally and reload on save
npx linkprofile themes    # list the available themes
```

Needs Node 22 or newer. For a ready-made GitHub Pages setup, use the template at https://github.com/olakunlevpn/linkprofile-starter.

Documentation: https://olakunlevpn.github.io/linkprofile/docs/

## Three Hjson rules

1. Put each field on its own line. An unquoted value runs to the end of the line, so `{ title: A, url: https://a.com }` on one line does not work.
2. Put colours in quotes: `color: "#34d399"`. An unquoted `#` starts a comment.
3. Put comments on their own line. A comment after an unquoted value becomes part of the value.

## Themes

Five themes are built in. Pick one with `theme:` in `profile.hjson`; options go in the long form, quoted because they share one line:

```hjson
theme: { name: "classic", options: { mode: "dark", accent: "#ff6b6b" } }
```

- `classic` (the default): a clean page with pill-shaped links. Options: `mode` is `auto` (default, follows the visitor's system setting), `light` or `dark`; `toggle` (`true` by default) shows a light/dark switch in `auto` mode, built with one small inline script, and the page works fully without it; `accent` colours the dot after your name.
- `bento`: frosted tiles in a two-column grid, the first link full width. Options: `mode` is `dark` (default), `light` or `auto`; `accent` colours the dot after your name and the glow behind the page.
- `cover`: a card under an accent-coloured banner, with your picture overlapping its edge. Options: `mode` is `auto` (default), `light` or `dark`; `accent` colours the banner and the link icons.
- `crimson`: an obsidian page with a grid backdrop, a header card and dark link cards that show each link's address. Options: `mode` is `dark` (default), `light` or `auto`; `accent` (scarlet by default) colours the glow, the link icons and the links heading.
- `editorial`: a big headline on an accent gradient, with white link cards that show each link's address. Options: `mode` is `dark` (default: the deep gradient), `light` (a pale tint) or `auto`; `accent` sets the gradient's colour.

In every theme, `auto` follows the visitor's light or dark system setting, and a link's `color` fills its icon.
