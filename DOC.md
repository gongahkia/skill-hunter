# Owl Product and Engineering Deep-Dive (March 30, 2026)

## 1) Repository Structure, Purpose, and Intent

`Owl` is a multi-surface tagged-annotation tool built around the same core mental model:
- detect high-signal inline tags (`TODO`, `FIXME`, `REV`, `TEMP`, `REF`, plus custom tags),
- centralize them into an actionable view,
- let users navigate and mutate tagged items quickly.

### Current repository topology
- `src/docs`, `src/sheets`, `src/slides`: standalone Google Apps Script versions.
- `src/main`: unified/experimental Apps Script source for Docs/Sheets/Slides.
- `src/webext`: browser extension (Chrome/Firefox/Safari packaging) for Google editors via OAuth APIs.
- `src/vscode`: VS Code extension.
- `src/obsidian`: Obsidian community plugin source.
- `src/vim`, `src/nvim`: Vim/Neovim plugins.
- `src/cli`: Go CLI scanner for local repositories/text files.

### Product intent (inferred from code + docs)
- Bring "annotation tags as tasks" behavior to spaces where native task workflows are weak or fragmented.
- Keep adoption low-friction: no mandatory backend, local-first scanning, simple color customization.
- Support both developers (editor + codebase scanning) and everyday knowledge users (Google Docs/Sheets/Slides).

## 2) Current Philosophical Value Proposition

### Strong today
- Cross-platform breadth is already uncommon: Google editors + multiple developer editors + CLI.
- Consistent tag vocabulary across tools lowers cognitive switching cost.
- Zero required external backend is privacy-friendly and lightweight.

### Weak today (before this upgrade)
- Reliability posture varied by surface (some silent catches, uneven diagnostics).
- Duplication across platform implementations increased behavior drift risk.
- Limited explicit articulation of value proposition for different personas.
- No repo-native CI automation to protect quality across major subprojects.

## 3) Market Convention Research and Implications

### Observed conventions in successful tag/task tools
1. Fast indexed search and tree/group views are expected.
2. Click-to-location navigation and inline highlight are baseline UX.
3. Rich diagnostics and debuggability are necessary for supportability.
4. Export/share artifacts (JSON/Markdown/text) increase utility and adoption.
5. Token/session friction is a major drop-off risk in OAuth-based tools.

### External references
- Todo Tree (VS Code marketplace): tag scanning, tree view, navigation, highlight, export, scan modes, and explicit debug-channel support.
  - https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree
- ripgrep release notes (used by many code tag scanners): defaults that respect ignore rules and skip hidden/binary files.
  - https://github.com/burntsushi/ripgrep/releases
- Google Docs/Sheets/Slides help: comments/action items exist, but Owl can complement with custom inline tag workflows and non-comment scanning.
  - https://support.google.com/docs/answer/6239410?hl=en
- Obsidian Tasks ecosystem evolution (rapid iteration, advanced filtering/workflow expectations).
  - https://github.com/obsidian-tasks-group/obsidian-tasks/releases

## 4) Upgrades Implemented in This Repository Revision

### A. Developer-facing depth (CLI)
- Added robust scan reporting with explicit diagnostics:
  - file scan/skipped counts,
  - total match count,
  - structured warnings list.
- Removed silent drop behavior for many scan failures by surfacing warnings.
- Added comment-leader normalization (`//`, `#`, `--`, `;`, `*`, `/*`, `<!--`) so developer comment tags are detected more consistently.
- Added optional runtime logging controls:
  - `--verbose` for debug logs,
  - `--log-file` for persistent logs,
  - `--strict` to fail on warnings (useful for automation).
- Added CLI scanner tests for:
  - comment-prefixed matches,
  - binary file skipping,
  - custom prefixes.

### B. Everyday-user + supportability depth (browser extension)
- Added centralized in-extension diagnostics logger with bounded history.
- Replaced silent extension runtime paths with logged diagnostics in key flows.
- Added diagnostics UX in options page:
  - copy runtime diagnostics to clipboard,
  - clear diagnostics.
- Hardened storage behavior:
  - normalization and safer fallback handling,
  - malformed token/settings resilience,
  - explicit logging for storage failures.
- Improved OAuth user experience by attempting refresh-token renewal before forcing interactive re-auth.
- Improved popup UX resilience:
  - action-level guarded error handling,
  - status updates and logging on failures.

### C. Delivery confidence
- Added GitHub Actions CI workflow to run core checks for:
  - `webext` typecheck/tests/build/lint,
  - `vscode` compile,
  - `obsidian` typecheck/build,
  - `cli` go test.

## 5) Expanded Value Proposition (Breadth + Depth)

### For developers
- One tag vocabulary across CLI, VS Code, Vim/Neovim, Obsidian, and browser extension.
- Improved parser coverage for real-world comment styles.
- Scan diagnostics suitable for local tooling, scripts, and CI gating (`--strict`).
- Export-ready outputs for handoff and reporting.

### For everyday users
- Google editor support with actionable sidebar operations (scan/highlight/archive/mark done/export).
- Better recoverability and issue reporting with copyable diagnostics.
- Lower auth friction via refresh-token path.

### Why this matters philosophically
Owl becomes more than a tag highlighter. It becomes a cross-context attention management layer:
- it captures deferred intent (`TODO`-style thought),
- makes intent visible and navigable,
- and now provides enough reliability and introspection to trust in daily workflows.

## 6) Suggested Next High-Impact Iterations

1. Unify duplicated Apps Script variants via generated/shared core to reduce drift.
2. Add schema-versioned import/export for long-lived task migration between platforms.
3. Add optional tag metadata conventions (priority, owner, date) with backward compatibility.
4. Add benchmark fixtures and performance budgets for large documents/workspaces.
5. Add minimal telemetry opt-in (local only or privacy-preserving) to understand real user pain points.

## 7) Operational Notes

- This doc is intentionally the canonical enhancement narrative for this revision.
- Per request, `README.md` was not edited.
