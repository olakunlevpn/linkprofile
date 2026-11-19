---
title: Getting started
description: Put your own link page online in about five minutes, without installing anything.
---

By the end of this page you'll have your own link page online at an address like `you.github.io`. It takes about five minutes, and you don't need to install anything.

> [!NOTE]
> You need a free [GitHub account](https://github.com/signup). That's all.

<!-- steps -->
1. **Copy the starter**

   Open the [linkprofile starter](https://github.com/olakunlevpn/linkprofile-starter) and click <kbd>Use this template</kbd>, then <kbd>Create a new repository</kbd>. Give it any name, for example `links`, and keep it public.

2. **Turn on GitHub Pages**

   In your new repository, open **Settings**, then **Pages**. Under **Source**, choose **GitHub Actions**. Nothing else to set.

3. **Edit profile.hjson**

   Open `profile.hjson` and click the pencil to edit it. Change the name, the bio and the links to your own:

   ```hjson
   name: Ada Lovelace
   bio: Writer of the first program. Fond of engines.

   links: [
     {
       title: My notes
       url: https://example.com/notes
       icon: book-open
     }
   ]
   ```

   > [!TIP]
   > **Three rules that save you a failed build**
   >
   > - Put each field on its own line. A value without quotes runs to the end of the line, comments included.
   > - Put colours in quotes: `color: "#34d399"`. A `#` without quotes starts a comment.
   > - Write comments on a line of their own, starting with `#`.

4. **Commit your change**

   Click <kbd>Commit changes</kbd>. GitHub starts building your page right away. You can watch it in the **Actions** tab: a green tick means it's done.

   If you see a red cross from before you turned on Pages, you can ignore it: your commit starts a new run. If no new run appears, open **Actions**, click **Deploy link page**, then <kbd>Run workflow</kbd>, and confirm with the green <kbd>Run workflow</kbd> button.

5. **Open your page**

   Go back to **Settings**, then **Pages**. Your address is at the top, for example `https://ada.github.io/links/`. Share it anywhere: link previews show your name and picture.

## What to do next

<!-- cards -->
- [Pick a theme](themes.md) — Five looks, each in light and dark, with your own accent colour.
- [Change your picture](name-picture-bio.md#your-picture) — Upload a square PNG or JPG and point `avatar` at it.
- [Use your own domain](custom-domain.md) — Serve your page from links.yourname.com.
- [If your page doesn't update](when-your-page-doesnt-update.md) — Find the error message and what it means.
