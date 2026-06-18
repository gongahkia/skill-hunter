# Adapter Contract

Status: final baseline for M9-M14 prose/import adapters.
Date: 2026-06-18

## Scope

This contract covers read-only imports from user-selected prose and communication sources into the existing local vault. Adapters normalize source content into chat-like snapshots so search, open threads, exports, backup/restore, deletion, and future local RAG can reuse current stores.

In scope:

- local files, user-owned archives, or explicitly selected API objects
- prose blocks, notes, documents, messages, and emails represented as immutable imported snapshots
- deterministic scanner pass before optional local LLM extraction
- per-import provenance, progress, cancellation, warnings, and recoverable errors

Out of scope:

- background crawls across accounts or workspaces
- write-back to source systems
- scraping web UIs or private browser APIs
- storing OAuth/API tokens in exported vault backups
- sending imported content to a server

## Snapshot Contract

Each imported unit becomes one vault `chat` row plus one or more `messages` rows. The unit boundary is adapter-specific and must be fixed in the adapter pivot doc before implementation.

Required `chat` fields:

| Field | Rule |
| :--- | :--- |
| `chatId` | Stable adapter-prefixed ID: `<adapter>:<source-kind>:<stable-source-id-or-hash>`. |
| `platform` | Adapter ID, for example `notion`, `google-docs`, `keep`, `slack`, `discord`, `email`, or `x-bookmarks`. |
| `title` | Source title/name, or deterministic fallback. |
| `url` | Source URL when available; otherwise empty string. |
| `capturedAt` | First import time for this snapshot. |
| `lastUpdatedAt` | Source modified time when available; otherwise import time. |
| `messageCount` | Count of normalized `messages` rows. |
| `metadata.adapter` | Adapter ID and adapter version. |
| `metadata.import` | Import-run ID, source path/object, package hash when file-backed, importedAt, warning count, and error count. |
| `metadata.provenance` | Source-specific identifiers needed to trace the snapshot back to its origin. |

Required `message` fields:

| Field | Rule |
| :--- | :--- |
| `messageId` | Stable ID within the imported snapshot; never depends on import time. |
| `id` | Same value as `messageId` unless an existing parser requires a source-local alias. |
| `chatId` | Parent imported snapshot ID. |
| `platform` | Same adapter ID as the parent `chat`. |
| `role` | `document`, `note`, `message`, `email`, `author`, `system`, or adapter-specific role documented in the pivot. |
| `content` | Plain text used by search, scanner, exports, and extraction. HTML/Markdown sources must also provide safe text. |
| `timestamp` | Source timestamp when available; otherwise importedAt. |
| `index` | Stable zero-based order within the snapshot. |
| `metadata.adapter` | Adapter ID and adapter version. |
| `metadata.provenance` | Source row/block/message IDs, original path/URL, author IDs, and attachment refs where available. |

Adapters may add metadata fields but must not require new top-level IndexedDB stores unless the pivot doc explicitly justifies why existing stores cannot preserve source identity, dedupe, progress, or provenance.

Shared helper for normalized imported rows: `src/imports/normalizer.js`.

## Schema Reuse Audit

Current vault stores are sufficient for M9-M14 imported prose snapshots:

| Existing store/path | Adapter use |
| :--- | :--- |
| `chats` | One imported document, note, channel/thread, mailbox group, or bookmark collection per snapshot. Adapter/source/package data lives under `metadata`. |
| `messages` | Ordered source blocks, notes, chat messages, emails, or posts. Source row IDs and raw refs live under `metadata.provenance`. |
| `openThreads` | Scanner and optional local extraction output keyed to normalized imported messages. |
| `extractionRuns` | Import-run audit rows using `modelName: "import"` plus adapter metadata. |
| `meta` | Reusable for cached indexes or adapter-level feature flags. |
| Vault search | Already indexes chat title/content/platform/url/tags from normalized snapshot data. |
| Export/backup | Existing envelopes already carry `messages`, `openThreads`, metadata, folders, and extraction runs. |

No new top-level IndexedDB stores are required for M9-M14 baseline imports. Adapter pivots may request one only after proving that existing `metadata`, `extractionRuns`, and content hashes cannot support the required provenance, dedupe, progress, or rollback behavior.

## Import Run Contract

