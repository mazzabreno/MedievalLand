import Phaser from "phaser";
import { TILE_SIZE } from "../config/gameConfig";
import { SAFE_ZONES } from "../config/constants";
import type { BiomeType } from "../types";
import { TILE_IDX } from "../utils/tilesetGenerator";

// Shorthand aliases for readability
const {
  FOREST_GRASS:  FG,
  NORMAL_GRASS:  NG,
  LIGHT_GRASS:   LG,
  DRY_GRASS:     DG,
  DIRT_PATH:     DP,
  DIRT_EDGE:     DE,
  WATER_DEEP:    WD,
  WATER_SHALLOW: WS,
  SAND:          SA,
  STONE:         ST,
  SAFE_ZONE:     SZ,
  FOREST_FLOOR:  FF,
} = TILE_IDX;

// ── Noise utilities ────────────────────────────────────────────────────────────

/** Single-octave smooth value noise in [0,1] */
function smoothNoise(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix,        fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  function n(a: number, b: number): number {
    const v = Math.sin(a * 127.1 + b * 311.7 + seed * 43.7) * 43758.5453
            + Math.sin(a *  73.3 + b * 157.9 + seed * 11.1) * 17831.0;
    return v - Math.floor(v);
  }

  return (
    n(ix,   iy  ) * (1 - ux) * (1 - uy) +
    n(ix+1, iy  ) * ux       * (1 - uy) +
    n(ix,   iy+1) * (1 - ux) * uy       +
    n(ix+1, iy+1) * ux       * uy
  );
}

/** Fractal Brownian Motion — sum of `oct` octaves doubling in frequency */
function fbm(x: number, y: number, oct: number, seed = 0): number {
  let value = 0, amp = 1, total = 0;
  for (let i = 0; i < oct; i++) {
    const f = 1 << i; // 1, 2, 4, 8 …
    value += smoothNoise(x * f, y * f, seed + i * 17.31) * amp;
    total += amp;
    amp   *= 0.5;
  }
  return value / total;
}

// ── Lake helper ────────────────────────────────────────────────────────────────

interface Lake { cx: number; cy: number; r: number }

/** Normalised distance from the nearest lake centre (< 1 = inside lake) */
function lakeDist(tx: number, ty: number, lakes: Lake[]): number {
  let minD = Infinity;
  for (const { cx, cy, r } of lakes) {
    const d = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2) / r;
    if (d < minD) minD = d;
  }
  return minD;
}

// ── Main class ─────────────────────────────────────────────────────────────────

