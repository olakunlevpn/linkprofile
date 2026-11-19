---
title: Preview on your computer
description: See changes on your computer before you publish.
---

You can see your page on your own computer before you commit, and watch it change each time you save `profile.hjson`. It's optional: editing on github.com works without it. You'll use a terminal, the text window for typing commands, but only for one command.

## What you need

[Node.js](https://nodejs.org) 22 or newer. Download the LTS version from nodejs.org and install it like any other program. To check it worked, open a terminal and run:

```text
node --version
```

It prints a version such as `v24.11.0`. The first number must be 22 or higher.

On Windows, the terminal is called **Terminal** or **PowerShell**; on a Mac, it's **Terminal**.

## Start the preview

<!-- steps -->
1. **Download your repository**

   On your repository's page on github.com, click <kbd>Code</kbd>, then **Download ZIP**, and unzip it. If you use Git, `git clone` works too.

2. **Open a terminal in that folder**

   Open the folder that holds `profile.hjson`. On Windows, right-click inside it and choose **Open in Terminal**. On a Mac, right-click the folder in Finder and choose **Services**, then **New Terminal at Folder**.

3. **Run the preview**

   ```text
   npx linkprofile preview
   ```

   The first time, `npx` asks to install linkprofile; type `y` and press <kbd>Enter</kbd>. When it's ready, it prints an address:

   ```text
   Preview at http://127.0.0.1:4000
   ```

4. **Open the address**

   Open that address in your browser. You see your page as it will look once published.

## Edit and watch

Open `profile.hjson` in any text editor, change something and save. The page in your browser reloads on its own. The same happens when you add or change a picture in the folder.

If the build finds a mistake, the browser shows **Build failed** and the error message instead of your page, and the terminal shows it too. Fix the file and save; the page comes back on its own. [When your page doesn't update](when-your-page-doesnt-update.md) explains the most common messages.

To stop the preview, click in the terminal and press <kbd>Ctrl</kbd>+<kbd>C</kbd>.

## Publish your changes

The preview only runs on your computer. To publish, copy your changes to `profile.hjson` on github.com and commit, and upload any new pictures. If you cloned with Git, commit and push instead.

## If something goes wrong

- **`npx` or `node` isn't found:** Node.js isn't installed, or the terminal was open before you installed it. Close the terminal, open a new one and try again.
- **`Config file not found`:** the terminal isn't in the folder that holds `profile.hjson`. Open the terminal in that folder.
- **`Port 4000 is already in use`:** another program, perhaps another preview, is using that port. Stop it, or pick another port: `npx linkprofile preview --port 4001`.

[Command line](command-line.md#preview) lists every option.
