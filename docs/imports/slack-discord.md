# Slack And Discord Import

Status: M12 planning docs. Importer wiring is separate from the pivot.

## What Imports

Rakuzaichi imports user-selected Slack workspace exports and Discord Data Packages from local ZIP files or extracted folders.

No Slack API tokens, Discord API tokens, browser sessions, or web scraping are accepted in M12.

## Privacy Warnings

Slack exports may include other people's messages, names, reactions, links, private channels, DMs, and file references depending on export scope.

Discord Data Packages may include usernames, user IDs, server/channel/DM metadata, message text, attachment filenames, and attachment URLs.

Imported content stays local unless you export, back up, or sync the vault. Review export scope before importing shared workspaces, servers, group DMs, or DMs.

## Attachment Policy

Remote files are not downloaded. File and attachment refs are preserved as links/placeholders with provenance and warnings where needed.

## Sources

- `https://slack.com/help/articles/201658943-Export-your-workspace-data`
- `https://support.discord.com/hc/en-us/articles/360004957991-Your-Discord-Data-Package`
