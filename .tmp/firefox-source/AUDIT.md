# Rakuzaichi Store-Readiness Audit

## Scope

This audit covers the repository state required for public submission to:

- Chrome Web Store
- Mozilla Add-ons
- Safari App Store via a macOS Safari Web Extension wrapper

The root `README.md` was intentionally left unchanged. Store-facing and reviewer-facing documentation now lives in `AUDIT.md` and `README2.md`.

## Implemented remediation summary

### Packaging and manifests

- Added browser-specific build outputs in `dist/chrome`, `dist/firefox`, and `dist/safari`.
- Replaced the old copy-only packaging flow with `npm run build`, `npm run package`, `npm run lint`, and `npm run safari:convert`.
- Split background execution into:
  - `background-sw.js` for service-worker builds
  - `background-core.js` for shared logic
  - Firefox and Safari background document builds via `background.scripts`
- Tightened host permissions and content script matches from `*://` to `https://`.
- Removed unused `activeTab` and `scripting` permissions.
- Added top-level extension icons for store and Safari converter compatibility.

### Privacy and data handling

- Moved settings storage from `storage.sync` to `storage.local`.
- Added Firefox `browser_specific_settings.gecko.data_collection_permissions.required = ["none"]`.
- Added auto-export runtime status tracking in local storage.
- Kept the extension free of telemetry, analytics, remote code, and third-party scripts.

### UI and product-review changes

- Removed Parquet and Avro from the shipped UI and runtime.
- Removed the popup's external promotional footer link.
- Added explicit auto-export disclosure text in the options UI.
- Added a popup-side download fallback for browsers where the background downloads API is unavailable.
- Added a Safari macOS wrapper project with local onboarding/help/privacy content instead of the default minimal shell.

### Extractor quality

- Hardened text extraction to use `innerText` or `textContent`.
- Added role, timestamp, and message ID heuristics in `dom-utils.js`.
- Fixed Claude message IDs so each extracted message has a unique ID.
- Added fixture-backed extractor regression tests for all claimed chatbot integrations.

## Findings matrix

| Area | Previous risk | Remediation | Status |
| :--- | :--- | :--- | :--- |
| Firefox MV3 compatibility | `background.service_worker` only caused `web-ext lint` failure | Firefox build now uses `background.scripts` | Closed |
| Firefox submission metadata | Missing `data_collection_permissions` | Added in Firefox manifest build | Closed |
| Permission overreach | Unused `activeTab` and `scripting` permissions | Removed | Closed |
| Cloud-sync ambiguity | Settings used `storage.sync` | Moved to `storage.local` | Closed |
| Store UI mismatch | Placeholder Parquet/Avro controls shipped in popup | Removed | Closed |
| External-link review friction | Popup linked to an external personal site | Removed | Closed |
| Manual download portability | Background-only downloads path risked Safari/manual failures | Added popup fallback download flow | Mitigated |
| Scraper confidence gap | No fixture-backed tests for claimed sites | Added regression fixtures and tests for all supported platforms | Closed |
| Safari submission completeness | No wrapper app or onboarding/privacy UI | Added generated macOS wrapper project and help page | Closed |

## Permission rationale

### Chrome

| Permission | Why it is required |
| :--- | :--- |
| `downloads` | Saves exported files from the extension background flow |
| `storage` | Stores local settings, export history, and auto-export status |
| `alarms` | Schedules optional auto-export runs |

### Firefox

| Permission | Why it is required |
| :--- | :--- |
| `downloads` | Saves exported files from the extension background flow |
| `storage` | Stores local settings, export history, and auto-export status |
| `alarms` | Schedules optional auto-export runs |

### Safari

| Permission | Why it is required |
| :--- | :--- |
| `storage` | Stores local settings, export history, and auto-export status |
| `alarms` | Schedules optional auto-export runs |

Safari intentionally omits the `downloads` permission in the generated manifest. Manual exports use a popup-side file download fallback. If Safari lacks background download support, auto-export records a visible error state instead of failing silently.

## Supported site access

The shipped builds request website access only for the supported chat domains:

- `https://chat.openai.com/*`
- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
- `https://perplexity.ai/*`
- `https://www.perplexity.ai/*`
- `https://chat.deepseek.com/*`
- `https://grok.com/*`
- `https://copilot.microsoft.com/*`
- `https://chat.mistral.ai/*`
- `https://huggingface.co/chat/*`

## Extractor confidence table

All listed platforms are now covered by fixture-backed regression tests in `test/platforms.test.js`.

| Platform | Confidence | Notes |
| :--- | :--- | :--- |
| ChatGPT | Medium | Uses explicit author-role attributes when present, with fallback text-role heuristics |
| Claude | Medium | Unique message IDs fixed; still DOM-dependent |
| Gemini | Medium | Supports `#chat-history`, `chat-history`, and alternate query/response selectors |
| Perplexity | Medium | Supports `.message` and `ThreadMessage`-style layouts |
| DeepSeek | Medium | Supports primary container and alternate `MessageItem` layouts |
| Grok | Medium | Uses explicit role metadata when present, class-name heuristics otherwise |
| Copilot | Medium | Supports shadow-DOM path first, DOM fallback second |
| Mistral | Medium | Supports `data-role` and class-based fallback extraction |
| HuggingChat | Medium | Supports primary and alternate message selectors with model extraction |

These extractors remain sensitive to upstream UI changes. The current mitigation is regression coverage plus clearer store/documentation wording, not a claim of API-level durability.

## Validation commands

Run these before submission:

```bash
npm run build
npm test
npm run check:manifests
npm run check:permissions
npm run lint
npm run safari:convert
```

## Submission checklist

### Chrome Web Store

- Use the `dist/chrome` build or `rakuzaichi-chrome.zip`.
- Publish a privacy/support page using the content in `README2.md`.
- Match store listing permissions language to the rationale above.
- Do not claim Parquet, Avro, telemetry, cloud sync, or unsupported sites.

### Mozilla Add-ons

- Use the `dist/firefox` build or `rakuzaichi-firefox.xpi`.
- Keep AMO listing language aligned with `README2.md`.
- Maintain the Firefox minimum version generated by the build:
  - Desktop Firefox 140+
  - Firefox for Android 142+

### Safari App Store

- Open `safari/Rakuzaichi/Rakuzaichi.xcodeproj`.
- Set team signing, App Store metadata, and the public privacy/support URL based on `README2.md`.
- Review the wrapper app copy and App Store screenshots before submission.
- Keep store copy explicit that exports remain local and that website access is limited to supported chat domains.

## Reviewer notes

- Rakuzaichi is a single-purpose export utility for supported AI chatbot conversation pages.
- It does not inject ads, affiliate links, analytics, remote scripts, or tracking code.
- It does not claim affiliation with OpenAI, Anthropic, Google, xAI, Microsoft, Mistral, Hugging Face, or Perplexity.
- The extension processes page content only to produce user-requested local exports or optional scheduled exports configured by the user.

## Policy basis used for this audit

- Chrome: [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [Protect user privacy](https://developer.chrome.com/docs/extensions/mv3/user_privacy/)
- Firefox: [MDN background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background), [MDN browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings), [Extension Workshop add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)
- Safari: [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Converting a web extension for Safari](https://developer.apple.com/documentation/safariservices/converting-a-web-extension-for-safari), [Packaging and distributing Safari Web Extensions](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)
