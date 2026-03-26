"""Tests for runtime config plumbing in the Python mood engine."""

from dataclasses import dataclass
from unittest.mock import patch

from mood_engine import __main__ as engine_main
from mood_engine.detection import EMOTION_KEYS, EmotionResult
from mood_engine.smoother import EmotionSmoother


def test_update_runtime_config_switches_backend_and_window():
    engine_main._runtime_config = engine_main.RuntimeConfig()
    engine_main._backend = object()

    with patch("mood_engine.__main__.create_backend", return_value="backend") as create_backend:
        config = engine_main.update_runtime_config({
            "config": {
                "camera_index": 2,
                "resolution": "high",
                "model_backend": "deepface_opencv",
                "smoothing_window": 7,
                "confidence_threshold": 0.9,
            }
        })

    assert config.camera_index == 2
    assert config.resolution == "high"
    assert config.model_backend == "deepface_opencv"
    assert config.smoothing_window == 7
    assert config.confidence_threshold == 0.9
    assert engine_main._backend == "backend"
    assert engine_main._smoother._window_size == 7
    create_backend.assert_called_once_with("deepface_opencv")


def test_handle_capture_request_uses_runtime_config():
    scores = {k: 0.0 for k in EMOTION_KEYS}
    scores["happy"] = 0.7
    scores["neutral"] = 0.3

    class FakeIPC:
        def __init__(self):
            self.messages = []

        def send(self, msg):
            self.messages.append(msg)

        def send_error(self, request_id, error_type, message):
            raise AssertionError(f"unexpected error {request_id} {error_type} {message}")

    fake_ipc = FakeIPC()
    engine_main._runtime_config = engine_main.RuntimeConfig()
    engine_main._backend = object()

    with patch("mood_engine.__main__.capture_frame") as capture_frame, patch(
        "mood_engine.__main__.detect_and_analyze",
        return_value=EmotionResult(
            emotion_label="happy",
            confidence=0.7,
            all_scores=scores,
            face_detected=True,
        ),
    ), patch("mood_engine.__main__._smoother.add") as smoother_add, patch(
        "mood_engine.__main__._classifier.classify"
    ) as classify:
        capture_frame.return_value = type(
            "CaptureResult",
            (),
            {"frame": "frame", "base64_jpeg": "encoded"},
        )()
        smoother_add.return_value = type(
            "SmoothedResult",
            (),
            {"scores": scores},
        )()
        classify.return_value = type(
            "Classification",
            (),
            {
                "mood": type("Mood", (), {"value": "RELAXED"})(),
                "confidence": 0.88,
                "mood_changed": True,
                "previous_mood": None,
            },
        )()

        engine_main.handle_capture_request(
            {
                "id": "capture-1",
                "config": {
                    "camera_index": 3,
                    "resolution": "low",
                    "model_backend": "deepface_mobilenet",
                    "smoothing_window": 5,
                    "confidence_threshold": 0.6,
                },
            },
            fake_ipc,
        )

    capture_frame.assert_called_once_with(camera_index=3, resolution="low")
    assert fake_ipc.messages[0]["type"] == "emotion_result"
    assert fake_ipc.messages[0]["mood"] == "RELAXED"


def test_handle_capture_request_suppresses_low_confidence_moods():
    scores = {k: 0.0 for k in EMOTION_KEYS}
    scores["angry"] = 0.3
    scores["fear"] = 0.2
    scores["neutral"] = 0.5

    class FakeIPC:
        def __init__(self):
            self.messages = []

        def send(self, msg):
            self.messages.append(msg)

        def send_error(self, request_id, error_type, message):
            raise AssertionError(f"unexpected error {request_id} {error_type} {message}")

    fake_ipc = FakeIPC()
    engine_main._runtime_config = engine_main.RuntimeConfig()
    engine_main._backend = object()
    engine_main._smoother = EmotionSmoother(window_size=5)
    engine_main._classifier.reset()

    with patch("mood_engine.__main__.capture_frame") as capture_frame, patch(
        "mood_engine.__main__.detect_and_analyze",
        return_value=EmotionResult(
            emotion_label="angry",
            confidence=0.5,
            all_scores=scores,
            face_detected=True,
        ),
    ):
        capture_frame.return_value = type(
            "CaptureResult",
            (),
            {"frame": "frame", "base64_jpeg": "encoded"},
        )()

        engine_main.handle_capture_request(
            {
                "id": "capture-2",
                "config": {
                    "camera_index": 0,
                    "resolution": "medium",
                    "model_backend": "deepface_mobilenet",
                    "smoothing_window": 5,
                    "confidence_threshold": 0.8,
                },
            },
            fake_ipc,
        )

    assert fake_ipc.messages[0]["type"] == "emotion_result"
    assert fake_ipc.messages[0]["mood"] is None
    assert fake_ipc.messages[0]["mood_changed"] is False


def test_detect_and_analyze_uses_cropped_face():
    captured = {}

    @dataclass
    class FakeFrame:
        shape: tuple[int, int, int]

    class FakeBackend:
        def detect(self, frame):
            captured["shape"] = frame.shape
            scores = {k: 0.0 for k in EMOTION_KEYS}
            scores["neutral"] = 1.0
            return EmotionResult(
                emotion_label="neutral",
                confidence=1.0,
                all_scores=scores,
            )

    frame = FakeFrame((10, 10, 3))
    face = FakeFrame((4, 5, 3))

    with patch("mood_engine.detection.detect_face", return_value=(face, (3, 2, 5, 4))):
        result = engine_main.detect_and_analyze(frame, backend=FakeBackend())

    assert captured["shape"] == face.shape
    assert result.face_region == (3, 2, 5, 4)
