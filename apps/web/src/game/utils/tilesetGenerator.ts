import { TILE_SIZE } from "../config/constants";

const T = TILE_SIZE; // 32
export const NUM_TILESET_TILES = 12;

/**
 * Tile-index constants shared with WorldGenerator.
 * The tileset is a vertical strip: tile N lives at y = N*T in the image.
 */
export const TILE_IDX = {
  FOREST_GRASS:  0,   // dark dense forest grass
  NORMAL_GRASS:  1,   // standard grass
  LIGHT_GRASS:   2,   // open meadow
  DRY_GRASS:     3,   // dry / scrub
  DIRT_PATH:     4,   // dirt path centre
  DIRT_EDGE:     5,   // grass↔dirt transition
  WATER_DEEP:    6,   // deep water
  WATER_SHALLOW: 7,   // shallow water / pond edge
  SAND:          8,   // sandy shore
  STONE:         9,   // stone / cobble floor
  SAFE_ZONE:     10,  // bright village grass
  FOREST_FLOOR:  11,  // deep forest mulch
} as const;

// ── pixel helpers ──────────────────────────────────────────────────────────────

/** Deterministic pseudo-random in [0,1] for a pixel coordinate */
function rnd(x: number, y: number, seed = 0): number {
  const v =
    Math.sin(x * 127.1 + y * 311.7 + seed * 43.7) * 43758.5453 +
    Math.sin(x * 73.3  + y * 157.9 + seed * 11.1) * 17831.2341;
  return v - Math.floor(v);
}

/** Write an RGBA pixel into an ImageData buffer */
function px(
  data: Uint8ClampedArray,
  x: number, y: number,
  r: number, g: number, b: number,
  stride: number,
): void {
  const i = (y * stride + x) * 4;
  data[i]     = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = 255;
}

/** Clamp a number to [0, 255] */
function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// ── tile drawing functions ─────────────────────────────────────────────────────

/** Grass tile: base + blade scatter + dark shadows + bright accents */
function drawGrass(
  d: Uint8ClampedArray,
  tileY: number,
  base: [number, number, number],
  blade: [number, number, number],
  bright: [number, number, number],
  dark: [number, number, number],
  seed: number,
): void {
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const r1 = rnd(x, y, seed);
      const r2 = rnd(x + T, y + T, seed);
      let col: [number, number, number];
      if (r1 < 0.05) col = dark;
      else if (r1 < 0.18) col = blade;
      else if (r2 < 0.05) col = bright;
      else {
        // subtle horizontal banding to suggest rows of grass
        const band = Math.sin(y * 0.85 + x * 0.12) * 6;
        col = [clamp(base[0] + band), clamp(base[1] + band), clamp(base[2] + band)];
      }
      px(d, x, tileY + y, col[0], col[1], col[2], T);
    }
  }
}

/** Dirt tile: warm brown base + pebble scatter */
function drawDirt(
  d: Uint8ClampedArray,
  tileY: number,
  base: [number, number, number],
  dark: [number, number, number],
  light: [number, number, number],
  seed: number,
): void {
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const r1 = rnd(x, y, seed);
      const r2 = rnd(x * 2 + 7, y * 2 + 3, seed);
      let col: [number, number, number];
      if (r2 < 0.07) col = dark;
      else if (r2 < 0.14) col = light;
      else {
        const n = (r1 - 0.5) * 24;
        col = [clamp(base[0] + n), clamp(base[1] + n * 0.9), clamp(base[2] + n * 0.7)];
      }
      px(d, x, tileY + y, col[0], col[1], col[2], T);
    }
  }
}

/** Water tile: animated wave-like shading */
function drawWater(
  d: Uint8ClampedArray,
  tileY: number,
  deep: [number, number, number],
  mid: [number, number, number],
  shimmer: [number, number, number],
  seed: number,
): void {
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const r1 = rnd(x, y, seed);
      // two overlapping sine waves → wave effect
      const wave = (Math.sin(x * 0.55 + y * 0.35) * 0.5 + 0.5) *
                   (Math.cos(x * 0.8  - y * 0.50) * 0.5 + 0.5);
      let col: [number, number, number];
      if (r1 < 0.025) {
        col = shimmer;
      } else {
        const t = wave * 0.45;
        col = [
          clamp(deep[0] + (mid[0] - deep[0]) * t),
          clamp(deep[1] + (mid[1] - deep[1]) * t),
          clamp(deep[2] + (mid[2] - deep[2]) * t),
        ];
      }
      px(d, x, tileY + y, col[0], col[1], col[2], T);
    }
  }
}

