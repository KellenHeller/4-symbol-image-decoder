/* Pixel → four-symbol packing. Pure functions. No DOM. */
(function (root) {
  "use strict";

  const MAP_IDS = ["identity", "invert", "swap-shape", "swap-fill", "rotate", "shuffle"];
  const QNT_IDS = ["luma-4", "luma-chroma", "flag-split", "rgb-bit"];
  const DITHER_IDS = ["none", "ordered", "floyd"];
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const LEVEL_LUMA = { sq0: 0.125, sq1: 0.375, bar0: 0.625, bar1: 0.875 };

  function luma(r, g, b) {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function chroma(r, g, b) {
    return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  }

  function packGlyph(c1, extra) {
    if (root.Quads && root.Quads.packGlyph) return root.Quads.packGlyph(c1, extra);
    if (!c1) return extra ? "sq1" : "sq0";
    return extra ? "bar1" : "bar0";
  }

  function unpackGlyph(g) {
    if (root.Quads && root.Quads.unpackGlyph) return root.Quads.unpackGlyph(g);
    if (g === "sq0") return { c1: 0, c2: 0, c3: null };
    if (g === "sq1") return { c1: 0, c2: 1, c3: null };
    if (g === "bar0") return { c1: 1, c2: null, c3: 0 };
    if (g === "bar1") return { c1: 1, c2: null, c3: 1 };
    return { c1: 0, c2: 0, c3: null };
  }

  function mapBits(c1, extra, mapId) {
    c1 = c1 ? 1 : 0;
    extra = extra ? 1 : 0;
    if (mapId === "invert") {
      c1 ^= 1;
      extra ^= 1;
    } else if (mapId === "swap-shape") {
      c1 ^= 1;
    } else if (mapId === "swap-fill") {
      extra ^= 1;
    } else if (mapId === "rotate") {
      const w = (((c1 << 1) | extra) + 1) & 3;
      c1 = w >> 1;
      extra = w & 1;
    }
    return packGlyph(c1, extra);
  }

  function statsOf(pixels) {
    const d = pixels.data;
    const n = pixels.width * pixels.height;
    let sL = 0;
    let sC = 0;
    for (let i = 0; i < d.length; i += 4) {
      sL += luma(d[i], d[i + 1], d[i + 2]);
      sC += chroma(d[i], d[i + 1], d[i + 2]);
    }
    return { meanLuma: n ? sL / n : 0, meanChroma: n ? sC / n : 0 };
  }

  function bitsFromLuma4(L) {
    const c1 = L >= 0.5 ? 1 : 0;
    const extra = L >= 0.75 || (L < 0.5 && L >= 0.25) ? 1 : 0;
    return { c1: c1, extra: extra };
  }

  function bitsFromPixel(r, g, b, qnt, st, L) {
    if (L == null) L = luma(r, g, b);
    if (qnt === "luma-chroma") {
      return {
        c1: L >= st.meanLuma ? 1 : 0,
        extra: chroma(r, g, b) >= st.meanChroma ? 1 : 0,
      };
    }
    if (qnt === "flag-split") {
      const R = r / 255;
      const B = b / 255;
      return {
        c1: B >= R && B >= 0.35 ? 1 : 0,
        extra: R >= B + 0.08 && R >= 0.35 ? 1 : 0,
      };
    }
    if (qnt === "rgb-bit") {
      return { c1: r >= g ? 1 : 0, extra: b >= (r + g) / 2 ? 1 : 0 };
    }
    return bitsFromLuma4(L);
  }

  function orderedLuma(L, x, y) {
    const t = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    return L + (t - 0.5) * 0.25;
  }

  function floydLumaplane(pixels) {
    const w = pixels.width;
    const h = pixels.height;
    const d = pixels.data;
    const L = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        L[y * w + x] = luma(d[i], d[i + 1], d[i + 2]);
      }
    }
    const out = new Float32Array(w * h);
    const levels = [0.125, 0.375, 0.625, 0.875];
    function quant(v) {
      v = Math.max(0, Math.min(1, v));
      let best = levels[0];
      let bd = Math.abs(v - levels[0]);
      for (let i = 1; i < 4; i++) {
        const dd = Math.abs(v - levels[i]);
        if (dd < bd) {
          bd = dd;
          best = levels[i];
        }
      }
      return best;
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const old = L[i];
        const nv = quant(old);
        out[i] = nv;
        const err = old - nv;
        if (x + 1 < w) L[i + 1] += (err * 7) / 16;
        if (y + 1 < h) {
          if (x > 0) L[i + w - 1] += (err * 3) / 16;
          L[i + w] += (err * 5) / 16;
          if (x + 1 < w) L[i + w + 1] += err / 16;
        }
      }
    }
    return out;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleInPlace(glyphs, seed) {
    const rand = mulberry32((seed >>> 0) || 1);
    for (let i = glyphs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = glyphs[i];
      glyphs[i] = glyphs[j];
      glyphs[j] = t;
    }
    return glyphs;
  }

  function packImage(pixels, spec) {
    spec = spec || {};
    const cols = pixels.width;
    const rows = pixels.height;
    const qnt = QNT_IDS.indexOf(spec.qnt) >= 0 ? spec.qnt : "luma-4";
    const dither = DITHER_IDS.indexOf(spec.dither) >= 0 ? spec.dither : "none";
    const mapId = MAP_IDS.indexOf(spec.map) >= 0 ? spec.map : "identity";
    const st = statsOf(pixels);
    const d = pixels.data;
    const floyd = dither === "floyd" ? floydLumaplane(pixels) : null;
    const glyphs = new Array(cols * rows);
    const mapForPack = mapId === "shuffle" ? "identity" : mapId;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        let L = luma(d[i], d[i + 1], d[i + 2]);
        if (floyd) L = floyd[y * cols + x];
        else if (dither === "ordered") L = orderedLuma(L, x, y);
        const bits = bitsFromPixel(d[i], d[i + 1], d[i + 2], qnt, st, L);
        glyphs[y * cols + x] = mapBits(bits.c1, bits.extra, mapForPack);
      }
    }
    if (mapId === "shuffle") shuffleInPlace(glyphs, spec.seed | 0 || 1);
    return { glyphs: glyphs, cols: cols, rows: rows, stats: st };
  }

  function unpackImage(glyphs) {
    const list = glyphs || [];
    const out = [];
    for (let i = 0; i < list.length; i++) out.push(unpackGlyph(list[i]));
    return out;
  }

  function hexRgb(hex) {
    const h = String(hex || "").replace("#", "").trim();
    if (h.length < 6) return [255, 255, 255];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function reconstruct(glyphs, cols, rows, colors) {
    cols = Math.max(1, cols | 0);
    rows = Math.max(1, rows | 0);
    const data = new Uint8ClampedArray(cols * rows * 4);
    const n = Math.min(glyphs.length, cols * rows);
    for (let i = 0; i < n; i++) {
      const g = glyphs[i];
      let rgb;
      if (colors && colors[g]) rgb = colors[g];
      else {
        const L = LEVEL_LUMA[g] != null ? LEVEL_LUMA[g] : 0.5;
        const v = Math.round(L * 255);
        rgb = [v, v, v];
      }
      const o = i * 4;
      data[o] = rgb[0];
      data[o + 1] = rgb[1];
      data[o + 2] = rgb[2];
      data[o + 3] = 255;
    }
    return { width: cols, height: rows, data: data };
  }

  function bitplanes(glyphs, cols, rows) {
    cols = Math.max(1, cols | 0);
    rows = Math.max(1, rows | 0);
    const n = cols * rows;
    function blank() {
      const data = new Uint8ClampedArray(n * 4);
      for (let i = 0; i < n; i++) data[i * 4 + 3] = 255;
      return data;
    }
    const p1 = blank();
    const p2 = blank();
    const p3 = blank();
    function ink(data, i, on) {
      const v = on ? 255 : 0;
      const o = i * 4;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
    }
    const lim = Math.min(glyphs.length, n);
    for (let i = 0; i < lim; i++) {
      const u = unpackGlyph(glyphs[i]);
      ink(p1, i, !!u.c1);
      ink(p2, i, u.c1 === 0 && !!u.c2);
      ink(p3, i, u.c1 === 1 && !!u.c3);
    }
    return {
      c1: { width: cols, height: rows, data: p1 },
      c2: { width: cols, height: rows, data: p2 },
      c3: { width: cols, height: rows, data: p3 },
    };
  }

  function bitsToPlane(bits, w, h) {
    w = Math.max(1, w | 0);
    h = Math.max(1, h | 0);
    const data = new Uint8ClampedArray(w * h * 4);
    const n = w * h;
    for (let i = 0; i < n; i++) {
      const v = bits && bits[i] ? 255 : 0;
      const o = i * 4;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;
    }
    return { width: w, height: h, data: data };
  }

  function lumaBits(pixels, t) {
    const thr = t == null ? 0.5 : t;
    const d = pixels.data;
    const bits = [];
    for (let i = 0; i < d.length; i += 4) {
      bits.push(luma(d[i], d[i + 1], d[i + 2]) >= thr ? 1 : 0);
    }
    return bits;
  }

  function redBlueBits(pixels) {
    const d = pixels.data;
    const bits = [];
    for (let i = 0; i < d.length; i += 4) bits.push(d[i] >= d[i + 2] ? 1 : 0);
    return bits;
  }

  function sobelBits(pixels) {
    const w = pixels.width;
    const h = pixels.height;
    const d = pixels.data;
    function lumAt(x, y) {
      x = Math.max(0, Math.min(w - 1, x));
      y = Math.max(0, Math.min(h - 1, y));
      const i = (y * w + x) * 4;
      return luma(d[i], d[i + 1], d[i + 2]);
    }
    const mag = new Float32Array(w * h);
    let max = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx =
          lumAt(x + 1, y - 1) +
          2 * lumAt(x + 1, y) +
          lumAt(x + 1, y + 1) -
          lumAt(x - 1, y - 1) -
          2 * lumAt(x - 1, y) -
          lumAt(x - 1, y + 1);
        const gy =
          lumAt(x - 1, y + 1) +
          2 * lumAt(x, y + 1) +
          lumAt(x + 1, y + 1) -
          lumAt(x - 1, y - 1) -
          2 * lumAt(x, y - 1) -
          lumAt(x + 1, y - 1);
        const m = Math.hypot(gx, gy);
        mag[y * w + x] = m;
        if (m > max) max = m;
      }
    }
    const t = max * 0.25;
    const bits = [];
    for (let i = 0; i < mag.length; i++) bits.push(mag[i] >= t ? 1 : 0);
    return bits;
  }

  function pearson(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 2) return 0;
    let sa = 0;
    let sb = 0;
    for (let i = 0; i < n; i++) {
      sa += a[i];
      sb += b[i];
    }
    const ma = sa / n;
    const mb = sb / n;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < n; i++) {
      const xa = a[i] - ma;
      const xb = b[i] - mb;
      num += xa * xb;
      da += xa * xa;
      db += xb * xb;
    }
    const den = Math.sqrt(da * db);
    return den ? num / den : 0;
  }

  root.ImageCodec = {
    luma: luma,
    chroma: chroma,
    packGlyph: packGlyph,
    unpackGlyph: unpackGlyph,
    MAP_IDS: MAP_IDS,
    QNT_IDS: QNT_IDS,
    DITHER_IDS: DITHER_IDS,
    LEVEL_LUMA: LEVEL_LUMA,
    packImage: packImage,
    unpackImage: unpackImage,
    reconstruct: reconstruct,
    bitplanes: bitplanes,
    bitsToPlane: bitsToPlane,
    lumaBits: lumaBits,
    sobelBits: sobelBits,
    redBlueBits: redBlueBits,
    statsOf: statsOf,
    mulberry32: mulberry32,
    shuffleInPlace: shuffleInPlace,
    mapBits: mapBits,
    bitsFromPixel: bitsFromPixel,
    bitsFromLuma4: bitsFromLuma4,
    hexRgb: hexRgb,
    pearson: pearson,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
