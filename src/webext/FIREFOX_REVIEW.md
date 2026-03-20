# Firefox Review Build Notes

This file is included in the Firefox source-code submission bundle for Owl.

## Build Requirements

- Node.js 20+
- npm 10+
- `zip` available on the system path

## Firefox Compatibility

- The Firefox package declares `strict_min_version: "140.0"`.
- This avoids a separate legacy data-consent fallback implementation and uses
  Firefox's built-in `data_collection_permissions` install experience.

## Reproduce the Firefox Package

```bash
cd src/webext
npm ci
npm run check
npm test
npm run build
npm run lint:firefox
npm run prepare:firefox-submission
```

The generated AMO submission artifacts are written to:

- `src/webext/submission/firefox/owl-tags-firefox-<version>.zip`
- `src/webext/submission/firefox/owl-tags-firefox-source-<version>.zip`

## What the Firefox Package Contains

The Firefox extension package is built from `src/webext/dist/firefox/` only.
It contains:

- `manifest.json`
- `background.js`
- `content.js`
- `popup.html`
- `popup.css`
- `popup.js`
- `options.html`
- `options.css`
- `options.js`
- `icons/`

It does not include:

- legacy Apps Script targets
- Chrome or Safari bundles
- `node_modules`
- tests
- repository metadata

## Source Bundle Contents

The Firefox source-code package contains only the reviewable browser-extension
source and its build instructions:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vitest.config.ts`
- `FIREFOX_REVIEW.md`
- `FIREFOX_REVIEW_NOTES.md`
- `scripts/`
- `src/`
- `tests/`
- `assets/icons/`

## Data Flow Summary

- Owl stores settings and OAuth tokens locally in extension storage.
- Owl sends data only to Google-owned endpoints required for Google OAuth and
  Google Workspace APIs.
- Owl does not operate a backend, analytics service, or crash-reporting
  service.
- The extension does not ship a shared Google OAuth client ID; reviewers need a
  valid Firefox OAuth client ID in the options page to exercise live Google
  sign-in and document actions.

## Third-Party Code

- The shipped Firefox extension package contains no third-party runtime
  libraries.
- Build-time tooling is limited to public npm packages declared in
  `package.json` and pinned in `package-lock.json`.
