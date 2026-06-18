# M14 X Bookmarks Pivot

Status: accepted for M14 planning.
Date: 2026-06-18

## Decision

Prefer a local X archive path if a user-owned archive proves bookmark data is present. If the archive does not contain bookmarks, defer implementation to the official X API bookmark endpoint with OAuth 2.0 only.

No scraping, browser-cookie export, private web GraphQL, or internal X web API use ships in M14.

Rationale:

- X documents a user archive download path, but the current archive bookmark payload must be verified with a real user-owned archive.
- X documents `GET /2/users/{id}/bookmarks` for the authenticated user.
- Bookmark API access, cost, quotas, and auth requirements can change; code must revalidate before shipping.
- Scraping private web APIs or using cookies would be fragile and high-risk.

## Input Priority

1. Local X archive, only if `M14.T02` verifies bookmark fields.
2. Official X API, only if a later pivot accepts OAuth/cost/quotas.
3. No fallback scraping path.

## Archive Path

In scope if verified:

- local ZIP or extracted archive folder
- bookmarked post ID
- author ID/handle/name where present
- post text
- createdAt
- bookmark folder/category if present
- media placeholders
- source URL
- archive package hash
- importedAt

Out of scope until verified:

- claiming bookmarks are in all current archives
- inferring missing bookmark fields
- live hydration of deleted/protected posts
- downloading media

## API Path

If accepted later:

- use only official X API endpoints
- require OAuth 2.0 user context with documented scopes
- use the authenticated user's own ID for bookmark lookup
- handle pagination, auth failure, insufficient access tier, rate limits, deleted posts, and protected posts explicitly
- do not store access/refresh tokens in vault exports or backups

API endpoint:

- `GET /2/users/{id}/bookmarks`

Required source fields should request post text, author ID, creation timestamp, and media refs where available.

## UI Naming

Use `X bookmarks` in UI labels. Use `Twitter/X` only in explanatory copy where users may still recognize archive naming.

## No-Scraping Rule

M14 must reject:

- `x.com` or `twitter.com` bookmark web pages
- browser cookie/session imports
- private web GraphQL calls
- extension-based page crawls
- third-party bookmark exporter formats unless a later pivot accepts them

Rejected sources should point users to X archive export or the official API path if it is accepted.

## Normalization

Each bookmark becomes one `chat` row unless a later grouping pivot accepts folders/collections:

- `chatId`: `x-bookmarks:post:<post-id-or-hash>`
- `platform`: `x-bookmarks`
- `title`: post text excerpt or URL fallback
- `url`: canonical post URL when available
- `metadata`: adapter/import/provenance from `ImportNormalizer`

Each post text/media placeholder becomes one `message` row:

- `messageId`: stable post ID plus item path
- `role`: `document`
- `content`: deterministic post text or placeholder
- `timestamp`: post createdAt when present, otherwise importedAt
- `metadata.provenance`: post ID, author ID/handle/name, bookmark source, folder/category, media refs, source URL, and archive/API source

The deterministic scanner runs before any local LLM extraction.

## Fixture Policy

Required real fixture:

- user-owned X archive sample proving whether bookmarks are present
- redacted field inventory if present
- parser behavior notes

Synthetic fixtures after verification:

- archive bookmark payload
- API page payload
- pagination
- media placeholders
- deleted/unavailable posts
- protected posts
- malformed input

## Error And Cost Handling

If API path ships:

- auth failure: prompt re-auth or stop
- insufficient access tier/cost: explicit user-facing state
- rate limit: stop or retry according to API headers
- deleted/protected post: keep imported archive/API context if present
- pagination failure: recoverable partial run

## Rollback

M14 writes only normalized vault rows and import-run metadata. Rollback is deleting rows where `platform === "x-bookmarks"` or `metadata.adapter.id === "x-bookmarks"`, plus related `openThreads` and `extractionRuns` by `chatId`.

No schema migration is allowed for M14 unless a later pivot replaces this decision.

## Sources Checked

- `https://docs.x.com/x-api/users/get-bookmarks`
- `https://docs.x.com/x-api/posts/bookmarks/introduction`
- `https://docs.x.com/fundamentals/authentication/guides/v2-authentication-mapping`
- `https://help.x.com/en/managing-your-account/how-to-download-your-x-archive`
