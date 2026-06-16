# Extraction Architecture

## Acquisition Paths

Rakuzaichi stores open-thread candidates in `openThreads`. Rows are produced by three paths:

| Path | Chat role | Prose-surface role | Source fields |
| :--- | :--- | :--- | :--- |
| User-applied tagging | Primary | Secondary | `source: "explicit"`, `subSource: "user"` |
| In-content scanner | Low-yield fallback | Primary | `source: "explicit"`, `subSource: "scan"` |
| Local LLM extraction | Primary from M5 onward | Augmenter | `source: "extracted"` |

## Scanner Rationale

The scanner matches explicit tag prefixes such as `TODO:`, `FIXME:`, `REV:`, `REF:`, `FOLLOWUP:`, `UNRESOLVED:`, and `PROMPT:` at line start. This pattern is valuable in prose tools because users often write notes and drafts with visible task markers.

For AI chats, that same pattern is uncommon. Users normally ask questions or paste context instead of typing `TODO:` markers into the conversation. The scanner still runs on chat capture because it is deterministic and cheap, but its chat value is limited to pasted-prose edge cases, for example a user pasting meeting notes that already contain `TODO: ping Alice`.

## M9+ Prose Adapters

For Notion, Google Docs, Keep, and similar prose surfaces, the scanner becomes the primary acquisition path. Those adapters can reuse `ThreadScanner.scanMessage(message)` without changing the vault schema: each prose block or paragraph can be normalized into a message-like record with `chatId`, `messageId`, `content`, and `timestamp`.

LLM extraction remains useful as an augmenter for prose, but the deterministic scanner should run first because it preserves author-intended tag labels exactly and avoids model cost.

## Chat Priority

For chat substrate, the priority order is:

1. User-applied tags from the vault UI.
2. Local LLM extraction for implicit unresolved questions, follow-ups, corrections, and references.
3. Scanner fallback for pasted prose containing explicit tag prefixes.

This keeps chat UX centered on actual chat behavior while preserving Owl's prose-oriented tag scanner for the surfaces where it fits naturally.

## M5 Runtime And Model Loading

Decision verified on 2026-06-16: bundle Transformers.js runtime code in the extension package; lazy-fetch model artifacts only after the user opts into local extraction.

Reason: Chrome MV3 treats remotely loaded JavaScript and WASM as remotely hosted code, and Chrome's migration docs state that MV3 extensions must bundle all executed code inside the extension package. Transformers.js can be installed from npm or imported from a CDN, but the CDN import is unsuitable for a Chrome Web Store MV3 package because it would execute remote JS/WASM. Model weights and tokenizer/config files are data, not extension logic, so the M5 loader may fetch them on demand from Hugging Face-hosted model URLs and cache them locally.

Runtime/code strategy:

1. Add `@huggingface/transformers` as an npm dependency when implementing `M5.T03`.
2. Copy/bundle the required JS and WASM runtime files into `src/vendor/` or the build output.
3. Configure the loader to use the packaged runtime files.
4. Fetch `Qwen/Qwen2.5-0.5B-Instruct` quantized model artifacts lazily on first extraction opt-in.
5. Cache downloaded model artifacts locally using the browser cache/storage path supported by Transformers.js.

Privacy disclosure requirement for this strategy:

- No chat content is sent to Hugging Face, jsDelivr, or any model host.
- The first extraction run may request model artifact URLs from `https://huggingface.co/` or `https://cdn.jsdelivr.net/`, depending on final loader configuration.
- Those requests reveal normal HTTP metadata to the CDN/model host, such as IP address, user agent, requested model file path, and request time.
- Extraction runs locally after model artifacts are available.

References:

- Hugging Face Transformers.js docs: `https://huggingface.co/docs/transformers.js/en/index`
- Hugging Face Transformers.js installation docs: `https://huggingface.co/docs/transformers.js/en/installation`
- Chrome MV3 remote-hosted-code guidance: `https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code`
