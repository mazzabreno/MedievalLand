export type CreatureTier = 1 | 2 | 3 | 4;
export type CreatureType = "WOLF" | "BEAR" | "WILD_BOAR" | "SKELETON" | "OGRE" | "TROLL";

export const CREATURE_TIERS: Record<CreatureType, CreatureTier> = {
  WOLF: 1,
  BEAR: 1,
  WILD_BOAR: 1,
  SKELETON: 2,
  OGRE: 3,
  TROLL: 3,
};

export const CREATURE_DESTROYS_STRUCTURES: Record<CreatureType, boolean> = {
  WOLF: false,
  BEAR: false,
  WILD_BOAR: false,
  SKELETON: false,
  OGRE: true,
  TROLL: true,
};

export const CREATURE_SCORE_POINTS: Record<CreatureTier, number> = {
  1: 3,
  2: 5,
  3: 40,
  4: 100,
};

export interface CreatureState {
  id: string;
  type: CreatureType;
  hp: number;
  maxHp: number;
  position: { x: number; y: number };
  targetId?: string;
  /** undefined = wandering */
  aggroRange: number;
}

/** Skeleton spawns from uncleaned player corpse after this many ms */
export const CORPSE_SPAWN_DELAY_MS = 10 * 60 * 1000; // 10 minutes
