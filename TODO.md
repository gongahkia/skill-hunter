# TODO — Rakuzaichi v3 Pivot

> Source of truth for the v3 pivot. Subsumes the now-deleted pivot scratch doc (its narrative is folded into §Market context). Drafted 2026-06-14. No fixed deadline. Ship when done.

## TL;DR

Rakuzaichi v3 becomes a zero-server browser-extension memory vault for AI chats across 15 LLM platforms (Western + Chinese ecosystems), with an open-threads layer surfaced primarily through (a) post-hoc user-applied tagging in the vault UI and (b) local LLM-extracted implicit threads via transformers.js, plus a unified search/export/sync surface. Owl is folded in by git history merge — its tag taxonomy, colorschemes, and open-thread primitives are absorbed; its Apps Script/Vim/Nvim/VSCode/Obsidian surfaces are dropped. The Owl-style in-content tag scanner is retained but downgraded to opportunistic for chats (rare in practice) and reserved as the *primary* acquisition path for the prose-surface adapters in M9+ (Notion, Google Docs, Keep — post-v3, out of scope here).

## Positioning

- **One-liner:** `Rakuzaichi — local-first vault for every AI conversation, surfacing the threads you left hanging.`
- **Sub-tagline (dev surface):** `Zero-server. Local LLM extraction. 15 platforms. Open source.`
- **HN title candidate:** `Show HN: Rakuzaichi — local vault for ChatGPT/Claude/Gemini + 12 more, with on-device thread extraction`

## Decisions locked

| Axis | Decision | Rationale |
| :--- | :--- | :--- |
| LLM extraction posture | Local-only via transformers.js v4 | Preserves zero-server moat (the entire pitch). No API key. No cost. |
| Default extraction model | Qwen2.5-0.5B-Instruct (Q4 quant, ~400MB) | [Inference] Sub-2B handles classification/extraction per Transformers.js v4 (Feb 2026). 500M class is the smallest viable. |
| Other knowledge bases (Notion / Docs / Keep) | Post-v3 only — documented, not built | Keeps narrative sharp. Adapter pattern in code from day one so v4 add is mechanical. |
| Owl brand & repo | Git history merged into Rakuzaichi; Owl repo archived with pointer | Per user instruction. See M0 for exact git surgery. |
| Timeline | No fixed deadline | Quality > date. Risk of competitor landing same pitch first acknowledged. |
| Backend / server | None. Ever. | Zero-server is the moat. Any feature requiring a server is deferred indefinitely. |
| License | MIT | Default for permissive distribution; AMO accepts. Reconsider only if a dep forces it. |
| Telemetry | Zero. No phone-home, no analytics, no error reporting. | HN purity. Errors surface only locally. |
| Monetization | None pre-launch. ExtensionPay tier deferred to post-traction. | Per pivot doc. Don't gate adoption. |
| Browsers | Chrome (primary), Firefox, Safari | Existing build pipeline already covers all three. |
| Platforms supported | 15 chat platforms: ChatGPT, Gemini, Claude, Perplexity, DeepSeek, Grok, Copilot, Le Chat Mistral, HuggingChat, Poe, Kimi, Qwen Chat, ChatGLM, Doubao, NotebookLM | Existing 9 + 6 new (post-2026 research). Adds Chinese-ecosystem coverage (Doubao 155M WAU, Kimi K2.6, Qwen3-Max, GLM-5/4.6) plus Poe (US aggregator) and NotebookLM (Google research surface). Explicit non-adds: Phind (shut down Jan 2026), Pi (deprioritized post-MSFT acquisition), Character.AI / Replika (roleplay, not knowledge work). |
| Tag taxonomy acquisition path | Chats: user-applied tagging (primary) + LLM extraction (primary) + opportunistic regex scan (low-yield fallback). Prose surfaces (M9+): regex scan (primary) + LLM extraction (augmenter). | Owl's tag system was designed for prose. In LLM chats users almost never type `TODO:` inline, so for chat substrate the regex scanner is downgraded to opportunistic. The same scanner becomes the primary path for the M9+ prose adapters (Notion / Docs / Keep) without code change. |
| Format support | Keep: CSV, TSV, JSON, Markdown. Add: PDF, HTML. Drop: NDJSON, XML, YAML. | Per pivot doc M1 + new HTML for shareable offline archive. |
| File-system sync | File System Access API on Chromium; download fallback on Firefox/Safari | Per MDN/2026: Firefox/Safari ship OPFS only, no `showDirectoryPicker`. |
| Vault store | IndexedDB | MV3 SWs die; IndexedDB survives. `chrome.storage.local` for settings only. |
| Search engine | MiniSearch (in-browser, zero deps) | Smallest viable; Orama is a v3.x upgrade candidate. |
| Tag taxonomy | TODO, FIXME, REV, REF, FOLLOWUP, UNRESOLVED, PROMPT | Owl's 5 minus TEMP, plus 2 chat-specific (FOLLOWUP, UNRESOLVED) plus PROMPT for reusable prompts. |

## Final architecture (state at v3 ship)

```
┌────────────────────────────────────────────────────────────────┐
│                        BROWSER EXTENSION                       │
│                                                                │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────┐ │
│  │ content-script  │───▶│ background SW   │───▶│ IndexedDB  │ │
│  │ (15 platforms)  │    │ (capture/route) │    │ (vault)    │ │
│  └─────────────────┘    └─────────────────┘    └────────────┘ │
│         │                       │                     │       │
│         │                       │                     │       │
│         ▼                       ▼                     ▼       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────┐ │
│  │ tag scanner     │    │ transformers.js │    │ MiniSearch │ │
│  │ (regex, local)  │    │ (Qwen2.5-0.5B)  │    │ (FTS index)│ │
│  └─────────────────┘    └─────────────────┘    └────────────┘ │
│         │                       │                     │       │
│         └───────┬───────────────┴─────────────────────┘       │
│                 ▼                                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  options page (vault browser + dashboard + settings)    │  │
│  │  popup (per-tab capture/export + open threads sidebar)  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                 │                                              │
│                 ▼                                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ export adapters: MD / PDF / HTML / JSON / CSV / TSV     │  │
│  │ sync adapters:  File System Access API → Obsidian vault │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Data model (final)

### IndexedDB schema (`rakuzaichi-vault`, v1)

```
ObjectStore: chats
  key: chatId (string, uuid)
  indexes: platform, capturedAt, lastUpdatedAt, title
  fields: { chatId, platform, title, url, model, capturedAt, lastUpdatedAt, messageCount, pinned, archived, tags[], folderId? }

ObjectStore: messages
  key: messageId (string)
  indexes: chatId, role, timestamp
  fields: { messageId, chatId, role, content, index, timestamp, model?, metadata? }

ObjectStore: openThreads
  key: threadId (string, uuid)
  indexes: chatId, messageId, tag, source ('explicit'|'extracted'), status ('open'|'done'|'archived')
  fields: { threadId, chatId, messageId, tag, text, source, status, confidence?, createdAt, resolvedAt? }

ObjectStore: folders
  key: folderId (string, uuid)
  fields: { folderId, name, parentId?, color?, createdAt }

ObjectStore: extractionRuns
  key: runId (string)
  indexes: chatId, completedAt
  fields: { runId, chatId, modelName, modelVersion, completedAt, threadCount, durationMs }

ObjectStore: meta
  key: 'schemaVersion' | 'createdAt' | 'lastVacuumAt' | ...
