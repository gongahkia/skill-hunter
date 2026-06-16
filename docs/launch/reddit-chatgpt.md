# r/ChatGPT Draft

## Title

I built a local memory vault for ChatGPT and other AI chats

## Body

I kept losing useful ChatGPT threads after they fell out of my active workflow, so I built Rakuzaichi.

It is a browser extension that captures AI chats into a local IndexedDB vault. From there you can search, tag, pin, put chats in folders, export to Markdown/JSON/CSV/TSV/HTML/PDF, sync Markdown to an Obsidian folder, and create encrypted vault backups.

The part I wanted most is the open-threads layer. It scans explicit TODO/FIXME/REF/PROMPT tags in messages, and it can run local extraction after a chat to surface unresolved follow-ups. The extraction path is local: Transformers.js in-browser, with model files downloaded from Hugging Face only when you use extraction. Chrome built-in Prompt API is used when available.

It currently targets ChatGPT plus Claude, Gemini, Perplexity, DeepSeek, Grok, Copilot, Mistral, HuggingChat, Poe, Kimi, Qwen/Tongyi, ChatGLM, Doubao, and NotebookLM.

No account, no Rakuzaichi server, no telemetry, no analytics.

Source: https://github.com/gongahkia/rakuzaichi

Feedback wanted: which ChatGPT workflows should a local vault support better than plain export?

## Posting Notes

- Verify live subreddit rules before posting.
- Use the demo GIF from `asset/reference/demo.gif` if media is allowed.
