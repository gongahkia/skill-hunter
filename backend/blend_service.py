from __future__ import annotations

import base64
import hashlib
from html import escape


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
    use_mood_tracks=False,
    mood_state=None,
    mood_tracks=None,
):
    if (
        not use_top_tracks
        and not use_saved_tracks
        and not use_recent_tracks
        and not playlist_ids
        and not use_mood_tracks
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
    if use_mood_tracks and mood_tracks:
        snapshot_tracks.extend(mood_tracks)

    normalized_tracks = normalize_track_snapshot(snapshot_tracks)
    if not normalized_tracks:
        raise BlendValidationError(
            "The selected Spotify sources did not contain any usable tracks."
        )

    return {
        "use_top_tracks": bool(use_top_tracks),
        "use_saved_tracks": bool(use_saved_tracks),
        "use_recent_tracks": bool(use_recent_tracks),
        "use_mood_tracks": bool(use_mood_tracks),
        "mood_state": mood_state,
        "playlist_ids": playlist_ids,
        "playlists": selected_playlists,
        "source_summary": {
            "top_tracks_count": len(normalize_track_snapshot(top_tracks)) if use_top_tracks else 0,
            "saved_tracks_count": len(normalize_track_snapshot(saved_tracks)) if use_saved_tracks else 0,
            "recent_tracks_count": len(normalize_track_snapshot(recent_tracks)) if use_recent_tracks else 0,
            "playlist_count": len(selected_playlists),
            "playlist_track_count": len(normalize_track_snapshot(playlist_tracks)),
            "mood_tracks_count": len(normalize_track_snapshot(mood_tracks or [])) if use_mood_tracks else 0,
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


def _format_member_list(names):
    if not names:
        return ""
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return f"{', '.join(names[:-1])}, and {names[-1]}"


def build_overlap_stats(preview_tracks, contributors):
    pair_overlap = {}
    association_count = 0
    shared_tracks = 0
    unique_tracks = 0
    contributor_names = {contributor["id"]: contributor["name"] for contributor in contributors}

    for track in preview_tracks:
        contributor_ids = [contributor["source_id"] for contributor in track["contributors"]]
        association_count += len(contributor_ids)
        if len(contributor_ids) >= 2:
            shared_tracks += 1
        if len(contributor_ids) == 1:
            unique_tracks += 1

        for index, left_id in enumerate(contributor_ids):
            for right_id in contributor_ids[index + 1 :]:
                pair_key = tuple(sorted((left_id, right_id)))
                pair_overlap[pair_key] = pair_overlap.get(pair_key, 0) + 1

    strongest_pair = None
    if pair_overlap:
        pair_key, shared_count = max(
            pair_overlap.items(),
            key=lambda item: (
                item[1],
                contributor_names.get(item[0][0], item[0][0]).lower(),
                contributor_names.get(item[0][1], item[0][1]).lower(),
            ),
        )
        pair_names = [contributor_names.get(member_id, member_id) for member_id in pair_key]
        strongest_pair = {
            "ids": list(pair_key),
            "names": pair_names,
            "label": f"{pair_names[0]} + {pair_names[1]}",
            "shared_tracks": shared_count,
        }

    total_tracks = len(preview_tracks)
    return {
        "shared_tracks": shared_tracks,
        "unique_tracks": unique_tracks,
        "average_contributors_per_track": round_to_two(
            association_count / total_tracks if total_tracks else 0
        ),
        "shared_track_ratio": round_to_two(
            (shared_tracks / total_tracks) * 100 if total_tracks else 0
        ),
        "strongest_pair": strongest_pair,
    }


def _build_track_reason(track):
    contributor_names = [contributor["source_name"] for contributor in track["contributors"]]
    overlap_count = len(contributor_names)
    total_weight = round_to_two(
        sum(contributor["weight"] for contributor in track["contributors"])
    )

    if overlap_count >= 2:
        why_it_ranked = (
            f"Shared by {_format_member_list(contributor_names)} for {total_weight:.2f}% combined weight."
        )
    else:
        why_it_ranked = (
            f"Chosen only by {contributor_names[0]} and carried by {total_weight:.2f}% weight."
        )

    score_breakdown = " + ".join(
        f"{contributor['source_name']} {contributor['weight']:.2f}%"
        for contributor in track["contributors"]
    )
    return overlap_count, total_weight, score_breakdown, why_it_ranked


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
        overlap_count, total_weight, score_breakdown, why_it_ranked = _build_track_reason(track)
        track["overlap_count"] = overlap_count
        track["combined_weight"] = total_weight
        track["score_breakdown"] = score_breakdown
        track["why_it_ranked"] = why_it_ranked

    overlap_stats = build_overlap_stats(ranked_tracks, active_contributors)

    return {
        "tracks": ranked_tracks,
        "summary": {
            "total_tracks": len(track_scores),
            "total_contributors": len(active_contributors),
            "overlap_stats": overlap_stats,
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


def _seeded_color(seed, salt):
    digest = hashlib.sha256(f"{seed}:{salt}".encode("utf-8")).hexdigest()
    return f"#{digest[:6]}"


def _text_lines(text, *, max_chars=18, max_lines=3):
    words = [word for word in str(text or "").split() if word]
    if not words:
        return ["Sato Blend"]

    lines = []
    current = []
    for word in words:
        trial = " ".join(current + [word])
        if current and len(trial) > max_chars:
            lines.append(" ".join(current))
            current = [word]
            if len(lines) >= max_lines - 1:
                break
        else:
            current.append(word)

    remaining_words = words[len(" ".join(lines + [" ".join(current)]).split()) :]
    if current:
        tail = " ".join(current + remaining_words)
        if len(tail) > max_chars and len(lines) >= max_lines - 1:
            tail = f"{tail[: max_chars - 1].rstrip()}…"
        lines.append(tail)

    return lines[:max_lines]


def build_generated_cover_art(room, playlist_name, preview, contributors):
    primary = _seeded_color(room["token"], "primary")
    secondary = _seeded_color(room["token"], "secondary")
    accent = _seeded_color(room["token"], "accent")
    contributor_badges = [
        f"{escape((contributor['name'] or contributor['id'])[:1].upper())} {round_to_two(contributor['weight']):.0f}%"
        for contributor in contributors[:3]
    ]
    top_track_name = preview["tracks"][0]["name"] if preview["tracks"] else "Weighted room mix"
    overlap_stats = preview["summary"].get("overlap_stats") or {}
    subtitle = (
        f"{len(contributors)} contributors • "
        f"{overlap_stats.get('shared_tracks', 0)} shared picks"
    )
    title_lines = _text_lines(playlist_name)

    badge_svg = []
    for index, badge in enumerate(contributor_badges):
        badge_y = 376 + (index * 46)
        badge_svg.append(
            f'<rect x="58" y="{badge_y}" rx="20" ry="20" width="184" height="34" fill="rgba(255,255,255,0.10)" />'
        )
        badge_svg.append(
            f'<text x="78" y="{badge_y + 22}" font-size="18" font-family="Avenir Next, Segoe UI, sans-serif" fill="#ffffff">{escape(badge)}</text>'
        )

    line_svg = []
    for index, line in enumerate(title_lines):
        line_svg.append(
            f'<text x="56" y="{176 + (index * 58)}" font-size="50" font-weight="700" '
            f'font-family="Avenir Next, Segoe UI, sans-serif" fill="#ffffff">{escape(line)}</text>'
        )

    svg = f"""
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="{primary}" />
          <stop offset="55%" stop-color="{secondary}" />
          <stop offset="100%" stop-color="#111111" />
        </linearGradient>
        <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="{accent}" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.5)" />
        </linearGradient>
      </defs>
      <rect width="600" height="600" rx="44" fill="url(#bg)" />
      <circle cx="470" cy="140" r="132" fill="rgba(255,255,255,0.08)" />
      <circle cx="500" cy="152" r="102" fill="none" stroke="url(#ring)" stroke-width="24" />
      <circle cx="470" cy="140" r="56" fill="rgba(17,17,17,0.45)" />
      <text x="58" y="68" font-size="18" letter-spacing="3" font-family="Avenir Next, Segoe UI, sans-serif" fill="rgba(255,255,255,0.78)">SATO GENERATED COVER</text>
      {''.join(line_svg)}
      <text x="58" y="330" font-size="22" font-family="Avenir Next, Segoe UI, sans-serif" fill="rgba(255,255,255,0.84)">{escape(subtitle)}</text>
      <text x="58" y="520" font-size="20" font-family="Avenir Next, Segoe UI, sans-serif" fill="rgba(255,255,255,0.72)">Top seed: {escape(top_track_name)}</text>
      <text x="58" y="552" font-size="18" font-family="Avenir Next, Segoe UI, sans-serif" fill="rgba(255,255,255,0.6)">Room {escape(room['token'])}</text>
      {''.join(badge_svg)}
    </svg>
    """.strip()

    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode(
        "ascii"
    )


def _build_share_text(room, playlist, preview, overlap_stats):
    pair = overlap_stats.get("strongest_pair")
    pair_label = (
        f" Strongest overlap: {pair['label']} ({pair['shared_tracks']} shared tracks)."
        if pair
        else ""
    )
    return (
        f"{playlist['name']} was built in Sato for room {room['token']} with "
        f"{preview['summary']['total_contributors']} contributors and "
        f"{preview['summary']['total_tracks']} ranked tracks."
        f" {overlap_stats.get('shared_tracks', 0)} tracks were shared favorites."
        f"{pair_label}"
    )


def build_wrapped_artifact(room, playlist, preview, contributors):
    surviving_counts, unique_counts, shared_favorites = _contribution_counts(
        preview["tracks"], contributors
    )
    influential_member = _pick_member(surviving_counts, contributors)
    unique_member = _pick_member(unique_counts, contributors)
    overlap_stats = preview["summary"].get("overlap_stats") or build_overlap_stats(
        preview["tracks"], contributors
    )
    cover_art = build_generated_cover_art(
        room=room,
        playlist_name=playlist["name"],
        preview=preview,
        contributors=contributors,
    )
    share_text = _build_share_text(room, playlist, preview, overlap_stats)

    return {
        "playlist_id": playlist["id"],
        "playlist_name": playlist["name"],
        "generated_at": playlist["created_at"],
        "cover_art": cover_art,
        "share_text": share_text,
        "overlap_stats": overlap_stats,
        "cards": [
            {
                "type": "cover",
                "playlist_name": playlist["name"],
                "room_token": room["token"],
                "generated_at": playlist["created_at"],
                "contributor_count": len(contributors),
                "cover_art": cover_art,
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
                "overlap_stats": overlap_stats,
            },
            {
                "type": "overlap",
                "shared_tracks": overlap_stats["shared_tracks"],
                "unique_tracks": overlap_stats["unique_tracks"],
                "average_contributors_per_track": overlap_stats[
                    "average_contributors_per_track"
                ],
                "strongest_pair": overlap_stats["strongest_pair"],
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
                        "why_it_ranked": track["why_it_ranked"],
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
