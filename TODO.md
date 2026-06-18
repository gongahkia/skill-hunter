# TODO - Rakuzaichi Active Backlog

> Active backlog as of 2026-06-18. Completed v3 implementation tasks were removed from this file. Use git history and `docs/launch/` for shipped-task audit trail.

## Operating rules

- Keep the product zero-server, local-first, read-only by default.
- After completing any task here, mark it done and make a git commit for rollback.
- Prefer local archive/import flows over broad OAuth when both are viable.
- Do not scrape web UIs unless a future pivot doc explicitly accepts ToS and maintenance risk.
- Do not store OAuth/API tokens in exported vault files.
- For prose/document imports, run deterministic scanning before local LLM extraction.
- M9-M15 code starts only after the milestone pivot doc exists and states scope, fixtures, privacy, and rollback.

## Current active status

- v3 core implementation is complete.
- Distribution remains the active launch blocker.
- GitHub draft release and launch docs exist under `docs/launch/`.
- The Owl repo was deleted, so remaining Owl archival tasks are no longer active.

## M8 - Distribution

- [ ] `M8.T01` - Create Chrome Web Store developer account if needed and pay the one-time registration fee.
  - Success: `chrome.google.com/webstore/devconsole` opens for this account and accepts a new item upload.
- [ ] `M8.T02` - Upload `rakuzaichi-chrome.zip` to Chrome Web Store as a draft.
  - Success: CWS item exists in draft state with the v3 ZIP attached and no missing required fields.
- [ ] `M8.T03` - Submit Chrome Web Store listing for review.
  - Success: CWS dashboard shows submitted/review state; listing URL/item ID is recorded in `docs/launch/store-submission-runbook.md`.
- [ ] `M8.T05` - Submit Firefox AMO v3 update.
  - Success: AMO shows the v3 package submitted or approved.
- [ ] `M8.T06` - Create/confirm Apple Developer Program access for Safari distribution.
  - Success: App Store Connect accepts a Safari extension submission for this Apple ID/team.
- [ ] `M8.T07` - Sign/archive/notarize/package Safari extension through Xcode and submit to App Store Connect.
  - Success: App Store Connect build exists for review; signed artifact metadata is recorded in `docs/launch/store-submission-runbook.md`.
- [ ] `M8.T08` - After store submissions, update `docs/launch/store-listings.md` with exact store URLs and status.
  - Success: Chrome/Firefox/Safari rows include final item URLs or review-pending dashboard refs.
- [ ] `M8.T10` - After approval, update README badges to live store URLs.
  - Success: badge URLs return 200 and render correctly.

## Adapter baseline for M9-M14

- [x] `ADAPTER.T01` - Define the final prose import contract before M9 implementation.
  - Success: `docs/pivots/adapter-contract.md` exists or the M9 pivot doc contains the contract.
- [x] `ADAPTER.T02` - Confirm imported documents can reuse existing vault/search/thread/export schemas.
  - Success: no new top-level IndexedDB stores are required unless the pivot doc justifies them.
- [x] `ADAPTER.T03` - Add shared import-run metadata.
  - Success: imports record adapter ID, source object/path, import package hash for files, importedAt, item counts, duration, warnings, and errors.
- [x] `ADAPTER.T04` - Add shared progress/cancel/error model for file and API imports.
  - Success: large imports show progress, can be cancelled, and leave a recoverable partial-import record.
- [x] `ADAPTER.T05` - Add shared provenance fields to normalized snapshots/messages.
  - Success: every imported row can point back to original source ID/path/URL where available.
- [x] `ADAPTER.T06` - Add fixture policy.
  - Success: each adapter has synthetic fixtures plus at least one user-owned real fixture before marking parser behavior complete.
- [x] `ADAPTER.T07` - Add import privacy copy.
  - Success: UI warns when an archive may include other people's messages or sensitive account data.
- [x] `ADAPTER.T08` - Add source dedupe policy.
  - Success: re-importing the same archive or source object updates/skips existing rows instead of duplicating them.
- [x] `ADAPTER.T09` - Add import tests.
  - Success: parser, provenance, scanner, dedupe, cancellation, malformed input, and large-file cases are covered.

## M9 - Notion adapter

Objective: import selected Notion pages as prose snapshots. Scanner is primary; local LLM extraction is optional.

Source constraints checked 2026-06-18:

- Notion supports internal connections, personal access tokens, and public OAuth connections.
- Internal connections require pages to be manually shared with the connection.
- Block children are paginated and nested blocks require recursive fetch.
- Notion documents average request limits of 3 requests/second per connection and `429`/`529` retry handling.

