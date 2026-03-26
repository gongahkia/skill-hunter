# IPC Protocol — Go ↔ Python

## Transport

- **Medium**: JSON-over-stdin/stdout
- **Framing**: One JSON object per line (newline-delimited JSON / NDJSON)
- **Direction**: Bidirectional. Go writes to Python's stdin, reads from Python's stdout.
- **Encoding**: UTF-8
- **Logging**: Both sides log to stderr only. stdout is exclusively for IPC.

## Message Envelope

Every message includes a `version` and `type` field:

```json
{
  "version": 1,
  "type": "<message_type>",
  "id": "<unique_request_id>",
  ...payload fields
}
```

- `version` — Protocol version. Both sides validate on first message. If mismatch, log error and exit.
- `type` — One of the defined message types below.
- `id` — UUID string. Responses echo the request's `id` for correlation.

## Startup Handshake

On subprocess start, Go sends a `health_check` request. Python responds with its capabilities and version. If the response `version` field doesn't match, Go logs an error and terminates the subprocess.

```
Go ──health_check──► Python
Go ◄──health_result── Python
```

## Message Types

### `health_check` (Go → Python)

Request system health status.

```json
{
  "version": 1,
  "type": "health_check",
  "id": "a1b2c3d4"
}
```

### `health_result` (Python → Go)

```json
{
  "version": 1,
  "type": "health_result",
  "id": "a1b2c3d4",
  "status": "ok",
  "camera": {
    "available": true,
    "resolution": [640, 480],
    "fps": 30,
    "backend": "V4L2"
  },
  "ytmusic": {
    "authenticated": true
  },
  "emotion_backend": "deepface_mobilenet"
}
```

### `capture_request` (Go → Python)

Request a webcam capture + emotion analysis cycle.

```json
{
  "version": 1,
  "type": "capture_request",
  "id": "e5f6g7h8"
}
```

### `emotion_result` (Python → Go)

Result of emotion analysis.

```json
{
  "version": 1,
  "type": "emotion_result",
  "id": "e5f6g7h8",
  "face_detected": true,
  "emotions": {
    "angry": 0.02,
    "disgust": 0.01,
    "fear": 0.03,
    "happy": 0.35,
    "sad": 0.05,
    "surprise": 0.04,
    "neutral": 0.50
  },
  "mood": "FOCUS",
  "mood_confidence": 0.82,
  "mood_changed": true,
  "previous_mood": "RELAXED",
  "frame_base64": "<base64-encoded JPEG for ASCII preview>"
}
```

When no face is detected:

```json
{
  "version": 1,
  "type": "emotion_result",
  "id": "e5f6g7h8",
  "face_detected": false,
  "emotions": null,
  "mood": null,
  "mood_confidence": 0.0,
  "mood_changed": false,
  "previous_mood": "FOCUS",
  "frame_base64": "<base64-encoded JPEG>"
}
```

### `search_request` (Go → Python)

Request YouTube Music track search.

```json
{
  "version": 1,
  "type": "search_request",
  "id": "i9j0k1l2",
  "query": "lo-fi beats study",
  "limit": 10
}
```

### `search_result` (Python → Go)

```json
{
  "version": 1,
  "type": "search_result",
  "id": "i9j0k1l2",
  "tracks": [
    {
      "video_id": "jfKfPfyJRdk",
      "title": "lofi hip hop radio",
      "artist": "Lofi Girl",
      "album": "",
      "duration_seconds": 0,
      "thumbnail_url": "https://lh3.googleusercontent.com/...",
      "playback_url": "https://music.youtube.com/watch?v=jfKfPfyJRdk"
    }
  ]
}
```

### `shutdown` (Go → Python)

Graceful shutdown request. Python should flush state and exit.

```json
{
  "version": 1,
  "type": "shutdown",
  "id": "m3n4o5p6"
}
```

Python responds with acknowledgment then exits:

```json
{
  "version": 1,
  "type": "shutdown_ack",
  "id": "m3n4o5p6"
}
```

### `error` (Python → Go)

Sent when Python encounters an error processing a request.

```json
{
  "version": 1,
  "type": "error",
  "id": "e5f6g7h8",
  "error_type": "capture_error",
  "message": "camera 0: device not found"
}
```

Error types: `capture_error`, `detection_error`, `search_error`, `auth_error`, `internal_error`.

## Data Structures

### Track

| Field | Type | Description |
|-------|------|-------------|
| `video_id` | string | YouTube video ID |
| `title` | string | Track title |
| `artist` | string | Artist name |
| `album` | string | Album name (may be empty) |
| `duration_seconds` | int | Track duration in seconds (0 if unknown) |
| `thumbnail_url` | string | URL to album art thumbnail |
| `playback_url` | string | Full YouTube Music URL for mpv |

### MoodState

Enum string, one of: `"FOCUS"`, `"STRESSED"`, `"RELAXED"`, `"TIRED"`, `"ENERGIZED"`.

### Emotion Keys

Always exactly these 7 keys: `angry`, `disgust`, `fear`, `happy`, `sad`, `surprise`, `neutral`. Values are floats 0.0–1.0 summing to ~1.0.

## Timeouts

- Go waits **5 seconds** for a response to any request. If no response, log a warning and retry once.
- If the retry also times out, mark the subprocess as unhealthy and trigger crash recovery.
- Python should process `capture_request` in < 3 seconds (typical: ~500ms for capture + emotion detection).
- `search_request` may take up to 5 seconds due to network latency.

## Subprocess Lifecycle

1. Go spawns Python: `python -m mood_engine`
2. Go sends `health_check`
3. Python responds with `health_result`
4. Normal operation: Go sends `capture_request` on timer, `search_request` on mood change
5. On shutdown: Go sends `shutdown`, waits for `shutdown_ack` (2s timeout), then SIGTERM, then SIGKILL after 5s
6. On crash: Go detects EOF on stdout, restarts with exponential backoff (1s, 2s, 4s), max 3 retries
