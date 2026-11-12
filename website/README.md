# Companio marketing website

The public-facing website is **standalone** from the Electron desktop app. Its HTML, CSS, JavaScript, and vector illustrations live entirely inside this folder. It does not simulate native Windows actions, collect user data, or require an AI model.

## Live site

**[https://companio7.vercel.app](https://companio7.vercel.app)**

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

The two download buttons link **directly** to the published rc.24 ARM64 and x64 executable assets on GitHub Releases, with SHA-256 checksums in the release notes and no Actions artifact ZIP or GitHub login. Both installers include the verified offline speech engine and model; no separate Ollama setup is needed for supported basic commands. The preview note explains architecture selection, unsigned-installer warnings, and where to review the published checksums. The older v1.0.0 release remains available through the Other versions link. For future versions, verify that both assets exist before updating these URLs.

## Visual identity

The identity uses an original C-shaped emblem with a small eye-like detail, warm near-black surfaces, an acid-lime signature accent, editorial typography, and product-driven illustrations. Simplified character illustrations were drawn for this site and are not screenshots of the running application.
