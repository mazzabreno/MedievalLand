/**
 * Inlined copy of @/shared — keeps apps/web self-contained for
 * standalone builds (Vercel, StackBlitz) where the monorepo workspace is unavailable.
 */

// ── world.ts ──────────────────────────────────────────────────────────────────
export type BiomeType = "GREEN_FIELD" | "DENSE_FOREST" | "ROCKY_HIGHLANDS" | "SWAMP";
export type TileType = "GRASS" | "DIRT_PATH" | "SAFE_ZONE" | "TREE_OAK" | "BUSH"
  | "BERRY_SHRUB" | "ROCK_NODE" | "WATER" | "EMPTY";
export type ResourceType = "WOOD" | "STONE" | "FIBER" | "FOOD" | "BONE" | "PELT";
export type StructureType = "WOODEN_FENCE" | "WOODEN_DOOR" | "WOODEN_WALL"
  | "STONE_WALL" | "STONE_GATE" | "CAMPFIRE" | "CHEST" | "CRAFTING_TABLE";

export interface ResourceStack { type: ResourceType; amount: number; }
export interface WorldTile {
  x: number; y: number; type: TileType; address?: string; depleted?: boolean;
  structure?: StructureType; structureHp?: number; structureOwner?: string;
  droppedItem?: string; corpseDeadline?: number;
}

export const STRUCTURE_COSTS: Record<StructureType, { resource: ResourceType; amount: number }> = {
  WOODEN_FENCE:    { resource: "WOOD",  amount: 4  },
  WOODEN_DOOR:     { resource: "WOOD",  amount: 6  },
  WOODEN_WALL:     { resource: "WOOD",  amount: 8  },
  STONE_WALL:      { resource: "STONE", amount: 6  },
  STONE_GATE:      { resource: "STONE", amount: 10 },
  CAMPFIRE:        { resource: "WOOD",  amount: 3  },
  CHEST:           { resource: "WOOD",  amount: 10 },
  CRAFTING_TABLE:  { resource: "WOOD",  amount: 12 },
};

export const STRUCTURE_HP: Record<StructureType, number> = {
  WOODEN_FENCE: 40, WOODEN_DOOR: 60, WOODEN_WALL: 80,
  STONE_WALL: 160, STONE_GATE: 200, CAMPFIRE: 30, CHEST: 80, CRAFTING_TABLE: 100,
};

// ── creature.ts ───────────────────────────────────────────────────────────────
export type CreatureTier = 1 | 2 | 3 | 4;
export type CreatureType = "WOLF" | "BEAR" | "WILD_BOAR" | "SKELETON" | "OGRE" | "TROLL";

export const CREATURE_TIERS: Record<CreatureType, CreatureTier> = {
  WOLF: 1, BEAR: 1, WILD_BOAR: 1, SKELETON: 2, OGRE: 3, TROLL: 3,
};
export const CREATURE_SCORE_POINTS: Record<CreatureTier, number> = { 1: 3, 2: 5, 3: 40, 4: 100 };
export const CREATURE_DESTROYS_STRUCTURES: Record<CreatureType, boolean> = {
  WOLF: false, BEAR: false, WILD_BOAR: false, SKELETON: false, OGRE: true, TROLL: true,
};
export interface CreatureState {
  id: string; type: CreatureType; hp: number; maxHp: number;
  position: { x: number; y: number }; targetId?: string; aggroRange: number;
}
export const CORPSE_SPAWN_DELAY_MS = 10 * 60 * 1000;

// ── player.ts ─────────────────────────────────────────────────────────────────
export type PlayerClass = "WARRIOR" | "RANGER" | "BUILDER" | "MAGE" | "MERCHANT";
export interface CharacterStats {
  hp: number; maxHp: number; staminaPool: number; speed: number; attack: number; defense: number;
}
export const CLASS_MODIFIERS: Record<PlayerClass, Partial<CharacterStats> & { staminaDiscount?: number; attackBonus?: number }> = {
  WARRIOR: { attack: 10, attackBonus: 0.15 },
  RANGER:  { speed: 2 },
  BUILDER: { staminaDiscount: 0.2 },
  MAGE:    { staminaPool: 50 },
  MERCHANT: {},
};
export interface Character {
  address: string; owner: string; name: string; class: PlayerClass;
  stats: CharacterStats; stamina: number; lastStaminaRegen: number;
}
export interface PlayerState {
  character: Character; position: { x: number; y: number };
  inventory: ResourceStack[]; vault: ResourceStack[];
  isInSafeZone: boolean; isDead: boolean; seasonScore: number;
}
export const STAMINA_COSTS = {
  CHOP: 4, MINE: 4, PICK_UP: 2, ATTACK: 6,
  PLACE_STRUCTURE: 10, DESTROY_STRUCTURE: 12, USE_SHOVEL: 8, TRAVEL: 10,
} as const;
export const BASE_STAMINA = 200;
export const STAMINA_REGEN_PER_10MIN = 10;

// ── crafting.ts ───────────────────────────────────────────────────────────────
export type ToolType = "AXE" | "PICKAXE" | "SHOVEL" | "SWORD" | "BOW";
export interface CraftingIngredient { resource: ResourceType; amount: number; }
export interface CraftingRecipe {
  output: ToolType | StructureType;
  ingredients: CraftingIngredient[];
  staminaCost: number;
  requiresCraftingTable: boolean;
}
export const CRAFTING_RECIPES: CraftingRecipe[] = [
  { output: "AXE",            ingredients: [{ resource: "WOOD", amount: 2 }, { resource: "STONE", amount: 1 }], staminaCost: 5,  requiresCraftingTable: true  },
  { output: "PICKAXE",        ingredients: [{ resource: "WOOD", amount: 2 }, { resource: "STONE", amount: 2 }], staminaCost: 5,  requiresCraftingTable: true  },
  { output: "SHOVEL",         ingredients: [{ resource: "WOOD", amount: 3 }, { resource: "STONE", amount: 1 }], staminaCost: 5,  requiresCraftingTable: true  },
  { output: "SWORD",          ingredients: [{ resource: "WOOD", amount: 1 }, { resource: "STONE", amount: 3 }], staminaCost: 8,  requiresCraftingTable: true  },
  { output: "BOW",            ingredients: [{ resource: "WOOD", amount: 4 }, { resource: "FIBER", amount: 2 }], staminaCost: 10, requiresCraftingTable: true  },
  { output: "WOODEN_FENCE",   ingredients: [{ resource: "WOOD", amount: 4 }],  staminaCost: 2, requiresCraftingTable: false },
  { output: "WOODEN_WALL",    ingredients: [{ resource: "WOOD", amount: 8 }],  staminaCost: 3, requiresCraftingTable: false },
  { output: "WOODEN_DOOR",    ingredients: [{ resource: "WOOD", amount: 6 }],  staminaCost: 3, requiresCraftingTable: false },
  { output: "CAMPFIRE",       ingredients: [{ resource: "WOOD", amount: 3 }],  staminaCost: 2, requiresCraftingTable: false },
  { output: "CHEST",          ingredients: [{ resource: "WOOD", amount: 10 }], staminaCost: 4, requiresCraftingTable: true  },
  { output: "CRAFTING_TABLE", ingredients: [{ resource: "WOOD", amount: 12 }], staminaCost: 5, requiresCraftingTable: false },
];
export interface ToolItem { id: string; type: ToolType; durability: number; maxDurability: number; address?: string; }
export const TOOL_MAX_DURABILITY: Record<ToolType, number> = {
  AXE: 100, PICKAXE: 100, SHOVEL: 80, SWORD: 120, BOW: 80,
};
