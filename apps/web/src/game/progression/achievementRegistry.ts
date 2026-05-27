import type { PlayerProfile } from "@/game/config/profileManager";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: "common" | "rare" | "epic" | "legendary";
  check: (p: PlayerProfile) => boolean;
  outfitReward?: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── First-time milestones ──────────────────────────────────────────
  {
    id: "first-harvest",
    title: "First Harvest",
    description: "You gathered your first resource from the land.",
    icon: "🌿",
    tier: "common",
    check: (p) => p.harvestCount >= 1,
    outfitReward: "peasant-tunic",
  },
  {
    id: "first-build",
    title: "First Builder",
    description: "You raised your first structure.",
    icon: "🏗️",
    tier: "common",
    check: (p) => p.buildCount >= 1,
    outfitReward: "builder-vest",
  },
  {
    id: "first-kill",
    title: "First Blood",
    description: "You defeated your first creature.",
    icon: "⚔️",
    tier: "common",
    check: (p) => p.killCount >= 1,
    outfitReward: "warrior-cap",
  },

  // ── Exploration ────────────────────────────────────────────────────
  {
    id: "met-aldric",
    title: "The Elder's Welcome",
    description: "You spoke with Elder Aldric.",
    icon: "👋",
    tier: "common",
    check: (p) => p.visitedNPCs.includes("elder"),
  },
  {
    id: "met-everyone",
    title: "Realm Traveller",
    description: "You spoke to every NPC in the realm.",
    icon: "🗺️",
    tier: "rare",
    check: (p) =>
      ["elder", "blacksmith", "merchant", "ranger", "sage"].every((id) =>
        p.visitedNPCs.includes(id)
      ),
    outfitReward: "explorer-cloak",
  },

  // ── Progression ────────────────────────────────────────────────────
  {
    id: "harvester-10",
    title: "Seasoned Harvester",
    description: "Gather resources 10 times.",
    icon: "🌳",
    tier: "rare",
    check: (p) => p.harvestCount >= 10,
    outfitReward: "druid-robes",
  },
  {
    id: "builder-5",
    title: "Master Builder",
    description: "Raise 5 structures.",
    icon: "🏰",
    tier: "rare",
    check: (p) => p.buildCount >= 5,
    outfitReward: "architect-coat",
  },
  {
    id: "slayer-10",
    title: "Creature Slayer",
    description: "Defeat 10 creatures.",
    icon: "🗡️",
    tier: "rare",
    check: (p) => p.killCount >= 10,
    outfitReward: "knight-armor",
  },

  // ── Summit ─────────────────────────────────────────────────────────
  {
    id: "score-1000",
    title: "Champion of the Realm",
    description: "Reach a score of 1000.",
    icon: "👑",
    tier: "legendary",
    check: (p) => p.score >= 1000,
    outfitReward: "champion-regalia",
  },
];

export const TIER_COLORS: Record<AchievementDef["tier"], string> = {
  common:    "#14F195",
  rare:      "#00D1FF",
  epic:      "#9945FF",
  legendary: "#FFD700",
};

export const OUTFIT_NAMES: Record<string, string> = {
  "default":           "Default",
  "peasant-tunic":     "Peasant's Tunic",
  "builder-vest":      "Builder's Vest",
  "warrior-cap":       "Warrior's Cap",
  "explorer-cloak":    "Explorer's Cloak",
  "druid-robes":       "Druid Robes",
  "architect-coat":    "Architect's Coat",
  "knight-armor":      "Knight's Armor",
  "champion-regalia":  "Champion's Regalia",
};
