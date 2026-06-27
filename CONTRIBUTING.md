# Contributing

## Challenge Packs

Dorso challenge packs live in `src/shared/data/` and are validated by JSON Schema.

- MCQ schema: `schemas/mcq.schema.json`
- Drill schema: `schemas/drills.schema.json`
- Validation: `npm run validate:packs`

Run validation before opening a PR:

```console
npm ci
npm run validate:packs
```

MCQ item shape:

```json
{
  "id": "mcq-hash-table-001",
  "prompt": "Which operation is expected O(1) in a hash table?",
  "choices": ["Lookup by key", "Sorting all keys", "Full scan", "Tree rebalancing"],
  "answerIndex": 0,
  "tags": ["hash-table"],
  "difficulty": 1,
  "source": "community"
}
```

Drill item shape:

```json
{
  "id": "drill-js-array-map-001",
  "prompt": "Rewrite `arr.map(x => x * 2);` without changing behavior.",
  "expected": "arr.map((x) => x * 2);",
  "normalizers": ["whitespace", "semicolons"],
  "threshold": 2,
  "tags": ["javascript"],
  "difficulty": 1
}
```

Pack rules:

- Keep prompts original. Do not copy proprietary problem text.
- Keep IDs stable and lowercase kebab-case.
- Keep tags lowercase kebab-case.
- Add only JSON data for pack PRs unless code changes are required.

## Local Extension Run

Chrome:

```console
npm run build:chrome
```

Then open `chrome://extensions/`, enable Developer mode, choose Load unpacked, and select `dist/chrome`.

Firefox:

```console
npm run build:firefox
```

Then open `about:debugging#/runtime/this-firefox`, choose Load Temporary Add-on, and select `dist/firefox/manifest.json`.

## Bug Reports

Include:

- Browser and version
- Dorso version or commit SHA
- Steps to reproduce
- Expected result
- Actual result
- Console or extension errors if present

For challenge-pack issues, use `.github/ISSUE_TEMPLATE/challenge-pack.md`.

## Code Style

Shared package style config currently lives in:

- `src/shared/.eslintrc.json`
- `src/shared/.prettierrc.json`

Keep changes scoped to the requested behavior. Do not refactor unrelated extension, schema, or CI files in content-only PRs.
