#!/usr/bin/env python3
"""
Give the game icons (mobile/assets/brand/icon-*.png) the same optical size and
margin: each is cropped to its content and scaled so its filled area matches the
others (a round icon and a wide one look equally big), never beyond 82% of the
canvas. Run after scripts/brand-assets.py. Needs Pillow.
"""
from pathlib import Path

from PIL import Image

DIR = Path(__file__).resolve().parent.parent / "mobile" / "assets" / "brand"
SIZE = 192
MAX_SIDE = 0.82   # longest side, of the canvas
TARGET_AREA = 0.46  # filled pixels, of the canvas

for path in sorted(DIR.glob("icon-*.png")):
    im = Image.open(path).convert("RGBA")
    alpha = im.getchannel("A")
    im = im.crop(alpha.point(lambda v: 255 if v > 20 else 0).getbbox())
    filled = sum(1 for v in im.getchannel("A").getdata() if v > 128)
    # scale for equal filled area, capped so the longest side fits the margin
    k = min((TARGET_AREA * SIZE * SIZE / filled) ** 0.5, MAX_SIDE * SIZE / max(im.size))
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2), im)
    out.save(path, optimize=True)
    print(path.name, im.size)
