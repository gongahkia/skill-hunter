# Store Submission Runbook

## Build Artifacts

Run:

```console
npm ci
npm test
npm run validate:packs
npm run package:release
npx web-ext lint --source-dir dist/firefox
```

Expected v3.0.0 outputs:

- `dist/artifacts/dorso-3.0.0-chrome.zip`
- `dist/artifacts/dorso-3.0.0-firefox.zip`
- `dist/artifacts/dorso-3.0.0-source.zip`

## Chrome Web Store

Upload `dist/artifacts/dorso-3.0.0-chrome.zip` in the Chrome Web Store Developer Dashboard.

Privacy policy URL:

`https://github.com/gongahkia/dorso/blob/main/docs/PRIVACY.md`

Single purpose:

`Dorso protects selected AI chatbot sites behind a local coding challenge so developers add a deliberate-practice step before AI-assisted work.`

Permission justifications:

- `storage`: stores local challenge state, settings, timers, solve receipts, and optional CLI export settings. Data stays in browser extension storage.
- `downloads`: writes the optional local CLI status JSON file when the user enables CLI export. The file is saved under the browser Downloads directory.
- `alarms`: refreshes the optional local CLI status export while enabled. It does not wake the extension to transmit analytics.
- Supported chatbot host permissions: inject the gate only on user-selected supported chatbot domains. The gate reads local settings and does not transmit page content.
- `https://leetcode.com/problems/*`: detects accepted submissions for the assigned LeetCode challenge on the official problem page.
- `https://adventofcode.com/*` optional host permission: user-granted only; verifies completion on the official Advent of Code page or checks a locally saved answer hash.
- `https://dorso.dev/*` optional host permission: user-granted only; used for opt-in hosted badge and leaderboard flows. No prompt text, browsing history, chatbot page content, LeetCode submission text, or raw repository URL is sent.

Data disclosure:

- No automatic analytics, telemetry, account data, prompt collection, or browsing-history collection.
- Default extension flow has no Dorso remote-service dependency.
- Optional leaderboard submission sends only repo hash, anonymous install hash, score, longest run, and timestamp after explicit user action.
- Optional hosted badge encodes signed score state in the badge URL and does not store per-user badge state.

Release timing:

- Use a Monday-Wednesday submission window.
- From 2026-09-08 onward, avoid the first 2 days of any Chrome stable release cycle.

## Firefox AMO

Release tag pushes run:

```console
npx web-ext sign --source-dir dist/firefox --channel listed
```

The workflow also passes:

- `WEB_EXT_API_KEY`
- `WEB_EXT_API_SECRET`
- `--upload-source-code dist/artifacts/dorso-3.0.0-source.zip`
- `--artifacts-dir dist/amo`

Required repo secrets before the release tag:

- `WEB_EXT_API_KEY`
- `WEB_EXT_API_SECRET`
- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`
- `CF_HMAC_SECRET`

AMO reviewer notes:

- Firefox package: `dist/artifacts/dorso-3.0.0-firefox.zip`
- Source package: `dist/artifacts/dorso-3.0.0-source.zip`
- Firefox manifest declares `browser_specific_settings.gecko.data_collection_permissions.required` as `["none"]`.
- The source package includes `src/extension/`, `src/shared/`, `schemas/`, build scripts, privacy docs, and security docs.

## GitHub Release

Do not close the v3.0 release issue until all are true:

- `package.json` and `package-lock.json` are `3.0.0`.
- Signed tag `v3.0.0` exists on GitHub.
- Release workflow produced a signed Firefox `.xpi`.
- GitHub Release `v3.0.0` exists.
- Release assets include the signed `.xpi` and `dorso-3.0.0-source.zip`.
