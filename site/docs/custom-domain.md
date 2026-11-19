---
title: Use your own domain
description: Serve your page from your own domain.
---

Your page starts at an address like `ada.github.io/links`. If you own a domain, you can serve it from there instead, for example `links.example.com` or `example.com`. You need access to your domain's DNS settings, at the company you bought it from or wherever it's managed. `profile.hjson` doesn't need to change.

## Set it up

<!-- steps -->
1. **Add the domain on GitHub**

   In your repository, open **Settings**, then **Pages**. Under **Custom domain**, type your domain, for example `links.example.com`, and click <kbd>Save</kbd>. GitHub starts checking the domain; it can't finish until the next step is done.

2. **Add the DNS records**

   Sign in where your domain's DNS is managed and add the records for your kind of address. `ada` stands for your GitHub username.

   For a subdomain such as `links.example.com`, add one record:

   | Type | Name | Value |
   | --- | --- | --- |
   | `CNAME` | `links` | `ada.github.io` |

   The value is your username followed by `.github.io`, without the repository name.

   For the domain itself, such as `example.com`, add four `A` records, with `@` (or an empty name) and each of these values:

   ```text
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

   Remove any other `A` records for the same name. GitHub's guide to [managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) also lists the `AAAA` records for IPv6 and how to set up `www`.

3. **Wait, then turn on HTTPS**

   DNS changes can take from a few minutes to a day to spread. When the check under **Custom domain** succeeds, tick **Enforce HTTPS**. If the box can't be ticked yet, GitHub is still preparing the certificate; try again later.

4. **Rebuild your page**

   Commit any change to `profile.hjson`, or open **Actions**, click **Deploy link page**, then <kbd>Run workflow</kbd>. The workflow tells linkprofile your page's address, and once the custom domain is set, that address is your domain.

Your page now opens at your domain, and the old `github.io` address sends visitors there.

## Setting url yourself

linkprofile writes your page's address into the page, and uses it to give link previews the full address of your picture. You don't need to set it: the workflow passes the address for you. Set `url` in `profile.hjson` only if you want a different address there, for example to use `https://` before **Enforce HTTPS** is ticked:

```hjson
url: https://links.example.com
```

The starter has the line already, as a comment: remove the `#` and the space after it, and put in your address. A `url` in `profile.hjson` always wins over the address the workflow passes. [Every profile.hjson field](profile-reference.md#url) has the details.

## About the CNAME file

Some guides suggest a file named `CNAME` in the `public` folder, containing only your domain. Your page is published by GitHub Actions, and for those sites GitHub ignores a `CNAME` file: the **Custom domain** setting is what counts. A `CNAME` file does no harm, because everything in `public` is copied to your site as it is, but you don't need one.

## Remove the domain

In **Settings**, then **Pages**, clear **Custom domain** and save. If you set `url` in `profile.hjson`, remove it, then rebuild your page as in step 4. Your page goes back to its `github.io` address. Delete the DNS records too, so nobody else can point your domain at their own GitHub page.
