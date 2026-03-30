#!/usr/bin/env python3
"""Create the curated Firefox AMO source archive for Skill Hunter."""

from __future__ import annotations

import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]

INCLUDED_PATHS = [
    ".eslintrc.json",
    ".gitignore",
    ".prettierrc.json",
    "DOC.md",
    "Makefile",
    "jest.config.js",
    "package-lock.json",
    "package.json",
    "scripts/package_firefox_source.py",
    "src/content.ts",
    "src/core",
    "src/local_asset",
    "src/manifest.json",
    "src/popup.html",
    "src/popup.ts",
    "src/styles",
    "src/types",
    "src/utils",
    "tsconfig.json",
    "webpack.config.js",
]


def iter_files(relative_path: Path) -> list[Path]:
    full_path = ROOT / relative_path
    if not full_path.exists():
        raise FileNotFoundError(f"Missing required Firefox source path: {relative_path}")

    if full_path.is_dir():
        return sorted(path for path in full_path.rglob("*") if path.is_file())

    return [full_path]


def main() -> int:
    destination = (
        Path(sys.argv[1]).resolve()
        if len(sys.argv) > 1
        else ROOT / "submission" / "firefox" / "artifacts" / "skill-hunter-firefox-source.zip"
    )
    destination.parent.mkdir(parents=True, exist_ok=True)

    with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
        for relative_path in INCLUDED_PATHS:
            for file_path in iter_files(Path(relative_path)):
                archive.write(file_path, file_path.relative_to(ROOT))

    print(destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
