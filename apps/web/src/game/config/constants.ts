export const TILE_SIZE = 32;
export const MAP_COLS = 64;
export const MAP_ROWS = 64;
export const MAP_WIDTH = MAP_COLS * TILE_SIZE;
export const MAP_HEIGHT = MAP_ROWS * TILE_SIZE;

export const PLAYER_SPEED = 160;

/** Playable zone boundary (tile coords) — the safe field for experiment Season 1. */
export const PLAYABLE_ZONE = {
  col1: 1,
  col2: 63,
  row1: 1,
  row2: 63,
} as const;

/** Safe zone rectangles (tile coords): top-left corner + size */
export const SAFE_ZONES = [
  { col: 2, row: 2, w: 8, h: 8 },   // north-west starter
  { col: 52, row: 2, w: 8, h: 8 },  // north-east
  { col: 28, row: 52, w: 8, h: 8 }, // south-centre
] as const;

export const COLORS = {
  DARK:        0x0d0d0d,
  AMBER:       0xe8d5a3,
  GREEN:       0x14f195,
  CYAN:        0x00d1ff,
  PURPLE:      0x9945ff,
  GOLD:        0xffd700,
  ORANGE:      0xff6b35,
  GRASS_A:     0x2d5a27,
  GRASS_B:     0x3a7a32,
  DIRT:        0x8a7a60,
  SAFE_ZONE:   0x4a8a44,
  STONE_DARK:  0x3a3a3a,
  WATER:       0x0b3b5c,
  WOOD:        0x8b4513,
} as const;
