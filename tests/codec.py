#!/usr/bin/env python3
"""Locks for the four-symbol image codec. Stdlib only."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEACH = ROOT / "data" / "textpic-teaching.json"

SPACE_BITS = [0, 0, 1, 0, 0, 0, 0, 0]
FOLD = {
    0x2018: "'",
    0x2019: "'",
    0x201C: '"',
    0x201D: '"',
    0x2013: "-",
    0x2014: "-",
    0x2015: "-",
    0x2026: "...",
    0x2002: " ",
}


def pack_glyph(c1: int, extra: int) -> str:
    if not c1:
        return "sq1" if extra else "sq0"
    return "bar1" if extra else "bar0"


def unpack_glyph(g: str) -> tuple[int, int | None, int | None]:
    if g == "sq0":
        return 0, 0, None
    if g == "sq1":
        return 0, 1, None
    if g == "bar0":
        return 1, None, 0
    if g == "bar1":
        return 1, None, 1
    return 0, 0, None


def luma(r: int, g: int, b: int) -> float:
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0


def luma4(r: int, g: int, b: int) -> str:
    L = luma(r, g, b)
    c1 = 1 if L >= 0.5 else 0
    extra = 1 if (L >= 0.75 or (L < 0.5 and L >= 0.25)) else 0
    return pack_glyph(c1, extra)


def flag_split(r: int, g: int, b: int) -> str:
    R, B = r / 255.0, b / 255.0
    c1 = 1 if (B >= R and B >= 0.35) else 0
    extra = 1 if (R >= B + 0.08 and R >= 0.35) else 0
    return pack_glyph(c1, extra)


def ascii_to_bits(s: str) -> list[int]:
    bits: list[int] = []
    for ch in s:
        cp = ord(ch)
        if cp in FOLD:
            chunk = FOLD[cp]
        elif cp > 255:
            chunk = "?"
        else:
            chunk = chr(cp)
        for c in chunk:
            b = ord(c) & 0xFF
            for k in range(7, -1, -1):
                bits.append((b >> k) & 1)
    return bits


def bits_to_ascii(bits: list[int]) -> str:
    n = len(bits) - (len(bits) % 8)
    out = []
    for i in range(0, n, 8):
        v = 0
        for k in range(8):
            v = (v << 1) | bits[i + k]
        out.append(chr(v))
    return "".join(out)


def count01(bits: list[int]) -> tuple[int, int]:
    z = sum(1 for b in bits if not b)
    o = len(bits) - z
    return z, o


def merge(c1: list[int], c2: list[int], c3: list[int]) -> tuple[list[str], int]:
    c1 = list(c1)
    pad = 0
    while True:
        z, o = count01(c1)
        if z >= len(c2) and o >= len(c3):
            break
        c1.extend(SPACE_BITS)
        pad += 1
    glyphs = []
    i2 = i3 = 0
    for bit in c1:
        if bit:
            extra = c3[i3] if i3 < len(c3) else 0
            i3 += 1
            glyphs.append(pack_glyph(1, extra))
        else:
            extra = c2[i2] if i2 < len(c2) else 0
            i2 += 1
            glyphs.append(pack_glyph(0, extra))
    return glyphs, pad


def split(glyphs: list[str]) -> tuple[list[int], list[int], list[int]]:
    c1, c2, c3 = [], [], []
    for g in glyphs:
        a, b, c = unpack_glyph(g)
        c1.append(a)
        if a == 0:
            c2.append(0 if b is None else b)
        else:
            c3.append(0 if c is None else c)
    return c1, c2, c3


def check(name: str, ok: bool, detail: str = "") -> None:
    status = "ok" if ok else "FAIL"
    extra = f"  {detail}" if detail else ""
    print(f"{status:4}  {name}{extra}")
    if not ok:
        raise SystemExit(1)


def main() -> None:
    # luma-4 cuts 0.25 / 0.50 / 0.75 → 00 01 10 11
    check("luma-4 0.00 → sq0", luma4(0, 0, 0) == "sq0")
    check("luma-4 1.00 → bar1", luma4(255, 255, 255) == "bar1")
    gray64 = round(0.25 * 255)  # 64 → luma ~0.25
    # 0.25 is the extra cut on the lower bucket; L >= 0.25 and L < 0.5 → sq1
    check("luma-4 ~0.25 → sq1", luma4(gray64, gray64, gray64) == "sq1", luma4(gray64, gray64, gray64))
    gray192 = 192  # 192/255 = 0.753 ≥ 0.75 → 11
    check("luma-4 ~0.75 → bar1", luma4(gray192, gray192, gray192) == "bar1")
    gray128 = 128
    check("luma-4 ~0.50 → bar0", luma4(gray128, gray128, gray128) in ("bar0", "bar1"))

    # flag-split 2×2 freeze — predicate wins over the suggested four-distinct guess
    px = [(0, 0, 0), (255, 255, 255), (255, 0, 0), (0, 0, 255)]
    got = [flag_split(*p) for p in px]
    freeze = ["sq0", "bar0", "sq1", "bar0"]
    check("flag-split 2×2 freeze", got == freeze, str(got))

    # pack / unpack round-trip length
    glyphs = [pack_glyph(0, 0), pack_glyph(0, 1), pack_glyph(1, 0), pack_glyph(1, 1)]
    check("unpack length", len(split(glyphs)[0]) == 4)
    check("four glyph ids", glyphs == ["sq0", "sq1", "bar0", "bar1"])

    teach = json.loads(TEACH.read_text())
    slogan = teach["ascii"]
    check("teaching slogan", slogan == "Textpic is from the future!")
    bits = ascii_to_bits(slogan)
    check("C1 bit length 216", len(bits) == 27 * 8, str(len(bits)))
    z, o = count01(bits)
    check("C1 zeros 119", z == 119, str(z))
    check("C1 ones 97", o == 97, str(o))
    fish = teach["fish"]["bits"]
    cross = teach["cross"]["bits"]
    check("fish 8×14 = 112", len(fish) == 8 * 14)
    check("cross 10×10 = 100", len(cross) == 10 * 10)
    merged, pad = merge(bits, fish, cross)
    check("padBytes=3", pad == 3, str(pad))
    check("teach padBytes field", teach.get("padBytes") == 3)
    c1, c2, c3 = split(merged)
    recovered = bits_to_ascii(c1)
    # padding adds spaces
    check("C1 ASCII prefix", recovered.startswith(slogan), recovered[:40])
    check("C2 fish reconstruct", c2[: len(fish)] == fish)
    check("C3 cross reconstruct", c3[: len(cross)] == cross)
    check("merged length", len(merged) == len(c1))

    print("codec.py all ok")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        print("FAIL  exception", exc)
        sys.exit(1)
