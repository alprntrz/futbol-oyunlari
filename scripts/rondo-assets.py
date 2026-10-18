#!/usr/bin/env python3
"""
Rondo art (docs/design/rondo-brief.md) → mobile/assets/brand/rondo/.

Usage: python3 scripts/rondo-assets.py docs/design/rondo-art/originals
Crops each image to its content and resizes it for in-app use (@3x). Needs Pillow.
"""
import sys
from pathlib import Path

from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "mobile" / "assets" / "brand" / "rondo"
OUT.mkdir(parents=True, exist_ok=True)

# longest side in px
FILES = {"rondo-icon": 300, "rondo-hero": 512, "rondo-turn": 120}

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
    print(name, im.size, (OUT / f"{name}.png").stat().st_size // 1024, "KB")
