from __future__ import annotations

import json
import secrets
from copy import deepcopy
from datetime import datetime, timedelta, timezone


ROOM_TOKEN_BYTES = 8


def utc_now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class RoomStore:
    def __init__(self, *, cachelib=None, redis_client=None, ttl_seconds=7 * 24 * 60 * 60):
        self.cachelib = cachelib
        self.redis_client = redis_client
        self.ttl_seconds = ttl_seconds

    def _key(self, token):
        return f"sato:room:{token}"

    def _generate_token(self):
        while True:
            token = secrets.token_urlsafe(ROOM_TOKEN_BYTES)
            if not self.get_room(token):
                return token

    def get_room(self, token):
        if not token:
            return None

        key = self._key(token)
        if self.redis_client is not None:
            raw_value = self.redis_client.get(key)
            if raw_value is None:
                return None
            return json.loads(raw_value)

        if self.cachelib is None:
            return None

        room = self.cachelib.get(key)
        return deepcopy(room) if room else None

    def save_room(self, room):
        token = room["token"]
        key = self._key(token)
        room_copy = deepcopy(room)

        if self.redis_client is not None:
            self.redis_client.setex(key, self.ttl_seconds, json.dumps(room_copy))
            return room_copy

        if self.cachelib is not None:
            self.cachelib.set(key, room_copy, timeout=self.ttl_seconds)

        return room_copy

    def delete_room(self, token):
        key = self._key(token)
        if self.redis_client is not None:
            self.redis_client.delete(key)
            return

        if self.cachelib is not None:
            self.cachelib.delete(key)

    def clear(self):
        if self.redis_client is not None:
            for key in self.redis_client.scan_iter(match=self._key("*")):
                self.redis_client.delete(key)
            return

        if self.cachelib is not None:
            self.cachelib.clear()

    def create_room(self, *, host_user_id, playlist_name):
        token = self._generate_token()
        timestamp = utc_now_iso()
        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=self.ttl_seconds)
        ).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        room = {
            "token": token,
            "host_user_id": host_user_id,
            "playlist_name": playlist_name,
            "created_at": timestamp,
            "updated_at": timestamp,
            "expires_at": expires_at,
            "members": [],
            "contributions": {},
            "weights": {},
            "final_playlist": None,
            "wrapped": None,
        }
        return self.save_room(room)
