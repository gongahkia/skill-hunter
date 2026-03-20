# Dorso Store-Readiness Audit

This file tracks the public-store hardening work for Dorso. It intentionally lives outside the root `README.md`.

## Audit Scope

The repository was audited against the practical review surface for:

- Chrome Web Store
- Firefox Add-ons (AMO)
- Safari on macOS via an App Store wrapper app

The review-first objective for this first release is:

- Keep the extension local-only
- Keep the feature set narrow and easy to explain
- Remove broad permissions and remote telemetry
- Avoid rehosting third-party challenge statements

## High-Risk Findings And Status

| Finding | Risk | Status |
| --- | --- | --- |
| `webNavigation`, `tabs`, and `"<all_urls>"` in the active build | High review risk and broad warnings | Fixed in active build |
| `web_accessible_resources` exposed on `"<all_urls>"` | Unnecessary resource exposure | Removed from active build |
| Active extension pointed at `http://localhost:8000` | Production-broken and insecure | Removed from public-store extension flow |
| Backend identity used `runtime.id` as a per-user ID | Functionally wrong and privacy-hostile | Public-store flow no longer uses backend identity |
| Remote HTML rendered via `innerHTML` in gate UI | Security and policy risk | Replaced with local metadata-only display |
| No Safari packaging path | Safari distribution blocker | macOS Safari wrapper scaffold added |
| No Firefox data collection declaration | AMO submission blocker from November 3, 2025 onward | `required: ["none"]` added for Firefox build |
| Release bundle included redundant dev files | Reviewer confusion and noisy bundles | Bundle filter tightened |

## What Changed

### Extension Architecture

- The active extension is now a local-only build.
- The old navigation interception flow was replaced with a page-level gate overlay that only runs on explicitly supported chatbot sites.
- LeetCode verification remains local: Dorso watches LeetCode submission pages and unlocks only when the accepted result matches the assigned challenge slug.
- The popup is now the only control surface. It shows:
  - current protection status
  - the staged challenge
  - a pause/resume control
  - supported-site toggles
  - a short local-only privacy disclosure

### Permissions And Manifest Surface

- Removed `webNavigation`
- Removed `tabs`
- Removed `"<all_urls>"`
- Removed public `web_accessible_resources`
- Added explicit host scope for:
  - supported chatbot domains
  - `https://leetcode.com/problems/*`
- Added manifest icons and action icons
- Added Firefox `browser_specific_settings.gecko.data_collection_permissions.required = ["none"]`

### Packaging

- `dist/chrome`, `dist/firefox`, and `dist/safari` now build from the narrowed review-first manifest surface.
- `npm run build:safari-app` now refreshes the Safari wrapper resources from `dist/safari`.
- The old browser-specific trees were moved from `src/chrome` and `src/firefox` into `archive/legacy-extension/` so the active source tree has one authoritative extension implementation.
- The shared copy step no longer ships:
  - `package-lock.json`
  - `node_modules`
  - unused shared storage adapters
  - backend API helper files
  - unused shared modules
- A macOS Safari wrapper project now exists under `safari/DorsoSafari/`.

## Remaining Release Work

The repository changes are in place, but store submission still requires non-code work:

- Generate final store listing assets for Chrome, Firefox, and Safari/App Store.
- Sign and archive the Safari app in Xcode with a valid Apple Developer team.
- Package Chrome and Firefox release artifacts as submission ZIP/XPI uploads.
- Add store listing copy that clearly explains:
  - which sites Dorso touches
  - why it needs site access
  - that the public-store build is local-only
  - that unsupported sites are untouched

## Known Deliberate Deferrals

These features were intentionally deferred from the first public-store release:

- backend sync
- access logging
- user stats and history
- linked identities
- Codeforces verification
- practice deck

They can be reintroduced later behind an opt-in or non-store build, but they should not go back into the public-store build without:

- a real per-install identity model
- authenticated backend requests
- HTTPS-only transport
- production-safe CORS rules
- updated privacy disclosures
- new AMO data collection declarations

## Verification Checklist

Before submitting, confirm:

- `npm run build` succeeds
- `npm run build:safari-app` succeeds before opening Xcode
- `src/shared` tests pass
- Chrome manifest only requests `storage` plus explicit site access
- Firefox manifest includes `required: ["none"]` data collection permissions
- Safari wrapper opens and shows enablement/help content
- Dorso blocks only enabled supported sites
- solving the assigned LeetCode challenge unlocks the gated chatbot page for 15 minutes
