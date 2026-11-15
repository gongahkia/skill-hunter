# Browser audits

Use Chromium or Chrome for Testing and a matching `chromedriver`. Python 3.9+
and the normal Node/npm build prerequisites are required. The auditor reuses
the repository's WebDriver client and adds no npm or Python dependencies.

```sh
make audit-fixtures
make audit
```

`audit-fixtures` runs offline regression pages through the compiled content
script with simulated extension APIs. It checks nested definitions, later Parts,
plain headings, pointer hovers, source preservation and disabling previews.
It does not test an installed extension or access to official websites.

`audit` loads the actual `dist/` extension into an isolated Chromium profile and
visits the official pages in [audit_targets.json](./audit_targets.json). It uses
real extension storage and background lookups. It inspects the closed preview
panel through DevTools; production code and permissions are unchanged.

The test pages cover:

| Page | Coverage |
| :--- | :--- |
| Consumer Protection Act | Nested definitions, uses in later Parts, cross-Act lookups |
| Employment Act | Definitions across Parts |
| Penal Code | Large-document scanning and sampled references |
| Employment (Part-Time Employees) Regulations | Subsidiary legislation and multiword definitions |
| Voltas v York, 2024 SGCA 12 | Case citations, statutory pinpoints and cited editions |
| L W Infrastructure, 2013 SGHC 264 | Legacy headers and SLR citation searches |

## Selected pages and captures

After `make build`, run individual targets or save rendered source for debugging:

```sh
python3 scripts/audit_sites.py --only voltas --only legacy-judgment
python3 scripts/audit_sites.py --only consumer-protection --capture-html
python3 scripts/audit_sites.py --headed --profile build/audit/browser-profile
```

Use `--browser /path/to/chromium` and `--driver /path/to/chromedriver` when the
executables are not on PATH. Regular Google Chrome and Edge have removed the
extension-loading flags used by this runner; see the
[browser-extension testing guidance](https://playwright.dev/docs/chrome-extensions).

The default profile is temporary. `--profile` accepts an empty directory or a
dedicated directory already marked as owned by this tool; it refuses existing
personal profiles. A headed run shows the audit browser. It does not bypass
access blocks, solve challenges or reuse a personal browser session.

## Results

Reports are saved under `build/audit/<mode>-<timestamp>/report.json`, with
screenshots for failures and access blocks. `--output` selects another artifact
directory. `--capture-html` also saves sanitized rendered HTML; captures stay in
the ignored build directory by default. The JSON includes preview contents,
source anchors, reference counts, checks and timings. Missing references also
include the matching definition's markup and the start of its enclosing cell.

| Status | Meaning |
| :--- | :--- |
| `passed` | The configured checks completed successfully |
| `failed` | A required reference, preview, preservation check or browser operation failed |
| `blocked` | The source document or preview explicitly reported an access block |
| `unavailable` | A preview source could not be read, without proof of an access block |

A failed check is evidence to investigate, not proof that the extension caused
the problem. Website changes can also invalidate probe expectations. These are
extension behavior checks, not an audit of the legal meaning of the material.

Exit codes: `0` for a complete pass, `1` for failed checks, `2` for setup errors,
and `3` for incomplete coverage due to blocked or unavailable sources. A blocked
page is never counted as a live pass. Offline and live reports remain separate.

Portable audit tests run with `npm run test:audit` and are part of `npm run ci`.
Browser audits require Chromium and chromedriver and are separate commands;
they are not silently skipped in CI or run on a schedule.
