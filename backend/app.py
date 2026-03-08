from __future__ import annotations

import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode

from dotenv import load_dotenv
from flask import Flask, g, jsonify, redirect, request, send_from_directory, session
from flask_session import Session
from cachelib.file import FileSystemCache

try:
    from redis import Redis
except ImportError:  # pragma: no cover - optional in tests/runtime
    Redis = None

from blend_service import (
    BlendValidationError,
    build_contribution_snapshot,
    build_generated_cover_art,
    build_room_blend_preview,
    build_wrapped_artifact,
    round_to_two,
)
from debug_tools import DebugRecorder, configure_app_logger
from e2e_support import E2EFakeSpotifyFactory
from room_store import RoomStore, utc_now_iso
from spotify_client import SpotifyAPIError, SpotifyClient


load_dotenv()

MAX_ROOM_MEMBERS = 6
MAX_PLAYLISTS_PER_MEMBER = 5
TOP_TRACK_CAP = 50
SAVED_TRACK_CAP = 500
RECENT_TRACK_CAP = 50
PLAYLIST_TRACK_CAP = 500
ROOM_TTL_SECONDS = 7 * 24 * 60 * 60
SOURCE_CATALOG_CACHE_SECONDS = 5 * 60


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
        "ROOM_TTL_SECONDS": ROOM_TTL_SECONDS,
        "SOURCE_CATALOG_CACHE_SECONDS": SOURCE_CATALOG_CACHE_SECONDS,
        "E2E_MODE": env_flag("SATO_E2E"),
        "DEBUG_LOGGING_ENABLED": env_flag("SATO_DEBUG_LOGGING", env_flag("SATO_E2E")),
        "DEBUG_LOG_FILE": os.getenv("SATO_DEBUG_LOG_PATH"),
        "DEBUG_LOG_BUFFER_SIZE": int(os.getenv("SATO_DEBUG_LOG_BUFFER_SIZE", "500")),
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
    if app.config.get("E2E_MODE"):
        app.config["SPOTIFY_CLIENT_FACTORY"] = E2EFakeSpotifyFactory()
    else:
        app.config.setdefault(
            "SPOTIFY_CLIENT_FACTORY",
            lambda **kwargs: SpotifyClient(**kwargs),
        )

    app.config["DEBUG_RECORDER"] = DebugRecorder(
        max_events=app.config["DEBUG_LOG_BUFFER_SIZE"],
        log_path=app.config.get("DEBUG_LOG_FILE"),
    )
    logging.basicConfig(level=logging.INFO)
    app.logger = configure_app_logger(app)
    register_debug_logging(app)
    register_error_handlers(app)
    register_routes(app)
    return app


