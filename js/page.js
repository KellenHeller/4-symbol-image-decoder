(() => {
  "use strict";

  const THEME_IDS = ["phosphor", "volt", "magma", "ion", "ebs", "paper", "oak"];
  const PAINT_IDS = ["toast", "meaning", "spectrum", "filled"];
  const MODE_IDS = ["direct", "textpic", "bitplane"];
  const FIXTURE = "assets/ebs-emergency.jpg";
  const DEFAULT_CAPTION = "EBS STAND BY";
  const G_SQ0 = 0;
  const G_SQ1 = 1;
  const G_BAR0 = 2;
  const G_BAR1 = 3;
  const G_CODE = { sq0: G_SQ0, sq1: G_SQ1, bar0: G_BAR0, bar1: G_BAR1 };
  const THEME = {
    stage: "#000000",
    ink: "#d8ff9a",
    muted: "#8fdc8a",
    gold: "#7dff6a",
    gold2: "#e8ff7a",
    crimson: "#ff2d7b",
    sage: "#3dfff0",
    teal: "#2ee6ff",
    bar0: "#9ad46a",
    cell: "#07140c",
  };
  let EBS_SQUARES = ["#ff0000", "#ff7a00", "#ffff00", "#00e000", "#0066ff", "#3d00cc", "#9b00ff", "#ffffff", "#000000"];
  let TOAST_INK = ["#901131", "#319011", "#113190", "#903111"];
  let TOAST_CELL = "#901171";
  let HOP_COL = ["#f4ff7a", "#9dff4a", "#3dff8a", "#2ee6c8", "#2ec8ff", "#7a8cff", "#ff4fd8"];

  const $ = (id) => document.getElementById(id);

  const state = {
    img: null,
    nativeW: 0,
    nativeH: 0,
    src: "ebs",
    fileUrl: null,
    mode: "direct",
    qnt: "luma-4",
    dither: "ordered",
    map: "identity",
    cols: 160,
    weave: "raster",
    filledFrame: false,
    gaps: true,
    theme: "ebs",
    ebsPaint: "toast",
    blend: 0,
    seed: 1,
    caption: DEFAULT_CAPTION,
    teaching: false,
    teachingData: null,
    pixels: null,
    glyphs: [],
    packCols: 160,
    packRows: 144,
    gridCols: 160,
    gridRows: 144,
    padBytes: 0,
    grid: null,
    indexAt: null,
    selected: null,
    ascii: "",
  };

  function hexRgb(hex) {
    const h = String(hex || "").replace("#", "").trim();
    if (h.length < 6) return [255, 255, 255, 255];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
  }

  function cssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function isBlackHex(hex) {
    const rgb = hexRgb(hex);
    return rgb[0] < 12 && rgb[1] < 12 && rgb[2] < 12;
  }

  function ebsOn() {
    return state.theme === "ebs";
  }

  function toastOn() {
    return ebsOn() && (state.ebsPaint === "toast" || state.ebsPaint === "filled");
  }

  function toastInk(code) {
    return TOAST_INK[(code | 0) & 3] || TOAST_INK[0];
  }

  function ebsSquareAt(i) {
    const n = EBS_SQUARES.length || 1;
    return EBS_SQUARES[((i | 0) % n + n) % n];
  }

  function rainbowAt(i) {
    return HOP_COL[Math.min(6, Math.max(0, i | 0))];
  }

  function applyTheme(id) {
    const theme = THEME_IDS.indexOf(id) >= 0 ? id : "ebs";
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    document.body.dataset.paint = state.ebsPaint;
    document.body.dataset.mode = state.mode;
    THEME.stage = cssVar("--stage") || THEME.stage;
    THEME.ink = cssVar("--ink") || THEME.ink;
    THEME.muted = cssVar("--muted") || THEME.muted;
    THEME.gold = cssVar("--gold") || THEME.gold;
    THEME.gold2 = cssVar("--gold-2") || THEME.gold2;
    THEME.crimson = cssVar("--crimson") || THEME.crimson;
    THEME.sage = cssVar("--sage") || THEME.sage;
    THEME.teal = cssVar("--teal") || THEME.teal;
    THEME.bar0 = cssVar("--bar0") || THEME.bar0;
    THEME.cell = cssVar("--cell") || THEME.cell;
    HOP_COL = [0, 1, 2, 3, 4, 5, 6].map((i) => cssVar(`--hop-${i}`) || HOP_COL[i]);
    EBS_SQUARES = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => cssVar(`--ebs-${i}`) || EBS_SQUARES[i]);
    TOAST_INK = [
      cssVar("--toast-sq0") || TOAST_INK[0],
      cssVar("--toast-sq1") || TOAST_INK[1],
      cssVar("--toast-bar0") || TOAST_INK[2],
      cssVar("--toast-bar1") || TOAST_INK[3],
    ];
    TOAST_CELL = cssVar("--toast-cell") || TOAST_CELL;
  }

  function glyphPaint(code, i) {
    if (toastOn()) return toastInk(code);
    if (ebsOn() && state.ebsPaint === "spectrum") return ebsSquareAt(i);
    if (ebsOn()) {
      if (code === G_SQ0) return "#ffffff";
      if (code === G_BAR0) return "#000000";
      return rainbowAt((i | 0) % 7);
    }
    if (code === G_SQ0) return THEME.ink;
    if (code === G_SQ1) return THEME.crimson;
    if (code === G_BAR0) return THEME.bar0;
    return THEME.sage;
  }

  function paintColors() {
    return {
      sq0: hexRgb(glyphPaint(G_SQ0, 0)).slice(0, 3),
      sq1: hexRgb(glyphPaint(G_SQ1, 1)).slice(0, 3),
      bar0: hexRgb(glyphPaint(G_BAR0, 2)).slice(0, 3),
      bar1: hexRgb(glyphPaint(G_BAR1, 3)).slice(0, 3),
    };
  }

  function drawGlyph(ctx, x, y, gw, gh, code, color) {
    const pad = Math.max(0.15, Math.min(gw, gh) * 0.12);
    const ix = x + pad;
    const iy = y + pad;
    const iw = Math.max(0.5, gw - pad * 2);
    const ih = Math.max(0.5, gh - pad * 2);
    const fill = color || THEME.ink;
    const stroke = color || (code === G_SQ1 ? THEME.crimson : THEME.sage);
    if (gw < 2.2 || gh < 2.2) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, Math.max(0.6, gw), Math.max(0.6, gh));
      return;
    }
    if (code === G_SQ0) {
      ctx.fillStyle = fill;
      ctx.fillRect(ix, iy, iw, ih);
      if (isBlackHex(fill) && Math.min(iw, ih) >= 4) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(0.6, Math.min(iw, ih) * 0.06);
        ctx.strokeRect(ix + 0.4, iy + 0.4, iw - 0.8, ih - 0.8);
      }
    } else if (code === G_SQ1) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.7, Math.min(iw, ih) * 0.12);
      ctx.strokeRect(ix + 0.4, iy + 0.4, iw - 0.8, ih - 0.8);
    } else if (code === G_BAR0) {
      const bw = iw * 0.38;
      ctx.fillStyle = fill;
      ctx.fillRect(ix + (iw - bw) / 2, iy, bw, ih);
      if (isBlackHex(fill) && ih >= 4) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(0.6, bw * 0.12);
        ctx.strokeRect(ix + (iw - bw) / 2, iy, bw, ih);
      }
    } else {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.7, iw * 0.08);
      const bw = iw * 0.22;
      ctx.beginPath();
      ctx.moveTo(ix + iw / 2 - bw, iy);
      ctx.lineTo(ix + iw / 2 - bw, iy + ih);
      ctx.moveTo(ix + iw / 2 + bw, iy);
      ctx.lineTo(ix + iw / 2 + bw, iy + ih);
      ctx.stroke();
    }
  }

  function clampCols(n) {
    n = n | 0;
    if (n < 32) return 32;
    if (n > 620) return 620;
    return n;
  }

  function rowsFor(cols, w, h) {
    if (!w || !h) return Math.max(1, Math.round(cols * 1120 / 1242));
    return Math.max(1, Math.round((cols * h) / w));
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
  }

  function downsample(img, cols, rows) {
    const c = document.createElement("canvas");
    c.width = cols;
    c.height = rows;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, cols, rows);
    const id = ctx.getImageData(0, 0, cols, rows);
    return { width: cols, height: rows, data: id.data };
  }

  function readHash() {
    const raw = (location.hash || "").replace(/^#/, "");
    if (!raw) return;
    const p = new URLSearchParams(raw);
    const mode = p.get("mode");
    if (MODE_IDS.indexOf(mode) >= 0) state.mode = mode;
    const qnt = p.get("qnt");
    if (ImageCodec.QNT_IDS.indexOf(qnt) >= 0) state.qnt = qnt;
    const dither = p.get("dither");
    if (ImageCodec.DITHER_IDS.indexOf(dither) >= 0) state.dither = dither;
    const map = p.get("map");
    if (ImageCodec.MAP_IDS.indexOf(map) >= 0) state.map = map;
    if (p.has("cols")) state.cols = clampCols(p.get("cols"));
    const weave = p.get("weave");
    if (QuadPage.WEAVE.indexOf(weave) >= 0) state.weave = weave;
    if (p.has("fill")) state.filledFrame = p.get("fill") === "1";
    if (p.has("gaps")) state.gaps = p.get("gaps") !== "0";
    const theme = p.get("theme");
    if (THEME_IDS.indexOf(theme) >= 0) state.theme = theme;
    const paint = p.get("paint");
    if (PAINT_IDS.indexOf(paint) >= 0) state.ebsPaint = paint;
    if (p.has("blend")) state.blend = Math.max(0, Math.min(1, Number(p.get("blend")) || 0));
    const src = p.get("src");
    if (src === "ebs" || src === "file") state.src = src === "file" ? "ebs" : src;
    if (p.has("seed")) state.seed = (Number(p.get("seed")) || 1) >>> 0 || 1;
    const cap = p.get("caption");
    if (cap != null && cap !== "") state.caption = cap.slice(0, 80);
    if (p.get("teach") === "1") state.teaching = true;
  }

  function writeHash() {
    const p = new URLSearchParams();
    p.set("mode", state.mode);
    p.set("qnt", state.qnt);
    p.set("dither", state.dither);
    p.set("map", state.map);
    p.set("cols", String(state.cols));
    p.set("weave", state.weave);
    p.set("fill", state.filledFrame ? "1" : "0");
    p.set("gaps", state.gaps ? "1" : "0");
    p.set("theme", state.theme);
    p.set("paint", state.ebsPaint);
    p.set("blend", String(Math.round(state.blend * 100) / 100));
    p.set("src", state.src === "file" ? "file" : "ebs");
    if (state.map === "shuffle") p.set("seed", String(state.seed));
    if (state.mode === "textpic") {
      p.set("caption", state.caption);
      if (state.teaching) p.set("teach", "1");
    }
    const next = "#" + p.toString();
    if (location.hash !== next) history.replaceState(null, "", next);
  }

  function syncControls() {
    $("mode").value = state.mode;
    $("qnt").value = state.qnt;
    $("dither").value = state.dither;
    $("map").value = state.map;
    $("cols").value = String(state.cols);
    $("weave").value = state.weave;
    $("filled-frame").checked = state.filledFrame;
    $("gaps").checked = state.gaps;
    $("theme").value = state.theme;
    $("ebs-paint").value = state.ebsPaint;
    $("blend").value = String(Math.round(state.blend * 100));
    $("caption").value = state.caption;
    $("teaching").checked = state.teaching;
    applyTheme(state.theme);
  }

  function stageSize() {
    const stage = document.querySelector(".stage");
    const r = stage.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }

  function sizeCanvas() {
    const cv = $("page");
    const sz = stageSize();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    cv.width = Math.max(1, Math.floor(sz.w * dpr));
    cv.height = Math.max(1, Math.floor(sz.h * dpr));
    cv.style.width = sz.w + "px";
    cv.style.height = sz.h + "px";
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: sz.w, h: sz.h, dpr: dpr, ctx: ctx };
  }

  function putPixels(canvas, pixels) {
    if (!pixels) return;
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    const ctx = canvas.getContext("2d");
    const img = new ImageData(pixels.data, pixels.width, pixels.height);
    ctx.putImageData(img, 0, 0);
  }

  function packNow() {
    if (!state.img) return;
    const cols = clampCols(state.cols);
    const rows = rowsFor(cols, state.nativeW, state.nativeH);
    state.pixels = downsample(state.img, cols, rows);
    state.packCols = cols;
    state.packRows = rows;
    state.padBytes = 0;
    state.ascii = "";
    const spec = {
      qnt: state.qnt,
      dither: state.dither,
      map: state.map,
      seed: state.seed,
    };
    if (state.mode === "textpic") {
      let c2;
      let c3;
      let w2;
      let h2;
      let w3;
      let h3;
      let caption = state.caption || DEFAULT_CAPTION;
      if (state.teaching && state.teachingData) {
        const t = state.teachingData;
        caption = t.ascii || "Textpic is from the future!";
        state.caption = caption;
        c2 = t.fish.bits;
        c3 = t.cross.bits;
        w2 = t.fish.w;
        h2 = t.fish.h;
        w3 = t.cross.w;
        h3 = t.cross.h;
      } else {
        c2 = ImageCodec.lumaBits(state.pixels, 0.5);
        c3 = ImageCodec.sobelBits(state.pixels);
        w2 = cols;
        h2 = rows;
        w3 = cols;
        h3 = rows;
      }
      const enc = Quads.encodeTextpic(caption, c2, c3);
      state.glyphs = enc.glyphs;
      if (state.map === "shuffle") ImageCodec.shuffleInPlace(state.glyphs, state.seed | 0 || 1);
      state.padBytes = enc.padBytes;
      const dec = Quads.decodeTextpic(enc.glyphs, w2, h2, w3, h3);
      state.ascii = dec.text;
      state.gridCols = cols;
      state.gridRows = Math.max(1, Math.ceil(state.glyphs.length / cols));
      state._textpicPlanes = {
        c2: ImageCodec.bitsToPlane(dec.a, w2, h2),
        c3: ImageCodec.bitsToPlane(dec.b, w3, h3),
      };
    } else {
      const packed = ImageCodec.packImage(state.pixels, spec);
      state.glyphs = packed.glyphs;
      state.gridCols = cols;
      state.gridRows = rows;
      state._textpicPlanes = null;
    }
    const grid = { cols: state.gridCols, rows: state.gridRows, n: state.glyphs.length };
    const indexAt = [];
    for (let r = 0; r < grid.rows; r++) {
      indexAt[r] = [];
      for (let c = 0; c < grid.cols; c++) indexAt[r][c] = -1;
    }
    for (let i = 0; i < state.glyphs.length; i++) {
      const p = QuadPage.slotPos(i, grid, state.weave);
      if (p.row >= 0 && p.row < grid.rows && p.col >= 0 && p.col < grid.cols) {
        indexAt[p.row][p.col] = i;
      }
    }
    state.grid = grid;
    state.indexAt = indexAt;
  }

  function drawDecode() {
    const colors = paintColors();
    const rec = ImageCodec.reconstruct(state.glyphs, state.gridCols, state.gridRows, colors);
    putPixels($("reconstruct"), rec);
    if (state.mode === "textpic" && state._textpicPlanes) {
      const split = Quads.split(state.glyphs);
      putPixels($("plane-c1"), ImageCodec.bitsToPlane(split.c1, state.gridCols, state.gridRows));
      putPixels($("plane-c2"), state._textpicPlanes.c2);
      putPixels($("plane-c3"), state._textpicPlanes.c3);
    } else {
      const planes = ImageCodec.bitplanes(state.glyphs, state.packCols, state.packRows);
      putPixels($("plane-c1"), planes.c1);
      putPixels($("plane-c2"), planes.c2);
      putPixels($("plane-c3"), planes.c3);
    }
    $("inspect-text").textContent = state.ascii || "—";
  }

  function drawPage() {
    const sized = sizeCanvas();
    const ctx = sized.ctx;
    const cols = state.gridCols || 1;
    const rows = state.gridRows || 1;
    state.grid.cellW = sized.w / cols;
    state.grid.cellH = sized.h / rows;
    ctx.fillStyle = THEME.stage;
    ctx.fillRect(0, 0, sized.w, sized.h);
    const filled = state.filledFrame || state.ebsPaint === "filled";
    const n = state.glyphs.length;
    for (let i = 0; i < n; i++) {
      const p = QuadPage.slotPos(i, state.grid, state.weave);
      const rect = QuadPage.cellRect(p.col, p.row, state.grid);
      const code = G_CODE[state.glyphs[i]] || 0;
      const color = glyphPaint(code, i);
      let x = rect.x;
      let y = rect.y;
      let w = rect.w;
      let h = rect.h;
      if (state.gaps) {
        const gap = Math.max(0.35, Math.min(w, h) * 0.08);
        x += gap / 2;
        y += gap / 2;
        w = Math.max(0.5, w - gap);
        h = Math.max(0.5, h - gap);
      }
      if (filled) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
      } else {
        drawGlyph(ctx, x, y, w, h, code, color);
      }
    }
    if (state.selected) {
      const rect = QuadPage.cellRect(state.selected.col, state.selected.row, state.grid);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(1, rect.w - 1), Math.max(1, rect.h - 1));
    }
    const blendSrc = $("blend-src");
    blendSrc.style.opacity = String(state.blend);
    $("page").style.opacity = state.blend >= 0.995 ? "0.22" : String(1 - state.blend * 0.55);
  }

  function updateReadout() {
    const src = state.src === "file" ? "file" : "ebs";
    $("source-note").textContent =
      state.nativeW + "×" + state.nativeH + " → " + state.packCols + "×" + state.packRows + " glyphs";
    $("grid-readout").textContent = state.gridCols + "×" + state.gridRows + "  " + state.glyphs.length + " marks";
    let status =
      src +
      "  mode=" +
      state.mode +
      "  qnt=" +
      state.qnt +
      "  dither=" +
      state.dither +
      "  map=" +
      state.map;
    if (state.map === "shuffle") status += "  seed=" + state.seed;
    if (state.mode === "textpic") status += "  padBytes=" + state.padBytes;
    if (state.map === "shuffle") status += "  (shuffled — not a found picture)";
    $("pack-status").textContent = status;
    if (state.selected) {
      $("sel-readout").textContent = state.selected.col + "," + state.selected.row + "  " + state.selected.glyph;
    } else {
      $("sel-readout").textContent = "—";
    }
  }

  function inspectAt(col, row) {
    if (!state.indexAt || !state.indexAt[row]) return;
    const i = state.indexAt[row][col];
    if (i == null || i < 0) return;
    const glyph = state.glyphs[i];
    const u = ImageCodec.unpackGlyph(glyph);
    let rgba = "—";
    let L = "—";
    if (state.pixels && i < state.packCols * state.packRows && state.mode !== "textpic") {
      const o = i * 4;
      const r = state.pixels.data[o];
      const g = state.pixels.data[o + 1];
      const b = state.pixels.data[o + 2];
      const a = state.pixels.data[o + 3];
      rgba = r + "," + g + "," + b + "," + a;
      L = ImageCodec.luma(r, g, b).toFixed(3);
    } else if (state.pixels && state.mode === "textpic" && !state.teaching) {
      const pc = i % state.packCols;
      const pr = Math.min(state.packRows - 1, Math.floor(i / state.packCols));
      const o = (pr * state.packCols + pc) * 4;
      if (o + 3 < state.pixels.data.length) {
        const r = state.pixels.data[o];
        const g = state.pixels.data[o + 1];
        const b = state.pixels.data[o + 2];
        rgba = r + "," + g + "," + b + "," + state.pixels.data[o + 3];
        L = ImageCodec.luma(r, g, b).toFixed(3);
      }
    }
    const extra = u.c1 ? u.c3 : u.c2;
    state.selected = { col: col, row: row, index: i, glyph: glyph };
    $("inspect-line").textContent =
      col + " " + row + "  " + glyph + "  c1=" + u.c1 + " extra=" + extra + "  rgba " + rgba + "  luma " + L;
    $("sel-readout").textContent = col + "," + row + "  " + glyph;
  }

  function render() {
    if (!state.img) return;
    applyTheme(state.theme);
    packNow();
    drawPage();
    drawDecode();
    updateReadout();
    writeHash();
  }

  function applyPreset(name) {
    if (name === "noise") {
      state.mode = "direct";
      state.qnt = "luma-4";
      state.dither = "ordered";
      state.map = "identity";
      state.weave = "raster";
      state.filledFrame = false;
      state.gaps = true;
      state.theme = "ebs";
      state.ebsPaint = "toast";
      state.blend = 0;
      state.cols = 160;
      state.teaching = false;
    } else if (name === "signal") {
      state.mode = "direct";
      state.qnt = "flag-split";
      state.dither = "none";
      state.map = "identity";
      state.weave = "raster";
      state.filledFrame = true;
      state.gaps = false;
      state.theme = "ebs";
      state.ebsPaint = "toast";
      state.blend = 0;
      state.cols = 160;
      state.teaching = false;
    } else if (name === "shuffle") {
      state.mode = "direct";
      state.qnt = "flag-split";
      state.dither = "none";
      state.map = "shuffle";
      state.weave = "raster";
      state.filledFrame = true;
      state.gaps = false;
      state.theme = "ebs";
      state.ebsPaint = "toast";
      state.blend = 0;
      state.cols = 160;
      state.teaching = false;
      state.seed = (Math.floor(Math.random() * 0xffffffff) || 1) >>> 0;
    }
    syncControls();
    render();
  }

  function bind() {
    $("mode").addEventListener("change", () => {
      state.mode = $("mode").value;
      render();
    });
    $("qnt").addEventListener("change", () => {
      state.qnt = $("qnt").value;
      render();
    });
    $("dither").addEventListener("change", () => {
      state.dither = $("dither").value;
      render();
    });
    $("map").addEventListener("change", () => {
      state.map = $("map").value;
      if (state.map === "shuffle" && !state.seed) state.seed = 1;
      render();
    });
    $("caption").addEventListener("change", () => {
      state.caption = $("caption").value.slice(0, 80);
      render();
    });
    $("teaching").addEventListener("change", () => {
      state.teaching = $("teaching").checked;
      if (state.teaching && state.teachingData) state.caption = state.teachingData.ascii;
      render();
    });
    $("cols").addEventListener("input", () => {
      state.cols = clampCols($("cols").value);
      $("source-note").textContent =
        state.nativeW + "×" + state.nativeH + " → " + state.cols + "×" + rowsFor(state.cols, state.nativeW, state.nativeH) + " glyphs";
    });
    $("cols").addEventListener("change", () => {
      state.cols = clampCols($("cols").value);
      render();
    });
    $("weave").addEventListener("change", () => {
      state.weave = $("weave").value;
      render();
    });
    $("filled-frame").addEventListener("change", () => {
      state.filledFrame = $("filled-frame").checked;
      render();
    });
    $("gaps").addEventListener("change", () => {
      state.gaps = $("gaps").checked;
      render();
    });
    $("theme").addEventListener("change", () => {
      state.theme = $("theme").value;
      render();
    });
    $("ebs-paint").addEventListener("change", () => {
      state.ebsPaint = $("ebs-paint").value;
      render();
    });
    $("blend").addEventListener("input", () => {
      state.blend = ($("blend").value | 0) / 100;
      $("blend-src").style.opacity = String(state.blend);
      $("page").style.opacity = state.blend >= 0.995 ? "0.22" : String(1 - state.blend * 0.55);
      writeHash();
    });
    $("fit").addEventListener("click", () => drawPage());
    $("preset-noise").addEventListener("click", () => applyPreset("noise"));
    $("preset-signal").addEventListener("click", () => applyPreset("signal"));
    $("preset-shuffle").addEventListener("click", () => applyPreset("shuffle"));
    $("file").addEventListener("change", async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      if (state.fileUrl) URL.revokeObjectURL(state.fileUrl);
      state.fileUrl = URL.createObjectURL(file);
      const img = await loadImage(state.fileUrl);
      state.img = img;
      state.nativeW = img.naturalWidth;
      state.nativeH = img.naturalHeight;
      state.src = "file";
      $("source").src = state.fileUrl;
      $("blend-src").src = state.fileUrl;
      render();
    });
    $("page").addEventListener("click", (ev) => {
      if (!state.grid) return;
      const rect = $("page").getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const hit = QuadPage.hitPos(x, y, state.grid);
      if (!hit) return;
      inspectAt(hit.col, hit.row);
      drawPage();
    });
    window.addEventListener("resize", () => {
      if (state.glyphs.length) drawPage();
    });
    window.addEventListener("hashchange", () => {
      readHash();
      syncControls();
      render();
    });
  }

  async function boot() {
    readHash();
    bind();
    try {
      const r = await fetch("data/textpic-teaching.json");
      state.teachingData = await r.json();
    } catch (err) {
      state.teachingData = null;
    }
    const img = await loadImage(FIXTURE);
    state.img = img;
    state.nativeW = img.naturalWidth;
    state.nativeH = img.naturalHeight;
    if (state.src !== "file") {
      $("source").src = FIXTURE;
      $("blend-src").src = FIXTURE;
      state.src = "ebs";
    }
    syncControls();
    render();
  }

  boot();
})();
