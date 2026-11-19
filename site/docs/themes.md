---
title: Themes, colours and dark mode
description: Choose one of five themes, set light or dark mode and pick your own accent colour.
---

A theme sets the whole look of your page: layout, fonts and colours. Five themes are built in. Each one works in light and dark, and takes your own accent colour.

## The five themes

Each preview below is a real page, built with that theme from the starter's `profile.hjson`. Click one to open it full size.

<!-- demos -->

- `classic` is the default: a plain page with pill-shaped links and a light/dark switch.
- `bento` shows links as frosted tiles. On wider screens they sit two to a row, with the first one full width. Dark by default.
- `cover` puts a card under a coloured banner, with your picture overlapping its edge.
- `editorial` has a bold headline on a colour gradient, with white link cards. Dark by default.
- `crimson` is a near-black page with red accents, a grid in the background and raised link cards. Dark by default.

## Switch themes

Set `theme` near the top of `profile.hjson` to the theme's name, in lowercase:

```hjson
theme: bento
```

Commit, and your page changes look. Your name, links and everything else stay the same. If you leave `theme` out, your page uses `classic`.

## Light and dark

Every theme takes a `mode` option:

| Mode | What it does |
| --- | --- |
| `auto` | Follows each visitor's light or dark setting on their phone or computer. |
| `light` | Always light. |
| `dark` | Always dark. |

`classic` and `cover` use `auto` unless you choose otherwise. `bento`, `editorial` and `crimson` are `dark` unless you choose otherwise.

Options go in the long form of `theme`, with the name and the options written out:

```hjson
theme: {
  name: classic
  options: {
    mode: dark
  }
}
```

## Accent colour

Every theme also takes an `accent` colour. Write it as a hex colour in quotes:

```hjson
theme: {
  name: cover
  options: {
    accent: "#ff6b6b"
  }
}
```

What the accent colours depends on the theme:

| Theme | The accent colours |
| --- | --- |
| `classic` | The dot after your name. |
| `bento` | The dot after your name and the glow behind the page. |
| `cover` | The banner and the link icons. |
| `editorial` | The background gradient and the heading above your links. |
| `crimson` | The glow, the link icons and the heading above your links. |

Each theme has its own default accent; [Theme options](theme-options.md) lists them.

## The light/dark switch in classic

In `auto` mode, `classic` shows a small switch in the top-right corner, so visitors can change between light and dark themselves. To hide it, set `toggle` to `false`:

```hjson
theme: {
  name: classic
  options: {
    toggle: false
  }
}
```

The switch only appears in `auto` mode. With `mode: light` or `mode: dark` there's nothing to switch.

## Writing options on one line

You can combine options, and write the whole `theme` on one line. On one line, the values need quotes:

```hjson
theme: { name: "classic", options: { mode: "dark", accent: "#ff6b6b" } }
```

Without the quotes, `classic` and everything after it on the line becomes one long value, the closing brackets are lost, and the build stops:

<!-- invalid-example -->
```hjson
theme: { name: classic, options: { mode: dark } }
name: Ada Lovelace
```

If you misspell an option, linkprofile ignores it and warns you, with a suggestion such as `Did you mean "accent"?`. If a value isn't allowed, for example `mode: dim`, the build stops and lists the values you can use.
