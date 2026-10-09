#!/usr/bin/env python3
"""Generates deterministic fake "photos" and face crops for the mock Immich server.

Output: .cache/images/{asset-<n>.jpg,person-<n>.jpg}. Nothing here is a real photo,
so the screenshots can be committed without privacy or licensing worries.
"""
import colorsys
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).parent / ".cache" / "images"
ASSETS = 24
PEOPLE = 6
W, H = 1600, 1067


def hsv(h, s, v):
    r, g, b = colorsys.hsv_to_rgb(h % 1.0, s, v)
    return int(r * 255), int(g * 255), int(b * 255)


def scene(seed):
    rnd = random.Random(seed)
    hue = rnd.random()
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):  # sky gradient
        t = y / H
        d.line([(0, y), (W, y)], fill=hsv(hue + 0.08 * t, 0.45 - 0.2 * t, 0.55 + 0.4 * t))
    sx, sy = rnd.randint(200, W - 200), rnd.randint(120, 380)
    d.ellipse([sx - 90, sy - 90, sx + 90, sy + 90], fill=hsv(hue + 0.1, 0.15, 1.0))
    for layer in range(3):  # hills
        base = H * (0.55 + 0.13 * layer)
        pts = [(0, H)]
        for x in range(0, W + 40, 40):
            pts.append((x, base + rnd.randint(-70, 70) + 40 * ((x // 40) % 3)))
        pts.append((W, H))
        d.polygon(pts, fill=hsv(hue + 0.3 + 0.05 * layer, 0.5, 0.55 - 0.12 * layer))
    return img.filter(ImageFilter.GaussianBlur(3))


def face(seed):
    rnd = random.Random(1000 + seed)
    size = 400
    img = Image.new("RGB", (size, size), hsv(rnd.random(), 0.3, 0.9))
    d = ImageDraw.Draw(img)
    skin = hsv(0.07 + rnd.random() * 0.03, 0.35 + rnd.random() * 0.2, 0.75 + rnd.random() * 0.2)
    d.ellipse([70, 160, 330, 480], fill=hsv(rnd.random(), 0.5, 0.5))  # shoulders
    d.ellipse([110, 70, 290, 290], fill=skin)
    d.pieslice([100, 50, 300, 250], 180, 360, fill=hsv(rnd.random() * 0.15, 0.6, 0.3))  # hair
    for ex in (155, 245):
        d.ellipse([ex - 12, 160, ex + 12, 184], fill=(40, 30, 30))
    d.arc([160, 200, 240, 260], 20, 160, fill=(120, 50, 50), width=5)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for n in range(ASSETS):
        scene(n).save(OUT / f"asset-{n}.jpg", quality=85)
    for n in range(PEOPLE):
        face(n).save(OUT / f"person-{n}.jpg", quality=88)
    print(f"wrote {ASSETS} photos and {PEOPLE} faces to {OUT}", file=sys.stderr)


main()
