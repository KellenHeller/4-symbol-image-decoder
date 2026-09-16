# Four-symbol image decoder

Private local app that packs a picture into Drew/Rodney four-symbol glyphs (`sq0` / `sq1` / `bar0` / `bar1`) and lets you tune that field from noise to signal.

**Independent packing of a picture in Drew/Rodney four marks. Not a claim the cartoon was written as quads.**

- Local: `http://127.0.0.1:8560/`
- Tree: `/home/luke/4-symbol-image-decoder`
- Unit: `four-symbol-image-decoder.service`
- GitHub: `KellenHeller/4-symbol-image-decoder` (**private**, no Pages)

This is not the four-symbol page (`:8558`) and not the 2D replica (`:8765`). Codec and chrome were copied, then this tree stands alone. No `corpus.json`. No GitHub Pages.

## Run

```bash
systemctl --user start four-symbol-image-decoder.service
# or, if the unit is not installed yet:
./serve.sh
python3 tests/codec.py
python3 tests/image.py
```

Private clone (no Pages):

```bash
gh repo clone KellenHeller/4-symbol-image-decoder
cd 4-symbol-image-decoder
python3 -m http.server 8560 --bind 127.0.0.1
```

## Default load

**Noise** preset: Direct mode, `luma-4`, ordered dither, identity map, raster weave, filled-frame off, gaps on, theme `ebs`, paint `toast`, blend 0, 160×144 glyphs. The middle should read as a dense four-ink grid, not as the cartoon.

**Signal:** `flag-split`, no dither, filled-frame on, gaps off — flag stripes and EMERGENCY letterforms in the glyph field.

**Shuffle:** same as Signal with `map=shuffle` (Fisher–Yates, `seed=` in the hash). The picture must disappear. Shuffle is a control, not a found-message label.

**Blend:** `0` = glyphs only. `1` = original under the stage at full opacity (canvas fades). Mid values ghost the cartoon through the grid.

## Modes

- **Direct (A):** one glyph per downsampled pixel. Quantizers: `luma-4`, `luma-chroma`, `flag-split`, `rgb-bit`.
- **TEXTPIC (B):** caption as Code 1, luma-threshold bitmap as C2, Sobel edges as C3 (or the teaching fish/cross).
- **Bitplane (C):** Direct packing; right rail splits C1 / C2 / C3.

The original picture stays in the top-right **Selected rectangle** slot. Clicking a middle cell inspects under it and does not replace the image.

## Fixture

`assets/ebs-emergency.jpg` — 1242×1120, SHA-256 `ebadc920…f3f2`. Editorial illustration, not relicensed by the MIT grant on the code.

Layout lock: left toggles, giant middle decode, original in the selected-rectangle slot.
