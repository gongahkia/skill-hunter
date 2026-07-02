# Dorso Firefox Source Submission

This file documents the source layout used for Firefox AMO review builds.

## Build Environment

- Node.js 18+ is sufficient.
- Dependencies are installed from `package-lock.json`.

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
- `schemas/`
- `scripts/build-extension.mjs`
- `scripts/validate-packs.mjs`
- `package.json`
- `package-lock.json`
- `README.md`

## Notes For Reviewers

- This Firefox build is local-only.
- It does not call any Dorso remote service.
- It requests only `storage` plus explicit host permissions for supported chatbot sites and LeetCode.
- `browser_specific_settings.gecko.data_collection_permissions.required` is set to `["none"]`.
