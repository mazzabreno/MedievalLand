import type { ResourceStack } from "./world";

export type PlayerClass = "WARRIOR" | "RANGER" | "BUILDER" | "MAGE" | "MERCHANT";

export interface CharacterStats {
  hp: number;
  maxHp: number;
  staminaPool: number;
  speed: number;
  attack: number;
  defense: number;
}

export const CLASS_MODIFIERS: Record<PlayerClass, Partial<CharacterStats> & { staminaDiscount?: number; attackBonus?: number }> = {
  WARRIOR: { attack: 10, attackBonus: 0.15 },
  RANGER: { speed: 2 },
  BUILDER: { staminaDiscount: 0.2 },
  MAGE: { staminaPool: 50 },
  MERCHANT: {},
};

export interface Character {
  /** Solana compressed NFT address */
  address: string;
  owner: string;
  name: string;
  class: PlayerClass;
  stats: CharacterStats;
  /** Current stamina (runtime, not on-chain) */
  stamina: number;
  lastStaminaRegen: number;
}

export interface PlayerState {
  character: Character;
  position: { x: number; y: number };
  /** Items in open-world inventory — lost on death */
  inventory: ResourceStack[];
  /** Items in Safe Zone vault — never lost */
  vault: ResourceStack[];
  isInSafeZone: boolean;
  isDead: boolean;
  seasonScore: number;
}

/** Stamina costs per action */
export const STAMINA_COSTS = {
  CHOP: 4,
  MINE: 4,
  PICK_UP: 2,
  ATTACK: 6,
  PLACE_STRUCTURE: 10,
  DESTROY_STRUCTURE: 12,
  USE_SHOVEL: 8,
  TRAVEL: 10,
} as const;

export const BASE_STAMINA = 200;
export const STAMINA_REGEN_PER_10MIN = 10;
