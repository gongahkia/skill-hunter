# sato-pulse

Emotion-driven music player for local desktop use on macOS and Linux that detects your mood via webcam and auto-curates YouTube Music tracks through mpv.

It samples webcam frames in Python, classifies them into 5 mood states (FOCUS, STRESSED, RELAXED, TIRED, ENERGIZED), then searches YouTube Music for mood-appropriate tracks and plays them through mpv.

## Features

- Startup health checks for Python, webcam, mpv/yt-dlp, and YouTube Music auth
- Scheduled webcam emotion sampling with 5-state mood classification
- Swappable local emotion backends: `deepface_mobilenet`, `deepface_opencv`
- YouTube Music integration via ytmusicapi
- mpv-based audio playback via JSON IPC
- Bubble Tea dashboard with:
  - Frame-derived ASCII webcam preview
  - Emotion probability bars
  - Now Playing with progress bar
  - Separate detected mood and active soundtrack mood state
  - Mood history timeline
  - Confidence sparklines
  - Live setup/status screens
- Manual mood override (keys `1-5`)
- Do Not Disturb mode
- Track blacklisting
- Local session persistence to SQLite
- `history` and `export` commands for recorded sessions
- Dry-run mode for testing without mpv playback

Deferred from the current MVP:
- Adaptive sampling
- Analytics/trends dashboards
- Local-library playback

## Requirements

| Tool | Version |
|------|---------|
| Go | >= 1.22 |
| Python | >= 3.11 |
| mpv | any recent |
| yt-dlp | any recent |
| Webcam | USB or built-in |

## Installation

```bash
# Clone
git clone https://github.com/gongahkia/sato-pulse.git
cd sato-pulse

# Build Go binary
go build -o sato-pulse ./cmd/sato-pulse

# Install Python dependencies
cd mood-engine && pip install -e . && cd ..

# First-time setup
./sato-pulse configure
./sato-pulse setup
```

## Usage

```bash
# Start the app
./sato-pulse

# Interactive configuration
./sato-pulse configure

# Check component health
./sato-pulse status

# Test without playback
./sato-pulse --dry-run

# Export mood history
./sato-pulse export --format csv
```

## Configuration

Config file: `~/.config/sato-pulse/config.toml`

Run `./sato-pulse configure` for local app settings and `./sato-pulse setup` for YouTube Music auth.

This product is intentionally local-only for the current milestone. Emotion detection runs through the local Python engine, and session history stays in local SQLite.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design, data flows, and component responsibilities.

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for development setup, testing strategy, and git workflow.