// ── main export ────────────────────────────────────────────────────────────────

/**
 * Generates "tileset-overworld" — a vertical strip of NUM_TILESET_TILES pixel-art
 * tiles used by WorldGenerator.  Safe to call multiple times (no-op if already exists).
 */
export function generateMedievalTileset(scene: Phaser.Scene): void {
  if (scene.textures.exists("tileset-overworld")) return;

  const canvas = document.createElement("canvas");
  canvas.width  = T;
  canvas.height = T * NUM_TILESET_TILES;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const img  = ctx.createImageData(T, T * NUM_TILESET_TILES);
  const data = img.data;

  // ── 0: Forest / Dense Grass (dark green) ────────────────────────────────────
  drawGrass(data, 0 * T,
    [28,  72, 18],  // base  #1c4812
    [42, 100, 28],  // blade #2a641c
    [56, 122, 36],  // bright
    [16,  46, 10],  // dark
    0,
  );

  // ── 1: Normal Grass ──────────────────────────────────────────────────────────
  drawGrass(data, 1 * T,
    [44,  88, 28],  // base  #2c5820
    [60, 118, 40],  // blade
    [76, 140, 50],  // bright
    [28,  60, 18],  // dark
    11,
  );

  // ── 2: Light Meadow Grass ────────────────────────────────────────────────────
  drawGrass(data, 2 * T,
    [62, 122, 40],  // base  #3e7a28
    [82, 158, 54],  // blade
    [98, 178, 64],  // bright
    [42,  90, 26],  // dark
    22,
  );

  // ── 3: Dry / Scrub Grass ────────────────────────────────────────────────────
  drawGrass(data, 3 * T,
    [100, 100, 32],  // base  #646420 yellow-green
    [126, 124, 44],  // blade
    [144, 138, 50],  // bright
    [ 72,  68, 20],  // dark
    33,
  );

  // ── 4: Dirt Path (centre) ───────────────────────────────────────────────────
  drawDirt(data, 4 * T,
    [136, 100, 52],  // base  #886434
    [ 94,  64, 26],  // dark pebble
    [168, 128, 70],  // light pebble
    44,
  );

  // ── 5: Dirt Edge (grass ↔ dirt blend) ───────────────────────────────────────
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const blend = rnd(x * 1.7 + 3, y * 0.9 + 7, 55);
      if (blend < 0.42) {
        // grass side
        const r1 = rnd(x, y, 11);
        const b = r1 < 0.15 ? ([58, 116, 38] as [number,number,number]) : ([44, 88, 28] as [number,number,number]);
        px(data, x, 5 * T + y, b[0], b[1], b[2], T);
      } else {
        // dirt side
        const r1 = rnd(x, y, 44);
        const n = (r1 - 0.5) * 20;
        px(data, x, 5 * T + y,
          clamp(128 + n), clamp(94 + n * 0.85), clamp(48 + n * 0.55), T);
      }
    }
  }

  // ── 6: Deep Water ───────────────────────────────────────────────────────────
  drawWater(data, 6 * T,
    [12,  52, 104],  // deep  #0c3468
    [16,  74, 138],  // mid   #104a8a
    [60, 160, 220],  // shimmer
    66,
  );

  // ── 7: Shallow Water ────────────────────────────────────────────────────────
  drawWater(data, 7 * T,
    [22,  78, 130],  // deep  #164e82
    [30, 100, 160],  // mid
    [90, 190, 230],  // shimmer
    77,
  );
  // Add faint sandy-bottom hints for shallow water
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (rnd(x + 200, y + 200, 88) < 0.035) {
        px(data, x, 7 * T + y, 90, 80, 38, T);
      }
    }
  }

  // ── 8: Sand / Shore ─────────────────────────────────────────────────────────
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const r1 = rnd(x, y, 88);
      const r2 = rnd(x * 2 + 5, y * 2 + 9, 88);
      let R: number, G: number, B: number;
      if (r2 < 0.06) { R = 142; G =  96; B = 40; }      // dark grain
      else if (r2 < 0.13) { R = 210; G = 168; B = 80; }  // light grain
      else if (r1 < 0.04)  { R = 100; G =  72; B = 28; }  // pebble
      else {
        const n = (r1 - 0.5) * 22;
        R = clamp(186 + n); G = clamp(148 + n * 0.85); B = clamp(68 + n * 0.55);
      }
      px(data, x, 8 * T + y, R, G, B, T);
    }
  }

  // ── 9: Stone / Cobble Floor ─────────────────────────────────────────────────
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      // Cobblestone grid: mortar lines every 10px, offset by row
      const rowOffset = Math.floor(y / 10) % 2 === 0 ? 0 : 5;
      const mortar = (y % 10 < 2) || ((x + rowOffset) % 10 < 2);
      const r1 = rnd(x, y, 99);
      let R: number, G: number, B: number;
      if (mortar) {
        R = 42; G = 44; B = 50;   // dark mortar
      } else if (r1 < 0.08) {
        R = 84; G = 86; B = 96;   // lighter stone chip
      } else {
        const n = (r1 - 0.5) * 16;
        const base = clamp(64 + n);
        R = base; G = base; B = clamp(base + 8);
      }
      px(data, x, 9 * T + y, R, G, B, T);
    }
  }

  // ── 10: Safe Zone / Village Grass (bright, even, welcoming) ─────────────────
  drawGrass(data, 10 * T,
    [64, 148, 44],   // base  #409430  bright
    [90, 180, 60],   // blade
    [108, 204, 72],  // bright
    [48, 112, 30],   // dark
    100,
  );
  // Slight vertical stripe to give "mown lawn" appearance
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (x % 6 < 3) {
        const i = (10 * T + y) * T * 4 + x * 4;
        data[i]     = clamp(data[i]     + 8);
        data[i + 1] = clamp(data[i + 1] + 12);
        data[i + 2] = clamp(data[i + 2] + 4);
      }
    }
  }

  // ── 11: Forest Floor (deep mulch / dark litter) ──────────────────────────────
  drawGrass(data, 11 * T,
    [18,  40, 12],   // base  #122808 very dark
    [28,  58, 18],   // blade
    [38,  74, 24],   // bright accent
    [10,  26,  6],   // shadow
    111,
  );
  // Add occasional leaf-litter orange-brown flecks
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (rnd(x + 300, y + 300, 122) < 0.04) {
        px(data, x, 11 * T + y, 72, 44, 18, T);
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas("tileset-overworld", canvas);
}

