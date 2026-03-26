# Architecture

Current MVP status:
- Implemented: startup health checks, periodic capture requests, mpv playback control, manual overrides, DND suppression, blacklist filtering, SQLite session persistence, and swappable local emotion backends on macOS/Linux.
- Deferred from the current MVP surface: adaptive sampling, analytics/trends views, and alternate playback sources beyond YouTube Music plus mpv.

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Go Process                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Bubble Tea TUI (terminal)                   │    │
│  │  ┌──────────┬──────────────┬───────────┬─────────────┐  │    │
│  │  │  ASCII   │  Now Playing │   Mood    │   Status    │  │    │
│  │  │  Webcam  │  + Controls  │  History  │    Bar      │  │    │
│  │  │ Preview  │  + Progress  │ Timeline  │             │  │    │
│  │  └──────────┴──────────────┴───────────┴─────────────┘  │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │ Go channels                            │
│  ┌──────────┐  ┌────────┴────────┐  ┌──────────────────┐       │
│  │  Config  │  │  Bridge         │  │  Queue Manager   │       │
│  │  (TOML)  │  │  (mood→music)   │  │  ([]Track)       │       │
│  └──────────┘  └───┬─────────┬───┘  └────────┬─────────┘       │
│                    │         │                │                   │
│            ┌───────┘         └────────┐       │                  │
│            ▼                          ▼       ▼                  │
│  ┌─────────────────┐        ┌─────────────────────┐             │
│  │  IPC Manager    │        │  mpv Client          │             │
│  │  (subprocess)   │        │  (Unix socket IPC)   │             │
│  └────────┬────────┘        └──────────┬──────────┘             │
│           │ JSON stdin/stdout           │ JSON IPC               │
└───────────┼─────────────────────────────┼────────────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐    ┌─────────────────────────┐
│    Python Process      │    │       mpv Process        │
│    (mood-engine)       │    │                           │
│  ┌─────────────────┐  │    │  --idle --no-video        │
│  │ IPC Event Loop  │  │    │  --input-ipc-server=      │
│  │   (stdin/out)   │  │    │    /tmp/mood-music-       │
│  └───┬─────────┬───┘  │    │    mpv.sock               │
│      │         │       │    │  --ytdl-format=bestaudio  │
│      ▼         ▼       │    └─────────────┬─────────────┘
│  ┌───────┐ ┌───────┐  │                  │
│  │Webcam │ │YTMusic│  │                  │ yt-dlp
│  │Capture│ │Client │  │                  ▼
│  └───┬───┘ └───┬───┘  │    ┌─────────────────────────┐
│      ▼         │       │    │     YouTube Music        │
│  ┌───────┐     │       │    │     (audio stream)       │
│  │ Face  │     │       │    └─────────────────────────┘
│  │Detect │     │       │
│  └───┬───┘     │       │
│      ▼         │       │
│  ┌───────┐     │       │
│  │DeepFce│     │       │
│  │Emotion│     │       │
│  └───┬───┘     │       │
│      ▼         │       │
│  ┌───────┐     │       │
│  │Smoother│    │       │
│  └───┬───┘     │       │
│      ▼         │       │
│  ┌────────┐    │       │
│  │Mood    │    │       │
│  │Classifr│    │       │
│  └────────┘    │       │
└────────────────┘       │
                         │
            ytmusicapi ──┘
```

## Data Flows

### 1. Emotion Detection Cycle (every N seconds)

```
Go IPC Manager                    Python mood-engine
      │                                  │
      │──capture_request───────────────►│
      │                                  │── open camera, capture frame
      │                                  │── detect face (OpenCV)
      │                                  │── analyze emotion (DeepFace)
      │                                  │── smooth (sliding window)
      │                                  │── classify mood
      │◄──emotion_result────────────────│
      │                                  │
      │ result contains:
      │   mood: "FOCUS"
      │   confidence: 0.82
      │   emotions: {happy: 0.3, neutral: 0.6, ...}
      │   face_detected: true
      ▼
  TUI renders detected mood; bridge attempts a switch and only commits active mood after successful playback handoff
```

### 2. Mood Transition → Music Switch

```
Bridge                     IPC Manager / Python          mpv Client
  │                              │                           │
  │ mood changed                 │                           │
  │ (debounce: 30s)              │                           │
  │                              │                           │
  │──search_request─────────────►│                           │
  │  {mood: "RELAXED",           │── ytmusicapi.search()     │
  │   query: "chill vibes"}      │                           │
  │                              │                           │
  │◄──search_result──────────────│                           │
  │  {tracks: [...10 tracks]}    │                           │
  │                              │                           │
  │──clear queue + load tracks────────────────────────────────►│
  │                                                           │
  │──play first track URL─────────────────────────────────────►│
  │  loadfile https://music.youtube.com/watch?v=VIDEO_ID      │
  │                                                           │
