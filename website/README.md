# Companio marketing website

The public-facing website is **standalone** from the Electron desktop app. Its HTML, CSS, JavaScript, and vector illustrations live entirely inside this folder. It does not simulate native Windows actions, collect user data, or require an AI model.

## Preview locally

From the repository root:

```powershell
cd website
python -m http.server 4173
```

Then visit `http://localhost:4173`. Alternatively, serve this directory with any static file server.

## Deploy

Host the `website/` directory as a **static site** on Cloudflare Pages, Vercel, Netlify, or another static host. No install or build command is needed. The output directory is the site directory itself. The public site is deliberately isolated from the desktop app's `index.html` and Vite build so the Windows overlay, packaging, and native features remain unchanged.

Before announcing a public URL, set the deployment hostname and an absolute `og:image` asset if social link previews are needed. Release CTAs intentionally direct visitors to official GitHub Releases rather than assuming a specific installer exists.

## Visual identity

The identity uses an original C-shaped emblem with a small eye-like detail, warm near-black surfaces, an acid-lime signature accent, editorial typography, and product-driven illustrations. Simplified character illustrations were drawn for this site and are not screenshots of the running application.
