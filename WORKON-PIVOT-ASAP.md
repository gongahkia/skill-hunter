# WORKON-PIVOT-ASAP

Pivot plan for Owl. Drafted 2026-05-16. Decisions made jointly with Claude after market research.

## 1. Decisions locked

| Axis | Choice |
| :--- | :--- |
| Optimize for | GitHub stars / HN virality |
| Pivot scope | Aggressive — replace the core |
| Primary audience | Knowledge workers / researchers (Google Docs-heavy) |
| Time budget | Heavy, ~full-time, 4–8 weeks |
| HN hook | AI-native: "Owl extracts open threads from your Docs" |
| Code reuse | Decide per-component during rebuild |
| Distribution | Manual Apps Script install (no OAuth verification) |

## 2. Honest market read (don't sugarcoat)

- Dev-side TODO aggregators are saturated. [Inference] Todo Tree alone has 6.8M+ VS Code installs. Obsidian has Tasks, TODO GTD, Tag Page, Tracker. Owl in nvim/vim/vscode/obsidian is a "me too."
- HN posted a "summarise all TODO/FIXME" tool in 2017. The bare concept is ~9 years old. HN-viral in 2026 needs a fresh substrate or a fresh hook.
- Google Docs *inline TODO with cross-doc aggregation + LLM extraction* is genuinely uncommon. Tag-a-Doc tags whole docs; Codex102 targets legal annotation; neither does what we're proposing.
- [Inference] HN→GitHub diffusion median is ~121 stars in 24h, ~289 in a week. Hitting front page with this hook is plausible but not guaranteed.
- Without OAuth verification, the Apps Script "Go to Untitled project (unsafe)" screen will hard-bounce a meaningful % of HN traffic. **This is the single biggest risk to the stars goal.** See §7.

## 3. The pivot — product

**One-line pitch:** Owl is an AI assistant that extracts every open thread — TODOs, unresolved questions, unfinished arguments, missing citations — from your Google Docs and surfaces them in a unified sidebar across all your documents.

**Core mechanic:**
- User installs Owl on Google Docs.
- Owl scans the current doc (and optionally a folder of docs) and produces a structured list of "open threads":
  - Explicit tagged items (`TODO:`, `FIXME:`, `REV:`, `TEMP:`, `REF:`) — current Owl behavior, salvaged.
  - **LLM-extracted implicit items**: unresolved questions, hedged claims, dangling references, contradictions, missing citations. This is the new wedge.
- Each open thread is clickable → jumps to in-doc location.
- Cross-doc dashboard: "show me every open REV across my Constitutional Law folder."

**Why this is HN-viral-shaped:**
- Concrete, demoable in a 20-second gif (open doc → sidebar populates → click → cursor jumps).
- Solves a real pain (knowledge workers leave half-finished threads everywhere).
- Has a clever frame ("code-style annotations, but the AI finds the ones you forgot to write").
- Bridges dev nostalgia (TODO comments) with knowledge-work utility.

**Why it could flop:**
- AI fatigue on HN is real. Mitigate by leading the demo with the *non-AI* explicit-tag behavior, then revealing the AI extraction as the "and one more thing" beat.
- Many "AI reads your docs" tools already exist (Notion AI, Gemini in Docs). Differentiator must be: **opinionated extraction taxonomy** (5 tags) + **cross-doc aggregation** + **fast/keyboard-driven**, not chat.

## 4. What stays / goes / is new

### Stays (salvage)
- `src/main/` — Apps Script core for Docs. **Primary surface.** Refactor heavily but keep.
- `src/gas-core/` — shared GAS code. Keep, refactor.
- `src/main/SheetsOwlSidebar.html`, `SlidesOwlSidebar.html` — keep Sheets/Slides as **secondary surfaces** (free reach, same backend).
- `src/cli/` — Go CLI. Reposition as the **"power user / CI"** surface: scan a folder of local Markdown / exported Docs. Keep as a hook for the dev-leaning HN crowd.
- Tag taxonomy (TODO/FIXME/REV/TEMP/REF). Keep. It's the unique opinionated frame.
- Colorscheme system. Keep, polish. Visually distinctive.

### Goes (delete)
- `src/vim/` — delete. Out of scope.
- `src/nvim/` — delete. Out of scope.
- `src/vscode/` — delete. Out of scope. (Todo Tree owns this.)
- `src/obsidian/` — delete. Out of scope. (Tasks plugin owns this.)
- `src/webext/` — delete unless it's the path to sidestep OAuth (§7 option D). Default: delete.
- `src/docs/`, `src/sheets/`, `src/slides/` — audit; if these are duplicate of `src/main/`, delete.

### New (build)
- **LLM extraction service.** A backend (Cloudflare Workers / Fly / Vercel Edge) that takes doc text and returns structured open-thread JSON. Model: Claude Haiku 4.5 for cost, Sonnet 4.6 for quality tier.
- **Cross-doc index.** User connects Owl to a Drive folder; backend indexes tagged + extracted items. Lightweight DB (D1, Turso, or Postgres-on-Fly).
- **Dashboard UI.** Single-page web app at `owl.<domain>` showing all open threads across all indexed docs. Filter by tag, doc, date.
- **Polished install flow.** Even without OAuth verification, the README and demo gif must front-load value before the "unsafe" warning.
- **Killer demo gif.** Non-negotiable. The HN post lives or dies on this asset.

## 5. Architecture sketch

```
[Google Doc] ──Apps Script sidebar──▶ [Owl Backend API]
                                          │
                       ┌──────────────────┼──────────────────┐
                       ▼                  ▼                  ▼
                  [Tag scanner]      [LLM extractor]    [Cross-doc index DB]
                       │                  │                  │
                       └────────►  Unified open-thread JSON  ◄┘
                                          │
                                          ▼
                                    [Dashboard SPA]
                                          │
                                          ▼
                                  [Go CLI for power users]
```

