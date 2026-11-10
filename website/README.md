# Companio marketing website

The public-facing website is **standalone** from the Electron desktop app. Its HTML, CSS, JavaScript, and vector illustrations live entirely inside this folder. It does not simulate native Windows actions, collect user data, or require an AI model.

## Live site

**[https://companio-eight.vercel.app](https://companio-eight.vercel.app)**

The live site is served by Vercel from the `website/` directory of the `main` branch. The site is public; preview deployments can remain protected.

## Preview locally

From the repository root:

```powershell
cd website
python -m http.server 4173
```

Then visit `http://localhost:4173`. Alternatively, serve this directory with any static file server.

## Deploy

The production site is deployed on **Vercel**. Its root directory is `website`, its framework is `Other` (no framework), its build command is empty, and its output directory is `.`. Site updates on `main` are automatically redeployed. You may also host the `website/` directory as a static site on Cloudflare Pages, Netlify, or another static host. No install or build command is needed. The output directory is the site directory itself. The public site is deliberately isolated from the desktop app's `index.html` and Vite build so the Windows overlay, packaging, and native features remain unchanged.

For richer social link previews, add an absolute `og:image` asset for the production hostname. The leading download CTA links to the latest verified Windows development preview (v1.1.0-rc.21 at publication) while a separate link preserves the older stable GitHub Release. GitHub Actions artifacts require a GitHub login and expire after 14 days, so the page explains how to find newer successful release builds. Update the preview run URL and version when publishing a newer release preview; do not imply that Actions artifacts are permanent.

## Visual identity

The identity uses an original C-shaped emblem with a small eye-like detail, warm near-black surfaces, an acid-lime signature accent, editorial typography, and product-driven illustrations. Simplified character illustrations were drawn for this site and are not screenshots of the running application.
