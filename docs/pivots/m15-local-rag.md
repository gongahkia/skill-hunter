# M15 Local RAG Pivot

Status: accepted for M15 planning.
Date: 2026-06-18

## Decision

Build local semantic retrieval first. Do not ship generated answers, remote LLM calls, or server-side indexing in the first M15 slice.

Baseline embedding path:

- runtime: Transformers.js in the browser extension
- model: `Xenova/all-MiniLM-L6-v2`
- task: `feature-extraction`
- pooling: mean
- normalization: true
- embedding width: 384 dimensions
- default backend: WASM/CPU
- optional backend: WebGPU when available and explicitly enabled
- default dtype: quantized browser-compatible model files as provided by the model repo

Chrome Prompt API/Gemini Nano is optional future answer-generation support only. It is not the baseline embedding or retrieval dependency.

Rationale:

- Transformers.js runs models directly in the browser with no server dependency.
- The selected model has Transformers.js-compatible ONNX weights, Apache 2.0 license, and 384-dimensional sentence embeddings.
- The model card states long input is truncated, so chunking must keep text short.
- WebGPU can accelerate browser ML but availability is browser/hardware-dependent.
- Chrome Prompt API availability and model lifecycle are browser-specific, so it must be hidden unless capability checks pass.

## Scope

In scope for M15 retrieval:

- semantic search over existing vault chats/messages
- semantic search over imported prose snapshots from M9-M14
- cited result list with source title, platform, timestamp, and excerpt
- source opening by chat/document/message/provenance row
- local-only model download/cache/indexing UX
- progress/cancel/rebuild for indexing

Out of scope until a later M15 task explicitly accepts it:

- generated answers
- remote embeddings
- remote reranking
- remote LLM fallback
- automatic indexing outside the user's local vault
- uploading vault text, vectors, or prompts to any backend

## Retrieval-Only UX

The first shipped UX is a semantic result pane:

- query box
- top matching chunks
- cited source row per chunk
- visible excerpt
- open-source action
- rebuild-index action
- clear-index action

No prose answer is shown in the first slice. Multiple cited chunks can be selected manually by the user.

## Chunk Policy

Chunks are deterministic and rebuildable.

Chunk source rows:

- `chats`
- `messages`
- imported document/message rows normalized by M9-M14 adapters

Chunk text:

- normalized visible text only
- no hidden metadata-only text
- no binary attachments
- no remote resource fetches

Chunk sizing:

- target 160 words
- hard cap 220 words
- overlap 32 words
- split on paragraph boundaries first, then sentence boundaries, then words
- drop chunks under 3 non-stopword tokens unless the whole source is short

Reason: `all-MiniLM-L6-v2` is intended for sentence/short paragraph embeddings and truncates long input.

## Chunk IDs

Every chunk ID must survive index rebuilds:

- `chunkId`: `rag:<source-kind>:<source-id>:<message-id-or-part>:<chunk-index>:<content-hash>`
- `sourceKind`: `chat`, `message`, or `imported-document`
- `sourceId`: chat/document ID
- `messageId`: source message/part ID when present
- `provenancePath`: adapter/source path when present
- `contentHash`: normalized chunk text hash

If source text changes, the hash changes and stale chunks are removed during rebuild.

## Vector Index Storage

Store vectors in IndexedDB unless M15.T06 proves OPFS is needed.

IndexedDB stores:

- `ragModels`: selected model ID, dtype/backend preference, downloadedAt, version metadata
- `ragChunks`: chunk metadata, text excerpt, source refs, content hash
- `ragVectors`: chunk ID, Float32Array or compact binary vector, model ID, dimensions
- `ragIndexRuns`: progress, cancellation, warnings, timings, source counts

No production schema migration ships until the copied-fixture prototype records storage and latency numbers.

## Model Lifecycle UX

Required controls:

- download model
- pause/cancel model download where browser APIs allow
- clear model cache
- build index
- pause/cancel index
- rebuild index
- clear vector index

Required states:

- unsupported browser
- WebGPU unavailable
- model download failed
- model cache cleared
- index stale
- index build cancelled
- low storage/quota failure

## Backend Policy

Baseline:

- Transformers.js embeddings in-browser
- no network after model files are downloaded unless the user updates/clears/redownloads the model
- no server component

Optional:

- WebGPU acceleration for embeddings
- Chrome Prompt API only for future local answer generation when supported

Rejected:

- hosted embeddings
- hosted LLM answer generation
- syncing vectors to cloud storage
- using Chrome Prompt API without availability checks and explicit user-visible local AI copy

## Citation Policy

Every retrieval result must cite:

- source title
- platform
- source row ID
- message/document ID where present
- timestamp where present
- imported provenance where present
- chunk excerpt

If generated answers ship later, every answer paragraph must cite one or more source chunks. Unsupported questions may return no answer.

## Privacy And Security Copy

User-visible copy must state:

- model files are downloaded to the browser profile
- vectors are stored locally with the vault
- vectors can reveal information about vault contents
- clearing the index deletes vectors but not source vault rows
- clearing the model cache deletes model files but not source vault rows
- vault text is not sent to a server by M15 baseline retrieval

Vault exports must not include cached model files. Exporting vectors is deferred until a separate portability decision.

## Eval Set

M15 needs fixture queries for:

- exact recall
- semantic recall
- stale/deleted source rows
- imported prose from M9-M14
- unsupported questions
- citation completeness
- duplicate chunks
- private/sensitive text warnings

Generated-answer hallucination tests are required only if answer generation ships.

## Performance Gates

Before production enablement, record on a copied fixture vault:

- model download size and time
- index build time for representative vault sizes
- query latency
- memory peak during indexing
- IndexedDB storage size
- cancellation latency
- rebuild behavior after source deletion

M15.T12 owns the numeric thresholds after benchmark data exists.

## Rollback

M15 writes only local model metadata, chunk rows, vector rows, and index-run metadata. Rollback is clearing `ragModels`, `ragChunks`, `ragVectors`, and `ragIndexRuns`.

No existing chat/message/import rows are modified by index rollback.

## Sources Checked

- `https://huggingface.co/docs/transformers.js/index`
- `https://huggingface.co/docs/transformers.js/api/pipelines`
- `https://huggingface.co/docs/transformers.js/guides/webgpu`
- `https://huggingface.co/docs/transformers.js/guides/dtypes`
- `https://huggingface.co/Xenova/all-MiniLM-L6-v2`
- `https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2`
- `https://developer.chrome.com/docs/ai/built-in-apis`
- `https://developer.chrome.com/docs/ai/prompt-api`
