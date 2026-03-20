# Dorso Public Store Release Guide

This guide documents the hardened public-store build. It does not replace the root `README.md`.

## Release Profile

The public-store release is intentionally narrow:

- local-only
- LeetCode-only challenge verification
- selected-site chatbot protection
- no backend sync
- no remote analytics
- no rehosted problem statements

The active extension source now lives under `src/extension` plus `src/shared`.
Legacy browser-specific implementations were moved to `archive/legacy-extension/` and are not part of the release build.

## Supported Chatbot Sites

- ChatGPT
- Perplexity
- Gemini
- Claude
- DeepSeek
- Copilot
- Socrat
- Hugging Face Chat
- WriteSonic Chat
- You.com
- Jasper

## Build Commands

From the repository root:

```bash
npm run build
```

This produces:

- `dist/chrome`
- `dist/firefox`
- `dist/safari`

To refresh the Safari wrapper’s embedded extension resources:

```bash
npm run build:safari-app
```

To run shared tests:

```bash
cd src/shared
npm test -- --runInBand --silent
```

## Chrome Submission Notes

- Package `dist/chrome` as the release ZIP.
- The store listing must clearly explain that Dorso only acts on the supported chatbot sites.
- The permission justification should say Dorso needs site access only to show a gate overlay on supported chatbot pages and watch LeetCode submission results on LeetCode problem pages.

## Firefox Submission Notes

- Package `dist/firefox` as the review upload.
- Keep the AMO reviewer notes explicit:
  - Dorso is local-only in this release.
  - It does not send browsing activity or user handles to a backend.
  - `browser_specific_settings.gecko.data_collection_permissions.required` is set to `["none"]`.
- If AMO asks for source review context, point reviewers to `AUDIT.md` and this file.

## Safari macOS Submission Notes

- The macOS wrapper project lives at `safari/DorsoSafari/`.
- Open the Xcode project:

```bash
open "safari/DorsoSafari/Dorso Safari/Dorso Safari.xcodeproj"
```

- Or refresh the embedded extension bundle first:

```bash
npm run build:safari-app
```

- Use your Apple Developer signing team before archiving.
- The wrapper app already includes:
  - enablement instructions
  - supported-site summary
  - local-only privacy summary
  - support and audit links

Before App Store submission:

- confirm the app bundle identifier and signing settings
- archive and validate from Xcode

## Privacy Summary

- The public-store build does not call the Dorso backend.
- It does not transmit chatbot URLs, Codeforces handles, install identifiers, or solve history off-device.
- It stores only local extension state:
  - staged challenge metadata
  - unlock timer timestamps
  - supported-site selections
  - pause state
- It reads LeetCode submission results locally to detect an accepted submission for the assigned problem.

## Reviewer-Facing Behavior Summary

- Dorso injects a full-screen gate only on enabled supported chatbot sites.
- Dorso leaves unsupported sites alone.
- Dorso stages a local challenge and links out to the official LeetCode page.
- Dorso unlocks after an accepted submission on that exact LeetCode challenge.
- Dorso stores timer and settings locally in extension storage.

## Future Non-Store Features

The backend and richer sync features are still present elsewhere in the repository for future work, but they are intentionally not part of this public-store build.

If they are reintroduced later, do not ship them without:

- a real install identity
- authenticated backend requests
- HTTPS-only endpoints
- production-safe CORS
- updated store disclosures
- a fresh policy review
