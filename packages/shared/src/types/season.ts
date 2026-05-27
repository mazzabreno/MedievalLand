export type SeasonPhase = "OPENING" | "MAIN" | "FINAL_WEEK" | "SETTLEMENT";

export interface SeasonState {
  id: number;
  phase: SeasonPhase;
  startTs: number;
  endTs: number;
  pvpEnabled: boolean;
  structureDestructionEnabled: boolean;
  ogreHordeMultiplier: number;
  scoreBonusMultiplier: number;
}

export interface ScoreEvent {
  player: string;
  points: number;
  reason: ScoreReason;
  ts: number;
}

export type ScoreReason =
  | "STRUCTURE_STANDING"
  | "RESOURCE_GATHERED"
  | "CREATURE_KILLED"
  | "PLAYER_KILLED"
  | "ITEM_EXTRACTED";

export const SCORE_VALUES = {
  STRUCTURE_PER_TILE: 20,
  RESOURCE_GATHERED: 1,
  CREATURE_TIER_1: 3,
  CREATURE_TIER_2: 5,
  CREATURE_TIER_3: 40,
  PLAYER_KILLED: 25,
  ITEM_EXTRACTED_T1: 2,
  ITEM_EXTRACTED_T2: 10,
  ITEM_EXTRACTED_T3: 50,
} as const;
