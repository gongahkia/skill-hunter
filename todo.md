### Task 1 (A) +infra | Stability/Scaling

**PURPOSE** — Move Sato to a public-demo-safe same-origin shape so the Vue app can use relative `/api` calls locally and in production without breaking OAuth redirects or session cookies.

**WHAT TO DO**
1. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/app.py`, keep `create_app()` responsible for loading `CLIENT_APP_URL`, `SPOTIFY_REDIRECT_URI`, and `FRONTEND_DIST_DIR`, then serve `sato-app/dist` for non-API routes through `serve_frontend()`.
2. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/vite.config.js`, keep the Vite dev server proxy for `/api` pointing at the Flask origin so the frontend stays on relative paths during local development.
3. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/App.vue` and `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/lib/api.js`, keep all login, session, resolve, preview, and create requests on relative `/api/...` paths instead of hardcoded localhost URLs.

**DONE WHEN**
- [ ] Running `npm run build` in `/Users/gongahkia/Desktop/coding/projects/sato/sato-app` produces a deployable bundle.
- [ ] Opening `/` on the Flask app serves `index.html` from `sato-app/dist` when the built frontend exists.
- [ ] No frontend source file uses `http://127.0.0.1:5000` or `http://localhost:5000` for API calls.

### Task 2 (A) +security | Stability/Scaling

**PURPOSE** — Harden Spotify auth and session state so the login flow does not silently fail, tokens are stored server-side, and logout clears the real session instead of only the UI.

**WHAT TO DO**
1. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/app.py`, keep `/api/auth/login` generating and storing `oauth_state`, and keep `/api/auth/callback` rejecting missing or mismatched state before exchanging the code.
2. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/app.py`, keep server-side session storage under `spotify_tokens` and `spotify_user`, using `Flask-Session` with Redis when `REDIS_URL` exists and `cachelib` filesystem fallback otherwise.
3. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/spotify_client.py`, keep token refresh logic in `SpotifyClient.refresh_access_token()` and `SpotifyClient._request()` so expired tokens retry once before failing.
4. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/App.vue`, keep logout calling `POST /api/auth/logout` through `apiRequest()`.

**DONE WHEN**
- [ ] `backend/tests/test_api.py::test_callback_rejects_mismatched_state` passes.
- [ ] `backend/tests/test_api.py::test_logout_clears_session` passes.
- [ ] `backend/tests/test_spotify_client.py::test_expired_access_tokens_refresh_once_before_retrying` passes.

### Task 3 (A) +refactor | Philosophical Alignment

**PURPOSE** — Separate Spotify transport and blend scoring from Flask route code so preview and create share exactly one ranking implementation and future signal sources can reuse it.

**WHAT TO DO**
1. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/spotify_client.py`, keep `SpotifyClient` as the only module that talks to Spotify HTTP endpoints and pagination.
2. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/blend_service.py`, keep `validate_blend_request()` and `build_blend_preview()` pure and independent from Flask globals.
3. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/app.py`, keep route handlers delegating to `SpotifyClient` and `build_blend_context()` instead of embedding playlist traversal or scoring inline.

**DONE WHEN**
- [ ] `backend/app.py` no longer contains direct track scoring loops inside route handlers.
- [ ] `/api/blends/preview` and `/api/blends` both call the same preview-building code path.
- [ ] `backend/tests/test_api.py::test_preview_and_create_share_ranked_tracks_and_skip_duplicate_or_invalid_tracks` passes.

### Task 4 (A) +feature | Philosophical Alignment

**PURPOSE** — Replace the old session-coupled friend processing with a request-driven resolve step that preserves valid friends even when some input URLs are bad or unavailable.

**WHAT TO DO**
1. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/app.py`, keep `/api/friends/resolve` parsing `urls`, validating Spotify profile identifiers through `SpotifyClient.extract_user_id()`, and returning `friends`, `invalid_urls`, and `unresolved_users`.
2. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/app.py`, keep `resolve_friend_profile()` serializing public playlists into `{ id, name, track_count }` records and including users who have zero public playlists.
3. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/components/BlendView.vue`, keep the resolve step showing partial issues without discarding successfully resolved friends.

**DONE WHEN**
- [ ] `backend/tests/test_api.py::test_resolve_friends_returns_partial_success_and_keeps_empty_playlist_users` passes.
- [ ] Invalid URLs appear in `invalid_urls` instead of triggering a 500.
- [ ] Users with zero public playlists are returned with `playlist_count: 0` and do not crash the flow.

### Task 5 (A) +feature | Philosophical Alignment

**PURPOSE** — Give the user a verifiable preview of the blend ranking before Sato writes a playlist, so percentage-based control is visible instead of opaque.

