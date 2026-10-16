#!/usr/bin/env python3
"""Validate/import tactics card PNGs and register every installed card.

Usage: python3 scripts/taktik-card-assets.py <folder> [--require-all]
Requires Pillow. Partial imports preserve previously installed artwork.
"""
import argparse
import re
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError

CARDS = ("gegenpress", "bus", "longball", "wings", "academy", "signing", "legend", "intl", "cash", "crowd")
SIZE = 360
# Keep a consistent safe area within the square in-app art box.
CONTENT_SIZE = 320
ROOT = Path(__file__).resolve().parent.parent


def prepare(path: Path) -> bytes:
    with Image.open(path) as source:
        if source.format != "PNG":
            raise ValueError(f"{path.name}: expected a PNG")
        image = source.convert("RGBA")
    alpha = image.getchannel("A")
    bounds = alpha.point(lambda value: 255 if value > 10 else 0).getbbox()
    if bounds is None:
        raise ValueError(f"{path.name}: image is empty")
    if alpha.getextrema()[0] != 0:
        raise ValueError(f"{path.name}: expected a transparent background")
    if min(bounds[2] - bounds[0], bounds[3] - bounds[1]) < 120:
        raise ValueError(f"{path.name}: artwork is too small (minimum 120 px per side)")
    image = image.crop(bounds)
    image.thumbnail((CONTENT_SIZE, CONTENT_SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE))
    canvas.alpha_composite(image, ((SIZE - image.width) // 2, (SIZE - image.height) // 2))
    result = BytesIO()
    canvas.save(result, format="PNG", optimize=True)
    return result.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--require-all", action="store_true", help="require all ten input PNGs")
    args = parser.parse_args()
    if not args.folder.is_dir():
        parser.error(f"folder does not exist: {args.folder}")
    inputs = {card: args.folder / f"aug-{card}.png" for card in CARDS}
    missing = [card for card, path in inputs.items() if not path.is_file()]
    if args.require_all and missing:
        parser.error("missing cards: " + ", ".join(missing))
    inputs = {card: path for card, path in inputs.items() if path.is_file()}
    if not inputs:
        parser.error("no recognised aug-<card>.png files found")
    # Validate the entire batch and the registry before changing project files.
    try:
        prepared = {card: prepare(path) for card, path in inputs.items()}
    except (OSError, ValueError, UnidentifiedImageError) as error:
        parser.error(str(error))
    out = ROOT / "mobile/assets/brand/taktik/aug"
    installed = [card for card in CARDS if card in prepared or (out / f"aug-{card}.png").is_file()]
    brand = ROOT / "mobile/src/lib/brand.ts"
    source = brand.read_text()
    declaration = "export const TAKTIK = {\n"
    if source.count(declaration) != 1:
        parser.error("could not locate the unique TAKTIK registry in brand.ts")
    start = source.index(declaration) + len(declaration)
    end = source.find("\n};", start)
    if end == -1:
        parser.error("could not locate the end of TAKTIK in brand.ts")
    body = source[start:end]
    block = "  aug: {\n" + "".join(
        f'    {card}: require("../../assets/brand/taktik/aug/aug-{card}.png"),\n'
        for card in installed
    ) + "  },\n"
    pattern = r"(?m)^  aug: \{\n(?:    [^\n]*\n)*  \},\n"
    if re.search(pattern, body):
        body = re.sub(pattern, lambda _: block, body, count=1)
    elif re.search(r"\baug\s*:", body):
        parser.error("unrecognised TAKTIK.aug format; registry was not changed")
    else:
        body = block + body
    updated = source[:start] + body + source[end:]
    out.mkdir(parents=True, exist_ok=True)
    for card, data in prepared.items():
        (out / f"aug-{card}.png").write_bytes(data)
        print(f"{card}: {SIZE}x{SIZE}, {len(data):,} bytes")
    if updated != source:
        brand.write_text(updated)
    print(f"TAKTIK.aug: {len(installed)} cards registered ({len(prepared)} imported)")


if __name__ == "__main__":
    main()
