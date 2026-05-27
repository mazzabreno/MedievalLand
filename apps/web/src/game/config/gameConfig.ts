/**
 * Legacy config shim — the actual Phaser config lives in PhaserGame.tsx.
 * Re-exports TILE_SIZE so WorldGenerator.ts can keep its existing import path.
 */
export { TILE_SIZE, MAP_COLS as MAP_WIDTH_TILES, MAP_ROWS as MAP_HEIGHT_TILES } from "./constants";
