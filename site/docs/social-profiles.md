---
title: Social profiles
description: Show your social profiles as a row of small icons under your bio.
---

Under your bio, your page can show a row of small icons that link to your profiles elsewhere: GitHub, Instagram, YouTube, Mastodon and thousands more. They come from `socials` in `profile.hjson`.

## Add a profile

`socials` is a list between square brackets. Each profile sits between curly brackets and needs a `type` and a `url`:

```hjson
socials: [
  {
    type: github
    url: https://github.com/ada
  }
  {
    type: instagram
    url: https://instagram.com/ada
  }
]
```

`type` chooses the icon. `url` is the address of your profile, starting with `https://`. The icons appear in the order you write them.

To add a profile, copy a block from `{` to `}` and change it. To remove one, delete its block.

A profile can also sit on one line, but then the values need quotes:

```hjson
socials: [
  { type: "github", url: "https://github.com/ada" }
]
```

## Which types you can use

The type is usually the name of the site in lowercase, without spaces or dots: `github`, `instagram`, `youtube`, `tiktok`, `bluesky`, `mastodon`, `threads`, `linkedin`, `stackoverflow`. linkprofile uses the brand icons from [Simple Icons](https://simpleicons.org), so any brand there works. The type is that brand's Simple Icons slug, which sometimes spells things out: Next.js is `nextdotjs` and .NET is `dotnet`. If a name doesn't work, the build stops with `Unknown social type` and suggests the closest one, for example `Did you mean "instagram"?`.

A few types are special:

| Type | Shows | Use it for |
| --- | --- | --- |
| `x` or `twitter` | The X logo | Your X (Twitter) profile. Both names give the same icon. |
| `email` or `mail` | An envelope | Your email address, with a `mailto:` address. |
| `website` | A globe | Any other site of yours. |
| `linkedin`, `dribbble`, `figma` | The brand logo | linkprofile includes its own logo for these. |

[Icon names](icon-names.md#social-types) lists the common types.

## Email and other addresses

Besides `https://` and `http://`, a profile's `url` can start with `mailto:` for an email address or `tel:` for a phone number:

```hjson
socials: [
  {
    type: email
    url: mailto:ada@example.com
  }
  {
    type: website
    url: https://ada.example.com
  }
]
```

## Labels

The icons have no visible text, so screen readers announce each one by name: "GitHub", "Instagram", "Email". To change what they say, add a `label`:

```hjson
socials: [
  {
    type: github
    url: https://github.com/ada
    label: My code on GitHub
  }
]
```

The label isn't shown on the page; it only changes what screen readers announce.
