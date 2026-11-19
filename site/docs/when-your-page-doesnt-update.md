---
title: When your page doesn't update
description: Find the error message and what it means.
---

When you commit a change and your page stays the same, the build almost always found a mistake in `profile.hjson`. Your page keeps the last version that built, so visitors never see a broken page. This page shows how to find the error message and how to fix the most common ones.

## Find the error message

<!-- steps -->
1. **Open the failed run**

   In your repository, open the **Actions** tab. The newest run is at the top. A red cross means it failed; click it.

2. **Open the build step**

   Click the **build** job, then the **Build** step to expand it. The error message is at the end of the step's output.

3. **Fix the file and commit**

   Open `profile.hjson`, fix the line the message points to, and commit. A new run starts on its own.

If the run has a green tick but your page looks the same, see [How long until it's live](editing-your-page.md#how-long-until-its-live).

## Read the message

Every message starts with `error:`, then the file name when there is one and, when linkprofile knows it, the line and column. Here, line 7, column 3:

```text
error: profile.hjson:7:3: Found a punctuator character '}' when expecting a quoteless string (check your syntax)
```

Mistakes in a value name the field instead of a line, for example `avatar:` or `links[0] ("Events"):`, which is your first link. Counting starts at 0, so `links[2]` is the third link.

Below the first line you often see the line itself, with a `^` under the spot, and a line starting with `Hint:` that suggests a fix. The last line counts errors and warnings. Warnings don't stop the build, but they often point at something you didn't mean.

Line numbers count from the top of the file, comments included. On github.com, line numbers are shown down the left side of the editor.

## Common errors

### Several fields on one line

The link below was written on one line without quotes, so its `title` became `Blog, url: https://example.com/blog }`, and the closing bracket was lost:

<!-- invalid-example -->
```hjson
name: Ada Lovelace
links: [
  { title: Blog, url: https://example.com/blog }
]
```

The build stops with:

```text error
error: profile.hjson:4:1: Found ']' where a key name was expected (check your syntax or use quotes if the key name includes {}[],: or whitespace)
  ]
  ^
  Hint: In Hjson an unquoted value runs to the end of the line. Put each field on its own line, or put the values in quotes.

1 error, 0 warnings
```

The error points to the line after the mistake, because that's where linkprofile noticed something missing. Put each field on its own line, or quote every value: `{ title: "Blog", url: "https://example.com/blog" }`.

### A colour without quotes

Without quotes, `#34d399` is read as a comment, so `color` has no value:

<!-- invalid-example -->
```hjson
name: Ada Lovelace
links: [
  {
    title: Shop
    url: https://example.com/shop
    color: #34d399
  }
]
```

The build stops with:

```text error
error: profile.hjson:7:3: Found a punctuator character '}' when expecting a quoteless string (check your syntax)
    }
    ^
  Hint: Colours must be in quotes, e.g. color: "#34d399" — an unquoted # starts a comment.

1 error, 0 warnings
```

Write `color: "#34d399"`.

### A comment after a value

A value without quotes runs to the end of the line, so `# my photo` became part of the file name:

<!-- invalid-example -->
```hjson
name: Ada Lovelace
avatar: images/avatar.png # my photo
```

The build stops with:

```text error
error: profile.hjson: avatar: "avatar" file not found: looked for images/avatar.png # my photo
  Hint: In Hjson, a comment after an unquoted value becomes part of it. Put the comment on its own line, or quote the value.

warning: profile.hjson: avatar: This value contains " #" — it looks like a comment ended up inside the value.
  Hint: In Hjson, a comment after an unquoted value becomes part of it. Put the comment on its own line, or quote the value.

1 error, 1 warning
```

Move the comment to a line of its own, above the field. In text fields such as `bio`, a comment after the value doesn't stop the build; it shows up on your page instead, and you get only the warning.

### A picture that isn't there

Here `avatar` points at a file that isn't in the repository:

<!-- invalid-example -->
```hjson
name: Ada Lovelace
avatar: images/me.jpg
```

The build stops with:

```text error
error: profile.hjson: avatar: "avatar" file not found: looked for images/me.jpg
  Hint: Paths are relative to the folder that holds profile.hjson.

1 error, 0 warnings
```

Check that you uploaded the file and committed it, and that the path matches its name exactly. Capital letters count: `Me.JPG` and `me.jpg` are different files. The path starts from the folder that holds `profile.hjson`, so a picture in the `images` folder is `images/me.jpg`.

### An icon name that doesn't exist

Here the icon name is misspelt:

<!-- invalid-example -->
```hjson
name: Ada Lovelace
links: [
  {
    title: Events
    url: https://example.com/events
    icon: calender
  }
]
```

The build stops with:

```text error
error: profile.hjson: links[0] ("Events"): Unknown icon "calender"
  Hint: Did you mean "calendar"?

1 error, 0 warnings
```

Use the name the hint suggests, or find the icon you want on [Lucide](https://lucide.dev/icons). [Links and icons](links-and-icons.md) explains icon names. Unknown social types work the same way, with `Unknown social type`.

### A theme name that doesn't exist

Here the theme name is misspelt:

<!-- invalid-example -->
```hjson
theme: bentoo
name: Ada Lovelace
```

The build stops with:

```text error
error: theme.name: Unknown theme "bentoo"
  Hint: Did you mean "bento"? Available: bento, classic, cover, crimson, editorial

1 error, 0 warnings
```

Use one of the names the hint lists, in lowercase. [Themes, colours and dark mode](themes.md) shows what each looks like.

## Still stuck

[Writing Hjson without mistakes](writing-hjson.md) covers the rules behind most of these errors. If a message doesn't make sense, [open an issue](https://github.com/olakunlevpn/linkprofile/issues) and paste the message and the lines it points to.
