# v3.0.0 Release Draft

Status: draft created. Do not publish until store submissions and the Safari release artifact are verified.

Draft release is discoverable by tag with `gh release view v3.0.0`.

## Asset Alignment

The draft release assets were rebuilt from tag commit `e8d744e6c6f8c25903ee7ba0919773ef027a8be1` on 2026-06-18 and re-uploaded to GitHub Release `v3.0.0`. Remote asset digests verified with `gh release view v3.0.0 --json tagName,isDraft,url,assets`.

| Asset | SHA-256 |
| :--- | :--- |
| `rakuzaichi-chrome.zip` | `cf049b1cfaa2fe59542ee131bb9bf04f44d14e0567f9c436f62372250c3b5c9e` |
| `rakuzaichi-firefox.xpi` | `aafacd4cdb21bb7e0985f40f467f1ec7b6a98358d99790a1ce93908f53b974c6` |
| `rakuzaichi-firefox-source.zip` | `e80a8be2ea93e5d54e7df3c3ce9ba3dee2c4b9493a012a823e719b4ef85e9141` |
| `rakuzaichi-safari.zip` | `58f57141e2e64aef7063e45425f06b4360364d38b69f89cdd32f978e170839d5` |

## Tag

`v3.0.0`

## Release Title

Rakuzaichi v3.0.0 - local AI-chat memory vault

## Release Notes

Rakuzaichi v3 turns the project from a chat exporter into a zero-server memory vault for AI chats.

### Highlights

- Local IndexedDB vault for captured AI chats.
- Supported chat surfaces: ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Grok, Copilot, Mistral, HuggingChat, Poe, Kimi, Qwen/Tongyi, ChatGLM, Doubao, and NotebookLM.
- Cross-platform vault search, filters, folders, pinned chats, free-form tags, and stats.
- Open-threads workflow for TODO/FIXME/REF/PROMPT-style follow-ups.
- Local extraction path with browser-side Transformers.js model loading and Chrome built-in Prompt API fallback when available.
- Markdown, JSON, CSV, TSV, HTML, PDF, bulk export, Obsidian sync, ZIP fallback, and encrypted vault backups.
- Chrome/Firefox/Safari packaging paths.
- Privacy policy, launch copy, store listing drafts, demo GIF, and pre-launch checklist.

**Full Changelog**: `2.0.0...v3.0.0` at `https://github.com/gongahkia/rakuzaichi/compare/2.0.0...v3.0.0`

### Privacy

- No Rakuzaichi server.
- No telemetry or analytics.
- User chat/vault data stays local unless the user exports, syncs, or backs it up.
- Transformers.js runtime and ONNX WASM assets are bundled; model files may be fetched from Hugging Face Hub only when local extraction is used.
- Host permissions are explicit per supported LLM origin; no `<all_urls>`.

## Assets To Attach

- [x] `rakuzaichi-chrome.zip`
- [x] `rakuzaichi-firefox.xpi`
- [x] `rakuzaichi-firefox-source.zip`
- [x] `rakuzaichi-safari.zip` (unsigned local macOS Safari app ZIP; not an App Store/TestFlight artifact).

## Verification Before Publishing

- [x] `package.json`, `package-lock.json`, `src/manifest.json`, and Safari generated manifest are `3.0.0`.
- [x] `npm test`
- [x] `npm run check:manifests`
- [x] `npm run check:permissions`
- [x] `xcodebuild -project safari/Rakuzaichi/Rakuzaichi.xcodeproj -scheme Rakuzaichi -configuration Debug -destination 'platform=macOS' CODE_SIGNING_ALLOWED=NO build`
- [x] Main branch pushed to origin.
- [x] `v3.0.0` tag pushed.
- [x] GitHub Release created.
- [x] Chrome/Firefox/Safari binaries attached.
- [x] Release assets rebuilt from `v3.0.0` tag source and remote SHA-256 digests verified.

## Publish Commands

```console
git push origin main
git tag v3.0.0
git push origin v3.0.0
gh release create v3.0.0 rakuzaichi-chrome.zip rakuzaichi-firefox.xpi rakuzaichi-firefox-source.zip rakuzaichi-safari.zip --title "Rakuzaichi v3.0.0 - local AI-chat memory vault" --notes "$(cat docs/launch/release-v3.0.0.md)" --generate-notes --notes-start-tag 2.0.0 --draft --verify-tag
```

Do not publish the draft release until the Safari artifact decision is made.