Stack proposal (open to revision):
- Apps Script frontend in Docs/Sheets/Slides (existing).
- Backend: Cloudflare Workers + D1, or Fly + Postgres. Pick by week 1.
- LLM: Claude Haiku 4.5 default, Sonnet 4.6 opt-in. Prompt caching mandatory (cost).
- Dashboard: SvelteKit or Next.js. Pick the one you ship faster in.
- CLI: keep Go, extend to call the same backend.

## 6. 6-week plan (heavy budget)

- **Week 1 — destroy + design.** Delete vim/nvim/vscode/obsidian/webext. Pick backend stack. Define the open-thread JSON schema. Wire up Claude API + prompt caching. Write the extraction prompt and iterate on 10 sample docs.
- **Week 2 — backend MVP.** Stand up the extractor service. Tag scanner port from Apps Script logic to backend. Single-doc extraction end-to-end. CLI calls the same endpoint.
- **Week 3 — sidebar rewrite.** Refresh Apps Script sidebar to show both explicit + AI-extracted threads. Inline-jump on click. Color-coded by tag. Keyboard shortcuts.
- **Week 4 — cross-doc index + dashboard.** User connects a Drive folder; backend crawls + indexes. SPA dashboard with filter/search. Real-time refresh.
- **Week 5 — polish + demo asset.** Pixel-polish sidebar + dashboard. Record the 20-second demo gif. Write the HN post. Build a `owl.<domain>` landing page. Write `INSTRUCTIONS.md` rewrite. Pre-seed: post to 2–3 niche subreddits + r/ObsidianMD + tweet thread for soft launch.
- **Week 6 — HN launch.** Post Tuesday or Wednesday 8–10am Pacific. Engage every comment in the first 4 hours. Have a backup AI-skeptic talking point ready ("the explicit-tag mode works with no LLM call").

Buffer weeks 7–8: handle post-launch issues, ship requested features from HN feedback, second wave on r/programming.

## 7. The OAuth tension — explicit risk register

**Decision:** ship without OAuth verification. **Honest consequence:** users hit "Go to Untitled project (unsafe)" before they see any value. Estimated bounce rate at this screen: 40–70%. [Speculation]

Mitigations to consider during weeks 4–5:

- **Option A — front-load value with hosted demo.** Embed a live, pre-populated demo on the landing page so HN clickers see the product *before* deciding to install. This way the "unsafe" warning gates only the high-intent users. **Recommended.**
- **Option B — Chrome extension fallback.** Build a thin Chrome extension that does DOM injection on `docs.google.com` for explicit-tag scanning. AI extraction stays server-side. Sidesteps OAuth entirely. ~1 week of work; consider if Option A traffic still bounces.
- **Option C — defer verification, schedule it.** File OAuth verification on launch day so post-spike adopters get the clean install within 4–6 weeks.
- **Option D — accept the bounce.** HN post + stars are the goal, not active users. If the demo gif + repo are good, you'll get stars without conversions. Honest but cynical.

**Default to A. Schedule C. Reserve B if A underperforms.**

## 8. Risks / things that could kill this

1. **AI extraction quality is mediocre.** If the LLM produces noisy or obvious extractions, the demo falls flat. Mitigation: prompt-engineer + few-shot heavily in week 1. Budget 3+ days on prompt quality alone.
2. **Demo gif is not striking enough.** Mitigation: pay a designer for landing page; spend an entire day on the gif; iterate 5+ takes.
3. **HN post lands at wrong time / dies in /new.** Mitigation: soft-launch on niche channels first to gather initial votes; time the HN post for Tue/Wed morning Pacific; have 3+ friends ready to engage (not vote-ring; just upvote-quality comments).
4. **Google Apps Script quota limits hit at scale.** Mitigation: backend does heavy lifting; Apps Script is a thin client.
5. **Claude API cost spirals.** Mitigation: prompt caching mandatory; Haiku 4.5 default; rate-limit anonymous users; only authenticated users get cross-doc indexing.
6. **Distribution friction (§7) sinks conversion despite stars.** Accepted risk — stars-not-users is the explicit goal.
7. **Scope creep back to 7 surfaces.** Mitigation: this doc. Re-read it weekly.

## 9. Non-goals (write down to resist)

- Re-adding Vim / Neovim / Obsidian / VS Code integrations during the 6-week sprint.
- Building a custom auth system. Use Google Sign-In, period.
- Mobile app. Defer indefinitely.
- Enterprise/team features. Defer to post-launch v2.
- "Make money." Explicitly not the goal for this sprint. Revisit at week 8.

## 10. Brand / naming

Keep `Owl`. Keep the Kagurabachi reference (it's distinctive flavor). Keep the colorschemes (visual signature). Tighten the README to lead with the new pitch in the first paragraph.

## 11. Definition of done for this pivot

By end of week 6:
- [ ] All 4 deleted surfaces removed from `src/`.
- [ ] Backend deployed, public endpoint live.
- [ ] Apps Script sidebar refactored, both modes (explicit + AI) working.
- [ ] Dashboard SPA live at a real domain.
- [ ] 20-second demo gif recorded, embedded in README.
- [ ] Landing page with hosted demo live.
- [ ] HN post drafted, scheduled.
- [ ] At least 5 friendly users (Slack/Discord/IRL) have tested end-to-end.

By end of week 8 (post-launch):
- [ ] HN post submitted and at least front-page-attempted.
- [ ] >= 500 GitHub stars (stretch: 2k+). [Speculation, calibrated to typical viral dev tool]
- [ ] OAuth verification application filed.
- [ ] Post-mortem written, lessons captured.
