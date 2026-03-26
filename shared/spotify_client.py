"""Lightweight Spotify client with PKCE auth for desktop (sato-pulse) context."""
from __future__ import annotations
import base64
import hashlib
import json
import os
import secrets
import time
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlencode, urlparse, parse_qs
import requests

TOKEN_PATH = Path("~/.config/sato-pulse/spotify_tokens.json").expanduser()
SCOPES = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "user-top-read",
    "user-library-read",
]
AUTH_URL = "https://accounts.spotify.com/authorize"
TOKEN_URL = "https://accounts.spotify.com/api/token"
API_BASE = "https://api.spotify.com/v1"
REDIRECT_PORT = 8793
REDIRECT_URI = f"http://127.0.0.1:{REDIRECT_PORT}/callback"

def _generate_pkce():
    verifier = secrets.token_urlsafe(64)[:128]
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge

class SpotifyDesktopClient:
    def __init__(self, client_id, token_path=None):
        self.client_id = client_id
        self.token_path = Path(token_path) if token_path else TOKEN_PATH
        self._tokens = self._load_tokens()
        self._session = requests.Session()

    def _load_tokens(self):
        if self.token_path.exists():
            return json.loads(self.token_path.read_text())
        return {}

    def _save_tokens(self, tokens):
        self._tokens = tokens
        self.token_path.parent.mkdir(parents=True, exist_ok=True)
        self.token_path.write_text(json.dumps(tokens, indent=2))

    @property
    def authenticated(self):
        return bool(self._tokens.get("access_token"))

    def authorize(self):
        """Open browser for PKCE auth flow, listen for callback."""
        verifier, challenge = _generate_pkce()
        state = secrets.token_urlsafe(16)
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": REDIRECT_URI,
            "scope": " ".join(SCOPES),
            "state": state,
            "code_challenge_method": "S256",
            "code_challenge": challenge,
        }
        url = f"{AUTH_URL}?{urlencode(params)}"
        webbrowser.open(url)
        code = self._wait_for_callback(state)
        self._exchange_code(code, verifier)

    def _wait_for_callback(self, expected_state):
        result = {}
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                qs = parse_qs(urlparse(self.path).query)
                if qs.get("state", [None])[0] == expected_state and "code" in qs:
                    result["code"] = qs["code"][0]
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b"Auth complete. You can close this tab.")
                else:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Invalid state or missing code.")
            def log_message(self, *args): pass
        server = HTTPServer(("127.0.0.1", REDIRECT_PORT), Handler)
        server.handle_request()
        server.server_close()
        if "code" not in result:
            raise RuntimeError("Spotify PKCE auth failed: no code received")
        return result["code"]

    def _exchange_code(self, code, verifier):
        resp = self._session.post(TOKEN_URL, data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "client_id": self.client_id,
            "code_verifier": verifier,
        })
        resp.raise_for_status()
        tokens = resp.json()
        tokens["expires_at"] = time.time() + tokens.get("expires_in", 3600) - 60
        self._save_tokens(tokens)

    def _ensure_token(self):
        if not self._tokens.get("access_token"):
            raise RuntimeError("Not authenticated. Run authorize() first.")
        if self._tokens.get("expires_at", 0) <= time.time():
            self._refresh()

    def _refresh(self):
        rt = self._tokens.get("refresh_token")
        if not rt:
            raise RuntimeError("No refresh token. Re-authorize.")
        resp = self._session.post(TOKEN_URL, data={
            "grant_type": "refresh_token",
            "refresh_token": rt,
            "client_id": self.client_id,
        })
        resp.raise_for_status()
        tokens = resp.json()
        tokens["refresh_token"] = tokens.get("refresh_token", rt)
        tokens["expires_at"] = time.time() + tokens.get("expires_in", 3600) - 60
        self._save_tokens(tokens)

    def _request(self, method, path, **kwargs):
        self._ensure_token()
        url = path if path.startswith("http") else f"{API_BASE}{path}"
        headers = {"Authorization": f"Bearer {self._tokens['access_token']}"}
        resp = self._session.request(method, url, headers=headers, timeout=10, **kwargs)
        if resp.status_code == 401:
            self._refresh()
            headers["Authorization"] = f"Bearer {self._tokens['access_token']}"
            resp = self._session.request(method, url, headers=headers, timeout=10, **kwargs)
        if resp.status_code >= 400:
            raise RuntimeError(f"Spotify API error {resp.status_code}: {resp.text[:200]}")
        if resp.status_code == 204 or not resp.content:
            return None
        return resp.json()

    def search_tracks(self, query, limit=10):
        from urllib.parse import quote
        data = self._request("GET", f"/search?q={quote(query)}&type=track&limit={limit}")
        return data.get("tracks", {}).get("items", []) if data else []

    def get_recommendations(self, seed_tracks=None, seed_genres=None, **audio_features):
        params = {}
        if seed_tracks:
            params["seed_tracks"] = ",".join(seed_tracks[:5])
        if seed_genres:
            params["seed_genres"] = ",".join(seed_genres[:5])
        for k, v in audio_features.items():
            params[k] = v
        data = self._request("GET", f"/recommendations?{urlencode(params)}")
        return data.get("tracks", []) if data else []

    def start_playback(self, uri):
        self._request("PUT", "/me/player/play", json={"uris": [uri]})

    def pause_playback(self):
        self._request("PUT", "/me/player/pause")

    def resume_playback(self):
        self._request("PUT", "/me/player/play")

    def get_playback_state(self):
        return self._request("GET", "/me/player")

    def get_devices(self):
        data = self._request("GET", "/me/player/devices")
        return data.get("devices", []) if data else []
