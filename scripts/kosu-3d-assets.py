#!/usr/bin/env python3
"""Dribbling Rush 3D textures (docs/design/kosu-3d-brief.md) → unity/DribblingRush/Assets/Resources/Art/.

Usage: python3 scripts/kosu-3d-assets.py docs/design/kosu-art/originals/3d

- crowd: seamless both ways (the stands repeat it along and up), 1024 px wide
- board-1 … board-4: the plain bands above and below the graphic cut off, seamless along, 1024 px wide
- backdrop: as drawn, 2048 px wide
Edges are made seamless by cross-fading the last stretch into the first (the picture gets that much
narrower). Written as JPEG (Unity compresses them again); the backdrop is a PNG whose top fades out, and import
stays readable (RushArtImport in RushBuild.cs), as the game reads the sky colour from it. The HUD icons (pick-jet, pick-spring) go through
scripts/kosu-assets.py. Needs Pillow.
"""
import sys
from pathlib import Path

from PIL import Image, ImageStat

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "unity" / "DribblingRush" / "Assets" / "Resources" / "Art"
OUT.mkdir(parents=True, exist_ok=True)


def seamless_x(im: Image.Image, share: float = 0.08) -> Image.Image:
    w, h = im.size
    o = int(w * share)
    out = im.crop((0, 0, w - o, h))
    tail = im.crop((w - o, 0, w, h))
    head = im.crop((0, 0, o, h))
    ramp = Image.linear_gradient("L").rotate(90, expand=True).resize((o, h))  # 255 at the left → 0 at the right
    out.paste(Image.composite(tail, head, ramp), (0, 0))
    return out


def seamless_y(im: Image.Image, share: float = 0.08) -> Image.Image:
    return seamless_x(im.rotate(90, expand=True), share).rotate(-90, expand=True)


def trim_bands(im: Image.Image) -> Image.Image:
    """Cut plain rows (one flat colour) off the top and bottom."""
    w, h = im.size
    busy = [sum(ImageStat.Stat(im.crop((0, y, w, y + 1))).stddev) > 12 for y in range(h)]
    top = busy.index(True)
    bottom = h - busy[::-1].index(True)
    return im.crop((0, top, w, bottom))


def save(im: Image.Image, name: str, width: int):
    k = width / im.width
    im = im.resize((width, round(im.height * k)), Image.LANCZOS)
    im.save(OUT / f"{name}.jpg", quality=88)
    print(name, im.size)


def load(name: str) -> Image.Image | None:
    for ext in ("png", "jpg", "jpeg"):
        p = SRC / f"{name}.{ext}"
        if p.exists():
            return Image.open(p).convert("RGB")
    return None


if (im := load("crowd")) is not None:
    save(seamless_y(seamless_x(im)), "crowd", 1024)
for i in range(1, 5):
    if (im := load(f"board-{i}")) is not None:
        save(seamless_x(trim_bands(im)), f"board-{i}", 1024)
if (im := load("backdrop")) is not None:
    # the top fades out into the sky colour the game paints behind it (PNG for the alpha)
    im = im.resize((2048, round(im.height * 2048 / im.width)), Image.LANCZOS).convert("RGBA")
    fade = round(im.height * 0.22)
    alpha = Image.new("L", im.size, 255)
    for y in range(fade):
        alpha.paste(round(255 * (y / fade) ** 1.5), (0, y, im.width, y + 1))
    im.putalpha(alpha)
    im.save(OUT / "backdrop.png", optimize=True)
    print("backdrop", im.size)
print("done →", OUT)
