# Google Docs Import

Status: M10 local import. Live Drive API import is deferred.

## What Imports

Rakuzaichi imports selected local Google Docs exports into the vault without OAuth. Use exported HTML first when available; DOCX document XML, Markdown, and plain text are fallback formats.

Imported data stays local unless you export, back up, or sync the vault.

## Local Export Path

1. Export the Google Doc or download a Google Takeout archive.
2. Choose exported files, choose an exported folder, or drop exported files into the Google Docs import panel.
3. Rakuzaichi stores one vault snapshot per document and runs the deterministic open-thread scanner.

## Live API Size Fallback

If a future Drive Picker/API import fails because the Google Drive `files.export` output is too large, use Google Takeout or export the Doc locally, then import that local file.

The live API path must not retry with broader Drive crawling or background Drive search.

## Privacy Notes

- Imported Docs may include comments, links, names, and shared document text.
- Live OAuth is not used by the M10 local importer.
- OAuth tokens must not be stored in vault exports, backups, notes, issue reports, or screenshots.
- Remote images are not downloaded by the M10 importer.

## Sources

- `https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export`
- `https://developers.google.com/workspace/drive/api/guides/manage-downloads`
- `https://support.google.com/docs/answer/9759608?hl=en-GB`
