#!/usr/bin/env python3
"""Fixture freeze + shuffle-null correlation. Stdlib + Pillow."""
from __future__ import annotations

import hashlib
import random
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "assets" / "ebs-emergency.jpg"
SHA = "ebadc920b555d92c423204e9349b49f148e1e3b533d12859ee8ea165fc43f3f2"
W, H = 1242, 1120


def jpeg_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    i = 2
    while i < len(data) - 8:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker == 0xD8:
            i += 2
            continue
        if marker == 0xD9:
            break
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i + 5 : i + 9])
            return w, h
        length = struct.unpack(">H", data[i + 2 : i + 4])[0]
        i += 2 + length
    raise RuntimeError("no SOF")


def pack_glyph(c1: int, extra: int) -> str:
    if not c1:
        return "sq1" if extra else "sq0"
    return "bar1" if extra else "bar0"


def flag_split(r: int, g: int, b: int) -> str:
    R, B = r / 255.0, b / 255.0
    c1 = 1 if (B >= R and B >= 0.35) else 0
    extra = 1 if (R >= B + 0.08 and R >= 0.35) else 0
    return pack_glyph(c1, extra)


def luma(r: int, g: int, b: int) -> float:
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0


LEVEL_LUMA = {"sq0": 0.125, "sq1": 0.375, "bar0": 0.625, "bar1": 0.875}
FLAG_LUMA = {"sq0": 0.0, "sq1": 0.2126, "bar0": 0.0722, "bar1": 0.2848}


def pearson(a: list[float], b: list[float]) -> float:
    n = min(len(a), len(b))
    if n < 2:
        return 0.0
    ma = sum(a) / n
    mb = sum(b) / n
    num = da = db = 0.0
    for i in range(n):
        xa = a[i] - ma
        xb = b[i] - mb
        num += xa * xb
        da += xa * xa
        db += xb * xb
    den = (da * db) ** 0.5
    return num / den if den else 0.0


def check(name: str, ok: bool, detail: str = "") -> None:
    status = "ok" if ok else "FAIL"
    extra = f"  {detail}" if detail else ""
    print(f"{status:4}  {name}{extra}")
    if not ok:
        raise SystemExit(1)


def pack_image(im: Image.Image, cols: int, rows: int) -> tuple[list[str], list[float]]:
    small = im.convert("RGB").resize((cols, rows), Image.Resampling.BILINEAR)
    glyphs = []
    src_luma = []
    for y in range(rows):
        for x in range(cols):
            r, g, b = small.getpixel((x, y))
            glyphs.append(flag_split(r, g, b))
            src_luma.append(luma(r, g, b))
    return glyphs, src_luma


def main() -> None:
    digest = hashlib.sha256(FIXTURE.read_bytes()).hexdigest()
    check("sha256 fixture", digest == SHA, digest)
    check("byte length", FIXTURE.stat().st_size == 299901, str(FIXTURE.stat().st_size))
    w, h = jpeg_size(FIXTURE)
    check("jpeg SOF 1242×1120", (w, h) == (W, H), f"{w}x{h}")
    im = Image.open(FIXTURE)
    check("PIL size", im.size == (W, H), str(im.size))

    cols, rows = 160, 144
    glyphs, src = pack_image(im, cols, rows)
    check("glyph count 23040", len(glyphs) == cols * rows, str(len(glyphs)))

    rec = [FLAG_LUMA[g] for g in glyphs]
    rng = random.Random(1)
    order = list(range(len(glyphs)))
    rng.shuffle(order)
    shuffled = [glyphs[i] for i in order]
    rec_sh = [FLAG_LUMA[g] for g in shuffled]
    corr = pearson(src, rec_sh)
    check("shuffle luma corr < 0.15", abs(corr) < 0.15, f"{corr:.4f}")

    # synthetic: a red/blue/black/white flag-like block must shuffle-null too
    syn = Image.new("RGB", (160, 144), (0, 0, 0))
    px = syn.load()
    for y in range(144):
        for x in range(160):
            if x < 40:
                px[x, y] = (255, 0, 0)
            elif x < 80:
                px[x, y] = (0, 0, 255)
            elif x < 120:
                px[x, y] = (255, 255, 255)
            else:
                px[x, y] = (0, 0, 0)
    g2, src2 = pack_image(syn, 160, 144)
    rng2 = random.Random(7)
    order2 = list(range(len(g2)))
    rng2.shuffle(order2)
    rec2 = [FLAG_LUMA[g2[i]] for i in order2]
    corr2 = pearson(src2, rec2)
    check("synthetic shuffle corr < 0.15", abs(corr2) < 0.15, f"{corr2:.4f}")
    print("image.py all ok")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        print("FAIL  exception", exc)
        sys.exit(1)
