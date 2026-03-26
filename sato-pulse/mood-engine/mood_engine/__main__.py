from __future__ import annotations

"""Entry point for mood-engine subprocess: python -m mood_engine"""

import json
import logging
import sys
from dataclasses import dataclass

from mood_engine.backends import create_backend
from mood_engine.capture import capture_frame, check_camera
from mood_engine.classifier import MoodClassifier
from mood_engine.detection import detect_and_analyze
from mood_engine.exceptions import CaptureError, DetectionError, SearchError, AuthError
from mood_engine.ipc import IPCHandler
from mood_engine.music_client import YTMusicClient
from mood_engine.smoother import EmotionSmoother
from mood_engine.spotify_handler import (
    handle_spotify_search,
    handle_spotify_play,
    handle_spotify_pause,
    handle_spotify_resume,
    handle_spotify_state,
)

logger = logging.getLogger("mood_engine")

@dataclass
class RuntimeConfig:
    camera_index: int = -1
    resolution: str = "medium"
    model_backend: str = "deepface_mobilenet"
    smoothing_window: int = 5
    confidence_threshold: float = 0.6


_runtime_config = RuntimeConfig()
_backend = create_backend(_runtime_config.model_backend)
_smoother = EmotionSmoother(window_size=_runtime_config.smoothing_window)
_classifier = MoodClassifier()
_music_client = YTMusicClient()


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "time": self.formatTime(record),
            "level": record.levelname,
            "msg": record.getMessage(),
            "module": record.module,
        })


def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(JSONFormatter())
    root = logging.getLogger("mood_engine")
    root.addHandler(handler)
    root.setLevel(logging.DEBUG)


def update_runtime_config(msg: dict) -> RuntimeConfig:
    global _backend, _runtime_config, _smoother

    raw = msg.get("config") or {}
    config = RuntimeConfig(
        camera_index=int(raw.get("camera_index", _runtime_config.camera_index)),
        resolution=str(raw.get("resolution", _runtime_config.resolution)),
        model_backend=str(raw.get("model_backend", _runtime_config.model_backend)),
        smoothing_window=int(raw.get("smoothing_window", _runtime_config.smoothing_window)),
        confidence_threshold=float(
            raw.get("confidence_threshold", _runtime_config.confidence_threshold)
        ),
    )

    if config.model_backend != _runtime_config.model_backend:
        _backend = create_backend(config.model_backend)
    if config.smoothing_window != _runtime_config.smoothing_window:
        _smoother = EmotionSmoother(window_size=config.smoothing_window)

    _runtime_config = config
    return config


def handle_health_check(msg: dict, ipc: IPCHandler) -> None:
    config = update_runtime_config(msg)
    camera_info = check_camera(config.camera_index)
    ytmusic_auth = _music_client.is_authenticated()

    ipc.send({
        "type": "health_result",
        "id": msg["id"],
        "status": "ok",
        "camera": camera_info,
        "ytmusic": {"authenticated": ytmusic_auth},
        "emotion_backend": config.model_backend,
    })


def handle_capture_request(msg: dict, ipc: IPCHandler) -> None:
    config = update_runtime_config(msg)

    try:
        result = capture_frame(
            camera_index=config.camera_index,
            resolution=config.resolution,
        )
    except CaptureError as e:
        logger.error("capture failed: %s", e)
        ipc.send_error(msg["id"], "capture_error", str(e))
        return

    try:
        emotion = detect_and_analyze(result.frame, backend=_backend)
    except DetectionError as e:
        logger.error("detection failed: %s", e)
        ipc.send_error(msg["id"], "detection_error", str(e))
        return

    if not emotion.face_detected:
        ipc.send({
            "type": "emotion_result",
            "id": msg["id"],
            "face_detected": False,
            "emotions": None,
            "mood": None,
            "mood_confidence": 0.0,
            "mood_changed": False,
            "previous_mood": _classifier.current_mood.value if _classifier.current_mood else None,
            "frame_base64": result.base64_jpeg,
        })
        return

    smoothed = _smoother.add(emotion)
    classification = _classifier.classify(
        smoothed.scores,
        confidence_threshold=config.confidence_threshold,
    )

    ipc.send({
        "type": "emotion_result",
        "id": msg["id"],
        "face_detected": True,
        "emotions": smoothed.scores,
        "mood": classification.mood.value if classification.mood else None,
        "mood_confidence": classification.confidence,
        "mood_changed": classification.mood_changed,
        "previous_mood": classification.previous_mood.value if classification.previous_mood else None,
        "frame_base64": result.base64_jpeg,
    })


def handle_search_request(msg: dict, ipc: IPCHandler) -> None:
    query = msg.get("query", "")
    limit = msg.get("limit", 20)

    if not query:
        ipc.send_error(msg["id"], "search_error", "empty search query")
        return

    try:
        tracks = _music_client.search_tracks(query, limit=limit)
    except (SearchError, AuthError) as e:
        logger.error("search failed: %s", e)
        ipc.send_error(msg["id"], "search_error" if isinstance(e, SearchError) else "auth_error", str(e))
        return

    ipc.send({
        "type": "search_result",
        "id": msg["id"],
        "tracks": [
            {
                "video_id": t.video_id,
                "title": t.title,
                "artist": t.artist,
                "album": t.album,
                "duration_seconds": t.duration_seconds,
                "thumbnail_url": t.thumbnail_url,
                "playback_url": t.playback_url,
            }
            for t in tracks
        ],
    })


def main() -> None:
    setup_logging()
    logger.info("mood-engine starting")

    def _spotify_ipc(fn):
        def wrapper(msg, ipc_h):
            ipc_h.send(fn(msg))
        return wrapper

    handler = IPCHandler()
    handler.register("health_check", handle_health_check)
    handler.register("capture_request", handle_capture_request)
    handler.register("search_request", handle_search_request)
    handler.register("spotify_search_request", _spotify_ipc(handle_spotify_search))
    handler.register("spotify_play_request", _spotify_ipc(handle_spotify_play))
    handler.register("spotify_pause_request", _spotify_ipc(handle_spotify_pause))
    handler.register("spotify_resume_request", _spotify_ipc(handle_spotify_resume))
    handler.register("spotify_state_request", _spotify_ipc(handle_spotify_state))
    handler.run()

    logger.info("mood-engine shutting down")


if __name__ == "__main__":
    main()
