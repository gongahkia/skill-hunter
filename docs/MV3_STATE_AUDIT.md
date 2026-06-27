# MV3 State Audit

Scope: `src/extension/background/index.js`

## Findings

No durable extension state depends on module-scope memory.

## Module-Scope Values

- `src/extension/background/index.js:15` `browserApi`: API alias only, safe to rebuild after service worker restart.
- `src/extension/background/index.js:16` `RECENT_CHALLENGE_WINDOW`: constant only.
- `src/extension/background/index.js:17` `ensureInstallStatePromise`: transient concurrency lock only. If the MV3 service worker is killed, the next event recreates the lock and reads authoritative state from `chrome.storage.local`.

## Storage-Backed State

- Install ID and first-write timestamp: `chrome.storage.local` via `STORAGE_KEYS.INSTALL_ID` and `STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP`.
- Current challenge and start timestamp: `chrome.storage.local` via `STORAGE_KEYS.CURRENT_CHALLENGE` and `STORAGE_KEYS.CHALLENGE_STARTED_AT`.
- Recent challenge slugs: `chrome.storage.local` via `STORAGE_KEYS.RECENT_CHALLENGE_SLUGS`.
- Session expiry and last solve time: `chrome.storage.local` via `STORAGE_KEYS.SESSION_EXPIRES_AT` and `STORAGE_KEYS.LAST_SOLVED_TIME`.
- User settings: `chrome.storage.local` via `STORAGE_KEYS.ENABLED_TARGET_IDS`, `STORAGE_KEYS.SESSION_DURATION_MS_PREF`, and `STORAGE_KEYS.IS_PAUSED`.

## Required Changes

None for MV3 service worker restart safety.
