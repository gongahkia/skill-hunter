# v3.0.0 Release Draft

Status: draft created. Do not publish until store submissions and the Safari release artifact are verified.

Draft release is discoverable by tag with `gh release view v3.0.0`.

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
- Privacy policy, launch copy, store listing drafts, demo GIF, landing-page source, and pre-launch checklist.

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

## Publish Commands

```console
git push origin main
git tag v3.0.0
git push origin v3.0.0
gh release create v3.0.0 rakuzaichi-chrome.zip rakuzaichi-firefox.xpi rakuzaichi-firefox-source.zip rakuzaichi-safari.zip --title "Rakuzaichi v3.0.0 - local AI-chat memory vault" --notes "$(cat docs/launch/release-v3.0.0.md)" --generate-notes --notes-start-tag 2.0.0 --draft --verify-tag
```

Do not publish the draft release until the Safari artifact decision is made.
