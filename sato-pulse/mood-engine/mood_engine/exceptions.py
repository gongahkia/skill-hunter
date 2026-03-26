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
