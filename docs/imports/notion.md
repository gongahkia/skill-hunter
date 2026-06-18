# Notion Import

Status: M9 planning docs. UI wiring is separate from the core importer.

## What Imports

Rakuzaichi imports one selected Notion page at a time. It reads the page title and recursive child blocks, stores them as local vault rows, and runs the deterministic open-thread scanner over the imported text.

Imported data stays local unless you export, back up, or sync the vault.

## Token Options

V1 accepts either:

- Personal Access Token: uses your own Notion permissions in one workspace.
- Internal connection token: uses a workspace integration token; pages must be shared with that connection.

Public OAuth is deferred for M9.

Do not place Notion tokens in exported vault files, notes, issue reports, or screenshots.

## Personal Access Token

1. Open the Notion Developer portal.
2. Create a Personal Access Token for the workspace.
3. Grant Notion API capability.
4. Copy the token only into the import flow.
5. Revoke the token from the Developer portal when it is no longer needed.

PAT imports can read pages that your Notion user can read, subject to workspace controls and token capability.

## Internal Connection

1. Create an internal connection in the Notion Developer portal.
2. Copy the integration token only into the import flow.
3. Open the page in Notion.
4. Use the page menu and `Add connections` to share the page with the connection.
5. Import the page by page URL or page ID.
6. Remove the connection from the page or revoke the token when access is no longer needed.

If the page is not shared, Rakuzaichi should report a page-not-shared error instead of crawling the workspace.

## Deleting Imported Data

Imported Notion rows use:

- `platform: "notion"`
- `chatId: "notion:page:<page-id>"`
- `metadata.adapter.id: "notion"`

Delete the imported Notion snapshot from the vault UI when available. Until UI deletion is wired for imports, rollback is deleting the Notion `chat` row plus related `messages`, `openThreads`, and `extractionRuns` for the same `chatId`.

Deleting imported rows does not revoke Notion access. Revoke the PAT/internal connection token or remove the page connection in Notion.

## Privacy Notes

- Imported pages may include shared workspace text and other people's edits.
- Unsupported blocks are skipped with warnings.
- Files and media are not downloaded in M9.
- Comments are not imported in M9.
- Tokens are not part of vault backups or exports.

## Sources

- `https://developers.notion.com/guides/get-started/authorization`
- `https://developers.notion.com/guides/get-started/personal-access-tokens`
- `https://developers.notion.com/guides/get-started/handling-api-keys`
