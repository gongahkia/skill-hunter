from urllib.parse import parse_qs, urlparse

import pytest

from app import create_app
from spotify_client import SpotifyAPIError


def make_track(track_id, name, artist, image="https://images.test/cover.png", is_local=False):
    return {
        "id": track_id,
        "name": name,
        "is_local": is_local,
        "artists": [{"name": artist}],
        "album": {"images": [{"url": image}]},
    }


class FakeSpotifyService:
    def __init__(self):
        self.bound_credentials = None
        self.current_user = {
            "id": "me",
            "display_name": "Sato Tester",
            "email": "tester@example.com",
            "country": "SG",
            "product": "premium",
            "followers": {"total": 12},
            "images": [{"url": "https://images.test/me.png"}],
        }
        self.users = {
            "alpha": {
                "id": "alpha",
                "display_name": "Alpha",
                "followers": {"total": 7},
                "images": [{"url": "https://images.test/alpha.png"}],
            },
            "beta": {
                "id": "beta",
                "display_name": "Beta",
                "followers": {"total": 3},
                "images": [],
            },
        }
        self.user_playlists = {
            "alpha": [
                {
                    "id": "alpha-public",
                    "name": "Alpha Public",
                    "public": True,
                    "tracks": {"total": 2},
                },
                {
                    "id": "alpha-private",
                    "name": "Alpha Private",
                    "public": False,
                    "tracks": {"total": 8},
                },
            ],
            "beta": [],
        }
        self.top_tracks = [
            make_track("shared-track", "Shared Track", "Shared Artist"),
            make_track("self-track", "Self Track", "Self Artist"),
        ]
        self.playlist_tracks = {
            "alpha-public": [
                {"track": make_track("shared-track", "Shared Track", "Shared Artist")},
                {"track": make_track("friend-track", "Friend Track", "Friend Artist")},
                {"track": make_track("friend-track", "Friend Track", "Friend Artist")},
                {"track": {"id": None, "is_local": False}},
                {"track": make_track("local-track", "Local Track", "Local Artist", is_local=True)},
            ]
        }
        self.created_playlists = []
        self.added_tracks = []
        self.exchanged_codes = []

    def bind(self, **kwargs):
        self.bound_credentials = {
            "client_id": kwargs.get("client_id"),
            "client_secret": kwargs.get("client_secret"),
            "redirect_uri": kwargs.get("redirect_uri"),
        }
        self.access_token = kwargs.get("access_token")
        self.refresh_token = kwargs.get("refresh_token")
        self.expires_at = kwargs.get("expires_at")
        self.token_updater = kwargs.get("token_updater")
        return self

    def authorization_url(self, state):
        return f"https://accounts.spotify.com/authorize?state={state}"

    def exchange_code(self, code):
        self.exchanged_codes.append(code)
        return {
            "access_token": "fresh-access-token",
            "refresh_token": "fresh-refresh-token",
            "expires_at": 9999999999,
        }

    def get_current_user(self):
        return self.current_user

    def get_user(self, user_id):
        if user_id == "missing":
            raise SpotifyAPIError("Missing", status_code=404)
        return self.users[user_id]

    def get_user_playlists(self, user_id):
        return self.user_playlists[user_id]

    def get_current_user_top_tracks(self, limit=50):
        return self.top_tracks

    def get_playlist_tracks(self, playlist_id):
        return self.playlist_tracks[playlist_id]

    def create_playlist(self, user_id, name, description, is_public=False):
        playlist = {
            "id": "playlist-123",
            "name": name,
            "external_urls": {"spotify": "https://open.spotify.com/playlist/playlist-123"},
        }
        self.created_playlists.append(
            {
                "user_id": user_id,
                "name": name,
                "description": description,
                "is_public": is_public,
            }
        )
        return playlist

    def add_tracks_to_playlist(self, playlist_id, track_uris):
        self.added_tracks.append({"playlist_id": playlist_id, "track_uris": track_uris})
        return {"snapshot_id": "snapshot"}


@pytest.fixture
def fake_spotify():
    return FakeSpotifyService()


@pytest.fixture
def client(fake_spotify):
    app = create_app(
        {
            "TESTING": True,
            "CLIENT_APP_URL": "http://localhost:5173",
        }
    )
    app.config["SPOTIFY_CLIENT_FACTORY"] = lambda **kwargs: fake_spotify.bind(**kwargs)

    with app.test_client() as test_client:
        yield test_client


def authenticate(client):
    with client.session_transaction() as flask_session:
        flask_session["spotify_tokens"] = {
            "access_token": "token",
            "refresh_token": "refresh",
            "expires_at": 9999999999,
        }
        flask_session["spotify_user"] = {
            "id": "me",
            "display_name": "Sato Tester",
        }


def test_callback_rejects_mismatched_state(client, fake_spotify):
    with client.session_transaction() as flask_session:
        flask_session["oauth_state"] = "expected-state"

    response = client.get("/api/auth/callback?code=abc&state=wrong-state")
    assert response.status_code == 302
    location = urlparse(response.headers["Location"])
    query = parse_qs(location.query)

    assert query["login"] == ["error"]
    assert query["reason"] == ["invalid_state"]
    assert fake_spotify.exchanged_codes == []


