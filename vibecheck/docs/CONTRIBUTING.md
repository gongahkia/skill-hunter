# Contributing

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Go | >= 1.22 | `go version` |
| Python | >= 3.11 | `python3 --version` |
| mpv | any recent | `mpv --version` |
| yt-dlp | any recent | `yt-dlp --version` |
| Webcam | USB or built-in | macOS: grant Terminal camera access. Linux: `ls /dev/video*` |

## Setup

```bash
# Go dependencies
go mod tidy

# Python dependencies (dev install)
cd mood-engine
pip install -e ".[dev]"
cd ..
```

## Git Workflow

### Branching

- `main` — stable, passing CI
- Feature branches: `feat/<scope>-<short-desc>` (e.g., `feat/ipc-manager`, `feat/tui-dashboard`)
- Fix branches: `fix/<scope>-<short-desc>`

### Conventional Commits

All commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`

**Scopes** (match todo.txt tags):
| Scope | Area |
|-------|------|
| `cli` | CLI commands, flags, config parsing |
| `ipc` | Go↔Python IPC protocol and manager |
| `capture` | Webcam capture module |
| `emotion` | Face detection, emotion analysis, backends |
| `mapping` | Mood taxonomy, classifier, debouncing |
| `ytmusic` | YouTube Music client and search |
| `mpv` | mpv process management, IPC, observer |
| `queue` | Track queue management |
| `bridge` | Mood-to-music bridge |
| `tui` | Bubble Tea TUI, widgets, layout |
| `analytics` | Mood analytics and aggregation |
| `testing` | Test infrastructure |

**Examples**:
```
feat(ipc): implement Go-side subprocess manager with crash recovery
feat(emotion): add sliding window emotion smoother
fix(mpv): handle socket timeout on slow yt-dlp fetch
test(mpv): add mock Unix socket tests for IPC client
refactor(tui): extract mood badge into separate widget
```

One commit per task or logical unit. Reference task numbers in the commit body when relevant:

```
feat(capture): implement OpenCV webcam capture with base64 output

Implements Task 8: webcam capture module using OpenCV.
Camera is released between captures to minimize resource hold.
Returns base64-encoded JPEG for IPC transport.
```

## Testing Strategy

### What to Test

Core paths that the MVP depends on:

| Component | Test File | What to Cover |
|-----------|-----------|---------------|
| Emotion pipeline | `mood-engine/tests/test_emotion_pipeline.py` | Face detection with mock frames, smoother weighted averages, mood classifier thresholds (Task 64) |
| mpv IPC client | `internal/mpv/ipc_test.go` | All playback commands against mock Unix socket, timeout handling, connection errors (Task 65) |
| ytmusicapi wrapper | `mood-engine/tests/test_ytmusic.py` | Search parsing from canned responses, auth failure handling (Task 66) |
| Integration | `integration_test.go` | Full pipeline with all components mocked — emotion→mood→search→play (Task 67) |

### What NOT to Test

- TUI rendering (hard to test, low ROI — verify manually)
- External API responses (mock ytmusicapi, don't hit real YouTube)
- mpv binary behavior (mock the socket, don't require mpv installed for tests)

### Running Tests

```bash
# All Go tests
go test ./...

# All Python tests
cd mood-engine && python -m pytest tests/ -v && cd ..

# Specific Go package
go test ./internal/mpv/...

# With race detection
go test -race ./...
```

### Test Fixtures

- Store mock webcam frames (JPEG) in `mood-engine/tests/fixtures/`
- Store canned YouTube Music API responses in `mood-engine/tests/fixtures/`
- Go mock socket tests should be self-contained (no external fixtures needed)

## Dependencies

### Go (go.mod)

Core dependencies — only add these:

```
github.com/charmbracelet/bubbletea    # TUI framework
github.com/charmbracelet/lipgloss     # TUI styling
github.com/charmbracelet/bubbles      # Pre-built TUI components
github.com/spf13/cobra                # CLI framework
github.com/pelletier/go-toml/v2       # TOML config parsing
github.com/mattn/go-sqlite3           # SQLite driver (analytics)
```

### Python (pyproject.toml)

```toml
[project]
dependencies = [
    "opencv-python-headless>=4.8",
    "deepface>=0.0.89",
    "numpy>=1.24",
    "Pillow>=10.0",
    "ytmusicapi>=1.3",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "ruff>=0.1",
]
```


## TUI Libraries

Use the Charm ecosystem:
- **Bubble Tea** — Main TUI framework. State machine + Elm-style Update/View.
- **Lip Gloss** — Styling (colors, borders, padding, alignment).
- **Bubbles** — Pre-built components where they fit (spinner, text input, table, viewport). Build custom widgets for domain-specific views (ASCII preview, emotion bars, sparkline).

## Code Quality

```bash
# Go
gofmt -w .
goimports -w .
golangci-lint run

# Python
ruff check .
ruff format .
```

Both linters should pass with zero warnings before committing.
