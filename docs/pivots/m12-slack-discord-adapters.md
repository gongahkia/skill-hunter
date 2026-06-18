# M12 Slack And Discord Adapter Pivot

Status: accepted for M12 planning.
Date: 2026-06-18

## Decision

Build local export importers for Slack and Discord. Ship them as separate adapters sharing one ZIP import foundation.

No live Slack API, Discord API, browser-session scraping, or token-based crawl ships in M12.

Rationale:

- Slack's official exports are ZIP/JSON-based, but available conversation scope depends on plan/admin permissions.
- Discord's Data Package is a user-requested ZIP of JSON files for the account.
- Export files preserve the local-first model and avoid OAuth, bot tokens, user tokens, or browser scraping.
- Slack and Discord data can include other people's messages, file links, usernames, IDs, and private conversations; adapter copy must make that explicit.

## Shipping Shape

Shared foundation:

- ZIP entry enumeration with progress and cancellation.
- Package hash for dedupe.
- Recoverable malformed-entry handling.
- Attachment/link placeholder policy.

Separate adapters:

- `slack`
- `discord`

Reason: provenance, grouping, fixture layout, and privacy semantics differ enough that one combined parser would hide important source-specific behavior.

## Grouping Policy

M12.T05 outcome: Slack snapshots group by workspace + conversation. Discord snapshots group by server channel, DM, or group DM. Slack thread replies remain in the parent conversation snapshot with thread provenance; Discord messages remain in source channel/DM order.

## Slack Scope

Input:

- user-selected Slack workspace export ZIP or extracted folder
- public-channel JSON export as baseline
- private channels, DMs, and all-conversation exports only when present in the user-selected export

Out of scope:

- Slack Web/API token import
- Discovery API import
- browser-session export helpers
- downloading remote file URLs
- claiming private/DM coverage when the export does not include it

Slack grouping:

- one snapshot per workspace + conversation
- thread replies stay under the same conversation snapshot with thread provenance
- future pivot may split very large channels by month if memory/performance requires it

Slack provenance:

- workspace/team ID/name when present
- channel/conversation ID/name/type
- thread timestamp/ID
- message timestamp
- user ID and resolved display/name map when present
- file/link refs
- source entry path
- export package hash
- importedAt

## Discord Scope

Input:

- user-selected Discord Data Package ZIP or extracted folder
- message JSON files, server/channel metadata, DM/group DM metadata, and package metadata when present

Out of scope:

- Discord API import
- bot/user token import
- scraping Discord web or desktop UI
- downloading CDN attachments
- inferring deleted content not present in the package

Discord grouping:

- one snapshot per server channel, DM, or group DM
- message files are ordered by source timestamp/ID
- package/server/channel metadata resolves titles where available

Discord provenance:

- server/guild ID/name when present
- channel/DM/group DM ID/name/type
- message ID
- author ID/name where present
- timestamp
- attachment URLs and filenames where present
- source entry path
- export package hash
- importedAt

## Attachment And File Policy

M12 imports text and metadata first.

- Slack exports usually include file links, not file bytes; preserve links in provenance and message text when useful.
- Discord package attachment refs are preserved as URLs/filenames in provenance.
- Remote files are not downloaded.
- Missing or unsupported attachments become recoverable warnings.
- No binary vault storage is added in M12.

## Privacy Copy

Import UI must state:

- exports may contain other people's messages, names, IDs, private channels, DMs, reactions, file links, and attachment URLs
- imported content stays local unless the user exports, backs up, or syncs the vault
- users should review export scope before importing shared workspaces, servers, or DMs
- tokens and live credentials are not accepted

## Fixture Policy

Synthetic Slack fixtures:

- public channel export
- thread replies
- reactions
- file/link refs
- user maps
- missing private/DM data
- malformed JSON

Synthetic Discord fixtures:

- DM
- group DM
- server channel
- message JSON
- attachments
- deleted/missing users
- current/recent server metadata
- package metadata
- malformed JSON

No private real user exports should be committed. Redacted user-owned fixtures may stay outside git for local verification notes.

## Error And Progress Model

Use shared import session behavior:

- progress by parsed/imported/total ZIP entries or messages
- cancellation with recoverable partial import run
- malformed entries skipped where safe
- package hash for dedupe
- visible warnings for unsupported records, missing user maps, missing attachments, and export scope gaps

The deterministic scanner runs before any local LLM extraction.

## Rollback

M12 writes only normalized vault rows and import-run metadata. Rollback is deleting rows where `platform === "slack"` or `platform === "discord"` or matching `metadata.adapter.id`, plus related `openThreads` and `extractionRuns` by `chatId`.

No schema migration is allowed for M12 unless a later pivot replaces this decision.

## Sources Checked

- `https://slack.com/help/articles/201658943-Export-your-workspace-data`
- `https://slack.com/help/articles/204897248-Guide-to-Slack-import-and-export-tools`
- `https://support.discord.com/hc/en-us/articles/360004957991-Your-Discord-Data-Package`
- `https://support.discord.com/hc/en-us/articles/360004027692-Requesting-a-Copy-of-your-Data`
