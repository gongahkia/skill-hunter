# Firefox Submission Package

This directory defines the exact AMO submission artifacts for `Skill Hunter`.

## What You Upload to AMO

Upload these two files for the Firefox submission:

1. The built add-on package:
   - `submission/firefox/artifacts/skill-hunter-firefox-v2.0.0.xpi`
2. The readable source code package:
   - `submission/firefox/artifacts/skill-hunter-firefox-source-v2.0.0.zip`

Paste the reviewer notes from:

- `submission/firefox/reviewer-notes.md`

## How To Generate the Artifacts

From the repository root:

```bash
npm install
make firefox-submit-prep
```

That command creates both upload artifacts in `submission/firefox/artifacts/`.

## Build Instructions for Mozilla Reviewers

This add-on uses webpack and TypeScript, so AMO reviewers must be able to reproduce the `dist/` build from source.

Verified build environment used for this repository:

- macOS 26.2
- Node.js 20.19.5
- npm 11.11.1

Build steps:

```bash
npm install
npm run build
```

Expected output:

- `dist/manifest.json`
- `dist/content.js`
- `dist/popup.js`
- `dist/popup.html`
- `dist/styles/popup.css`
- `dist/local_asset/*`

Reviewer notes:

- The extension is single-purpose and works only on supported `sso.agc.gov.sg` legislation pages.
- Whole Document mode is required before the simplify action succeeds.
- No remote code is loaded.
- No analytics or off-device data transmission occurs.
- The current release has no background worker and no persistent settings storage.
- The manifest includes Firefox's built-in data-consent declaration with `browser_specific_settings.gecko.data_collection_permissions.required = ["none"]`.

## Why This Source Zip Is Curated

The source package intentionally excludes non-build artifacts and unrelated platform materials such as:

- Safari project files
- presentation assets
- roadmap notes not needed for build reproduction
- legacy or archived code removed during the audit

The exact included paths are listed in `submission/firefox/source-files.txt`.

## Automated Lint Status

`web-ext lint -s dist` now passes with `0` errors.

The current linter still reports `3` warnings:

- Two version-support warnings related to `browser_specific_settings.gecko.data_collection_permissions`, even though the manifest minimums are already set to Firefox `140.0` on desktop and `142.0` on Android.
- One unsafe-fragment warning for `src/content.ts`, where the simplified overlay is assembled from extension-generated markup.

Reviewer context for the fragment warning:

- Page-derived text is escaped before markup assembly in `src/core/contentProcessor.ts`.
- The generated fragment is mounted only inside the extension-owned Shadow DOM overlay.
