"""Read vibecheck's SQLite mood history for cross-pollination with Sato."""
from __future__ import annotations
import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = Path("~/.local/share/mood-music/history.db").expanduser()

def get_mood_distribution(hours=24, db_path=None):
    """Return mood distribution from vibecheck history as {mood: percentage}."""
    p = Path(db_path) if db_path else DEFAULT_DB_PATH
    if not p.exists():
        return None
    try:
        conn = sqlite3.connect(str(p))
        cursor = conn.execute(
            "SELECT mood, COUNT(*) as cnt FROM mood_history "
            "WHERE timestamp >= datetime('now', ? || ' hours') "
            "GROUP BY mood ORDER BY cnt DESC",
            (f"-{hours}",),
        )
        rows = cursor.fetchall()
        conn.close()
        if not rows:
            return None
        total = sum(r[1] for r in rows)
        return {r[0]: round(r[1] / total * 100, 1) for r in rows}
    except Exception:
        return None

def get_dominant_mood(hours=24, db_path=None):
    """Return the most frequent mood from recent vibecheck history."""
    dist = get_mood_distribution(hours, db_path)
    if not dist:
        return None
    return max(dist, key=dist.get)

def get_mood_summary(hours=24, db_path=None):
    """Return full summary with distribution and dominant mood."""
    dist = get_mood_distribution(hours, db_path)
    if not dist:
        return {"available": False}
    return {
        "available": True,
        "hours": hours,
        "distribution": dist,
        "dominant_mood": max(dist, key=dist.get),
    }
