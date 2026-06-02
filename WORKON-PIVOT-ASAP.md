# WORKON-PIVOT-ASAP

Working pivot doc. Author: gongahkia (with Claude). Date: 2026-05-16.

Goal of this doc: capture the agreed pivot direction so future-me (and Claude) can pick up without re-doing the discussion. Terse. Opinionated. Concrete.

## 1. Market diagnosis (the brutal version)

- Repo today: 1 star, 0 forks, 1 watcher. v4.1.0. Four iterations, ~zero adoption.
- Current TAM: SG-admitted lawyers (~6.5k) + foreign lawyers (~1.4k) + SG law students (~3-4k) ≈ <12k humans, single jurisdiction. Even 100% capture is tiny. [Unverified — Law Society of Singapore stats page; ssqAsia 2025 foreign-practice report]
- Direct competitor "SG Legal Citation Extension" sits at 72 WAU / 2.3★ on the Chrome Web Store. That is the realistic ceiling for SG-only legal browser extensions. [Unverified — chrome-stats.com]
- Lawyers already pay SGD ~207/mo for LawNet. [Inference] They will not pay anything for "ELIT reads nicer." Not a sellable product as-is.
- SMU + MinLaw are building SOLID (Singapore Open Legal Informatics Database) — a publicly-funded open empirical legal DB + API, 2025 onward. [Unverified — SMU newsroom 2025-11-18]. Anything we ship as "free SG judgment data" will get out-resourced; we either differentiate or collaborate.
- What is actually working in 2026 [Unverified — HN + Legal Cheek + Artificial Lawyer 2026 coverage]:
  - **Mike** (open-source legal AI alt to Harvey/Legora): 1k stars in 72h, ~3k now.
  - **LLMFeeder** (page → clean MD for LLM clipboard): Show HN traction.
  - **Unclutter** (better reader mode): persistent HN coverage.
- Pattern: generic LLM-context tools and open-source legal AI go viral. SG-only utilities do not.

## 2. Pivot decisions (locked in this session)

| Question | Decision |
|---|---|
| Name | **Keep `Judgeman`**, broaden the tagline. Anime ref stays as flavor. |
| Direction | **Generalize to a common-law reader.** Pluggable jurisdiction adapters. |
| Jurisdictions in v5.0 | **SG (ELIT), UK (BAILII), AU (AustLII), Canada (CanLII), US (CourtListener / Justia / Google Scholar).** All five at launch. |
| Goal | **GitHub stars + HN virality.** Not revenue. Not enterprise. |
| Scope tolerance | **Big rewrite OK.** Refactor `extractor.js` into a multi-adapter system. |
| AI integration | **All four modes, phased, all with tests.** BYOK → hosted backend → local-only → no-AI fallback. |
| Backend | **Hybrid — self-hostable Docker + free rate-limited hosted demo.** |
| Companion surfaces | **Static web reader** (paste URL → clean view, zero install). No API, CLI, or MCP in v5.0 (consider for v6). |

New tagline (working): *"Judgeman — open-source reader and AI assistant for common-law judgments. SG, UK, AU, CA, US."*

## 3. Architecture (target shape)