Every import must create an import-run record. Until a dedicated store is justified, the run may be stored as an `extractionRuns` row with `modelName: "import"` and adapter metadata.

Shared helper: `src/imports/run-metadata.js`.

Required run fields:

| Field | Rule |
| :--- | :--- |
| `runId` | Stable prefix plus import time or package hash: `import:<adapter>:<id>`. |
| `chatId` | Snapshot ID for single-snapshot imports; empty string for package-level runs. |
| `modelName` | `import`. |
| `modelVersion` | Adapter ID plus adapter version. |
| `completedAt` | Completion, cancellation, or failure time. |
| `durationMs` | Wall-clock import duration. |
| `threadCount` | Number of scanner-created open threads. |
| `metadata.status` | `done`, `cancelled`, or `error`. |
| `metadata.source` | Source object/path/URL and source kind. |
| `metadata.packageHash` | Hash for file/archive imports. |
| `metadata.itemCounts` | Parsed, imported, skipped, updated, warning, and error counts. |
| `metadata.warnings` | Structured warning codes and display-safe messages. |
| `metadata.errors` | Structured recoverable errors; fatal errors must include one top-level message. |

The adapter pivot must define whether partial imports are kept or rolled back. If partial imports are kept, the run metadata must list completed snapshot IDs and skipped source IDs.

## Scanner And Extraction Order

Adapters must run `ThreadScanner.scanMessage(message)` on normalized rows before any local LLM extraction. Scanner-created rows use current `openThreads` semantics:

- `source: "explicit"`
- `subSource: "scan"`
- `status: "open"`
- `chatId` and `messageId` pointing at the normalized imported row

LLM extraction is optional and must be local. It must dedupe against scanner rows by message ID, tag, and normalized text before writing `openThreads`.

## Dedupe Contract

File-backed imports must hash the selected package or file content before write. API-backed imports must use source object IDs plus source updated timestamps or content hashes.

Shared helper: `src/imports/dedupe.js`.

Re-import behavior:

- same source identity and same content hash: skip without duplicating rows
- same source identity and changed content hash: update existing `chat`/`messages` rows and preserve stable IDs where possible
- deleted source rows in a newer import: keep existing imported rows unless the user chooses replace mode
- repeated scanner matches: skip duplicate `openThreads` rows by `threadId` or by message ID, tag, and normalized text

## Fixture Policy

Each adapter must ship synthetic fixtures before parser code is marked complete. Synthetic fixtures must cover happy path, empty source, malformed source, unsupported structures, duplicate source IDs, scanner tags, and large-input behavior.

Each adapter also needs at least one user-owned real fixture before parser behavior is marked complete. Real fixtures may be kept outside git if they contain personal data, but the adapter pivot must record:

- source product/export/API path
- acquisition date
- redaction status
- schema fields observed
- permission or account edge cases observed
- parser behavior verified against the fixture

No test may require private real fixtures in CI. If a real fixture cannot be committed, tests must use a redacted synthetic fixture derived from the observed schema and the pivot must state what could not be preserved.

## Progress, Cancel, And Error Contract

Long imports must expose progress as parsed/imported/total counts and current phase. Cancellation must stop new writes as soon as possible and record a recoverable partial run or roll back according to the pivot doc.

Shared helper: `src/imports/session.js`.

Errors must be structured:

- `code`: stable adapter-specific code
- `message`: display-safe user message
- `sourceRef`: path/object ID/message ID where available
- `recoverable`: boolean

Malformed entries should not fail an entire package unless the adapter cannot determine safe boundaries.

## Privacy Contract

Import UI and docs must state:

- imported archives may include other people's messages or sensitive account data
- imported content stays local unless the user exports, backs up, or syncs it
- exported vault backups must not contain OAuth/API tokens
- local LLM extraction is optional and runs after deterministic scanning
- source permissions can be revoked at the source service where applicable

Shared copy helper: `src/imports/privacy-copy.js`.

## Adapter Pivot Requirements

Before code starts for M9-M14, each pivot doc must specify:

- auth/input mode and why broader access is deferred or accepted
- supported source objects and explicit non-goals
- snapshot grouping policy
- fixture policy, including synthetic fixtures and at least one user-owned real fixture when needed to verify live/archive schema
- provenance fields
- dedupe keys
- progress/cancel behavior
- privacy copy
- rollback plan
- tests required before marking parser behavior complete
