from __future__ import annotations

import json
import logging
from collections import deque
from datetime import datetime, timezone
from pathlib import Path


def utc_now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class DebugRecorder:
    def __init__(self, *, max_events=500, log_path=None):
        self.events = deque(maxlen=max_events)
        self.log_path = Path(log_path) if log_path else None
        if self.log_path is not None:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)

    def record(self, event):
        entry = {
            "timestamp": utc_now_iso(),
            **event,
        }
        self.events.append(entry)

        if self.log_path is not None:
            with self.log_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, sort_keys=True))
                handle.write("\n")

        return entry

    def list_events(self):
        return list(self.events)

    def clear(self):
        self.events.clear()
        if self.log_path is not None:
            self.log_path.write_text("", encoding="utf-8")


def configure_app_logger(app):
    logger = logging.getLogger("sato")
    logger.setLevel(logging.DEBUG if app.config.get("DEBUG_LOGGING_ENABLED") else logging.INFO)
    return logger
