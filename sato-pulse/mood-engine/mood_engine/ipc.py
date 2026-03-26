import json
import logging
import signal
import sys
from typing import Any

logger = logging.getLogger("mood_engine.ipc")

PROTOCOL_VERSION = 1


class IPCHandler:
    """Handles JSON-over-stdin/stdout IPC with the Go process."""

    def __init__(self) -> None:
        self._handlers: dict[str, Any] = {}
        self._running = False

    def register(self, msg_type: str, handler: Any) -> None:
        self._handlers[msg_type] = handler

    def send(self, msg: dict) -> None:
        msg.setdefault("version", PROTOCOL_VERSION)
        line = json.dumps(msg, separators=(",", ":"))
        sys.stdout.write(line + "\n")
        sys.stdout.flush()

    def send_error(self, request_id: str, error_type: str, message: str) -> None:
        self.send({
            "type": "error",
            "id": request_id,
            "error_type": error_type,
            "message": message,
        })

    def run(self) -> None:
        self._running = True
        signal.signal(signal.SIGTERM, self._handle_sigterm)

        for line in sys.stdin:
            if not self._running:
                break

            line = line.strip()
            if not line:
                continue

            try:
                msg = json.loads(line)
            except json.JSONDecodeError as e:
                logger.error("invalid json: %s", e)
                continue

            version = msg.get("version")
            if version != PROTOCOL_VERSION:
                logger.error("version mismatch: expected %d, got %s", PROTOCOL_VERSION, version)
                continue

            msg_type = msg.get("type", "")
            msg_id = msg.get("id", "")

            if msg_type == "shutdown":
                self.send({"type": "shutdown_ack", "id": msg_id})
                self._running = False
                break

            handler = self._handlers.get(msg_type)
            if handler is None:
                logger.warning("unknown message type: %s", msg_type)
                self.send_error(msg_id, "internal_error", f"unknown type: {msg_type}")
                continue

            try:
                handler(msg, self)
            except Exception as e:
                logger.exception("handler error for %s", msg_type)
                self.send_error(msg_id, "internal_error", str(e))

    def stop(self) -> None:
        self._running = False

    def _handle_sigterm(self, signum: int, frame: Any) -> None:
        logger.info("received SIGTERM, shutting down")
        self._running = False
