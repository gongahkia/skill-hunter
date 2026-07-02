# Contributing

## Challenge Packs

Dorso challenge packs live in `src/shared/data/` and are validated by JSON Schema.

- MCQ schema: `schemas/mcq.schema.json`
- Drill schema: `schemas/drills.schema.json`
- Advent of Code metadata schema: `schemas/aoc-problems.schema.json`
- Project Euler answer-hash schema: `schemas/euler-answers.schema.json`
- Validation: `npm run validate:packs`

Run validation before opening a PR:

```console
npm ci
npm run validate:packs
```

Bundled source map:

| Source | Data file | Schema | Contribution type |
| --- | --- | --- | --- |
| Fundamentals MCQ | `src/shared/data/mcq.json` | `schemas/mcq.schema.json` | Original multiple-choice questions |
| Type-from-memory drills | `src/shared/data/drills.json` | `schemas/drills.schema.json` | Original prompts with exact expected answers |
| Advent of Code | `src/shared/data/aoc-problems.json` | `schemas/aoc-problems.schema.json` | Metadata and links only |
| Project Euler | `src/shared/data/euler-answers.json` | `schemas/euler-answers.schema.json` | Problem URLs plus SHA-256 answer hashes |

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

MCQ expectations:

- `choices` must contain 2 to 6 plausible answers.
- `answerIndex` is zero-based and must point at the only correct choice.
- `source` should be `community` for external challenge-pack PRs.
- Prefer topic tags such as `big-o`, `hash-table`, `async`, `sql`, or `regex`; add one narrower tag when useful.

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

Drill expectations:

- `expected` must be the shortest exact answer that should pass.
- `normalizers` may include `whitespace`, `quotes`, `semicolons`, and `casing`.
- `threshold` is the maximum tolerated edit distance after normalizers run.
- Keep prompts small enough to type from memory without opening docs.

Advent of Code metadata item shape:

```json
{
  "id": "aoc-2023-01-part-1",
  "year": 2023,
  "day": 1,
  "part": 1,
  "url": "https://adventofcode.com/2023/day/1",
  "difficulty": 1,
  "tags": ["strings", "parsing"]
}
```

Project Euler answer-hash item shape:

```json
{
  "id": "pe-001",
  "url": "https://projecteuler.net/problem=1",
  "answerHash": "0000000000000000000000000000000000000000000000000000000000000000",
  "difficulty": 1,
  "tags": ["math", "arithmetic"]
}
```

Euler expectations:

- `answerHash` is the lowercase SHA-256 hex digest of the canonical answer string.
- Reviewers should verify the hash locally without posting the raw answer in comments.

Pack rules:

- Keep prompts original. Do not copy proprietary problem text.
- Keep IDs stable and lowercase kebab-case.
- Keep tags lowercase kebab-case.
- Use difficulty `1` for recall, `2` for basic application, `3` for multi-step reasoning, `4` for advanced implementation details, and `5` only for expert-only items.
- Do not include raw Project Euler answers; include only SHA-256 hashes.
- Do not copy Advent of Code statements, examples, inputs, or answers; link to the canonical problem page.
- Add only JSON data for pack PRs unless code changes are required.
- Keep topic PRs narrow: one source and one topic per PR.

Good first challenge-pack issues should include:

- Topic and count, for example `Add 10 MCQ questions on hash tables`.
- Target data file and schema.
- Expected tags and difficulty range.
- Validation command: `npm run validate:packs`.
- Any licensing note needed for that source.

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

Release review artifacts:

```console
npm run package:release
```

This writes Chrome, Firefox, and source-review zip files under `dist/artifacts`.

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
