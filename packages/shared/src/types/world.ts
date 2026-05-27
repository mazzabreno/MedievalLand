export type BiomeType = "GREEN_FIELD" | "DENSE_FOREST" | "ROCKY_HIGHLANDS" | "SWAMP";

export interface Biome {
  type: BiomeType;
  seed: number;
  width: number;
  height: number;
}

export type TileType =
  | "GRASS"
  | "DIRT_PATH"
  | "SAFE_ZONE"
  | "TREE_OAK"
  | "BUSH"
  | "BERRY_SHRUB"
  | "ROCK_NODE"
  | "WATER"
  | "EMPTY";

export interface WorldTile {
  x: number;
  y: number;
  type: TileType;
  /** on-chain account address for this tile */
  address?: string;
  /** resource node depleted flag */
  depleted?: boolean;
  /** structure placed on this tile */
  structure?: StructureType;
  structureHp?: number;
  structureOwner?: string;
  /** item dropped on this tile (on-chain item account) */
  droppedItem?: string;
  /** corpse present — will spawn skeleton if not cleaned */
  corpseDeadline?: number;
}

export type StructureType =
  | "WOODEN_FENCE"
  | "WOODEN_DOOR"
  | "WOODEN_WALL"
  | "STONE_WALL"
  | "STONE_GATE"
  | "CAMPFIRE"
  | "CHEST"
  | "CRAFTING_TABLE";

export const STRUCTURE_COSTS: Record<
  StructureType,
  { resource: ResourceType; amount: number }
> = {
  WOODEN_FENCE: { resource: "WOOD", amount: 4 },
  WOODEN_DOOR: { resource: "WOOD", amount: 6 },
  WOODEN_WALL: { resource: "WOOD", amount: 8 },
  STONE_WALL: { resource: "STONE", amount: 6 },
  STONE_GATE: { resource: "STONE", amount: 10 },
  CAMPFIRE: { resource: "WOOD", amount: 3 },
  CHEST: { resource: "WOOD", amount: 10 },
  CRAFTING_TABLE: { resource: "WOOD", amount: 12 },
};

export const STRUCTURE_HP: Record<StructureType, number> = {
  WOODEN_FENCE: 40,
  WOODEN_DOOR: 60,
  WOODEN_WALL: 80,
  STONE_WALL: 160,
  STONE_GATE: 200,
  CAMPFIRE: 30,
  CHEST: 80,
  CRAFTING_TABLE: 100,
};

export type ResourceType = "WOOD" | "STONE" | "FIBER" | "FOOD" | "BONE" | "PELT";

export interface ResourceStack {
  type: ResourceType;
  amount: number;
}
