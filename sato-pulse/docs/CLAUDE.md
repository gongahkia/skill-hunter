# sato-pulse — Agent Instructions

sato-pulse is an emotion-driven music player that detects the user's mood via webcam (DeepFace/OpenCV in Python), classifies it into one of 5 mood states, then auto-curates and plays YouTube Music tracks through mpv. Go handles the TUI (Bubble Tea), CLI (Cobra), mpv IPC, and orchestration. Python handles emotion detection and YouTube Music search. The two communicate via JSON-over-stdin/stdout IPC.

## Quick Reference

| Doc | Purpose |
|-----|---------|
| `todo.txt` | Full task spec (81 tasks, priority A/B/C) — the source of truth |
| `ARCHITECTURE.md` | System architecture, component diagram, data flows |
| `STYLE.md` | Go + Python code style, error handling, logging, naming |
| `IPC_PROTOCOL.md` | JSON IPC contract between Go and Python |
| `CONTRIBUTING.md` | Git workflow, testing strategy, dependency management |

## Repo Layout (target)

```
sato-pulse/
├── cmd/
│   └── sato-pulse/
│       └── main.go              # Cobra root command, entry point
├── internal/
│   ├── bridge/
│   │   └── sato_pulse.go        # Mood-to-music bridge (Task 27)
│   ├── config/
│   │   └── config.go            # TOML config parsing (Task 6)
│   ├── ipc/
│   │   ├── manager.go           # Python subprocess lifecycle (Task 4)
│   │   └── protocol.go          # IPC message types (Task 3)
│   ├── mpv/
│   │   ├── client.go            # mpv process management (Task 22)
│   │   ├── ipc.go               # mpv JSON IPC over Unix socket (Task 23)
│   │   └── observer.go          # Playback state polling (Task 25)
│   ├── queue/
│   │   └── manager.go           # Track queue with auto-refill (Task 26)
│   ├── tui/
│   │   ├── model.go             # Bubble Tea main model (Task 28)
│   │   ├── dashboard.go         # Dashboard layout (Task 29)
│   │   ├── widgets/             # Individual TUI widgets (Tasks 30-38)
│   │   └── events.go            # Async event architecture (Task 39)
│   └── analytics/
│       └── aggregator.go        # Mood analytics (Task 60)
├── mood-engine/                  # Python package
│   ├── pyproject.toml
│   ├── mood_engine/
│   │   ├── __init__.py
│   │   ├── __main__.py          # IPC event loop entry point (Task 5)
│   │   ├── capture.py           # Webcam capture (Tasks 8-11)
│   │   ├── detection.py         # Face detection + emotion analysis (Tasks 12-13)
│   │   ├── backends.py          # Emotion backend factory (Task 14)
│   │   ├── smoother.py          # Sliding window smoother (Task 15)
│   │   ├── classifier.py        # Mood classification + debounce (Tasks 16-18)
│   │   ├── music_client.py      # ytmusicapi wrapper (Tasks 19-21)
│   │   └── ipc.py               # IPC message handling (Task 5)
│   └── tests/
│       ├── test_emotion_pipeline.py  # Task 64
│       └── test_ytmusic.py           # Task 66
├── go.mod
├── go.sum
├── todo.txt                      # Task spec (source of truth)
├── CLAUDE.md                     # This file
├── ARCHITECTURE.md
├── STYLE.md
├── IPC_PROTOCOL.md
└── CONTRIBUTING.md
```

## Constraints

- **Go >= 1.22** — uses range-over-func, improved stdlib
- **Python >= 3.11** — required by DeepFace, better error messages
- **External binaries**: `mpv` and `yt-dlp` must be installed on the host
- **YouTube Music auth**: `ytmusicapi` requires browser cookie extraction (no OAuth)
- **Platform support**: Linux (V4L2) and macOS (AVFoundation) for webcam access

## Build & Run

```bash
# Go
go build -o sato-pulse ./cmd/sato-pulse
./sato-pulse --help

# Python (dev install)
cd mood-engine && pip install -e . && cd ..

# Run
./sato-pulse
./sato-pulse configure    # First-time setup
./sato-pulse --dry-run    # Test without playback
```

## Test

```bash
# Go tests
go test ./...

# Python tests
cd mood-engine && python -m pytest tests/ && cd ..
```

## Implementation Order

Follow `todo.txt` priority tiers:

1. **Priority A (Tasks 1-40, 64-67)** — Core MVP. Build in dependency order:
   - Core Setup (1-7) — CLI bootstrap, Python package, IPC protocol, config
   - Webcam Capture (8-11) — OpenCV capture, platform backends, health check
   - Emotion Detection (12-15) — Face detection, DeepFace, backend abstraction, smoother
   - Mood Classification (16-18) — Taxonomy, classifier, debouncing
   - YouTube Music (19-21) — Auth, search, mood-to-query mapping
   - mpv Playback (22-26) — Client, IPC, URL handling, observer, queue
   - Bridge (27) — Wire emotion → music
   - TUI (28-40) — State machine, layout, widgets, controls, status, events, end-to-end
   - Tests (64-67) — Emotion pipeline, mpv IPC, ytmusic, integration

2. **Priority B (Tasks 41-62, 68-70)** — Enhancements after MVP works
3. **Priority C (Tasks 63, 71-81)** — Polish and nice-to-have

Tasks within a priority can be parallelized as long as their `blockedBy` dependencies are satisfied.

## Key Design Decisions

- Python runs as a **long-lived subprocess**, not invoked per-request
- IPC is **JSON-over-stdin/stdout** (not HTTP, not gRPC) — see `IPC_PROTOCOL.md`
- mpv is controlled via **JSON IPC over Unix socket** at `/tmp/sato-pulse-mpv.sock`
- YouTube URLs are passed directly to mpv (mpv handles yt-dlp internally)
- TUI uses **Bubble Tea + Lip Gloss + Bubbles** (Charm ecosystem)
- All logs go to **stderr** (stdout reserved for IPC on Python side)
- Config lives at `~/.config/sato-pulse/config.toml`
