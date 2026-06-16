# HN Post

## Title

Show HN: Rakuzaichi - local memory vault for AI chats

## Body

I built Rakuzaichi because my useful AI chats were scattered across ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Grok, Copilot, Mistral, HuggingChat, Poe, Kimi, Qwen/Tongyi, ChatGLM, Doubao, and NotebookLM.

It is a browser extension that captures chats into a local IndexedDB vault, then lets you search, tag, pin, folder, export, sync to Obsidian, and back up the archive. The pivot from "exporter" to "memory vault" is the open-threads layer: it scans explicit TODO/FIXME/REF/PROMPT tags and can run local extraction to surface unresolved follow-ups after the chat is over.

No account. No server. No analytics. No telemetry. The Transformers.js runtime is bundled; model weights are downloaded from Hugging Face only when local extraction is used, then cached by the browser. Chrome's built-in Prompt API is used when available.

The rough edges are normal extension rough edges: each LLM vendor changes DOMs, browser stores review host permissions closely, and local model downloads can be large. I am launching it anyway because the useful part is already working: a searchable, portable, zero-server AI-chat memory vault.

Source: https://github.com/gongahkia/rakuzaichi

## First Comment

Technical notes / likely questions:

Q: Why zero-server?
A: The product is a private archive of personal chats. The extension stores the vault in IndexedDB, writes exports/backups locally, and does not run a backend.

Q: What leaves the device?
A: User chat/vault data does not leave through Rakuzaichi. Optional local extraction may fetch model/config/tokenizer files from Hugging Face Hub. Those requests are model assets, not prompts.

Q: Why Qwen2.5-0.5B by default?
A: It is small enough for browser-side extraction while still useful for TODO/FIXME/REF/PROMPT-style follow-up detection. The UI also exposes Phi-3.5 mini, Gemma 3 1B, and Chrome built-in Prompt API when available.

Q: Why not just use the OpenAI export?

| Capability | OpenAI export | Rakuzaichi |
| :--- | :--- | :--- |
| Platforms | ChatGPT only | 15 LLM platforms |
| Latency | Async account export | Immediate local capture |
| Granularity | Whole-account ZIP | Per-chat, bulk, vault backup |
| Search | Outside the product | Local cross-platform search |
| Follow-ups | None | Explicit tags + local extraction |
| Storage | Vendor export flow | Local IndexedDB + local files |
| Server dependency | Vendor account flow | No Rakuzaichi server |

Q: Why host permissions for many domains?
A: Content scripts need exact per-domain access to read chat DOM content on supported LLM pages. The manifest enumerates the supported origins and does not request `<all_urls>`.

Q: What is not done yet?
A: Store approvals and hosted landing-page DNS/deploy are not verified in this repo.
