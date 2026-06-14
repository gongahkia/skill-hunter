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
