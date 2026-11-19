---
title: Every profile.hjson field
description: Every field you can put in profile.hjson.
---

Every field linkprofile reads from `profile.hjson`, with its type, whether you need it, its default and the rules the build checks. Only `name` is required.

```hjson
theme: classic
url: https://links.example.com
name: Ada Lovelace
avatar: images/avatar.png
bio: Writer of the first program. Fond of engines.
socials: [
  {
    type: github
    url: https://github.com/ada
    label: My code on GitHub
  }
]
links_title: Featured Links
links: [
  {
    title: Blog
    url: https://example.com/blog
    icon: pencil
    color: "#34d399"
  }
  {
    title: My new book
    url: https://example.com/book
    image: images/book-cover.jpg
  }
]
meta: {
  title: Ada Lovelace - links
  description: Everything I make, in one place.
  favicon: images/avatar.png
}
```

## General rules

- An error stops the build; a warning doesn't. [When your page doesn't update](when-your-page-doesnt-update.md) explains the messages.
- A field set to `null` counts as left out.
- Unknown fields, at any level, are ignored with a warning that suggests the closest known name, or lists the known ones.
- A value containing ` #` gets a warning: it usually means a comment ended up inside the value. In text fields only ` # ` counts, so hashtags such as `#travel` are fine.
- Free-text fields accept numbers as text: `name: 2048` is the text `2048`. These are `name`, `bio`, `links_title`, a link's `title`, a social profile's `label`, and `title` and `description` in `meta`. Other fields, such as `url`, `icon` and `type`, need text.
- File paths are relative to the folder that holds `profile.hjson`. A leading `./` or `/` is ignored. An empty path is an error. The file must exist, must be a file rather than a folder and must be inside that folder, checked after following any symbolic links. Each file you use is copied to the built site.

## Top-level fields

| Field | Type | Required | Default |
| --- | --- | --- | --- |
| `theme` | Theme name, or `{ name, options }` | No | `classic` |
| `url` | Web address | No | The `--url` the build is given |
| `name` | Text | Yes | |
| `avatar` | File path or web address | No | No picture |
| `bio` | Text | No | No bio |
| `socials` | List of social profiles | No | No social icons |
| `links_title` | Text | No | No heading |
| `links` | List of links | No | No links |
| `meta` | `{ title, description, favicon }` | No | See [meta](#meta) |

### theme

The theme's name, in lowercase: one of the built-in themes listed in [Theme options](theme-options.md). An unknown name is an error; the hint suggests the closest name when there is one, and lists the available themes.

The long form sets options too:

```hjson
theme: {
  name: classic
  options: {
    mode: dark
  }
}
```

In the long form, `name` is required and `options` must be a group of fields. Each theme checks its own options: an unknown option is a warning, a value outside the allowed list or a malformed colour is an error. [Theme options](theme-options.md) lists them.

### url

The public address of your page, starting with `https://` or `http://`. Trailing slashes are removed. It sets the page's canonical address and lets link previews find your `avatar`; without it, a local `avatar` isn't used as the preview picture.

If `url` is left out, the build uses its `--url` option. The starter's workflow passes your GitHub Pages address, which is [your own domain](custom-domain.md) once you've set one, so you rarely need `url`. A `url` in the file wins over `--url`.

### name

Required. The page heading, and the default for `meta.title`. Must not be empty.

### avatar

The picture above your name: a file path or a full `http://` or `https://` address. Follows the file path rules above. An SVG gets a warning, because many sites don't show SVG in link previews; use a PNG or JPG.

### bio

A line or two under your name.

### links_title

A heading above your links. Shown only when there is at least one link.

## socials

A list of social profiles, shown as a row of icons in the order you write them. Each item:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `type` | Type name | Yes | A Simple Icons slug or one of linkprofile's own types. Not case-sensitive; spaces and dots are ignored. An unknown type is an error, usually with a suggestion; otherwise the hint lists the known names. |
| `url` | Web address | Yes | Starts with `https://`, `http://`, `mailto:` or `tel:`. |
| `label` | Text | No | What screen readers announce. Default: the brand's name, for example `GitHub`. |

[Icon names](icon-names.md#social-types) lists the common types and aliases.

## links

A list of links, shown in the order you write them. Each item:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `title` | Text | Yes | The text on the button. Must not be empty. |
| `url` | Web address | Yes | Starts with `https://`, `http://`, `mailto:` or `tel:`. |
| `icon` | Icon name | No | A [Lucide](https://lucide.dev/icons) icon name. Not case-sensitive. An unknown name is an error, usually with a suggestion; otherwise the hint lists the known names. |
| `image` | File path or web address | No | A small picture instead of an icon. Follows the file path rules above. |
| `color` | Colour, in quotes | No | `"#rgb"` or `"#rrggbb"`. Colours the link's icon. No effect on a link with `image`. |
| `colour` | Colour, in quotes | No | Another spelling of `color`. If both are set, `color` wins. |

`icon` and `image` can't both be set. A link with neither shows the first letter of its title.

## meta

What browser tabs and link previews show. All three fields are optional.

| Field | Type | Default |
| --- | --- | --- |
| `title` | Text | Your `name` |
| `description` | Text | Your `bio`, or `Links from` and your name |
| `favicon` | File path or web address | None: the browser shows its own icon |

`favicon` follows the file path rules above. The link preview picture is always your `avatar`.
