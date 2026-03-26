"""Tests for YouTube Music client with mocked responses."""

from unittest.mock import MagicMock, patch

import pytest

from mood_engine.exceptions import AuthError, SearchError
from mood_engine.music_client import Track, YTMusicClient, _parse_duration


class TestParseDuration:
    def test_mm_ss(self):
        assert _parse_duration("3:45") == 225

    def test_hh_mm_ss(self):
        assert _parse_duration("1:02:30") == 3750

    def test_empty(self):
        assert _parse_duration("") == 0

    def test_invalid(self):
        assert _parse_duration("abc") == 0


class TestTrack:
    def test_playback_url_auto_generated(self):
        t = Track(
            video_id="abc123",
            title="Test",
            artist="Artist",
            album="Album",
            duration_seconds=180,
            thumbnail_url="",
        )
        assert t.playback_url == "https://music.youtube.com/watch?v=abc123"


CANNED_SEARCH_RESPONSE = [
    {
        "videoId": "jfKfPfyJRdk",
        "title": "lofi hip hop radio",
        "artists": [{"name": "Lofi Girl", "id": "abc"}],
        "album": {"name": "Chill Beats", "id": "xyz"},
        "duration": "3:45",
        "thumbnails": [
            {"url": "https://example.com/thumb_small.jpg", "width": 60},
            {"url": "https://example.com/thumb_large.jpg", "width": 226},
        ],
    },
    {
        "videoId": "def456",
        "title": "study music",
        "artists": [{"name": "Study Beats", "id": "ghi"}],
        "album": None,
        "duration": "4:20",
        "thumbnails": [],
    },
]

CANNED_WATCH_RESPONSE = {
    "tracks": [
        {
            "videoId": "related1",
            "title": "Related Track 1",
            "artists": [{"name": "Artist 1"}],
            "album": {"name": "Album 1"},
            "length": "3:00",
            "thumbnail": {"thumbnails": [{"url": "https://example.com/t1.jpg"}]},
        },
    ]
}


class TestYTMusicClient:
    @patch("mood_engine.music_client.Path")
    @patch("mood_engine.music_client.YTMusicClient._ensure_client")
    def test_search_tracks(self, mock_ensure, mock_path):
        client = YTMusicClient("/tmp/fake_auth.json")
        client._client = MagicMock()
        client._client.search.return_value = CANNED_SEARCH_RESPONSE

        tracks = client.search_tracks("lofi beats", limit=10)

        assert len(tracks) == 2
        assert tracks[0].video_id == "jfKfPfyJRdk"
        assert tracks[0].title == "lofi hip hop radio"
        assert tracks[0].artist == "Lofi Girl"
        assert tracks[0].album == "Chill Beats"
        assert tracks[0].duration_seconds == 225
        assert "thumb_large" in tracks[0].thumbnail_url
        assert "music.youtube.com" in tracks[0].playback_url

        assert tracks[1].video_id == "def456"
        assert tracks[1].album == ""
        assert tracks[1].thumbnail_url == ""

    @patch("mood_engine.music_client.Path")
    @patch("mood_engine.music_client.YTMusicClient._ensure_client")
    def test_get_watch_playlist(self, mock_ensure, mock_path):
        client = YTMusicClient("/tmp/fake_auth.json")
        client._client = MagicMock()
        client._client.get_watch_playlist.return_value = CANNED_WATCH_RESPONSE

        tracks = client.get_watch_playlist("abc123")

        assert len(tracks) == 1
        assert tracks[0].video_id == "related1"
        assert tracks[0].title == "Related Track 1"
        assert tracks[0].duration_seconds == 180

    def test_auth_failure_no_file(self):
        client = YTMusicClient("/tmp/nonexistent_auth_mood_music_test.json")
        assert client.is_authenticated() is False

    @patch("mood_engine.music_client.Path")
    @patch("mood_engine.music_client.YTMusicClient._ensure_client")
    def test_search_failure(self, mock_ensure, mock_path):
        client = YTMusicClient("/tmp/fake_auth.json")
        client._client = MagicMock()
        client._client.search.side_effect = Exception("network error")

        with pytest.raises(SearchError, match="search failed"):
            client.search_tracks("test query")

    def test_get_playback_url(self):
        client = YTMusicClient("/tmp/fake_auth.json")
        url = client.get_playback_url("abc123")
        assert url == "https://music.youtube.com/watch?v=abc123"
