from __future__ import annotations

from pathlib import Path
import shutil
import struct
import subprocess

from diagrams import Cluster, Diagram, Edge
from diagrams.custom import Custom
from diagrams.onprem.ci import GithubActions
from diagrams.onprem.client import Client, User
from diagrams.onprem.compute import Server
from diagrams.onprem.inmemory import Redis
from diagrams.programming.framework import Flask, Vue
from diagrams.programming.language import Bash, JavaScript, Python


ROOT_DIR = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT_DIR / "helper" / "icons"
OUTPUT_PATH = ROOT_DIR / "asset" / "reference" / "architecture"
LANDSCAPE_RATIO = 16 / 9


GRAPH_ATTR = {
    "bgcolor": "#FFFFFF",
    "fontname": "Helvetica",
    "fontcolor": "#0F172A",
    "fontsize": "26",
    "pad": "0.7",
    "nodesep": "0.7",
    "ranksep": "1.2",
    "margin": "0.25",
    "splines": "spline",
    "compound": "true",
    "newrank": "true",
    "labelloc": "t",
    "labeljust": "l",
    "label": "Sato + Vibecheck Architecture\nCollaborative Spotify blending, mood-driven playback, browser emotion detection, and shared mood profiles",
}

NODE_ATTR = {
    "fontname": "Helvetica",
    "fontcolor": "#0F172A",
    "fontsize": "17",
    "color": "#475569",
    "penwidth": "1.5",
}

EDGE_ATTR = {
    "fontname": "Helvetica",
    "fontcolor": "#334155",
    "fontsize": "13",
    "color": "#475569",
    "penwidth": "1.5",
}


def icon(name: str) -> str:
    return str(ICON_DIR / name)


def cluster_attr(bgcolor: str, pencolor: str) -> dict[str, str]:
    return {
        "bgcolor": bgcolor,
        "fillcolor": bgcolor,
        "pencolor": pencolor,
        "fontcolor": "#0F172A",
        "fontsize": "19",
        "fontname": "Helvetica",
        "style": "rounded,filled",
        "penwidth": "1.8",
        "margin": "20",
    }


def read_png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        header = handle.read(24)

    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not a valid PNG file")

    return struct.unpack(">II", header[16:24])


def pad_to_landscape_canvas(path: Path, background: str) -> None:
    if not path.exists():
        return

    width, height = read_png_size(path)
    target_height = max(height, 3000)
    target_width = max(width, int(target_height * LANDSCAPE_RATIO), width + 1200)

    if width >= target_width and height >= target_height:
        return

    magick = shutil.which("magick")
    if magick:
        subprocess.run(
            [
                magick,
                str(path),
                "-background",
                background,
                "-gravity",
                "center",
                "-extent",
                f"{target_width}x{target_height}",
                str(path),
            ],
            check=True,
        )
        return

    sips = shutil.which("sips")
    if sips:
        subprocess.run(
            [
                sips,
                "--padToHeightWidth",
                str(target_height),
                str(target_width),
                "--padColor",
                background.removeprefix("#"),
                str(path),
                "--out",
                str(path),
            ],
            check=True,
        )