Tasks:

- [x] `M9.T01` - Write `docs/pivots/m9-notion-adapter.md`.
  - Success: doc states auth mode, page/object scope, permissions, rate-limit behavior, fixture plan, non-goals, and rollback.
- [x] `M9.T02` - Decide v1 auth: PAT, internal connection token, or both.
  - Success: pivot doc explains why public OAuth is included or deferred.
- [x] `M9.T03` - Define supported Notion objects.
  - Success: pages and child blocks are explicitly in/out; databases, comments, files, and synced blocks have decisions.
- [x] `M9.T04` - Build synthetic Notion fixtures.
  - Success: fixtures cover headings, paragraphs, bullets, numbered lists, to-dos, toggles, code, quotes, links, nested blocks, empty blocks, unsupported blocks, and long pages.
- [ ] `M9.T05` - Obtain one user-owned exported/API fixture.
  - Success: fixture validates real block shape and permission edge cases.
- [x] `M9.T06` - Implement read-only page import.
  - Success: selected page imports with recursive block pagination, progress, cancel, and retry/backoff.
- [x] `M9.T07` - Preserve Notion provenance.
  - Success: page ID, block ID, page title, URL, workspace hint if available, importedAt, and adapter version are retained.
- [x] `M9.T08` - Add Notion permission/error states.
  - Success: missing share, revoked token, insufficient capabilities, 404 access mismatch, 429/529, and network failures have specific messages.
- [x] `M9.T09` - Run scanner before extraction.
  - Success: `TODO:`/`FIXME:` markers in imported Notion prose become explicit open threads without model use.
- [x] `M9.T10` - Add Notion import tests.
  - Success: fixtures cover pagination, nesting, unsupported blocks, dedupe, rate-limit retry, cancellation, and scanner output.
- [x] `M9.T11` - Update user docs.
  - Success: docs explain creating/sharing a Notion connection, revoking access, and deleting imported data.

Sources:

- `https://developers.notion.com/guides/get-started/authorization`
- `https://developers.notion.com/reference/get-block-children`
- `https://developers.notion.com/reference/request-limits`

## M10 - Google Docs adapter

Objective: import selected Google Docs as prose snapshots without broad Drive access by default.

Source constraints checked 2026-06-18:

- Google Takeout supports exporting Google products such as Email and Documents into archives.
- Drive API scopes should be narrowly focused; broader user-data scopes can require verification.
- Google Picker provides user-selected file access; desktop/mobile flow only permits `drive.file`.
- Drive `files.export` exports Google Workspace docs to MIME types but exported content is limited to 10 MB.

Tasks:

- [x] `M10.T01` - Write `docs/pivots/m10-google-docs-adapter.md`.
  - Success: doc chooses local export/Takeout-first vs live Picker/OAuth, states scopes, verification consequences, parser inputs, and non-goals.
- [x] `M10.T02` - Decide canonical local input format.
  - Success: pivot chooses HTML, DOCX, Markdown, plain text, or multiple formats with precedence.
- [x] `M10.T03` - Build exported Docs fixtures.
  - Success: fixtures cover headings, lists, links, tables, footnotes if present, images/placeholders, comments if export contains them, long docs, and empty docs.
- [x] `M10.T04` - Implement local file/folder import first.
  - Success: user can drop/select exported Docs files and import without OAuth.
- [x] `M10.T05` - Preserve Docs provenance.
  - Success: original file path/name, exported format, document title, source URL if present, import package hash, and importedAt are retained.
- [x] `M10.T06` - Add export-size fallback copy for live API path.
  - Success: docs over API export limits tell user to use Takeout/local export.
- [x] `M10.T07` - If live API is accepted, implement explicit file selection only.
  - Success: Google Picker or equivalent user-selected flow is used; no background Drive crawl ships.
- [x] `M10.T08` - Decide Owl Apps Script reuse.
  - Success: pivot states reuse, rewrite, or discard; no Apps Script code ships by accident.
- [x] `M10.T09` - Run scanner before extraction.
  - Success: inline prose tags create open threads before any local model call.
- [x] `M10.T10` - Add Docs import tests.
  - Success: parser, malformed files, large files, unsupported structures, dedupe, scanner, and cancellation are covered.

Sources:

- `https://support.google.com/accounts/answer/3024190?hl=en`
- `https://developers.google.com/workspace/drive/api/guides/api-specific-auth`
- `https://developers.google.com/workspace/drive/picker/guides/overview`
- `https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export`

## M11 - Google Keep adapter

Objective: import Keep notes without scraping Keep web UI.

Source constraints checked 2026-06-18:

- Google documents a Keep REST API, but describes it for enterprise/security administration use cases.
- Google Takeout is the default consumer-friendly path for downloading user Google data.
- I cannot verify the exact current Keep Takeout file schema without a user-owned archive.

Tasks:

- [x] `M11.T01` - Write `docs/pivots/m11-google-keep-adapter.md`.
  - Success: doc states Takeout-only default, API caveat, no-scraping rule, attachment policy, fixture needs, and rollback.
- [ ] `M11.T02` - Obtain a user-owned Keep Takeout sample.
  - Success: sample documents actual JSON/HTML fields, labels, colors, timestamps, checklists, pinned/archive state, deleted state if present, and attachments.
- [ ] `M11.T03` - Build synthetic Keep fixtures matching the sample schema.
  - Success: fixtures cover text notes, checklists, labels, colors, pinned notes, archived notes, empty notes, and attachment placeholders.
- [ ] `M11.T04` - Implement local Takeout import.
  - Success: notes import as one snapshot per note with checklist/prose items normalized.
- [ ] `M11.T05` - Preserve Keep metadata.
  - Success: title, labels, color, created/updated timestamps, archived/pinned/deleted state if present, source path, package hash, and importedAt are retained.
- [ ] `M11.T06` - Reject unsupported live sources.
  - Success: Keep URLs/browser pages are not scraped; UI points user to Takeout import.
- [ ] `M11.T07` - Define attachment behavior.
  - Success: images/audio/drawings are imported, linked, or skipped according to pivot doc with visible warnings.
- [ ] `M11.T08` - Run scanner before extraction.
  - Success: checklist/prose markers create explicit open threads.
- [ ] `M11.T09` - Add Keep import tests.
  - Success: parser, missing fields, attachment policy, dedupe, scanner, and malformed archive cases are covered.

Sources:

- `https://developers.google.com/workspace/keep/api/guides`
- `https://developers.google.com/workspace/keep/api/reference/rest`
- `https://support.google.com/accounts/answer/3024190?hl=en`

## M12 - Slack / Discord adapters

Objective: ingest user-owned communication exports. No live Slack/Discord APIs in this milestone.

Source constraints checked 2026-06-18:

- Slack export scope depends on plan/admin permissions; public-channel JSON export is broadly available to owners/admins, while private channels/DMs require higher plans or approved export types.
- Discord Data Package is a user-requested ZIP with JSON files; Discord says delivery can take up to 30 days and links remain active for 30 days.
- Discord messages include IDs, timestamps, contents, and attachment CDN links in the data package docs.

Tasks:

- [x] `M12.T01` - Write `docs/pivots/m12-slack-discord-adapters.md`.
  - Success: doc states export-only scope, separate vs combined shipping, grouping policy, privacy copy, fixture policy, and no-live-API rule.
- [ ] `M12.T02` - Build Slack fixture set.
  - Success: fixtures cover public channel export, thread replies, reactions, files/links, user maps, missing private/DM data, and malformed JSON.
- [ ] `M12.T03` - Build Discord fixture set.
  - Success: fixtures cover DM, group DM, server channel, message JSON, attachments, deleted users, current/recent server metadata, and package metadata.
- [ ] `M12.T04` - Implement ZIP streaming import.
  - Success: large exports import with progress/cancel and without blocking UI.
- [ ] `M12.T05` - Define grouping.
  - Success: imported snapshots group by workspace/server + channel/DM/thread according to pivot doc.
- [ ] `M12.T06` - Preserve Slack provenance.
  - Success: workspace, channel, thread timestamp/ID, message timestamp, user ID/name map, export package hash, and importedAt are retained.
- [ ] `M12.T07` - Preserve Discord provenance.
  - Success: server/channel/DM IDs, message ID, author ID/name where present, timestamp, attachment URLs, package hash, and importedAt are retained.
- [ ] `M12.T08` - Add privacy warnings.
  - Success: UI states exports may include other people's messages and should remain local.
- [ ] `M12.T09` - Run scanner before extraction.
  - Success: explicit tasks in chat exports become open threads.
- [ ] `M12.T10` - Add Slack/Discord tests.
  - Success: ZIP parsing, malformed entries, huge archives, user maps, deleted/missing users, dedupe, scanner, and cancellation are covered.

Sources:

- `https://slack.com/help/articles/201658943-Export-your-workspace-data`
- `https://support.discord.com/hc/en-us/articles/360004957991-Your-Discord-Data-Package`

## M13 - Email adapter

Objective: import email into the vault as read-only knowledge snapshots, starting with Gmail Takeout/MBOX.

