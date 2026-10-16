#!/usr/bin/env python3
"""Pitch Chess match pitch art (docs/design/taktik-saha-brief.md) → mobile/assets/brand/taktik/pitch/.

Usage: python3 scripts/taktik-pitch-assets.py <folder with the brief's PNGs>
Crops transparent parts to their content, resizes everything for in-app use and
rewrites TAKTIK.pitch in mobile/src/lib/brand.ts for the files that exist (a
missing part keeps being drawn in code). Needs Pillow.
"""
import re
import sys
from pathlib import Path

from PIL import Image

SRC = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "mobile" / "assets" / "brand" / "taktik" / "pitch"
OUT.mkdir(parents=True, exist_ok=True)

# name → (longest side in px, opaque?)
PARTS = {
    "grass": (1200, True),
    "goal-left": (180, False),
    "goal-right": (180, False),
    "ball": (48, False),
    "shadow": (96, False),
    "flash-goal": (420, False),
}

done = []
for name, (size, opaque) in PARTS.items():
    path = SRC / f"pitch-{name}.png"
    if not path.exists():
        print("missing", path.name)
        continue
    im = Image.open(path).convert("RGB" if opaque else "RGBA")
    if not opaque:
        box = im.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
        if box is None:
            print("empty", path.name)
            continue
        im = im.crop(box)
    im.thumbnail((size, size), Image.LANCZOS)
    # the grass is opaque and big: a JPEG is a fraction of the PNG's size
    if opaque:
        (OUT / f"pitch-{name}.png").unlink(missing_ok=True)
        im.save(OUT / f"pitch-{name}.jpg", quality=84, optimize=True, progressive=True)
    else:
        im.save(OUT / f"pitch-{name}.png", optimize=True)
    done.append(name)
    print(name, im.size)

key = lambda n: re.sub(r"-(\w)", lambda m: m.group(1).upper(), n)
brand = ROOT / "mobile" / "src" / "lib" / "brand.ts"
src = brand.read_text()
ext = lambda n: "jpg" if PARTS[n][1] else "png"
installed = [n for n in PARTS if (OUT / f"pitch-{n}.{ext(n)}").exists()]
block = "  pitch: {\n" + "".join(f'    {key(n)}: require("../../assets/brand/taktik/pitch/pitch-{n}.{ext(n)}"),\n' for n in installed) + "  },\n"
pattern = r"\n  pitch: \{\n(?:    [^\n]*\n)*  \},\n"
if re.search(pattern, src):
    src = re.sub(pattern, "\n" + block, src, count=1)
else:
    src = src.replace("export const TAKTIK = {\n", "export const TAKTIK = {\n" + block, 1)
brand.write_text(src)
print("TAKTIK.pitch:", len(installed), "parts")
