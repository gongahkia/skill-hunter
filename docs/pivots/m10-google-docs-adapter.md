# M10 Google Docs Adapter Pivot

Status: accepted for M10 planning.
Date: 2026-06-18

## Decision

Build a local export importer for selected Google Docs first. Live Drive Picker/OAuth is deferred until local parsing proves useful.

Rationale:

- Local import preserves Rakuzaichi's zero-server default and avoids OAuth token handling in the first Docs adapter.
- Google Takeout and Docs export flows already let users download their own data.
- Broad Drive scopes can require verification and increase user-data risk.
- If live API import ships later, it must use explicit user-selected files only.

## Input Mode

V1 input is local files/folders:

- Google Takeout archives containing Docs exports.
- User-exported Google Docs files.
- Drag/drop or file picker input.

Canonical parser order:

1. HTML export.
2. DOCX export.
3. Markdown export if available.
4. Plain text fallback.

HTML is preferred because it preserves headings, lists, links, tables, and placeholders without requiring OAuth.

## Live API Position

Deferred for M10 baseline.

M10.T07 outcome: live API import is not accepted for the M10 baseline, so no Picker/OAuth implementation ships. A future pivot must accept live import before adding any Drive API code, and that path must stay limited to explicit user-selected files.

If added later:

- Use Google Picker or equivalent explicit file selection.
- Use `drive.file` as the baseline scope.
- Do not crawl Drive folders or background-search Drive.
- Handle Drive export size limits by telling users to use Takeout/local export.
- Do not store OAuth refresh/access tokens in vault backups or exports.

Broad Drive scopes are out of scope unless a separate pivot accepts verification cost and user-data risk.

## Supported Objects

In scope:

- selected exported Google Docs documents
- one snapshot per document
- headings, paragraphs, lists, links, tables, comments if present in export, footnotes if present in export, image placeholders, empty docs, and long docs
- source file path/name, exported format, document title, source URL if present, package hash, importedAt, adapter version, and parser warnings

Out of scope:

- background Drive crawl
- live OAuth by default
- write-back to Docs
- Apps Script execution
- importing Sheets/Slides/Forms as Docs
- downloading remote images
- preserving exact visual layout

## Normalization

Each document becomes one `chat` row:

- `chatId`: `google-docs:file:<source-id-or-hash>`
- `platform`: `google-docs`
- `title`: exported document title or file name
- `url`: source URL when present in export metadata
- `metadata`: adapter/import/provenance from `ImportNormalizer`

Each block/paragraph/table row becomes one `message` row:

- `messageId`: stable file hash plus source node index/path
- `role`: `document`
- `content`: deterministic plain text
- `timestamp`: importedAt unless source metadata provides a modified time
- `metadata.provenance`: original file path, exported format, source node path/index, document title, and source URL if available

The deterministic scanner runs before any local LLM extraction.

## Fixture Plan

Synthetic fixtures:

- exported HTML with headings, paragraphs, links, lists, tables, image placeholders, comments if represented, long body, and empty body
- exported DOCX with equivalent structures
- malformed HTML/DOCX
- unsupported structures
- duplicate source IDs/package hashes

Required real fixture before parser completion:

- one user-owned exported Google Doc or Takeout sample
- may stay outside git if private
- pivot/test notes must record exact export format, fields observed, redaction status, and parser behavior verified

## Error And Progress Model

Use shared import session behavior:

- progress by parsed/imported/total counts
- cancellation with recoverable partial import run
- malformed entries skipped where safe
- package hash for dedupe
- visible warnings for unsupported tables/images/comments/footnotes where data cannot be represented

## Apps Script Reuse

Discard Owl Apps Script for M10 baseline. No Apps Script code ships by accident.

Reason: local Takeout/export parsing is simpler, avoids script authorization, and matches the zero-server/no-broad-OAuth baseline.

## Tests

Before parser behavior is complete:

- parser fixtures for HTML, DOCX, Markdown/plain text fallback if supported
- malformed file handling
- large file progress/cancel
- unsupported structures
- dedupe skip/update
- scanner output
- provenance on every imported row

## Rollback

M10 writes only normalized vault rows and import-run metadata. Rollback is deleting rows where `platform === "google-docs"` or `metadata.adapter.id === "google-docs"`, plus related `openThreads` and `extractionRuns` by `chatId`.

No schema migration is allowed for M10 unless a new pivot replaces this decision.

## Sources Checked

- `https://support.google.com/accounts/answer/3024190?hl=en`
- `https://support.google.com/docs/answer/9759608?hl=en-GB`
- `https://developers.google.com/workspace/drive/api/guides/api-specific-auth`
- `https://developers.google.com/workspace/drive/picker/guides/overview`
- `https://developers.google.com/workspace/drive/api/guides/manage-downloads`
