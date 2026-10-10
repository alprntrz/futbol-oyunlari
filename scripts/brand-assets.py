#!/usr/bin/env python3
"""
Turn the generated brand images (docs/design/ikon-brief.md) into app assets.

Usage: python3 scripts/brand-assets.py <source dir with the 23 PNGs>
Writes to mobile/assets/brand/. Needs Pillow.

- icons / illustrations / logo: cropped to content, resized to in-app size
- shirts: split into three layers per collar style, coloured at runtime:
    <name>-body.png     white silhouette (tinted with the kit body colour)
    <name>-sleeves.png  white sleeve area (tinted with the kit sleeve colour)
    <name>-shade.png    neutral grey folds/shadows (multiplied on top)
- tab icons: black template glyphs at @1x/@2x/@3x (25 pt), equal weight
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "mobile" / "assets" / "brand"
OUT.mkdir(parents=True, exist_ok=True)


def clean_alpha(im: Image.Image, cutoff=40, erode=3) -> Image.Image:
    """Drop faint matte noise and the dark fringe left by background removal."""
    a = im.getchannel("A").point(lambda v: 255 if v > cutoff else 0)
    if erode:
        a = a.filter(ImageFilter.MinFilter(erode))
    a = a.filter(ImageFilter.GaussianBlur(0.8))
    im = im.copy()
    im.putalpha(a)
    return im


def fit(im: Image.Image, size: tuple[int, int], margin=0.06) -> Image.Image:
    """Crop to visible content and centre it on a transparent canvas of `size`."""
    box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    im = im.crop(box)
    w, h = size
    scale = min(w * (1 - 2 * margin) / im.width, h * (1 - 2 * margin) / im.height)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(im, ((w - im.width) // 2, (h - im.height) // 2))
    return canvas


def load(name: str) -> Image.Image:
    return Image.open(SRC / f"{name}.png").convert("RGBA")


# ── App icon, Android foreground, splash: keep full size (build-time assets)
load("app-icon").convert("RGB").save(OUT / "app-icon.png", optimize=True)
load("android-icon-foreground").save(OUT / "android-icon-foreground.png", optimize=True)
fit(clean_alpha(load("splash-logo"), erode=0), (512, 512), margin=0.02).save(OUT / "splash-logo.png", optimize=True)

# ── Mode icons: shown at ~44–56 pt → 192 px covers @3x
for name in ["icon-daily", "icon-practice", "icon-team", "icon-race", "icon-tiki"]:
    fit(clean_alpha(load(name), erode=0), (192, 192), margin=0.04).save(OUT / f"{name}.png", optimize=True)

# ── Illustrations: shown ~200–240 pt wide → 720 px
for name in ["illus-empty-stats", "illus-win", "illus-finish", "illus-howto"]:
    im = clean_alpha(load(name), erode=0)
    box = im.getchannel("A").getbbox()
    im = im.crop(box)
    im.thumbnail((720, 480), Image.LANCZOS)
    im.save(OUT / f"{name}.png", optimize=True)

# ── Waiting room: phones without the ball (kept uncropped so the in-app ball
# path can use the original coordinates) + the ball as its own sprite.
# Ball centre/radius and the throw points are measured on the 1536×1024 image;
# mobile/src/components/WaitingAnimation.tsx uses the same numbers.
BALL_C, BALL_R = (838, 292), 122
room = load("illus-waiting-room")
ball = room.crop((BALL_C[0] - BALL_R, BALL_C[1] - BALL_R, BALL_C[0] + BALL_R, BALL_C[1] + BALL_R))
disc = Image.new("L", ball.size, 0)
ImageDraw.Draw(disc).ellipse((2, 2, ball.width - 3, ball.height - 3), fill=255)
ball.putalpha(ImageChops.multiply(ball.getchannel("A"), disc))
ball.resize((128, 128), Image.LANCZOS).save(OUT / "illus-waiting-ball.png", optimize=True)
hole = Image.new("L", room.size, 255)
ImageDraw.Draw(hole).ellipse((BALL_C[0] - BALL_R - 4, BALL_C[1] - BALL_R - 4, BALL_C[0] + BALL_R + 4, BALL_C[1] + BALL_R + 4), fill=0)
room.putalpha(ImageChops.multiply(room.getchannel("A"), hole))
room.resize((720, 480), Image.LANCZOS).save(OUT / "illus-waiting-room.png", optimize=True)

# ── Shirts
# Sleeve seam on the left half of the 1024 canvas as (y, x) points, measured on
# the generated images; everything left of it is sleeve. Mirrored for the right.
# Short sleeves end at the armpit, so below it the seam steps out of the body;
# the keeper's long sleeves run down beside the torso.
SEAM_SHORT = [(0, 190), (150, 196), (250, 210), (330, 230), (405, 250), (470, 250), (490, 110), (1024, 110)]
SEAM_LONG = [(0, 190), (150, 196), (250, 210), (330, 230), (405, 250), (1024, 256)]


def sleeve_region(seam) -> Image.Image:
    def seam_x(y: float) -> float:
        for (y0, x0), (y1, x1) in zip(seam, seam[1:]):
            if y0 <= y <= y1:
                return x0 + (x1 - x0) * (y - y0) / (y1 - y0)
        return seam[-1][1]

    region = Image.new("L", (1024, 1024), 0)
    px = region.load()
    for y in range(1024):
        sx = seam_x(y)
        for x in range(1024):
            if x < sx or x > 1024 - sx:
                px[x, y] = 255
    return region


REGIONS = {"short": sleeve_region(SEAM_SHORT), "long": sleeve_region(SEAM_LONG)}

JERSEY_SIZE = 256
for variant in ["vneck", "crew", "polo", "keeper"]:
    im = clean_alpha(load(f"jersey-{variant}"))
    alpha = im.getchannel("A")
    # Neutral shading: luminance, stretched so the brightest cloth is pure white
    lum = ImageOps.grayscale(im.convert("RGB"))
    hist = lum.histogram(mask=alpha.point(lambda v: 255 if v > 200 else 0))
    total, acc, p96 = sum(hist), 0, 255
    for v, c in enumerate(hist):
        acc += c
        if acc >= total * 0.96:
            p96 = v
            break
    lum = lum.point(lambda v: min(255, round(v * 255 / max(p96, 1))))
    shade = Image.merge("RGBA", (lum, lum, lum, alpha))
    white = Image.new("L", im.size, 255)
    body = Image.merge("RGBA", (white, white, white, alpha))
    sleeves = Image.merge("RGBA", (white, white, white, ImageChops.multiply(alpha, REGIONS["long" if variant == "keeper" else "short"])))
    box = alpha.getbbox()
    side = max(box[2] - box[0], box[3] - box[1])
    cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
    square = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
    for layer, img in [("body", body), ("sleeves", sleeves), ("shade", shade)]:
        img.crop(square).resize((JERSEY_SIZE, JERSEY_SIZE), Image.LANCZOS).save(OUT / f"jersey-{variant}-{layer}.png", optimize=True)

# ── Tab icons: black template glyphs, 25 pt canvas, equal visual weight
THICKEN = {"tab-stats-line": 15, "tab-stats-fill": 7}  # the stats set came out thinner
for name in ["tab-games-fill", "tab-games-line", "tab-stats-fill", "tab-stats-line", "tab-settings-fill", "tab-settings-line"]:
    im = load(name)
    a = im.getchannel("A").point(lambda v: 255 if v > 100 else 0)
    if name in THICKEN:
        a = a.filter(ImageFilter.MaxFilter(THICKEN[name]))
    glyph = Image.merge("RGBA", (Image.new("L", im.size, 0),) * 3 + (a,))
    for scale, suffix in [(1, ""), (2, "@2x"), (3, "@3x")]:
        fit(glyph, (25 * scale, 25 * scale), margin=0.04).save(OUT / f"{name}{suffix}.png", optimize=True)

print("wrote", len(list(OUT.glob("*.png"))), "files to", OUT)