def build_diagram() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with Diagram(
        "Sato + Vibecheck Architecture",
        filename=str(OUTPUT_PATH),
        show=False,
        direction="LR",
        curvestyle="curved",
        outformat="png",
        graph_attr=GRAPH_ATTR,
        node_attr=NODE_ATTR,
        edge_attr=EDGE_ATTR,
    ):

        # --- shared layer ---
        with Cluster(
            "Shared Layer\nmood_profiles.json + spotify_client.py",
            direction="TB",
            graph_attr=cluster_attr("#FEF3C7", "#D97706"),
        ):
            mood_profiles = Python(
                "Mood Profiles\nshared/mood_profiles.json\n5 moods, audio features,\nqueries, seed genres"
            )
            shared_spotify = Python(
                "Shared Spotify Client\nshared/spotify_client.py\nPKCE auth, search,\nplayback, recommendations"
            )

        # --- users & browser ---
        with Cluster(
            "Users & Browser\nSpotify users and the web runtime",
            direction="TB",
            graph_attr=cluster_attr("#F8FAFC", "#94A3B8"),
        ):
            users = User("Host + invited members\nSpotify accounts")
            browser = Client(
                "Browser runtime\ncookies + query room token\nclipboard/share + localStorage"
            )
            users >> Edge(color="#38BDF8", label="open invite URL /\nuse SPA") >> browser

        # --- sato frontend ---
        with Cluster(
            "Sato Frontend\nVue 3 + JavaScript + Vite",
            direction="TB",
            graph_attr=cluster_attr("#DBEAFE", "#3B82F6"),
        ):
            vite = Custom(
                "Vite dev server + /api proxy\nvite.config.js + npm scripts",
                icon("vite.png"),
            )
            spa = Vue(
                "Sato SPA\nApp.vue + BlendView.vue\nrooms, weights, preview,\nmood selector, Wrapped"
            )
            frontend_libs = JavaScript(
                "Client transport + state\napi.js + debug.js + blend.js\npolling, lazy source load,\nauto-normalized weights"
            )
            mood_detector = Custom(
                "MoodDetector.vue\nface-api.js webcam\nbrowser-side emotion\ndetection (7 emotions)",
                icon("faceapi.png"),
            )
            mood_classifier_js = JavaScript(
                "Mood Classifier JS\nmood-classifier.js\n5-mood classification +\ndebounce (port of Python)"
            )

            browser >> Edge(color="#38BDF8", label="render UI + interact") >> spa
            vite >> Edge(style="dashed", color="#A5B4FC", label="dev server /\nproxy in local runs") >> spa
            spa >> Edge(color="#60A5FA", label="component state +\nrequest helpers") >> frontend_libs
            spa >> Edge(color="#EC4899", label="webcam mood\ndetection") >> mood_detector
            mood_detector >> Edge(color="#EC4899", label="emotion scores") >> mood_classifier_js
            mood_classifier_js >> Edge(color="#EC4899", style="dashed", label="detected mood\nto contribution form") >> spa

        # --- sato backend ---
        with Cluster(
            "Sato Backend\nFlask + Flask-Session + Python",
            direction="TB",
            graph_attr=cluster_attr("#E2E8F0", "#64748B"),
        ):
            api = Flask(
                "Flask API + SPA fallback\napp.py routes\n/auth, /me, /rooms,\n/mood-profiles, /mood-summary"
            )
            room_store = Python(
                "Room orchestration\nRoomStore\nTTL rooms, members,\nweights, contributions"
            )
            blend_engine = Python(
                "Blend engine\nblend_service.py\nranking, overlap, mood source,\ngenerated cover art,\nWrapped artifact"
            )
            mood_service = Python(
                "Mood Service\nmood_service.py\nSpotify recommendations\nwith audio feature targets"
            )
            mood_history = Python(
                "Mood History\nmood_history.py\nreads vibecheck SQLite\nmood distribution"
            )
            spotify_adapter = Python(
                "Spotify adapter\nspotify_client.py\nOAuth token refresh,\nrecommendations, audio features"
            )
            debug_recorder = Python(
                "Observability\ndebug_tools.py\nrequest IDs + event recorder"
            )
            cache_store = Server(
                "FileSystemCache default\n.flask_session\ncachelib-backed sessions"
            )
            redis_store = Redis(
                "Redis optional\nsession + room persistence\nwhen REDIS_URL is set"
            )

            frontend_libs >> Edge(
                color="#60A5FA",
                label="fetch /api + cookies\nX-Sato-Client-Request-Id",
            ) >> api
            api >> Edge(color="#F59E0B", label="room CRUD + TTL") >> room_store
            room_store >> Edge(color="#F59E0B", label="default local store") >> cache_store
            room_store >> Edge(
                color="#F59E0B",
                style="dashed",
                label="optional production store",
            ) >> redis_store
            api >> Edge(
                color="#A78BFA",
                label="preview/create/\nwrapped pipeline",
            ) >> blend_engine
            blend_engine >> Edge(
                color="#A78BFA",
                style="dashed",
                label="preview tracks,\nWrapped cards,\ncover art data URL",
            ) >> api
            api >> Edge(
                color="#22C55E",
                label="profile, source catalog,\nplaylist create",
            ) >> spotify_adapter
            api >> Edge(
                color="#F472B6",
                label="request + debug events",
            ) >> debug_recorder
            api >> Edge(
                color="#D97706",
                label="mood-aware\ntrack fetch",
            ) >> mood_service
            mood_service >> Edge(
                color="#22C55E",
                label="recommendations API\nwith audio features",
            ) >> spotify_adapter
            mood_service >> Edge(
                color="#D97706",
                style="dashed",
                label="load mood profiles",
            ) >> mood_profiles
            api >> Edge(
                color="#7C3AED",
                style="dashed",
                label="desktop mood summary",
            ) >> mood_history

        # --- spotify external ---
        with Cluster(
            "Spotify External Services\nOAuth 2.0 + Web API",
            direction="TB",
            graph_attr=cluster_attr("#DCFCE7", "#16A34A"),
        ):
            spotify_accounts = Custom(
                "Spotify Accounts\nOAuth 2.0 authorize + callback",
                icon("spotify.png"),
            )
            spotify_web_api = Custom(
                "Spotify Web API\n/me, tracks, playlists,\nrecommendations, audio-features,\nplayback control",
                icon("spotify.png"),
            )

            spotify_adapter >> Edge(
                color="#22C55E",
                label="authorization URL /\ncode exchange",
            ) >> spotify_accounts
            spotify_adapter >> Edge(
                color="#22C55E",
                label="REST API calls via requests",
            ) >> spotify_web_api

        # --- vibecheck desktop ---
        with Cluster(
            "Vibecheck Desktop App\nGo CLI/TUI + Python subprocess",
            direction="TB",
            graph_attr=cluster_attr("#FDF2F8", "#DB2777"),
        ):
            with Cluster(
                "Go Process\nCobra CLI + Bubble Tea TUI",
                direction="TB",
                graph_attr=cluster_attr("#FCE7F3", "#EC4899"),
            ):
                go_cli = Custom(
                    "CLI + TUI\nmain.go + tui/\nCobra commands,\nBubble Tea dashboard",
                    icon("go.png"),
                )
                bridge = Custom(
                    "MoodMusic Bridge\nbridge/mood_music.go\nmood->music routing,\ndebounce, DND, blacklist",
                    icon("go.png"),
                )
                provider_iface = Custom(
                    "PlaybackProvider\nprovider.go\nYTMusicProvider |\nSpotifyProvider",
                    icon("go.png"),
                )
                queue_mgr = Custom(
                    "Queue Manager\nqueue/\nauto-refill, blacklist",
                    icon("go.png"),
                )
                ipc_mgr = Custom(
                    "IPC Manager\nipc/\nJSON-over-stdin/stdout\nPython subprocess lifecycle",
                    icon("go.png"),
                )
                analytics = Custom(
                    "Analytics\nanalytics/aggregator.go\nSQLite mood + track history",
                    icon("sqlite.png"),
                )

                go_cli >> Edge(color="#DB2777", label="mood change events") >> bridge
                bridge >> Edge(color="#DB2777", label="search + play\nvia interface") >> provider_iface
                provider_iface >> Edge(color="#DB2777", label="track lifecycle") >> queue_mgr
                bridge >> Edge(color="#DB2777", style="dashed", label="record mood\n+ track") >> analytics
                provider_iface >> Edge(color="#DB2777", label="IPC requests") >> ipc_mgr

            with Cluster(
                "Python Subprocess\nmood-engine",
                direction="TB",
                graph_attr=cluster_attr("#F3E8FF", "#8B5CF6"),
            ):
                mood_engine = Python(
                    "IPC Event Loop\n__main__.py\nroutes health, capture,\nsearch, spotify_*"
                )
                capture = Custom(
                    "Webcam Capture\ncapture.py\nOpenCV, AVFoundation/V4L2",
                    icon("webcam.png"),
                )
                detection = Python(
                    "Detection + DeepFace\ndetection.py + backends.py\n7 emotions, face detection"
                )
                smoother = Python(
                    "Smoother + Classifier\nsmoother.py + classifier.py\nweighted avg, 5-mood\nclassification + debounce"
                )
                yt_client = Python(
                    "YouTube Music Client\nmusic_client.py\nytmusicapi wrapper"
                )
                spotify_handler = Python(
                    "Spotify Handler\nspotify_handler.py\nsearch, play, pause,\nresume, state"
                )

                ipc_mgr >> Edge(
                    color="#8B5CF6",
                    label="JSON-over-stdin/stdout",
                ) >> mood_engine
                mood_engine >> Edge(color="#8B5CF6", label="capture_request") >> capture
                capture >> Edge(color="#8B5CF6") >> detection
                detection >> Edge(color="#8B5CF6") >> smoother
                mood_engine >> Edge(color="#22C55E", label="search_request") >> yt_client
                mood_engine >> Edge(color="#22C55E", label="spotify_* requests") >> spotify_handler

            spotify_handler >> Edge(
                color="#22C55E",
                label="uses shared client",
            ) >> shared_spotify
            shared_spotify >> Edge(
                color="#22C55E",
                style="dashed",
                label="Spotify Web API\n(PKCE auth, playback)",
            ) >> spotify_web_api

        # --- external playback ---
        with Cluster(
            "External Playback\nmpv + yt-dlp | Spotify device",
            direction="TB",
            graph_attr=cluster_attr("#F0FDF4", "#22C55E"),
        ):
            mpv_player = Custom(
                "mpv\nJSON IPC over Unix socket\nyt-dlp backend",
                icon("mpv.png"),
            )
            spotify_device = Custom(
                "Spotify Active Device\nphone/desktop/web player\ncontrolled via Web API",
                icon("spotify.png"),
            )

            provider_iface >> Edge(
                color="#7C3AED",
                style="dashed",
                label="YTMusic mode:\nmpv.Play(url)",
            ) >> mpv_player
            provider_iface >> Edge(
                color="#22C55E",
                style="dashed",
                label="Spotify mode:\nvia IPC → Web API",
            ) >> spotify_device

        # --- mood history cross-pollination ---
        mood_history >> Edge(
            color="#7C3AED",
            style="dotted",
            label="reads ~/.local/share/\nmood-music/history.db",
        ) >> analytics

        # --- shared profile reads ---
        bridge >> Edge(
            color="#D97706",
            style="dashed",
            label="mood queries from\nshared profiles",
        ) >> mood_profiles

        # --- verification ---
        with Cluster(
            "Verification & Tooling\nlocal scripts, CI, unit tests, browser E2E",
            direction="TB",
            graph_attr=cluster_attr("#F3E8FF", "#8B5CF6"),
        ):
            scripts = Bash(
                "Local orchestration\nscripts/dev.sh\nscripts/verify.sh\nport-aware startup + verify"
            )
            github_actions = GithubActions(
                "GitHub Actions CI\n.github/workflows/ci.yml\nPython 3.12 + Node 20"
            )
            pytest_suite = Python(
                "pytest\nbackend/tests\nAPI + Spotify client tests"
            )
            vitest_suite = Custom(
                "Vitest + jsdom\nunit tests for SPA,\nBlendView, mood-classifier",
                icon("vitest.png"),
            )
            playwright_suite = Custom(
                "Playwright + Chromium\ne2e/room-flow.spec.js\nbrowser room flow coverage",
                icon("playwright.png"),
            )
            go_tests = Custom(
                "Go tests\nvibecheck/**/*_test.go\nIPC, bridge, config tests",
                icon("go.png"),
            )
            py_mood_tests = Python(
                "mood-engine pytest\nmotion pipeline tests\nsmoother, classifier"
            )

            scripts >> Edge(
                color="#94A3B8",
                style="dashed",
                label="starts local frontend + backend",
            ) >> vite
            scripts >> Edge(
                color="#94A3B8",
                style="dashed",
                label="full verification",
            ) >> pytest_suite
            scripts >> Edge(color="#94A3B8", style="dashed") >> vitest_suite
            scripts >> Edge(color="#94A3B8", style="dashed") >> playwright_suite

            github_actions >> Edge(color="#C4B5FD", label="run backend tests") >> pytest_suite
            github_actions >> Edge(color="#C4B5FD", label="run frontend unit tests") >> vitest_suite
            github_actions >> Edge(
                color="#C4B5FD",
                label="frontend build + browser E2E",
            ) >> playwright_suite

            pytest_suite >> Edge(
                color="#FCD34D",
                style="dotted",
                label="exercise Flask routes\nand SpotifyClient",
            ) >> api
            vitest_suite >> Edge(
                color="#FCD34D",
                style="dotted",
                label="unit test SPA +\nmood-classifier.js",
            ) >> spa
            playwright_suite >> Edge(
                color="#FCD34D",
                style="dotted",
                label="launch isolated\nVite + Flask webServer",
            ) >> spa
            go_tests >> Edge(
                color="#FCD34D",
                style="dotted",
                label="test bridge, IPC,\nconfig, queue",
            ) >> bridge
            py_mood_tests >> Edge(
                color="#FCD34D",
                style="dotted",
                label="test emotion pipeline",
            ) >> mood_engine

    pad_to_landscape_canvas(OUTPUT_PATH.with_suffix(".png"), GRAPH_ATTR["bgcolor"])


if __name__ == "__main__":
    build_diagram()
