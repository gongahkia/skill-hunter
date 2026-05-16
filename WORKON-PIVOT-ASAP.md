# WORKON-PIVOT-ASAP

Working doc for Dorso v3.0 pivot. Output of a strategy session on 2026-05-16. Captures market research, the decisions made, the v3.0 cut list, risks, and the ship plan. Optimize for HN front page first, real users second.

---

## 1. Current state of Dorso (as of 2026-05-16)

- Product: browser extension that gates web AI chatbots (ChatGPT, Claude, Gemini, Perplexity, Copilot, DeepSeek, etc.) behind a correctly-answered LeetCode question. 15-minute session on success.
- Stack: JS extension (Chrome/Firefox/Safari builds) + Django backend + PostgreSQL + Redis + Prometheus + Grafana + Docker.
- Distribution: Firefox AMO v1.0 and v2.0 listed. Chrome Web Store: awaiting approval. Safari: unsupported (skeleton only).
- Traction: AMO listing shows **0 users, 0 reviews** on v1.0. Effectively pre-launch.
- Repo: solo author (gongahkia). Recent commits show backend feature creep (mood/Spotify experiments under `sato` history merge) that does not belong in the shipped product.

---

## 2. Market research

### 2.1 Tailwinds (the zeitgeist is on our side)

2026 is the peak of the "AI is rotting developers" media cycle. Recent signal:

- MIT study on cognitive decline from AI use [discussed on HN](https://news.ycombinator.com/item?id=45114753).
- Shen & Tamkin 2026 preprint: devs who fully delegated to AI performed **17% worse** on conceptual quizzes about code they had just shipped. (Surfaced in [Psychology Today](https://www.psychologytoday.com/us/blog/the-algorithmic-mind/202603/adults-lose-skills-to-ai-children-never-build-them).)
- HBR Mar 2026: ["When Using AI Leads to Brain Fry"](https://hbr.org/2026/03/when-using-ai-leads-to-brain-fry).
- TechSpot: ["Forced to vibe code at work, programmers say their skills are deteriorating"](https://www.techspot.com/news/112415-forced-vibe-code-work-programmers-their-skills-deteriorating.html).
- Stack Overflow blog: ["A new worst coder has entered the chat: vibe coding without code knowledge"](https://stackoverflow.blog/2026/01/02/a-new-worst-coder-has-entered-the-chat-vibe-coding-without-code-knowledge/).
- HN already eating tools in this space: ["Show HN: Dev atrophy test"](https://news.ycombinator.com/item?id=44507369), ["Ask HN: How to avoid skill atrophy in LLM-assisted programming era?"](https://news.ycombinator.com/item?id=46783679).

[Inference] The "AI hygiene" narrative is hot enough to carry a Show HN launch right now. The window will close as the topic saturates; ship in months, not quarters.

### 2.2 Competitive landscape

| Tool | Concept | Stats | Weakness |
| :--- | :--- | :--- | :--- |
| [LeetCode Torture](https://chrome-stats.com/d/clbhgfneekiimoaakhhdjimgnnbnfbeh) | Block all sites until LC solve | 2.9★ avg, low installs | Repeated questions, broken submission detection, no customization, broad site-block hurts UX |
| [LeetCode Forcer](https://chromewebstore.google.com/detail/leetcode-forcer-beat-proc/bfhandefodflloblgbmckmildnmangcb) | Redirect to LC until daily solved | 1,000 users, 4.5★ | Last updated 2023, breaks on new LC UI, no Firefox/Safari, no AI-chatbot targeting |
| [Leetblock](https://chromewebstore.google.com/detail/leetblock-block-leetcode/dopkcagmapfpgabhpnbdonlejcidmpel) | Block other LC users | 84 users, 5★ | Unrelated to Dorso's thesis (mute, not gate) |
| [DeProcrastination](https://www.deprocrastination.co/extension) | Generic site blocker w/ Pro tier | Mature | Generic, not coder-flavored, no AI angle |

**Dorso's wedge:** target **AI chatbots specifically** (not the whole web), use **a relevant gate** (a coding question — thematic match), and **ship in 2026** while the narrative is hot. Nobody else combines all three.

### 2.3 Monetization signal

Anti-procrastination / focus extensions monetize fine: subscriptions, one-time purchases, freemium. Examples in [extensionpay.com analysis](https://extensionpay.com/articles/browser-extensions-make-money) hit four-to-five-figure MRR with 10k users.

[Inference] Revenue is not the v3.0 goal (see §3). But the category is monetizable later if installs land.

### 2.4 Verdict on market viability

- **As a sellable product:** weak-to-moderate. Self-flagellation purchases are a small TAM; willingness-to-pay is low among the loudest target audience (interview-prep grinders, hair-shirt productivity nerds). A B2B angle (bootcamps / CS departments / new-hire onboarding) is plausible but not the current shape.
- **As a viral GitHub / HN product:** **strong, time-limited**. Premise is meme-shaped, narrative is in season, demo screenshots ("ChatGPT is locked behind a LeetCode problem") sell themselves, competitors are stale, and the author has a credible voice ("braindead programmers" tone is on-brand for HN).
- **Recommendation:** sharpen the current shape, fix the three weakest legs, launch loud, harvest stars, then decide whether to chase users or revenue.

---

## 3. Decisions made this session

| # | Decision | Rationale |
| :--- | :--- | :--- |
| D1 | **Sharpen current shape** (no reframe, no B2B pivot, no separate viral wedge product) | Lowest-risk evolution; existing positioning is already on-trend; product is mostly there |
| D2 | **Delete the backend entirely** | Django/PG/Redis/Prometheus/Grafana is wildly over-engineered for "fetch a coding problem." Distribution friction; reviewer red flags; privacy story improves; "no server, no tracking" is itself an HN talking point |
| D3 | **Primary metric: stars first, real users second** | HN front page + GitHub stars are cheap and time-sensitive; users follow stars; revenue can wait |
| D4 | **Keep the "braindead programmer" tone** | It's the brand. Softening to "AI-free focus mode" would compete with DeProcrastination etc. on their turf. Punchy framing is a feature |
| D5 | **Add 3 new challenge sources** beyond LeetCode | Fixes the #1 LC Torture complaint (repetition) and removes the LC-GraphQL single point of failure |
| D6 | **Add Atrophy Score (shareable badge) + per-solve lock-screen receipt** | Two layered viral artifacts: high-frequency low-friction (receipts) and high-status low-frequency (score badge on LinkedIn/X) |

---

## 4. v3.0 cut list

### 4.1 IN — what ships

**Core gate (keep, simplify):**
- Existing chatbot blacklist (`src/shared/core/constants.js` is fine as-is).
- 15-min session on successful solve (`SESSION_DURATION_MS` unchanged).
- Manifest V3 builds for Chrome + Firefox; Safari wrapper as time permits.

**Challenge sources (new, all client-side):**

1. **Type-from-memory drills** — user types a stdlib function signature, an algo skeleton (e.g. quicksort partition), or a syntax snippet from memory. Levenshtein-tolerant match. Bundled JSON pack, no API.
2. **Fundamentals MCQ bank** — bundled JSON of CS fundamentals (Big-O, DS internals, language quirks, concurrency basics). 200+ Qs at launch; tag by difficulty.
3. **Project Euler / Advent of Code static set** — bundled subset (public-domain phrasing where possible; otherwise link out with problem ID and verify by numeric answer). No API.
4. **LeetCode** stays as a source for users who want it, but is no longer the only source and no longer the default.

User chooses sources in popup; rotation algo avoids recent repeats (extend existing `RECENT_CHALLENGE_SLUGS` pattern).

**Viral surface (new, all client-side):**

5. **Lock-screen receipt** — every successful solve renders a small PNG/SVG card: problem title, time-to-solve, current streak, Dorso wordmark. One-tap "share" copies image + suggested caption. High-frequency, low-friction; designed to leak organically.
6. **Atrophy Score (public badge)** — derived from: bypass attempts, average time-to-solve, fail rate, solves-per-week, streak length. Single integer 0–100 (lower = more atrophied, on purpose: makes "low score" the badge). Exports as shareable card for X/LinkedIn/Bluesky. URL of the badge is a static rendered image (no backend; embed score in URL params, generate image client-side, upload to a static host like imgur via user action OR render via a thin Cloudflare Worker if needed — TBD; default plan is purely local download).

**Polish:**

7. Onboarding popup rewrite — 3 panels: pick sources, pick chatbots to gate, see your first receipt.
8. Streak tracking in `chrome.storage.local` (already partially modelled via `LAST_SOLVED_TIME`).
9. README rewrite with new screenshots, the atrophy thesis up top, demo GIF.

### 4.2 OUT — what gets deleted

- `backend/` directory — **entirely deleted** (not archived).
- `docker-compose.yml` — deleted.
- `monitoring/` — deleted.
- `.env.example` — replaced with extension-only env (likely empty).
- `safari/DorsoSafari` — kept (low cost) but not blocking launch.
- Any Django/REST/Prometheus refs in README, CI, requirements.
- `artifacts/dorso-firefox-2.1.0-source-staging-*` — audit, keep only what the AMO submission needs.
- The `sato` merge ghosts (mood/Spotify) — confirm they have already been excised by commit `88ffab2` ("Restore dorso working tree to pre-merge state"); if any orphan files remain, delete.

### 4.3 EXPLICITLY DEFERRED (not in v3.0)

- B2B / bootcamp dashboard.
- Premium tier / payments.
- "Dev Atrophy Index" as a separate marketing-site tool.
- Cross-device sync (intentionally giving up; "no server" is the story).
- Mobile.

---

## 5. Launch / ship plan

**Target: HN Show HN post within 4 weeks.** Tuesday or Wednesday 8–10am ET launch window.

### Sequence

1. **Week 1 — Demolition.** Delete backend, docker-compose, monitoring. Update CI to drop Python jobs. Verify Chrome + Firefox builds still pass. Tag `v2.x-final` before deletion so the old shape is preserved in git history.
2. **Week 2 — Challenge sources.** Implement the three new sources behind a unified `ChallengeProvider` interface in `src/shared/core/`. Bundle the JSON packs. Add source-picker to popup. Update tests in `src/shared/__tests__/`.
3. **Week 3 — Viral surface.** Lock-screen receipt renderer (canvas/SVG). Atrophy Score calculation + share-card export. Streak persistence. Wire into popup.
4. **Week 4 — Launch prep.** README rewrite, demo GIF, new screenshots, Chrome Web Store resubmission, AMO update, Show HN draft (title candidates below), Twitter/Bluesky thread, badge embed snippet for users to paste into their READMEs (compounding distribution).

### Show HN title drafts

- `Show HN: Dorso – CAPTCHA for braindead programmers (block AI chatbots behind a coding question)`
- `Show HN: Dorso – Block ChatGPT/Claude/Gemini until you solve a coding problem`
- `Show HN: Dorso – An AI-fast for your browser. No server, no tracking.`

[Speculation] First framing leans into the meme and the existing brand; likely strongest. A/B with the third (the no-server angle) if first underperforms in pre-flight tests.

### Success criteria

- **HN:** ≥150 points and ≥80 comments within 24h of post. Stretch: front page.
- **Stars:** ≥1k GitHub stars within 30 days of launch.
- **Installs:** ≥5k combined Chrome + Firefox within 60 days.
- **Press:** ≥1 pickup by a developer-trade outlet (Hacker Newsletter, TLDR, devto, Stack Overflow blog).

---

## 6. Risks and open questions

| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Chrome Web Store still pending; could reject the v3.0 too | Med | Ship Firefox first; treat Chrome as bonus |
| LeetCode GraphQL is unofficial → could break; was a load-bearing dependency in v2.x | Low (after pivot) | LC becomes one of four sources; bundled JSON sources are immune |
| "Braindead" framing offends a reviewer / store team | Low | Have a sanitized variant of store-listing copy ready; keep the meme in README only |
| Atrophy Score derided as gamification gimmick | Med | Lean into it; the meme *is* the gimmick; the score doesn't need to be psychometrically valid |
| Image hosting for shared badges adds infra back in | Low | Default: user downloads PNG and posts manually. No hosting needed. Worker-rendered URLs are a stretch goal |
| MIT/HBR-style "AI atrophy" narrative cools before launch | Med | 4-week ship window is tight specifically to beat saturation |
| Solo maintainer burnout post-launch if traction lands | Med | Pre-write a CONTRIBUTING.md and tag good-first-issues for the challenge JSON packs (community-maintainable) |

### Open questions to resolve during week 1

- Do we publish challenge JSON packs in-repo (community PRs) or as separate releases? In-repo lowers friction.
- Atrophy Score formula — calibrate against the author's own usage for 1 week before locking.
- Do we keep the Python `helper/scraper.py` and `helper/serialize.py`? If they only served the deleted backend, delete them too.
- Tag-and-archive of v2.x: pure git tag, or a branch?

---

## 7. Sources / receipts

- [Psychology Today — Adults Lose Skills to AI](https://www.psychologytoday.com/us/blog/the-algorithmic-mind/202603/adults-lose-skills-to-ai-children-never-build-them)
- [HBR — When Using AI Leads to Brain Fry](https://hbr.org/2026/03/when-using-ai-leads-to-brain-fry)
- [HN — MIT Study: AI Reprograms the Brain](https://news.ycombinator.com/item?id=45114753)
- [TechSpot — Forced to vibe code, skills deteriorating](https://www.techspot.com/news/112415-forced-vibe-code-work-programmers-their-skills-deteriorating.html)
- [Stack Overflow — Vibe coding without code knowledge](https://stackoverflow.blog/2026/01/02/a-new-worst-coder-has-entered-the-chat-vibe-coding-without-code-knowledge/)
- [HN — Show HN: Dev atrophy test](https://news.ycombinator.com/item?id=44507369)
- [HN — Ask HN: avoid skill atrophy in LLM era](https://news.ycombinator.com/item?id=46783679)
- [Chrome Stats — LeetCode Torture](https://chrome-stats.com/d/clbhgfneekiimoaakhhdjimgnnbnfbeh)
- [Chrome Web Store — LeetCode Forcer](https://chromewebstore.google.com/detail/leetcode-forcer-beat-proc/bfhandefodflloblgbmckmildnmangcb)
- [Chrome Web Store — Leetblock](https://chromewebstore.google.com/detail/leetblock-block-leetcode/dopkcagmapfpgabhpnbdonlejcidmpel)
- [DeProcrastination extension](https://www.deprocrastination.co/extension)
- [ExtensionPay — indie revenue examples](https://extensionpay.com/articles/browser-extensions-make-money)

---

*Author: strategy session w/ Claude Opus 4.7 (1M ctx). Owner: gongahkia. Status: live working doc — edit freely as v3.0 progresses.*
