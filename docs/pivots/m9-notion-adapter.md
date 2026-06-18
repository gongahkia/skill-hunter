# M9 Notion Adapter Pivot

Status: accepted for M9 planning.
Date: 2026-06-18

## Decision

Build a read-only Notion page importer that normalizes selected pages and recursive child blocks into Rakuzaichi snapshots.

V1 auth supports user-supplied Personal Access Tokens and internal connection tokens. Public OAuth is deferred.

Rationale:

- Rakuzaichi is zero-server and local-first; OAuth token exchange, refresh, and app registration add product and credential scope before a single-user import path is proven.
- PATs fit trusted user-owned imports because they act as the user who created the token and use that user's existing Notion permissions.
- Internal connection tokens remain useful for team-owned workspaces, but imported pages must be explicitly shared with that connection.
- Both token types are bearer secrets and must never be stored in exported vault backups.

## Auth And Permissions

Input fields:

- Notion token: PAT or internal connection token.
- Page ID or Notion page URL.
- Optional import label/folder.

Token handling:

- Token is used only for the import run unless a future pivot approves persistence.
- Token is not written to `chats`, `messages`, `openThreads`, `extractionRuns`, backups, Markdown/JSON exports, or Obsidian sync output.
- UI copy must point users to Notion token revocation if access should be removed.

Permission model:

- PAT: can read pages the token creator can access, subject to token capabilities and workspace controls.
- Internal connection: can read only pages/databases explicitly connected to the integration.
- Missing share, revoked token, insufficient capability, and inaccessible page all become specific import errors.

## Supported Objects

In scope:

- selected Notion pages
- recursive first-party child blocks reachable from the selected page
- block text converted to plain text for scanner/search/export
- page title, page URL, page ID, block IDs, importedAt, adapter version, and parent/child provenance

Supported block families for synthetic fixtures:

- headings
- paragraphs
- bulleted lists
- numbered lists
- to-dos
- toggles
- code
- quotes
- links/rich text
- nested children
- empty blocks
- unsupported blocks as warning rows or skipped rows
- long pages

Out of scope for M9:

- database crawling/querying as a source selector
- comments
- file/media download
- resolving synced blocks beyond recording a warning
- page updates/write-back
- workspace search/crawl
- public OAuth

## Fetch And Rate Limits

Fetch behavior:

- Retrieve the selected page metadata first.
- Retrieve block children through `GET /v1/blocks/{block_id}/children`.
- Follow pagination until `has_more` is false.
- Recurse only into blocks that report children.
- Preserve block order with stable message indexes.

Rate-limit behavior:

- Queue requests at no more than Notion's documented average of 3 requests/second per connection.
- On HTTP 429 or 529, respect `Retry-After` when present and back off before retry.
- Record retry count and final rate-limit failure in import-run metadata.

## Normalization

Each selected page becomes one `chat` row:

- `chatId`: `notion:page:<page-id>`
- `platform`: `notion`
- `title`: Notion page title or `Untitled Notion page`
- `url`: Notion page URL when available
- `metadata`: adapter/import/provenance fields from `ImportNormalizer`

Each block becomes one `message` row:

- `messageId`: `notion:page:<page-id>:block:<block-id>`
- `role`: `document`
- `content`: deterministic plain text rendering of the block
- `timestamp`: block last edited time when available, otherwise importedAt
- `metadata.provenance`: page ID, block ID, parent block ID, block type, source URL/path if available

The deterministic scanner runs before any local LLM extraction.

## Fixture Plan

Synthetic fixtures:

- `test/fixtures/imports/notion/basic-page.json`
- `test/fixtures/imports/notion/nested-blocks.json`
- `test/fixtures/imports/notion/unsupported-blocks.json`
- `test/fixtures/imports/notion/long-page.json`
- `test/fixtures/imports/notion/errors.json`

Required real fixture before parser completion:

- one user-owned exported/API response set covering page metadata, recursive blocks, permission boundaries, and at least one nested child block
- may be stored outside git if private
- pivot/test notes must record observed schema fields and redaction status

## Errors

Required user-facing states:

- token missing
- token revoked/invalid
- insufficient token capability
- page not shared with internal connection
- page not found or inaccessible
- 404 access mismatch
- 429 rate limited
- 529 service overload
- network failure
- unsupported block skipped
- cancellation with recoverable partial import

## Tests

Before parser behavior is complete:

- pagination
- nested block recursion
- unsupported block warnings
- dedupe skip/update
- scanner output
- cancellation
- malformed response
- rate-limit retry
- large-page progress
- provenance on every imported row

## Rollback

M9 writes only normalized vault rows and import-run metadata. Rollback is deleting rows where `platform === "notion"` or `metadata.adapter.id === "notion"`, plus related `openThreads` and `extractionRuns` by `chatId`.

No schema migration is allowed for M9 unless a new pivot replaces this decision.

## Sources Checked

- `https://developers.notion.com/guides/get-started/overview`
- `https://developers.notion.com/guides/get-started/authorization`
- `https://developers.notion.com/guides/get-started/personal-access-tokens`
- `https://developers.notion.com/reference/get-block-children`
- `https://developers.notion.com/reference/request-limits`
- `https://developers.notion.com/guides/get-started/handling-api-keys`
