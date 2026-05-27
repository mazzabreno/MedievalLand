import Phaser from "phaser";
import { TILE_SIZE } from "../config/gameConfig";
import { SAFE_ZONES } from "../config/constants";
import type { BiomeType } from "../types";
import { TILE_IDX } from "../utils/tilesetGenerator";

// ── Tile index aliases ─────────────────────────────────────────────────────────
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

// ── Node spawn record ─────────────────────────────────────────────────────────

export interface SpawnEntry { x: number; y: number }

export interface NodePositions {
  trees:   SpawnEntry[];   // dark forest / normal areas
  larges:  SpawnEntry[];   // extra-tall trees (forest)
  rocks:   SpawnEntry[];   // rocky / stone biome
  bushes:  SpawnEntry[];   // meadow / plain areas
  flowers: SpawnEntry[];   // decoration (meadow, safe zones)
  torches: SpawnEntry[];   // along paths / safe zone edges
}

// ── Noise helpers ─────────────────────────────────────────────────────────────

function smoothN(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
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

function fbm(x: number, y: number, oct: number, seed = 0): number {
  let v = 0, amp = 1, total = 0;
  for (let i = 0; i < oct; i++) {
    v += smoothN(x * (1 << i), y * (1 << i), seed + i * 17.31) * amp;
    total += amp;
    amp *= 0.5;
  }
  return v / total;
}

// ── Biome definition ──────────────────────────────────────────────────────────

enum Biome { FOREST, PLAINS, MEADOW, ROCKY }

// ── Main class ────────────────────────────────────────────────────────────────

export class WorldGenerator {
  private scene:  Phaser.Scene;
  private width:  number;
  private height: number;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene  = scene;
    this.width  = width;
    this.height = height;
  }

  generate(_biome: BiomeType): {
    groundLayer: Phaser.Tilemaps.TilemapLayer;
    decorLayer:  Phaser.Tilemaps.TilemapLayer;
    nodePositions: NodePositions;
  } {
    const W = this.width, H = this.height;
    const TS = TILE_SIZE;

    // ── Build Phaser tilemap ─────────────────────────────────────────────────
    const map = this.scene.make.tilemap({ tileWidth: TS, tileHeight: TS, width: W, height: H });
    const tileset    = map.addTilesetImage("tileset-overworld")!;
    const groundLayer = map.createBlankLayer("ground", tileset)!;
    const decorLayer  = map.createBlankLayer("decor",  tileset)!;

    // ── Noise functions ──────────────────────────────────────────────────────
    // micro: fine per-tile variation
    const micro = (tx: number, ty: number) => smoothN(tx / 2, ty / 2, 55);
    // detail: medium scale for biome blending
    const detail = (tx: number, ty: number) => fbm(tx / 6, ty / 6, 3, 88);

    // ── Structured biome assignment ─────────────────────────────────────────
    // The map is divided into 4 quadrants:
    //   NW = FOREST  (dense dark green)
    //   NE = PLAINS  (open grass + lake)
    //   SW = MEADOW  (bright open meadow)
    //   SE = ROCKY   (stone / mountain terrain)
    // Biome edges are softened with medium-scale noise.
    const getBiome = (tx: number, ty: number): Biome => {
      const blend = (detail(tx, ty) - 0.5) * 0.25; // ±12.5% edge blur
      const isWest  = tx / W < 0.5 + blend;
      const isNorth = ty / H < 0.5 + blend;
      if (isWest  && isNorth)  return Biome.FOREST;
      if (!isWest && isNorth)  return Biome.PLAINS;
      if (isWest  && !isNorth) return Biome.MEADOW;
      return Biome.ROCKY;
    };

    // ── Lake in NE quadrant ─────────────────────────────────────────────────
    const lakeCX = Math.round(W * 0.72);
    const lakeCY = Math.round(H * 0.22);
    const lakeR  = 8;   // radius in tiles

    const lakeDist = (tx: number, ty: number): number => {
      const dx = tx - lakeCX, dy = ty - lakeCY;
      // Slightly oval lake (wider than tall) for natural look
      return Math.sqrt(dx * dx * 0.85 + dy * dy * 1.15) / lakeR;
    };

    // ── Fill ground tiles ────────────────────────────────────────────────────
    const tileGrid: number[][] = [];
    for (let ty = 0; ty < H; ty++) {
      tileGrid[ty] = [];
      for (let tx = 0; tx < W; tx++) {
        const m  = micro(tx, ty);
        const ld = lakeDist(tx, ty);
        const b  = getBiome(tx, ty);

        let tile: number;

        // ─ Lake / water first (overrides biome) ─
        if (ld < 0.55) {
          tile = ld < 0.35 ? WD : WS;
        } else if (ld < 0.72) {
          tile = SA;   // sandy shore
        } else {
          // ─ Land — biome-driven ─
          switch (b) {
            case Biome.FOREST:
              tile = m < 0.12 ? FF
                   : m < 0.70 ? FG
                   :             NG;
              break;
            case Biome.PLAINS:
              tile = m < 0.45 ? NG : LG;
              break;
            case Biome.MEADOW:
              tile = m < 0.25 ? NG
                   : m < 0.80 ? LG
                   :             NG;
              break;
            case Biome.ROCKY:
            default:
              tile = m < 0.38 ? ST
                   : m < 0.65 ? DG
                   :             NG;
              break;
          }
        }

        tileGrid[ty][tx] = tile;
        groundLayer.putTileAt(tile, tx, ty);
      }
    }

    // ── Winding paths ────────────────────────────────────────────────────────
    const cX = Math.floor(W / 2);
    const cY = Math.floor(H / 2);

    const isWater = (tx: number, ty: number) => {
      if (tx < 0 || tx >= W || ty < 0 || ty >= H) return false;
      const t = tileGrid[ty]?.[tx] ?? NG;
      return t === WD || t === WS;
    };

    // Horizontal path (winding, connects NW & NE safe zones via centre)
    for (let tx = 0; tx < W; tx++) {
      const py = cY + Math.round(Math.sin(tx * 0.13 + 0.5) * 5);
      for (let dy = -1; dy <= 1; dy++) {
        const row = py + dy;
        if (row < 0 || row >= H) continue;
        if (isWater(tx, row)) continue;
        groundLayer.putTileAt(dy === 0 ? DP : DE, tx, row);
        tileGrid[row][tx] = dy === 0 ? DP : DE;
      }
    }

    // Vertical path (different phase)
    for (let ty = 0; ty < H; ty++) {
      const px = cX + Math.round(Math.sin(ty * 0.13 + 1.8) * 5);
      for (let dx = -1; dx <= 1; dx++) {
        const col = px + dx;
        if (col < 0 || col >= W) continue;
        if (isWater(col, ty)) continue;
        if (tileGrid[ty][col] === DP) continue; // don't overwrite H-path centre
        groundLayer.putTileAt(dx === 0 ? DP : DE, col, ty);
        tileGrid[ty][col] = dx === 0 ? DP : DE;
      }
    }

    // ── Safe zones ────────────────────────────────────────────────────────────
    for (const sz of SAFE_ZONES) {
      // Interior → bright village grass
      for (let r = sz.row; r < sz.row + sz.h; r++) {
        for (let c = sz.col; c < sz.col + sz.w; c++) {
          if (c >= 0 && c < W && r >= 0 && r < H) {
            groundLayer.putTileAt(SZ, c, r);
            tileGrid[r][c] = SZ;
          }
        }
      }
      // One-tile dirt border
      for (let r = sz.row - 1; r <= sz.row + sz.h; r++) {
        for (let c = sz.col - 1; c <= sz.col + sz.w; c++) {
          if (c < 0 || c >= W || r < 0 || r >= H) continue;
          if (r >= sz.row && r < sz.row + sz.h &&
              c >= sz.col && c < sz.col + sz.w)  continue;
          const t = tileGrid[r][c];
          if (t !== WD && t !== WS && t !== SZ && t !== DP) {
            groundLayer.putTileAt(DE, c, r);
            tileGrid[r][c] = DE;
          }
        }
      }
    }

    // ── Build node spawn positions ────────────────────────────────────────────
    const rng = Phaser.Math.RND;
    const nodePositions: NodePositions = {
      trees:   [],
      larges:  [],
      rocks:   [],
      bushes:  [],
      flowers: [],
      torches: [],
    };

    const safeRect = SAFE_ZONES[0];
    const isSafeZone = (tx: number, ty: number): boolean =>
      SAFE_ZONES.some(sz =>
        tx >= sz.col - 2 && tx <= sz.col + sz.w + 2 &&
        ty >= sz.row - 2 && ty <= sz.row + sz.h + 2
      );

    for (let ty = 2; ty < H - 2; ty++) {
      for (let tx = 2; tx < W - 2; tx++) {
        const tile = tileGrid[ty][tx];
        if (tile === WD || tile === WS || tile === SA || tile === DP || tile === DE || tile === SZ) continue;
        if (isSafeZone(tx, ty)) continue;

        const v = rng.frac();
        const b = getBiome(tx, ty);
        const worldX = tx * TS + TS / 2;
        const worldY = ty * TS + TS / 2;

        if (b === Biome.FOREST) {
          if (tile === FF && v < 0.06)       nodePositions.larges.push({ x: worldX, y: worldY });
          else if (tile === FG && v < 0.08)  nodePositions.trees.push({ x: worldX, y: worldY });
          else if (tile === NG && v < 0.03)  nodePositions.trees.push({ x: worldX, y: worldY });
        } else if (b === Biome.PLAINS) {
          if (tile === NG && v < 0.025)      nodePositions.trees.push({ x: worldX, y: worldY });
          if (tile === LG && v < 0.04)       nodePositions.flowers.push({ x: worldX, y: worldY });
        } else if (b === Biome.MEADOW) {
          if (tile === LG && v < 0.05)       nodePositions.bushes.push({ x: worldX, y: worldY });
          if (tile === NG && v < 0.06)       nodePositions.flowers.push({ x: worldX, y: worldY });
        } else if (b === Biome.ROCKY) {
          if (tile === ST && v < 0.07)       nodePositions.rocks.push({ x: worldX, y: worldY });
          if (tile === DG && v < 0.04)       nodePositions.rocks.push({ x: worldX, y: worldY });
        }
      }
    }

    // Torches along path edges and at safe zone corners
    for (const sz of SAFE_ZONES) {
      const corners = [
        { x: (sz.col - 1) * TS + TS / 2,           y: (sz.row - 1) * TS + TS / 2          },
        { x: (sz.col + sz.w) * TS + TS / 2,         y: (sz.row - 1) * TS + TS / 2          },
        { x: (sz.col - 1) * TS + TS / 2,            y: (sz.row + sz.h) * TS + TS / 2       },
        { x: (sz.col + sz.w) * TS + TS / 2,         y: (sz.row + sz.h) * TS + TS / 2       },
      ];
      nodePositions.torches.push(...corners);
    }

    return { groundLayer, decorLayer, nodePositions };
  }
}
