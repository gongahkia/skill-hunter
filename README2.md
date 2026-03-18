# Dorso vNext

`Dorso` now builds into browser-specific `dist/` bundles without mutating the repo, uses a shared extension runtime for Chrome and Firefox, and supports both verified unlock challenges and catalog-only practice prompts.

## What Changed

- Blocked AI chatbot tabs now route into `extension/ui/gate.html` instead of reusing the popup as a full-page trap.
- The popup is now a dashboard with session state, current challenge, history, preferences, linked handles, and a practice deck.
- Verified unlock sources:
  - `LeetCode`
  - `Codeforces` when a `codeforces_handle` is linked
- Practice-only catalog sources:
  - `Codewars`
  - `Exercism`
- Backend APIs now expose:
  - user preferences
  - linked identities
  - source-aware challenge payloads
  - Codeforces verification
  - a curated practice deck

## Local Setup

### Backend

Recommended interpreter: `Python 3.12`.

```console
python3.12 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
REDIS_URL=locmem://dorso .venv/bin/pytest backend
```

For development server runs:

```console
cd backend
REDIS_URL=locmem://dorso ../.venv/bin/python manage.py runserver
```

`locmem://` is supported for local and CI runs so Redis is no longer mandatory just to boot the app or run tests.

### Shared JS Tests

```console
cd src/shared
npm install
npm test -- --runInBand
```

### Extension Builds

```console
npm run build
```

Outputs:

- `dist/chrome`
- `dist/firefox`

Those bundles are generated from:

- `src/extension/*`
- `src/shared/*`

The legacy browser-specific folders are no longer the build source of truth.

## Runtime Notes

- Dorso stores the blocked AI tab URL and tab id before swapping the page to the gate view.
- A successful verified solve restores the blocked AI destination and starts a fixed 15-minute unlock session.
- LeetCode unlocks are detected through the content script on accepted submissions.
- Codeforces unlocks are verified explicitly through the linked handle and backend verification endpoint.
- Practice deck entries never unlock access.

## API Surface

- `GET /api/v1/problems/random/?extension_id=<id>`
- `POST /api/v1/problems/submit/`
- `POST /api/v1/problems/attempt/`
- `POST /api/v1/problems/verify-codeforces/`
- `GET /api/v1/problems/practice-deck/`
- `GET/PATCH /api/v1/users/<extension_id>/preferences/`
- `GET/PATCH /api/v1/users/<extension_id>/identities/`
- `GET /api/v1/users/<extension_id>/stats/`

## Rollback-Friendly Delivery

The implementation was split into incremental commits so each major slice can be reverted independently:

1. build and packaging cleanup
2. backend preference and metadata support
3. shared gate and dashboard runtime
4. verified Codeforces integration
5. practice deck, docs, and CI

## CI

GitHub Actions now runs:

- backend pytest on Python 3.12 with `REDIS_URL=locmem://dorso`
- shared Jest tests
- extension build generation