**WHAT TO DO**
1. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/app.py`, keep `/api/blends/preview` accepting `self_weight` plus a `friends[]` array, resolving playlist selections, and returning ranked tracks with contributor metadata.
2. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/blend_service.py`, keep `build_blend_preview()` deduping by Spotify track id, ignoring null or local tracks, and capping the ranked list at 50 tracks.
3. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/components/BlendView.vue`, keep the preview panel rendering track score, artwork, artists, and contributor pills before the create action is triggered.

**DONE WHEN**
- [ ] Preview responses include `tracks` and `summary`.
- [ ] Duplicate playlist entries do not create duplicate tracks in the preview.
- [ ] The preview UI shows contributor names and percentages for each ranked track.

### Task 6 (B) +feature | Philosophical Alignment

**PURPOSE** — Make the core percentage promise real by enforcing a 100% budget across the user and selected friends, while letting the user choose exactly which public playlists feed each friend’s influence.

**WHAT TO DO**
1. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/lib/blend.js`, keep `distributeFriendWeights()`, `totalBlendWeight()`, and `buildBlendPayload()` as the shared source of truth for weight math and payload generation.
2. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/components/BlendView.vue`, keep the self-weight slider, per-friend sliders, and playlist checkboxes wired so deselected friends contribute `0` and selected friends always send `playlist_ids`.
3. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/blend_service.py`, keep `validate_blend_request()` rejecting totals that do not equal exactly `100`.

**DONE WHEN**
- [ ] `backend/tests/test_api.py::test_preview_rejects_weight_totals_that_do_not_equal_one_hundred` passes.
- [ ] `sato-app/src/lib/blend.test.js` passes.
- [ ] The UI disables preview/create when the total is not exactly `100` or when a selected friend has no playlist selected.

### Task 7 (B) +frontend | Stability/Scaling

**PURPOSE** — Replace the starter-level frontend shell with a mobile-safe, step-based product flow that communicates loading, partial failure, preview, and success states clearly enough for a public demo.

**WHAT TO DO**
1. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/App.vue`, keep the page organized into a hero card, auth/session status card, and the authenticated blend builder experience.
2. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/components/BlendView.vue`, keep explicit states for resolving friends, validation warnings, preview output, and created playlist success.
3. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/style.css`, keep the visual system rooted in CSS variables, responsive spacing, and non-default typography/background styling.

**DONE WHEN**
- [ ] The frontend has explicit UI states for unauthenticated, loading session, resolved friends, preview, and playlist-created success.
- [ ] The invalid `align-items: ce;` styling defect from the previous version is gone.
- [ ] `npm run build` succeeds after the UI rewrite.

### Task 8 (B) +utility | DX/Utility

**PURPOSE** — Normalize failures across the stack so backend errors arrive in a consistent shape and the frontend stops rendering raw server text or missing-scroll targets.

**WHAT TO DO**
1. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/app.py`, keep `ApiError`, the registered error handlers, and structured Spotify logging so API failures return `{ error: { code, message, details } }`.
2. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/lib/api.js`, keep `parseApiError()` and `apiRequest()` handling both JSON and empty-body responses while preserving `error.status`.
3. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/components/BlendView.vue`, keep all failure rendering on visible `feedback-card` elements instead of raw server text or a nonexistent `.error-message` node.

**DONE WHEN**
- [ ] Backend 4xx and 5xx responses use the normalized `error.code` and `error.message` envelope.
- [ ] Frontend API failures surface a readable message from `parseApiError()` instead of raw HTML or response text.
- [ ] `sato-app/src/lib/api.test.js` passes.

### Task 9 (A) +infra | DX/Utility

**PURPOSE** — Add automated checks around the real login/resolve/preview/create contract so the repo can keep shipping without reintroducing the same silent regressions.

**WHAT TO DO**
1. In `/Users/gongahkia/Desktop/coding/projects/sato/backend/tests/test_api.py` and `/Users/gongahkia/Desktop/coding/projects/sato/backend/tests/test_spotify_client.py`, keep mocked tests covering OAuth state validation, logout, partial friend resolution, preview/create parity, duplicate-track filtering, token refresh, and pagination.
2. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/components/BlendView.test.js` and `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/src/lib/*.test.js`, keep Vitest coverage for relative API usage, payload building, and weight-balancing behavior.
3. In `/Users/gongahkia/Desktop/coding/projects/sato/.github/workflows/ci.yml`, keep GitHub Actions running backend tests, frontend tests, and a production build on push and pull request.

**DONE WHEN**
- [ ] Running `./.venv/bin/pytest` in `/Users/gongahkia/Desktop/coding/projects/sato/backend` passes.
- [ ] Running `npm run test -- --run` in `/Users/gongahkia/Desktop/coding/projects/sato/sato-app` passes.
- [ ] The GitHub Actions workflow runs backend tests, frontend tests, and `npm run build`.

### Task 10 (C) +security | DX/Utility

**PURPOSE** — Remove the known frontend tooling advisories so the demo stack does not ship with avoidable Vite/Rollup security issues.

**WHAT TO DO**
1. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/package.json`, keep Vite and the Vue plugin on patched versions that eliminate the previously observed audit findings.
2. In `/Users/gongahkia/Desktop/coding/projects/sato/sato-app/package-lock.json`, keep the resolved dependency tree aligned with the patched package versions.
3. In `/Users/gongahkia/Desktop/coding/projects/sato/.github/workflows/ci.yml`, keep the frontend install step on `npm ci` so the locked versions are the ones actually exercised in CI.

**DONE WHEN**
- [ ] `npm audit --json` in `/Users/gongahkia/Desktop/coding/projects/sato/sato-app` reports zero vulnerabilities.
- [ ] `npm run build` still succeeds after the dependency upgrade.
- [ ] The repo contains patched Vite and Rollup versions in `package-lock.json`.