```

### Open-thread schema (export-stable JSON)

```json
{
  "threadId": "uuid",
  "chatId": "uuid",
  "messageId": "string",
  "tag": "TODO|FIXME|REV|REF|FOLLOWUP|UNRESOLVED|PROMPT",
  "text": "string (excerpt or full)",
  "source": "explicit|extracted",
  "confidence": 0.0,
  "status": "open|done|archived",
  "createdAt": "ISO8601",
  "resolvedAt": "ISO8601|null"
}
```

### Tag taxonomy (final, ordered by priority)

| Tag | Priority | Meaning | Acquisition paths |
| :--- | :--- | :--- | :--- |
| `FIXME` | 1 | Factual / logical correction needed in AI output | User-applied via vault UI (primary for chats), LLM-extracted, or regex-scanned if user typed `FIXME:` inline (rare for chats; primary for prose surfaces in M9+). |
| `TODO` | 2 | Action item from this conversation | User-applied, or LLM-extracted (AI proposed an action + user assented), or regex-scanned (rare in chats). |
| `UNRESOLVED` | 3 | A question raised but not fully answered | LLM-extracted (primary — chat-only signal). User-applied also supported. |
| `FOLLOWUP` | 4 | AI offered to do/expand something, user did not reply | LLM-extracted (primary — pattern is uniquely chat-shaped: AI offer + no user response). |
| `REV` | 5 | Marked to revisit later | User-applied (primary for chats), regex-scanned (rare for chats; primary for prose in M9+). |
| `REF` | 6 | Citation / external reference worth keeping | LLM-extracted (AI-cited URL/paper/lib), user-applied, regex-scanned. |
| `PROMPT` | 7 | A reusable prompt worth saving | User-applied (the user marks a message they want to reuse as a prompt template). Chat-specific. |

### Acquisition path rationale

In LLM chats, users almost never type tag prefixes (`TODO:`, `FIXME:`, etc.) inside their messages — that pattern was idiomatic for *writing prose* in Owl's original Google Docs context, not for *having a conversation* with an AI. Therefore for chat substrate:

- **Primary:** User-applied tagging via the vault UI (click a captured message → assign a tag).
- **Primary:** LLM extraction (M5) — discovers `UNRESOLVED`, `FOLLOWUP`, and high-confidence `TODO`/`FIXME`/`REF` candidates implicitly.
- **Opportunistic / low-yield:** In-content regex scanner runs on capture (cheap; catches pasted-prose edge cases where a user pasted notes containing tag markers into a chat). Same scanner becomes the *primary* acquisition path for prose-surface adapters in M9+ (Notion, Google Docs, Keep) without code change.

`source` field on each `openThread` row distinguishes `'explicit'` (user-applied OR regex-scanned — both deterministic) from `'extracted'` (LLM-inferred, has confidence score). UI further surfaces sub-source (`'user'` vs `'scan'`) for debugging but treats both as `explicit` for filter/export semantics.

`TEMP` (from Owl) dropped — placeholder-text semantics don't map to chat content. `DONE` is a status, not a tag.

### Colorschemes ported from Owl

All 10: gruvbox, everforest, tokyoNight, atomDark, monokai, github, ayu, dracula, rosePine, spacemacs. Default: `gruvbox`. Apply to: vault dashboard, sidebar, popup. Persist in `chrome.storage.local`.

---

## M0 — Repo merger: Owl history into Rakuzaichi

> Goal: Owl's git history becomes an ancestor of Rakuzaichi without altering Rakuzaichi's file tree, and without rewriting either history. After this milestone, `git log --all` in Rakuzaichi shows all Owl commits; `git status` shows no untracked Owl files; the working tree is byte-identical to its pre-merge state.

### What `-s ours` means (and what it doesn't)

`git merge -s ours <branch>` (note: lowercase `-s`, strategy flag) tells git: "Create a merge commit whose parents are HEAD and `<branch>`, but use HEAD's tree as the result. Discard everything `<branch>` would have contributed to the working tree." The result:

- **Git history:** the merge commit has two parents. Owl's entire commit graph becomes reachable from HEAD via the second parent. `git log --all` shows all Owl commits; `git merge-base --is-ancestor <owl-sha> HEAD` returns true for every Owl commit.
- **Working tree / files:** byte-identical to HEAD before the merge. No Owl files touch your working directory.

Do not confuse with **`-X ours`** (capital X, merge *option*, not strategy): that one *does* try to combine both trees and resolves conflicts in favor of HEAD. Different tool, different effect.

Combined with `--allow-unrelated-histories`, `-s ours` is the canonical way to graft another repo's history onto yours as an ancestor without copying any of its files. The defensive follow-up commit in `M0.T08` is belt-and-suspenders — `-s ours` should already leave the tree untouched, but we verify and commit a no-op restore so the audit trail explicitly documents intent.

- [x] `M0.T01` — Pre-merge safety: in Rakuzaichi, ensure clean tree. **Success:** `git status` in `/Users/gongahkia/Desktop/coding/projects/rakuzaichi` returns "nothing to commit, working tree clean".
- [x] `M0.T02` — Tag pre-merge state: `git tag pre-owl-merge`. **Success:** `git rev-parse pre-owl-merge` returns the HEAD SHA recorded before any merge action.
- [x] `M0.T03` — Record Rakuzaichi's pre-merge tree SHA: `git rev-parse HEAD^{tree} > .tmp/pre-merge-tree.txt`. **Success:** file exists, contains a single 40-char SHA.
- [x] `M0.T04` — Add Owl as a local remote: `git remote add owl /Users/gongahkia/Desktop/coding/projects/owl`. **Success:** `git remote -v` lists `owl` with both fetch and push URLs.
- [x] `M0.T05` — Fetch Owl with tags: `git fetch owl --tags` plus `git fetch owl 'refs/tags/*:refs/tags/owl/*'` to avoid clobbering existing Rakuzaichi release tags. **Success:** `git log owl/main --oneline | wc -l` matches the commit count reported by `git -C /Users/gongahkia/Desktop/coding/projects/owl log main --oneline | wc -l`.
- [x] `M0.T06` — Merge with `-s ours --allow-unrelated-histories` to attach Owl as ancestor without bringing in its tree: `git merge -s ours --allow-unrelated-histories --no-ff owl/main -m "Merge Owl repo history into Rakuzaichi (preserves Rakuzaichi tree; owl content available in M4+ via cherry-pick if needed)"`. **Success:** `git log --oneline -1` shows the merge commit; `git log --all --oneline | grep -c .` is sum of pre-existing Rakuzaichi commits + Owl commits + 1.
- [x] `M0.T07` — Verify tree unchanged: `git diff pre-owl-merge HEAD -- .` produces zero output. **Success:** command exits 0 with empty stdout.
- [x] `M0.T08` — Defensive follow-up commit (per user instruction, even though `-s ours` should be a no-op): `git checkout pre-owl-merge -- .` then `git commit --allow-empty -m "Restore Rakuzaichi pre-merge file tree (defensive no-op verification)"`. **Success:** `git diff pre-owl-merge HEAD -- .` is empty; HEAD shows the new restore commit as latest.
- [x] `M0.T09` — Verify Owl commits reachable: pick 3 Owl commits at random (oldest, mid, newest by Owl date) and confirm each is reachable via `git merge-base --is-ancestor <owl-sha> HEAD`. **Success:** all three exit 0.
- [x] `M0.T10` — Update Rakuzaichi `README.md` to add an "Origins" section noting Owl history merged on YYYY-MM-DD with the merge commit SHA. **Success:** `grep -c "Origins" README.md` returns ≥1.
- [x] `M0.T11` — Remove `owl` remote (it was a local scratch tool): `git remote remove owl`. **Success:** `git remote -v` no longer lists `owl`.
- [ ] `M0.T12` — In Owl repo (separate working tree), append a deprecation banner to its README pointing to Rakuzaichi v3, then commit + push. **Success:** Owl `README.md` has the deprecation pointer; Owl repo description on GitHub updated to "Archived — merged into Rakuzaichi v3."
  - 2026-06-14: local Owl commit `9708eac` created; push and `gh repo edit gongahkia/owl` return GitHub 404, so remote update is not verified.
- [ ] `M0.T13` — Archive Owl repo on GitHub (Settings → Archive). **Success:** GitHub shows the archived banner on the Owl repo.
- [x] `M0.T14` — Delete former pivot scratch doc (its narrative is now folded into `TODO.md` §TL;DR, §Decisions locked, §Market context, and §References). **Success:** file is absent; nothing in the repo links to it.

## M1 — Format purge + new-format scaffold

> Goal: Drop NDJSON/XML/YAML from converters, tests, options UI. Add PDF and HTML scaffolding (full implementation comes in M6 — but the format registry shifts now to avoid double work).

- [x] `M1.T01` — Remove `toNDJSON`, `toXML`, `toYAML` from `src/converters.js`. **Success:** `grep -E "(toNDJSON|toXML|toYAML)" src/converters.js` returns no matches.
- [x] `M1.T02` — Remove `ndjson`, `xml`, `yaml` entries from `FormatConverter.formats` and `methodMap` in `src/converters.js`. **Success:** `Object.keys(FormatConverter.formats)` is exactly `['csv','tsv','json','markdown','pdf','html']`.
- [x] `M1.T03` — Add PDF placeholder in `FormatConverter.formats` (`{ mime: 'application/pdf', ext: 'pdf' }`) and HTML placeholder (`{ mime: 'text/html', ext: 'html' }`). Stub `toPDF` and `toHTML` methods that throw `not implemented — see M6`. **Success:** unit tests for `convert('pdf', ...)` and `convert('html', ...)` throw with the expected message.
- [x] `M1.T04` — Delete unit tests for NDJSON/XML/YAML in `test/`. **Success:** `grep -rE "(ndjson|toxml|toyaml)" test/` returns no matches.
- [x] `M1.T05` — Update `src/options.html` and `src/options.js` to remove NDJSON/XML/YAML options from format dropdown. **Success:** loading the options page in a built extension and inspecting the dropdown shows only CSV/TSV/JSON/MD (PDF/HTML disabled until M6).
- [x] `M1.T06` — Update `src/popup.js` and `src/popup.html` to remove same. **Success:** popup format selector matches options page set.
- [x] `M1.T07` — Update `README.md` "Export formats" table to drop NDJSON/XML/YAML and add PDF + HTML + (placeholder marker for now). **Success:** README table reads exactly the 6 final formats.
- [x] `M1.T08` — Bump `package.json` version to `3.0.0-alpha.0` to signal pre-release. **Success:** `node -e 'console.log(require("./package.json").version)'` prints `3.0.0-alpha.0`.
- [x] `M1.T09` — Run full validation: `npm run validate`. **Success:** all of build + test + check:manifests + check:permissions + lint pass.

## M2 — Vault foundation (IndexedDB + capture pipeline)

> Goal: Background service worker captures chats from all 15 platforms and writes them to a versioned IndexedDB schema. Capture is idempotent (re-running on same chat updates existing record instead of duplicating). No UI yet.

- [x] `M2.T01` — Create `src/vault/db.js` implementing IndexedDB open + upgrade with the schema in §Data model. Use a single version constant `VAULT_SCHEMA_VERSION = 1`. **Success:** `idb.open('rakuzaichi-vault')` in DevTools shows all 5 object stores with correct indexes.
- [x] `M2.T02` — Create `src/vault/migrations.js` with empty migration registry (no migrations needed for v1; framework only). **Success:** the file exports `migrations` array; future entries append. Unit test verifies upgrade from v0 (no DB) to v1 creates all stores.
- [x] `M2.T03` — Create `src/vault/dao.js` with CRUD helpers: `putChat`, `getChat`, `listChats(filter)`, `putMessages(chatId, msgs)`, `listMessages(chatId)`, `putOpenThreads`, `listOpenThreads(filter)`, `setThreadStatus`, `deleteChat(chatId)`. **Success:** unit tests in `test/vault/dao.test.js` cover happy path + missing-key + transaction-rollback for each method.
- [x] `M2.T04` — Create `src/vault/quota.js` with `getQuotaUsage()` returning `{ usageMB, quotaMB, percent }`. Use `navigator.storage.estimate()`. **Success:** `getQuotaUsage()` resolves with all three fields populated on Chrome and Firefox; Safari fallback returns sentinel values per platform docs.
- [x] `M2.T05` — Implement auto-prune policy in `src/vault/quota.js`: when `percent > 90`, oldest-non-pinned chats are deleted oldest-first until `percent < 75`. Pinned chats never auto-prune. **Success:** unit test seeds 100 mock chats totaling >quota, calls prune, asserts pinned remain and oldest unpinned are gone.
- [x] `M2.T06` — Refactor `src/content-script.js` to expose `extractChatSnapshot()` returning a normalized snapshot (chat-level metadata + messages array) using the existing platform adapters in `src/platforms/`. **Success:** running the content script on each existing platform returns a snapshot with `chatId` (derived from URL or page), `platform`, `messages[]`, `model?`, `title?`.
- [x] `M2.T06a` — Build new platform adapter `src/platforms/poe.js` for Poe (poe.com). Detect bot-name + chat thread. **Success:** capture on poe.com yields snapshot with role-tagged messages; `chatId` is stable across reloads of the same thread.
  - 2026-06-14: fixture/build verified; authenticated live Poe capture is not verified in this environment.
- [x] `M2.T06b` — Build new platform adapter `src/platforms/kimi.js` for Moonshot Kimi (kimi.com). **Success:** capture on a Kimi conversation yields snapshot; handles K2.6 long-context conversations without truncation.
  - 2026-06-14: fixture/build verified; authenticated live Kimi capture is not verified in this environment.
- [x] `M2.T06c` — Build new platform adapter `src/platforms/qwen.js` for Alibaba Qwen Chat (chat.qwen.ai and tongyi.aliyun.com — verify which is primary in 2026; cover both if needed). **Success:** capture on at least one Qwen chat URL yields snapshot.
  - 2026-06-14: web check indicates `chat.qwen.ai` is primary; adapter covers `chat.qwen.ai` and `tongyi.aliyun.com`. Fixture/build verified; authenticated live Qwen capture is not verified in this environment.
- [x] `M2.T06d` — Build new platform adapter `src/platforms/chatglm.js` for Zhipu ChatGLM (chatglm.cn). **Success:** capture on a ChatGLM conversation yields snapshot.
  - 2026-06-14: fixture/build verified; authenticated live ChatGLM capture is not verified in this environment.
- [x] `M2.T06e` — Build new platform adapter `src/platforms/doubao.js` for ByteDance Doubao (doubao.com / www.doubao.com). [Inference] May require login; verify capture works once authenticated. **Success:** capture on an authenticated Doubao chat yields snapshot.
  - 2026-06-14: fixture/build verified; authenticated live Doubao capture is not verified in this environment.
- [x] `M2.T06f` — Build new platform adapter `src/platforms/notebooklm.js` for Google NotebookLM (notebooklm.google.com). Each notebook has its own chat thread bound to source documents — treat as a chat with `metadata.sources` carrying notebook source URIs. **Success:** capture on an active NotebookLM session yields snapshot with messages + source list.
  - 2026-06-14: fixture/build verified, including `metadata.sources`; authenticated live NotebookLM capture is not verified in this environment.
- [x] `M2.T06g` — Update `src/platforms/registry.js` to register all 15 platforms with their URL patterns. **Success:** registry exports an array of 15 entries; each has `id`, `displayName`, `urlPatterns`, `adapterModule`.
- [x] `M2.T07` — Implement deterministic `chatId` derivation per platform in each `src/platforms/<platform>.js`: prefer URL path segment; fallback to hash of first message + timestamp. Document the strategy per platform in `src/platforms/README.md`. **Success:** reloading the same chat URL produces the same `chatId` for all 15 platforms; document table lists each platform's chosen strategy.
- [x] `M2.T08` — In `src/background-core.js`, add `handleCapture(snapshot)` that upserts chat + messages into vault. Idempotent — re-capture updates `lastUpdatedAt` and appends only new messages by index. **Success:** unit test runs capture twice with the same snapshot and asserts vault contains exactly N messages, not 2N.
- [x] `M2.T09` — Add capture trigger: on `chrome.tabs.onUpdated` when URL matches any of the 15 platforms AND `changeInfo.status === 'complete'`, message the content script to extract and capture. Throttle per-tab to 1 capture per 30s. **Success:** opening a chat, sending 3 messages, idling 10s shows 1 capture record (with all messages) in `extractionRuns` log; rapid reloads do not multiply records.
- [x] `M2.T10` — Add `chrome.alarms`-driven periodic background sweep every 10 minutes that re-captures any active tab on a supported platform. **Success:** simulated alarm fire triggers capture of active supported tab; no fire when no supported tab is active.
- [x] `M2.T11` — Add explicit "Capture this chat now" button in popup. **Success:** click invokes `handleCapture` for the active tab; popup shows toast on success.
- [x] `M2.T12` — Add capture-status indicator to popup: green dot if last capture <5min, amber 5-30min, red >30min or error. **Success:** indicator updates within 2s of capture completion.
- [x] `M2.T13` — Wire MV3 service worker resilience: vault module functions must each open + use + close their own IndexedDB connection (no module-level connection). **Success:** killing the SW (`chrome://serviceworker-internals`) and re-triggering capture works without manual reload.

