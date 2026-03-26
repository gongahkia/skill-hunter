from __future__ import annotations

import base64
import logging
import platform
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from mood_engine.exceptions import CaptureError

logger = logging.getLogger("mood_engine.capture")

if TYPE_CHECKING:
    import numpy as np

RESOLUTIONS = {
    "low": (320, 240),
    "medium": (640, 480),
    "high": (1280, 720),
}


@dataclass
class CaptureResult:
    frame: Any
    base64_jpeg: str
    resolution: tuple[int, int]
    backend: str


def _get_backend() -> tuple[int, str]:
    import cv2

    system = platform.system()
    if system == "Darwin":
        return cv2.CAP_AVFOUNDATION, "AVFoundation"
    elif system == "Linux":
        return cv2.CAP_V4L2, "V4L2"
    return cv2.CAP_ANY, "auto"


def _auto_detect_camera_index() -> int:
    """Try camera indices 0-4 to find an available camera."""
    system = platform.system()
    if system == "Linux":
        import glob

        devices = sorted(glob.glob("/dev/video*"))
        if devices:
            try:
                idx = int(devices[0].replace("/dev/video", ""))
                return idx
            except ValueError:
                pass
    return 0


def capture_frame(
    camera_index: int = -1,
    resolution: str = "medium",
) -> CaptureResult:
    """Capture a single frame from webcam and return as base64 JPEG.

    Args:
        camera_index: Camera device index. -1 for auto-detect.
        resolution: One of "low", "medium", "high".

    Returns:
        CaptureResult with frame data and metadata.

    Raises:
        CaptureError: If camera cannot be opened or frame cannot be read.
    """
    if camera_index < 0:
        camera_index = _auto_detect_camera_index()

    import cv2

    backend_id, backend_name = _get_backend()
    width, height = RESOLUTIONS.get(resolution, RESOLUTIONS["medium"])

    cap = cv2.VideoCapture(camera_index, backend_id)
    if not cap.isOpened():
        raise CaptureError(
            f"camera {camera_index}: failed to open device "
            f"(backend={backend_name})"
        )

    try:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

        ret, frame = cap.read()
        if not ret or frame is None:
            raise CaptureError(
                f"camera {camera_index}: failed to read frame"
            )

        actual_h, actual_w = frame.shape[:2]
        _, jpeg_buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        b64 = base64.b64encode(jpeg_buf.tobytes()).decode("ascii")

        return CaptureResult(
            frame=frame,
            base64_jpeg=b64,
            resolution=(actual_w, actual_h),
            backend=backend_name,
        )
    finally:
        cap.release()


def check_camera(camera_index: int = -1) -> dict:
    """Health check: verify camera is functional.

    Returns dict with camera info or error.
    """
    if camera_index < 0:
        camera_index = _auto_detect_camera_index()

    import cv2

    backend_id, backend_name = _get_backend()

    cap = cv2.VideoCapture(camera_index, backend_id)
    if not cap.isOpened():
        return {
            "available": False,
            "error": f"camera {camera_index}: device not found",
            "backend": backend_name,
        }

    try:
        ret, frame = cap.read()
        if not ret or frame is None:
            return {
                "available": False,
                "error": f"camera {camera_index}: cannot read frame",
                "backend": backend_name,
            }

        h, w = frame.shape[:2]
        fps = cap.get(cv2.CAP_PROP_FPS) or 30

        return {
            "available": True,
            "resolution": [w, h],
            "fps": int(fps),
            "backend": backend_name,
        }
    finally:
        cap.release()
