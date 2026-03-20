# Firefox Submission Guide

This repository is ready for Firefox submission through AMO.

## Exact artifact to upload to AMO

Upload this file as the add-on package:

- `rakuzaichi-firefox.xpi`

Generate it with:

```bash
npm ci
npm run validate
npm run package:firefox
```

AMO accepts a zipped WebExtension package with `manifest.json` at the archive root. The generated `rakuzaichi-firefox.xpi` is that package.

## Exact source bundle to keep ready for AMO review

Because this repository uses a build step that transforms the submitted Firefox package, you should also provide a matching source code package when AMO asks whether source code submission is required.

Upload this file as the source package:

- `rakuzaichi-firefox-source.zip`

Generate it with:

```bash
npm run package:firefox-source
```

This source bundle includes:

- `src/`
- `scripts/`
- `test/`
- `package.json`
- `package-lock.json`
- `Makefile`
- `AUDIT.md`
- `README2.md`
- this file

## Build instructions for reviewers

AMO reviewers should be able to rebuild the Firefox package from the source submission with:

```bash
npm ci
npm run build:firefox
npx web-ext lint --source-dir dist/firefox
node scripts/package-firefox.mjs
```

The reviewer-facing built directory is:

- `dist/firefox`

The reviewer-facing packaged archive is:

- `rakuzaichi-firefox.xpi`

## What to select in the AMO submission form

### Upload Version

Upload:

- `rakuzaichi-firefox.xpi`

### Compatible platform

Recommended first submission:

- Firefox

Do not claim Firefox for Android unless you manually validate the add-on on Android and are willing to support it. The manifest includes an Android minimum version for compatibility metadata, but this repository has not been through a full Android QA pass.

### Source code submission

Select:

- `Yes`

Then upload:

- `rakuzaichi-firefox-source.zip`

Reason: the extension package is generated from source by custom build scripts, and Mozilla’s source submission guidance requires matching reviewable source and reproducible build steps when submitted code is machine-generated or transformed.

## Suggested AMO listing fields

### Summary

Export conversations from supported AI chat sites into local CSV, TSV, JSON, NDJSON, XML, or YAML files.

### Support website

Publish `README2.md` at a stable public HTTPS URL and use that URL.

### Privacy policy

Publish the privacy sections of `README2.md` at a stable public HTTPS URL and use that URL.

### Notes for reviewers

Use something close to the following:

> Rakuzaichi is a local-first export utility for supported AI chat sites. It does not transmit telemetry or analytics. The shipped Firefox build is generated with `npm run build:firefox`. A matching source bundle with build instructions is attached as `rakuzaichi-firefox-source.zip`. Auto-export is optional, disabled by default, and only attempts to export the active supported tab by opening the browser save flow.

## Current Firefox-specific implementation

- Firefox package root: `dist/firefox/`
- Firefox manifest customization: `scripts/build.mjs`
- Firefox lint command: `npm run lint`
- Firefox package creation: `scripts/package-firefox.mjs`
- Firefox source package creation: `scripts/package-firefox-source.mjs`

## Final pre-submit checklist

- `npm run validate` passes
- `npm run package:firefox` generated `rakuzaichi-firefox.xpi`
- `npm run package:firefox-source` generated `rakuzaichi-firefox-source.zip`
- `README2.md` has been published at a public HTTPS URL
- AMO listing text matches the actual permission set and supported-site matrix
- You do not claim Android compatibility unless you tested it

## Mozilla source references

- [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/)
- [Add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)
