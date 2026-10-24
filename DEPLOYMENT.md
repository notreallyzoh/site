# Publish the portfolio on GitHub Pages

The repository is already connected to `https://github.com/notreallyzoh/site.git`. The current branch is `master`. Run Git commands from `D:\Who are you Zoh\Portfolio\site`, not its parent directory.

## First publication

1. Open the `notreallyzoh/site` repository on GitHub. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
2. In a terminal in this project's directory, review and commit the changes:

   ```powershell
   git status
   git add .
   git commit -m "Update portfolio showcases and configure GitHub Pages"
   git push origin master
   ```

3. Open the repository's **Actions** tab and wait for **Deploy portfolio to GitHub Pages** to finish. The deployment link also appears in **Settings → Pages**.
4. Your expected address is `https://notreallyzoh.github.io/site/`. Interlace lives at `https://notreallyzoh.github.io/site/showcases/interlace/index.html`.

The workflow supports pushes to `master` or `main`, plus manual runs from Actions. GitHub supplies the deployment base path automatically, so project URLs and a future configured custom domain use the appropriate asset paths.

## Later updates

Edit locally, run `npm run build`, commit and push. Each push to a configured branch rebuilds and publishes the portfolio. Do not commit `dist` or `node_modules`; Actions builds the site from the lockfile with `npm ci`.

## Local preview of the GitHub project path

```powershell
$env:PAGES_BASE='/site/'
npm run build
npm run preview -- --host 127.0.0.1 --port 4175
```

Open `http://127.0.0.1:4175/site/`. When finished, stop the preview and run `Remove-Item Env:PAGES_BASE` to restore the normal root-path development setup.

## Included and external features

- Portfolio, media, résumé, Shroom Sabha demo and Interlace are static files included in the deployment.
- Interlace needs internet access for its Three.js CDN dependency. Its optional image generation uses the visitor's own Stability AI key; no key is shipped.
- Other client websites remain external live links. Instagram originals remain linked alongside downloaded showcase media.
- The legacy local Spotify server integration is not used by this portfolio UI and is not deployed as a server by Pages.
- Keep licence and third-party notice files with the Interlace distribution.

No commit, push or remote deployment was performed during preparation.

Reference: https://vite.dev/guide/static-deploy.html#github-pages
