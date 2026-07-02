# Launch Kit

## Window

Target launch slot: Tuesday or Wednesday, 8-10am ET.

Primary launch sequence:

1. Submit Chrome Web Store package.
2. Submit Firefox AMO package.
3. Publish GitHub release notes and attach browser packages.
4. Post Show HN after store listings are live or in review with public install links ready.
5. Post Twitter/X and Bluesky threads within 15 minutes of Show HN.

Success criteria:

- 150+ HN points.
- 80+ HN comments.
- 1k GitHub stars in 30 days.
- 5k installs in 60 days.
- At least one developer-trade pickup.

## Title

Chosen Show HN title:

`Show HN: Dorso - a local coding gate before AI chat`

Working candidates:

- `Show HN: Dorso - a local coding gate before AI chat`
- `Show HN: Dorso - solve a coding challenge before opening ChatGPT`
- `Show HN: Dorso - a CAPTCHA for AI-era programming atrophy`

Use the chosen title for HN. Keep the atrophy thesis in the post body where there is room for nuance.

## Assets

Use the current v3.0 assets:

| Asset | Path | Dimensions | Use |
| --- | --- | --- | --- |
| Demo GIF | `asset/reference/demo.gif` | 960x600 | README, Show HN, social replies |
| Popup screenshot | `asset/reference/popup.png` | 1280x800 | Chrome, AMO, README |
| Gate screenshot | `asset/reference/gate.png` | 1280x800 | Chrome, AMO, README |
| Badge screenshot | `asset/reference/badge.png` | 1280x800 | Store secondary screenshot |
| Digest screenshot | `asset/reference/digest.png` | 1280x800 | Store secondary screenshot |

## Chrome Web Store Copy

Title:

`Dorso`

Short description:

`A local coding challenge gate for selected AI chatbot sites.`

Detailed description:

`Dorso helps developers avoid AI autopilot by asking for a short coding challenge before selected chatbot sites open. Configure which supported sites are protected, solve the staged challenge, then get a timed unlock. Runtime state stays in browser extension storage: Dorso has no account system, no analytics, no telemetry, and no remote prompt collection.`

`Supported targets include ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Copilot, You.com, Jasper, WriteSonic, Socrat, and Hugging Face Chat. Challenge sources include bundled fundamentals, type-from-memory drills, LeetCode verification, Advent of Code metadata, and Project Euler answer hashes.`

Permission notes:

- `storage`: saves challenge state, settings, timers, receipts, and local status export settings.
- `downloads`: writes the optional local CLI status JSON export.
- `alarms`: refreshes the optional local CLI export.
- Host permissions: limited to supported chatbot domains and challenge-source domains needed for the local gate and verification flow.

Reviewer notes:

`Dorso is local-first. The extension does not transmit chatbot page content, LeetCode submissions, settings, solve history, install identifiers, or browser activity to analytics services. Optional leaderboard submission is opt-in and sends only a repo hash, anonymous install hash, score, longest run, and timestamp to the Dorso Worker.`

## Firefox AMO Copy

Summary:

`A local coding challenge gate for selected AI chatbot sites.`

Description:

`Dorso protects selected AI chatbot sites behind a short local coding challenge. The goal is deliberate practice: solve the staged challenge, unlock the protected site for a timed session, and keep the evidence on-device.`

`This release stores settings, timers, solve receipts, and challenge state in extension storage. It does not use accounts, analytics, telemetry, or remote prompt collection. Firefox data collection permissions are declared as none in the generated manifest.`

Reviewer notes:

- Build with `npm ci && npm run build:firefox`.
- Review package: `dist/firefox`.
- Source entry points: `src/extension/`, `src/shared/`, `schemas/`, and `scripts/build-extension.mjs`.
- Privacy details: `docs/PRIVACY.md`.
- Security reporting: `docs/SECURITY.md`.

## Sanitized Store Variant

Use this copy if reviewers object to sharp atrophy framing.

Short description:

`A local deliberate-practice gate for selected AI chatbot sites.`

Detailed description:

`Dorso lets developers add a small deliberate-practice step before opening selected AI chatbot sites. Pick the sites to protect, solve a short coding challenge, and unlock the site for a timed session. Dorso keeps runtime state in browser extension storage and does not collect prompts, accounts, analytics, or telemetry.`

Avoid these phrases in sanitized listings:

- `braindead programmer`
- `anti-AI`
- `blocks AI`
- `punishes AI use`

## Show HN Draft

`Hi HN, I built Dorso, a local browser extension that puts a short coding challenge in front of selected AI chatbot sites.`

`The thesis is simple: AI assistance is useful, but autopilot is expensive. Dorso adds a small deliberate-practice loop before ChatGPT, Claude, Gemini, Perplexity, and similar sites open. Solve the staged challenge, get a timed unlock, and continue working.`

`The v3.0 build is intentionally local-first: no accounts, no analytics, no telemetry, no remote prompt collection, and no backend dependency for the extension flow. Challenge state, timers, settings, and receipts stay in extension storage.`

`Challenge sources include bundled fundamentals MCQs, type-from-memory drills, LeetCode verification, Advent of Code metadata, and Project Euler answer hashes. There is also an optional CLI status export and optional badge/leaderboard flow.`

`Repo: https://github.com/gongahkia/dorso`

`I am especially interested in feedback on the friction level, reviewer-safe extension permissions, and whether the challenge sources feel useful rather than performative.`

## Twitter/X Thread

1. `I built Dorso: a local coding challenge gate before selected AI chatbot sites. Solve a short challenge, unlock ChatGPT/Claude/Gemini/etc for a timed session, keep moving.`
2. `The point is not anti-AI. It is anti-autopilot. Dorso adds a deliberate-practice loop where I most often reach for a chatbot too quickly.`
3. `v3.0 is local-first: no accounts, no analytics, no telemetry, no remote prompt collection. Settings, timers, challenge state, and receipts stay in extension storage.`
4. `Challenge sources: fundamentals MCQs, type-from-memory drills, LeetCode verification, Advent of Code metadata, and Project Euler answer hashes.`
5. `Repo + demo: https://github.com/gongahkia/dorso`

## Bluesky Thread

1. `Dorso v3.0 is a local browser extension that asks for a short coding challenge before selected AI chatbot sites open.`
2. `The goal is deliberate practice, not AI abstinence: solve, unlock a timed session, keep working.`
3. `Local-first by default: no accounts, analytics, telemetry, or remote prompt collection.`
4. `Built-in challenge sources cover fundamentals MCQs, memory drills, LeetCode, Advent of Code metadata, and Project Euler hashes.`
5. `Repo: https://github.com/gongahkia/dorso`

## Launch Checklist

- `npm ci`
- `npm run validate:packs`
- `npm run build`
- Confirm `dist/chrome` and `dist/firefox` exist.
- Confirm `docs/PRIVACY.md` and `docs/SECURITY.md` are current.
- Confirm screenshots match current popup, gate, badge, and digest UI.
- Submit Chrome Web Store package with Chrome copy.
- Submit Firefox AMO package with AMO copy.
- Prepare a GitHub release using the chosen Show HN title and release notes.
- Post Show HN during the Tuesday/Wednesday 8-10am ET window.
- Post Twitter/X and Bluesky threads.
- Track HN points/comments, GitHub stars, installs, and developer-trade coverage daily for the first week.
