# M11 Google Keep Adapter Pivot

Status: accepted for M11 planning.
Date: 2026-06-18

## Decision

Build a Google Takeout importer for Keep. Do not scrape the Keep web UI, and do not ship a live Keep API importer in M11.

Rationale:

- Google documents Keep export through Takeout for user-owned downloads.
- Google describes the Keep REST API as an enterprise environment API for administrators/security workflows.
- Takeout keeps Rakuzaichi zero-server and avoids OAuth/domain-wide delegation for consumer imports.
- The exact Takeout file schema still needs a user-owned fixture before parser behavior is final.

## Input Mode

V1 input is local Takeout files/folders:

- Keep note JSON files if present.
- Keep note HTML files if present.
- Attachment files referenced by those note exports.

No live URL import is allowed in M11. Keep URLs and Keep web pages must be rejected with copy that points users to Google Takeout.

## API Caveat

The Keep API is deferred. A future pivot may accept it only for an explicit Workspace/admin use case with narrow scopes, no broad consumer OAuth assumption, and no credential persistence in vault exports or backups.

## Supported Objects

In scope:

- one snapshot per Keep note
- note title and body text
- checklist items
- labels
- color
- created and updated timestamps when present
- pinned and archived state when present
- deleted state if present in Takeout data
- collaborators when present
- attachment placeholders or local attachment refs according to the attachment policy
- source path, package hash, importedAt, adapter version, and parser warnings

Out of scope:

- scraping `keep.google.com`
- live Keep API import
- write-back to Keep
- remote attachment downloads
- exact visual layout
- guessing fields not present in the selected Takeout export

## Attachment Policy

M11 imports note text first. Attachments are not uploaded or downloaded.

- Local Takeout attachment files may be linked by relative path in provenance.
- Missing attachment files become recoverable warnings.
- Unsupported attachment types become visible placeholders in the imported note.
- Images, audio, and drawings are not embedded into message content until a later pivot accepts binary vault storage.

## Normalization

Each Keep note becomes one `chat` row:

- `chatId`: `keep:note:<source-id-or-hash>`
- `platform`: `keep`
- `title`: note title or deterministic fallback
- `url`: empty unless a source URL is present in export data
- `metadata`: adapter/import/provenance from `ImportNormalizer`

Each text block, checklist item, or attachment placeholder becomes one `message` row:

- `messageId`: stable note hash plus item index/path
- `role`: `document`
- `content`: deterministic plain text
- `timestamp`: source updated timestamp when present, otherwise importedAt
- `metadata.provenance`: source path, note ID/title, item path/index, labels, color, state flags, and attachment refs when present

The deterministic scanner runs before any local LLM extraction.

## Fixture Needs

Required user-owned fixture before parser completion:

- one Keep Takeout sample containing actual JSON/HTML fields
- labels, colors, timestamps, checklist notes, pinned/archive state, empty notes, and attachments where available
- redaction status and field inventory recorded in test notes

Synthetic fixtures may be added after the real schema is observed, but they must not invent unsupported fields as if verified.

## Error And Progress Model

Use shared import session behavior:

- progress by parsed/imported/total counts
- cancellation with recoverable partial import run
- malformed notes skipped where safe
- package hash for dedupe
- visible warnings for missing fields, missing attachments, unsupported attachment types, and unsupported note structures

## Rollback

M11 writes only normalized vault rows and import-run metadata. Rollback is deleting rows where `platform === "keep"` or `metadata.adapter.id === "keep"`, plus related `openThreads` and `extractionRuns` by `chatId`.

No schema migration is allowed for M11 unless a later pivot replaces this decision.

## Sources Checked

- `https://developers.google.com/workspace/keep/api/guides`
- `https://developers.google.com/workspace/keep/api/reference/rest`
- `https://support.google.com/keep/answer/10017039?hl=en-NZ`
- `https://support.google.com/accounts/answer/3024190?hl=en`
