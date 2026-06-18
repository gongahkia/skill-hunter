# M15 RAG Performance Gates

Status: accepted for M15.T12.
Date: 2026-06-18

## Measured Baseline

Source: `docs/pivots/m15-rag-prototype.md`.

| Metric | Measured value |
| :--- | ---: |
| Fixture chunks | 1000 |
| Model load plus first download | 2005 ms |
| Index embedding time | 2410 ms |
| Query embedding time | 4 ms |
| Model cache size | 22.59 MB |
| Vector size for 1000 chunks | 1.46 MB |
| Heap delta after GC | 10.94 MB |

## Gates

M15 retrieval-only UX remains enabled when these copied-fixture checks pass:

- model cache for q8 `Xenova/all-MiniLM-L6-v2`: <= 32 MB
- float32 vector storage estimate: <= 2 MB per 1000 chunks
- copied-fixture index time: <= 5 seconds per 1000 chunks after model load starts
- copied-fixture query time: <= 100 ms for one query embedding
- heap delta after GC: <= 32 MB for 1000 chunks
- cancellation latency: next batch boundary; default batch size is 8 chunks
- stale/deleted source rebuild: removed rows must be absent after rebuild

[Inference] Browser extension timings can exceed Node CLI timings. These gates are first-pass local acceptance gates, not a guarantee for every device.

## Storage Budget

For the current in-memory index:

- 1000 chunks: about 1.46 MB vector data
- 10000 chunks: about 14.65 MB vector data
- 50000 chunks: about 73.24 MB vector data

If persistent IndexedDB vectors ship later, the migration must keep the same per-1000-chunk estimate visible in storage docs and add actual IndexedDB overhead measurements.

## Required Regression Checks

- `npm test -- local-rag local-rag-eval`
- `npm test`
- `npm run build:chrome`

## Current Verification

Last verified on 2026-06-18:

- `npm test`: 51 files, 284 tests passed
- `npm run build:chrome`: passed
- focused RAG tests: passed