def test_spotify_config_can_be_set_from_the_web_app_and_used_for_login(client, fake_spotify):
    config_response = client.post(
        "/api/auth/spotify-config",
        json={
            "client_id": "browser-client-id",
            "client_secret": "browser-client-secret",
        },
    )

    assert config_response.status_code == 200
    assert config_response.get_json() == {
        "configured": True,
        "client_id": "browser-client-id",
        "redirect_uri": "http://127.0.0.1:5000/api/auth/callback",
        "source": "session",
    }

    status_response = client.get("/api/auth/spotify-config")
    assert status_response.status_code == 200
    assert status_response.get_json() == {
        "configured": True,
        "client_id": "browser-client-id",
        "redirect_uri": "http://127.0.0.1:5000/api/auth/callback",
        "source": "session",
    }

    response = client.get("/api/auth/login")
    assert response.status_code == 302
    assert response.headers["Location"].startswith("https://accounts.spotify.com/authorize?state=")
    assert fake_spotify.bound_credentials == {
        "client_id": "browser-client-id",
        "client_secret": "browser-client-secret",
        "redirect_uri": "http://127.0.0.1:5000/api/auth/callback",
    }


def test_spotify_config_validation_requires_both_fields(client):
    response = client.post(
        "/api/auth/spotify-config",
        json={
            "client_id": "browser-client-id",
            "client_secret": "",
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "spotify_config_invalid"


def test_logout_clears_session(client):
    authenticate(client)

    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    assert response.get_json() == {"ok": True}

    with client.session_transaction() as flask_session:
        assert dict(flask_session) == {}


def test_logout_preserves_browser_supplied_spotify_config(client):
    client.post(
        "/api/auth/spotify-config",
        json={
            "client_id": "browser-client-id",
            "client_secret": "browser-client-secret",
        },
    )
    authenticate(client)

    response = client.post("/api/auth/logout")
    assert response.status_code == 200

    with client.session_transaction() as flask_session:
        assert dict(flask_session) == {
            "spotify_config": {
                "client_id": "browser-client-id",
                "client_secret": "browser-client-secret",
            }
        }


def test_resolve_friends_returns_partial_success_and_keeps_empty_playlist_users(client):
    authenticate(client)

    response = client.post(
        "/api/friends/resolve",
        json={
            "urls": [
                "https://open.spotify.com/user/alpha",
                "not-a-spotify-url",
                "https://open.spotify.com/user/missing",
                "spotify:user:beta",
            ]
        },
    )

    assert response.status_code == 200
    payload = response.get_json()

    assert payload["invalid_urls"] == ["not-a-spotify-url"]
    assert payload["unresolved_users"] == ["missing"]
    assert [friend["id"] for friend in payload["friends"]] == ["alpha", "beta"]
    assert payload["friends"][0]["playlists"] == [
        {
            "id": "alpha-public",
            "name": "Alpha Public",
            "track_count": 2,
        }
    ]
    assert payload["friends"][1]["playlist_count"] == 0


def test_preview_and_create_share_ranked_tracks_and_skip_duplicate_or_invalid_tracks(client, fake_spotify):
    authenticate(client)

    request_body = {
        "self_weight": 60,
        "friends": [
            {
                "id": "alpha",
                "weight": 40,
                "playlist_ids": ["alpha-public"],
            }
        ],
        "name": "Friends In Orbit",
    }

    preview_response = client.post("/api/blends/preview", json=request_body)
    assert preview_response.status_code == 200
    preview_payload = preview_response.get_json()

    assert [track["id"] for track in preview_payload["tracks"]] == [
        "shared-track",
        "self-track",
        "friend-track",
    ]
    assert preview_payload["summary"]["total_tracks"] == 3
    assert preview_payload["tracks"][0]["contributors"] == [
        {
            "source_id": "self",
            "source_name": "Sato Tester",
            "weight": 60.0,
        },
        {
            "source_id": "alpha",
            "source_name": "Alpha",
            "weight": 40.0,
        },
    ]

    create_response = client.post("/api/blends", json=request_body)
    assert create_response.status_code == 200
    create_payload = create_response.get_json()

    assert create_payload["name"] == "Friends In Orbit"
    assert create_payload["tracks_added"] == 3
    assert fake_spotify.added_tracks[-1]["track_uris"] == [
        "spotify:track:shared-track",
        "spotify:track:self-track",
        "spotify:track:friend-track",
    ]


def test_preview_rejects_weight_totals_that_do_not_equal_one_hundred(client):
    authenticate(client)

    response = client.post(
        "/api/blends/preview",
        json={
            "self_weight": 50,
            "friends": [
                {
                    "id": "alpha",
                    "weight": 20,
                    "playlist_ids": ["alpha-public"],
                }
            ],
        },
    )

    assert response.status_code == 400
    payload = response.get_json()
    assert payload["error"]["code"] == "validation_error"
    assert payload["error"]["details"]["weight_total"] == 70.0
