---
title: What linkprofile is
description: linkprofile turns one text file into a link-in-bio page that GitHub hosts for free.
---

linkprofile turns one text file into a link-in-bio page: a single page with your name, your picture, a short bio and the links you want people to find. GitHub hosts it for free.

## What you get

- A page at an address like `https://you.github.io/links/`, or on [your own domain](custom-domain.md).
- Your name, picture and bio at the top, a row of [social profile icons](social-profiles.md), and your [links](links-and-icons.md), each with an icon or a picture.
- A choice of five [themes](themes.md). Each one works in light and dark, and takes your own accent colour.
- Link previews: when you share the address, sites and chat apps show your name, bio and picture.

## How it works

Everything on your page comes from one file in your GitHub repository, `profile.hjson`. It looks like this:

```hjson
name: Ada Lovelace
bio: Writer of the first program. Fond of engines.
theme: classic
links: [
  {
    title: My notes
    url: https://example.com/notes
  }
]
```

When you change the file and commit, GitHub runs linkprofile for you. It reads `profile.hjson`, builds the page and publishes it with GitHub Pages. About a minute later the new version is online. You never install anything: you edit the file on github.com.

If you'd rather work on your computer, you can [preview the page there](preview-locally.md) before you publish.

## What it costs

Nothing. linkprofile is free and open source, and GitHub Pages hosts public repositories at no charge. A free GitHub account is all you need. Your own domain is optional; you pay for that with whoever sells it to you.

## Privacy

Your page has no tracking, no analytics and no cookies. Fonts and icons are part of the page, so a visit doesn't send anything to other sites. The one exception is a picture you link from another site with a full `https://` address: visitors' browsers load it from there.

The page is yours. It lives in your repository, and you can move it, change it or delete it whenever you like.

## What it isn't

- It isn't a website builder. You get one page of links, not a site with several pages.
- It has no visitor statistics, contact forms or shop.
- It isn't a hosted service with an account and a dashboard. Your page is a file in your GitHub repository, and GitHub publishes it.
