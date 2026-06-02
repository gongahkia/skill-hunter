# Experimental AI Path

This directory preserves the deferred Gemini/BYOK implementation from the previous `judgeman_v4` source tree.

It is intentionally excluded from the store-safe build and from the generated Chrome, Firefox, and Safari submission artifacts. The files in this directory are kept only for future hardening work if AI features are reintroduced behind explicit consent and store-compliant privacy disclosures.

Files preserved here:

- `background.js`: Gemini REST request flow and prompt construction.
- `options.html`, `options.js`, `options.css`: API-key and model configuration UI.
- `manifest.ai.json`: previous manifest that referenced the AI-specific runtime.
