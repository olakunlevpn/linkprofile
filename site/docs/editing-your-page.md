---
title: Editing your page
description: Change profile.hjson on github.com, publish the change and undo it if you need to.
---

Everything on your page comes from `profile.hjson`. To change your page, you change that file. You can do it all on github.com.

## Edit the file on github.com

<!-- steps -->
1. **Open the file**

   Go to your repository on github.com and click `profile.hjson` in the list of files.

2. **Start editing**

   Click the pencil at the top right of the file. The file opens in an editor in your browser.

3. **Make your change**

   Change the values after the colons. Each field sits on its own line, like `name: Ada Lovelace`. Lines starting with `#` are comments: they explain the file and don't appear on your page.

4. **Commit**

   Click <kbd>Commit changes</kbd>. GitHub asks for a short message describing the change; the suggested one is fine. Click <kbd>Commit changes</kbd> again.

To add a picture, open the `images` folder, click <kbd>Add file</kbd>, then <kbd>Upload files</kbd>, and commit the upload. [Name, picture and bio](name-picture-bio.md#your-picture) explains how to use it.

> [!TIP]
> **Three rules for profile.hjson**
>
> - Put each field on its own line. A value without quotes runs to the end of the line, comments included.
> - Put colours in quotes: `color: "#34d399"`. A `#` without quotes starts a comment.
> - Write comments on a line of their own, starting with `#`.
>
> [Writing Hjson without mistakes](writing-hjson.md) has more examples.

## What happens when you commit

Each commit to the `main` branch starts a run of the **Deploy link page** workflow. Committing on github.com uses `main` unless you choose to create a new branch, so leave that option as it is. You can watch it in the **Actions** tab of your repository:

- A yellow dot means it's still running.
- A green tick means your page is built and published.
- A red cross usually means the build found a mistake in `profile.hjson`. Your page stays as it was until you fix it.

The workflow reads `profile.hjson`, checks it, builds the page with your theme and publishes it with GitHub Pages.

## How long until it's live

A run usually takes about a minute. When it shows a green tick, reload your page. If you still see the old version, your browser may be showing a saved copy: wait a minute and reload again.

If the run has a red cross, open it to find the error message. [When your page doesn't update](when-your-page-doesnt-update.md) explains how to read it.

## Undo a change

GitHub keeps every version of `profile.hjson`, so you can always go back.

<!-- steps -->
1. **Find the version you want**

   Open `profile.hjson` and click <kbd>History</kbd>. You see every commit that changed the file, newest first. Click one to see what it changed: removed lines in red, added lines in green.

2. **Copy the old text**

   On that commit's page, open the menu of `profile.hjson` (the three dots) and choose **View file**. This is the file as it was then. Copy the parts you want back, or the whole file.

3. **Put it back and commit**

   Open the current `profile.hjson`, click the pencil, paste the old text in place of the new, and commit. Your page goes back to how it was.
