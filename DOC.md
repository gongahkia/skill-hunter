# Skill Hunter Product and Architecture Notes

## 1) Repository Structure, Purpose, and Intent

Skill Hunter is a browser-extension codebase focused on Singapore Statutes Online (SSO) legislation pages.

### High-level purpose
- Convert dense SSO Whole Document pages into a faster legal reading surface.
- Reduce friction for legal tasks: navigate sections quickly, verify context, and capture research notes.
- Keep workflows lightweight, local-first, and auditable.

### Current architecture map
- `src/content.ts`: Main content script, overlay lifecycle, search, note-taking, citation copy, UI events.
- `src/core/domParser.ts`: Extracts title, metadata, table of contents, definitions, and statute content tokens.
- `src/core/contentProcessor.ts`: Renders parsed tokens into HTML and enriches content with definition tooltips.
- `src/popup.ts`, `src/popup.html`, `src/styles/popup.css`: Extension popup UX and page eligibility checks.
- `src/styles/main.css`: Shadow-DOM styles for simplified legal reading workspace.
- `src/utils/logger.ts`: Structured logging, per-session diagnostics buffer.
- `src/utils/errorHandler.ts`: Error normalization and user-safe message translation.
- `src/utils/storage.ts`: Local note persistence and clipboard helper utilities.
- `src/types/*`: Type contracts for messages, notes, parsing, and diagnostics.
- `scripts/package_firefox_source.py`: Firefox AMO review source archive packager.
- `.github/workflows/ci.yml`: CI pipeline for lint/type-check/tests/build/source packaging.

## 2) Philosophical Value Proposition (Before vs After)

### Before
- Core value: readability transformation.
- Primary interaction: toggle simplified view.
- Gaps: limited research workflow depth, minimal in-tool persistence, less explicit operational observability.

### After
Skill Hunter now positions itself as a **statute-focused legal research workspace**:
- Readability: clear typography and structure still first-class.
- Research flow: in-page search, section-aware citation copy, and statute-scoped private notes.
- Reliability: structured diagnostic logging and explicit error surfacing.
- Operability: repeatable CI and packaging checks, including Firefox source archive generation.

## 3) Why These Features: Market Convention Alignment

The expanded product direction follows common legal research conventions seen across public legal platforms and open legal tooling.

### Conventions reflected in Skill Hunter
- **Fast ongoing monitoring and legal workflow continuity**
  - CourtListener highlights search/docket/citation alerts as key workflow primitives.
  - Source: https://www.courtlistener.com/help/alerts/

- **Notes and matter organization as first-class research objects**
  - CourtListener documents tags/notes for organizing legal items and keeping private analysis context.
  - Source: https://www.courtlistener.com/help/tags-notes/

- **Public legal access mission + statute usability**
  - AGC states SSO exists to provide free online public access to Singapore legislation.
  - Skill Hunter’s upgrades focus directly on making that access operationally useful in real legal work.
  - Source: https://www.agc.gov.sg/our-roles/drafter-of-laws/singapore-statutes-online/

- **Citation quality and machine-assisted verification norms**
  - CourtListener’s citation lookup API emphasizes high-volume citation validation/lookup workflows.
  - This supports Skill Hunter’s direction toward safer citation handling and copy workflows.
  - Source: https://www.courtlistener.com/help/api/rest/citation-lookup/

- **Extension-grade engineering discipline in legal FOSS**
  - RECAP (Free Law Project) demonstrates cross-browser legal extension patterns and CI/testing expectations.
  - Source: https://github.com/freelawproject/recap-chrome

Additional comparative reference:
- CanLII search help documents note-up style citation filtering and section-level narrowing, which informed deep statute navigation priorities.
- Source: https://www.canlii.org/info/search.html

## 4) User-Specific Value Expansion

### Lawyers
- Faster section retrieval with in-overlay search and TOC jump.
- One-click citation text copy with section context.
- Private statute-level notes that persist locally for matter prep.

### Law students
- Reduced cognitive overhead when learning statute structure.
- Inline definitions + searchable text reduce context switching.
- Note export to markdown supports study handoffs and exam outlines.

### Compliance / policy / legal operations teams
- Repeatable review flow with local persistence and explicit error messages.
- Better debugging visibility when page markup drifts.
- CI and source packaging checks improve trust in release stability.

## 5) Implemented UX and Reliability Upgrades

### Research UX
- Toolbar search with result count and next/prev navigation.
- `Ctrl/Cmd + F` shortcut targets overlay search.
- Citation copy based on nearest visible heading.
- Page-link copy for quick sharing.
- Statute-scoped private notes panel with auto-save and note export.

### Robustness and diagnostics
- Structured logs include session ID, context, timestamp, and payload.
- Buffered in-memory diagnostic entries for quick debugging.
- Error normalization prevents opaque unknown-failure handling.
- Global runtime and promise rejection listeners in popup/content contexts.

### Parser and rendering resilience
- Improved DOM extraction fallbacks and normalized text handling.
- Metadata summary cards render when available.
- Parser failures throw explicit domain errors instead of silent degradation.

### Packaging and CI
- Firefox source packaging script now references real repository files.
- CI workflow runs:
  1. `npm ci`
  2. `npm run lint`
  3. `npm run type-check`
  4. `npm test -- --runInBand`
  5. `npm run build`
  6. `make firefox-source-package`

## 6) Local Developer Quality Gate

Run the same checks used by CI:

```bash
make ci
```

Equivalent command:

```bash
npm run ci
```

## 7) Suggested Next High-Value Steps

1. Add section-level cross-reference linking (e.g., “see section 12”).
2. Add optional citation format presets (Bluebook/OSCOLA-style output templates).
3. Add a lightweight timeline mode for revised legislation comparison.
4. Add opt-in diagnostics export for issue reports.
