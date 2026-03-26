from __future__ import annotations
import json
import os
from pathlib import Path

SHARED_PROFILES_PATH = Path(__file__).resolve().parent.parent / "shared" / "mood_profiles.json"
VALID_MOODS = {"FOCUS", "STRESSED", "RELAXED", "TIRED", "ENERGIZED"}

def load_mood_profiles(path=None):
    p = Path(path) if path else SHARED_PROFILES_PATH
    if not p.exists():
        return {}
    with open(p) as f:
        data = json.load(f)
    return data.get("moods", {})

def get_mood_tracks(client, mood_state, profiles=None, limit=50):
    """Fetch mood-appropriate tracks via Spotify recommendations API."""
    if mood_state not in VALID_MOODS:
        return []
    profiles = profiles or load_mood_profiles()
    profile = profiles.get(mood_state)
    if not profile:
        return []
    af = profile.get("audio_features", {})
    top_tracks = client.get_current_user_top_tracks(limit=5)
    top_artists = client.get_current_user_top_artists(limit=5)
    seed_tracks = [t["id"] for t in top_tracks[:2] if t.get("id")]
    seed_artists = [a["id"] for a in top_artists[:2] if a.get("id")]
    seed_genres = profile.get("seed_genres", [])[:1] # max 5 seeds total
    rec_params = {}
    for feat, bounds in af.items():
        if isinstance(bounds, list) and len(bounds) == 2:
            mid = (bounds[0] + bounds[1]) / 2
            rec_params[f"target_{feat}"] = mid
            rec_params[f"min_{feat}"] = bounds[0]
            rec_params[f"max_{feat}"] = bounds[1]
    tracks = client.get_recommendations(
        seed_tracks=seed_tracks,
        seed_artists=seed_artists,
        seed_genres=seed_genres,
        **rec_params,
    )
    return tracks[:limit]
