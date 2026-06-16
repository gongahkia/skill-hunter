# r/PrivacyTools Draft

## Title

Zero-server AI chat archive: local vault, exports, and backups

## Body

I built Rakuzaichi as a local-first archive for AI chats.

It is a browser extension that captures conversations from supported LLM sites into IndexedDB, then lets you search, tag, pin, folder, export, sync to a local Obsidian folder, and create encrypted backups. There is no Rakuzaichi account, backend, telemetry, analytics, or cloud sync.

The extension asks for exact host permissions for supported chat sites instead of `<all_urls>`. The privacy policy enumerates every host permission and why it exists.

For local extraction, the Transformers.js runtime and ONNX WASM assets are bundled. If you opt into extraction, browser-side Transformers.js may download model/config/tokenizer files from Hugging Face Hub and cache them. Chat content and extraction prompts are not uploaded by Rakuzaichi.

Current supported surfaces: ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Grok, Copilot, Mistral, HuggingChat, Poe, Kimi, Qwen/Tongyi, ChatGLM, Doubao, and NotebookLM.

Source: https://github.com/gongahkia/rakuzaichi
Privacy policy: https://github.com/gongahkia/rakuzaichi/blob/main/PRIVACY.md

Feedback wanted: privacy-policy gaps, permission wording, and local backup defaults.

## Posting Notes

- Verify live subreddit rules before posting.
- Lead with the privacy policy, not the demo GIF.
