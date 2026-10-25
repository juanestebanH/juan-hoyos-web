// Loader "Firma técnica": un plano blueprint (canvas 2D) que se traza solo
// revelando la firma JUAN HOYOS con cabezal de trazado y líneas de cota.
// Al entrar, el plano se corta en teselas que caen con gravedad y rotación,
// con energía ligada al envelope de la música.

interface Tile {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  t0: number;
  alpha: number;
  spawned: boolean;
}

export interface BlueprintLoader {
  setProgress(p: number): void;
  reveal(getLevel: () => number): Promise<void>;
  destroy(): void;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const NAME = 'JUAN HOYOS';
const COLS = 22;
const ROWS = 14;
const GRAVITY = 850;
const BG = '#000';

function pad(n: number, len: number): string {
  return String(Math.max(0, Math.round(n))).padStart(len, '0');
}

export function createBlueprintLoader(
  canvas: HTMLCanvasElement,
): BlueprintLoader | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');
  if (!ctx || !offCtx) return null;

  let w = 0;
  let h = 0;
  let tileW = 0;
  let tileH = 0;

  let progress = 0;
  let mode: 'draw' | 'shatter' = 'draw';
  let tiles: Tile[] = [];
  let levelFn: (() => number) | null = null;
  let running = true;
  let raf = 0;
  let last = performance.now();
  let revealElapsed = 0;
  let flash = 0;
  let resolveReveal: (() => void) | null = null;
  let now = 0;
  let grainTile: HTMLCanvasElement | null = null;

  // ── Geometría de la firma (se recalcula al resize) ──
  let fontPx = 96;
  let tracking = 6;
  let totalW = 0;
  let startX = 0;
  let baseY = 0;
  let charWidths: number[] = [];
  let chars: string[] = [];

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    for (const c of [canvas, off]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Métricas del texto
    fontPx = Math.min(w * 0.13, 150);
    tracking = fontPx * 0.07;
    offCtx.font = `700 ${fontPx}px ${MONO}`;
    chars = [...NAME];
    charWidths = chars.map((ch) => offCtx.measureText(ch).width);
    totalW = charWidths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
    startX = (w - totalW) / 2;
    baseY = h * 0.42;

    tileW = w / COLS;
    tileH = h / ROWS;
    if (mode === 'shatter') initTiles();
  }

  // ── Utilidades de dibujo del plano ──
  function drawChars(c: CanvasRenderingContext2D, endIndex: number) {
    let x = startX;
    for (let i = 0; i < chars.length; i++) {
      if (endIndex >= 0 && i > endIndex) break;
      c.fillText(chars[i], x, baseY);
      x += charWidths[i] + tracking;
    }
  }

  function makeGrain(size = 96): HTMLCanvasElement {
    const g = document.createElement('canvas');
    g.width = size;
    g.height = size;
    const gc = g.getContext('2d')!;
    const img = gc.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    gc.putImageData(img, 0, 0);
    return g;
  }

  // Matriz de puntos con fade radial + viñeta + grano de película.
  function drawBackground(c: CanvasRenderingContext2D, pulse: number) {
    const cx = w / 2;
    const cy = h / 2;
    const maxDist = Math.hypot(cx, cy);

    // Puntos
    const spacing = 28;
    for (let y = spacing / 2; y < h; y += spacing) {
      for (let x = spacing / 2; x < w; x += spacing) {
        const d = Math.hypot(x - cx, y - cy) / maxDist;
        const fade = 1 - d * d;
        if (fade <= 0.03) continue;
        const a = 0.14 * fade * (0.72 + 0.28 * pulse);
        c.fillStyle = `rgba(200, 215, 235, ${a})`;
        c.beginPath();
        c.arc(x, y, 1.05, 0, Math.PI * 2);
        c.fill();
      }
    }

    // Viñeta
    const vg = c.createRadialGradient(cx, cy, Math.min(w, h) * 0.12, cx, cy, maxDist);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(0.68, 'rgba(0, 0, 0, 0.35)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0.82)');
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);

