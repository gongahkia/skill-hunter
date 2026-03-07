from __future__ import annotations

import re
import time
from urllib.parse import urlencode

import requests


class SpotifyAPIError(Exception):
    def __init__(self, message, status_code=502, payload=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload or {}


def _safe_json(response):
    try:
        return response.json()
    except ValueError:
        return {}


class SpotifyClient:
    API_BASE = "https://api.spotify.com/v1"
    AUTH_URL = "https://accounts.spotify.com/authorize"
    TOKEN_URL = "https://accounts.spotify.com/api/token"
    USER_ID_PATTERN = re.compile(r"(?:spotify\.com/user/|spotify:user:)([^/?#:]+)")
    RAW_USER_ID_PATTERN = re.compile(r"^[A-Za-z0-9_]+$")

    def __init__(
        self,
        client_id,
        client_secret,
        redirect_uri,
        access_token=None,
        refresh_token=None,
        expires_at=None,
        token_updater=None,
        timeout=15,
        http_session=None,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_at = expires_at
        self.token_updater = token_updater
        self.timeout = timeout
        self.http_session = http_session or requests.Session()

    @classmethod
    def extract_user_id(cls, raw_value):
        if not raw_value:
            return None

        raw_value = str(raw_value).strip()
        if not raw_value:
            return None

        pattern_match = cls.USER_ID_PATTERN.search(raw_value)
        if pattern_match:
            return pattern_match.group(1)

        if cls.RAW_USER_ID_PATTERN.fullmatch(raw_value):
            return raw_value

        return None

    def authorization_url(self, state):
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(
                [
                    "user-read-private",
                    "user-read-email",
                    "user-top-read",
                    "playlist-modify-public",
                    "playlist-modify-private",
                ]
            ),
            "show_dialog": "true",
            "state": state,
        }
        return f"{self.AUTH_URL}?{urlencode(params)}"

    def exchange_code(self, code):
        token_payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }
        return self._request_token(token_payload)

    def refresh_access_token(self):
        if not self.refresh_token:
            raise SpotifyAPIError(
                "Spotify login has expired. Sign in again.",
                status_code=401,
            )

        token_payload = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }
        return self._request_token(token_payload)

    def _request_token(self, token_payload):
        response = self.http_session.post(
            self.TOKEN_URL,
            data=token_payload,
            timeout=self.timeout,
        )
        if response.status_code != 200:
            raise SpotifyAPIError(
                "Spotify token exchange failed.",
                status_code=response.status_code,
                payload=_safe_json(response),
            )

        payload = response.json()
        self.access_token = payload.get("access_token")
        self.refresh_token = payload.get("refresh_token", self.refresh_token)
        self.expires_at = time.time() + payload.get("expires_in", 3600) - 60
        payload["refresh_token"] = self.refresh_token
        payload["expires_at"] = self.expires_at

        if self.token_updater:
            self.token_updater(payload)

        return payload

    def _ensure_access_token(self):
        if self.expires_at and self.expires_at <= time.time():
            self.refresh_access_token()

        if not self.access_token and self.refresh_token:
            self.refresh_access_token()

        if not self.access_token:
            raise SpotifyAPIError(
                "Spotify login has expired. Sign in again.",
                status_code=401,
            )

    def _request(self, method, path, *, retry_on_unauthorized=True, **kwargs):
        self._ensure_access_token()
        url = path if path.startswith("http") else f"{self.API_BASE}{path}"
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self.access_token}"

        response = self.http_session.request(
            method,
            url,
            headers=headers,
            timeout=self.timeout,
            **kwargs,
        )

        if response.status_code == 401 and retry_on_unauthorized and self.refresh_token:
            self.refresh_access_token()
            return self._request(
                method,
                path,
                retry_on_unauthorized=False,
                **kwargs,
            )

        if response.status_code >= 400:
            raise SpotifyAPIError(
                "Spotify request failed.",
                status_code=response.status_code,
                payload=_safe_json(response),
            )

        if response.status_code == 204 or not response.content:
            return None

        return response.json()

    def _paginate(self, path):
        items = []
        next_path = path
        while next_path:
            payload = self._request("GET", next_path)
            items.extend(payload.get("items", []))
            next_path = payload.get("next")
        return items

    def get_current_user(self):
        return self._request("GET", "/me")

    def get_current_user_top_tracks(self, limit=50):
        return self._request("GET", f"/me/top/tracks?limit={limit}").get("items", [])

    def get_user(self, user_id):
        return self._request("GET", f"/users/{user_id}")

    def get_user_playlists(self, user_id):
        return self._paginate(f"/users/{user_id}/playlists?limit=50")

    def get_playlist_tracks(self, playlist_id):
        return self._paginate(f"/playlists/{playlist_id}/tracks?limit=100")

    def create_playlist(self, user_id, name, description, is_public=False):
        return self._request(
            "POST",
            f"/users/{user_id}/playlists",
            json={
                "name": name,
                "public": is_public,
                "description": description,
            },
        )

    def add_tracks_to_playlist(self, playlist_id, track_uris):
        if not track_uris:
            return None

        return self._request(
            "POST",
            f"/playlists/{playlist_id}/tracks",
            json={"uris": track_uris},
        )
