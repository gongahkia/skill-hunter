# Privacy Policy

Effective date: 2026-06-16

Rakuzaichi is a zero-server browser extension for capturing, searching, exporting, syncing, and locally extracting open threads from AI chat pages.

## Summary

- Zero user data leaves the device through Rakuzaichi. The extension has no Rakuzaichi backend and does not upload chat content, vault data, settings, tags, exports, backups, or extraction prompts to any third party.
- No telemetry. No analytics. No ads. No sale of data. No human review of user data.
- Transformers.js runtime and ONNX WASM assets are bundled in the extension package. When local extraction or semantic search is first used for a selected model/cache state, Transformers.js may fetch model files from Hugging Face Hub model hosting at `https://huggingface.co/` using paths like `{model}/resolve/{revision}/`; browser caching is enabled.
- Rakuzaichi does not request `<all_urls>` or `*://*/*`.
- Use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including Limited Use requirements.

## Data Processed

Rakuzaichi processes only data needed for its visible extension features:

- Chat page content from supported LLM pages when the user captures a conversation or enables capture sweep.
- Conversation metadata such as title, source URL, platform, model name when detected, timestamps, message IDs, and capture status.
- User-created vault data such as tags, folders, open-thread items, search index state, export history, backup history, and extension settings.
- Local extraction prompts and outputs used to identify TODO/FIXME/REF/PROMPT-style follow-ups.
- Local semantic-search chunks and vectors derived from vault messages. The current retrieval-only semantic index is held in memory while the options page is open.
- Optional Obsidian sync directory handles when the user selects a local vault folder.
- Optional backup files the user exports or imports.

## Storage

- IndexedDB stores the local vault.
- `chrome.storage.local` stores settings, export history, diagnostic status, and scheduled-capture configuration.
- Browser cache stores downloaded model files when local Transformers.js extraction or semantic search is used. Current semantic-search vectors are not persisted; if a later persistent vector index ships, it must remain local IndexedDB data.
- User-selected local folders may receive Obsidian Markdown sync output.
- User-selected download locations may receive Markdown, JSON, CSV, TSV, HTML, PDF, ZIP, or encrypted vault backup files.
- Encrypted vault backups use browser Web Crypto with PBKDF2-derived AES-GCM when the user supplies a password.

## Network Activity

Rakuzaichi itself does not transmit user chat content, vault data, settings, tags, backups, or extraction prompts.

The extension can cause these network-visible actions:

- Browser requests to the LLM websites the user is already visiting, under those websites' own terms and privacy policies.
- Optional first-use model-file downloads from Hugging Face Hub model hosting at `https://huggingface.co/` for local extraction or semantic search. These downloads are model/config/tokenizer assets, not user chats, vault text, vectors, or prompts.
- Chrome built-in Prompt API use, when available, runs through the browser-provided local model path exposed by Chrome.

## Permissions

| Permission | Use |
| :--- | :--- |
| `storage` | stores local settings, vault metadata, export history, and sync state. |
| `downloads` | saves user-requested exports and backup files. |
| `alarms` | schedules local auto-export and capture-sweep jobs. |

## Host Permissions

| Origin | Justification |
| :--- | :--- |
| `https://chat.openai.com/*` | captures chat content from legacy ChatGPT URLs. |
| `https://chatgpt.com/*` | captures chat content from ChatGPT. |
| `https://claude.ai/*` | captures chat content from Claude. |
| `https://gemini.google.com/*` | captures chat content from Gemini. |
| `https://perplexity.ai/*` | captures chat content from Perplexity bare-domain URLs. |
| `https://www.perplexity.ai/*` | captures chat content from Perplexity www URLs. |
| `https://chat.deepseek.com/*` | captures chat content from DeepSeek. |
| `https://grok.com/*` | captures chat content from Grok. |
| `https://copilot.microsoft.com/*` | captures chat content from Copilot. |
| `https://chat.mistral.ai/*` | captures chat content from Le Chat Mistral. |
| `https://huggingface.co/chat/*` | captures chat content from HuggingChat. |
| `https://poe.com/*` | captures chat content from Poe. |
| `https://kimi.com/*` | captures chat content from Kimi. |
| `https://chat.qwen.ai/*` | captures chat content from Qwen Chat. |
| `https://tongyi.aliyun.com/*` | captures chat content from Tongyi. |
| `https://chatglm.cn/*` | captures chat content from ChatGLM. |
| `https://doubao.com/*` | captures chat content from Doubao bare-domain URLs. |
| `https://www.doubao.com/*` | captures chat content from Doubao www URLs. |
| `https://notebooklm.google.com/*` | captures chat content from NotebookLM. |

## Sharing

Rakuzaichi does not sell, rent, transfer, or share user data. User data is used only to provide the extension's visible capture, vault, search, extraction, export, sync, backup, and settings features.

If a user manually exports a file, syncs to a local folder that is also managed by another app, imports a backup, or uploads an exported file elsewhere, that later handling is outside Rakuzaichi.

## User Controls

Users can delete extension data by removing Rakuzaichi or clearing the extension's site/storage data in the browser. Users can delete downloaded exports, backups, and Obsidian sync files from their filesystem. Current semantic-search vectors are deleted by closing the options page. Downloaded model files can be removed by clearing browser/extension cache or removing the extension profile data.

## Policy Sources

This policy is written for Chrome Web Store review expectations documented in:

- Chrome Web Store Program Policies: `https://developer.chrome.com/docs/webstore/program-policies/policies`
- Chrome Web Store Privacy Policies: `https://developer.chrome.com/docs/webstore/program-policies/privacy`
- Chrome Web Store User Data FAQ: `https://developer.chrome.com/docs/webstore/program-policies/user-data-faq`
