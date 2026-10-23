"""Android notification icon (white on transparent, 96 px) from the adaptive-icon foreground.

The ball's silhouette in white with the gold question mark cut out, so it reads at status-bar size.
Usage: python3 scripts/notification-icon.py  →  mobile/assets/brand/notification-icon.png
"""
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "mobile/assets/brand/android-icon-foreground.png"
OUT = ROOT / "mobile/assets/brand/notification-icon.png"
SIZE = 96

img = Image.open(SRC).convert("RGBA")
hsv = img.convert("RGB").convert("HSV")
ball = img.getchannel("A").point(lambda a: 255 if a > 128 else 0)
# gold: hue around 30–50°, well saturated and bright
h, s, v = hsv.split()
gold = Image.new("L", img.size, 0)
gold_px = gold.load()
hp, sp, vp = h.load(), s.load(), v.load()
w, hgt = img.size
for y in range(hgt):
    for x in range(w):
        if 20 <= hp[x, y] <= 40 and sp[x, y] > 120 and vp[x, y] > 120:
            gold_px[x, y] = 255
gold = gold.filter(ImageFilter.MaxFilter(9))  # widen the cut so it survives the downscale
alpha = Image.composite(Image.new("L", img.size, 0), ball, gold)
box = alpha.getbbox()
alpha = alpha.crop(box)
side = max(alpha.size)
square = Image.new("L", (side, side), 0)
square.paste(alpha, ((side - alpha.width) // 2, (side - alpha.height) // 2))
pad = int(side * 0.08)
canvas = Image.new("L", (side + 2 * pad, side + 2 * pad), 0)
canvas.paste(square, (pad, pad))
mask = canvas.resize((SIZE, SIZE), Image.LANCZOS)
icon = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 0))
icon.putalpha(mask)
icon.save(OUT)
print(f"wrote {OUT.relative_to(ROOT)} ({SIZE}x{SIZE})")
