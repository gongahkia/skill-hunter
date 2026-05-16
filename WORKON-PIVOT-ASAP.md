# WORKON-PIVOT-ASAP

Pivot brief for `Rakuzaichi`. Goal: HN front page + GitHub stars. Direction: memory-vault. Brand: keep name + add tagline. Scope: drop NDJSON/XML/YAML, add MD/PDF.

## TL;DR

`Rakuzaichi` today = generic LLM chat exporter in a saturated, post-Show-HN niche. [Inference] Same pitch already shipped Feb 2026 (HN 46844001). To stand out we reframe from *exporter* → *local-first AI memory vault*: auto-backup, full-text search, tags/folders, Obsidian/Notion sync. Same code spine, new narrative + new hooks.

## Market findings (raw)

- Saturated competitors: ChatGPT Exporter (4.4★, freemium PDF), ExportGPT (4.8★), ChatGPT Export Assistant (4.9★), AI Toolbox (20k+ users, $9.99/mo or $99 LTD), Superpower ChatGPT (folders+search+export), Local AI Chat Exporter, llm-chat-exporter (multi-platform, same pitch).
- Built-in OpenAI export: free, ZIP-only, slow (up to 7d), requires active account, no per-chat selection, no images. Floor-not-ceiling competitor.
- HN signal exhausted: "lost my chat history → built exporter" already posted Feb 2026. Wrapped-style analytics post (46168782) ran low traction. Local-AI front-page hits go to *capability* posts not *export* posts.
- Privacy/data-loss anxiety is real and rising (Nature Jan 2026 case, ToS;DR D rating for OpenAI). Tailwind exists.
- Browser ext revenue: 10k users ≈ $1k–$10k/mo *if* monetized. Most make $0. Chrome Web Store payments dead since 2021 → ExtensionPay is incumbent rail. [Unverified] — sourced from monetization blogs, not audited.

## Positioning

- *Old*: "Export your LLM chat history to 6 formats." Forgettable, commoditized.
- *New*: "Your local-first memory vault for every LLM you use." Auto-captures, searches, exports, syncs.
- Tagline candidate: `Rakuzaichi — your private archive for every AI conversation.`

## Scope changes

**Drop** (low utility, high maintenance):
- NDJSON export
- XML export
- YAML export

**Add** (table stakes for adoption):
- Markdown export (per-chat, per-message)
- PDF export (print path is fine; no server)

**Keep**: CSV, TSV, JSON. [Inference] These cover spreadsheet users (CSV/TSV) and devs (JSON).

**Platforms**: keep all 9 for now. Revisit after install telemetry — drop the bottom 2 if usage <5%.

## Feature roadmap (memory-vault pivot)

Ordered by HN-demo leverage.

### M1 — Foundation (1–2 wk) ; ship as v3.0.0

1. Markdown exporter (per-chat + bulk). Reuse `converters.js`. // priority hook for devs.
2. PDF exporter via `window.print()` styled CSS. No external dep.
3. Background auto-capture: on chat URL change, snapshot DOM → IndexedDB. Manifest already has `alarms` + `storage`. Use `alarms` for periodic sweep.
4. CWS + AMO listings. Sideload-only kills adoption.

### M2 — Vault UX (2–3 wk)

5. Local IndexedDB store: `chats`, `messages`, `tags`, `meta`. Schema-versioned. // see existing `schema.js`.
6. Options page → full vault browser: list, filter by platform/date, full-text search (Lunr or MiniSearch, in-browser, no server).
7. Tag/folder UX. Drag-to-tag. Pinning.
8. "Restore to clipboard" + "Send to new ChatGPT chat" primer button.

### M3 — Demo-ready hooks (HN bait) (1–2 wk)

9. Obsidian sync: write MD files into a configured vault folder via File System Access API.
10. Notion sync via user's own integration token (no broker).
11. Per-chat shareable HTML (offline, single file) — for archive-the-web vibes.
12. *Optional but high-leverage:* "AI Wrapped"-style local stats page — counts/time/top words across vault. Pure client-side. Demo-friendly.

### M4 — Stretch (post-launch)

- Local RAG: embed vault into a tiny model (transformers.js) for "ask your past conversations."
- Cross-LLM primer generator: condense Claude convo → ChatGPT-pasteable preamble.
- Mobile read-only PWA over exported HTML bundles.

## HN launch plan

- **Title**: `Show HN: Rakuzaichi – local-first memory vault for ChatGPT, Claude, Gemini, and 6 more`
- **First comment template** ready: explain why-not-OpenAI-export, screenshots, GIF of auto-capture + search.
- **Demo asset**: 30s screencap — multi-platform capture → search across vault → export to Obsidian. No voiceover.
- **Repo polish**: README rewrite leading with the vault framing, not the export framing. Architecture diagram refreshed. Pin Wrapped-style screenshot.
- **Timing**: Tue/Wed 8–10am PT.

## Branding/tagline

- Name: `Rakuzaichi` retained.
- Tagline (primary): *Your private archive for every AI conversation.*
- Sub-tagline (dev surface): *Local-first. Multi-LLM. Open source.*
- README hero block: tagline first, kanji + manga reference moved to footer "Etymology" section.

## Risk register

- [Inference] Platforms changing DOM regularly → high maintenance burden. Mitigate via platform-adapter pattern (already partially present in `src/platforms/*.js`) and automated DOM-shape canary tests.
- [Inference] ToS friction: scraping authenticated chats *may* violate provider ToS. Add disclaimer (already present) + frame as "data you can already export — just better." Don't promise circumventing exports they don't permit.
- Manifest V3 background script lifetime limits — `alarms` + service worker only. No persistent background pages. Already MV3-compliant.
- Chrome Web Store review may flag broad host permissions. Pre-empt with clear privacy policy + zero-cloud claim verifiable from open source.

## Cut list (do NOT do)

- No SaaS backend. No cloud sync server. Zero-server is the entire moat.
- No subscription before there's an audience. ExtensionPay tier is M4+ at earliest.
- No fine-tune dataset builder yet — separate audience, splits focus.
- No mobile-native app yet.

## Open questions

- Telemetry: ship anonymous opt-in counts (which platforms get used) to inform platform-drop decisions, or stay zero-telemetry for HN purity? [Speculation] Zero-telemetry wins on HN.
- License: confirm MIT vs MPL. AMO prefers MPL for hybrid distribution. // verify before publishing.
- Icon refresh: current icon is fine but a vault/key motif would map better to the new positioning.

## Immediate next actions

1. Branch `feat/v3-vault`.
2. Rip NDJSON/XML/YAML from `converters.js` + tests + options UI.
3. Add MD + PDF converters.
4. Implement IndexedDB capture pipeline behind a feature flag.
5. README rewrite with new tagline + hero.
6. CWS developer account + AMO account, prep listing copy.

---

Sources researched (2026-05-16):
- HN 46844001 — Show HN: lost ChatGPT history → backup tool (Feb 2026)
- HN 46168782 — Show HN: Wrapped for ChatGPT/Claude history
- Chrome Web Store: ExportGPT, ChatGPT Exporter, ChatGPT Toolbox, Superpower ChatGPT, Local AI Chat Exporter
- OpenAI Help Center — official export limits
- Fortune Business Insights — data privacy software market 2026 ($5.37B → $45.13B by 2034, CAGR 35.5%)
- ExtensionPay / extensionradar.com — monetization data ($1k–$10k/mo at 10k users)