// ── PokeWilds tileset compositing ─────────────────────────────────────────────

/**
 * If real PokeWilds ground tiles were loaded, composite them over the
 * pixel-art "tileset-overworld".  Slots where no PokeWilds image is available
 * keep their pixel-art fallback (water, stone, etc. are never wiped to black).
 */
export function rebuildTilesetWithPokeWildsAssets(scene: Phaser.Scene): void {
  // Need at least the base grass tile
  if (!scene.textures.exists("tile-ground1")) return;

  // ── Start from the existing pixel-art canvas as a base ──────────────────────
  // This ensures tiles that have no PokeWilds equivalent (water, mountain, etc.)
  // still show their hand-drawn versions rather than going transparent/black.
  let existingCanvas: HTMLCanvasElement | null = null;
  if (scene.textures.exists("tileset-overworld")) {
    const src = (scene.textures.get("tileset-overworld") as any).source[0].image;
    if (src instanceof HTMLCanvasElement) existingCanvas = src;
    scene.textures.remove("tileset-overworld");
  }

  const canvas = document.createElement("canvas");
  canvas.width  = T;
  canvas.height = T * NUM_TILESET_TILES;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;   // crisp nearest-neighbour pixel art

  // Blit the pixel-art base so every slot starts with a fallback
  if (existingCanvas) {
    ctx.drawImage(existingCanvas, 0, 0);
  }

  /** Overdraw a PokeWilds image onto a tileset slot (scaled to T×T). */
  function slot(
    idx: number,
    key: string,
    fallbackKey?: string,
    tintColor?: [number, number, number],
    tintAlpha = 0.28,
  ): void {
    const useKey = scene.textures.exists(key) ? key
                 : (fallbackKey && scene.textures.exists(fallbackKey) ? fallbackKey : null);
    if (!useKey) return;
    const src = (scene.textures.get(useKey) as any).source[0].image as HTMLImageElement;
    const y = idx * T;
    ctx.drawImage(src, 0, y, T, T);

    // Predictable semi-transparent colour overlay (source-over)
    if (tintColor) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(${tintColor[0]},${tintColor[1]},${tintColor[2]},${tintAlpha})`;
      ctx.fillRect(0, y, T, T);
      ctx.restore();
    }
  }

  // ── Map each TILE_IDX slot to a PokeWilds asset ───────────────────────────────
  // Forest — heavy dark overlay so it looks clearly shadowed/dense
  slot(TILE_IDX.FOREST_GRASS,  "tile-ground1",  undefined,        [  8,  20,   4], 0.60);
  // Normal open grass — no overlay
  slot(TILE_IDX.NORMAL_GRASS,  "tile-ground1");
  // Meadow — bright sunny tint
  slot(TILE_IDX.LIGHT_GRASS,   "tile-ground2",  "tile-ground1",   [200, 255, 150], 0.20);
  // Rocky dry scrub — desert tile
  slot(TILE_IDX.DRY_GRASS,     "tile-desert",   "tile-ground2",   [190, 160,  70], 0.30);
  // Path centre
  slot(TILE_IDX.DIRT_PATH,     "tile-path",     "tile-ground2");
  // Path edge
  slot(TILE_IDX.DIRT_EDGE,     "tile-shore",    "tile-path");
  // Deep water
  slot(TILE_IDX.WATER_DEEP,    "tile-water");
  // Shallow water
  slot(TILE_IDX.WATER_SHALLOW, "tile-water",    undefined,        [160, 220, 255], 0.22);
  // Sand
  slot(TILE_IDX.SAND,          "tile-sand",     "tile-ground2",   [210, 190, 120], 0.18);
  // Stone
  slot(TILE_IDX.STONE,         "tile-mountain", "tile-ground2",   [150, 145, 140], 0.20);
  // Safe zone — bright village green
  slot(TILE_IDX.SAFE_ZONE,     "tile-ground2",  "tile-ground1",   [120, 255, 100], 0.30);
  // Forest floor — darkest tile (deep mulch): path tile + very dark overlay
  slot(TILE_IDX.FOREST_FLOOR,  "tile-path",     "tile-ground1",   [ 10,  22,   4], 0.65);

  scene.textures.addCanvas("tileset-overworld", canvas);
  console.info("[tileset] rebuilt from PokeWilds assets ✓");
}

// ── Fallback tile images ───────────────────────────────────────────────────────

/**
 * Generates pixel-art fallback textures for resource/structure/decor tiles
 * that failed to load from disk.  Safe to call multiple times.
 */
export function generateFallbackTiles(scene: Phaser.Scene): void {
  function make(
    key: string,
    drawFn: (ctx: CanvasRenderingContext2D) => void,
  ): void {
    if (scene.textures.exists(key)) return; // real asset already loaded
    const cv = document.createElement("canvas");
    cv.width = cv.height = T;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    drawFn(ctx);
    scene.textures.addCanvas(key, cv);
  }

  // ── tile-tree-under (trunk/base — Y-sorts with player) ────────────────────
  make("tile-tree-under", ctx => {
    // Lower portion of a tree: thick trunk + root flare
    ctx.fillStyle = "#5c3010";
    ctx.fillRect(11, 0, 10, 32);   // trunk full height (player walks in front of upper part)
    ctx.fillStyle = "#3c2008";
    ctx.fillRect(15, 0, 6, 32);    // dark side of trunk
    // Root flare at base
    ctx.fillStyle = "#7a4010";
    ctx.beginPath(); ctx.ellipse(16, 28, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4a2608";
    ctx.beginPath(); ctx.ellipse(16, 30, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
  });

  // ── tile-tree-over (canopy — rendered above player) ────────────────────────
  make("tile-tree-over", ctx => {
    // Upper canopy — fills the tile that sits one tile above the trunk
    ctx.fillStyle = "#143c0e";
    ctx.beginPath(); ctx.arc(16, 20, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1c5614";
    ctx.beginPath(); ctx.arc(13, 16, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(20, 18, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a7020";
    ctx.beginPath(); ctx.arc(11, 11, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(20, 11, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#38901e";
    ctx.beginPath(); ctx.arc(14, 7, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4aaa28";
    ctx.beginPath(); ctx.arc(12, 4, 5, 0, Math.PI * 2); ctx.fill();
  });

  // ── tile-tree ──────────────────────────────────────────────────────────────
  make("tile-tree", ctx => {
    ctx.fillStyle = "#5c3010"; ctx.fillRect(12, 20, 8, 10);     // trunk
    ctx.fillStyle = "#3c2008"; ctx.fillRect(16, 20, 4, 10);     // trunk shadow
    ctx.fillStyle = "#164a10";                                    // canopy dark
    ctx.beginPath(); ctx.arc(16, 13, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#246e1a";                                    // canopy mid
    ctx.beginPath(); ctx.arc(13, 10, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#38941e";                                    // canopy light
    ctx.beginPath(); ctx.arc(11, 7, 5, 0, Math.PI * 2); ctx.fill();
  });

  // ── tile-tree-large ────────────────────────────────────────────────────────
  make("tile-tree-large", ctx => {
    ctx.fillStyle = "#5c3010"; ctx.fillRect(11, 22, 10, 8);
    ctx.fillStyle = "#3c2008"; ctx.fillRect(16, 22, 5, 8);
    ctx.fillStyle = "#124010";
    ctx.beginPath(); ctx.arc(16, 12, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1c5e18";
    ctx.beginPath(); ctx.arc(12, 9, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2e8022";
    ctx.beginPath(); ctx.arc(10, 5, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#40a82c";
    ctx.beginPath(); ctx.arc(8, 3, 4, 0, Math.PI * 2); ctx.fill();
  });

  // ── tile-rock ─────────────────────────────────────────────────────────────
  make("tile-rock", ctx => {
    ctx.fillStyle = "#6a6878";
    ctx.beginPath();
    ctx.moveTo(5, 24); ctx.lineTo(4, 16); ctx.lineTo(8, 9);
    ctx.lineTo(16, 6); ctx.lineTo(24, 9); ctx.lineTo(28, 16);
    ctx.lineTo(27, 24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#50505e"; // shadow bottom
    ctx.beginPath();
    ctx.moveTo(5, 24); ctx.lineTo(7, 18); ctx.lineTo(25, 18);
    ctx.lineTo(27, 24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#8e8c9c"; // lit top
    ctx.beginPath();
    ctx.moveTo(8, 9); ctx.lineTo(16, 6); ctx.lineTo(21, 11);
    ctx.lineTo(13, 15); ctx.lineTo(8, 13); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#3e3e4a"; ctx.lineWidth = 1; // crack
    ctx.beginPath(); ctx.moveTo(18, 9); ctx.lineTo(23, 17); ctx.stroke();
  });

  // ── tile-bush ─────────────────────────────────────────────────────────────
  make("tile-bush", ctx => {
    ctx.fillStyle = "#155212";
    ctx.beginPath(); ctx.arc(10, 19, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(22, 19, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(16, 13, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1e6e1a";
    ctx.beginPath(); ctx.arc(8, 16, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(16, 10, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2e8e24";
    ctx.beginPath(); ctx.arc(13, 7, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#cc3333"; // red berries
    ctx.beginPath(); ctx.arc(20, 14, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(11, 20, 1.5, 0, Math.PI * 2); ctx.fill();
  });

  // ── tile-campfire ─────────────────────────────────────────────────────────
  make("tile-campfire", ctx => {
    ctx.fillStyle = "#4a2808"; ctx.fillRect(5, 22, 22, 5); // logs
    ctx.fillStyle = "#6a3a10"; ctx.fillRect(7, 24, 18, 4);
    ctx.fillStyle = "#e05a14"; // outer flame
    ctx.beginPath();
    ctx.moveTo(16, 7); ctx.bezierCurveTo(23, 13, 22, 20, 20, 22);
    ctx.lineTo(12, 22); ctx.bezierCurveTo(10, 20, 9, 13, 16, 7);
    ctx.fill();
    ctx.fillStyle = "#f0b818"; // mid flame
    ctx.beginPath();
    ctx.moveTo(16, 10); ctx.bezierCurveTo(21, 15, 20, 20, 18, 22);
    ctx.lineTo(14, 22); ctx.bezierCurveTo(12, 20, 11, 15, 16, 10);
    ctx.fill();
    ctx.fillStyle = "#fff8a0"; // core
    ctx.beginPath(); ctx.arc(16, 19, 3, 0, Math.PI * 2); ctx.fill();
  });

  // ── tile-chest ────────────────────────────────────────────────────────────
  make("tile-chest", ctx => {
    ctx.fillStyle = "#7a4c18"; ctx.fillRect(4, 15, 24, 13); // body
    ctx.fillStyle = "#9a6428"; ctx.fillRect(4, 8, 24, 9);   // lid
    ctx.fillStyle = "#b87e36"; ctx.fillRect(4, 8, 24, 3);   // lid highlight
    ctx.fillStyle = "#c89030"; ctx.fillRect(4, 15, 24, 2);  // gold band
    ctx.fillStyle = "#c89030"; ctx.fillRect(13, 18, 6, 5);  // latch plate
    ctx.fillStyle = "#f0b840"; ctx.fillRect(14, 19, 4, 3);  // latch
    ctx.fillStyle = "#5a3210"; ctx.fillRect(4, 26, 24, 2);  // shadow
    // corner bolts
    ctx.fillStyle = "#c89030";
    [[4,8],[25,8],[4,25],[25,25]].forEach(([x, y]) => ctx.fillRect(x, y, 3, 3));
  });

  // ── tile-wood-wall ────────────────────────────────────────────────────────
  make("tile-wood-wall", ctx => {
    // Solid horizontal log-wall section
    const planks = [2, 10, 18, 26];
    planks.forEach((y, i) => {
      ctx.fillStyle = i % 2 === 0 ? "#7a5228" : "#8a6030";
      ctx.fillRect(0, y, 32, 8);
      // Plank grain lines
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, y + 3, 32, 1);
      ctx.fillRect(0, y + 6, 32, 1);
    });
    // Dark mortar lines between planks
    ctx.fillStyle = "#3e2010";
    [10, 18, 26].forEach(y => ctx.fillRect(0, y, 32, 2));
    // Shadow right edge
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(29, 0, 3, 32);
  });

  // ── tile-wood-door ────────────────────────────────────────────────────────
  make("tile-wood-door", ctx => {
    // Frame
    ctx.fillStyle = "#5c3c18";
    ctx.fillRect(0, 0, 32, 32);
    // Door panel (lighter wood)
    ctx.fillStyle = "#9a6430";
    ctx.fillRect(3, 2, 26, 30);
    // Panel recesses
    ctx.fillStyle = "#7a5028";
    ctx.fillRect(5, 4, 22, 12); ctx.fillRect(5, 18, 22, 12);
    // Vertical plank splits
    ctx.fillStyle = "#8a5828";
    ctx.fillRect(15, 4, 2, 26);
    // Handle
    ctx.fillStyle = "#c89030";
    ctx.beginPath(); ctx.arc(22, 17, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(21, 17, 3, 5);
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.20)";
    ctx.fillRect(28, 0, 4, 32);
  });

  // ── tile-stone-wall ───────────────────────────────────────────────────────
  make("tile-stone-wall", ctx => {
    // Stone block pattern — alternating offset rows
    const rows = [
      { y:  0, h: 9, offset: 0 },
      { y:  9, h: 9, offset: 8 },
      { y: 18, h: 9, offset: 0 },
      { y: 27, h: 5, offset: 8 },
    ];
    rows.forEach(({ y, h, offset }) => {
      for (let x = -offset; x < 32; x += 16) {
        const shade = Math.sin((x + y) * 0.5) * 10;
        ctx.fillStyle = `rgb(${clamp(72 + shade)},${clamp(70 + shade)},${clamp(76 + shade)})`;
        ctx.fillRect(x + 1, y + 1, 14, h - 2);
        // Highlight top-left
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(x + 1, y + 1, 14, 2);
      }
    });
    // Mortar
    ctx.fillStyle = "#3a3a42";
    [9, 18, 27].forEach(y => ctx.fillRect(0, y, 32, 1));
  });

  // ── tile-stone-gate ───────────────────────────────────────────────────────
  make("tile-stone-gate", ctx => {
    // Stone frame
    ctx.fillStyle = "#606068";
    ctx.fillRect(0, 0, 32, 32);
    // Arch opening (dark inside)
    ctx.fillStyle = "#18181c";
    ctx.beginPath();
    ctx.arc(16, 18, 11, Math.PI, 0, false);
    ctx.rect(5, 18, 22, 14);
    ctx.fill();
    // Stone block highlights
    ctx.fillStyle = "#8a8a94";
    ctx.fillRect(0, 0, 5, 32); ctx.fillRect(27, 0, 5, 32);
    ctx.fillRect(0, 0, 32, 5);
    // Keystone
    ctx.fillStyle = "#9a9aaa";
    ctx.beginPath(); ctx.arc(16, 7, 5, 0, Math.PI * 2); ctx.fill();
    // Portcullis bars (iron grid)
    ctx.strokeStyle = "#606060"; ctx.lineWidth = 1.5;
    [9, 13, 17, 21].forEach(x => {
      ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 32); ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(5, 16); ctx.lineTo(27, 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 23); ctx.lineTo(27, 23); ctx.stroke();
  });

  // ── tile-crafting-table ───────────────────────────────────────────────────
  make("tile-crafting-table", ctx => {
    // Table body
    ctx.fillStyle = "#7a5228"; ctx.fillRect(2, 14, 28, 16); // front face
    ctx.fillStyle = "#9a6a38"; ctx.fillRect(2,  8, 28,  8); // top surface
    ctx.fillStyle = "#5a3a18"; ctx.fillRect(2, 28, 28,  3); // bottom shadow
    // Table top cross-hatching (workbench pattern)
    ctx.strokeStyle = "#7a5228"; ctx.lineWidth = 1;
    for (let x = 4; x < 30; x += 6) {
      ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 16); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(2, 12); ctx.lineTo(30, 12); ctx.stroke();
    // Legs
    ctx.fillStyle = "#5a3a18";
    ctx.fillRect( 3, 28, 4, 4); ctx.fillRect(25, 28, 4, 4);
    // Tool markings on surface (chisel marks)
    ctx.strokeStyle = "#c8a060"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(7, 9); ctx.lineTo(12, 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, 9); ctx.lineTo(22, 9); ctx.stroke();
    // Iron nail accents
    ctx.fillStyle = "#888888";
    [[4,10],[28,10],[4,26],[28,26]].forEach(([x,y]) =>
      ctx.fillRect(x - 1, y - 1, 2, 2));
  });

  // ── tile-fence ────────────────────────────────────────────────────────────
  make("tile-fence", ctx => {
    ctx.fillStyle = "#7a5428"; // posts
    ctx.fillRect(3, 5, 6, 24); ctx.fillRect(23, 5, 6, 24);
    ctx.fillStyle = "#5a3c18"; // post tops
    ctx.fillRect(3, 5, 6, 4); ctx.fillRect(23, 5, 6, 4);
    ctx.fillStyle = "#9a6c38"; // rails
    ctx.fillRect(3, 12, 26, 4); ctx.fillRect(3, 21, 26, 4);
    ctx.fillStyle = "#6a4820"; // rail shadow
    ctx.fillRect(3, 15, 26, 1); ctx.fillRect(3, 24, 26, 1);
  });

  // ── tile-flower ───────────────────────────────────────────────────────────
  make("tile-flower", ctx => {
    ctx.fillStyle = "#2a7018"; // stem
    ctx.fillRect(15, 16, 2, 14);
    ctx.fillStyle = "#3a9020"; // leaves
    ctx.beginPath(); ctx.ellipse(11, 21, 5, 3, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(21, 21, 5, 3,  0.5, 0, Math.PI * 2); ctx.fill();
    // petals
    [0, Math.PI/2, Math.PI, Math.PI*1.5].forEach((a, i) => {
      ctx.fillStyle = ["#ff9920","#ffcc20","#ff6640","#ff9920"][i];
      ctx.beginPath();
      ctx.ellipse(16 + Math.cos(a)*6, 13 + Math.sin(a)*6, 4, 3, a, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.fillStyle = "#ffee40"; ctx.beginPath(); ctx.arc(16, 13, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#cc9900"; ctx.beginPath(); ctx.arc(16, 13, 2, 0, Math.PI*2); ctx.fill();
  });

  // ── tile-flower2 ──────────────────────────────────────────────────────────
  make("tile-flower2", ctx => {
    ctx.fillStyle = "#2a7018"; // stem
    ctx.fillRect(15, 18, 2, 12);
    ctx.fillStyle = "#3a9020"; // leaves
    ctx.beginPath(); ctx.ellipse(11, 22, 5, 3, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(21, 23, 5, 3,  0.4, 0, Math.PI * 2); ctx.fill();
    // white/purple petals
    [0, Math.PI * 0.4, Math.PI * 0.8, Math.PI * 1.2, Math.PI * 1.6].forEach((a, i) => {
      ctx.fillStyle = ["#cc44cc","#dd66dd","#aa22aa","#cc44cc","#dd66dd"][i];
      ctx.beginPath();
      ctx.ellipse(16 + Math.cos(a) * 6, 13 + Math.sin(a) * 6, 3.5, 2.5, a, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#ffe060"; ctx.beginPath(); ctx.arc(16, 13, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#cc9900"; ctx.beginPath(); ctx.arc(16, 13, 1.8, 0, Math.PI * 2); ctx.fill();
  });

  // ── tile-grass-detail ─────────────────────────────────────────────────────
  make("tile-grass-detail", ctx => {
    const blades: [number, number, number, number, string][] = [
      [6,28,4,10,"#4aaa30"], [10,28,8,8,"#3a9828"], [14,30,11,6,"#56bb38"],
      [18,28,16,5,"#4aaa30"], [22,30,20,10,"#3a9828"], [26,28,24,8,"#56bb38"],
      [8,30,5,14,"#3a9828"], [20,30,22,12,"#4aaa30"],
    ];
    blades.forEach(([x1,y1,x2,y2,c]) => {
      ctx.strokeStyle = c; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
  });

  // ── tile-torch ────────────────────────────────────────────────────────────
  make("tile-torch", ctx => {
    ctx.fillStyle = "#5c3010"; ctx.fillRect(14, 12, 4, 20); // pole
    ctx.fillStyle = "#e05010"; // flame outer
    ctx.beginPath();
    ctx.moveTo(16, 4); ctx.bezierCurveTo(22, 9, 20, 14, 18, 14);
    ctx.lineTo(14, 14); ctx.bezierCurveTo(12, 14, 10, 9, 16, 4);
    ctx.fill();
    ctx.fillStyle = "#f0b818"; // flame inner
    ctx.beginPath();
    ctx.moveTo(16, 6); ctx.bezierCurveTo(20, 10, 18, 14, 17, 14);
    ctx.lineTo(15, 14); ctx.bezierCurveTo(14, 14, 12, 10, 16, 6);
    ctx.fill();
    ctx.fillStyle = "#fff8a0"; ctx.beginPath(); ctx.arc(16, 11, 2, 0, Math.PI*2); ctx.fill();
  });
}