Source constraints checked 2026-06-18:

- Google Takeout supports Email archives and ZIP/TGZ output.
- Google says Gmail labels are preserved in an `X-Gmail-Labels` header in exported mail.
- Google says Takeout does not support Gmail timeframe exports.
- RFC 4155 describes `application/mbox`; mbox has variant behavior, so parser fixtures must include malformed/variant files.

Tasks:

- [ ] `M13.T01` - Write `docs/pivots/m13-email-adapter.md`.
  - Success: doc chooses Gmail Takeout/MBOX-first, grouping policy, attachment policy, HTML sanitization, credential risk if IMAP is ever added, and rollback.
- [ ] `M13.T02` - Build MBOX fixtures.
  - Success: fixtures cover plain text, HTML, multipart, attachments, labels, forwarded/replied threads, duplicate Message-IDs, malformed headers, huge mailboxes, and `From ` body escaping.
- [ ] `M13.T03` - Implement local MBOX parser.
  - Success: messages import from local files without IMAP/OAuth.
- [ ] `M13.T04` - Decide grouping.
  - Success: snapshots group by thread, mailbox/label, sender, or one-email-per-snapshot according to pivot doc.
- [ ] `M13.T05` - Sanitize HTML email.
  - Success: scripts, event handlers, remote tracking pixels, and unsafe URLs are stripped before storage/render.
- [ ] `M13.T06` - Preserve email provenance.
  - Success: Message-ID, From, To, Cc, Bcc where present, subject, date, labels, mailbox path, package hash, and importedAt are retained.
- [ ] `M13.T07` - Define attachment behavior.
  - Success: attachments are imported, linked, skipped, or metadata-only according to pivot doc with visible warnings.
- [ ] `M13.T08` - Defer IMAP/OAuth until separate threat model.
  - Success: no password/OAuth UI ships in M13 unless pivot doc adds a dedicated credential model.
- [ ] `M13.T09` - Run scanner before extraction.
  - Success: explicit task markers in emails become open threads.
- [ ] `M13.T10` - Add email import tests.
  - Success: MIME parsing, mbox variants, sanitization, labels, attachments, dedupe, scanner, malformed input, and large mailbox cases are covered.

Sources:

- `https://support.google.com/accounts/answer/3024190?hl=en`
- `https://support.google.com/mail/answer/10016932?hl=en`
- `https://www.rfc-editor.org/rfc/rfc4155`

## M14 - Twitter/X bookmarks

Objective: import saved/bookmarked X posts without scraping.

Source constraints checked 2026-06-18:

- X documents `GET /2/users/{id}/bookmarks` for the authenticated user with OAuth 2.0 access token.
- X documents account data archives in HTML/JSON.
- I cannot verify whether current X account archives include bookmark payloads without a user-owned archive.
- API pricing/access can change; revalidate before code.

Tasks:

- [ ] `M14.T01` - Write `docs/pivots/m14-x-bookmarks.md`.
  - Success: doc chooses archive-first vs official API, states auth/cost assumptions, fixture policy, UI naming, and no-scraping/internal-GraphQL rule.
- [ ] `M14.T02` - Verify X archive contents with a real sample.
  - Success: sample proves whether bookmarks are present and which fields are available.
- [ ] `M14.T03` - If archive path works, implement local archive parser.
  - Success: bookmarked posts import without OAuth.
- [ ] `M14.T04` - If API path is accepted, implement OAuth only against official endpoints.
  - Success: no cookies, private web GraphQL, or page scraping are used.
- [ ] `M14.T05` - Preserve bookmark provenance.
  - Success: post ID, author ID/handle/name where available, text, createdAt, bookmark folder if available, media placeholders, source URL, archive/API source, and importedAt are retained.
- [ ] `M14.T06` - Handle unavailable/deleted/protected posts.
  - Success: imported post text/context survives if live URL later fails.
- [ ] `M14.T07` - Add API rate/error/cost handling if API path ships.
  - Success: auth failure, insufficient access tier, rate limit, deleted post, and protected post states are explicit.
- [ ] `M14.T08` - Run scanner before extraction.
  - Success: task markers in saved post text become open threads.
- [ ] `M14.T09` - Add X import tests.
  - Success: archive/API fixtures, pagination, media placeholders, deleted/protected posts, dedupe, scanner, and malformed input are covered.

Sources:

- `https://docs.x.com/x-api/users/get-bookmarks`
- `https://help.x.com/en/managing-your-account/accessing-your-x-data`

## M15 - Local RAG over vault

Objective: ask questions over the local vault without sending vault contents to a server.

