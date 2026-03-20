# Dorso Firefox Source Submission

This source package corresponds to the Firefox add-on upload:

- `dorso-firefox-2.1.0-amo.zip`

## Build Environment

- Node.js 18+ is sufficient.
- No third-party build dependencies are required for the Firefox package build.

## Build Command

From the repository root:

```bash
npm run build:firefox
```

## Expected Output

The Firefox extension package is generated into:

```bash
dist/firefox
```

The upload artifact can then be packaged from the contents of `dist/firefox`, with `manifest.json` at the root of the archive.

## Relevant Source Files

- `src/extension/`
- `src/shared/`
- `scripts/build-extension.mjs`
- `package.json`
- `README2.md`
- `AUDIT.md`

## Notes For Reviewers

- This Firefox build is local-only.
- It does not call the Dorso backend.
- It requests only `storage` plus explicit host permissions for supported chatbot sites and LeetCode.
- `browser_specific_settings.gecko.data_collection_permissions.required` is set to `["none"]`.
