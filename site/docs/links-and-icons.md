---
title: Links and icons
description: Add links to your page, give each one an icon, a picture or a colour, and set the heading above them.
---

Your links are the main part of your page. Each one is a button with a title and, usually, an icon.

## Add a link

`links` is a list between square brackets. Each link sits between curly brackets and needs a `title` and a `url`:

```hjson
links: [
  {
    title: My website
    url: https://example.com
  }
  {
    title: Blog
    url: https://example.com/blog
  }
]
```

To add a link, copy a block from `{` to `}` and change it. To remove one, delete its block. You don't need commas between the blocks when each one starts on a new line.

## Titles and addresses

`title` is the text on the button. Keep it short: a few words fit best on a phone.

`url` is where the link goes. It must be a full address that starts with one of these:

| Starts with | Opens | Example |
| --- | --- | --- |
| `https://` or `http://` | A web page | `https://example.com/blog` |
| `mailto:` | A new email | `mailto:ada@example.com` |
| `tel:` | A phone call | `tel:+441234567890` |

An address like `example.com` without `https://` stops the build with `"url" is not a valid URL`.

```hjson
links: [
  {
    title: Email me
    url: mailto:ada@example.com
    icon: mail
  }
  {
    title: Call the studio
    url: tel:+441234567890
    icon: phone
  }
]
```

## Icons

Add an `icon` to show a small symbol next to the title:

```hjson
links: [
  {
    title: Newsletter
    url: https://example.com/newsletter
    icon: mail
  }
]
```

The name can be any icon from [Lucide](https://lucide.dev/icons). Search for a symbol there and copy its name, for example `globe`, `book-open`, `shopping-cart` or `calendar`. Some names get their own drawing in the `classic` theme; [Icon names](icon-names.md#classic-artwork) lists them. Every other name uses the Lucide icon.

If the name doesn't exist, the build stops with `Unknown icon` and suggests the closest name, for example `Did you mean "calendar"?`.

A link without an icon or a picture shows the first letter of its title instead.

## Pictures instead of icons

Use `image` instead of `icon` to show a small picture, such as a book cover or a logo. It works like your [avatar](name-picture-bio.md#your-picture): a file in your repository or a full `https://` address.

```hjson
links: [
  {
    title: My new book
    url: https://example.com/book
    image: images/book-cover.jpg
  }
]
```

A link can have an `icon` or an `image`, not both. With both, the build stops with `Use either "icon" or "image", not both`.

## Colours

Each theme picks the colours of the icons for you. To choose a colour for one link, add `color` with a hex colour in quotes:

```hjson
links: [
  {
    title: Shop
    url: https://example.com/shop
    icon: shopping-cart
    color: "#34d399"
  }
]
```

You can also spell it `colour`. A colour is a `#` followed by three or six characters from 0 to 9 and a to f, like `"#f60"` or `"#ff6600"`. The icon itself turns light or dark to stay readable on your colour. A link that uses `image` shows the picture instead, so `color` has no effect on it.

The quotes matter. Without them, Hjson reads `#` as the start of a comment, and the build stops with a hint to put the colour in quotes:

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

## The heading above your links

`links_title` puts a heading above your links. The starter uses `Featured Links`; change it or delete the line to have no heading.

```hjson
links_title: Things I make
```

The heading only appears when you have at least one link.

## Order

Links appear in the order you write them, top to bottom. To move a link, move its whole block, from `{` to `}`. On wider screens, `bento` shows links two to a row, with the first one full width, so put the one that matters most first.
