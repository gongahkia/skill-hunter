# Rakuzaichi Privacy Policy

Draft for v3 store review. Last updated: 2026-06-16.

## Summary

Rakuzaichi is a zero-server browser extension. Captured chats, vault metadata, tags, folders, search indexes, extraction results, diagnostics, and export history are stored locally in the browser profile. Rakuzaichi does not run analytics, telemetry, crash reporting, or background phone-home.

## Local Data

Rakuzaichi stores the following data locally:

- Captured chat metadata: platform, title, URL, model, timestamps, pin/archive state, folder, and tags.
- Captured messages: role, content, timestamp, model, index, and platform metadata.
- Open threads: tag, text, source, status, confidence when applicable, and timestamps.
- Settings: export format, filename template, theme, colorscheme, tag priority, and custom thread tags.
- Local diagnostics and export history.

## Network Requests

Rakuzaichi does not send captured chat content to any server.

Local LLM extraction is opt-in. The extension bundles the Transformers.js runtime code in the extension package. On first extraction use, it may download model artifact files from `https://huggingface.co/` or `https://cdn.jsdelivr.net/`, depending on the final loader configuration. These requests are for model files only. They may reveal normal HTTP metadata to the host, including IP address, user agent, requested file path, and request time. Model artifacts are cached locally after download.

## Host Permissions

Rakuzaichi requests host permissions only for supported AI chat surfaces so the content script can read chat DOM content when the user visits those sites.

| Origin | Reason |
| :--- | :--- |
| `https://chat.openai.com/*` | Captures chat content from ChatGPT legacy URLs. |
| `https://chatgpt.com/*` | Captures chat content from ChatGPT. |
| `https://claude.ai/*` | Captures chat content from Claude. |
| `https://gemini.google.com/*` | Captures chat content from Gemini. |
| `https://perplexity.ai/*` | Captures chat content from Perplexity. |
| `https://www.perplexity.ai/*` | Captures chat content from Perplexity. |
| `https://chat.deepseek.com/*` | Captures chat content from DeepSeek. |
| `https://grok.com/*` | Captures chat content from Grok. |
| `https://copilot.microsoft.com/*` | Captures chat content from Microsoft Copilot. |
| `https://chat.mistral.ai/*` | Captures chat content from Le Chat Mistral. |
| `https://huggingface.co/chat/*` | Captures chat content from HuggingChat. |
| `https://poe.com/*` | Captures chat content from Poe. |
| `https://kimi.com/*` | Captures chat content from Kimi. |
| `https://chat.qwen.ai/*` | Captures chat content from Qwen Chat. |
| `https://tongyi.aliyun.com/*` | Captures chat content from Qwen/Tongyi Chat when served from Alibaba's Tongyi domain. |
| `https://chatglm.cn/*` | Captures chat content from ChatGLM. |
| `https://doubao.com/*` | Captures chat content from Doubao. |
| `https://www.doubao.com/*` | Captures chat content from Doubao. |
| `https://notebooklm.google.com/*` | Captures chat content from NotebookLM. |

## User Control

Users can delete extension data through the browser extension storage controls. Exported files are created only by explicit user action or configured local automation, and exported files become the user's responsibility to store or delete.
