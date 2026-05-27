import type { ResourceType } from "./world";

export type ToolType = "AXE" | "PICKAXE" | "SHOVEL" | "SWORD" | "BOW";

export interface CraftingIngredient {
  resource: ResourceType;
  amount: number;
}

export interface CraftingRecipe {
  output: ToolType | "WOODEN_FENCE" | "WOODEN_WALL" | "WOODEN_DOOR" | "CAMPFIRE" | "CHEST" | "CRAFTING_TABLE";
  ingredients: CraftingIngredient[];
  staminaCost: number;
  requiresCraftingTable: boolean;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Tools
  { output: "AXE",           ingredients: [{ resource: "WOOD", amount: 2 }, { resource: "STONE", amount: 1 }], staminaCost: 5, requiresCraftingTable: true },
  { output: "PICKAXE",       ingredients: [{ resource: "WOOD", amount: 2 }, { resource: "STONE", amount: 2 }], staminaCost: 5, requiresCraftingTable: true },
  { output: "SHOVEL",        ingredients: [{ resource: "WOOD", amount: 3 }, { resource: "STONE", amount: 1 }], staminaCost: 5, requiresCraftingTable: true },
  { output: "SWORD",         ingredients: [{ resource: "WOOD", amount: 1 }, { resource: "STONE", amount: 3 }], staminaCost: 8, requiresCraftingTable: true },
  { output: "BOW",           ingredients: [{ resource: "WOOD", amount: 4 }, { resource: "FIBER", amount: 2 }], staminaCost: 10, requiresCraftingTable: true },
  // Structures (crafted in-hand, placed directly)
  { output: "WOODEN_FENCE",  ingredients: [{ resource: "WOOD", amount: 4 }],  staminaCost: 2, requiresCraftingTable: false },
  { output: "WOODEN_WALL",   ingredients: [{ resource: "WOOD", amount: 8 }],  staminaCost: 3, requiresCraftingTable: false },
  { output: "WOODEN_DOOR",   ingredients: [{ resource: "WOOD", amount: 6 }],  staminaCost: 3, requiresCraftingTable: false },
  { output: "CAMPFIRE",      ingredients: [{ resource: "WOOD", amount: 3 }],  staminaCost: 2, requiresCraftingTable: false },
  { output: "CHEST",         ingredients: [{ resource: "WOOD", amount: 10 }], staminaCost: 4, requiresCraftingTable: true },
  { output: "CRAFTING_TABLE",ingredients: [{ resource: "WOOD", amount: 12 }], staminaCost: 5, requiresCraftingTable: false },
];

export interface ToolItem {
  id: string;
  type: ToolType;
  durability: number;
  maxDurability: number;
  /** on-chain item account */
  address?: string;
}

export const TOOL_MAX_DURABILITY: Record<ToolType, number> = {
  AXE: 100,
  PICKAXE: 100,
  SHOVEL: 80,
  SWORD: 120,
  BOW: 80,
};
