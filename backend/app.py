from __future__ import annotations

import logging
import os
import secrets
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlencode

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, send_from_directory, session
from flask_session import Session
from cachelib.file import FileSystemCache

try:
    from redis import Redis
except ImportError:  # pragma: no cover - installed in app/runtime, optional in tests
    Redis = None

from blend_service import BlendValidationError, build_blend_preview, validate_blend_request
from spotify_client import SpotifyAPIError, SpotifyClient


load_dotenv()


class ApiError(Exception):
    def __init__(self, message, status_code=400, code="bad_request", details=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details or {}


def env_flag(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def build_config():
    root_dir = Path(__file__).resolve().parents[1]
    frontend_dist = root_dir / "sato-app" / "dist"
    client_app_url = os.getenv("CLIENT_APP_URL", "http://127.0.0.1:5173")
    redirect_uri = os.getenv(
        "SPOTIFY_REDIRECT_URI",
        "http://127.0.0.1:5000/api/auth/callback",
    )

    config = {
        "SECRET_KEY": os.getenv("FLASK_SECRET_KEY", "local-dev-secret"),
        "SESSION_COOKIE_NAME": "sato_session",
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SAMESITE": "Lax",
        "SESSION_COOKIE_SECURE": env_flag(
            "SESSION_COOKIE_SECURE",
            client_app_url.startswith("https://"),
        ),
        "PERMANENT_SESSION_LIFETIME": timedelta(days=7),
        "SESSION_PERMANENT": False,
        "SESSION_KEY_PREFIX": "sato:",
        "SESSION_TYPE": "cachelib",
        "CLIENT_APP_URL": client_app_url.rstrip("/"),
        "SPOTIFY_CLIENT_ID": os.getenv("SPOTIFY_CLIENT_ID"),
        "SPOTIFY_CLIENT_SECRET": os.getenv("SPOTIFY_CLIENT_SECRET"),
        "SPOTIFY_REDIRECT_URI": redirect_uri,
        "FRONTEND_DIST_DIR": frontend_dist,
    }

    session_dir = root_dir / ".flask_session"
    session_dir.mkdir(parents=True, exist_ok=True)
    config["SESSION_CACHELIB"] = FileSystemCache(str(session_dir), threshold=500)

    redis_url = os.getenv("REDIS_URL")
    if redis_url and Redis is not None:
        config["SESSION_TYPE"] = "redis"
        config["SESSION_REDIS"] = Redis.from_url(redis_url)

    return config


def create_app(test_config=None):
    app = Flask(__name__, static_folder=None)
    app.config.from_mapping(build_config())
    if test_config:
        app.config.update(test_config)

    Session(app)
    app.config.setdefault(
        "SPOTIFY_CLIENT_FACTORY",
        lambda **kwargs: SpotifyClient(**kwargs),
    )

    logging.basicConfig(level=logging.INFO)
    register_error_handlers(app)
    register_routes(app)
    return app


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(error):
        payload = {
            "error": {
                "code": error.code,
                "message": error.message,
                "details": error.details,
            }
        }
        return jsonify(payload), error.status_code

    @app.errorhandler(BlendValidationError)
    def handle_validation_error(error):
        payload = {
            "error": {
                "code": "validation_error",
                "message": error.message,
                "details": error.details,
            }
        }
        return jsonify(payload), 400

    @app.errorhandler(SpotifyAPIError)
    def handle_spotify_error(error):
        logging.getLogger("sato.spotify").warning(
            "Spotify request failed",
            extra={
                "status_code": error.status_code,
                "payload": error.payload,
            },
        )
        status_code = 401 if error.status_code == 401 else 502
        payload = {
            "error": {
                "code": "spotify_error",
                "message": error.message,
                "details": {
                    "spotify_status": error.status_code,
                    "spotify_payload": error.payload,
                },
            }
        }
        return jsonify(payload), status_code

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):  # pragma: no cover - integration guardrail
        app.logger.exception("Unhandled application error", exc_info=error)
        payload = {
            "error": {
                "code": "internal_error",
                "message": "The server could not complete that request.",
                "details": {},
            }
        }
        return jsonify(payload), 500


def register_routes(app):
    def client_redirect(query):
        return redirect(f"{app.config['CLIENT_APP_URL']}/?{urlencode(query)}")

    def get_spotify_credentials():
        session_config = session.get("spotify_config") or {}
        if session_config.get("client_id") and session_config.get("client_secret"):
            return {
                "client_id": session_config["client_id"],
                "client_secret": session_config["client_secret"],
                "source": "session",
            }

        if app.config["SPOTIFY_CLIENT_ID"] and app.config["SPOTIFY_CLIENT_SECRET"]:
            return {
                "client_id": app.config["SPOTIFY_CLIENT_ID"],
                "client_secret": app.config["SPOTIFY_CLIENT_SECRET"],
                "source": "server",
            }

        return {
            "client_id": None,
            "client_secret": None,
            "source": None,
        }

    def require_spotify_credentials():
        credentials = get_spotify_credentials()
        if credentials["client_id"] and credentials["client_secret"]:
            return credentials

        raise ApiError(
            "Spotify credentials are not configured. Add them in the web app before signing in.",
            status_code=400,
            code="spotify_config_missing",
        )

    def clear_spotify_auth_state():
        session.pop("oauth_state", None)
        session.pop("spotify_tokens", None)
        session.pop("spotify_user", None)
        session.modified = True

    def store_spotify_tokens(token_payload):
        session["spotify_tokens"] = {
            "access_token": token_payload.get("access_token"),
            "refresh_token": token_payload.get("refresh_token"),
            "expires_at": token_payload.get("expires_at"),
        }
        session.modified = True

    def get_spotify_client():
        tokens = session.get("spotify_tokens", {})
        credentials = require_spotify_credentials()
        factory = app.config["SPOTIFY_CLIENT_FACTORY"]
        return factory(
            client_id=credentials["client_id"],
            client_secret=credentials["client_secret"],
            redirect_uri=app.config["SPOTIFY_REDIRECT_URI"],
            access_token=tokens.get("access_token"),
            refresh_token=tokens.get("refresh_token"),
            expires_at=tokens.get("expires_at"),
            token_updater=store_spotify_tokens,
        )

    def require_spotify_session():
        tokens = session.get("spotify_tokens") or {}
        if not tokens.get("access_token"):
            raise ApiError(
                "Sign in with Spotify before using this feature.",
                status_code=401,
                code="not_authenticated",
            )
        return get_spotify_client()

    def parse_json_body():
        payload = request.get_json(silent=True)
        if payload is None:
            raise ApiError(
                "Expected a JSON request body.",
                status_code=400,
                code="invalid_json",
            )
        return payload

    def fetch_or_get_cached_user(client):
        spotify_user = session.get("spotify_user")
        if spotify_user:
            try:
                spotify_user = client.get_current_user()
            except SpotifyAPIError as error:
                if error.status_code != 401:
                    raise
            else:
                session["spotify_user"] = spotify_user
                return spotify_user

        spotify_user = client.get_current_user()
        session["spotify_user"] = spotify_user
        return spotify_user

    def serialize_playlist(playlist):
        return {
            "id": playlist["id"],
            "name": playlist.get("name") or "Untitled playlist",
            "track_count": playlist.get("tracks", {}).get("total", 0),
        }

    def serialize_friend(profile, playlists):
        public_playlists = [playlist for playlist in playlists if playlist.get("public")]
        return {
            "id": profile["id"],
            "name": profile.get("display_name") or profile["id"],
            "image": (profile.get("images") or [{}])[0].get("url"),
            "followers": profile.get("followers", {}).get("total", 0),
            "playlist_count": len(public_playlists),
            "playlists": [serialize_playlist(playlist) for playlist in public_playlists],
        }

    def resolve_friend_profile(client, user_id):
        try:
            profile = client.get_user(user_id)
            playlists = client.get_user_playlists(user_id)
        except SpotifyAPIError as error:
            if error.status_code in {400, 404}:
                return None
            raise
        return serialize_friend(profile, playlists)

    def build_blend_context(client, payload):
        current_user = fetch_or_get_cached_user(client)
        normalized_request = validate_blend_request(payload)
        self_tracks = client.get_current_user_top_tracks(limit=50)
        friend_sources = []

        for friend_request in normalized_request["friends"]:
            friend = resolve_friend_profile(client, friend_request["id"])
            if friend is None:
                raise ApiError(
                    f"Spotify user '{friend_request['id']}' could not be resolved.",
                    status_code=400,
                    code="unresolved_friend",
                )

            available_playlists = {playlist["id"]: playlist for playlist in friend["playlists"]}
            selected_playlist_ids = friend_request["playlist_ids"] or list(available_playlists)
            if not selected_playlist_ids:
                raise ApiError(
                    f"{friend['name']} has no public playlists available for blending.",
                    status_code=400,
                    code="missing_playlists",
                )

            invalid_playlist_ids = [
                playlist_id
                for playlist_id in selected_playlist_ids
                if playlist_id not in available_playlists
            ]
            if invalid_playlist_ids:
                raise ApiError(
                    f"{friend['name']} includes playlists that are not public or no longer exist.",
                    status_code=400,
                    code="invalid_playlist_selection",
                    details={"playlist_ids": invalid_playlist_ids},
                )

            playlist_tracks = []
            for playlist_id in selected_playlist_ids:
                playlist_tracks.extend(client.get_playlist_tracks(playlist_id))

            friend_sources.append(
                {
                    "id": friend["id"],
                    "name": friend["name"],
                    "weight": friend_request["weight"],
                    "playlist_ids": selected_playlist_ids,
                    "tracks": playlist_tracks,
                }
            )

        preview = build_blend_preview(
            self_tracks=self_tracks,
            self_weight=normalized_request["self_weight"],
            friend_sources=friend_sources,
            user_label=current_user.get("display_name") or current_user.get("id", "You"),
        )
        return current_user, normalized_request, preview

    @app.get("/api/auth/spotify-config")
    def spotify_config():
        credentials = get_spotify_credentials()
        return jsonify(
            {
                "configured": bool(
                    credentials["client_id"] and credentials["client_secret"]
                ),
                "client_id": credentials["client_id"] or "",
                "source": credentials["source"],
            }
        )

    @app.post("/api/auth/spotify-config")
    def update_spotify_config():
        payload = parse_json_body()
        client_id = str(payload.get("client_id") or "").strip()
        client_secret = str(payload.get("client_secret") or "").strip()

        if not client_id or not client_secret:
            raise ApiError(
                "Provide both Spotify Client ID and Client Secret.",
                status_code=400,
                code="spotify_config_invalid",
            )

        session["spotify_config"] = {
            "client_id": client_id,
            "client_secret": client_secret,
        }
        clear_spotify_auth_state()
        session.modified = True
        return jsonify(
            {
                "configured": True,
                "client_id": client_id,
                "source": "session",
            }
        )

    @app.get("/api/auth/login")
    def login():
        credentials = get_spotify_credentials()
        if not credentials["client_id"] or not credentials["client_secret"]:
            return client_redirect(
                {
                    "login": "error",
                    "reason": "spotify_config_missing",
                }
            )

        state = secrets.token_urlsafe(24)
        session["oauth_state"] = state
        client = get_spotify_client()
        return redirect(client.authorization_url(state=state))

    @app.get("/api/auth/callback")
    def callback():
        if request.args.get("error"):
            return client_redirect(
                {
                    "login": "error",
                    "reason": request.args["error"],
                }
            )

        code = request.args.get("code")
        state = request.args.get("state")
        if not code:
            return client_redirect({"login": "error", "reason": "missing_code"})
        if not state or state != session.get("oauth_state"):
            return client_redirect({"login": "error", "reason": "invalid_state"})

        session.pop("oauth_state", None)
        client = get_spotify_client()
        token_payload = client.exchange_code(code)
        store_spotify_tokens(token_payload)
        spotify_user = client.get_current_user()
        session["spotify_user"] = spotify_user
        session.modified = True
        return client_redirect({"login": "success"})

    @app.post("/api/auth/logout")
    def logout():
        spotify_config = session.get("spotify_config")
        session.clear()
        if spotify_config:
            session["spotify_config"] = spotify_config
            session.modified = True
        return jsonify({"ok": True})

    @app.get("/api/me")
    def current_user():
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        return jsonify(user)

    @app.post("/api/friends/resolve")
    def resolve_friends():
        payload = parse_json_body()
        urls = payload.get("urls")
        if not isinstance(urls, list) or not urls:
            raise ApiError(
                "Provide at least one Spotify profile URL.",
                status_code=400,
                code="missing_urls",
            )

        client = require_spotify_session()
        friends = []
        invalid_urls = []
        unresolved_users = []
        seen_user_ids = set()

        for raw_url in urls:
            user_id = SpotifyClient.extract_user_id(raw_url)
            if not user_id:
                invalid_urls.append(raw_url)
                continue
            if user_id in seen_user_ids:
                continue

            seen_user_ids.add(user_id)
            friend = resolve_friend_profile(client, user_id)
            if friend is None:
                unresolved_users.append(user_id)
                continue

            friends.append(friend)

        return jsonify(
            {
                "friends": friends,
                "invalid_urls": invalid_urls,
                "unresolved_users": unresolved_users,
            }
        )

    @app.post("/api/blends/preview")
    def preview_blend():
        client = require_spotify_session()
        payload = parse_json_body()
        _, normalized_request, preview = build_blend_context(client, payload)
        return jsonify(
            {
                "tracks": preview["tracks"],
                "summary": {
                    **preview["summary"],
                    "normalized_weights": normalized_request,
                },
            }
        )

    @app.post("/api/blends")
    def create_blend():
        client = require_spotify_session()
        payload = parse_json_body()
        current_user, normalized_request, preview = build_blend_context(client, payload)
        playlist_name = (payload.get("name") or "Custom Blend").strip() or "Custom Blend"
        playlist = client.create_playlist(
            user_id=current_user["id"],
            name=playlist_name,
            description="Generated by Sato.",
            is_public=False,
        )
        track_uris = [f"spotify:track:{track['id']}" for track in preview["tracks"]]
        client.add_tracks_to_playlist(playlist["id"], track_uris)
        return jsonify(
            {
                "id": playlist["id"],
                "name": playlist.get("name", playlist_name),
                "external_urls": playlist.get("external_urls", {}),
                "tracks_added": len(track_uris),
                "summary": {
                    **preview["summary"],
                    "normalized_weights": normalized_request,
                },
            }
        )

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def serve_frontend(path):
        if path.startswith("api/"):
            raise ApiError(
                "The requested API route does not exist.",
                status_code=404,
                code="not_found",
            )

        dist_dir = Path(app.config["FRONTEND_DIST_DIR"])
        requested_file = dist_dir / path

        if path and requested_file.exists():
            return send_from_directory(dist_dir, path)

        index_file = dist_dir / "index.html"
        if index_file.exists():
            return send_from_directory(dist_dir, "index.html")

        return redirect(app.config["CLIENT_APP_URL"])


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
