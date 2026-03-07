import time

from spotify_client import SpotifyClient


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
                    "next": "https://api.spotify.com/v1/users/alpha/playlists?offset=50",
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

    items = client.get_user_playlists("alpha")

    assert items == [{"id": "first"}, {"id": "second"}]
    assert http_session.request_calls[0]["url"].endswith("/users/alpha/playlists?limit=50")
    assert http_session.request_calls[1]["url"].endswith("offset=50")
