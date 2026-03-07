from __future__ import annotations


class BlendValidationError(Exception):
    def __init__(self, message, details=None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


def _as_weight(value, field_name):
    try:
        weight = float(value)
    except (TypeError, ValueError) as error:
        raise BlendValidationError(
            f"{field_name} must be a number between 0 and 100.",
            details={"field": field_name},
        ) from error

    if weight < 0 or weight > 100:
        raise BlendValidationError(
            f"{field_name} must be between 0 and 100.",
            details={"field": field_name},
        )
    return round(weight, 2)


def validate_blend_request(payload):
    if not isinstance(payload, dict):
        raise BlendValidationError("Blend requests must be valid JSON objects.")

    self_weight = _as_weight(payload.get("self_weight"), "self_weight")
    friend_entries = payload.get("friends")
    if not isinstance(friend_entries, list) or not friend_entries:
        raise BlendValidationError("Select at least one friend before previewing a blend.")

    normalized_friends = []
    total_weight = self_weight
    seen_friend_ids = set()

    for entry in friend_entries:
        if not isinstance(entry, dict):
            raise BlendValidationError("Each friend entry must be an object.")

        friend_id = str(entry.get("id", "")).strip()
        if not friend_id:
            raise BlendValidationError("Each friend entry must include an id.")
        if friend_id in seen_friend_ids:
            raise BlendValidationError(
                f"Friend '{friend_id}' was provided more than once.",
                details={"friend_id": friend_id},
            )

        seen_friend_ids.add(friend_id)
        weight = _as_weight(entry.get("weight"), f"{friend_id}.weight")
        playlist_ids = entry.get("playlist_ids")
        if playlist_ids is None:
            playlist_ids = []
        if not isinstance(playlist_ids, list):
            raise BlendValidationError(
                f"{friend_id}.playlist_ids must be an array of playlist ids.",
                details={"friend_id": friend_id},
            )

        normalized_friends.append(
            {
                "id": friend_id,
                "weight": weight,
                "playlist_ids": [
                    str(playlist_id).strip()
                    for playlist_id in playlist_ids
                    if str(playlist_id).strip()
                ],
            }
        )
        total_weight += weight

    if abs(total_weight - 100) > 0.01:
        raise BlendValidationError(
            "Blend weights must total exactly 100.",
            details={"weight_total": round(total_weight, 2)},
        )

    return {
        "self_weight": self_weight,
        "friends": normalized_friends,
    }


def _extract_track(track_or_item):
    track = track_or_item.get("track") if isinstance(track_or_item, dict) and "track" in track_or_item else track_or_item
    if not isinstance(track, dict):
        return None
    if track.get("is_local"):
        return None
    track_id = track.get("id")
    if not track_id:
        return None

    album = track.get("album") or {}
    images = album.get("images") or []
    artists = [artist.get("name") for artist in track.get("artists") or [] if artist.get("name")]

    return {
        "id": track_id,
        "name": track.get("name") or "Unknown track",
        "artists": artists,
        "image": images[0].get("url") if images else None,
    }


def _add_track_scores(track_scores, source_id, source_name, weight, tracks):
    seen_track_ids = set()
    for raw_track in tracks:
        track = _extract_track(raw_track)
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
                "source_id": source_id,
                "source_name": source_name,
                "weight": round(weight, 2),
            }
        )


def build_blend_preview(self_tracks, self_weight, friend_sources, user_label="You", limit=50):
    track_scores = {}
    _add_track_scores(
        track_scores=track_scores,
        source_id="self",
        source_name=user_label,
        weight=self_weight,
        tracks=self_tracks,
    )

    selected_friends = []
    for friend in friend_sources:
        _add_track_scores(
            track_scores=track_scores,
            source_id=friend["id"],
            source_name=friend["name"],
            weight=friend["weight"],
            tracks=friend["tracks"],
        )
        selected_friends.append(
            {
                "id": friend["id"],
                "name": friend["name"],
                "playlist_ids": friend["playlist_ids"],
            }
        )

    ranked_tracks = sorted(
        track_scores.values(),
        key=lambda track: (-track["score"], track["name"].lower(), track["id"]),
    )[:limit]

    for track in ranked_tracks:
        track["score"] = round(track["score"], 2)
        track["contributors"] = sorted(
            track["contributors"],
            key=lambda contributor: (-contributor["weight"], contributor["source_name"]),
        )

    return {
        "tracks": ranked_tracks,
        "summary": {
            "normalized_weights": {
                "self_weight": round(self_weight, 2),
                "friends": [
                    {
                        "id": friend["id"],
                        "weight": round(friend["weight"], 2),
                    }
                    for friend in friend_sources
                ],
            },
            "selected_friends": selected_friends,
            "total_tracks": len(track_scores),
        },
    }