```
judgeman/
  packages/
    core/                       // pure JS, no DOM, no chrome.*
      adapters/
        index.js                // registry
        sg-elit.js              // ports current extractor.js
        uk-bailii.js
        au-austlii.js
        ca-canlii.js
        us-courtlistener.js
        us-justia.js
        us-google-scholar.js
      schema.js                 // canonical Judgment shape (typed via JSDoc + zod-lite)
      citation/                 // moves from src/citationAdapters.js
      analysis/                 // moves from src/caseToolkit.js
      renderers/
        html.js                 // reader view HTML
        markdown.js             // LLM-friendly export
        json.js
    extension/                  // current judgeman_v4/src/, slimmed
      contentScript.js          // detects jurisdiction, calls core adapter
      contentApp.js
      popup.*
      panel.css
      manifest.chrome.json
      manifest.firefox.json
      manifest.safari.json
    web/                        // new — static reader at judgeman.app/r?url=...
      index.html
      reader.js                 // imports @judgeman/core
      worker.ts                 // Cloudflare Worker: fetch + run adapter server-side for CORS-blocked pages
    backend/                    // new — hosted AI proxy + rate limits
      worker.ts                 // Cloudflare Workers + KV for rate-limit buckets
      providers/
        gemini.ts
        openai.ts
        anthropic.ts
        ollama-client.ts        // proxy to user-supplied ollama base url
    ai/                         // shared prompt + tool definitions
      prompts/
        summary.md
        ratio.md
        casemap.md
      schema.ts                 // strict JSON schemas for each task
  tests/
    adapters/*.test.js          // golden-file tests per adapter (real saved HTML fixtures)
    core/*.test.js
    ai/*.test.js                // mocked LLM calls + a live-call ring-fenced suite
    e2e/*.test.js               // playwright: real BAILII/AustLII/etc pages
```

Migration path from current tree:
- `judgeman_v4/src/extractor.js` → `packages/core/adapters/sg-elit.js` (1:1 port; keep current behavior bit-exact).
- `judgeman_v4/src/caseToolkit.js` → `packages/core/analysis/`. Strip DOM coupling.
- `judgeman_v4/src/citationAdapters.js`, `citationLinker.js` → `packages/core/citation/`.
- `judgeman_v4/src/contentApp.js`, `contentScript.js`, `popup.*`, `panel.css` → `packages/extension/`.
- `judgeman_v4/experimental_ai/*` → seed `packages/backend/` + `packages/ai/`. The Gemini REST flow in `experimental_ai/background.js` is the BYOK starting point.
- `scripts/build-extension.mjs`, `package-firefox-submission.mjs`, `generate-safari-project.mjs` → keep, point at `packages/extension/`.

Workspaces: switch root `package.json` to npm workspaces. Keep `private: true`. No publish to npm.

## 4. Phased plan

### Phase 0 — Foundation refactor (no user-visible change)
1. Set up npm workspaces.
2. Extract canonical `Judgment` schema (caseTitle, caseNumber, court, coram, parties, counsel, date, jurisdiction, issues[], sections[{title, paragraphs[]}], citations[], rawHtml).
3. Move ELIT logic into `adapters/sg-elit.js`. Keep `extractor.js` as a thin shim that re-exports for back-compat during transition.
4. Golden-file test: feed the current ELIT fixture (used in existing `tests/*.test.js`) through the new adapter, assert byte-stable output vs. legacy.
5. Run `npm run verify`. CI must stay green.

Exit criteria: zero regression. Build artifacts for chrome/firefox/safari identical (or trivially identical) to current `dist/`.

### Phase 1 — Multi-jurisdiction adapters
For each of BAILII, AustLII, CanLII, CourtListener, Justia, Google Scholar:
1. Collect 3 real-page fixtures per adapter into `tests/fixtures/<jurisdiction>/`.
2. Write the adapter. Output the canonical `Judgment` shape.
3. Golden-file tests pinned to each fixture.
4. Wire `contentScript.js` to detect host + dispatch to the right adapter (host map in `adapters/index.js`).
5. Update extension `host_permissions` in all three manifests.

[Inference] CanLII pages are already well-structured; the win there is consistency-of-output, not readability. Worth shipping for the "Commonwealth + US" headline.

Exit criteria: install extension, visit one judgment page per jurisdiction, get a clean reader view. Five for five.

### Phase 2 — Static web reader (`judgeman.app/r?url=...`)
1. New `packages/web/`. Vite + vanilla JS (no framework — keeps bundle small, HN-pleasing).
2. Cloudflare Worker proxies the fetch (cases routinely CORS-block direct browser fetches), runs the adapter server-side, returns canonical JSON.
3. Reader UI imports the same `renderers/html.js` the extension uses → byte-identical view across extension and web.
4. Deploy to Cloudflare Pages + Workers. Free tier covers launch. [Inference]
5. Demo link in README. This is the headline asset for Show HN — zero install, paste a URL, see the magic.

