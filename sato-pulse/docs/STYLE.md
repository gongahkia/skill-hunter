# Code Style Guide

## Go

### Standard

Follow [Effective Go](https://go.dev/doc/effective_go) and [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments). Run `gofmt` and `goimports` on all files.

### Naming

- **Packages**: short, lowercase, single-word where possible. `ipc`, `mpv`, `queue`, `bridge`, `tui`, `config`.
- **Files**: `snake_case.go`. One primary type per file: `client.go` for `MpvClient`, `manager.go` for `QueueManager`.
- **Exported types**: `PascalCase`. `MpvClient`, `QueueManager`, `MoodState`.
- **Unexported**: `camelCase`. Short names in tight scopes (`r` for reader, `msg` for message, `tr` for track).
- **Interfaces**: verb or `-er` suffix. `Detector`, `Player`. No `I` prefix.
- **Constants**: `PascalCase` for exported, `camelCase` for unexported. Use `iota` for enums.

### Error Handling

Use `fmt.Errorf` with `%w` for wrapping. Define custom error types for component boundaries:

```go
// internal/ipc/errors.go
type SubprocessError struct {
    Cause   error
    Retries int
}

func (e *SubprocessError) Error() string {
    return fmt.Sprintf("subprocess failed after %d retries: %v", e.Retries, e.Cause)
}

func (e *SubprocessError) Unwrap() error { return e.Cause }

// internal/mpv/errors.go
var (
    ErrNotConnected = errors.New("mpv: not connected")
    ErrTimeout      = errors.New("mpv: ipc timeout")
)

// Usage
func (c *MpvClient) Play(url string) error {
    if !c.IsRunning() {
        return ErrNotConnected
    }
    if err := c.send(playCmd(url)); err != nil {
        return fmt.Errorf("mpv play %q: %w", url, err)
    }
    return nil
}
```

Custom error types per component:
- `internal/ipc`: `SubprocessError`, `ProtocolError`
- `internal/mpv`: `ErrNotConnected`, `ErrTimeout`, `ErrMpvNotFound`
- `internal/queue`: `ErrQueueEmpty`

### No Naked Returns

Always name what you're returning explicitly. Never use bare `return` in functions with named return values.

### Struct Initialization

Use named fields. Never rely on positional initialization:

```go
// Good
track := Track{
    VideoID:  "abc123",
    Title:    "Chill Vibes",
    Artist:   "Lo-Fi Artist",
    Duration: 180,
}

// Bad
track := Track{"abc123", "Chill Vibes", "Lo-Fi Artist", "", 180, ""}
```

### Logging (Go)

Use `log/slog` with a JSON handler. Log level controlled by `--log-level` flag.

```go
import "log/slog"

// Setup in main
handler := slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
    Level: logLevel, // from --log-level flag
})
slog.SetDefault(slog.New(handler))

// Usage
slog.Info("mood changed", "from", prev, "to", current, "confidence", conf)
slog.Error("mpv ipc failed", "err", err, "command", cmd)
```

All log output goes to **stderr**. stdout is never used for logging.

---

## Python

### Standard

Use [Ruff](https://docs.astral.sh/ruff/) with default rules. This covers the equivalent of flake8, isort, and pyupgrade.

```toml
# pyproject.toml
[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "B", "SIM"]
```

### Naming

- **Modules**: `snake_case.py`. `capture.py`, `detection.py`, `music_client.py`.
- **Classes**: `PascalCase`. `YTMusicClient`, `EmotionSmoother`, `MoodClassifier`.
- **Functions/methods**: `snake_case`. `detect_face()`, `search_tracks()`, `get_playback_url()`.
- **Constants**: `UPPER_SNAKE_CASE`. `MOOD_FOCUS`, `DEFAULT_SMOOTHING_WINDOW`.
- **Private**: single underscore prefix. `_parse_response()`, `_buffer`.

### Type Hints

Type hints required on all public function signatures. Internal helpers can omit them if the types are obvious from context.

```python
from dataclasses import dataclass

@dataclass
class Track:
    video_id: str
    title: str
    artist: str
    album: str
    duration_seconds: int
    thumbnail_url: str

def search_tracks(query: str, limit: int = 20) -> list[Track]:
    """Search YouTube Music for tracks matching the query."""
    ...
```

### Dataclasses Over Dicts

Use `@dataclass` for any structured data passed between components. Never pass raw dicts across module boundaries.

Core data structures:
- `Track` — video_id, title, artist, album, duration_seconds, thumbnail_url
- `EmotionResult` — emotion_label, confidence, all_scores (dict[str, float])
- `MoodState` — enum: FOCUS, STRESSED, RELAXED, TIRED, ENERGIZED

### Docstrings

Google-style docstrings on public API only. No docstrings on private methods or obvious functions.

```python
def classify_mood(scores: dict[str, float], thresholds: MoodThresholds) -> MoodState:
    """Classify smoothed emotion scores into a mood state.

    Args:
        scores: Weighted average emotion probabilities (7 emotions).
        thresholds: Configurable thresholds for each mood state.

    Returns:
        The classified MoodState with highest confidence.
    """
```

### Error Handling (Python)

Custom exception hierarchy rooted in a base class:

```python
# mood_engine/exceptions.py

class MoodEngineError(Exception):
    """Base exception for mood-engine."""

class CaptureError(MoodEngineError):
    """Camera capture failed."""

class DetectionError(MoodEngineError):
    """Face detection or emotion analysis failed."""

class SearchError(MoodEngineError):
    """YouTube Music search failed."""

class AuthError(SearchError):
    """YouTube Music authentication expired or invalid."""

class IPCError(MoodEngineError):
    """IPC protocol violation or communication error."""
```

Always include component context in error messages:

```python
raise CaptureError(f"camera {camera_index}: failed to open device: {e}") from e
```

### Logging (Python)

Use `logging` stdlib with JSON formatter. All output to stderr.

```python
import logging
import json
import sys

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "time": self.formatTime(record),
            "level": record.levelname,
            "msg": record.getMessage(),
            "module": record.module,
        })

handler = logging.StreamHandler(sys.stderr)
handler.setFormatter(JSONFormatter())
logger = logging.getLogger("mood_engine")
logger.addHandler(handler)
```

**Critical**: stdout is reserved exclusively for IPC JSON messages. Never print to stdout for debugging.

---

## General Conventions

### File Length

- Aim for < 300 lines per file. Split when a file handles multiple concerns.
- Exception: the Bubble Tea main model may be longer due to the Update/View pattern.

### Comments

- No comments that restate the code. Only explain *why*, not *what*.
- Use `// TODO(task-N):` to reference todo.txt task numbers for deferred work.

### Dependencies

Only add dependencies that are explicitly needed:
- **Go**: Bubble Tea, Lip Gloss, Bubbles, Cobra, go-toml, go-sqlite3
- **Python**: opencv-python-headless, deepface, numpy, Pillow, ytmusicapi

Do not add utility libraries (lodash-equivalents, helper frameworks) unless there is a specific justification.