Source constraints checked 2026-06-18:

- Transformers.js runs ML models in the browser with no server and supports feature extraction, sentence similarity, question answering, and text generation tasks.
- Transformers.js supports WASM and WebGPU paths; WebGPU remains browser/hardware-dependent.
- Chrome Prompt API can use Gemini Nano in Chrome, but model availability, hardware requirements, download lifecycle, and API stage make it an optional backend, not a baseline dependency.

Tasks:

- [ ] `M15.T01` - Write `docs/pivots/m15-local-rag.md`.
  - Success: doc states retrieval-only vs answer-generation scope, embedding model, index store, chunk policy, citation UI, privacy copy, storage budget, runtime surface, and rollback.
- [ ] `M15.T02` - Start with retrieval-only UX.
  - Success: user can search semantically and open cited source chunks before any generated answer feature ships.
- [ ] `M15.T03` - Define chunk IDs across chats and imported prose.
  - Success: every chunk maps back to chat/document/message/source row and survives rebuilds.
- [ ] `M15.T04` - Select embedding model.
  - Success: decision records model size, license, browser runtime, quantization, expected latency, and cache size.
- [ ] `M15.T05` - Prototype on copied fixture vault only.
  - Success: latency/storage/recall numbers are recorded before production schema migration.
- [ ] `M15.T06` - Design vector index storage.
  - Success: pivot states whether vectors live in IndexedDB, OPFS, or another local store and how rebuild/migration works.
- [ ] `M15.T07` - Add model lifecycle UX.
  - Success: user can download, pause, clear model cache, clear vector index, and rebuild index.
- [ ] `M15.T08` - Add progress/cancel for indexing.
  - Success: indexing large vaults is visible, cancellable, and resumes/restarts cleanly.
- [ ] `M15.T09` - Add citation-first answer UI if generation ships.
  - Success: every generated answer cites source chats/docs/messages; unsupported questions can return no result.
- [ ] `M15.T10` - Add backend policy.
  - Success: Transformers.js embedding path is baseline; Chrome Prompt API/Gemini Nano is optional and gracefully hidden when unavailable.
- [ ] `M15.T11` - Add RAG eval set.
  - Success: fixtures cover exact recall, semantic recall, stale/deleted sources, unsupported questions, and hallucination checks.
- [ ] `M15.T12` - Add performance gates.
  - Success: representative vault indexing time, query latency, memory, and storage budget are measured and documented.
- [ ] `M15.T13` - Add privacy/security docs.
  - Success: docs state what model files are downloaded, where vectors live, how to delete them, and that vault contents stay local.

Sources:

- `https://huggingface.co/docs/transformers.js/index`
- `https://huggingface.co/docs/transformers.js/api/pipelines`
- `https://developer.chrome.com/docs/ai/built-in-apis`
- `https://developer.chrome.com/docs/ai/prompt-api`

## Deferred after M15

- `M16` - Cross-LLM primer generator.
- `M17` - Mobile PWA read-only vault bundle.

## Web sources checked

- Notion auth: `https://developers.notion.com/guides/get-started/authorization`
- Notion block children: `https://developers.notion.com/reference/get-block-children`
- Notion request limits: `https://developers.notion.com/reference/request-limits`
- Google Takeout: `https://support.google.com/accounts/answer/3024190?hl=en`
- Google Drive scopes: `https://developers.google.com/workspace/drive/api/guides/api-specific-auth`
- Google Picker: `https://developers.google.com/workspace/drive/picker/guides/overview`
- Google Drive export: `https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export`
- Google Keep API: `https://developers.google.com/workspace/keep/api/guides`
- Google Keep REST: `https://developers.google.com/workspace/keep/api/reference/rest`
- Slack export: `https://slack.com/help/articles/201658943-Export-your-workspace-data`
- Discord data package: `https://support.discord.com/hc/en-us/articles/360004957991-Your-Discord-Data-Package`
- Gmail export: `https://support.google.com/mail/answer/10016932?hl=en`
- MBOX RFC: `https://www.rfc-editor.org/rfc/rfc4155`
- X bookmarks API: `https://docs.x.com/x-api/users/get-bookmarks`
- X account archive: `https://help.x.com/en/managing-your-account/accessing-your-x-data`
- Transformers.js: `https://huggingface.co/docs/transformers.js/index`
- Transformers.js pipelines: `https://huggingface.co/docs/transformers.js/api/pipelines`
- Chrome built-in AI APIs: `https://developer.chrome.com/docs/ai/built-in-apis`
- Chrome Prompt API: `https://developer.chrome.com/docs/ai/prompt-api`
