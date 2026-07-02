# Dorso Firefox Source Submission

This file documents the source layout used for Firefox AMO review builds.

## Build Environment

- Node.js 18+ is sufficient.
- Dependencies are installed from `package-lock.json`.

## Build Command

From the repository root:

```bash
npm run package:release
```

## Expected Output

The Firefox review artifacts are generated into:

```bash
dist/artifacts/dorso-<version>-firefox.zip
dist/artifacts/dorso-<version>-source.zip
```

The Firefox zip contains `manifest.json` at the root of the archive. The source zip is passed to AMO signing with `web-ext sign --upload-source-code`.

## Relevant Source Files

- `src/extension/`
- `src/shared/`
- `schemas/`
- `scripts/build-extension.mjs`
- `scripts/package-extension-release.mjs`
- `scripts/validate-packs.mjs`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/STORE_SUBMISSION.md`

## Notes For Reviewers

- This Firefox build is local-only.
- It does not call any Dorso remote service.
- It requests only `storage` plus explicit host permissions for supported chatbot sites and LeetCode.
- `browser_specific_settings.gecko.data_collection_permissions.required` is set to `["none"]`.
