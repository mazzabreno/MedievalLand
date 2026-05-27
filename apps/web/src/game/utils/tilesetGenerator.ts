import { TILE_SIZE } from "../config/constants";

const T = TILE_SIZE;

// Tile indices used by WorldGenerator
// 0 = grass, 1 = dirt path, 2 = safe zone grass
const TILE_DEFS = [
  { base: 0x2d5a27 }, // 0: grass dark
  { base: 0x8a7a60 }, // 1: dirt path
  { base: 0x4a8a44 }, // 2: safe zone grass (lighter)
];

function hex(c: number): string {
  return `#${(c >>> 0).toString(16).padStart(6, "0")}`;
}

function fill(
  ctx: CanvasRenderingContext2D,
  color: number,
  x: number, y: number, w: number, h: number,
  alpha = 1
): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = hex(color);
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
}

/** Generates a "tileset-overworld" canvas texture used by the procedural WorldGenerator. */
export function generateMedievalTileset(scene: Phaser.Scene): void {
  if (scene.textures.exists("tileset-overworld")) return;

  const canvas = document.createElement("canvas");
  canvas.width  = T;
  canvas.height = T * TILE_DEFS.length;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < TILE_DEFS.length; i++) {
    const y   = i * T;
    const col = TILE_DEFS[i].base;

    ctx.fillStyle = hex(col);
    ctx.fillRect(0, y, T, T);

    // Slight shading to give depth
    fill(ctx, 0x000000, 0, y,     T, 1, 0.10);
    fill(ctx, 0x000000, 0, y,     1, T, 0.10);
    fill(ctx, 0xffffff, 1, y + 1, T-2, 1, 0.04);

    if (i === 0 || i === 2) {
      // Grass — dithered blade highlights
      const lighter = i === 2 ? 0x6aaa64 : 0x3a7a32;
      const dots = i === 0
        ? [[3,4],[8,1],[13,6],[19,2],[24,8],[29,3],[6,14],[16,11],[26,19],[11,22]]
        : [[1,3],[7,8],[12,2],[18,7],[23,4],[28,9],[4,15],[14,12],[24,20],[9,23]];
      ctx.fillStyle = hex(lighter);
      ctx.globalAlpha = 0.22;
      for (const [dx, dy] of dots) ctx.fillRect(dx, y + dy, 1, 1);
      ctx.globalAlpha = 1;
    } else if (i === 1) {
      // Dirt — cobblestone grid
      ctx.fillStyle = hex(0x5a4c38);
      ctx.globalAlpha = 0.5;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          ctx.fillRect(col * 8, y + row * 8, 8, 1);
          ctx.fillRect(col * 8, y + row * 8, 1, 8);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  scene.textures.addCanvas("tileset-overworld", canvas);
}
