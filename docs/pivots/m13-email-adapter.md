# M13 Email Adapter Pivot

Status: accepted for M13 planning.
Date: 2026-06-18

## Decision

Build a local Gmail Takeout/MBOX importer first. Do not ship IMAP, Gmail API, OAuth, or password-based import in M13.

Rationale:

- Google Takeout is the user-owned export path for Gmail data.
- Takeout email exports use MBOX files and can preserve labels in Gmail-specific headers.
- RFC 4155 defines `application/mbox`, but real mbox files have variant behavior; parser fixtures must cover ambiguity and malformed input.
- Local MBOX import preserves Rakuzaichi's zero-server model and avoids credential storage risk.

## Input Mode

V1 input is local files/folders:

- Gmail Takeout ZIP/TGZ after extraction or selected MBOX files.
- One or more `.mbox` files.
- Optional label/mailbox path inferred from file path/name.

No IMAP account, OAuth flow, app password, Gmail API token, or live mailbox crawl ships in M13.

## Grouping Policy

M13.T04 outcome: group one email thread per snapshot where reliable `Message-ID`, `In-Reply-To`, `References`, or normalized subject/date heuristics can identify a thread. If thread grouping is ambiguous, fall back to one email per snapshot.

Reason: thread snapshots preserve context for replies/forwards without forcing unrelated mailbox or sender grouping. Ambiguous grouping must fail small rather than merge unrelated emails.

## Supported Objects

In scope:

- plain text email bodies
- sanitized HTML email bodies
- multipart text/HTML alternatives
- forwarded and replied messages
- attachments as metadata/placeholders
- Gmail labels from `X-Gmail-Labels` when present
- Message-ID, From, To, Cc, Bcc, Subject, Date, In-Reply-To, References
- source mailbox path/name, package hash, importedAt, adapter version, and parser warnings

Out of scope:

- live IMAP or Gmail API import
- password/OAuth UI
- remote image downloads
- executing HTML/scripts
- exact email client rendering
- binary attachment vault storage in M13

## Attachment Policy

M13 imports message text first.

- Attachment filenames, content types, content IDs, and sizes are preserved in provenance when available.
- Inline attachments become placeholders if referenced by sanitized HTML.
- Binary attachment payloads are skipped in M13 with visible warnings.
- Remote images and tracking pixels are stripped, not fetched.

## HTML Sanitization

Before storage/rendering, HTML email content must remove:

- `script`, `iframe`, `object`, `embed`, and similar active elements
- inline event handlers such as `onclick`
- remote tracking pixels and remote image URLs
- `javascript:`, `data:` script, and other unsafe URLs
- style content that can escape the intended rendering surface

If sanitization fails, keep the plain text alternative when present; otherwise import a text placeholder and warning.

## IMAP/OAuth Deferral

M13.T08 outcome: IMAP/OAuth is deferred until a separate credential threat model exists.

Any future live email path must define:

- credential storage lifetime
- token/password backup exclusion
- account revocation UX
- rate/error handling
- local-only guarantees
- user-visible risk copy

## Normalization

Each grouped email thread or single fallback email becomes one `chat` row:

- `chatId`: `email:<thread-or-message-id-or-hash>`
- `platform`: `email`
- `title`: subject or deterministic fallback
- `url`: empty
- `metadata`: adapter/import/provenance from `ImportNormalizer`

Each email, body part, or attachment placeholder becomes one `message` row:

- `messageId`: stable Message-ID or source hash plus part index
- `role`: `document`
- `content`: deterministic sanitized text/HTML-derived text
- `timestamp`: Date header when valid, otherwise importedAt
- `metadata.provenance`: message headers, labels, mailbox path, part path, attachment refs, and parser warnings

The deterministic scanner runs before any local LLM extraction.

## Fixture Needs

Fixtures must cover:

- plain text
- HTML
- multipart text/HTML
- attachments
- Gmail labels
- forwarded/replied threads
- duplicate Message-IDs
- malformed headers
- huge mailboxes
- `From ` body escaping and mboxrd-style `>From ` lines

Private real mailboxes must not be committed. Redacted local samples may stay outside git for verification notes.

## Error And Progress Model

Use shared import session behavior:

- progress by parsed/imported/total messages
- cancellation with recoverable partial import run
- malformed messages skipped where safe
- package hash for dedupe
- visible warnings for malformed headers, missing boundary markers, skipped attachments, unsafe HTML, and ambiguous grouping

## Rollback

M13 writes only normalized vault rows and import-run metadata. Rollback is deleting rows where `platform === "email"` or `metadata.adapter.id === "email"`, plus related `openThreads` and `extractionRuns` by `chatId`.

No schema migration is allowed for M13 unless a later pivot replaces this decision.

## Sources Checked

- `https://support.google.com/accounts/answer/3024190?hl=en`
- `https://support.google.com/mail/answer/10016932?hl=en`
- `https://www.rfc-editor.org/rfc/rfc4155`
- `https://datatracker.ietf.org/doc/html/rfc4155`
