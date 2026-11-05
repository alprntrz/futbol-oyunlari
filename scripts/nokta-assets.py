#!/usr/bin/env python3
"""The Spot's art, drawn in code: python3 scripts/nokta-assets.py -> mobile/assets/brand/nokta/.
Stand-in until a ChatGPT brief replaces it (same file names and sizes)."""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "mobile/assets/brand/nokta"
S = 4  # drawn large, scaled down for clean edges


def art(w, h, grass):
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    W, H = w * S, h * S
    if grass:
        d.rounded_rectangle([0, H * 0.58, W, H], radius=H * 0.08, fill="#16A34A")
    left, right, top, foot = W * 0.14, W * 0.86, H * 0.12, H * 0.62
    step = (right - left) / 10
    for i in range(11):
        d.line([left + i * step, top, left + i * step, foot], fill="#94A3B8", width=S * 2)
    for i in range(6):
        y = top + (foot - top) * i / 5
        d.line([left, y, right, y], fill="#94A3B8", width=S * 2)
    post = int(H * 0.05)
    d.line([left, foot, left, top, right, top, right, foot], fill="#FFFFFF", width=post, joint="curve")
    d.line([left, foot, left, top, right, top, right, foot], fill="#0F172A", width=max(S, post // 9), joint="curve")
    cx, cy, r = W * 0.5, H * 0.8, H * 0.13
    d.ellipse([cx - r * 1.5, cy + r * 0.55, cx + r * 1.5, cy + r * 1.15], fill="#FFFFFF")
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill="#FFFFFF", outline="#0F172A", width=S * 3)
    p = r * 0.42
    d.regular_polygon((cx, cy, p), 5, fill="#0F172A")
    return im.resize((w, h), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
art(300, 266, False).save(OUT / "nokta-icon.png", optimize=True)
art(512, 379, True).save(OUT / "nokta-hero.png", optimize=True)
print("nokta art written")
