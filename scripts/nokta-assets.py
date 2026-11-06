#!/usr/bin/env python3
"""The Spot's art: python3 scripts/nokta-assets.py <originals dir> -> mobile/assets/brand/nokta/.
Originals come from Codex image generation (docs/design/beyaz-nokta.md): the keeper, ball and emblem
sit on flat magenta, which is keyed out here. The originals are not committed."""
import sys
from pathlib import Path

from PIL import Image, ImageChops

OUT = Path(__file__).resolve().parent.parent / "mobile/assets/brand/nokta"


def key(path):
    """Magenta to transparent: soft at the edges, with the pink spill taken back out of them."""
    r, g, b = Image.open(path).convert("RGB").split()
    pink = ImageChops.subtract(ImageChops.darker(r, b), g)
    alpha = pink.point(lambda v: 255 - max(0, min(255, (v - 30) * 255 // 110)))
    spill = pink.point(lambda v: v if v > 30 else 0)
    return Image.merge("RGBA", (ImageChops.subtract(r, spill), g, ImageChops.subtract(b, spill), alpha))


def fit(im, size):
    im = im.crop(im.getbbox())
    im.thumbnail((size, size), Image.LANCZOS)
    return im


def main():
    src = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    pitch = Image.open(src / "spot-pitch.png").convert("RGB")
    pitch.resize((768, 1152), Image.LANCZOS).save(OUT / "nokta-pitch.jpg", quality=86, optimize=True)
    fit(key(src / "spot-keeper-coral.png"), 300).save(OUT / "nokta-keeper-o.png", optimize=True)
    fit(key(src / "spot-keeper-blue.png"), 300).save(OUT / "nokta-keeper-x.png", optimize=True)
    fit(key(src / "spot-ball.png"), 128).save(OUT / "nokta-ball.png", optimize=True)
    hero = fit(key(src / "spot-hero2.png"), 512)
    hero.save(OUT / "nokta-hero.png", optimize=True)
    fit(hero, 300).save(OUT / "nokta-icon.png", optimize=True)
    print("nokta art written")


main()