export class WorldGenerator {
  private scene:  Phaser.Scene;
  private width:  number;  // in tiles
  private height: number;  // in tiles

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene  = scene;
    this.width  = width;
    this.height = height;
  }

  generate(_biome: BiomeType): {
    groundLayer: Phaser.Tilemaps.TilemapLayer;
    decorLayer:  Phaser.Tilemaps.TilemapLayer;
  } {
    const W = this.width, H = this.height;
    const TS = TILE_SIZE;

    // ── Build tilemap ──────────────────────────────────────────────────────────
    const map = this.scene.make.tilemap({
      tileWidth: TS, tileHeight: TS,
      width: W, height: H,
    });

    const tileset    = map.addTilesetImage("tileset-overworld")!;
    const groundLayer = map.createBlankLayer("ground", tileset)!;
    const decorLayer  = map.createBlankLayer("decor",  tileset)!;

    // ── Noise functions ────────────────────────────────────────────────────────
    // height: coarse shape of the land (low = water, high = dry/stone)
    const height  = (tx: number, ty: number) => fbm(tx / 11, ty / 11, 4, 42);
    // biome:  determines forest vs meadow vs scrub
    const biome   = (tx: number, ty: number) => fbm(tx / 8,  ty / 8,  3, 137);
    // micro:  fine-grain tile-to-tile variation within each biome
    const micro   = (tx: number, ty: number) => smoothNoise(tx / 1.8, ty / 1.8, 99);

    // ── Lake positions ─────────────────────────────────────────────────────────
    // Two lakes placed away from all safe zones
    const lakes: Lake[] = [
      { cx: Math.floor(W * 0.18), cy: Math.floor(H * 0.65), r: 7 },   // SW lake
      { cx: Math.floor(W * 0.77), cy: Math.floor(H * 0.32), r: 6 },   // NE lake
    ];

    // ── Fill ground layer with noise-driven biomes ─────────────────────────────
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const h  = height(tx, ty);
        const b  = biome(tx, ty);
        const m  = micro(tx, ty);
        const ld = lakeDist(tx, ty, lakes);

        let tile: number;

        // --- water / shore ---
        if (ld < 0.60 || h < 0.18) {
          tile = (ld < 0.38 || h < 0.13) ? WD : WS;
        } else if (ld < 0.82 || h < 0.24) {
          tile = SA;                          // sandy shore
        } else {
          // --- land: pick biome ---
          if (b > 0.72) {
            tile = m < 0.30 ? FF : FG;        // dense forest
          } else if (b > 0.55) {
            tile = m < 0.55 ? FG : NG;        // forest edge / normal
          } else if (b > 0.38) {
            tile = NG;                         // normal grassland
          } else if (b > 0.22) {
            tile = m < 0.50 ? NG : LG;        // mixed normal / meadow
          } else if (b > 0.10) {
            tile = LG;                         // open meadow
          } else {
            tile = m < 0.45 ? DG : ST;        // dry scrub / stone outcrops
          }
        }

        groundLayer.putTileAt(tile, tx, ty);
      }
    }

    // ── Winding paths ──────────────────────────────────────────────────────────
    const cX = Math.floor(W / 2);
    const cY = Math.floor(H / 2);

    /** Carve a dirt-path strip through the map. Returns early over water. */
    const carvePath = (
      fixed: "row" | "col",
      start: number,
      end: number,
      centre: number,
      amplitude: number,
      phase: number,
    ) => {
      for (let i = start; i < end; i++) {
        const offset = Math.round(Math.sin(i * 0.14 + phase) * amplitude);
        const pCentre = centre + offset;
        for (let delta = -1; delta <= 1; delta++) {
          const col = fixed === "row" ? i        : pCentre + delta;
          const row = fixed === "row" ? pCentre + delta : i;
          if (col < 0 || col >= W || row < 0 || row >= H) continue;
          const existing = groundLayer.getTileAt(col, row)?.index ?? NG;
          if (existing === WD || existing === WS) continue;  // don't pave over water
          const isCenter = delta === 0;
          if (isCenter) {
            groundLayer.putTileAt(DP, col, row);
          } else if (existing !== DP) {
            groundLayer.putTileAt(DE, col, row);
          }
        }
      }
    };

    // Horizontal path (winds across full width)
    carvePath("row", 0, W, cY, 5, 0.5);
    // Vertical path (different phase so they cross at an angle)
    carvePath("col", 0, H, cX, 5, 1.8);

    // ── Safe zones — bright friendly grass + dirt border ──────────────────────
    for (const sz of SAFE_ZONES) {
      // interior: bright safe-zone tile
      for (let r = sz.row; r < sz.row + sz.h; r++) {
        for (let c = sz.col; c < sz.col + sz.w; c++) {
          if (c >= 0 && c < W && r >= 0 && r < H) {
            groundLayer.putTileAt(SZ, c, r);
          }
        }
      }
      // one-tile dirt border around the safe zone
      for (let r = sz.row - 1; r <= sz.row + sz.h; r++) {
        for (let c = sz.col - 1; c <= sz.col + sz.w; c++) {
          if (c < 0 || c >= W || r < 0 || r >= H) continue;
          if (r >= sz.row && r < sz.row + sz.h &&
              c >= sz.col && c < sz.col + sz.w) continue; // skip interior
          const existing = groundLayer.getTileAt(c, r)?.index ?? NG;
          if (existing !== WD && existing !== WS && existing !== SZ) {
            groundLayer.putTileAt(DE, c, r);
          }
        }
      }
    }

    return { groundLayer, decorLayer };
  }
}
