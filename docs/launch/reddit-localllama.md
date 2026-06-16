# r/LocalLLaMA Draft

## Title

Local LLM extraction for unresolved threads in AI-chat archives

## Body

I built Rakuzaichi, a zero-server browser-extension vault for AI chats. The extension captures chats locally, stores them in IndexedDB, and exposes search/export/sync/backups without sending the archive to a backend.

The LocalLLaMA-relevant piece is the open-threads extractor. It scans explicit tags like TODO/FIXME/REF/PROMPT and can also run local extraction with Transformers.js to find unresolved follow-ups after a conversation. Current presets include Qwen2.5-0.5B Instruct Q4, Phi-3.5 mini Q4, and Gemma 3 1B Q4. Chrome built-in Prompt API is used when available; otherwise browser-side Transformers.js runs with cached model files.

The extractor is intentionally small-task oriented. It is not trying to summarize everything or create a new chat assistant; it just turns long chat archives into actionable open threads.

Supported capture surfaces include ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Grok, Copilot, Mistral, HuggingChat, Poe, Kimi, Qwen/Tongyi, ChatGLM, Doubao, and NotebookLM.

Source: https://github.com/gongahkia/rakuzaichi

Feedback wanted: better browser-friendly extraction models, prompt shape, and chunking defaults.

## Posting Notes

- Verify live subreddit rules before posting.
- Be explicit that model weights may still be downloaded; inference and user prompts stay local in Rakuzaichi.