Exit criteria: paste a BAILII/AustLII/ELIT/CanLII/CourtListener/Justia/Scholar URL, get the reader view in <2s p95.

### Phase 3 — AI: BYOK (Mode 1)
1. Resurrect `experimental_ai/background.js` into `packages/extension/background.js`. Add OpenAI, Anthropic, and Ollama-base-URL providers alongside Gemini.
2. Options UI lets user pick provider + paste key (or Ollama URL). Keys stored in `chrome.storage.local` only — never sync, never leave the device.
3. Three AI tasks at launch:
   - **Summary** (plain text, ≤180 words, refuse to fabricate).
   - **Ratio + holding + issues extractor** (strict JSON schema).
   - **Case map** (nodes/edges JSON, ≤10 nodes / ≤14 edges — keep the existing schema from `experimental_ai/background.js`).
4. Prompts live in `packages/ai/prompts/*.md` so they version cleanly.
5. Tests:
   - Mocked-LLM unit tests asserting prompt assembly, JSON parsing, error paths.
   - "Live" suite (skipped by default; runs in CI on a label) that hits each provider with a tiny prompt and asserts shape, not content.
   - Schema-conformance tests for ratio/casemap outputs against `ai/schema.ts`.
6. Privacy disclosures + store listings updated. Per-store: Chrome Web Store, Firefox AMO, Safari (xcrun). Document the BYOK posture loudly in `README.md` and the store description — it is store-review armor.

Exit criteria: a user with their own Gemini/OpenAI/Anthropic key, or a local Ollama, can hit "Summarize" / "Extract ratio" / "Map case" from the panel on any of the five jurisdictions.

### Phase 4 — AI: hosted backend (Mode 2)
1. `packages/backend/worker.ts`: Cloudflare Workers + KV.
2. Free tier with anonymous rate-limit (IP + UA fingerprint, e.g. 20 reqs/day per IP). Sufficient for HN demo day. [Inference]
3. Provider keys live in Worker secrets — never sent to the client.
4. Same prompt + schema as BYOK — backend just swaps the transport.
5. Docker compose for self-hosters: `docker compose up` brings up the worker locally + a `.env.example` with provider keys. Document this in `packages/backend/README.md`.
6. README has a big "Try it now" button → `judgeman.app/r?url=<some_bailii_url>&ai=on`. No signup.
7. Tests: integration suite against a local wrangler dev instance, asserting rate-limit headers and provider fallback (Gemini → OpenAI on quota error).

Exit criteria: zero-signup user can summarize a judgment on the hosted demo, 20 reqs/day, no key required. Self-hosters can run the same stack on their own infra.

### Phase 5 — AI: local-only (Mode 3) + no-AI fallback (Mode 4)
1. WebLLM (browser-side Llama-3.x or Qwen2.5 small) integration — opt-in download in the options panel. [Inference] Practical for power users only; mainstream lawyers will skip.
2. Ollama is already supported via Mode 1 (BYOK with localhost URL). Document the recipe in `README.md`.
3. **No-AI mode = the default reader.** Phase 1 already ships this. Document it as a first-class mode in the README: "If you don't want AI, judgeman is still the cleanest case-reader you can install." Frame as a feature, not a downgrade.
4. Tests for WebLLM mode: stub the WebLLM runtime, assert prompt → tokens-out → JSON parse path. [Speculation] WebLLM is heavy to CI; gate behind a label.

Exit criteria: all four AI modes selectable from one UI dropdown. Each has at least one passing automated test.

## 5. Testing strategy (load-bearing — do not skip)