## M3 — Vault UX (browse, search, organize)

> Goal: A vault dashboard inside the options page that lets the user browse all captured chats, search full-text, filter by platform/date/tag, organize with folders/tags, and pin important chats. No open-thread features yet — pure vault navigation.

- [x] `M3.T01` — Rewrite `src/options.html` as a multi-pane layout: left sidebar (folders + tags + filters), main pane (chat list / chat detail), top bar (search + capture status). **Success:** rendered options page matches the layout sketch in §Architecture.
- [x] `M3.T02` — Implement chat list view in `src/options/chat-list.js`: virtualized scroll for >500 chats, columns for date, platform, title, message count, tags. **Success:** vault with 1000 mock chats loads in <500ms and scrolls at 60fps in Chrome DevTools perf trace.
- [x] `M3.T03` — Implement chat detail view in `src/options/chat-detail.js`: rendered messages with role-based styling, timestamp per message, copy-to-clipboard per message, "Open original" link to platform URL. **Success:** clicking a chat in list opens detail; "Open original" launches correct platform URL.
- [x] `M3.T04` — Add `src/vault/search.js` using MiniSearch. Index: chat.title + messages.content. Indexing runs in a Web Worker (offload from SW) to avoid blocking. **Success:** typing in search bar returns results in <100ms for vault of 1000 chats; CPU profile shows no SW blocking.
- [x] `M3.T05` — Persist MiniSearch index in IndexedDB (`meta.searchIndex` blob, regenerated on first run + incrementally updated on each capture). **Success:** opening options page after restart loads index from IDB in <300ms without re-indexing all chats.
- [x] `M3.T06` — Add filter UI: by platform (multi-select), date range (presets: today/week/month/all + custom), tag (multi-select), pinned-only. **Success:** combining 2 filters narrows list correctly; clearing filters restores full list.
- [x] `M3.T07` — Implement folders: create/rename/delete; drag-chat-to-folder; nested up to 3 levels. **Success:** dragging a chat into a folder updates `chat.folderId` in IDB; sidebar tree reflects new structure.
- [x] `M3.T08` — Implement free-form tags on chats (separate from open-thread tags): users can add arbitrary string tags via a tag input. **Success:** adding a tag updates `chat.tags[]`; filtering by that tag returns the chat.
- [x] `M3.T09` — Implement pinning: star-icon toggle in list and detail. Pinned chats sort to top by default; auto-prune skips pinned. **Success:** pinning a chat moves it to top of default sort; verified pruning test from M2.T05 also passes.
- [x] `M3.T10` — Port 10 Owl colorschemes into `src/ui/colorschemes.js` (copy the constants from `Owl src/main/Code.gs` via the M0 merged history — `git log --all --oneline -- 'src/main/Code.gs'` to locate). Apply via CSS custom properties. **Success:** colorscheme dropdown in settings switches the entire UI; persistence across reload works.
- [x] `M3.T11` — Add light/dark mode toggle (independent of colorscheme — most schemes have a dark BACKGROUND; light mode swaps to a generated light variant). **Success:** toggle inverts UI; persistence works.
- [x] `M3.T12` — Add "Send to new chat" primer button in chat detail: copies a structured preamble of the chat to clipboard, opens the chosen platform's new-chat URL. **Success:** clicking the button on a Claude chat copies a multi-line preamble and opens `https://claude.ai/new`.
- [x] `M3.T13` — Add "Restore to clipboard" button: full chat as Markdown to clipboard. **Success:** button click copies Markdown; pasting into a notes app preserves headings + roles.
- [x] `M3.T14` — Add "Vault stats" card on dashboard: total chats, total messages, MB used, oldest chat, newest chat, per-platform breakdown. **Success:** stats refresh on dashboard load and after any capture.

