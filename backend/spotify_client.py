from __future__ import annotations

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
    AUTH_SCOPES = [
        "user-read-private",
        "user-read-email",
        "user-top-read",
        "user-library-read",
        "user-read-recently-played",
        "playlist-read-private",
        "playlist-read-collaborative",
        "playlist-modify-private",
    ]

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

    def authorization_url(self, state):
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.AUTH_SCOPES),
            "show_dialog": "true",
            "state": state,
        }
        return f"{self.AUTH_URL}?{urlencode(params)}"

    def exchange_code(self, code):
        return self._request_token(
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.redirect_uri,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }
        )

    def refresh_access_token(self):
        if not self.refresh_token:
            raise SpotifyAPIError(
                "Spotify login has expired. Sign in again.",
                status_code=401,
            )

        return self._request_token(
            {
                "grant_type": "refresh_token",
                "refresh_token": self.refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }
        )

    def verify_client_credentials(self):
        response = self.http_session.post(
            self.TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
            timeout=self.timeout,
        )
        if response.status_code != 200:
            raise SpotifyAPIError(
                "Spotify rejected the supplied client credentials.",
                status_code=response.status_code,
                payload=_safe_json(response),
            )
        return response.json()

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

    def _paginate(self, path, *, item_limit=None):
        items = []
        next_path = path
        while next_path:
            payload = self._request("GET", next_path)
            page_items = payload.get("items", [])
            if item_limit is not None:
                remaining_items = item_limit - len(items)
                if remaining_items <= 0:
                    break
                items.extend(page_items[:remaining_items])
                if len(items) >= item_limit:
                    break
            else:
                items.extend(page_items)
            next_path = payload.get("next")
        return items

    def get_current_user(self):
        return self._request("GET", "/me")

    def get_current_user_top_tracks(self, limit=50):
        return self._request("GET", f"/me/top/tracks?limit={limit}").get("items", [])

    def get_saved_tracks(self, limit=500):
        return self._paginate("/me/tracks?limit=50", item_limit=limit)

    def get_saved_tracks_total(self, limit_cap=500):
        payload = self._request("GET", "/me/tracks?limit=1")
        return min(int(payload.get("total", 0)), limit_cap)

    def get_recently_played(self, limit=50):
        return self._request("GET", f"/me/player/recently-played?limit={limit}").get(
            "items", []
        )

    def get_current_user_playlists(self, limit=200):
        return self._paginate("/me/playlists?limit=50", item_limit=limit)

    def get_playlist_tracks(self, playlist_id, limit=500):
        return self._paginate(
            f"/playlists/{playlist_id}/tracks?limit=100",
            item_limit=limit,
        )

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

    def get_current_user_top_artists(self, limit=50):
        return self._request("GET", f"/me/top/artists?limit={limit}").get("items", [])

    def search_tracks(self, query, limit=20):
        from urllib.parse import quote
        return self._request("GET", f"/search?q={quote(query)}&type=track&limit={limit}").get(
            "tracks", {}
        ).get("items", [])

    def get_recommendations(self, seed_tracks=None, seed_artists=None, seed_genres=None, **audio_features):
        params = {}
        if seed_tracks:
            params["seed_tracks"] = ",".join(seed_tracks[:5])
        if seed_artists:
            params["seed_artists"] = ",".join(seed_artists[:5])
        if seed_genres:
            params["seed_genres"] = ",".join(seed_genres[:5])
        for key, val in audio_features.items():
            params[key] = val
        qs = urlencode(params)
        return self._request("GET", f"/recommendations?{qs}").get("tracks", [])

    def get_audio_features(self, track_ids):
        if not track_ids:
            return []
        features = []
        for start in range(0, len(track_ids), 100):
            batch = track_ids[start:start + 100]
            result = self._request("GET", f"/audio-features?ids={','.join(batch)}")
            features.extend(result.get("audio_features", []))
        return features

    def add_tracks_to_playlist(self, playlist_id, track_uris):
        if not track_uris:
            return None

        for start in range(0, len(track_uris), 100):
            self._request(
                "POST",
                f"/playlists/{playlist_id}/tracks",
                json={"uris": track_uris[start : start + 100]},
            )

        return {"snapshot_id": "snapshot"}
