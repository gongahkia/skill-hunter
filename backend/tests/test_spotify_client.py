import time

import pytest

from spotify_client import SpotifyAPIError, SpotifyClient


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self.payload = payload
        self.content = b"" if payload is None else b"payload"

    def json(self):
        return self.payload


class FakeHTTPSession:
    def __init__(self, request_responses, token_responses):
        self.request_responses = request_responses
        self.token_responses = token_responses
        self.request_calls = []
        self.post_calls = []

    def request(self, method, url, **kwargs):
        self.request_calls.append({"method": method, "url": url, **kwargs})
        return self.request_responses.pop(0)

    def post(self, url, **kwargs):
        self.post_calls.append({"url": url, **kwargs})
        return self.token_responses.pop(0)


def test_expired_access_tokens_refresh_once_before_retrying():
    updates = []
    http_session = FakeHTTPSession(
        request_responses=[
            FakeResponse(401, {"error": {"message": "expired"}}),
            FakeResponse(200, {"id": "me"}),
        ],
        token_responses=[
            FakeResponse(
                200,
                {
                    "access_token": "fresh-token",
                    "refresh_token": "refresh-token",
                    "expires_in": 3600,
                },
            )
        ],
    )

    client = SpotifyClient(
        client_id="client-id",
        client_secret="client-secret",
        redirect_uri="http://localhost:5000/api/auth/callback",
        access_token="expired-token",
        refresh_token="refresh-token",
        expires_at=time.time() + 3600,
        token_updater=updates.append,
        http_session=http_session,
    )

    payload = client.get_current_user()

    assert payload == {"id": "me"}
    assert len(http_session.post_calls) == 1
    assert len(http_session.request_calls) == 2
    assert http_session.request_calls[0]["headers"]["Authorization"] == "Bearer expired-token"
    assert http_session.request_calls[1]["headers"]["Authorization"] == "Bearer fresh-token"
    assert updates[-1]["access_token"] == "fresh-token"


def test_playlist_pagination_collects_all_items():
    http_session = FakeHTTPSession(
        request_responses=[
            FakeResponse(
                200,
                {
                    "items": [{"id": "first"}],
                    "next": "https://api.spotify.com/v1/me/playlists?offset=50",
                },
            ),
            FakeResponse(
                200,
                {
                    "items": [{"id": "second"}],
                    "next": None,
                },
            ),
        ],
        token_responses=[],
    )

    client = SpotifyClient(
        client_id="client-id",
        client_secret="client-secret",
        redirect_uri="http://localhost:5000/api/auth/callback",
        access_token="token",
        refresh_token="refresh-token",
        expires_at=time.time() + 3600,
        http_session=http_session,
    )

    items = client.get_current_user_playlists()

    assert items == [{"id": "first"}, {"id": "second"}]
    assert http_session.request_calls[0]["url"].endswith("/me/playlists?limit=50")
    assert http_session.request_calls[1]["url"].endswith("offset=50")


def test_verify_client_credentials_uses_client_credentials_grant_without_mutating_login_state():
    http_session = FakeHTTPSession(
        request_responses=[],
        token_responses=[
            FakeResponse(
                200,
                {
                    "access_token": "app-token",
                    "token_type": "Bearer",
                    "expires_in": 3600,
                },
            )
        ],
    )

    client = SpotifyClient(
        client_id="client-id",
        client_secret="client-secret",
        redirect_uri="http://localhost:5000/api/auth/callback",
        access_token="existing-token",
        refresh_token="refresh-token",
        expires_at=1234567890,
        http_session=http_session,
    )

    payload = client.verify_client_credentials()

    assert payload["access_token"] == "app-token"
    assert http_session.post_calls[0]["data"] == {
        "grant_type": "client_credentials",
        "client_id": "client-id",
        "client_secret": "client-secret",
    }
    assert client.access_token == "existing-token"
    assert client.refresh_token == "refresh-token"
    assert client.expires_at == 1234567890


def test_verify_client_credentials_raises_on_invalid_client():
    http_session = FakeHTTPSession(
        request_responses=[],
        token_responses=[
            FakeResponse(
                400,
                {
                    "error": "invalid_client",
                    "error_description": "Invalid client",
                },
            )
        ],
    )

    client = SpotifyClient(
        client_id="bad-client-id",
        client_secret="client-secret",
        redirect_uri="http://localhost:5000/api/auth/callback",
        http_session=http_session,
    )

    with pytest.raises(SpotifyAPIError) as error:
        client.verify_client_credentials()

    assert error.value.status_code == 400
    assert error.value.payload["error"] == "invalid_client"


def test_saved_track_totals_use_a_single_metadata_request_and_respect_the_cap():
    http_session = FakeHTTPSession(
        request_responses=[
            FakeResponse(
                200,
                {
                    "items": [{"track": {"id": "first"}}],
                    "total": 999,
                },
            ),
        ],
        token_responses=[],
    )

    client = SpotifyClient(
        client_id="client-id",
        client_secret="client-secret",
        redirect_uri="http://localhost:5000/api/auth/callback",
        access_token="token",
        refresh_token="refresh-token",
        expires_at=time.time() + 3600,
        http_session=http_session,
    )

    total = client.get_saved_tracks_total(limit_cap=500)

    assert total == 500
    assert http_session.request_calls[0]["url"].endswith("/me/tracks?limit=1")


def test_add_tracks_to_playlist_batches_requests_in_chunks_of_one_hundred():
    http_session = FakeHTTPSession(
        request_responses=[
            FakeResponse(201, {"snapshot_id": "first"}),
            FakeResponse(201, {"snapshot_id": "second"}),
            FakeResponse(201, {"snapshot_id": "third"}),
        ],
        token_responses=[],
    )

    client = SpotifyClient(
        client_id="client-id",
        client_secret="client-secret",
        redirect_uri="http://localhost:5000/api/auth/callback",
        access_token="token",
        refresh_token="refresh-token",
        expires_at=time.time() + 3600,
        http_session=http_session,
    )

    track_uris = [f"spotify:track:{index}" for index in range(205)]
    payload = client.add_tracks_to_playlist("playlist-123", track_uris)

    assert payload == {"snapshot_id": "snapshot"}
    assert len(http_session.request_calls) == 3
    assert http_session.request_calls[0]["url"].endswith("/playlists/playlist-123/tracks")
    assert len(http_session.request_calls[0]["json"]["uris"]) == 100
    assert len(http_session.request_calls[1]["json"]["uris"]) == 100
    assert len(http_session.request_calls[2]["json"]["uris"]) == 5
