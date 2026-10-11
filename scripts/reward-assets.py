#!/usr/bin/env python3
"""
Reward art (docs/design/oyun-hissi-brief.md) → mobile/assets/brand/odul/.

Usage: python3 scripts/reward-assets.py <folder with the brief's PNGs>
Crops each image to its content and resizes it for in-app use; the star
background stays a square tile. Needs Pillow.
"""
import sys
from pathlib import Path

from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "mobile" / "assets" / "brand" / "odul"
OUT.mkdir(parents=True, exist_ok=True)

# longest side in px (@3x of the largest on-screen size)
SIZES = {
    "laurel-gold": 660, "laurel-silver": 660, "medal-gold": 420, "trophy-cup": 300,
    "ribbon-banner": 900, "panel-frame": 600, "reward-xp": 240, "reward-series": 240,
    "reward-games": 240, "chest-football": 420, "chest-football-open": 420, "level-badge": 240,
}

for name, size in SIZES.items():
    im = Image.open(SRC / f"{name}.png").convert("RGBA")
    box = im.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    im = im.crop(box)
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(OUT / f"{name}.png", optimize=True)
    print(name, im.size)

bg = Image.open(SRC / "bg-stars.png").convert("RGB").resize((256, 256), Image.LANCZOS)
bg.save(OUT / "bg-stars.png", optimize=True)
print("bg-stars", bg.size)
