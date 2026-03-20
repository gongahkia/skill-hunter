# Rakuzaichi

Rakuzaichi is a browser extension that exports conversations from supported AI chat sites into local files on your device.

This file is the canonical source for the public support page and privacy policy URL you should publish before submitting the extension to the Chrome Web Store, Mozilla Add-ons, and the Safari App Store.

## What Rakuzaichi does

- Detects supported chat pages in your browser
- Extracts the visible conversation into a normalized export envelope
- Saves local exports in CSV, TSV, JSON, NDJSON, XML, or YAML
- Stores extension settings, export history, and auto-export status locally in the browser profile

## Supported sites

- ChatGPT
- Claude
- Gemini
- Perplexity
- DeepSeek
- Grok
- Copilot
- Mistral Le Chat
- HuggingChat

Support is DOM-based, not API-based. If a site changes its markup, extraction may temporarily degrade until the extension is updated.

## Export formats

- CSV
- TSV
- JSON
- NDJSON
- XML
- YAML

Parquet and Avro are not part of the public store build.

## Build and release

### Install dependencies

```bash
npm ci
```

### Build browser packages

```bash
npm run build
```

This generates:

- `dist/chrome`
- `dist/firefox`
- `dist/safari`

### Validate before release

```bash
npm run validate
```

### Package Chrome and Firefox archives

```bash
npm run package
```

### Generate the Safari macOS wrapper app

```bash
npm run safari:convert
```

Then open `safari/Rakuzaichi/Rakuzaichi.xcodeproj` in Xcode, configure signing, and archive the app for App Store Connect.

## Manual use

### Chrome

1. Build the project with `npm run build`.
2. Open `chrome://extensions/`.
3. Enable Developer Mode.
4. Choose Load unpacked.
5. Select `dist/chrome`.

### Firefox

1. Build the project with `npm run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose Load Temporary Add-on.
4. Select `dist/firefox/manifest.json`.

### Safari on macOS

1. Run `npm run safari:convert`.
2. Open `safari/Rakuzaichi/Rakuzaichi.xcodeproj`.
3. Build and run the macOS app from Xcode.
4. Enable the extension in Safari Settings.

## Permissions and website access

Rakuzaichi requests access only to the supported chatbot domains and the minimum extension permissions needed for its shipped features.

### Chrome and Firefox permissions

- `downloads`: save exported files
- `storage`: store local settings, export history, and auto-export status
- `alarms`: run optional scheduled auto-export

### Safari permissions

- `storage`: store local settings, export history, and auto-export status
- `alarms`: run optional scheduled auto-export

Safari uses a popup-side file download fallback for manual exports in the store build.

## Auto-export behavior

Auto-export is off by default.

When enabled, Rakuzaichi periodically inspects the active tab in the current window. If the tab is a supported chat page and a conversation can be extracted, the extension opens the browser save flow using the selected default format. If export is not possible, the extension records a visible status message instead of failing silently.

## Privacy policy

### Data handling

- Rakuzaichi does not send telemetry, analytics, or crash reporting data.
- Rakuzaichi does not load remote scripts or third-party SDKs.
- Rakuzaichi stores settings, export history, and auto-export status locally in the browser profile.
- Rakuzaichi reads conversation content only to produce a user-requested export or a user-configured scheduled export.

### Exported files

- Exported files are created only from content the user can already access in supported chat interfaces.
- Exported files are saved locally through the browser or browser wrapper save flow.
- The user is responsible for securing exported files after they are saved.

### Website access

Rakuzaichi requests access only to:

- `https://chat.openai.com/*`
- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
- `https://perplexity.ai/*`
- `https://www.perplexity.ai/*`
- `https://chat.deepseek.com/*`
- `https://grok.com/*`
- `https://copilot.microsoft.com/*`
- `https://chat.mistral.ai/*`
- `https://huggingface.co/chat/*`

### Data collection disclosure

Rakuzaichi does not collect and transmit user data outside the extension for storage or processing.

## Non-affiliation disclaimer

Rakuzaichi is an independent export utility. It is not affiliated with, endorsed by, or sponsored by OpenAI, Anthropic, Google, xAI, Microsoft, Mistral AI, Hugging Face, or Perplexity.

## Troubleshooting

### The extension says no supported platform was detected

- Confirm the current tab is one of the supported chat sites.
- Refresh the page after the chat UI fully loads.
- If the site changed its DOM structure, update the extension to the latest build.

### Export created an empty or incomplete result

- Make sure the conversation is visible in the current tab.
- Scroll to load the messages you expect to export.
- Re-run the export after the chat finishes rendering.

### Auto-export did not save a file

- Check the auto-export status shown in the settings page.
- Confirm the active tab was a supported site when the alarm fired.
- On Safari, use manual export if the browser build does not expose background download support.

## Store listing notes

Use the content in this file for:

- the public support URL
- the public privacy policy URL
- reviewer notes about permissions and data handling
- the Safari wrapper app help and privacy copy

Keep any store listing copy aligned with the actual shipped support matrix and permission set.
