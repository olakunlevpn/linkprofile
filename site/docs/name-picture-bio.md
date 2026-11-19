---
title: Name, picture and bio
description: Set the name, picture and short bio at the top of your page, and how it appears in browser tabs and link previews.
---

The top of your page shows your picture, your name and a short bio. They come from three fields in `profile.hjson`.

```hjson
name: Ada Lovelace
avatar: images/avatar.png
bio: Writer of the first program. Fond of engines.
```

## Your name

`name` is the page heading. It's the only field every page needs: without it, the build stops with `"name" is required`.

Use your name, a handle or the name of your project. Quotes are optional:

```hjson
name: Ada Lovelace
```

## Your bio

`bio` is a line or two under your name. It's optional; leave it out and the page has no bio.

```hjson
bio: Writer of the first program. Fond of engines.
```

Keep it on one line. A bio without quotes runs to the end of the line, so a comment written after it becomes part of your bio. Put comments on the line above instead.

## Your picture

`avatar` is the picture above your name. It's optional. It can be a file in your repository or a full address on the web.

To use your own picture:

<!-- steps -->
1. **Upload it**

   In your repository, open the `images` folder, click <kbd>Add file</kbd>, then <kbd>Upload files</kbd>. Add your picture and commit.

2. **Point avatar at it**

   In `profile.hjson`, set `avatar` to the file's path, starting from the folder that holds `profile.hjson`:

   ```hjson
   avatar: images/me.jpg
   ```

Or use a picture that's already online, with its full address:

```hjson
avatar: https://example.com/me.jpg
```

A few things make the picture look right everywhere:

- **Use a PNG or JPG.** Link previews on many sites don't show SVG pictures, so linkprofile warns you if `avatar` is an SVG.
- **Use a square picture.** Themes show it small, in a circle or a rounded square, and crop a wide or tall picture to fit. Put your face in the middle.
- **Keep it in your repository.** A path that points outside the folder holding `profile.hjson` stops the build. So does a path to a file that doesn't exist; check the spelling, including capital letters.

The starter also uses `images/avatar.png` for the browser tab icon. When you change your picture, change `meta.favicon` too (see below), or the old picture stays in the tab.

## Browser tab and link previews

`meta` sets what browsers and link previews show. Everything in it is optional:

```hjson
meta: {
  title: Ada Lovelace - links
  description: Everything I make, in one place.
  favicon: images/me.jpg
}
```

| Field | What it does | If you leave it out |
| --- | --- | --- |
| `title` | The text in the browser tab and the title of link previews. | Your `name`. |
| `description` | The text under the title in link previews and search results. | Your `bio`, or "Links from" and your name if there's no bio. |
| `favicon` | The small picture in the browser tab. A file path or full address, like `avatar`. | The browser's own icon. |

Link previews use your `avatar` as their picture. On GitHub Pages this works without any setup: the workflow tells linkprofile your page's address, including [your own domain](custom-domain.md) if you use one.
