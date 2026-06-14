# Platform chatId strategies

All adapters prefer the last stable URL path segment for `chatId`. If a chat UI lacks a usable path segment, `content-script.js` falls back to a deterministic hash of first-message content, first-message timestamp, and page title.

| Platform | URL pattern | Primary `chatId` source | Fallback |
| :--- | :--- | :--- | :--- |
| ChatGPT | `chat.openai.com/*`, `chatgpt.com/*` | last URL path segment, usually `/c/<id>` | first message + timestamp hash |
| Claude | `claude.ai/*` | last URL path segment, usually `/chat/<id>` | first message + timestamp hash |
| Gemini | `gemini.google.com/*` | last URL path segment, usually `/app/<id>` | first message + timestamp hash |
| Perplexity | `perplexity.ai/*`, `www.perplexity.ai/*` | last URL path segment, usually `/search/<slug>` | first message + timestamp hash |
| DeepSeek | `chat.deepseek.com/*` | last URL path segment, usually `/a/chat/<id>` | first message + timestamp hash |
| Grok | `grok.com/*` | last URL path segment, usually `/chat/<id>` | first message + timestamp hash |
| Copilot | `copilot.microsoft.com/*` | last URL path segment, usually `/chats/<id>` | first message + timestamp hash |
| Le Chat Mistral | `chat.mistral.ai/*` | last URL path segment, usually `/chat/<id>` | first message + timestamp hash |
| HuggingChat | `huggingface.co/chat/*` | last URL path segment, usually `/conversation/<id>` | first message + timestamp hash |
| Poe | `poe.com/*` | last URL path segment, usually `/chat/<id>` | first message + timestamp hash |
| Kimi | `kimi.com/*` | last URL path segment, usually `/chat/<id>` | first message + timestamp hash |
| Qwen Chat | `chat.qwen.ai/*`, `tongyi.aliyun.com/*` | last URL path segment | first message + timestamp hash |
| ChatGLM | `chatglm.cn/*` | last URL path segment | first message + timestamp hash |
| Doubao | `doubao.com/*`, `www.doubao.com/*` | last URL path segment | first message + timestamp hash |
| NotebookLM | `notebooklm.google.com/*` | last URL path segment, usually notebook/thread id | first message + timestamp hash |
