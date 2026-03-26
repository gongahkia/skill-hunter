# Sato + Sato Pulse Integration

This document covers the integration between **Sato** (collaborative Spotify blend builder) and **Sato Pulse** (emotion-driven desktop music player).

## Architecture Overview

Both apps now share a common mood vocabulary and can cross-pollinate data:

```
shared/mood_profiles.json          <-- canonical mood definitions
        |                   |
   Sato (web)         Sato Pulse (desktop)
   - mood blend source    - shared query config
   - browser detection    - Spotify playback
   - mood history read    - mood history write
```

## Shared Mood Profiles

`shared/mood_profiles.json` defines 5 moods consumed by both apps:

| Mood | Color | Example Genres | Audio Feature Targets |
|------|-------|----------------|----------------------|
| FOCUS | #4A90D9 | study, ambient, chill | low energy, low valence |
| STRESSED | #D94A4A | piano, acoustic, classical | low energy, high valence (calming) |
| RELAXED | #6ABF69 | chill, indie, acoustic | moderate energy, moderate valence |
| TIRED | #D9A84A | pop, dance, electronic | high energy (energizing) |
| ENERGIZED | #9B59B6 | electronic, workout, edm | high energy, high valence |

Each mood includes:
- Search query strings (for YouTube Music / text search)
- Spotify audio feature target ranges (valence, energy, danceability, tempo, acousticness)
- Seed genres for Spotify recommendations API

## Feature: Mood-Based Blend Source (Sato Web)

Users can now select **"Mood-Based Tracks"** as a contribution source in blend rooms.

**How it works:**
1. Check the "Mood-Based Tracks" checkbox in the source editor
2. Select a mood manually (click a mood chip) or use webcam detection
3. Save contribution -- backend fetches mood-appropriate tracks via Spotify recommendations API
4. Tracks are seeded from your top tracks/artists, filtered by audio feature targets from the mood profile

**API additions:**
- `GET /api/mood-profiles` -- returns all mood profiles
- `GET /api/me/mood-summary` -- returns sato-pulse desktop mood distribution (if available)
- `PUT /api/rooms/<token>/contribution` -- now accepts `use_mood_tracks` and `mood_state` fields

**Backend files:**
- `backend/mood_service.py` -- fetches mood-appropriate tracks using Spotify recommendations
- `backend/mood_history.py` -- reads sato-pulse's SQLite history for mood suggestions

**Spotify client additions** (`backend/spotify_client.py`):
- `get_recommendations()` -- Spotify recommendations with audio feature targets
- `get_audio_features()` -- batch audio feature lookup
- `get_current_user_top_artists()` -- seed data for recommendations
- `search_tracks()` -- text search

## Feature: Browser Mood Detection (Sato Web)

When "Mood-Based Tracks" is enabled, a webcam mood detector appears:

1. Click "Start Camera" to begin emotion detection
2. Uses `face-api.js` running entirely client-side (no video sent to server)
3. Detects 7 emotions (angry, disgust, fear, happy, sad, surprise, neutral)
4. Classifies into 5 moods using the same algorithm as sato-pulse's Python classifier
5. Applies weighted smoothing (window=5) and debouncing (3 frames)
6. Click "Use [MOOD] as mood source" to set it

**Frontend files:**
- `sato-app/src/lib/mood-classifier.js` -- JS port of sato-pulse's `classifier.py`
- `sato-app/src/lib/mood-detection.js` -- Vue composable wrapping face-api.js
- `sato-app/src/components/MoodDetector.vue` -- webcam preview + mood display

**Setup:** The `face-api.js` models must be served from `sato-app/public/models/`. Download from the face-api.js repo:
- `tiny_face_detector_model-weights_manifest.json` + shard
- `face_expression_net-weights_manifest.json` + shard

## Feature: Desktop Mood History Cross-Pollination

If sato-pulse has been running on the same machine, Sato reads its mood history to suggest a mood:

- Reads `~/.local/share/sato-pulse/history.db` (sato-pulse's SQLite)
- Shows "Desktop mood (last 24h): STRESSED 60%" in the MoodDetector UI
- User can click to use the dominant desktop mood as their blend source

## Feature: Spotify Playback Backend (Sato Pulse)

Sato Pulse can now use Spotify instead of YouTube Music + mpv for playback.

**Config** (`~/.config/sato-pulse/config.toml`):
```toml
[playback]
source = "spotify"  # or "ytmusic" (default)

[spotify]
client_id = "your_spotify_app_client_id"
```

**Architecture:**
- `PlaybackProvider` interface in `sato-pulse/internal/bridge/provider.go`
- `YTMusicProvider` -- existing YouTube Music + mpv path
- `SpotifyProvider` -- new Spotify Web API path via IPC
- Provider selected based on `config.toml` `playback.source`

**Spotify playback controls the user's active Spotify device** (phone, desktop app, web player) via Web API. No mpv needed in Spotify mode.

**PKCE Auth:** Run `sato-pulse configure` and set `SPOTIFY_CLIENT_ID` env var. Auth uses Authorization Code with PKCE (no client secret needed). Tokens stored at `~/.config/sato-pulse/spotify_tokens.json`.

**IPC message types added:**
- `spotify_search_request/result` -- search Spotify catalog
- `spotify_play_request/result` -- start playback on active device
- `spotify_pause_request` / `spotify_resume_request` / `spotify_control_result`
- `spotify_state_request/result` -- get current playback state

**Files:**
- `shared/spotify_client.py` -- desktop Spotify client with PKCE
- `sato-pulse/mood-engine/mood_engine/spotify_handler.py` -- IPC handlers
- `sato-pulse/internal/bridge/spotify_provider.go` -- Go-side provider
- `sato-pulse/internal/bridge/ytmusic_provider.go` -- refactored existing path

## Shared Mood Profile Loading (Sato Pulse)

Sato Pulse's Go config now loads `shared/mood_profiles.json` and merges queries with TOML overrides:

```
shared/mood_profiles.json  (base queries)
         |
    TOML config override   (user can customize per-mood queries)
         |
    Final MoodQueries map  (used by bridge)
```

TOML overrides take precedence. If a mood has queries in TOML, the shared JSON queries for that mood are ignored.

Set `shared_profiles_path` in config.toml to override the JSON file location.

## TUI Changes

The status bar now shows the active playback source:
```
cam:OK  play:OK  src:spotify  py:OK  backend:deepface_mobilenet
```
