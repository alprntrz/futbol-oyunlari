#!/usr/bin/env python3
"""Dribbling Rush art (docs/design/futbol-kosu-brief.md) → mobile/assets/brand/kosu/.

Usage: python3 scripts/kosu-assets.py docs/design/kosu-art/originals

- runner-*: kept on the shared 1024 canvas (the frames line up: feet at the same spot),
  scaled to 384 px, each split in three layers the app stacks:
    <name>.png        the figure as drawn
    <name>-cloth.png  white where the shirt / shorts / socks are (tinted with the club colour)
    <name>-shade.png  black with the cloth's folds as alpha (drawn over the tint)
- everything else: trimmed to its visible part plus a small margin, longest side 320 px
  (the goal 480 px), so the app can place it by its bottom edge.
Needs Pillow.
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "mobile" / "assets" / "brand" / "kosu"
OUT.mkdir(parents=True, exist_ok=True)

RUNNER = ["runner-run-1", "runner-run-2", "runner-run-3", "runner-run-4", "runner-jump", "runner-slide", "runner-fall", "runner-goal"]
SPRITES = {
    "obs-tackle": 320, "obs-wall": 320, "obs-defender": 320, "obs-referee": 320, "obs-cones": 320, "obs-board": 360,
    "pick-coin": 160, "pick-boots": 200, "pick-magnet": 200, "pick-armband": 200, "pick-2x": 200,
    "goal": 480, "keeper": 320, "ball": 160, "hero": 512, "hud-distance": 96, "hud-goal": 96,
}
RUNNER_SIZE = 384


def cloth_mask(im: Image.Image) -> Image.Image:
    """The kit: bright, unsaturated, opaque pixels (white shirt / shorts / socks; not skin, hair, boots or the ball's black)."""
    rgb = im.convert("RGB")
    hsv = rgb.convert("HSV")
    _, s, v = hsv.split()
    alpha = im.getchannel("A")
    bright = v.point(lambda x: 255 if x > 150 else (0 if x < 115 else int((x - 115) * 255 / 35)))
    pale = s.point(lambda x: 255 if x < 45 else (0 if x > 80 else int((80 - x) * 255 / 35)))
    m = ImageChops.multiply(ImageChops.multiply(bright, pale), alpha.point(lambda x: 255 if x > 200 else 0))
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    m = drop_ball(m, v, alpha)
    return m.filter(ImageFilter.GaussianBlur(0.8))


def drop_ball(m: Image.Image, v: Image.Image, alpha: Image.Image) -> Image.Image:
    """The ball is white too: its white patches are ringed by the black pentagons, the kit by skin,
    hair or the background. Remove the white blobs whose rim is mostly near-black."""
    w, h = m.size
    mp, vp, ap = m.load(), v.load(), alpha.load()
    seen = bytearray(w * h)
    out = m.copy()
    op = out.load()
    for y0 in range(h):
        for x0 in range(w):
            if mp[x0, y0] < 128 or seen[y0 * w + x0]:
                continue
            stack, comp = [(x0, y0)], []
            seen[y0 * w + x0] = 1
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and mp[nx, ny] >= 128:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            # the ball's black pentagons sit inside its white (white on all four sides); a sock's dark boot
            # or the hair next to the collar only borders it
            inside = set(comp)
            rows, cols = {}, {}
            for x, y in comp:
                rows.setdefault(y, []).append(x)
                cols.setdefault(x, []).append(y)
            holes = 0
            xs = [c[0] for c in comp]
            ys = [c[1] for c in comp]
            for y in range(min(ys), max(ys) + 1):
                r = rows.get(y)
                if not r:
                    continue
                for x in range(min(r), max(r) + 1):
                    if (x, y) in inside or ap[x, y] < 128 or vp[x, y] >= 70:
                        continue
                    c = cols.get(x)
                    if c and min(c) < y < max(c):
                        holes += 1
            if holes > len(comp) * 0.08 and len(comp) < 2500:
                for x, y in comp:
                    op[x, y] = 0
    return out


def runner(name: str):
    im = Image.open(SRC / f"{name}.png").convert("RGBA").resize((RUNNER_SIZE, RUNNER_SIZE), Image.LANCZOS)
    mask = cloth_mask(im)
    # the ball sits low and in front: never part of the kit
    w, h = im.size
    lum = im.convert("L")
    white = Image.new("L", im.size, 255)
    # shade: how much darker than the brightest cloth each cloth pixel is (folds, shadows)
    hist = lum.histogram(mask=mask.point(lambda x: 255 if x > 128 else 0))
    total = max(1, sum(hist))
    acc, p95 = 0, 250
    for v, c in enumerate(hist):
        acc += c
        if acc >= total * 0.95:
            p95 = v
            break
    dark = lum.point(lambda x: max(0, min(255, int((1 - x / max(1, p95)) * 255 * 1.1))))
    shade_a = ImageChops.multiply(dark, mask)
    im.save(OUT / f"{name}.png", optimize=True)
    Image.merge("RGBA", (white, white, white, mask)).save(OUT / f"{name}-cloth.png", optimize=True)
    black = Image.new("L", im.size, 0)
    Image.merge("RGBA", (black, black, black, shade_a)).save(OUT / f"{name}-shade.png", optimize=True)
    print(name, "cloth px", sum(1 for x in mask.getdata() if x > 128))


def sprite(name: str, size: int):
    im = Image.open(SRC / f"{name}.png").convert("RGBA")
    box = im.getchannel("A").point(lambda x: 255 if x > 8 else 0).getbbox()
    pad = int(max(box[2] - box[0], box[3] - box[1]) * 0.03)
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
    im = im.crop(box)
    k = size / max(im.size)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    im.save(OUT / f"{name}.png", optimize=True)
    print(name, im.size)


for n in RUNNER:
    runner(n)
for n, s in SPRITES.items():
    sprite(n, s)
print("done →", OUT)
