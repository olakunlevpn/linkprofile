---
title: Theme options
description: The options each theme understands.
---

The options each built-in theme understands, with the values it allows and its defaults. Set them in the long form of `theme`:

```hjson
theme: {
  name: classic
  options: {
    mode: dark
    accent: "#ff6b6b"
  }
}
```

| Option | What it does |
| --- | --- |
| `mode` | `auto` follows each visitor's light or dark setting; `light` and `dark` always use that one. |
| `accent` | The theme's highlight colour, as a hex colour in quotes: `"#rgb"` or `"#rrggbb"`. What it colours depends on the theme; see [Themes, colours and dark mode](themes.md). |
| `toggle` | `classic` only. `true` shows a light/dark switch in `auto` mode; `false` hides it. |

An option a theme doesn't know is ignored with a warning. A value outside the allowed list, or an accent that isn't a hex colour, stops the build. Options you leave out use the defaults below.

<!-- generated: theme-options -->