```

### 3. Track Queue Auto-Refill

```
mpv Observer          Queue Manager              Bridge
    │                      │                        │
    │ idle-active=true     │                        │
    │ (track ended)        │                        │
    │─────────────────────►│                        │
    │                      │── play next track      │
    │                      │                        │
    │                      │ queue.len < 3?         │
    │                      │── yes ─────────────────►│
    │                      │                        │── request more tracks
    │                      │                        │   for current mood
    │                      │◄── append new tracks ──│
    │                      │                        │
```

## Component Responsibilities

| Component | Language | Responsibility |
|-----------|----------|---------------|
| `cmd/mood-music` | Go | CLI entry point, Cobra commands, global flags |
| `internal/config` | Go | Parse TOML config, provide defaults |
| `internal/ipc` | Go | Spawn Python subprocess, send/receive JSON, handle crashes with exponential backoff (max 3 retries) |
| `internal/mpv` | Go | Spawn mpv, JSON IPC over Unix socket, poll playback state every 1s |
| `internal/queue` | Go | Maintain track queue, auto-refill at 3-track threshold, clear on mood change |
| `internal/bridge` | Go | Convert detected moods into committed soundtrack changes, 30s debounce, DND/manual override semantics |
| `internal/tui` | Go | Bubble Tea state machine (STARTUP/DASHBOARD/SETTINGS/SETUP_FLOW), 5-zone layout, async events via channels |
| `internal/analytics` | Go | SQLite mood history aggregation, cached with 5-min TTL |
| `mood_engine.capture` | Python | OpenCV webcam capture, platform backends (V4L2/AVFoundation), base64 JPEG output |
| `mood_engine.detection` | Python | Face detection (Haar/DeepFace), DeepFace emotion analysis (7 emotions) |
| `mood_engine.backends` | Python | Factory pattern for local emotion backends (deepface_mobilenet, deepface_opencv) |
| `mood_engine.smoother` | Python | Circular buffer of N=5 emotion results, weighted moving average |
| `mood_engine.classifier` | Python | Map smoothed emotions → 5 MoodStates (FOCUS/STRESSED/RELAXED/TIRED/ENERGIZED), 3-window debounce |
| `mood_engine.music_client` | Python | ytmusicapi wrapper: auth, search (limit=20), watch playlist, URL generation |
| `mood_engine.ipc` | Python | stdin/stdout JSON event loop, message dispatch, SIGTERM handling |

## Concurrency Model (Go)

```
                    ┌──────────────────┐
                    │   Main Goroutine  │
                    │   (Bubble Tea)    │
                    └──────┬───────────┘
                           │ tea.Cmd / tea.Msg
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
   ┌────────────┐  ┌────────────┐  ┌──────────┐
   │ IPC Reader │  │ mpv Poller │  │ Sampling │
   │ goroutine  │  │ goroutine  │  │  Timer   │
   │            │  │ (1s tick)  │  │ goroutine│
   └─────┬──────┘  └─────┬──────┘  └────┬─────┘
         │               │              │
    emotionCh        nowPlayingCh    tickCh
         │               │              │
         └───────────────┼──────────────┘
                         ▼
              Bubble Tea Update() loop
              (processes all channel msgs
               as tea.Msg via tea.Sub)
```

All inter-component communication uses typed Go channels. The Bubble Tea model consumes channel messages via `tea.Sub` subscriptions. No shared mutable state — each goroutine owns its data and communicates via messages.

## State Machine (TUI)

```
    STARTUP ──────► SETUP_FLOW ──────► DASHBOARD
       │                                  │
       │ (all checks pass)                │ (press 'c')
       │                                  ▼
       └──────────────────────────► SETTINGS
                                       │
                                       │ (press Esc)
                                       ▼
                                   DASHBOARD
```

- **STARTUP**: Check camera, mpv, yt-dlp, ytmusicapi auth. If any fail → SETUP_FLOW.
- **SETUP_FLOW**: Interactive Bubble Tea form for first-time config.
- **DASHBOARD**: Main 5-zone view. Active during normal operation.
- **SETTINGS**: Accessible from dashboard. Edit config values.

## Config File Location

```
~/.config/mood-music/
├── config.toml           # All app settings
├── headers_auth.json     # ytmusicapi browser cookie auth
└── blacklist.json        # Blacklisted track video_ids (Priority B)

~/.local/share/mood-music/
└── history.db            # SQLite mood history (Priority B)
```
