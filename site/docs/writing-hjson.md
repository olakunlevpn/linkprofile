---
title: Writing Hjson without mistakes
description: A few habits keep Hjson files from failing.
---

`profile.hjson` is written in [Hjson](https://hjson.github.io), a relaxed kind of JSON made to be edited by hand. It forgives a lot: most values need no quotes, and you don't need commas at the ends of lines. A few rules still matter, and they cause almost every failed build.

## The parts of the file

Each line holds a field: a name, a colon and a value.

```hjson
name: Ada Lovelace
```

Curly brackets `{ }` hold a group of fields, such as one link. Square brackets `[ ]` hold a list, such as all your links. Every bracket you open needs a matching closing one.

```hjson
links: [
  {
    title: Blog
    url: https://example.com/blog
  }
]
```

Lines starting with `#` are comments. They're notes for you, and never appear on your page.

The starter wraps the whole file in one more pair of curly brackets. They're optional, but if the file starts with `{`, it must end with `}`.

## One field per line

A value without quotes runs to the end of the line. Everything after the colon becomes the value, including commas, brackets and other fields.

Right:

```hjson
links: [
  {
    title: Blog
    url: https://example.com/blog
  }
]
```

Wrong: the `title` swallows the rest of the line, and the closing bracket is lost.

<!-- invalid-example -->
```hjson
links: [
  { title: Blog, url: https://example.com/blog }
]
```

A group can sit on one line if every value is in quotes:

```hjson
links: [
  { title: "Blog", url: "https://example.com/blog" }
]
```

## Comments on their own line

For the same reason, a comment after a value without quotes becomes part of the value.

Right:

```hjson
# A square crop of my photo
avatar: images/me.jpg
```

Wrong: linkprofile looks for a file called `images/me.jpg # A square crop of my photo`.

<!-- invalid-example -->
```hjson
avatar: images/me.jpg # A square crop of my photo
```

In text such as `bio`, a comment after the value doesn't stop the build. It appears on your page instead, and linkprofile warns you that a comment ended up inside the value.

## Colours in quotes

A `#` without quotes starts a comment, so a colour needs quotes.

Right:

```hjson
links: [
  {
    title: Shop
    url: https://example.com/shop
    color: "#34d399"
  }
]
```

Wrong: `color` has no value, and the build stops.

<!-- invalid-example -->
```hjson
links: [
  {
    title: Shop
    url: https://example.com/shop
    color: #34d399
  }
]
```

## When a value needs quotes

Most text needs no quotes. Add double quotes around a value when it:

- starts with a bracket, a comma or a colon;
- starts with `#`, such as a colour;
- is exactly `true`, `false` or `null`;
- shares its line with other fields.

A `#` later in the value is fine: `bio: Notes on #engines` keeps the whole text.

Right:

```hjson
bio: "[draft] Notes on engines"
```

Wrong: the `[` starts a list that never ends.

<!-- invalid-example -->
```hjson
name: Ada Lovelace
bio: [draft] Notes on engines
```

Wrong: `true` without quotes is a yes/no value, not text.

<!-- invalid-example -->
```hjson
links: [
  {
    title: true
    url: https://example.com
  }
]
```

Numbers are fine without quotes: `name: 2048` is read as the text `2048`.

To put a double quote inside a value, wrap the value in single quotes instead:

```hjson
bio: 'Writer of "the first program".'
```

## Check before you commit

- Every `{` has a `}` and every `[` has a `]`.
- Each field is on its own line, or every value on a shared line is in quotes.
- Comments are on lines of their own.
- Colours are in quotes.

If the build still fails, [When your page doesn't update](when-your-page-doesnt-update.md) shows how to find and read the error message. To catch mistakes before you commit, [preview your page on your computer](preview-locally.md).