    // Grano de película
    if (grainTile) {
      const pat = c.createPattern(grainTile, 'repeat');
      if (pat) {
        c.save();
        c.globalAlpha = 0.05;
        const ox = -((Math.random() * grainTile.width) | 0);
        const oy = -((Math.random() * grainTile.height) | 0);
        c.translate(ox, oy);
        c.fillStyle = pat;
        c.fillRect(-ox, -oy, w, h);
        c.restore();
      }
    }
  }

  function drawBrackets(c: CanvasRenderingContext2D) {
    const m = 26;
    const len = 26;
    c.save();
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(226, 232, 240, 0.4)';
    const corners: [number, number, number, number][] = [
      [m, m, 1, 1],
      [w - m, m, -1, 1],
      [m, h - m, 1, -1],
      [w - m, h - m, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      c.beginPath();
      c.moveTo(x + sx * len, y);
      c.lineTo(x, y);
      c.lineTo(x, y + sy * len);
      c.stroke();
    }
    c.restore();
  }

  function drawCrosshair(c: CanvasRenderingContext2D, pulse: number) {
    const cx = w / 2;
    const cy = h / 2;
    c.save();
    c.strokeStyle = `rgba(180, 200, 228, ${0.08 + pulse * 0.05})`;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx + 0.5, 0);
    c.lineTo(cx + 0.5, h);
    c.moveTo(0, cy + 0.5);
    c.lineTo(w, cy + 0.5);
    c.stroke();
    c.restore();
  }

  function arrow(
    c: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ) {
    const ang = Math.atan2(toY - fromY, toX - fromX);
    const size = 7;
    c.beginPath();
    c.moveTo(toX, toY);
    c.lineTo(toX - size * Math.cos(ang - 0.4), toY - size * Math.sin(ang - 0.4));
    c.lineTo(toX - size * Math.cos(ang + 0.4), toY - size * Math.sin(ang + 0.4));
    c.closePath();
    c.fill();
  }

  function drawDimensions(c: CanvasRenderingContext2D, p: number) {
    const top = baseY - fontPx * 0.72;
    const bottom = baseY + fontPx * 0.72;
    const right = startX + totalW;
    const left = startX;
    const dimP = Math.max(0, Math.min(1, (p - 0.08) / 0.55));
    if (dimP <= 0) return;

    c.save();
    c.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    c.fillStyle = 'rgba(226, 232, 240, 0.55)';
    c.lineWidth = 1;
    c.font = `500 10px ${MONO}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    // Cota horizontal (arriba)
    const dimY = top - 34;
    const lineX1 = left;
    const lineX2 = left + totalW * dimP;
    c.beginPath();
    c.moveTo(lineX1, dimY);
    c.lineTo(lineX2, dimY);
    c.stroke();
    // guías verticales
    c.beginPath();
    c.moveTo(left, top - 6);
    c.lineTo(left, dimY + 6);
    if (dimP >= 1) {
      c.moveTo(right, top - 6);
      c.lineTo(right, dimY + 6);
    }
    c.stroke();
    if (dimP > 0.02) arrow(c, lineX2, dimY, lineX1, dimY);
    if (dimP >= 1) {
      arrow(c, lineX1, dimY, lineX2, dimY);
      c.fillText(`W ${Math.round(totalW)}`, (left + right) / 2, dimY - 12);
    }

    // Cota vertical (derecha)
    const dimX = right + 46;
    const vTop = top;
    const vBottom = top + (bottom - top) * dimP;
    c.beginPath();
    c.moveTo(dimX, vTop);
    c.lineTo(dimX, vBottom);
    c.stroke();
    c.beginPath();
    c.moveTo(right + 6, top);
    c.lineTo(dimX + 6, top);
    if (dimP >= 1) {
      c.moveTo(right + 6, bottom);
      c.lineTo(dimX + 6, bottom);
    }
    c.stroke();
    if (dimP >= 1) {
      arrow(c, dimX, vBottom, dimX, vTop);
      c.save();
      c.translate(dimX + 14, (vTop + vBottom) / 2);
      c.rotate(-Math.PI / 2);
      c.fillText(`H ${Math.round(bottom - top)}`, 0, 0);
      c.restore();
    }

    c.restore();
  }

  function drawBlueprint(p: number, pulse: number) {
    const c = offCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.fillStyle = BG;
    c.fillRect(0, 0, w, h);

    drawBackground(c, pulse);
    drawCrosshair(c, pulse);
    drawBrackets(c);

    const penX = startX + totalW * p;

    // Etiquetas técnicas en canvas
    c.save();
    c.font = `500 10px ${MONO}`;
    c.fillStyle = 'rgba(159, 180, 214, 0.5)';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('ELEV 01 · FRONT', 24, 24);
    c.fillText('DIM mm', 24, 40);
    c.textAlign = 'right';
    c.fillText(
      `x ${pad(penX, 4)} · y ${pad(h - baseY, 5)}`,
      w - 24,
      24,
    );
    c.restore();

    // Firma fantasma (objetivo)
    c.save();
    c.font = `700 ${fontPx}px ${MONO}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.globalAlpha = 0.09;
    c.fillStyle = '#9fb4d6';
    drawChars(c, -1);
    c.restore();

    // Firma trazada (recortada por el avance del cabezal)
    if (p > 0) {
      c.save();
      c.font = `700 ${fontPx}px ${MONO}`;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.beginPath();
      c.rect(startX - 6, baseY - fontPx, totalW * p + 12, fontPx * 2);
      c.clip();
      c.fillStyle = '#ffffff';
      c.shadowColor = 'rgba(255,255,255,0.5)';
      c.shadowBlur = 10 + pulse * 14;
      drawChars(c, -1);
      c.restore();
    }

    // Cabezal de trazado
    if (p > 0 && p < 1) {
      const top = baseY - fontPx * 0.78;
      const bottom = baseY + fontPx * 0.78;
      c.save();
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(penX, top);
      c.lineTo(penX, bottom);
      c.stroke();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(penX, baseY, 3.5, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    drawDimensions(c, p);
  }

  // ── Teselas del shatter ──
  function initTiles() {
    tiles = [];
    const cx = w / 2;
    const cy = h / 2;
    const maxDist = Math.hypot(cx, cy);
    for (let gy = 0; gy < ROWS; gy++) {
      for (let gx = 0; gx < COLS; gx++) {
        const px = gx * tileW + tileW / 2;
        const py = gy * tileH + tileH / 2;
        const dist = Math.hypot(px - cx, py - cy);
        tiles.push({
          sx: gx * tileW * dpr,
          sy: gy * tileH * dpr,
          sw: tileW * dpr,
          sh: tileH * dpr,
          x: gx * tileW,
          y: gy * tileH,
          vx: 0,
          vy: 0,
          rot: 0,
          vrot: 0,
          t0: (dist / maxDist) * 1.5 + Math.random() * 0.35,
          alpha: 1,
          spawned: false,
        });
      }
    }
  }

  function spawn(t: Tile, lvl: number, dx: number, dy: number) {
    const ang = Math.atan2(dy, dx);
    t.vx = Math.cos(ang) * (30 + Math.random() * 110) + (Math.random() - 0.5) * 60;
    t.vy = -(60 + Math.random() * 160) - lvl * 300;
    t.vrot = (Math.random() - 0.5) * (2.5 + lvl * 4);
    t.spawned = true;
  }

  function updateShatter(dt: number) {
    const cx = w / 2;
    const cy = h / 2;
    revealElapsed += dt;
    flash = Math.max(0, flash - dt * 1.2);

    let alive = 0;
    for (const t of tiles) {
      if (revealElapsed < t.t0) {
        alive++;
        continue;
      }
      if (!t.spawned) {
        const dx = t.x + tileW / 2 - cx;
        const dy = t.y + tileH / 2 - cy;
        spawn(t, levelFn ? levelFn() : 0, dx, dy);
      }
      t.vy += GRAVITY * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.rot += t.vrot * dt;
      const life = revealElapsed - t.t0;
      t.alpha = Math.max(0, 1 - life / 2.0);
      if (t.alpha > 0.001) alive++;
    }

    if (alive === 0 && resolveReveal) {
      const done = resolveReveal;
      resolveReveal = null;
      done();
    }
  }

  function drawShatter() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    for (const t of tiles) {
      if (t.alpha <= 0.001) continue;
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.translate(t.x + tileW / 2, t.y + tileH / 2);
      ctx.rotate(t.rot);
      ctx.drawImage(
        off,
        t.sx,
        t.sy,
        t.sw,
        t.sh,
        -tileW / 2,
        -tileH / 2,
        tileW,
        tileH,
      );
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(-tileW / 2, -tileH / 2, tileW, tileH);
      ctx.restore();
    }

    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = flash * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const t = performance.now();
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    now = t;

    if (mode === 'draw') {
      const pulse = 0.5 + 0.5 * Math.sin(t / 420);
      drawBlueprint(progress, pulse);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, w, h);
    } else {
      updateShatter(dt);
      drawShatter();
    }
  }

  grainTile = makeGrain();
  resize();
  window.addEventListener('resize', resize);
  raf = requestAnimationFrame(frame);

  return {
    setProgress(p: number) {
      progress = Math.min(1, Math.max(0, p));
    },

    reveal(getLevel: () => number) {
      levelFn = getLevel;
      return new Promise<void>((res) => {
        mode = 'shatter';
        revealElapsed = 0;
        flash = 0.7;
        initTiles();
        resolveReveal = res;
      });
    },

    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    },
  };
}
