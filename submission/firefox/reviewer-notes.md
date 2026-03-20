Skill Hunter is a single-purpose browser extension for `sso.agc.gov.sg`.

What the add-on does:

- On supported Singapore legislation pages, after explicit user click, it opens a simplified reading overlay.
- It works only when the source site is already in Whole Document mode (`?WholeDoc=1`).
- Reverting removes the overlay and returns the original page unchanged.

What the add-on does not do:

- No remote code loading.
- No analytics or telemetry.
- No background worker.
- No persistent settings storage.
- No automatic redirects, reload loops, or page changes before user action.

Permissions and site access:

- Static site access only on:
  - `https://sso.agc.gov.sg/Act/*`
  - `https://sso.agc.gov.sg/SL/*`
  - `https://sso.agc.gov.sg/Bills-Supp/*`
- No `activeTab` or `tabs` permission is requested.
- `browser_specific_settings.gecko.data_collection_permissions.required = ["none"]` to declare no data collection for new AMO submissions.
- Minimum Firefox versions are set to 140.0 on desktop and 142.0 on Android to match Firefox support for that declaration.

How to reproduce the reviewed build:

```bash
npm install
npm run build
```

Expected built files:

- `dist/manifest.json`
- `dist/content.js`
- `dist/popup.js`
- `dist/popup.html`
- `dist/styles/popup.css`
- `dist/local_asset/*`

Source package notes:

- The uploaded source archive is intentionally limited to the build-relevant files needed to reproduce the browser extension.
- `package-lock.json` is included for reproducibility.
- Safari-specific project files are not part of the Firefox source package.
- `web-ext lint -s dist` currently reports no errors. It still emits one fragment-construction warning in `src/content.ts`; page-derived text is escaped before markup assembly in `src/core/contentProcessor.ts`, and the fragment is mounted only inside the extension-owned Shadow DOM overlay.
