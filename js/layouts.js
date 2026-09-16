/* Weave helpers for the image decoder. No DOM. Raster / boustrophedon / spiral / columns. */
(function (root) {
  "use strict";

  const WEAVE = ["raster", "boustrophedon", "spiral", "columns"];

  function spiralCoords(cols, rows) {
    const out = [];
    let top = 0;
    let left = 0;
    let bottom = rows - 1;
    let right = cols - 1;
    while (top <= bottom && left <= right) {
      for (let c = left; c <= right; c++) out.push({ c: c, r: top });
      top += 1;
      for (let r = top; r <= bottom; r++) out.push({ c: right, r: r });
      right -= 1;
      if (top <= bottom) {
        for (let c = right; c >= left; c--) out.push({ c: c, r: bottom });
        bottom -= 1;
      }
      if (left <= right) {
        for (let r = bottom; r >= top; r--) out.push({ c: left, r: r });
        left += 1;
      }
    }
    return out;
  }

  function slotPos(i, grid, weave) {
    const cols = grid.cols;
    const rows = grid.rows;
    const n = Math.max(0, i | 0);
    const id = WEAVE.indexOf(weave) >= 0 ? weave : "raster";
    if (id === "columns") {
      return { col: Math.floor(n / rows) % cols, row: n % rows };
    }
    if (id === "boustrophedon") {
      const row = Math.floor(n / cols) % rows;
      const raw = n % cols;
      return { col: row % 2 ? cols - 1 - raw : raw, row: row };
    }
    if (id === "spiral") {
      if (!grid._spiral || grid._spiralCols !== cols || grid._spiralRows !== rows) {
        grid._spiral = spiralCoords(cols, rows);
        grid._spiralCols = cols;
        grid._spiralRows = rows;
      }
      const p = grid._spiral[n];
      return p ? { col: p.c, row: p.r } : { col: 0, row: 0 };
    }
    return { col: n % cols, row: Math.floor(n / cols) % rows };
  }

  function hitPos(x, y, grid) {
    if (!grid) return null;
    const col = Math.floor(x / grid.cellW);
    const row = Math.floor(y / grid.cellH);
    if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return null;
    return { col: col, row: row };
  }

  function cellRect(col, row, grid) {
    return {
      x: col * grid.cellW,
      y: row * grid.cellH,
      w: grid.cellW,
      h: grid.cellH,
    };
  }

  root.QuadPage = {
    WEAVE: WEAVE,
    spiralCoords: spiralCoords,
    slotPos: slotPos,
    hitPos: hitPos,
    cellRect: cellRect,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
