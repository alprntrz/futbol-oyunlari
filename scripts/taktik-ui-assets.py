#!/usr/bin/env python3
"""Pitch Chess set-up screen 3D parts (docs/design/taktik-ekran-brief.md) → mobile/assets/brand/taktik/ui/.

Usage: python3 scripts/taktik-ui-assets.py <folder with the brief's PNGs>
Crops each transparent PNG to its content, resizes it for in-app use and rewrites
TAKTIK.ui in mobile/src/lib/brand.ts for the files that exist. Needs Pillow.
"""
import re
import sys
from pathlib import Path

from PIL import Image

SRC = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "mobile" / "assets" / "brand" / "taktik" / "ui"
OUT.mkdir(parents=True, exist_ok=True)

# name → longest side in px (@3x of the on-screen size); the toy pitch is kept uncropped so slot maths stay fixed
PARTS = {"heart": 96, "coin": 96, "flame": 96, "stopwatch": 96, "ball": 120, "wand": 72, "reroll": 96, "xp": 96, "scout": 180}
done = []
for name, size in PARTS.items():
    path = SRC / f"ui-{name}.png"
    if not path.exists():
        print("missing", path.name)
        continue
    im = Image.open(path).convert("RGBA")
    im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox())
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(OUT / f"ui-{name}.png", optimize=True)
    done.append(name)
    print(name, im.size)

pitch = SRC / "pitch-toy.png"
if pitch.exists():
    im = Image.open(pitch).convert("RGBA")
    # cropped to the pitch itself: the screen places the spots against the picture's edges (oyun.tsx FIELD)
    im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox())
    im.thumbnail((1100, 1100), Image.LANCZOS)
    # the screen behind it is plain #F1F4F1 (C.bg): flattened onto it, a JPEG is a tenth of the PNG
    flat = Image.new("RGBA", im.size, (241, 244, 241, 255))
    flat.alpha_composite(im)
    (OUT / "pitch-toy.png").unlink(missing_ok=True)
    flat.convert("RGB").save(OUT / "pitch-toy.jpg", quality=86, optimize=True, progressive=True)
    done.append("pitch")
    print("pitch", im.size)

keys = [n for n in PARTS if (OUT / f"ui-{n}.png").exists()]
block = "  ui: {\n" + "".join(f'    {n}: require("../../assets/brand/taktik/ui/ui-{n}.png"),\n' for n in keys)
if (OUT / "pitch-toy.jpg").exists():
    block += '    pitch: require("../../assets/brand/taktik/ui/pitch-toy.jpg"),\n'
block += "  },\n"
brand = ROOT / "mobile" / "src" / "lib" / "brand.ts"
src = brand.read_text()
pattern = r"\n  ui: \{\n(?:    [^\n]*\n)*  \},\n"
src = re.sub(pattern, "\n" + block, src, count=1) if re.search(pattern, src) else src.replace("export const TAKTIK = {\n", "export const TAKTIK = {\n" + block, 1)
brand.write_text(src)
print("TAKTIK.ui:", len(keys), "icons")
