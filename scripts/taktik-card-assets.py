#!/usr/bin/env python3
"""
Pitch Chess tactics card art (docs/design/taktik-kart-brief.md) → mobile/assets/brand/taktik/aug/.

Usage: python3 scripts/taktik-card-assets.py <folder with the brief's PNGs>
Crops each image to its content, resizes it for in-app use and rewrites the
`aug` map in mobile/src/lib/brand.ts for the files that exist. Needs Pillow.
"""
import re
import sys
from pathlib import Path

from PIL import Image

SRC = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "mobile" / "assets" / "brand" / "taktik" / "aug"
OUT.mkdir(parents=True, exist_ok=True)

CARDS = ["gegenpress", "bus", "longball", "wings", "academy", "signing", "legend", "intl", "cash", "crowd"]
# longest side in px: the art box is ~120 pt wide, @3x
SIZE = 360

done = []
for card in CARDS:
    path = SRC / f"aug-{card}.png"
    if not path.exists():
        print("missing", path.name)
        continue
    im = Image.open(path).convert("RGBA")
    box = im.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    im = im.crop(box)
    im.thumbnail((SIZE, SIZE), Image.LANCZOS)
    im.save(OUT / f"aug-{card}.png", optimize=True)
    done.append(card)
    print(card, im.size)

# TAKTIK.aug lists the files that exist, so a missing one keeps its emoji
brand = ROOT / "mobile" / "src" / "lib" / "brand.ts"
src = brand.read_text()
block = "  aug: {\n" + "".join(f'    {c}: require("../../assets/brand/taktik/aug/aug-{c}.png"),\n' for c in done) + "  },\n"
if re.search(r"\n  aug: \{\n(?:    [^\n]*\n)*  \},\n", src):
    src = re.sub(r"\n  aug: \{\n(?:    [^\n]*\n)*  \},\n", "\n" + block, src, count=1)
else:
    src = src.replace("export const TAKTIK = {\n", "export const TAKTIK = {\n" + block, 1)
brand.write_text(src)
print("brand.ts: TAKTIK.aug has", len(done), "cards")
