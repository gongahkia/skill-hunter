"""IPC handlers for Spotify search/play/control operations."""
from __future__ import annotations
import logging
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "shared"))

logger = logging.getLogger("mood_engine.spotify")
_client = None

def _get_client():
    global _client
    if _client is not None:
        return _client
    try:
        from spotify_client import SpotifyDesktopClient
        client_id = os.environ.get("SPOTIFY_CLIENT_ID", "")
        if not client_id:
            logger.warning("SPOTIFY_CLIENT_ID not set, spotify features disabled")
            return None
        _client = SpotifyDesktopClient(client_id)
        if not _client.authenticated:
            logger.warning("spotify not authenticated, run authorize first")
            return None
        return _client
    except Exception as e:
        logger.error("failed to init spotify client: %s", e)
        return None

def handle_spotify_search(msg):
    client = _get_client()
    if not client:
        return {"type": "spotify_search_result", "id": msg["id"], "version": 1, "tracks": []}
    query = msg.get("query", "")
    limit = msg.get("limit", 10)
    try:
        items = client.search_tracks(query, limit)
        tracks = []
        for t in items:
            artists = [a["name"] for a in t.get("artists", []) if a.get("name")]
            album = t.get("album", {})
            images = album.get("images", [])
            tracks.append({
                "id": t.get("id", ""),
                "name": t.get("name", ""),
                "artist": ", ".join(artists),
                "album": album.get("name", ""),
                "duration_ms": t.get("duration_ms", 0),
                "uri": t.get("uri", ""),
                "image_url": images[0]["url"] if images else "",
            })
        return {"type": "spotify_search_result", "id": msg["id"], "version": 1, "tracks": tracks}
    except Exception as e:
        logger.error("spotify search failed: %s", e)
        return {"type": "spotify_search_result", "id": msg["id"], "version": 1, "tracks": []}

def handle_spotify_play(msg):
    client = _get_client()
    if not client:
        return {"type": "spotify_play_result", "id": msg["id"], "version": 1, "playing": False}
    uri = msg.get("track_uri", "")
    try:
        client.start_playback(uri)
        return {"type": "spotify_play_result", "id": msg["id"], "version": 1, "playing": True}
    except Exception as e:
        logger.error("spotify play failed: %s", e)
        return {"type": "spotify_play_result", "id": msg["id"], "version": 1, "playing": False}

def handle_spotify_pause(msg):
    client = _get_client()
    ok = False
    if client:
        try:
            client.pause_playback()
            ok = True
        except Exception as e:
            logger.error("spotify pause failed: %s", e)
    return {"type": "spotify_control_result", "id": msg["id"], "version": 1, "ok": ok}

def handle_spotify_resume(msg):
    client = _get_client()
    ok = False
    if client:
        try:
            client.resume_playback()
            ok = True
        except Exception as e:
            logger.error("spotify resume failed: %s", e)
    return {"type": "spotify_control_result", "id": msg["id"], "version": 1, "ok": ok}

def handle_spotify_state(msg):
    client = _get_client()
    empty = {"type": "spotify_state_result", "id": msg["id"], "version": 1,
             "title": "", "artist": "", "position_ms": 0, "duration_ms": 0,
             "paused": True, "playing": False}
    if not client:
        return empty
    try:
        state = client.get_playback_state()
        if not state or not state.get("item"):
            return empty
        item = state["item"]
        artists = [a["name"] for a in item.get("artists", []) if a.get("name")]
        return {"type": "spotify_state_result", "id": msg["id"], "version": 1,
                "title": item.get("name", ""),
                "artist": ", ".join(artists),
                "position_ms": state.get("progress_ms", 0),
                "duration_ms": item.get("duration_ms", 0),
                "paused": not state.get("is_playing", False),
                "playing": state.get("is_playing", False)}
    except Exception as e:
        logger.error("spotify state failed: %s", e)
        return empty
