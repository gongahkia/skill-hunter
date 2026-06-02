from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "judgeman_v4" / "src" / "icons"
SOURCE_ASSET = ROOT / "archive" / "judgeman_v1" / "src" / "local_asset" / "judgeman-192.png"
SIZES = [16, 32, 48, 128, 512, 1024]


def main() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    if not SOURCE_ASSET.exists():
        raise FileNotFoundError(f"Missing source icon asset: {SOURCE_ASSET}")
    source = Image.open(SOURCE_ASSET).convert("RGBA")
    for size in SIZES:
        resized = source.resize((size, size), Image.LANCZOS)
        resized.save(ICONS_DIR / f"judgeman-{size}.png")


if __name__ == "__main__":
    main()