def register_debug_logging(app):
    def record_event(kind, **details):
        recorder = app.config.get("DEBUG_RECORDER")
        entry = {
            "kind": kind,
            "request_id": getattr(g, "request_id", None),
            "client_request_id": getattr(g, "client_request_id", None),
            **details,
        }
        if recorder is not None:
            recorder.record(entry)
        app.logger.info("%s %s", kind, details)
        return entry

    app.config["DEBUG_EVENT_WRITER"] = record_event

    @app.before_request
    def start_request_logging():
        g.request_started_at = time.perf_counter()
        g.request_id = secrets.token_hex(6)
        g.client_request_id = request.headers.get("X-Sato-Client-Request-Id")
        if request.path.startswith("/api/"):
            record_event(
                "request.started",
                method=request.method,
                path=request.path,
                room=request.args.get("room"),
                session_user=(session.get("spotify_user") or {}).get("id"),
            )

    @app.after_request
    def finish_request_logging(response):
        response.headers["X-Sato-Request-Id"] = getattr(g, "request_id", "")
        if request.path.startswith("/api/"):
            duration_ms = round((time.perf_counter() - getattr(g, "request_started_at", time.perf_counter())) * 1000, 2)
            record_event(
                "request.completed",
                method=request.method,
                path=request.path,
                status=response.status_code,
                duration_ms=duration_ms,
                session_user=(session.get("spotify_user") or {}).get("id"),
            )
        return response


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
    room_store = RoomStore(
        cachelib=app.config.get("SESSION_CACHELIB"),
        redis_client=app.config.get("SESSION_REDIS"),
        ttl_seconds=app.config["ROOM_TTL_SECONDS"],
    )

    def debug_event(kind, **details):
        writer = app.config.get("DEBUG_EVENT_WRITER")
        if writer:
            return writer(kind, **details)
        return None

    def client_redirect(query):
        return redirect(f"{app.config['CLIENT_APP_URL']}/?{urlencode(query)}")

    def next_room_query(extra=None):
        payload = dict(extra or {})
        room_token = session.pop("post_auth_room_token", None)
        if room_token:
            payload["room"] = room_token
            session.modified = True
        return payload

    def store_post_auth_room(room_token):
        if room_token:
            session["post_auth_room_token"] = room_token
            session.modified = True

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

        return {"client_id": None, "client_secret": None, "source": None}

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
        session.pop("source_catalog_cache", None)
        session.modified = True

    def build_spotify_client(
        *,
        client_id=None,
        client_secret=None,
        access_token=None,
        refresh_token=None,
        expires_at=None,
        token_updater=None,
    ):
        if client_id is None or client_secret is None:
            credentials = require_spotify_credentials()
            client_id = credentials["client_id"]
            client_secret = credentials["client_secret"]

        factory = app.config["SPOTIFY_CLIENT_FACTORY"]
        return factory(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=app.config["SPOTIFY_REDIRECT_URI"],
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            token_updater=token_updater,
        )

    def validate_spotify_credentials(client):
        try:
            client.verify_client_credentials()
        except SpotifyAPIError as error:
            if error.status_code in {400, 401}:
                raise ApiError(
                    "Spotify rejected these credentials. Double-check the Client ID and Client Secret. INVALID_CLIENT usually means the Client ID is wrong.",
                    status_code=400,
                    code="spotify_config_invalid_credentials",
                    details={
                        "spotify_status": error.status_code,
                        "spotify_payload": error.payload,
                    },
                ) from error
            raise

    def store_spotify_tokens(token_payload):
        session["spotify_tokens"] = {
            "access_token": token_payload.get("access_token"),
            "refresh_token": token_payload.get("refresh_token"),
            "expires_at": token_payload.get("expires_at"),
        }
        session.modified = True

    def get_spotify_client():
        tokens = session.get("spotify_tokens") or {}
        return build_spotify_client(
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

    def utc_future_iso(seconds):
        return (
            datetime.now(timezone.utc) + timedelta(seconds=seconds)
        ).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    def set_room_timestamps(room):
        room["updated_at"] = utc_now_iso()
        room["expires_at"] = utc_future_iso(room_store.ttl_seconds)

    def serialize_member_profile(user):
        return {
            "id": user["id"],
            "display_name": user.get("display_name") or user["id"],
            "image": (user.get("images") or [{}])[0].get("url"),
            "email": user.get("email") or "",
            "joined_at": utc_now_iso(),
        }

    def upsert_room_member(room, user):
        member_profile = serialize_member_profile(user)
        for index, member in enumerate(room["members"]):
            if member["id"] == member_profile["id"]:
                room["members"][index] = {
                    **member,
                    **member_profile,
                    "joined_at": member.get("joined_at", member_profile["joined_at"]),
                }
                return room["members"][index]

        room["members"].append(member_profile)
        room["weights"].setdefault(member_profile["id"], 0)
        return member_profile

    def find_room_member(room, user_id):
        for member in room["members"]:
            if member["id"] == user_id:
                return member
        return None

    def require_room(token):
        room = room_store.get_room(token)
        if room:
            return room
        raise ApiError(
            "That blend room was not found or has expired.",
            status_code=404,
            code="room_not_found",
        )

    def require_room_member(room, user_id):
        member = find_room_member(room, user_id)
        if member:
            return member
        raise ApiError(
            "Join this room before accessing it.",
            status_code=403,
            code="room_access_denied",
        )

    def require_room_host(room, user_id):
        if room["host_user_id"] == user_id:
            return
        raise ApiError(
            "Only the room host can perform that action.",
            status_code=403,
            code="host_only",
        )

    def as_weight(value, field_name):
        try:
            weight = float(value)
        except (TypeError, ValueError) as error:
            raise ApiError(
                f"{field_name} must be a number between 0 and 100.",
                status_code=400,
                code="invalid_weight",
                details={"field": field_name},
            ) from error

        if weight < 0 or weight > 100:
            raise ApiError(
                f"{field_name} must be between 0 and 100.",
                status_code=400,
                code="invalid_weight",
                details={"field": field_name},
            )
        return round_to_two(weight)

    def owned_or_collaborative_playlist(playlist, current_user_id):
        owner = playlist.get("owner") or {}
        return owner.get("id") == current_user_id or bool(playlist.get("collaborative"))

    def serialize_playlist_option(playlist):
        owner = playlist.get("owner") or {}
        return {
            "id": playlist["id"],
            "name": playlist.get("name") or "Untitled playlist",
            "track_count": playlist.get("tracks", {}).get("total", 0),
            "collaborative": bool(playlist.get("collaborative")),
            "owner_id": owner.get("id") or "",
            "owner_name": owner.get("display_name") or owner.get("id") or "",
        }

    def get_cached_source_catalog(user_id):
        cache_bucket = session.get("source_catalog_cache") or {}
        cache_entry = cache_bucket.get(str(user_id))
        if not cache_entry:
            return None

        cached_at = float(cache_entry.get("cached_at", 0))
        if (time.time() - cached_at) > app.config["SOURCE_CATALOG_CACHE_SECONDS"]:
            cache_bucket.pop(str(user_id), None)
            session["source_catalog_cache"] = cache_bucket
            session.modified = True
            return None

        return cache_entry.get("payload")

    def store_source_catalog(user_id, payload):
        cache_bucket = session.get("source_catalog_cache") or {}
        cache_bucket[str(user_id)] = {
            "cached_at": time.time(),
            "payload": payload,
        }
        session["source_catalog_cache"] = cache_bucket
        session.modified = True
        return payload

    def build_source_catalog(client, current_user, *, force_refresh=False):
        if not force_refresh:
            cached_payload = get_cached_source_catalog(current_user["id"])
            if cached_payload is not None:
                return cached_payload

        top_tracks = client.get_current_user_top_tracks(limit=TOP_TRACK_CAP)
        saved_tracks_count = client.get_saved_tracks_total(limit_cap=SAVED_TRACK_CAP)
        recent_tracks = client.get_recently_played(limit=RECENT_TRACK_CAP)
        playlist_items = client.get_current_user_playlists(limit=200)

        allowed_playlists = []
        seen_playlist_ids = set()
        for playlist in playlist_items:
            playlist_id = playlist.get("id")
            if (
                not playlist_id
                or playlist_id in seen_playlist_ids
                or not owned_or_collaborative_playlist(playlist, current_user["id"])
            ):
                continue

            seen_playlist_ids.add(playlist_id)
            allowed_playlists.append(serialize_playlist_option(playlist))

        allowed_playlists.sort(key=lambda playlist: playlist["name"].lower())
        payload = {
            "top_tracks": {
                "available": bool(top_tracks),
                "count": len(top_tracks),
                "cap": TOP_TRACK_CAP,
            },
            "saved_tracks": {
                "available": bool(saved_tracks_count),
                "count": saved_tracks_count,
                "cap": SAVED_TRACK_CAP,
            },
            "recent_tracks": {
                "available": bool(recent_tracks),
                "count": len(recent_tracks),
                "cap": RECENT_TRACK_CAP,
            },
            "playlists": allowed_playlists,
            "playlist_limits": {
                "max_selected": MAX_PLAYLISTS_PER_MEMBER,
                "per_playlist_track_cap": PLAYLIST_TRACK_CAP,
            },
        }
        return store_source_catalog(current_user["id"], payload)

    def contributing_member_ids(room):
        return [
            member["id"]
            for member in room["members"]
            if (room["contributions"].get(member["id"]) or {}).get("track_count")
        ]

    def weights_cover_current_contributors(room):
        member_ids = contributing_member_ids(room)
        if not member_ids:
            return True
        total = sum(float(room["weights"].get(member_id, 0)) for member_id in member_ids)
        return all(member_id in room["weights"] for member_id in member_ids) and abs(total - 100) <= 0.01

    def rebalance_room_weights(room):
        member_ids = contributing_member_ids(room)
        next_weights = {member["id"]: 0 for member in room["members"]}
        if not member_ids:
            room["weights"] = next_weights
            return

        remaining_basis_points = 10000
        base_weight = remaining_basis_points // len(member_ids)
        extra_points = remaining_basis_points - (base_weight * len(member_ids))

        for member_id in member_ids:
            next_weight = base_weight + (1 if extra_points > 0 else 0)
            if extra_points > 0:
                extra_points -= 1
            next_weights[member_id] = round_to_two(next_weight / 100)

        room["weights"] = next_weights

    def serialize_member(room, member):
        contribution = room["contributions"].get(member["id"]) or {}
        return {
            "id": member["id"],
            "display_name": member.get("display_name") or member["id"],
            "image": member.get("image"),
            "weight": round_to_two(room["weights"].get(member["id"], 0)),
            "has_contribution": bool(contribution.get("track_count")),
            "track_count": contribution.get("track_count", 0),
            "source_summary": contribution.get("source_summary", {}),
            "updated_at": contribution.get("updated_at") or member.get("joined_at"),
        }

    def serialize_current_contribution(room, user_id):
        contribution = room["contributions"].get(user_id)
        if not contribution:
            return {
                "use_top_tracks": False,
                "use_saved_tracks": False,
                "use_recent_tracks": False,
                "playlist_ids": [],
                "source_summary": {},
                "track_count": 0,
                "updated_at": None,
            }
        return {
            "use_top_tracks": contribution["use_top_tracks"],
            "use_saved_tracks": contribution["use_saved_tracks"],
            "use_recent_tracks": contribution["use_recent_tracks"],
            "playlist_ids": contribution["playlist_ids"],
            "source_summary": contribution["source_summary"],
            "track_count": contribution["track_count"],
            "updated_at": contribution.get("updated_at"),
        }

    def serialize_room(room, current_user_id):
        return {
            "token": room["token"],
            "invite_url": f"{app.config['CLIENT_APP_URL']}/?room={room['token']}",
            "role": "host" if room["host_user_id"] == current_user_id else "member",
            "host_id": room["host_user_id"],
            "playlist_name": room["playlist_name"],
            "updated_at": room["updated_at"],
            "expires_at": room["expires_at"],
            "created_playlist": room["final_playlist"],
            "has_wrapped": bool(room["wrapped"]),
            "members": [serialize_member(room, member) for member in room["members"]],
            "contribution": serialize_current_contribution(room, current_user_id),
        }

    def build_room_contributors(room):
        contributors = []
        for member in room["members"]:
            contribution = room["contributions"].get(member["id"]) or {}
            weight = round_to_two(room["weights"].get(member["id"], 0))
            if not contribution.get("track_count") or weight <= 0:
                continue

            contributors.append(
                {
                    "id": member["id"],
                    "name": member.get("display_name") or member["id"],
                    "weight": weight,
                    "tracks": contribution["tracks"],
                }
            )

        if len(contributors) < 2:
            raise ApiError(
                "At least two room members with saved contributions and positive weights are required before previewing.",
                status_code=400,
                code="room_not_ready",
            )

        total_weight = round_to_two(sum(contributor["weight"] for contributor in contributors))
        if abs(total_weight - 100) > 0.01:
            raise ApiError(
                "Room weights must total exactly 100 before previewing.",
                status_code=400,
                code="invalid_room_weights",
                details={"weight_total": total_weight},
            )

        return contributors

    def save_room(room):
        set_room_timestamps(room)
        return room_store.save_room(room)

    def require_debug_mode():
        if app.config.get("E2E_MODE") or app.config.get("DEBUG_LOGGING_ENABLED"):
            return
        raise ApiError(
            "Debug routes are disabled.",
            status_code=404,
            code="not_found",
        )

    def require_e2e_factory():
        factory = app.config.get("SPOTIFY_CLIENT_FACTORY")
        if app.config.get("E2E_MODE") and isinstance(factory, E2EFakeSpotifyFactory):
            return factory
        raise ApiError(
            "E2E helpers are unavailable.",
            status_code=404,
            code="not_found",
        )

    def seed_e2e_session(user_id, *, set_config=True):
        factory = require_e2e_factory()
        try:
            user = factory.require_user(user_id)
        except KeyError as error:
            raise ApiError(
                "Unknown E2E user id.",
                status_code=400,
                code="unknown_e2e_user",
                details={"user_id": user_id},
            ) from error

        if set_config:
            session["spotify_config"] = {
                "client_id": factory.default_client_id,
                "client_secret": factory.default_client_secret,
            }
        session["spotify_tokens"] = factory.issue_session(user_id)
        session["spotify_user"] = user
        session.modified = True
        debug_event("e2e.session.seeded", user_id=user_id, configured=set_config)
        return user

    @app.get("/api/auth/spotify-config")
    def spotify_config():
        credentials = get_spotify_credentials()
        return jsonify(
            {
                "configured": bool(
                    credentials["client_id"] and credentials["client_secret"]
                ),
                "client_id": credentials["client_id"] or "",
                "redirect_uri": app.config["SPOTIFY_REDIRECT_URI"],
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

        candidate_client = build_spotify_client(
            client_id=client_id,
            client_secret=client_secret,
        )
        validate_spotify_credentials(candidate_client)

        session["spotify_config"] = {
            "client_id": client_id,
            "client_secret": client_secret,
        }
        clear_spotify_auth_state()
        session.modified = True
        debug_event("auth.spotify_config.updated", source="session")
        return jsonify(
            {
                "configured": True,
                "client_id": client_id,
                "redirect_uri": app.config["SPOTIFY_REDIRECT_URI"],
                "source": "session",
            }
        )

    @app.get("/api/auth/login")
    def login():
        credentials = get_spotify_credentials()
        if not credentials["client_id"] or not credentials["client_secret"]:
            return client_redirect(
                next_room_query(
                    {
                        "login": "error",
                        "reason": "spotify_config_missing",
                    }
                )
            )

        store_post_auth_room(request.args.get("room"))
        state = secrets.token_urlsafe(24)
        session["oauth_state"] = state
        debug_event("auth.login.started", room=request.args.get("room"))
        client = build_spotify_client()
        try:
            validate_spotify_credentials(client)
        except ApiError as error:
            session.pop("oauth_state", None)
            session.modified = True
            return client_redirect(
                next_room_query(
                    {
                        "login": "error",
                        "reason": error.code,
                    }
                )
            )

        return redirect(client.authorization_url(state=state))

    @app.get("/api/auth/callback")
    def callback():
        if request.args.get("error"):
            debug_event(
                "auth.login.failed",
                provider_error=request.args["error"],
                redirect_uri=app.config["SPOTIFY_REDIRECT_URI"],
            )
            return client_redirect(
                next_room_query(
                    {
                        "login": "error",
                        "reason": request.args["error"],
                    }
                )
            )

        code = request.args.get("code")
        state = request.args.get("state")
        if not code:
            return client_redirect(
                next_room_query({"login": "error", "reason": "missing_code"})
            )
        if not state or state != session.get("oauth_state"):
            return client_redirect(
                next_room_query({"login": "error", "reason": "invalid_state"})
            )

        session.pop("oauth_state", None)
        client = get_spotify_client()
        token_payload = client.exchange_code(code)
        store_spotify_tokens(token_payload)
        spotify_user = client.get_current_user()
        session["spotify_user"] = spotify_user
        session.modified = True
        debug_event("auth.login.completed", user_id=spotify_user["id"])
        return client_redirect(next_room_query({"login": "success"}))

    @app.post("/api/auth/logout")
    def logout():
        spotify_config = session.get("spotify_config")
        post_auth_room_token = session.get("post_auth_room_token")
        session.clear()
        if spotify_config:
            session["spotify_config"] = spotify_config
        if post_auth_room_token:
            session["post_auth_room_token"] = post_auth_room_token
        session.modified = True
        debug_event("auth.logout.completed")
        return jsonify({"ok": True})

    @app.get("/api/me")
    def current_user():
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        return jsonify(user)

    @app.get("/api/me/source-catalog")
    def source_catalog():
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        refresh = str(request.args.get("refresh") or "").lower() in {"1", "true", "yes"}
        return jsonify(build_source_catalog(client, user, force_refresh=refresh))

    @app.post("/api/rooms")
    def create_room():
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        display_name = user.get("display_name") or user["id"]
        room = room_store.create_room(
            host_user_id=user["id"],
            playlist_name=f"{display_name}'s Sato Blend",
        )
        upsert_room_member(room, user)
        save_room(room)
        debug_event("room.created", room_token=room["token"], host_user_id=user["id"])
        return jsonify(serialize_room(room, user["id"]))

    @app.get("/api/rooms/<token>")
    def get_room(token):
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        room = require_room(token)
        require_room_member(room, user["id"])
        return jsonify(serialize_room(room, user["id"]))

    @app.post("/api/rooms/<token>/join")
    def join_room(token):
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        room = require_room(token)

        if not find_room_member(room, user["id"]) and len(room["members"]) >= MAX_ROOM_MEMBERS:
            raise ApiError(
                "This room is full.",
                status_code=400,
                code="room_full",
            )

        upsert_room_member(room, user)
        save_room(room)
        debug_event("room.joined", room_token=token, user_id=user["id"])
        return jsonify(serialize_room(room, user["id"]))

    @app.post("/api/rooms/<token>/leave")
    def leave_room(token):
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        room = require_room(token)
        require_room_member(room, user["id"])

        if room["host_user_id"] == user["id"] and len(room["members"]) > 1:
            raise ApiError(
                "The host cannot leave while other members are still in the room.",
                status_code=400,
                code="host_cannot_leave",
            )

        room["members"] = [member for member in room["members"] if member["id"] != user["id"]]
        room["contributions"].pop(user["id"], None)
        room["weights"].pop(user["id"], None)

        if not room["members"]:
            room_store.delete_room(token)
            debug_event("room.deleted", room_token=token)
            return jsonify({"deleted": True})

        if room["host_user_id"] == user["id"]:
            room["host_user_id"] = room["members"][0]["id"]

        if not weights_cover_current_contributors(room):
            rebalance_room_weights(room)

        save_room(room)
        debug_event("room.left", room_token=token, user_id=user["id"])
        return jsonify(serialize_room(room, room["members"][0]["id"]))

    @app.put("/api/rooms/<token>/contribution")
    def save_contribution(token):
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        room = require_room(token)
        require_room_member(room, user["id"])
        payload = parse_json_body()

        use_top_tracks = bool(payload.get("use_top_tracks"))
        use_saved_tracks = bool(payload.get("use_saved_tracks"))
        use_recent_tracks = bool(payload.get("use_recent_tracks"))
        playlist_ids = payload.get("playlist_ids") or []
        if not isinstance(playlist_ids, list):
            raise ApiError(
                "playlist_ids must be an array of playlist ids.",
                status_code=400,
                code="invalid_playlist_ids",
            )

        playlist_ids = [str(playlist_id).strip() for playlist_id in playlist_ids if str(playlist_id).strip()]
        playlist_ids = list(dict.fromkeys(playlist_ids))
        if len(playlist_ids) > MAX_PLAYLISTS_PER_MEMBER:
            raise ApiError(
                f"Select at most {MAX_PLAYLISTS_PER_MEMBER} playlists per member.",
                status_code=400,
                code="too_many_playlists",
            )

        playlist_catalog = {
            playlist["id"]: playlist
            for playlist in build_source_catalog(client, user)["playlists"]
        }
        invalid_playlist_ids = [playlist_id for playlist_id in playlist_ids if playlist_id not in playlist_catalog]
        if invalid_playlist_ids:
            raise ApiError(
                "One or more selected playlists are unavailable. Choose owned or collaborative playlists only.",
                status_code=400,
                code="invalid_playlist_selection",
                details={"playlist_ids": invalid_playlist_ids},
            )

        top_tracks = client.get_current_user_top_tracks(limit=TOP_TRACK_CAP) if use_top_tracks else []
        saved_tracks = client.get_saved_tracks(limit=SAVED_TRACK_CAP) if use_saved_tracks else []
        recent_tracks = client.get_recently_played(limit=RECENT_TRACK_CAP) if use_recent_tracks else []

        selected_playlists = [playlist_catalog[playlist_id] for playlist_id in playlist_ids]
        playlist_tracks = []
        for playlist_id in playlist_ids:
            playlist_tracks.extend(client.get_playlist_tracks(playlist_id, limit=PLAYLIST_TRACK_CAP))

        had_contribution = bool((room["contributions"].get(user["id"]) or {}).get("track_count"))
        contribution = build_contribution_snapshot(
            use_top_tracks=use_top_tracks,
            use_saved_tracks=use_saved_tracks,
            use_recent_tracks=use_recent_tracks,
            playlist_ids=playlist_ids,
            selected_playlists=selected_playlists,
            top_tracks=top_tracks,
            saved_tracks=saved_tracks,
            recent_tracks=recent_tracks,
            playlist_tracks=playlist_tracks,
        )
        contribution["updated_at"] = utc_now_iso()
        room["contributions"][user["id"]] = contribution

        if (not had_contribution) or (not weights_cover_current_contributors(room)):
            rebalance_room_weights(room)

        save_room(room)
        debug_event(
            "room.contribution.saved",
            room_token=token,
            user_id=user["id"],
            track_count=contribution["track_count"],
        )
        return jsonify(
            {
                "room": serialize_room(room, user["id"]),
                "contribution": serialize_current_contribution(room, user["id"]),
            }
        )

    @app.patch("/api/rooms/<token>/weights")
    def update_room_weights(token):
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        room = require_room(token)
        require_room_member(room, user["id"])
        require_room_host(room, user["id"])
        payload = parse_json_body()
        members = payload.get("members")

        if not isinstance(members, list) or not members:
            raise ApiError(
                "Provide room member weights as an array.",
                status_code=400,
                code="invalid_room_weights",
            )

        active_ids = set(contributing_member_ids(room))
        submitted_ids = {str(member.get("id") or "").strip() for member in members}
        if submitted_ids != active_ids:
            raise ApiError(
                "Room weights must be provided for every member with a saved contribution.",
                status_code=400,
                code="invalid_room_weights",
            )

        next_weights = {member["id"]: 0 for member in room["members"]}
        total_weight = 0
        for member in members:
            member_id = str(member.get("id") or "").strip()
            weight = as_weight(member.get("weight"), f"{member_id}.weight")
            next_weights[member_id] = weight
            total_weight += weight

        total_weight = round_to_two(total_weight)
        if abs(total_weight - 100) > 0.01:
            raise ApiError(
                "Room weights must total exactly 100.",
                status_code=400,
                code="invalid_room_weights",
                details={"weight_total": total_weight},
            )

        positive_members = [member_id for member_id in active_ids if next_weights.get(member_id, 0) > 0]
        if len(positive_members) < 2:
            raise ApiError(
                "At least two members must have a positive weight before previewing.",
                status_code=400,
                code="invalid_room_weights",
            )

        room["weights"] = next_weights
        save_room(room)
        debug_event("room.weights.updated", room_token=token, weights=next_weights)
        return jsonify(serialize_room(room, user["id"]))

    @app.patch("/api/rooms/<token>/settings")
    def update_room_settings(token):
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        room = require_room(token)
        require_room_member(room, user["id"])
        require_room_host(room, user["id"])
        payload = parse_json_body()

        playlist_name = str(payload.get("playlist_name") or "").strip() or "Sato Blend"
        room["playlist_name"] = playlist_name[:80]
        save_room(room)
        debug_event("room.settings.updated", room_token=token, playlist_name=room["playlist_name"])
        return jsonify(serialize_room(room, user["id"]))

    @app.post("/api/rooms/<token>/preview")
    def preview_room(token):
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        room = require_room(token)
        require_room_member(room, user["id"])
        require_room_host(room, user["id"])
        contributors = build_room_contributors(room)
        preview = build_room_blend_preview(contributors)
        preview["cover_art"] = build_generated_cover_art(
            room=room,
            playlist_name=room["playlist_name"],
            preview=preview,
            contributors=contributors,
        )
        debug_event(
            "room.preview.created",
            room_token=token,
            total_tracks=preview["summary"]["total_tracks"],
            total_contributors=preview["summary"]["total_contributors"],
        )
        return jsonify(preview)

    @app.post("/api/rooms/<token>/create")
    def create_room_blend(token):
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        room = require_room(token)
        require_room_member(room, user["id"])
        require_room_host(room, user["id"])

        contributors = build_room_contributors(room)
        preview = build_room_blend_preview(contributors)
        playlist = client.create_playlist(
            user_id=user["id"],
            name=room["playlist_name"],
            description="Generated by Sato.",
            is_public=False,
        )
        track_uris = [f"spotify:track:{track['id']}" for track in preview["tracks"]]
        client.add_tracks_to_playlist(playlist["id"], track_uris)

        final_playlist = {
            "id": playlist["id"],
            "name": playlist.get("name", room["playlist_name"]),
            "external_urls": playlist.get("external_urls", {}),
            "tracks_added": len(track_uris),
            "created_at": utc_now_iso(),
        }
        room["final_playlist"] = final_playlist
        room["wrapped"] = build_wrapped_artifact(
            room=room,
            playlist=final_playlist,
            preview=preview,
            contributors=contributors,
        )
        room["final_playlist"]["cover_art"] = room["wrapped"]["cover_art"]
        save_room(room)
        debug_event(
            "room.playlist.created",
            room_token=token,
            playlist_id=final_playlist["id"],
            tracks_added=final_playlist["tracks_added"],
        )
        return jsonify(
            {
                "playlist": final_playlist,
                "summary": preview["summary"],
                "wrapped": room["wrapped"],
            }
        )

    @app.get("/api/rooms/<token>/wrapped")
    def get_wrapped(token):
        client = require_spotify_session()
        user = fetch_or_get_cached_user(client)
        room = require_room(token)
        require_room_member(room, user["id"])
        if not room.get("wrapped"):
            raise ApiError(
                "Wrapped is not ready for this room yet.",
                status_code=404,
                code="wrapped_not_ready",
            )
        debug_event("room.wrapped.viewed", room_token=token, user_id=user["id"])
        return jsonify(room["wrapped"])

    @app.get("/api/debug/events")
    def debug_events():
        require_debug_mode()
        recorder = app.config.get("DEBUG_RECORDER")
        return jsonify((recorder.list_events() if recorder is not None else []))

    @app.post("/api/debug/events/clear")
    def clear_debug_events():
        require_debug_mode()
        recorder = app.config.get("DEBUG_RECORDER")
        if recorder is not None:
            recorder.clear()
        return jsonify({"ok": True})

    @app.post("/api/debug/e2e/reset")
    def e2e_reset():
        require_e2e_factory()
        room_store.clear()
        recorder = app.config.get("DEBUG_RECORDER")
        if recorder is not None:
            recorder.clear()
        app.config["SPOTIFY_CLIENT_FACTORY"].reset()
        session.clear()
        session.modified = True
        return jsonify({"ok": True})

    @app.post("/api/debug/e2e/session")
    def e2e_session():
        payload = parse_json_body()
        user_id = str(payload.get("user_id") or "host").strip() or "host"
        configure_credentials = payload.get("configure_credentials", True)
        user = seed_e2e_session(user_id, set_config=bool(configure_credentials))
        return jsonify(
            {
                "user": user,
                "configured": True,
            }
        )

    @app.get("/api/debug/e2e/login")
    def e2e_login():
        user_id = str(request.args.get("user_id") or "host").strip() or "host"
        room_token = str(request.args.get("room") or "").strip()
        seed_e2e_session(user_id, set_config=True)
        query = {"login": "success"}
        if room_token:
            query["room"] = room_token
        return client_redirect(query)

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
    e2e_mode = env_flag("SATO_E2E")
    server_host = os.getenv("HOST", "127.0.0.1")
    server_port = int(os.getenv("PORT") or os.getenv("SATO_BACKEND_PORT") or "5000")
    use_reloader = env_flag("SATO_USE_RELOADER", not e2e_mode)
    app.run(
        host=server_host,
        port=server_port,
        debug=not e2e_mode,
        use_reloader=use_reloader,
    )
