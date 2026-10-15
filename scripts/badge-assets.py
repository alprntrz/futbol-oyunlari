#!/usr/bin/env python3
"""
Badge art and the Card Duel icon (docs/design/rozet-brief.md) → mobile/assets/brand/rozet/.

Usage: python3 scripts/badge-assets.py <folder with the brief's PNGs>
Crops each image to its content and resizes it for in-app use. Needs Pillow.
"""
import sys
from pathlib import Path

from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "mobile" / "assets" / "brand" / "rozet"
OUT.mkdir(parents=True, exist_ok=True)

BADGES = ["firstGame", "allGames", "streak7", "streak30", "level10", "level20", "level40", "wins10", "wins50", "trophies5", "perfectDuel", "dailyDuel7"]
# longest side in px (@3x of the on-screen size)
FILES = {**{f"badge-{b}": 180 for b in BADGES}, "icon-duel": 240}

for name, size in FILES.items():
    path = SRC / f"{name}.png"
    if not path.exists():
        print("missing", name)
        continue
    im = Image.open(path).convert("RGBA")
    box = im.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    im = im.crop(box)
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(OUT / f"{name}.png", optimize=True)
    print(name, im.size)
