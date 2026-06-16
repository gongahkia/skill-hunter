# Store Listing Drafts

Status: draft copy only. These payloads are not submitted yet.

## Chrome Web Store

| Field | Draft |
| :--- | :--- |
| Name | Rakuzaichi |
| Summary | Local AI-chat memory vault with search, exports, Obsidian sync, backups, and open-thread extraction. |
| Category | Productivity |
| Language | English |
| Homepage URL | `https://github.com/gongahkia/rakuzaichi` |
| Support URL | `https://github.com/gongahkia/rakuzaichi/issues` |
| Privacy policy URL | `https://github.com/gongahkia/rakuzaichi/blob/main/PRIVACY.md` |
| Package | `rakuzaichi-chrome.zip` |

### Description

Rakuzaichi is a zero-server browser-extension vault for AI chats.

Capture conversations from supported LLM platforms into a local IndexedDB vault, then search, tag, pin, folder, export, sync, and back up your archive without a Rakuzaichi backend.

Key features:

- Local capture for ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Grok, Copilot, Mistral, HuggingChat, Poe, Kimi, Qwen/Tongyi, ChatGLM, Doubao, and NotebookLM.
- Unified local vault with cross-platform search.
- Open-thread layer for TODO/FIXME/REF/PROMPT follow-ups.
- Optional local extraction with browser-side Transformers.js or Chrome built-in Prompt API when available.
- Exports to Markdown, JSON, CSV, TSV, HTML, and PDF.
- Obsidian Markdown sync plus ZIP fallback.
- Encrypted vault backups.
- No Rakuzaichi account, backend, telemetry, analytics, or broad `<all_urls>` permission.

### Permission Justification

- `storage`: saves local settings, vault metadata, export history, and sync state.
- `downloads`: saves user-requested exports and backups.
- `alarms`: schedules local auto-export and capture-sweep jobs.
- Host permissions: exact supported LLM origins only, used to read chat DOM content when the user visits those pages.

### Screenshot Set

1. `asset/reference/demo.gif`
2. `asset/reference/1.png`
3. `asset/reference/2.png`
4. `asset/reference/3.png`
5. `asset/reference/architecture.png`

## Firefox AMO

| Field | Draft |
| :--- | :--- |
| Name | Rakuzaichi |
| Summary | Local AI-chat memory vault with search, exports, Obsidian sync, backups, and open-thread extraction. |
| Category | Productivity |
| License | Not specified in repo. |
| Homepage URL | `https://github.com/gongahkia/rakuzaichi` |
| Support URL | `https://github.com/gongahkia/rakuzaichi/issues` |
| Privacy policy URL | `https://github.com/gongahkia/rakuzaichi/blob/main/PRIVACY.md` |
| Package | `rakuzaichi-firefox.xpi` |
| Source package | `rakuzaichi-firefox-source.zip` |

### Description

Rakuzaichi captures supported AI chat sessions into a local vault and gives you searchable, portable ownership over the archive.

It supports local search, tags, folders, pinned chats, open-thread scanning, optional local extraction, Markdown/JSON/CSV/TSV/HTML/PDF exports, Obsidian sync, ZIP fallback, and encrypted backups.

Privacy posture:

- No Rakuzaichi server.
- No telemetry or analytics.
- Vault data stays in browser storage unless the user exports, syncs, or backs it up.
- Optional local extraction may download model files from Hugging Face Hub; chat content and prompts are not uploaded by Rakuzaichi.
- Host permissions are limited to supported LLM origins.

### Reviewer Notes

- Build Firefox package: `npm run package:firefox`
- Build source package: `npm run package:firefox-source`
- Run tests: `npm test`
- Check manifests and permissions: `npm run check:manifests && npm run check:permissions`

## Safari App Extension / App Store Connect

| Field | Draft |
| :--- | :--- |
| App name | Rakuzaichi |
| Subtitle | Local AI-chat memory vault |
| Category | Productivity |
| Bundle ID | `com.gabrielongzm.rakuzaichi` |
| Privacy policy URL | `https://github.com/gongahkia/rakuzaichi/blob/main/PRIVACY.md` |
| Support URL | `https://github.com/gongahkia/rakuzaichi/issues` |
| Source conversion | `npm run safari:convert` |

### Description

Rakuzaichi is a local-first archive for AI chats. Capture supported conversations into a browser vault, then search, organize, export, sync to Obsidian, and create encrypted backups.

The Safari extension uses the same zero-server architecture as the Chrome and Firefox builds:

- Chat capture happens on supported LLM pages.
- Vault storage is local to the browser profile.
- Export and backup files are created only by user action or configured local automation.
- No Rakuzaichi telemetry, analytics, or backend.

### Review Notes

- Convert Safari extension project: `npm run safari:convert`
- Configure signing in Xcode before archive.
- Store/TestFlight submission cannot be completed without an active Apple Developer account and App Store Connect access.