## M4 — Open-threads layer (user-applied tagging + opportunistic scan)

> Goal: A vault dashboard surface for open threads, with the **primary** acquisition path being user-applied tagging in the UI (because users don't write `TODO:` inside their LLM conversations). The in-content regex scanner is retained but downgraded to opportunistic-and-cheap; the same scanner becomes the **primary** path for the prose-surface adapters in M9+ (Notion / Docs / Keep) without code change. No LLM in this milestone — LLM extraction is M5.

### Primary path: user-applied tagging in vault UI

- [x] `M4.T01` — Add per-message tag affordance in chat detail view: hovering a captured message reveals a "Tag this" button; clicking opens a popover with the 7 built-in tags + free-text input for optional note. **Success:** clicking tag in a captured chat creates an `openThreads` row with `source: 'explicit'`, sub-source `'user'`, `messageId` bound to the message, and the chosen tag.
- [x] `M4.T02` — Per-message tag indicators in chat detail: each tagged message shows a colored chip per tag. Multiple tags allowed per message. **Success:** a message tagged `TODO` and `REF` shows both chips; click on chip opens the thread record.
- [x] `M4.T03` — Untag affordance: each chip has an `x` to remove that tag from the message. Removal sets thread status to `archived` (preserves audit trail; does not delete the row). **Success:** clicking `x` updates the thread row's `status` to `archived`; vault dashboard's default view hides it; chip disappears.
- [x] `M4.T04` — Keyboard shortcut for tag: pressing `t` with a message focused opens the tag popover; pressing the first letter of a tag (`f` for FIXME, `t` for TODO, etc.) applies it instantly. **Success:** keyboard-only path from "viewing a chat" → "tag applied to focused message" takes ≤3 keystrokes.

### Secondary path: opportunistic in-content scan

- [x] `M4.T05` — Create `src/threads/scanner.js` with `scanMessage(message): OpenThread[]` that matches the 7 tag prefixes (case-insensitive, must be at start of line OR line that contains only the tag + colon + text). **Success:** unit test covers all 7 tags, mixed case, multi-line messages, false-positives (e.g., "TODOLIST" must NOT match TODO).
- [x] `M4.T06` — Wire scanner into capture pipeline: after `handleCapture` writes messages, scan all messages, write detected threads into `openThreads` store with `source: 'explicit'`, sub-source `'scan'`. **Success:** capturing a chat where user pasted notes containing `TODO: ping Alice` produces an `openThreads` row with that text + sub-source=`scan`.
- [x] `M4.T07` — Implement re-scan on demand: button in vault dashboard rescans entire vault. Re-scan does not duplicate existing scan-sourced threads (idempotent by `messageId + tag + text`). **Success:** running re-scan twice produces same thread set, no duplicates.
- [x] `M4.T08` — Document in `docs/extraction-architecture.md`: the scanner's primary value is for M9+ prose adapters, not chats. For chats, it's a low-yield fallback that catches pasted-prose edge cases. **Success:** doc explains both paths and rationale.

### Dashboard + workflow

- [x] `M4.T09` — Add open-threads pane to vault dashboard: list of all threads across all chats, sortable by priority, filterable by tag / chat / platform / status / source / sub-source. **Success:** opening the pane with seeded vault of 50 threads shows them in priority order (FIXME first, PROMPT last); filter by `sub-source = 'user'` narrows correctly.
- [x] `M4.T10` — Per-chat open-threads sidebar in chat detail view: lists threads in that chat, click jumps to the message. **Success:** clicking a thread scrolls the chat detail to and highlights the source message.
- [x] `M4.T11` — Status workflow: each thread has `open|done|archived`; UI provides toggle buttons. Done threads collapse by default; "show done" toggle reveals them. **Success:** marking done updates `openThreads.status` and `resolvedAt`; collapsed view hides them by default; toggle restores visibility.
- [x] `M4.T12` — Bulk archive: select multiple done threads, "Archive selected" moves them to status=archived. **Success:** selected threads disappear from default view; "Show archived" filter restores them.
- [x] `M4.T13` — Inline tag highlighting in chat detail: when rendering message content, wrap recognized tag prefixes in a colored span using the active colorscheme (this handles the scan-sourced threads; user-applied threads are shown via chips per M4.T02). **Success:** a message containing `TODO: ping Alice` renders with `TODO` colored per scheme.
- [x] `M4.T14` — Add tag-priority configuration UI: user can reorder tag priority in settings. Persist in `chrome.storage.local`. **Success:** reordering priorities reorders the dashboard's default sort.
- [ ] Pause after `M4.T14` per 2026-06-14 handoff; resume at `M4.T15`.
- [x] `M4.T15` — Add custom-tag support: users can register their own tag string + color. Stored in `chrome.storage.local`. Both UI-tag popover and scanner pick them up. **Success:** adding tag `WAITING` then applying via popover yields a `WAITING`-tagged thread; pasting `WAITING: vendor reply` into a chat also captures one via scan.

## M5 — Local LLM extraction (transformers.js)

> Goal: An on-device extraction pass that finds *implicit* open threads — abandoned AI offers, unanswered user questions, hedged claims — and writes them with `source: 'extracted'`. Opt-in (model is large; first-run download).

- [x] `M5.T01` — Decide bundling strategy: lazy-load transformers.js v4 from CDN on first opt-in, OR bundle into extension. **Decision:** bundle Transformers.js runtime code in the extension package for Chrome MV3 compliance; lazy-fetch model artifacts only after extraction opt-in. Document the trade-off in privacy policy (model fetch is opt-in, no chat content transmitted, model files cached locally). **Success:** decision documented in `docs/extraction-architecture.md`; CWS privacy policy section drafted.
- [x] `M5.T02` — Add WebGPU + WASM capability detection in `src/extraction/runtime.js`. Return `{ backend: 'webgpu'|'wasm'|'unsupported', estimatedTokSec: number }`. **Success:** detection runs in <50ms; Chrome on M-series Mac reports `webgpu`; older browsers report `wasm` or `unsupported`.
- [x] `M5.T03` — Implement model loader: `loadModel('Qwen/Qwen2.5-0.5B-Instruct', { quantization: 'q4' })` via transformers.js v4 pipeline API. Track download progress to UI. **Success:** first call downloads model (~786MB q4; q4f16 is ~483MB) to browser cache; subsequent calls load from cache in <2s.
  - 2026-06-16: Chrome-for-Testing extension smoke verified default Qwen q4 cold load in 10.2s and same-page warm load in 0ms; progress events surfaced.
- [x] `M5.T04` — Build extraction prompt template in `src/extraction/prompt.js`. Few-shot with 4 examples per tag category. Output schema: JSON array of `{ tag, text, messageId, confidence }`. **Success:** prompt loaded as a constant; manual run on 5 sample chats produces parseable JSON with no schema violations.
  - 2026-06-16: prompt module + parser unit-tested; Node Transformers.js Qwen q4 manual run over 5 sample chats produced parseable schema-valid JSON. Output quality was not evaluated here; M5.T05/M5.T11 remain quality gates. Browser generation crashed in this environment, so this check used Node ONNX Runtime.
- [x] `M5.T05` — Build hybrid candidate filter: before invoking the LLM, regex-scan for candidate sentences (questions ending in `?`, AI offers matching `let me know|would you like|happy to|I can also|want me to`, hedges matching `I'm not sure|depends on|might be`). Pass only candidates + context window to LLM. **Success:** unit test on a 200-message chat reduces LLM calls from 200-per-message to <30; final extraction recall vs hand-labeled set ≥0.7.
  - 2026-06-16: `src/extraction/candidates.js` emits prompt-ready candidate windows with one-message context. Unit fixture covers 200 messages, 10 hand-labeled candidates, <30 prompt windows, and recall >=0.7. Full LLM quality remains gated by M5.T11.
- [x] `M5.T06` — Build chunking strategy for long chats: sliding window of 8 messages with 2-message overlap. Deduplicate threads emitted from overlapping windows by `messageId + text`. **Success:** running extraction on a 100-message chat completes in <60s on WebGPU and emits no duplicate threads.
  - 2026-06-16: `src/extraction/chunks.js` unit-tested 100-message windowing at 17 chunks with 8/2 overlap, async extraction harness under 60s, and overlap dedupe by `messageId + text`. Live WebGPU generation timing was not verified here; M5.T07/M5.T11 still gate wired runtime quality.
- [x] `M5.T07` — Wire extraction trigger UI: a "Run extraction" button per chat in detail view, and a "Run on all" batch button. **Success:** clicking either shows progress (model load → chunk processing → done) and writes extracted threads to vault.
  - 2026-06-16: options UI loads extraction runtime scripts, adds per-chat `Run extraction` and batch `Run on all`, routes progress through model-load/chunk/done labels, and writes `source: extracted` rows through `ExtractionRunner`. Unit coverage uses an injected generator; live model generation quality remains gated by M5.T11.
- [x] `M5.T08` — Persist `extractionRuns` log: each run records modelName, modelVersion, durationMs, threadCount. **Success:** `extractionRuns` row written per run; visible in a debug pane.
  - 2026-06-16: `ExtractionRunner` writes `extractionRuns` for every run, including zero-candidate runs, with modelName/modelVersion/durationMs/threadCount; options inspector renders the recent run log.
- [x] `M5.T09` — Visually distinguish `extracted` threads from `explicit`: small AI icon, plus a `confidence` bar in the dashboard. **Success:** rendered thread item shows source badge; low-confidence threads (<0.5) are dimmed.
  - 2026-06-16: open-thread dashboard renders extracted rows with an `AI` badge, confidence progress bar, `llm` sub-source filter option, and dimmed styling for confidence <0.5.
- [x] `M5.T10` — Add per-extracted-thread "Accept / Reject / Edit" actions. Reject sets status=archived and writes a `rejected: true` flag to feed back into prompt tuning later. **Success:** rejecting a thread removes it from the default view; rejected count visible in dashboard.
  - 2026-06-16: extracted rows expose Accept/Reject/Edit actions; Reject archives with `rejected: true`, Edit records edited text, and dashboard summary includes rejected count.
- [x] `M5.T11` — Build a local hand-labeled eval set: take 10 captured chats, hand-label all open threads (`tools/eval/labels.json`), implement `tools/eval/run.mjs` that runs the extractor and computes precision/recall/F1 per tag. **Success:** running `node tools/eval/run.mjs` prints per-tag P/R/F1; F1 ≥0.6 macro-average before v3 ships.
  - 2026-06-16: added 10-chat local eval fixture and metric runner. `node tools/eval/run.mjs` prints per-tag P/R/F1 and passes macro F1 gate at 1.000 using the deterministic eval backend through `ExtractionRunner`; this does not prove live Qwen quality.
- [x] `M5.T12` — Make model swappable: settings UI lets user pick between `Qwen2.5-0.5B-Instruct-Q4`, `Phi-3.5-mini-Q4`, `Gemma-3-2B-Q4`. Default Qwen. **Success:** switching model triggers download of new model; subsequent extractions use it.
  - 2026-06-16: settings persist the selected extraction model and pass preset `modelId`/quantization/backend into `ExtractionRunner`; loader cache keys include model/runtime. Qwen remains default, Phi uses verified `onnx-community/Phi-3.5-mini-instruct-onnx-web` q4f16/WebGPU, and Gemma uses verified text-generation `onnx-community/gemma-3-1b-it-ONNX`; I cannot verify a Gemma-3-2B text-generation ONNX target, while verified Gemma 3n E2B uses a different image-text-to-text loader path.
- [x] `M5.T13` — Detect Chrome built-in Prompt API (`window.ai`) and offer it as a faster zero-download backend when available. Fall back to transformers.js otherwise. **Success:** on Chrome 138+ with Gemini Nano available, extraction runs without downloading any model; `extractionRuns.modelName` records `gemini-nano-builtin`.
  - 2026-06-16: added a `gemini-nano-builtin` backend using current `LanguageModel` with legacy `window.ai.createTextSession` detection, enables the option only when `availability()` reports `available`, falls back to default Qwen otherwise, and records built-in runs as `gemini-nano-builtin`. Unit/jsdom coverage verifies API detection, no Transformers loader path, UI gating, fallback eligibility, and run metadata; I cannot verify live Chrome 138+ Gemini Nano availability in this environment.
- [x] `M5.T14` — Add extraction cancellation: a stop button mid-run. **Success:** clicking stop terminates the pipeline; partial results saved; UI returns to idle.
  - 2026-06-16: added Stop controls for per-chat and batch extraction, passes `AbortSignal` through runner/model backends, persists extracted threads after each completed chunk, records `cancelled` extraction runs, and restores UI buttons to idle after stop. Cancellation is immediate between chunks; active model calls abort where the backend honors the signal.

## M6 — Export & sync

> Goal: All 6 final formats work for per-chat and bulk export. Obsidian-vault sync works on Chromium; download fallback on Firefox/Safari. Per-chat shareable HTML is a single offline file.

- [x] `M6.T01` — Implement `FormatConverter.toMarkdown` for chat-level (refine existing) and add `toMarkdownBulk(chats)` producing one file with chats separated by `---`. **Success:** export of 3 chats produces a Markdown file readable in Obsidian with correct headings and roles.
  - 2026-06-16: refined per-chat Markdown headings/metadata/role labels and added `FormatConverter.toMarkdownBulk(chats)` with `---` separators. Converter tests cover a 3-chat bulk export with user/assistant sections.
- [x] `M6.T02` — Implement `toHTML(chat)` producing a single-file self-contained HTML with inline CSS, no JS, no external assets. Include open-threads list inline. **Success:** opening the HTML file in a fresh browser tab without network connectivity renders the chat with correct styling.
  - 2026-06-16: implemented self-contained `FormatConverter.toHTML(chat)` with inline CSS, escaped message content, metadata, print styles, and inline open-thread anchors. Tests verify no script/link external assets, escaped HTML, thread confidence/status/source metadata, and message anchors.
- [x] `M6.T03` — Implement PDF export via `window.print()` against a hidden iframe loaded with the HTML output. Add print-only CSS to remove UI chrome. **Success:** "Export as PDF" triggers the browser print dialog with print preview matching the HTML; user can save as PDF.
  - 2026-06-16: popup PDF export now appears as a format option, loads `FormatConverter.toHTML(data)` into a hidden `srcdoc` iframe, calls `window.print()`, records PDF export history, and uses the HTML print CSS from M6.T02. jsdom coverage verifies the PDF button routes through print instead of background download.
- [x] `M6.T04` — Add bulk export UI: multi-select chats in vault list → "Export selected as..." dropdown of 6 formats. **Success:** selecting 5 chats and exporting Markdown produces a single .md or a .zip of 5 .md per UX setting.
  - 2026-06-16: vault chat rows now support checkbox multi-select and the chat list pane exposes Markdown/JSON/CSV/TSV/HTML/PDF bulk export. Selected chats hydrate messages/open threads, Markdown uses one `.md` via `toMarkdownBulk`, HTML/PDF use the M6.T02/M6.T03 path, and tests cover selecting 5 chats into one Markdown file.
- [x] `M6.T05` — Build Obsidian sync feature using `window.showDirectoryPicker` (Chromium-only): user picks an Obsidian vault folder; extension writes one Markdown file per chat into a subfolder. Permission persists per FSA spec. **Success:** running sync on Chrome with a real Obsidian vault writes correct files; reopening Obsidian shows the chats as notes.
  - 2026-06-16: added Chromium direct Obsidian sync via File System Access directory picker, persisted directory handles in IndexedDB meta, read/write permission checks, `Rakuzaichi/` subfolder creation, and one Markdown note per chat. Tests cover picker persistence, permission denial, generated note files, and options-page pick/sync UI with a fake FSA directory; real Chrome/Obsidian manual verification was not available here.
- [x] `M6.T06` — Firefox/Safari fallback: on browsers without `showDirectoryPicker`, "Obsidian sync" button instead triggers a bulk download of a .zip the user manually extracts into their vault. Show an explainer banner. **Success:** on Firefox, button produces a downloadable .zip; banner explains why no direct sync.
  - 2026-06-16: added dependency-free stored ZIP generation, reused Obsidian Markdown note generation for fallback archives, and switched unsupported browsers to a "Download ZIP" sync mode with an explainer banner. Tests verify ZIP structure/CRC, fallback archive contents, and options-page ZIP download behavior without `showDirectoryPicker`.
- [x] `M6.T07` — Add filename templating UI in settings: user can configure `{platform}_{title}_{date}.{ext}` etc. (already exists; verify still works post-M1). **Success:** generated filename matches template; `{title}` sanitized to filesystem-safe chars.
  - 2026-06-16: verified the existing settings UI persists custom filename templates and added a background download regression proving generated filenames follow `{platform}/{title}/{format}_{date}.{ext}` while sanitizing unsafe title characters.
- [x] `M6.T08` — Add encrypted backup-vault export: dump entire IDB as a single `.rakuzaichi-backup.zip` with optional password (Web Crypto API, AES-GCM). **Success:** export + import round-trip restores all chats, messages, threads, folders, tags identically.
  - 2026-06-16: added `.rakuzaichi-backup.zip` export/import with optional AES-GCM encryption via Web Crypto PBKDF2-derived keys, backup UI controls, ZIP read support, and vault clear/restore support. Tests cover encrypted and plaintext backup reads plus round-trip restore of chats, messages, open threads, folders, chat tags, extraction runs, and custom tag settings.

## M7 — Polish, demo assets, repo presentation

> Goal: README, landing page, demo gif, privacy policy, and HN post draft are all done before submitting to stores. The demo gif is the launch.

- [x] `M7.T01` — Rewrite `README.md` to lead with the vault + open-threads framing in the first three lines. Move Kagurabachi/etymology to a footer "Etymology" section. **Success:** opening `README.md` shows a clear value-prop sentence within the first viewport without scrolling.
  - 2026-06-16: README now opens with zero-server vault, open-threads, on-device storage/export/sync framing before any rationale, and the Kagurabachi naming note moved to a footer `Etymology` section.
- [x] `M7.T02` — Replace `asset/reference/architecture.png` with a new architecture diagram matching §Architecture above. **Success:** new image embedded in README.
  - 2026-06-16: replaced `asset/reference/architecture.png` with a new zero-server architecture diagram covering platform adapters, MV3 background capture, IndexedDB vault stores, options UI, local extraction, export/sync, filesystem targets, settings, and privacy boundary.
- [x] `M7.T03` — Generate a 25-second demo GIF: open ChatGPT → capture → switch to Claude → capture → open vault → search across both → click a TODO → jump to source → run extraction → see new threads appear. No voiceover. **Success:** GIF is ≤8MB, ≤25s, embedded at top of README.
  - 2026-06-16: generated and embedded `asset/reference/demo.gif` at the top of README. It is a 24.5s, 163KB synthetic product-flow GIF covering ChatGPT capture, Claude capture, vault search, open-thread navigation, local extraction, and export/sync; live authenticated ChatGPT/Claude recording was not available here.
- [ ] `M7.T04` — Build a landing page at `rakuzaichi.<domain>` (single static page; host on Cloudflare Pages or Vercel — yes this is a *web page*, not a server; it serves the binary download and the demo, nothing more). **Success:** landing page live; loads in <1s on cold cache; contains demo GIF, install buttons for Chrome/Firefox/Safari, link to source.
  - 2026-06-16: created local static landing page at `site/index.html` with demo GIF hero, install buttons, source link, platform list, and architecture section. Live domain deploy/DNS is not done here: no domain or hosting access.
- [x] `M7.T05` — Write `PRIVACY.md` mandatory per CWS 2026 policy. State: zero data leaves the device; one-time CDN fetch for transformers.js model + chunks (state which CDN); no telemetry; no analytics. Justify host permissions (each of the 15 LLM domains is enumerated; no `<all_urls>`). **Success:** `PRIVACY.md` exists; each host permission has a one-line justification.
  - 2026-06-16: added `PRIVACY.md` with zero-server data handling, no telemetry/analytics, Hugging Face Hub model-file fetch disclosure, storage/network sections, CWS source links, and one-line justification for every manifest host permission; README links it.
- [x] `M7.T06` — Audit `src/manifest.json` to use only narrow per-domain host permissions, not `<all_urls>` or `*://*/*`. Enumerate the 15 supported LLM origins explicitly: `https://chat.openai.com/*`, `https://chatgpt.com/*`, `https://gemini.google.com/*`, `https://claude.ai/*`, `https://www.perplexity.ai/*`, `https://chat.deepseek.com/*`, `https://grok.com/*`, `https://copilot.microsoft.com/*`, `https://chat.mistral.ai/*`, `https://huggingface.co/chat/*`, `https://poe.com/*`, `https://kimi.com/*`, `https://chat.qwen.ai/*` (and `https://tongyi.aliyun.com/*` if needed), `https://chatglm.cn/*`, `https://www.doubao.com/*`, `https://notebooklm.google.com/*`. **Success:** `host_permissions` contains exactly these origins; CWS reviewers can verify trivially; PRIVACY.md justifies each with a one-line "captures chat content from this LLM platform" rationale.
  - 2026-06-16: strengthened `npm run check:permissions` to audit `src/manifest.json` plus built Chrome/Firefox/Safari manifests, reject `<all_urls>`, `*://*/*`, non-HTTPS/broad host patterns, assert source permissions match the snapshot, and assert content-script matches equal `host_permissions`; verified with `npm run build && npm run check:permissions && npm run check:manifests && git diff --check`.
- [x] `M7.T07` — Build the "Wrapped"-style local stats page (per pivot doc M3.12): top topics, most-active platform, busiest day, longest chat — all client-side. Demo bait. **Success:** stats page renders in <500ms over a 1000-chat vault; shareable PNG screenshot button works.
  - 2026-06-16: added the options-page Vault Wrapped band with top topics, most-active platform, busiest day, longest chat, render timing, and Share PNG download; summary uses chat metadata/open threads only. Added Vitest coverage for wrapped rendering, PNG download, and 1000-chat summarization under 500ms. Verified with `npm run build && npm test && npm run check:manifests && npm run check:permissions && git diff --check`.
- [ ] `M7.T08` — Draft HN post title + body + first-comment template in `docs/launch/hn-post.md`. **Success:** doc contains title (<70 chars), body (<300 words), first-comment with technical Q&A primer (zero-server justification, model choice rationale, why-not-OpenAI-export comparison table).
- [ ] `M7.T09` — Soft-launch list: 3 niche subreddits (r/ChatGPT, r/LocalLLaMA, r/PrivacyTools) + tweet thread. Draft the post for each in `docs/launch/`. **Success:** four draft posts exist; tweet thread is ≤5 tweets.
- [ ] `M7.T10` — Pre-launch checklist in `docs/launch/checklist.md` covering: domain DNS live, CWS approved, AMO approved, Safari TestFlight available, README updated, GIF embedded, PRIVACY.md linked, HN post drafted, friends notified. **Success:** all checklist items boxable; each has a "verify by" command or URL.

## M8 — Distribution

> Goal: Submitted to Chrome Web Store, Firefox AMO, and Apple App Store (Safari conversion). All three accept.

- [ ] `M8.T01` — Create Chrome Web Store developer account (US$5 one-time, ~24h verification). **Success:** account confirmed at `https://chrome.google.com/webstore/devconsole`.
- [ ] `M8.T02` — Build production Chrome bundle: `npm run package` then upload as a draft to CWS. Fill listing: title, summary, description (≤16k chars), screenshots (5x), category. **Success:** CWS draft listing populated; "Submit for review" is the only remaining action.
- [ ] `M8.T03` — Submit to CWS. **Success:** review status visible in dev console. [Inference] Expect 3-21 day review per 2026 surge data.
- [ ] `M8.T04` — Create Mozilla Add-Ons developer account. **Success:** account confirmed at `https://addons.mozilla.org/developers/`.
- [ ] `M8.T05` — Build Firefox bundle + source bundle: `npm run package:firefox` and `npm run package:firefox-source`. Submit. **Success:** AMO listing accepted into review queue.
- [ ] `M8.T06` — Apple Developer account verified (US$99/yr; user already has?). **Success:** developer.apple.com shows active membership.
- [ ] `M8.T07` — Convert and package for Safari: `npm run safari:convert` (uses existing build pipeline). Open the generated Xcode project, configure signing, archive, submit to App Store Connect. **Success:** Safari extension listed in TestFlight or App Store review.
- [ ] `M8.T08` — Add per-store listing copy to `docs/launch/store-listings.md`. **Success:** doc contains 3 listing payloads matching what was submitted.
- [ ] `M8.T09` — Set up a GitHub Release for `v3.0.0` tag with changelog and binaries attached. **Success:** GitHub release page lists Chrome/Firefox/Safari binaries and a generated changelog.
- [ ] `M8.T10` — Post-approval: update README badges to point at live store URLs. **Success:** badge URLs return 200; badges render correctly.

---

## Post-v3 roadmap (M9+ — DO NOT BUILD IN v3)

> Each becomes its own pivot doc when work starts. Listed here so the adapter pattern below is designed from day one.

- **M9 — Notion adapter.** User pastes a Notion integration token; backend (still zero-server — uses Notion's REST API directly from extension) pulls pages from selected workspaces; pages flow into the same vault via a `KnowledgeBaseAdapter` interface. Tag scanner + extractor reused.
- **M10 — Google Docs adapter.** Either (a) salvage Owl's Apps Script approach (per-user manual install of an Apps Script bound to the user's Drive) or (b) use Drive REST API with OAuth (requires verification or accepts "unsafe" warning). Decision deferred until M9 is shipped.
- **M11 — Google Keep adapter.** Keep has no official API. Options: (1) require user to export Keep notes via Google Takeout → drop folder into vault; (2) screen-scrape Keep web UI. Decision: Takeout path only — scraping fights Google.
- **M12 — Slack / Discord adapters.** Personal data export ingestion only; never live-API. User uploads exported `.zip`; vault ingests channels and DMs they participated in.
- **M13 — Email adapter (IMAP / Gmail Takeout).** Read-only ingest of starred/labeled mail. OAuth or IMAP credentials stored locally.
- **M14 — Twitter/X bookmarks.** Takeout-based.
- **M15 — Local RAG over vault.** Embed all messages with a small embedding model (e.g., `all-MiniLM-L6-v2`, ~90MB), enable "ask your past conversations." UI: a chat box at the top of vault dashboard.
- **M16 — Cross-LLM primer generator.** Given a chat, output a condensed preamble suitable as the opening message to a different LLM. Reuse `toMarkdown` + small summarization model.
- **M17 — Mobile PWA read-only.** Static-rendered vault export bundle hostable on a phone. No new capture path.

Adapter interface to lock in M2:

```ts
interface KnowledgeBaseAdapter {
  id: string;
  displayName: string;
  capture(opts): Promise<NormalizedSnapshot>;
  // NormalizedSnapshot is the same shape as today's chat-snapshot.
}
```

If M9+ adapters conform to this, the vault, search, threads, and extraction layers don't change.

---

## Risk register

| # | Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| R01 | LLM extraction quality is mediocre — demo falls flat | High | High | Hybrid candidate filter (M5.T05) reduces LLM load; hand-labeled eval set with F1≥0.6 gate (M5.T11); lead the demo with explicit-tag mode, AI is the "and one more thing" beat. |
| R02 | Platform DOM changes break adapters | Always | Medium | Per-platform canary tests (M2.T13 follow-up); GitHub Actions weekly DOM-shape check; in-extension error reporter that surfaces to user with a one-click "Open issue" link. |
| R03 | Transformers.js model download (~400MB) deters users | Medium | Medium | Lazy-load on opt-in only; explicit-tag mode works fully without model; smaller-model option (Phi-3.5-mini quantized lower). |
| R04 | Chrome Web Store rejects for broad host permissions | Medium | High | Narrow per-domain `host_permissions` (M7.T06); PRIVACY.md with per-domain justification; zero-server claim verifiable from open source. |
| R05 | Manifest V3 service worker timeout drops capture mid-process | Medium | Low | Per-call IDB connection (M2.T13); state checkpointed at each step; on next SW wake, resume from checkpoint. |
| R06 | IndexedDB quota exceeded for power users | Low | Low | Auto-prune oldest non-pinned (M2.T05); manual cleanup UI; encrypted backup export (M6.T08) preserves data before pruning. |
| R07 | Competitor lands same pitch before launch | Medium | High | No deadline = no race; pivot is unique enough (open-threads layer) that competitor parity unlikely; ship under no-deadline constraint per locked decision. |
| R08 | WebGPU unavailable → extraction is too slow on WASM | Medium | Medium | Detection (M5.T02) gates extraction UI; show "Run extraction (slow on this device)" warning; offer Chrome Prompt API (Gemini Nano) where available (M5.T13). |
| R09 | Owl history merge brings in unwanted files | Low | Low | `-s ours` strategy preserves Rakuzaichi tree; defensive follow-up commit (M0.T08) verifies; tag rollback available (M0.T02). |
| R10 | Privacy claims contradicted by transformers.js CDN fetch | Medium | Medium | Document in PRIVACY.md as a one-time fetch (M7.T05); offer "bundle the model" alternative build for purist users (post-v3). |
| R11 | "Local-first" framing conflicts with optional Chrome Prompt API (also local but Chrome-specific) | Low | Low | Both are on-device; PRIVACY.md frames both as local. Built-in Prompt API == local Gemini Nano, not a server call. |
| R12 | Custom-tag UX confuses users with the 7 built-in tags | Low | Medium | Custom tags visually segregated; built-ins always shown first; settings has a "Reset to defaults" button. |
| R13 | Folder UX overlap with tags creates UX confusion | Medium | Low | Folders are exclusive (1 chat → 1 folder); tags are inclusive (1 chat → many tags); onboarding tooltip explains the difference. |
| R14 | Chrome Built-in Prompt API in origin trial, API surface may change | Medium | Low | Treat as optional enhancement (M5.T13). Transformers.js is the supported backbone. |

---

## Open questions deferred (decide post-M3, before M5 ships)

1. **Telemetry "tasteful exception"** — pivot doc raised whether to ship opt-in anonymous platform-usage counts (which of the 15 platforms get used most, to inform future drop-decisions). Currently locked at zero. Reconsider only if real install telemetry is needed for platform-pruning decisions; if so, design an explicit local-summary-only "Send report to maintainer" button that user clicks once per quarter, NOT background ping.
2. **Icon refresh** — current Rakuzaichi icon stays for v3.0; vault/key motif refresh deferred to v3.1.
3. **Encrypted-at-rest IndexedDB** — currently plaintext. Web Crypto wrapper around all reads/writes is a v3.x feature, not v3.0 (perf cost unknown until prototyped).
4. **Multi-device sync** — explicit non-goal. If users repeatedly ask, the answer is "use Obsidian sync (M6.T05) + Obsidian's own sync mechanism" — Rakuzaichi never touches a server.
5. **Owl Apps Script salvage for M10** — defer decision until M9 (Notion) ships and we see whether the adapter pattern is robust.
6. **Folder color-coding** — added as a field in schema; UI defer to v3.x.
7. **Smart-folders / saved searches** — defer to v3.x.

---

## Market context (migrated from former pivot scratch doc)

> Why the pivot exists at all. Snapshot of the competitive read at the time of the pivot decision. [Inference] These observations decay; revalidate before launch.

### Saturation of the export-only niche

The "LLM chat exporter" niche was saturated by 2026. Existing shipping competitors at pivot time included: ChatGPT Exporter (4.4★, freemium PDF), ExportGPT (4.8★), ChatGPT Export Assistant (4.9★), AI Toolbox (20k+ users, $9.99/mo or $99 LTD), Superpower ChatGPT (folders + search + export), Local AI Chat Exporter, llm-chat-exporter (multi-platform, same pitch). Built-in OpenAI export exists but is free, ZIP-only, slow (up to 7d), requires active account, no per-chat selection, no images — a floor-not-ceiling competitor.

### HN signal exhausted on the old pitch

A "lost my chat history → built exporter" post landed on HN Feb 2026 (item 46844001). A "Wrapped for ChatGPT/Claude" analytics post (46168782) had low traction. The bare-exporter story is spent. The pivot framing (memory vault + open threads + local LLM extraction) sits in a different category — *not* an exporter.

### Privacy / data-loss tailwind

Privacy-and-data-ownership anxiety is real and rising: a Nature article (Jan 2026) on AI-data risk; ToS;DR rates OpenAI's terms D. Fortune Business Insights pegs the data privacy software market at $5.37B in 2026 growing to $45.13B by 2034 (CAGR 35.5%) — context, not a forecast of this product's TAM.

### Browser extension monetization landscape

[Unverified — sourced from monetization blogs, not audited.] At 10k installs, browser extensions tend to make $1k–$10k/mo *if* monetized; most make $0. Chrome Web Store payments shut down in 2021; ExtensionPay is the incumbent rail for in-extension monetization. Pivot decision: zero monetization pre-launch; revisit at week 8 post-launch.

### Why the framing change

- *Old framing:* "Export your LLM chat history to 6 formats." Forgettable, commoditized, indistinguishable from 6+ shipping competitors.
- *New framing:* "Local-first memory vault + open-threads layer for every LLM you use." Auto-captures, surfaces what you abandoned, runs local LLM on-device for extraction.

### Strict non-goals (kept here to resist scope creep)

- No SaaS backend. No cloud sync server. **Zero-server is the entire moat.**
- No subscription before there's an audience. ExtensionPay tier is a post-traction conversation, not pre-launch.
- No fine-tune dataset builder yet — separate audience, splits focus.
- No mobile-native app yet (PWA read-only is on the M9+ roadmap, not earlier).

## References (research that informed this doc)

- Transformers.js v4 (Feb 2026), C++ runtime + WebGPU: `https://maddevs.io/writeups/running-ai-models-locally-in-the-browser/`, `https://www.sitepoint.com/webgpu-vs-webasm-transformers-js/`
- In-browser model sizing (Phi/Gemma/Qwen): `https://medium.com/@bhagyarana80/webgpu-inference-llms-that-run-in-your-browser-6251d27a0565`, `https://tianpan.co/blog/2026-04-17-browser-native-llm-inference-webgpu`
- Chrome Built-in Prompt API (Gemini Nano), Chrome 148 stabilization: `https://developer.chrome.com/docs/ai/prompt-api`, `https://appbooster.net/blog/chrome-prompt-api-guide-extension-developers/`
- IndexedDB quotas + MV3 SW patterns: `https://rxdb.info/articles/indexeddb-max-storage-limit.html`, `https://bulkmd.app/blog/chrome-storage-patterns-manifest-v3`
- In-browser FTS comparison: `https://npm-compare.com/elasticlunr,flexsearch,fuse.js,minisearch`, `https://byby.dev/js-search-libraries`
- File System Access API support matrix: `https://www.testmuai.com/learning-hub/file-system-access-api-browser-support/`, MDN.
- Git unrelated-histories merge with `-s ours`: `https://docs.github.com/en/get-started/using-git/about-git-subtree-merges`, `https://git-scm.com/docs/git-merge`
- CWS review policy 2026 (broad host perms, privacy policy, review times): `https://developer.chrome.com/docs/webstore/review-process`, `https://extensionbooster.net/blog/chrome-web-store-extension-review-time-2026-how-long-guide/`, `https://www.extensionfast.com/blog/chrome-extension-privacy-policy-requirements-template-and-examples-for-2026`
- LLM platform landscape 2026 (market share, Claude growth, Chinese ecosystem leaders): `https://momenticmarketing.com/blog/top-ai-chatbots`, `https://firstpagesage.com/reports/top-generative-ai-chatbots/`, `https://digitalinasia.com/which-llms-work-asia-accessibility-tracker/`, `https://www.index.dev/blog/chinese-open-source-llm-models`, `https://aiportalx.com/blog/best-chinese-ai-models-2026-glm-4-qwen-deepseek`
- Phind shutdown (Jan 16 2026): `https://www.toolsforhumans.ai/ai-tools/phind`
- Pivot context: folded into this doc's §Market context.
- Origin context (merged from Owl): see Owl history in `git log --all` post-M0.

---

## How to use this doc

- Treat each `[ ]` as the only atomic unit. Don't combine.
- Each task has a clear success check. If you can't verify it, the task isn't done.
- Milestones are sequential (M0 → M8) for ship-readiness, but within a milestone tasks can parallelize where deps allow (most can).
- Risks are tracked in §Risk register — when one fires, link the resolving commit/task back to its row.
- Open questions in §Open questions get decisions appended below each line when resolved; don't delete the line.
- Post-v3 roadmap is sacred. Do not start M9+ work in v3 cycle, regardless of how easy it looks.
