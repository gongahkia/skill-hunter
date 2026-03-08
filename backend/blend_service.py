from __future__ import annotations


class BlendValidationError(Exception):
    def __init__(self, message, details=None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


def round_to_two(value):
    return round(float(value), 2)


def _extract_track(track_or_item):
    track = (
        track_or_item.get("track")
        if isinstance(track_or_item, dict) and "track" in track_or_item
        else track_or_item
    )
    if not isinstance(track, dict):
        return None
    if track.get("is_local"):
        return None

    track_id = track.get("id")
    if not track_id:
        return None

    if track.get("artists") and isinstance(track.get("artists")[0], str):
        return {
            "id": track_id,
            "name": track.get("name") or "Unknown track",
            "artists": track.get("artists") or [],
            "image": track.get("image"),
        }

    album = track.get("album") or {}
    images = album.get("images") or []
    artists = [
        artist.get("name")
        for artist in track.get("artists") or []
        if isinstance(artist, dict) and artist.get("name")
    ]

    return {
        "id": track_id,
        "name": track.get("name") or "Unknown track",
        "artists": artists,
        "image": images[0].get("url") if images else None,
    }


def normalize_track_snapshot(raw_tracks):
    deduped_tracks = {}
    for raw_track in raw_tracks:
        track = _extract_track(raw_track)
        if not track:
            continue
        deduped_tracks.setdefault(track["id"], track)

    return sorted(
        deduped_tracks.values(),
        key=lambda track: (track["name"].lower(), track["id"]),
    )


def build_contribution_snapshot(
    *,
    use_top_tracks,
    use_saved_tracks,
    use_recent_tracks,
    playlist_ids,
    selected_playlists,
    top_tracks,
    saved_tracks,
    recent_tracks,
    playlist_tracks,
):
    if (
        not use_top_tracks
        and not use_saved_tracks
        and not use_recent_tracks
        and not playlist_ids
    ):
        raise BlendValidationError(
            "Choose at least one Spotify source before saving your contribution."
        )

    snapshot_tracks = []
    if use_top_tracks:
        snapshot_tracks.extend(top_tracks)
    if use_saved_tracks:
        snapshot_tracks.extend(saved_tracks)
    if use_recent_tracks:
        snapshot_tracks.extend(recent_tracks)
    snapshot_tracks.extend(playlist_tracks)

    normalized_tracks = normalize_track_snapshot(snapshot_tracks)
    if not normalized_tracks:
        raise BlendValidationError(
            "The selected Spotify sources did not contain any usable tracks."
        )

    return {
        "use_top_tracks": bool(use_top_tracks),
        "use_saved_tracks": bool(use_saved_tracks),
        "use_recent_tracks": bool(use_recent_tracks),
        "playlist_ids": playlist_ids,
        "playlists": selected_playlists,
        "source_summary": {
            "top_tracks_count": len(normalize_track_snapshot(top_tracks)) if use_top_tracks else 0,
            "saved_tracks_count": len(normalize_track_snapshot(saved_tracks)) if use_saved_tracks else 0,
            "recent_tracks_count": len(normalize_track_snapshot(recent_tracks)) if use_recent_tracks else 0,
            "playlist_count": len(selected_playlists),
            "playlist_track_count": len(normalize_track_snapshot(playlist_tracks)),
        },
        "track_count": len(normalized_tracks),
        "tracks": normalized_tracks,
    }


def _add_track_scores(track_scores, contributor, tracks):
    weight = contributor["weight"]
    if weight <= 0:
        return

    seen_track_ids = set()
    for raw_track in tracks:
        track = _extract_track(raw_track) if isinstance(raw_track, dict) else raw_track
        if not track or track["id"] in seen_track_ids:
            continue

        seen_track_ids.add(track["id"])
        existing_track = track_scores.setdefault(
            track["id"],
            {
                **track,
                "score": 0.0,
                "contributors": [],
            },
        )
        existing_track["score"] += weight
        existing_track["contributors"].append(
            {
                "source_id": contributor["id"],
                "source_name": contributor["name"],
                "weight": round_to_two(weight),
            }
        )


def build_room_blend_preview(contributors, limit=50):
    track_scores = {}
    active_contributors = [contributor for contributor in contributors if contributor["weight"] > 0]

    for contributor in active_contributors:
        _add_track_scores(
            track_scores=track_scores,
            contributor=contributor,
            tracks=contributor["tracks"],
        )

    ranked_tracks = sorted(
        track_scores.values(),
        key=lambda track: (-track["score"], track["name"].lower(), track["id"]),
    )[:limit]

    for track in ranked_tracks:
        track["score"] = round_to_two(track["score"])
        track["contributors"] = sorted(
            track["contributors"],
            key=lambda contributor: (
                -contributor["weight"],
                contributor["source_name"].lower(),
            ),
        )

    return {
        "tracks": ranked_tracks,
        "summary": {
            "total_tracks": len(track_scores),
            "total_contributors": len(active_contributors),
            "contributors": [
                {
                    "id": contributor["id"],
                    "name": contributor["name"],
                    "weight": round_to_two(contributor["weight"]),
                    "track_count": len(contributor["tracks"]),
                }
                for contributor in active_contributors
            ],
        },
    }


def _contribution_counts(preview_tracks, contributors):
    surviving_counts = {contributor["id"]: 0 for contributor in contributors}
    unique_counts = {contributor["id"]: 0 for contributor in contributors}
    shared_favorites = 0

    for track in preview_tracks:
        contributor_ids = [contributor["source_id"] for contributor in track["contributors"]]
        for contributor_id in contributor_ids:
            surviving_counts[contributor_id] = surviving_counts.get(contributor_id, 0) + 1

        if len(contributor_ids) >= 2:
            shared_favorites += 1
        if len(contributor_ids) == 1:
            unique_counts[contributor_ids[0]] = unique_counts.get(contributor_ids[0], 0) + 1

    return surviving_counts, unique_counts, shared_favorites


def _pick_member(metric_counts, contributors):
    ranked = sorted(
        contributors,
        key=lambda contributor: (
            -metric_counts.get(contributor["id"], 0),
            -round_to_two(contributor["weight"]),
            contributor["name"].lower(),
        ),
    )
    winner = ranked[0]
    return {
        "id": winner["id"],
        "name": winner["name"],
        "value": metric_counts.get(winner["id"], 0),
    }


def build_wrapped_artifact(room, playlist, preview, contributors):
    surviving_counts, unique_counts, shared_favorites = _contribution_counts(
        preview["tracks"], contributors
    )
    influential_member = _pick_member(surviving_counts, contributors)
    unique_member = _pick_member(unique_counts, contributors)

    return {
        "playlist_id": playlist["id"],
        "playlist_name": playlist["name"],
        "generated_at": playlist["created_at"],
        "cards": [
            {
                "type": "cover",
                "playlist_name": playlist["name"],
                "room_token": room["token"],
                "generated_at": playlist["created_at"],
                "contributor_count": len(contributors),
            },
            {
                "type": "summary",
                "total_ranked_tracks": preview["summary"]["total_tracks"],
                "tracks_added": playlist["tracks_added"],
                "total_contributors": len(contributors),
                "weights": [
                    {
                        "id": contributor["id"],
                        "name": contributor["name"],
                        "weight": round_to_two(contributor["weight"]),
                    }
                    for contributor in contributors
                ],
            },
            {
                "type": "contributors",
                "members": [
                    {
                        "id": contributor["id"],
                        "name": contributor["name"],
                        "weight": round_to_two(contributor["weight"]),
                        "surviving_tracks": surviving_counts.get(contributor["id"], 0),
                    }
                    for contributor in contributors
                ],
            },
            {
                "type": "top_tracks",
                "tracks": [
                    {
                        "id": track["id"],
                        "name": track["name"],
                        "artists": track["artists"],
                        "score": track["score"],
                        "contributors": track["contributors"],
                    }
                    for track in preview["tracks"][:5]
                ],
            },
            {
                "type": "blend_character",
                "shared_favorites": shared_favorites,
                "most_influential_member": influential_member,
                "most_unique_member": unique_member,
            },
        ],
    }
