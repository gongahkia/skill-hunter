# M15 RAG Model Selection

Status: accepted for M15.T04.
Date: 2026-06-18

## Selected Model

- model: `Xenova/all-MiniLM-L6-v2`
- source model: `sentence-transformers/all-MiniLM-L6-v2`
- task: `feature-extraction`
- runtime: Transformers.js browser extension path
- backend: WASM/CPU baseline
- optional backend: WebGPU only after capability check
- dtype: `q8`
- pooling: mean
- normalize: true
- embedding dimensions: 384
- license: Apache 2.0
- upstream model size: 22.7M parameters
- measured q8 cache size: 22.59 MB in a temp Transformers.js filesystem cache

## Decision

Use `Xenova/all-MiniLM-L6-v2` for M15 retrieval-only semantic search.

Reasons:

- It has Transformers.js-compatible ONNX weights.
- It is licensed Apache 2.0.
- It produces 384-dimensional vectors, keeping local vector storage small.
- It is intended for sentence and short-paragraph semantic retrieval.
- The measured q8 cache footprint is small enough for browser-extension use.

## Measured CLI Proxy

Command shape:

- temp cache under `/tmp/rakuzaichi-rag.*`
- `@huggingface/transformers@4.2.0`
- `pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" })`
- 4 copied fixture text chunks
- mean pooling and normalized vectors

Result on this machine:

| Metric | Value |
| :--- | ---: |
| Model load plus first download | 2189 ms |
| Embed 4 chunks | 11 ms |
| Embed 1 query | 1 ms |
| Output dimensions | 4 x 384 |
| Query dimensions | 1 x 384 |
| Cache size | 22.59 MB |

Expected baseline for M15 is q8 WASM. [Inference] Browser latency can be higher than this Node CLI proxy, so M15.T12 owns the user-facing performance gates.

## Rejected For M15 Baseline

- larger embedding models: better recall may not justify first-use download/storage cost
- WebGPU-only models: WebGPU is not universally available
- Chrome Prompt API/Gemini Nano: answer-generation path, not embeddings baseline
- hosted embeddings: violates zero-server local vault scope

## Sources Checked

- `https://huggingface.co/Xenova/all-MiniLM-L6-v2`
- `https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2`
- `https://huggingface.co/docs/transformers.js/index`
- `https://huggingface.co/docs/transformers.js/guides/dtypes`
