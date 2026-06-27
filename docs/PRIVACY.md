# Privacy

## Extension Permissions

- `storage`: keep challenge state, settings, timers, and local receipts.
- `downloads`: write the optional CLI status JSON export under the browser Downloads directory.
- `alarms`: refresh the optional CLI status export periodically while enabled.

## Host Permissions

- `https://chatgpt.com/*`: show the local gate on ChatGPT.
- `https://www.perplexity.ai/*`: show the local gate on Perplexity.
- `https://gemini.google.com/*`: show the local gate on Gemini.
- `https://claude.ai/*`: show the local gate on Claude.
- `https://www.deepseek.com/*`: show the local gate on DeepSeek.
- `https://copilot.microsoft.com/*`: show the local gate on Copilot.
- `https://socrat.ai/*`: show the local gate on Socrat.
- `https://huggingface.co/*`: show the local gate on Hugging Face Chat.
- `https://writesonic.com/*`: show the local gate on WriteSonic Chat.
- `https://you.com/*`: show the local gate on You.com.
- `https://www.jasper.ai/*`: show the local gate on Jasper.
- `https://leetcode.com/problems/*`: detect accepted submissions for the assigned LeetCode challenge.

## No Server

Dorso's extension flow stores challenge state, settings, timers, and solve status in browser extension storage.

Optional CLI export writes a local JSON file using the browser downloads API. The file is meant for `@dorso/cli` and is not uploaded by Dorso.

Exception: the optional SVG badge uses a stateless Cloudflare Worker documented in [cloudflare/README.md](../cloudflare/README.md). Badge state is HMAC-signed and encoded into the URL; the Worker does not keep per-user server-side state.

## No Tracking

Dorso has no analytics, no telemetry, and no third-party scripts. It does not send chatbot page content, LeetCode submissions, settings, or install identifiers to analytics services.

## No Accounts

Dorso has no login, no auth flow, no email collection, and no account database.
