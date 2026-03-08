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
    "bgcolor": "#0B1220",
    "fontname": "Helvetica",
    "fontcolor": "#E2E8F0",
    "fontsize": "24",
    "pad": "0.7",
    "nodesep": "0.7",
    "ranksep": "1.2",
    "margin": "0.25",
    "splines": "spline",
    "compound": "true",
    "newrank": "true",
    "labelloc": "t",
    "labeljust": "l",
    "label": "Sato Repository Architecture\nRuntime app, Spotify integrations, session/room storage, and verification tooling",
}

NODE_ATTR = {
    "fontname": "Helvetica",
    "fontcolor": "#E5E7EB",
    "fontsize": "15",
    "color": "#94A3B8",
    "penwidth": "1.4",
}

EDGE_ATTR = {
    "fontname": "Helvetica",
    "fontcolor": "#CBD5E1",
    "fontsize": "12",
    "color": "#64748B",
    "penwidth": "1.3",
}


def icon(name: str) -> str:
    return str(ICON_DIR / name)


def cluster_attr(bgcolor: str, pencolor: str) -> dict[str, str]:
    return {
        "bgcolor": bgcolor,
        "color": pencolor,
        "fontcolor": "#F8FAFC",
        "fontsize": "18",
        "fontname": "Helvetica",
        "style": "rounded,filled",
        "penwidth": "1.6",
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
        "Sato Repository Architecture",
        filename=str(OUTPUT_PATH),
        show=False,
        direction="LR",
        curvestyle="curved",
        outformat="png",
        graph_attr=GRAPH_ATTR,
        node_attr=NODE_ATTR,
        edge_attr=EDGE_ATTR,
    ):
        with Cluster(
            "Users & Browser\nSpotify users and the web runtime",
            direction="TB",
            graph_attr=cluster_attr("#111827", "#1F2937"),
        ):
            users = User("Host + invited members\nSpotify accounts")
            browser = Client(
                "Browser runtime\ncookies + query room token\nclipboard/share + localStorage"
            )
            users >> Edge(color="#38BDF8", label="open invite URL /\nuse SPA") >> browser

        with Cluster(
            "Frontend Workspace\nVue 3 + JavaScript + Vite",
            direction="TB",
            graph_attr=cluster_attr("#172554", "#2563EB"),
        ):
            vite = Custom(
                "Vite dev server + /api proxy\nvite.config.js + npm scripts",
                icon("vite.svg"),
            )
            spa = Vue(
                "Sato SPA\nApp.vue + BlendView.vue\nSpotify config, rooms,\nweights, preview, Wrapped"
            )
            frontend_libs = JavaScript(
                "Client transport + state\napi.js + debug.js + blend.js\npolling, lazy source load,\nauto-normalized weights"
            )

            browser >> Edge(color="#38BDF8", label="render UI + interact") >> spa
            vite >> Edge(style="dashed", color="#A5B4FC", label="dev server /\nproxy in local runs") >> spa
            spa >> Edge(color="#60A5FA", label="component state +\nrequest helpers") >> frontend_libs

        with Cluster(
            "Backend Runtime\nFlask + Flask-Session + Python",
            direction="TB",
            graph_attr=cluster_attr("#1F2937", "#475569"),
        ):
            api = Flask(
                "Flask API + SPA fallback\napp.py routes\n/auth, /me, /rooms, /debug"
            )
            room_store = Python(
                "Room orchestration\nRoomStore\nTTL rooms, members,\nweights, contributions"
            )
            blend_engine = Python(
                "Blend engine\nblend_service.py\nranking, overlap,\ngenerated cover art,\nWrapped artifact"
            )
            spotify_adapter = Python(
                "Spotify adapter\nspotify_client.py\nrequests, OAuth token\nrefresh, Spotify Web API"
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

        with Cluster(
            "Spotify External Services\nOAuth 2.0 + Web API",
            direction="TB",
            graph_attr=cluster_attr("#052E16", "#16A34A"),
        ):
            spotify_accounts = Custom(
                "Spotify Accounts\nOAuth 2.0 authorize + callback",
                icon("spotify.svg"),
            )
            spotify_web_api = Custom(
                "Spotify Web API\n/me, tracks, playlists,\nplaylist creation",
                icon("spotify.svg"),
            )

            spotify_adapter >> Edge(
                color="#22C55E",
                label="authorization URL /\ncode exchange",
            ) >> spotify_accounts
            spotify_adapter >> Edge(
                color="#22C55E",
                label="REST API calls via requests",
            ) >> spotify_web_api

        with Cluster(
            "Verification & Tooling\nlocal scripts, CI, unit tests, browser E2E",
            direction="TB",
            graph_attr=cluster_attr("#2E1065", "#7C3AED"),
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
                "Vitest + jsdom\nsrc/App.test.js\nBlendView/lib unit tests",
                icon("vitest.svg"),
            )
            playwright_suite = Custom(
                "Playwright + Chromium\ne2e/room-flow.spec.js\nbrowser room flow coverage",
                icon("playwright.svg"),
            )
            fake_spotify = Python(
                "E2E fake Spotify\nE2EFakeSpotifyFactory\nno real OAuth in browser E2E"
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
                label="unit test SPA + JS utils",
            ) >> spa
            playwright_suite >> Edge(
                color="#FCD34D",
                style="dotted",
                label="launch isolated\nVite + Flask webServer",
            ) >> spa
            fake_spotify >> Edge(
                color="#FCD34D",
                style="dotted",
                label="SPOTIFY_CLIENT_FACTORY override\nwhen SATO_E2E=1",
            ) >> api

    pad_to_landscape_canvas(OUTPUT_PATH.with_suffix(".png"), GRAPH_ATTR["bgcolor"])


if __name__ == "__main__":
    build_diagram()
