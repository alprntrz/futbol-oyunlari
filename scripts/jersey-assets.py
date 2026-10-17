#!/usr/bin/env python3
"""Shirt layers from the white shirt renders (docs/design/forma-brief.md) → mobile/assets/brand/jersey-*.

Usage: python3 scripts/jersey-assets.py <folder with jersey-{crew,vneck,polo,keeper}.png>

Each render is a white shirt with black collar / cuffs on transparent. It becomes five
layers the app stacks in components/Jersey.tsx:
  body     white silhouette (tinted with the kit's body colour)
  sleeves  white sleeves (tinted with the sleeve colour)
  trim     white collar / cuffs / placket (tinted with the trim colour)
  shade    grey folds and shadows, multiplied over the colours
  gloss    white highlights, drawn on top
Needs Pillow.
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageOps

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "mobile" / "assets" / "brand"
SIZE = 384


def runs(row):
    """(start, end) of the opaque runs in one row of an alpha mask"""
    out, start = [], None
    for x, v in enumerate(row + [0]):
        if v > 128 and start is None:
            start = x
        elif v <= 128 and start is not None:
            out.append((start, x - 1))
            start = None
    return out


def sleeve_mask(alpha: Image.Image) -> Image.Image:
    """The sleeves: above the armpits, what sticks out past the torso; below, any separate run (long sleeves)."""
    w, h = alpha.size
    box = alpha.getbbox()
    px = alpha.load()
    cx = (box[0] + box[2]) // 2
    rows = {y: runs([px[x, y] for x in range(w)]) for y in range(box[1], box[3])}
    mid = {y: next((r for r in rs if r[0] <= cx <= r[1]), None) for y, rs in rows.items()}
    span = lambda y: (mid[y][1] - mid[y][0]) if mid[y] else 0
    # the torso's width: the middle of the shirt, below the short sleeves
    lo, hi = box[1] + int((box[3] - box[1]) * 0.6), box[1] + int((box[3] - box[1]) * 0.8)
    torso_w = sorted(span(y) for y in range(lo, hi))[(hi - lo) // 2]
    # the armpit: going down from the shoulders, where the row stops being much wider than the torso
    ys = sorted(rows)
    first_wide = next((y for y in ys if span(y) > torso_w + 40), ys[0])
    armpit = next((y for y in ys if y > first_wide and span(y) <= torso_w + 40), first_wide)
    # the torso's sides just under the armpit
    under = mid[min(armpit + 6, ys[-1])] or (cx - torso_w // 2, cx + torso_w // 2)
    left, right = under[0] + 2, under[1] - 2
    out = Image.new("L", (w, h), 0)
    op = out.load()
    for y, rs in rows.items():
        for x in range(w):
            if px[x, y] <= 10:
                continue
            m = mid[y]
            separate = not m or x < m[0] or x > m[1]
            if separate or (y <= armpit and (x < left or x > right)):
                op[x, y] = 255
    return out.filter(ImageFilter.GaussianBlur(1.2))


for variant in ["crew", "vneck", "polo", "keeper"]:
    path = SRC / f"jersey-{variant}.png"
    if not path.exists():
        print("missing", path.name)
        continue
    im = Image.open(path).convert("RGBA")
    alpha = im.getchannel("A")
    rgb = im.convert("RGB")
    lum = ImageOps.grayscale(rgb)
    # trim: the black collar / cuffs / placket (dark, opaque)
    r, g, b = rgb.split()
    darkest = ImageChops.lighter(ImageChops.lighter(r, g), b)  # max channel
    trim = darkest.point(lambda v: 255 if v < 70 else (0 if v > 120 else int(255 * (120 - v) / 50)))
    trim = ImageChops.multiply(trim, alpha)
    sleeves_m = sleeve_mask(alpha)
    bx = alpha.getbbox()
    top = Image.new("L", im.size, 0)
    top.paste(255, (0, 0, im.size[0], bx[1] + int((bx[3] - bx[1]) * 0.38)))
    # dark shadows elsewhere (between a long sleeve and the torso) are not trim
    trim = ImageChops.multiply(trim, ImageChops.lighter(top, sleeves_m.point(lambda v: 255 if v > 128 else 0)))
    # collars and cuffs are thick bands; thin dark lines (shadows) drop out
    trim = trim.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MaxFilter(3))
    # shade: the cloth's luminance stretched so its brightest part is white; the trim stays white (it's tinted itself)
    cloth = ImageChops.subtract(alpha.point(lambda v: 255 if v > 200 else 0), trim)
    hist = lum.histogram(mask=cloth)
    total = sum(hist)
    acc, p60, p95 = 0, 200, 250
    for v, c in enumerate(hist):
        acc += c
        if acc >= total * 0.6 and p60 == 200:
            p60 = v
        if acc >= total * 0.95:
            p95 = v
            break
    shade_l = lum.point(lambda v: min(255, round(v * 255 / max(p95, 1))))
    shade_l = Image.composite(Image.new("L", im.size, 255), shade_l, trim)
    shade = Image.merge("RGBA", (shade_l, shade_l, shade_l, alpha))
    # gloss: where the cloth is brighter than most of it, as soft white
    gloss_a = lum.point(lambda v: 0 if v <= p60 else min(255, round((v - p60) * 255 / max(1, 255 - p60))))
    gloss_a = ImageChops.multiply(gloss_a, cloth).filter(ImageFilter.GaussianBlur(2))
    white = Image.new("L", im.size, 255)
    gloss = Image.merge("RGBA", (white, white, white, gloss_a))
    body = Image.merge("RGBA", (white, white, white, alpha))
    sleeves_a = ImageChops.multiply(alpha, sleeves_m)
    sleeves = Image.merge("RGBA", (white, white, white, sleeves_a))
    trim_l = Image.merge("RGBA", (white, white, white, trim))
    box = alpha.getbbox()
    side = max(box[2] - box[0], box[3] - box[1])
    cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
    square = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
    for layer, img in [("body", body), ("sleeves", sleeves), ("trim", trim_l), ("shade", shade), ("gloss", gloss)]:
        img.crop(square).resize((SIZE, SIZE), Image.LANCZOS).save(OUT / f"jersey-{variant}-{layer}.png", optimize=True)
    print(variant, "p60", p60, "p95", p95)
print("done")
