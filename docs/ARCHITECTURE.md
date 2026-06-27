# Architecture

## Module Map

- `src/extension/background/`: extension service worker/background script. Owns storage-backed state, challenge rotation, session grants, settings, and runtime messages.
- `src/extension/content/`: page scripts for chatbot gate rendering and LeetCode submission detection.
- `src/extension/ui/`: popup dashboard, settings, saved-prompt review, and digest exports.
- `src/extension/lib/`: browser/runtime helpers and local SVG renderers.
- `src/shared/core/`: constants, provider contracts, scoring, and streak logic shared by build targets.
- `src/shared/data/`: bundled challenge packs.
- `cli/`: standalone `@dorso/cli` package that reads local status JSON exports.
- `schemas/`: JSON Schemas for community challenge packs.
- `cloudflare/`: optional stateless SVG badge Worker.
- `scripts/`: extension build and Safari wrapper sync scripts.

## Gate Flow

```mermaid
flowchart TD
    A[chatbot content script] --> B[requestState]
    B --> C[background reads chrome.storage.local]
    C --> D{active session?}
    D -->|yes| E[remove gate]
    D -->|no| F[startChallenge]
    F --> G[ChallengeProvider getChallenge]
    G --> H[persist current challenge]
    H --> I[render gate overlay]
    I --> J[user opens source challenge]
    J --> K[source content/provider verify]
    K --> L{ok?}
    L -->|yes| M[start session]
    L -->|no| N[render local error banner]
```

## Badge Flow

```mermaid
flowchart TD
    A[extension state] --> B[compute Cognitive Index]
    B --> C[canonical badge state]
    C --> D[base64url state]
    D --> E[HMAC-SHA256 signature]
    E --> F[badge markdown/url]
    F --> G[Cloudflare Worker]
    G --> H{signature and age valid?}
    H -->|yes| I[cacheable SVG badge]
    H -->|no| J[error response]
```

## CLI Flow

```mermaid
flowchart TD
    A[popup enables CLI export] --> B[background stores Downloads-relative path]
    B --> C[chrome.alarms periodic tick]
    C --> D[background builds status snapshot]
    D --> E[chrome.downloads overwrites JSON export]
    E --> F[dorso status reads local file]
    F --> G[human, JSON, or prompt output]
```

## Storage

All extension runtime state is stored in `chrome.storage.local`. The background script treats storage as authoritative because MV3 service workers can be stopped and restarted between events.
