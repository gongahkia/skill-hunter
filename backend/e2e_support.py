from __future__ import annotations

from copy import deepcopy

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


class E2EFakeSpotifyFactory:
    default_client_id = "e2e-client-id"
    default_client_secret = "e2e-client-secret"

    def __init__(self):
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
            "ally": [
                make_track("shared-track", "Shared Track", "Shared Artist"),
                make_track("ally-top", "Ally Top", "Ally Artist"),
            ],
        }
        self.saved_tracks = {
            "host": [
                {"track": make_track("host-saved", "Host Saved", "Host Artist")},
            ],
            "guest": [
                {"track": make_track("guest-saved", "Guest Saved", "Guest Artist")},
            ],
            "ally": [
                {"track": make_track("ally-saved", "Ally Saved", "Ally Artist")},
            ],
        }
        self.recent_tracks = {
            "host": [
                {"track": make_track("host-recent", "Host Recent", "Host Artist")},
            ],
            "guest": [
                {"track": make_track("guest-recent", "Guest Recent", "Guest Artist")},
            ],
            "ally": [
                {"track": make_track("ally-recent", "Ally Recent", "Ally Artist")},
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
            "ally": [
                playlist_item("ally-owned", "Ally Owned", "ally", total=2),
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
            "ally-owned": [
                {"track": make_track("ally-playlist", "Ally Playlist Track", "Ally Artist")},
                {"track": make_track("shared-track", "Shared Track", "Shared Artist")},
            ],
            "shared-collab": [
                {"track": make_track("collab-track", "Collab Track", "Shared Artist")},
                {"track": make_track("shared-track", "Shared Track", "Shared Artist")},
            ],
        }
        self.created_playlists = []
        self.added_tracks = []
        self.playlist_sequence = 1

    def __call__(self, **kwargs):
        return E2EFakeSpotifyClient(factory=self, **kwargs)

    def reset(self):
        self.created_playlists = []
        self.added_tracks = []
        self.playlist_sequence = 1

    def issue_session(self, user_id):
        self.require_user(user_id)
        return {
            "access_token": f"e2e-access-{user_id}",
            "refresh_token": f"e2e-refresh-{user_id}",
            "expires_at": 9999999999,
        }

    def require_user(self, user_id):
        user = self.users.get(user_id)
        if not user:
            raise KeyError(user_id)
        return deepcopy(user)

    def next_playlist(self, user_id, name, description, is_public):
        playlist_id = f"playlist-{self.playlist_sequence}"
        self.playlist_sequence += 1
        playlist = {
            "id": playlist_id,
            "name": name,
            "external_urls": {"spotify": f"https://open.spotify.com/playlist/{playlist_id}"},
        }
        self.created_playlists.append(
            {
                "playlist": deepcopy(playlist),
                "user_id": user_id,
                "description": description,
                "is_public": is_public,
            }
        )
        return playlist


class E2EFakeSpotifyClient:
    def __init__(
        self,
        *,
        factory,
        client_id,
        client_secret,
        redirect_uri,
        access_token=None,
        refresh_token=None,
        expires_at=None,
        token_updater=None,
        **_,
    ):
        self.factory = factory
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_at = expires_at
        self.token_updater = token_updater

    def _current_user_id(self):
        if self.access_token and self.access_token.startswith("e2e-access-"):
            return self.access_token.replace("e2e-access-", "", 1)
        if self.refresh_token and self.refresh_token.startswith("e2e-refresh-"):
            return self.refresh_token.replace("e2e-refresh-", "", 1)
        raise SpotifyAPIError(
            "Spotify login has expired. Sign in again.",
            status_code=401,
        )

    def authorization_url(self, state):
        return f"{self.redirect_uri}?code=host&state={state}"

    def exchange_code(self, code):
        user_id = code or "host"
        tokens = self.factory.issue_session(user_id)
        self.access_token = tokens["access_token"]
        self.refresh_token = tokens["refresh_token"]
        self.expires_at = tokens["expires_at"]
        if self.token_updater:
            self.token_updater(tokens)
        return tokens

    def refresh_access_token(self):
        user_id = self._current_user_id()
        tokens = self.factory.issue_session(user_id)
        self.access_token = tokens["access_token"]
        self.refresh_token = tokens["refresh_token"]
        self.expires_at = tokens["expires_at"]
        if self.token_updater:
            self.token_updater(tokens)
        return tokens

    def verify_client_credentials(self):
        if (
            self.client_id != self.factory.default_client_id
            or self.client_secret != self.factory.default_client_secret
        ):
            raise SpotifyAPIError(
                "Spotify rejected the supplied client credentials.",
                status_code=400,
                payload={
                    "error": "invalid_client",
                    "error_description": "Invalid client",
                },
            )
        return {"access_token": "e2e-app-token", "token_type": "Bearer"}

    def get_current_user(self):
        return self.factory.require_user(self._current_user_id())

    def get_current_user_top_tracks(self, limit=50):
        return deepcopy(self.factory.top_tracks[self._current_user_id()][:limit])

    def get_saved_tracks(self, limit=500):
        return deepcopy(self.factory.saved_tracks[self._current_user_id()][:limit])

    def get_saved_tracks_total(self, limit_cap=500):
        return min(len(self.factory.saved_tracks[self._current_user_id()]), limit_cap)

    def get_recently_played(self, limit=50):
        return deepcopy(self.factory.recent_tracks[self._current_user_id()][:limit])

    def get_current_user_playlists(self, limit=200):
        return deepcopy(self.factory.current_user_playlists[self._current_user_id()][:limit])

    def get_playlist_tracks(self, playlist_id, limit=500):
        return deepcopy(self.factory.playlist_tracks[playlist_id][:limit])

    def create_playlist(self, user_id, name, description, is_public=False):
        return self.factory.next_playlist(user_id, name, description, is_public)

    def add_tracks_to_playlist(self, playlist_id, track_uris):
        self.factory.added_tracks.append(
            {
                "playlist_id": playlist_id,
                "track_uris": deepcopy(track_uris),
            }
        )
        return {"snapshot_id": "e2e-snapshot"}
