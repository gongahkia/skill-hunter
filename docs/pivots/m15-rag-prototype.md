# M15 RAG Prototype

Status: accepted for M15.T05.
Date: 2026-06-18

## Fixture Vault

Prototype input was a copied synthetic fixture vault, not production IndexedDB data.

Fixture shape:

- 1000 copied text chunks
- 4 repeated source classes: backup restore, browser worker release, imported prose provenance, stale deleted source
- model: `Xenova/all-MiniLM-L6-v2`
- dtype: `q8`
- runtime: `@huggingface/transformers@4.2.0` in Node CLI
- temp cache: `/tmp/rakuzaichi-rag.*`, removed after run

## Prototype Results

| Metric | Value |
| :--- | ---: |
| Model load plus first download | 2005 ms |
| Embed 1000 chunks | 2410 ms |
| Embed 1 query | 4 ms |
| Output dimensions | 1000 x 384 |
| Vector bytes at float32 | 1536000 |
| Vector storage estimate | 1.46 MB |
| Model cache size | 22.59 MB |
| Heap delta after GC | 10.94 MB |

Recall sanity check:

- query: `recover saved archive`
- top 5 results all came from the backup-restore fixture class
- generated answer UI was not exercised because M15 is retrieval-only

## Production Schema Decision

No production vector schema migration ships from this prototype alone.

Reason:

- the current shipped path keeps vectors in memory
- IndexedDB vector stores remain a design target from `docs/pivots/m15-local-rag.md`
- persistent vectors need browser IndexedDB timing and quota checks before migration

## Command Shape

The benchmark used a temp cache, loaded `feature-extraction`, embedded the copied fixture chunks, embedded one query, ranked by cosine similarity, printed metrics, then removed the cache directory.

## Sources Checked

- `docs/pivots/m15-rag-model-selection.md`
- `test/fixtures/rag/eval-set.json`
