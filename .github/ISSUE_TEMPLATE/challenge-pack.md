---
name: Challenge pack
about: Propose local MCQ or drill content
title: "challenge-pack: "
labels: challenge-pack
assignees: ""
---

## Pack

- Type: MCQ / drill
- Topic:
- Schema: `schemas/mcq.schema.json` or `schemas/drills.schema.json`
- Validation: `npm run validate:packs`

## Example diff

```diff
+ {
+   "id": "mcq-example-001",
+   "prompt": "Which operation is expected O(1) in a hash table?",
+   "choices": ["Lookup by key", "Sorting all keys", "Full scan", "Tree rebalancing"],
+   "answerIndex": 0,
+   "tags": ["hash-table"],
+   "difficulty": 1,
+   "source": "community"
+ }
```

## Notes

