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


def playlist_item(
    playlist_id,
    name,
    owner_id,
    *,
    collaborative=False,
    total=2,
    owner_name=None,
):
    return {
        "id": playlist_id,
        "name": name,
        "collaborative": collaborative,
        "owner": {
            "id": owner_id,
            "display_name": owner_name or owner_id.title(),
        },
        "tracks": {"total": total},
    }


class FakeSpotifyService:
    def __init__(self):
        self.bound_credentials = None
        self.verified_credentials = []
        self.current_user = None
        self.users = {
            "host": {
                "id": "host",
                "display_name": "Host User",
                "email": "host@example.com",
                "country": "SG",
                "product": "premium",
                "followers": {"total": 12},
                "images": [{"url": "https://images.test/host.png"}],
            },
            "guest": {
                "id": "guest",
                "display_name": "Guest User",
                "email": "guest@example.com",
                "country": "SG",
                "product": "premium",
                "followers": {"total": 4},
                "images": [{"url": "https://images.test/guest.png"}],
            },
            "ally": {
                "id": "ally",
                "display_name": "Ally User",
                "email": "ally@example.com",
                "country": "SG",
                "product": "premium",
                "followers": {"total": 7},
                "images": [{"url": "https://images.test/ally.png"}],
            },
        }
        self.top_tracks = {
            "host": [
                make_track("shared-track", "Shared Track", "Shared Artist"),
                make_track("host-top", "Host Top", "Host Artist"),
            ],
            "guest": [
                make_track("shared-track", "Shared Track", "Shared Artist"),
                make_track("guest-top", "Guest Top", "Guest Artist"),
            ],
        }
        self.saved_tracks = {
            "host": [
                {"track": make_track("host-saved", "Host Saved", "Host Artist")},
            ],
            "guest": [
                {"track": make_track("guest-saved", "Guest Saved", "Guest Artist")},
            ],
        }
        self.recent_tracks = {
            "host": [
                {"track": make_track("host-recent", "Host Recent", "Host Artist")},
            ],
            "guest": [
                {"track": make_track("guest-recent", "Guest Recent", "Guest Artist")},
            ],
        }
        self.current_user_playlists = {
            "host": [
                playlist_item("host-owned", "Host Owned", "host", total=2),
                playlist_item("shared-collab", "Shared Collab", "guest", collaborative=True, total=2),
                playlist_item("followed-public", "Followed Public", "someone-else", total=2),
            ],
            "guest": [
                playlist_item("guest-owned", "Guest Owned", "guest", total=2),
                playlist_item("shared-collab", "Shared Collab", "guest", collaborative=True, total=2),
            ],
        }
        self.playlist_tracks = {
            "host-owned": [
                {"track": make_track("host-playlist", "Host Playlist Track", "Host Artist")},
                {"track": make_track("shared-track", "Shared Track", "Shared Artist")},
            ],
            "guest-owned": [
                {"track": make_track("guest-playlist", "Guest Playlist Track", "Guest Artist")},
                {"track": make_track("shared-track", "Shared Track", "Shared Artist")},
            ],
            "shared-collab": [
                {"track": make_track("collab-track", "Collab Track", "Shared Artist")},
                {"track": make_track("shared-track", "Shared Track", "Shared Artist")},
            ],
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
        self.client_id = kwargs.get("client_id")
        self.client_secret = kwargs.get("client_secret")
        self.redirect_uri = kwargs.get("redirect_uri")
        self.access_token = kwargs.get("access_token")
        self.refresh_token = kwargs.get("refresh_token")
        self.expires_at = kwargs.get("expires_at")
        self.token_updater = kwargs.get("token_updater")
        return self

    def authorization_url(self, state):
        return f"https://accounts.spotify.com/authorize?state={state}"

    def verify_client_credentials(self):
        self.verified_credentials.append(
            {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }
        )
        if self.client_id == "bad-client-id":
            raise SpotifyAPIError(
                "Spotify rejected the supplied client credentials.",
                status_code=400,
                payload={
                    "error": "invalid_client",
                    "error_description": "Invalid client",
                },
            )
        return {"access_token": "app-token", "token_type": "Bearer"}

    def exchange_code(self, code):
        self.exchanged_codes.append(code)
        return {
            "access_token": "fresh-access-token",
            "refresh_token": "fresh-refresh-token",
            "expires_at": 9999999999,
        }

    def get_current_user(self):
        return self.current_user

    def get_current_user_top_tracks(self, limit=50):
        return self.top_tracks[self.current_user["id"]][:limit]

    def get_saved_tracks(self, limit=500):
        return self.saved_tracks[self.current_user["id"]][:limit]

    def get_saved_tracks_total(self, limit_cap=500):
        return min(len(self.saved_tracks[self.current_user["id"]]), limit_cap)

    def get_recently_played(self, limit=50):
        return self.recent_tracks[self.current_user["id"]][:limit]

    def get_current_user_playlists(self, limit=200):
        return self.current_user_playlists[self.current_user["id"]][:limit]

    def get_playlist_tracks(self, playlist_id, limit=500):
        return self.playlist_tracks[playlist_id][:limit]

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

    def get_user(self, user_id):  # pragma: no cover - guardrail
        raise AssertionError("Removed public user endpoint should not be called.")

    def get_user_playlists(self, user_id):  # pragma: no cover - guardrail
        raise AssertionError("Removed public user playlist endpoint should not be called.")


@pytest.fixture
def fake_spotify():
    service = FakeSpotifyService()
    service.current_user = service.users["host"]
    return service


@pytest.fixture
def client(fake_spotify):
    app = create_app(
        {
            "TESTING": True,
            "CLIENT_APP_URL": "http://localhost:5173",
            "SPOTIFY_CLIENT_ID": "server-client-id",
            "SPOTIFY_CLIENT_SECRET": "server-client-secret",
        }
    )
    app.config["SPOTIFY_CLIENT_FACTORY"] = lambda **kwargs: fake_spotify.bind(**kwargs)

    with app.test_client() as test_client:
        yield test_client


def authenticate(client, fake_spotify, user_id="host"):
    fake_spotify.current_user = fake_spotify.users[user_id]
    with client.session_transaction() as flask_session:
        flask_session["spotify_tokens"] = {
            "access_token": f"{user_id}-token",
            "refresh_token": f"{user_id}-refresh",
            "expires_at": 9999999999,
        }
        flask_session["spotify_user"] = fake_spotify.users[user_id]


def test_spotify_config_can_be_set_from_the_web_app_and_used_for_login(client, fake_spotify):
    config_response = client.post(
        "/api/auth/spotify-config",
        json={
            "client_id": "browser-client-id",
            "client_secret": "browser-client-secret",
        },
    )

    assert config_response.status_code == 200
    assert config_response.get_json()["configured"] is True

    response = client.get("/api/auth/login")
    assert response.status_code == 302
    assert response.headers["Location"].startswith("https://accounts.spotify.com/authorize?state=")
    assert fake_spotify.bound_credentials == {
        "client_id": "browser-client-id",
        "client_secret": "browser-client-secret",
        "redirect_uri": "http://127.0.0.1:5000/api/auth/callback",
    }


def test_source_catalog_filters_to_owned_or_collaborative_playlists(client, fake_spotify):
    authenticate(client, fake_spotify, "host")

    response = client.get("/api/me/source-catalog")
    assert response.status_code == 200
    payload = response.get_json()

    assert payload["top_tracks"]["count"] == 2
    assert [playlist["id"] for playlist in payload["playlists"]] == ["host-owned", "shared-collab"]


def test_create_join_and_leave_room_flow(client, fake_spotify):
    authenticate(client, fake_spotify, "host")
    room_response = client.post("/api/rooms")
    assert room_response.status_code == 200
    room = room_response.get_json()
    token = room["token"]
    assert room["role"] == "host"
    assert room["members"][0]["id"] == "host"

    authenticate(client, fake_spotify, "guest")
    join_response = client.post(f"/api/rooms/{token}/join")
    assert join_response.status_code == 200
    join_room = join_response.get_json()
    assert sorted(member["id"] for member in join_room["members"]) == ["guest", "host"]

    leave_response = client.post(f"/api/rooms/{token}/leave")
    assert leave_response.status_code == 200


def test_saving_contributions_rebalances_weights_and_dedupes_tracks(client, fake_spotify):
    authenticate(client, fake_spotify, "host")
    token = client.post("/api/rooms").get_json()["token"]

    host_contribution = client.put(
        f"/api/rooms/{token}/contribution",
        json={
            "use_top_tracks": True,
            "use_saved_tracks": True,
            "use_recent_tracks": False,
            "playlist_ids": ["host-owned"],
        },
    )
    assert host_contribution.status_code == 200
    host_room = host_contribution.get_json()["room"]
    assert host_room["members"][0]["track_count"] == 4
    assert host_room["members"][0]["weight"] == 100

    authenticate(client, fake_spotify, "guest")
    client.post(f"/api/rooms/{token}/join")
    guest_contribution = client.put(
        f"/api/rooms/{token}/contribution",
        json={
            "use_top_tracks": True,
            "use_saved_tracks": False,
            "use_recent_tracks": True,
            "playlist_ids": ["guest-owned"],
        },
    )
    assert guest_contribution.status_code == 200
    guest_room = guest_contribution.get_json()["room"]

    weights = {member["id"]: member["weight"] for member in guest_room["members"]}
    assert weights == {"host": 50, "guest": 50}


def test_host_can_preview_create_and_fetch_wrapped(client, fake_spotify):
    authenticate(client, fake_spotify, "host")
    token = client.post("/api/rooms").get_json()["token"]
    client.put(
        f"/api/rooms/{token}/contribution",
        json={
            "use_top_tracks": True,
            "use_saved_tracks": True,
            "use_recent_tracks": False,
            "playlist_ids": ["host-owned"],
        },
    )

    authenticate(client, fake_spotify, "guest")
    client.post(f"/api/rooms/{token}/join")
    client.put(
        f"/api/rooms/{token}/contribution",
        json={
            "use_top_tracks": True,
            "use_saved_tracks": False,
            "use_recent_tracks": True,
            "playlist_ids": ["guest-owned"],
        },
    )

    authenticate(client, fake_spotify, "host")
    weights_response = client.patch(
        f"/api/rooms/{token}/weights",
        json={
            "members": [
                {"id": "host", "weight": 60},
                {"id": "guest", "weight": 40},
            ]
        },
    )
    assert weights_response.status_code == 200

    preview_response = client.post(f"/api/rooms/{token}/preview")
    assert preview_response.status_code == 200
    preview_payload = preview_response.get_json()
    assert [track["id"] for track in preview_payload["tracks"]] == [
        "shared-track",
        "host-playlist",
        "host-saved",
        "host-top",
        "guest-playlist",
        "guest-recent",
        "guest-top",
    ][: len(preview_payload["tracks"])]

    create_response = client.post(f"/api/rooms/{token}/create")
    assert create_response.status_code == 200
    create_payload = create_response.get_json()
    assert create_payload["playlist"]["name"] == "Host User's Sato Blend"
    assert create_payload["wrapped"]["cards"][0]["type"] == "cover"
    assert create_payload["wrapped"]["cards"][-1]["type"] == "blend_character"
    assert fake_spotify.created_playlists[-1]["is_public"] is False
    assert fake_spotify.added_tracks[-1]["track_uris"][0] == "spotify:track:shared-track"

    wrapped_response = client.get(f"/api/rooms/{token}/wrapped")
    assert wrapped_response.status_code == 200
    assert wrapped_response.get_json()["playlist_id"] == "playlist-123"


def test_non_host_cannot_save_weights(client, fake_spotify):
    authenticate(client, fake_spotify, "host")
    token = client.post("/api/rooms").get_json()["token"]
    client.put(
        f"/api/rooms/{token}/contribution",
        json={"use_top_tracks": True, "use_saved_tracks": False, "use_recent_tracks": False, "playlist_ids": []},
    )

    authenticate(client, fake_spotify, "guest")
    client.post(f"/api/rooms/{token}/join")
    client.put(
        f"/api/rooms/{token}/contribution",
        json={"use_top_tracks": True, "use_saved_tracks": False, "use_recent_tracks": False, "playlist_ids": []},
    )

    response = client.patch(
        f"/api/rooms/{token}/weights",
        json={
            "members": [
                {"id": "host", "weight": 50},
                {"id": "guest", "weight": 50},
            ]
        },
    )

    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "host_only"


def test_wrapped_is_not_available_before_create(client, fake_spotify):
    authenticate(client, fake_spotify, "host")
    token = client.post("/api/rooms").get_json()["token"]

    response = client.get(f"/api/rooms/{token}/wrapped")
    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "wrapped_not_ready"


def test_callback_restores_room_query_after_login(client, fake_spotify):
    client.post(
        "/api/auth/spotify-config",
        json={
            "client_id": "browser-client-id",
            "client_secret": "browser-client-secret",
        },
    )

    login_response = client.get("/api/auth/login?room=test-room")
    assert login_response.status_code == 302
    state = parse_qs(urlparse(login_response.headers["Location"]).query)["state"][0]

    fake_spotify.current_user = fake_spotify.users["host"]
    callback_response = client.get(f"/api/auth/callback?code=abc&state={state}")
    assert callback_response.status_code == 302
    location = urlparse(callback_response.headers["Location"])
    query = parse_qs(location.query)

    assert query["login"] == ["success"]
    assert query["room"] == ["test-room"]
