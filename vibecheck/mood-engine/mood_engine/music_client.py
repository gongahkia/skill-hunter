import logging
import os
from dataclasses import dataclass
from pathlib import Path

from mood_engine.exceptions import AuthError, SearchError

logger = logging.getLogger("mood_engine.music_client")

DEFAULT_AUTH_PATH = os.path.join(
    os.path.expanduser("~"), ".config", "mood-music", "headers_auth.json"
)


@dataclass
class Track:
    video_id: str
    title: str
    artist: str
    album: str
    duration_seconds: int
    thumbnail_url: str
    playback_url: str = ""

    def __post_init__(self) -> None:
        if not self.playback_url and self.video_id:
            self.playback_url = f"https://music.youtube.com/watch?v={self.video_id}"


class YTMusicClient:
    """Wrapper around ytmusicapi for YouTube Music search."""

    def __init__(self, auth_path: str = DEFAULT_AUTH_PATH) -> None:
        self._auth_path = auth_path
        self._client = None

    def _ensure_client(self) -> None:
        if self._client is not None:
            return

        try:
            from ytmusicapi import YTMusic

            if not Path(self._auth_path).exists():
                raise AuthError(
                    f"auth file not found: {self._auth_path}. "
                    "Run 'mood-music configure' to set up YouTube Music authentication."
                )

            self._client = YTMusic(self._auth_path)
        except AuthError:
            raise
        except Exception as e:
            raise AuthError(f"YouTube Music auth failed: {e}") from e

    def is_authenticated(self) -> bool:
        try:
            self._ensure_client()
            return True
        except AuthError:
            return False

    def setup(self) -> None:
        """Run interactive auth setup."""
        from ytmusicapi import YTMusic

        os.makedirs(os.path.dirname(self._auth_path), exist_ok=True)
        YTMusic.setup(filepath=self._auth_path)

    def search_tracks(self, query: str, limit: int = 20) -> list[Track]:
        """Search YouTube Music for tracks matching the query.

        Args:
            query: Search query string.
            limit: Maximum number of results.

        Returns:
            List of Track objects.

        Raises:
            SearchError: If search fails.
        """
        self._ensure_client()

        try:
            results = self._client.search(query, filter="songs", limit=limit)
        except Exception as e:
            raise SearchError(f"YouTube Music search failed for {query!r}: {e}") from e

        tracks = []
        for item in results:
            if not isinstance(item, dict):
                continue

            video_id = item.get("videoId", "")
            if not video_id:
                continue

            artists = item.get("artists", [])
            artist_name = artists[0]["name"] if artists else "Unknown"

            album_info = item.get("album")
            album_name = album_info.get("name", "") if album_info else ""

            duration_str = item.get("duration", "0:00")
            duration_seconds = _parse_duration(duration_str)

            thumbnails = item.get("thumbnails", [])
            thumb_url = thumbnails[-1]["url"] if thumbnails else ""

            tracks.append(Track(
                video_id=video_id,
                title=item.get("title", "Unknown"),
                artist=artist_name,
                album=album_name,
                duration_seconds=duration_seconds,
                thumbnail_url=thumb_url,
            ))

        return tracks

    def get_watch_playlist(self, video_id: str) -> list[Track]:
        """Get YouTube Music radio recommendations from a seed track.

        Args:
            video_id: Seed video ID.

        Returns:
            List of recommended Track objects.
        """
        self._ensure_client()

        try:
            playlist = self._client.get_watch_playlist(videoId=video_id)
        except Exception as e:
            raise SearchError(f"watch playlist failed for {video_id}: {e}") from e

        tracks = []
        for item in playlist.get("tracks", []):
            vid = item.get("videoId", "")
            if not vid:
                continue

            artists = item.get("artists", [])
            artist_name = artists[0]["name"] if artists else "Unknown"

            album_info = item.get("album")
            album_name = album_info.get("name", "") if album_info else ""

            thumb = item.get("thumbnail")
            thumbnails = thumb if isinstance(thumb, list) else (thumb or {}).get("thumbnails", [])
            thumb_url = thumbnails[-1]["url"] if thumbnails else ""

            length = item.get("length", "0:00")

            tracks.append(Track(
                video_id=vid,
                title=item.get("title", "Unknown"),
                artist=artist_name,
                album=album_name,
                duration_seconds=_parse_duration(length),
                thumbnail_url=thumb_url,
            ))

        return tracks

    def get_playback_url(self, video_id: str) -> str:
        return f"https://music.youtube.com/watch?v={video_id}"


def _parse_duration(duration_str: str) -> int:
    """Parse duration string like "3:45" or "1:02:30" to seconds."""
    if not duration_str:
        return 0
    parts = duration_str.split(":")
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        else:
            return int(parts[0])
    except ValueError:
        return 0