User instruction was explicit: deep + working AI integration, tests for all. Concretely:
- **Adapters**: golden-file fixtures per jurisdiction. Stable across refactors. `tests/adapters/sg-elit.test.js` exists already as the model.
- **Core/citation/analysis**: unit tests, pure functions, no DOM dependency.
- **Renderers**: snapshot tests for HTML output. Markdown output diffed against a frozen fixture.
- **AI — mocked**: every provider has a mock that returns canned bytes; assert prompt assembly, parse logic, schema validation, retry/backoff.
- **AI — live, gated**: a separate `npm run test:live-ai` that hits real providers with `GEMINI_KEY`/`OPENAI_KEY`/`ANTHROPIC_KEY` env. Skipped on default `npm test`. Runs in CI weekly on a schedule, not per-PR (cost).
- **E2E**: Playwright. Load a real BAILII page in a headless Chrome, install the unpacked extension, click toggle, assert the reader panel renders. One e2e per jurisdiction.
- **Backend**: wrangler dev + supertest-style HTTP assertions. Rate-limit headers, provider-fallback, schema-conformance.

CI: GitHub Actions. Matrix on node 20/22. Block merge on golden-file diffs.

## 6. HN launch plan (the whole point)

[Inference] for everything in this section — these are predictions, not facts.
- **Title**: "Show HN: Judgeman — open-source reader and AI for common-law judgments (SG/UK/AU/CA/US)."
- **Lead with the web demo**, not the extension. Paste-URL-get-clean-view is the screenshot people share.
- **Position next to Mike**: "Mike is for legal AI workflows. Judgeman is the reader/extractor layer underneath. Mike-compatible JSON output." Even if not literally true, the framing helps.
- **Single screenshot before/after** of a BAILII page (UK audience overlaps with HN heavily). Not ELIT — SG context loses HN voters.
- **Ship the post on a Tuesday-Thursday US morning.** [Speculation — folklore]
- **Pre-seed**: post to /r/programming, /r/law, /r/legaltech, /r/Singapore the same day; tweet at the legaltech-twitter cluster (Bob Ambrogi @ LawSites; Artificial Lawyer; Legal Cheek).
- **Have the issue tracker pre-populated** with 5-10 "good first issue" tasks so new stars convert to forks/PRs.
- **A working hosted demo at launch is non-negotiable.** No demo = no virality.

## 7. Risks / things to watch

- **Store review burden**: three stores × manifest v3 × AI feature × broad host permissions. Plan a 2-3 week review buffer. Firefox AMO + Safari are the slower ones. [Inference]
- **CourtListener already ships an extension** for crowdsourcing PACER docs. Position carefully — we are a reader, not an uploader. Don't accidentally clone their value prop.
- **AustLII / BAILII ToS**: spot-check ToS on automated parsing. Reader-mode use is almost certainly fine [Speculation], but the hosted-API path needs caution. We are *not* re-hosting their judgment text in v5; we render in-place or proxy per-user.
- **SOLID overlap**: SMU's open legal DB lands during our build window. [Inference] Either consume their API once it ships (free upgrade for SG users) or offer to contribute the ELIT adapter upstream.
- **AI hallucination liability**: every AI mode must show a "not legal advice" banner. Prompts must include "Do NOT fabricate. If missing, say 'Not stated'." (Already in `experimental_ai/background.js` — keep it.)
- **Cost runaway on hosted demo**: hard cap monthly LLM spend in the Worker (KV-tracked monthly counter). Bail to "BYOK only" when cap is hit.

## 8. What we are *not* doing (yet)

- No CLI in v5.
- No MCP server in v5 (it is genuinely on-trend for 2026, but adds review surface; do v6).
- No public REST API in v5 (would compete with SOLID; revisit after their launch).
- No paid tier. Goal is stars, not revenue.
- No enterprise / firm-license play. Wrong shape for a solo project.
- No renaming. The brand is fine.

## 9. Next concrete action

Start Phase 0 today:
1. `git checkout -b pivot/v5-foundation`.
2. Convert root `package.json` to workspaces with one package: `packages/core`.
3. Move `judgeman_v4/src/extractor.js` → `packages/core/adapters/sg-elit.js`. Keep a back-compat shim at the old path so `tests/*.test.js` still pass.
4. Run `npm run verify`. Green.
5. Open a PR titled "phase 0: workspaces + adapter scaffold (no behavior change)."

Stop. Re-read this doc before each phase. Update it as decisions change. Truth in the doc > truth in your head a month from now.
