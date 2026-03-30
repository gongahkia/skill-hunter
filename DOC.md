# Judgeman Technical and Product Documentation

## 1) Repository Structure, Purpose, and Intent

### Primary runtime (`judgeman_v4`)
- `judgeman_v4/src/`
  - `browserApi.js`: browser API bridge (`browser` vs `chrome`).
  - `extractor.js`: DOM extraction of ELIT case metadata, legal issues, and body sections.
  - `contentApp.js`: in-page launcher, reader overlay UI, messaging endpoint, export actions.
  - `contentScript.js`: runtime bootstrap for ELIT pages.
  - `popup.html/.js/.css`: extension popup controls and user actions.
  - `panel.css`: in-page panel and reader overlay styling.
  - `caseToolkit.js`: local legal-analysis and briefing heuristics.
  - `logger.js`: structured runtime logging and diagnostics export.
- `judgeman_v4/config/manifest.base.json`
  - shared MV3 manifest baseline for Chrome/Firefox/Safari builds.

### Tooling and build scripts (`scripts`)
- `build-extension.mjs`: builds target artifacts into `dist/{chrome,firefox,safari}`.
- `package-firefox-submission.mjs`: prepares AMO upload/source archives.
- `generate-icons.py`: deterministic icon generation pipeline.
- `generate-safari-project.mjs`: Safari converter and project sync.

### Test suite (`tests`)
- `extractor.test.js`: extraction and analysis correctness.
- `contentApp.test.js`: reader overlay integrity and non-destructive DOM behavior.
- `caseToolkit.test.js`: legal-analysis heuristics and markdown brief output.
- `logger.test.js`: logging/diagnostics serialization behavior.

### Historical artifacts
- `archive/`: prior versions (v1-v3) retained for lineage/reference.
- `judgeman_v4/experimental_ai/`: deferred AI path retained outside store-safe build.

## 2) Existing Product Philosophy (Before Upgrade)

Judgeman’s core idea was strong and privacy-aligned: transform dense ELIT judgments into a readable structure without sending case data off-device.

Main gap before upgrade: the tool stopped at readability. Legal professionals and students usually need downstream work products (briefs, issue framing, authority checking, exportable notes, and traceable diagnostics).

## 3) Market-Conventions Research and Implications

The legal-research ecosystem (commercial and open legal tech) shows recurring expectations:

1. Structured retrieval with relevance/context support.
- CourtListener documents case-law search APIs and typed result search patterns.
- Source: https://www.courtlistener.com/help/api/rest/search/

2. Citation-aware workflows are foundational.
- Free Law Project’s open-source stack and `eyecite` emphasize citation extraction as core infrastructure.
- Sources:
  - https://free.law/open-source-tools/
  - https://github.com/freelawproject/eyecite

3. “Good law” verification/citator habits remain standard legal practice.
- Even where workflows differ by jurisdiction, the convention is to verify negative treatment and authority status before reliance.
- Source: https://legal.thomsonreuters.com/blog/how-to-check-if-a-case-is-still-good-law/

4. Law-student case briefing conventions remain persistent.
- Facts/Issue/Holding/Rationale and related structured briefing sections remain the dominant study workflow.
- Source: https://www.lexisnexis.com/en-us/lawschool/pre-law/how-to-brief-a-case.page

5. AI-assisted legal search tools increasingly foreground plain-language input with explicit accuracy/transparency controls.
- CanLII Search+ (announced February 25, 2026) emphasizes plain-language query, relevance scoring, and corpus-constrained transparency.
- Source: https://blog.canlii.org/2026/02/25/introducing-canlii-search/

### Product implication for Judgeman
A genuinely useful legal tool should bridge:
- readability,
- structured extraction,
- briefing outputs,
- authority/statute surfacing,
- explicit quality warnings,
- auditable diagnostics.

## 4) Upgraded Value Proposition (Breadth + Depth)

Judgeman now positions itself as:

**A privacy-first, in-browser ELIT case-workbench that turns raw judgments into usable legal study/research artifacts (briefs, references, diagnostics), while preserving source DOM integrity and traceable runtime behavior.**

### Breadth expansion
- JSON export (machine-friendly).
- Markdown case brief export (human/study-friendly).
- Diagnostics export (debug/support-friendly).
- Reader cards for metadata, issues, brief signals, authorities/statutes, checklist, full sections.

### Depth expansion
- Heuristic legal analysis pipeline (`caseToolkit.js`):
  - outcome signal detection (e.g., appeal dismissed/allowed),
  - neutral citation extraction,
  - statutory reference extraction,
  - section/paragraph/read-time metrics,
  - data-quality warnings,
  - research checklist prompts.
- Runtime logging (`logger.js`) integrated across content/popup/extractor/contentScript.
- Explicit error surfacing instead of silent returns.

## 5) User Experience Improvements

### Popup
- Fast decision signals: outcome/read-time/warnings pills.
- One-click actions:
  - `Copy case JSON`
  - `Copy case brief`
  - `Copy diagnostics`
- Status tones (success/warn/error) for immediate feedback.

### In-page panel + reader overlay
- Existing non-destructive overlay behavior preserved.
- Added legal work-product cards:
  - Case brief (student mode)
  - Authorities and statutory references
  - Research checklist
- Consistent copy/export affordances from panel and reader.

## 6) Reliability and Debuggability

### No silent-failure policy applied
- `contentScript.js` now logs missing dependencies instead of no-op return.
- `extractor.js` captures extraction/analysis errors in `extractionErrors` and logs structured failure context.
- `contentApp.js` wraps user actions with centralized error handling and status updates.
- Global `error` and `unhandledrejection` handlers added in popup and content runtime.

### Diagnostics flow
- Structured namespaced logs with timestamps.
- `GET_DIAGNOSTICS` message for pull-based diagnostics retrieval.
- Clipboard export path for support/debug reporting.

## 7) CI/CD and Quality Gates

Added `.github/workflows/ci.yml`:
- `npm ci`
- `npm test`

This gives an enforceable baseline quality gate for every push/PR.

## 8) Notes for Legal Users

Judgeman outputs are extraction/heuristic aids, not legal advice.
Recommended professional workflow:
1. Use Judgeman to speed comprehension and structure notes.
2. Verify authorities with a jurisdiction-appropriate citator before reliance.
3. Validate statutory currency/amendments against authoritative sources.

## 9) Current Limitations and Next Depth Opportunities

1. Citation and statute extraction are regex heuristics; edge-case misses are expected.
2. Outcome detection is lexical and can miss nuanced holdings.
3. ELIT DOM changes may require extractor updates.

High-value next steps:
1. Add jurisdiction-specific citation parser adapters.
2. Add citation-outbound linking to authoritative repositories where available.
3. Add optional user annotations per case (local-only storage) and export bundles.
4. Add fixture coverage for additional ELIT variants (civil/appellate/multi-judge formatting patterns).
