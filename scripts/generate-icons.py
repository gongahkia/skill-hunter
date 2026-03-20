from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "judgeman_v4" / "src" / "icons"
SIZES = [16, 32, 48, 128, 512, 1024]


def create_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), "#071420")
    draw = ImageDraw.Draw(image)

    border = max(1, size // 48)
    radius = max(3, size // 6)
    inset = max(1, size // 16)

    draw.rounded_rectangle(
        [inset, inset, size - inset, size - inset],
        radius=radius,
        fill="#0c2231",
        outline="#65d18c",
        width=border,
    )

    gavel_width = size * 0.3
    gavel_height = size * 0.12
    handle_width = size * 0.12
    handle_height = size * 0.42
    center_x = size * 0.43
    center_y = size * 0.38

    draw.rounded_rectangle(
        [
            center_x - gavel_width / 2,
            center_y - gavel_height / 2,
            center_x + gavel_width / 2,
            center_y + gavel_height / 2,
        ],
        radius=max(2, size // 18),
        fill="#65d18c",
    )

    draw.rounded_rectangle(
        [
            center_x + gavel_width * 0.1,
            center_y - size * 0.02,
            center_x + gavel_width * 0.1 + handle_width,
            center_y - size * 0.02 + handle_height,
        ],
        radius=max(2, size // 20),
        fill="#d7e7f7",
    )

    draw.rounded_rectangle(
        [
            size * 0.2,
            size * 0.7,
            size * 0.8,
            size * 0.76,
        ],
        radius=max(2, size // 18),
        fill="#d7e7f7",
    )

    if size >= 48:
      font_size = max(8, size // 6)
      try:
          font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", font_size)
      except OSError:
          font = ImageFont.load_default()
      text = "JM"
      bbox = draw.textbbox((0, 0), text, font=font)
      width = bbox[2] - bbox[0]
      height = bbox[3] - bbox[1]
      text_x = (size - width) / 2
      text_y = size * 0.07
      draw.text((text_x, text_y), text, fill="#d7e7f7", font=font)

    return image


def main() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        icon = create_icon(size)
        icon.save(ICONS_DIR / f"judgeman-{size}.png")


if __name__ == "__main__":
    main()
