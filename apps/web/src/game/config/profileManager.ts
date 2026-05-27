import { progressionBus } from "@/game/progression/progressionBus";

export interface PlayerProfile {
  wallet: string | null;
  displayName: string;
  pfp: string | null;
  outfitId: string;
  /** PokeWilds trainer sprite key, e.g. "player-brendan" */
  spriteKey: string;
  score: number;
  harvestCount: number;
  buildCount: number;
  killCount: number;
  extractCount: number;
  unlockedOutfits: string[];
  unlockedAchievements: string[];
  visitedNPCs: string[];
  discoveredZones: string[];
  joinedAt: number;
  lastActive: number;
}

const STORAGE_KEY = "medieval-land-profile";

export class ProfileManager {
  private profile: PlayerProfile;
  private listeners: Array<(p: PlayerProfile) => void> = [];

  constructor() {
    this.profile = this.load();
  }

  get(): PlayerProfile { return { ...this.profile }; }

  setWallet(wallet: string | null): void {
    this.profile.wallet = wallet;
    if (wallet && this.profile.displayName === "Adventurer") {
      this.profile.displayName = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
    }
    this.save();
  }

  setDisplayName(name: string): void {
    this.profile.displayName = name.slice(0, 20);
    this.save();
  }

  setPfp(url: string | null): void {
    this.profile.pfp = url;
    this.save();
  }

  setOutfit(outfitId: string): void {
    this.profile.outfitId = outfitId;
    this.save();
  }

  addScore(amount: number, reason = "action"): void {
    this.profile.score += amount;
    this.profile.lastActive = Date.now();
    this.save();
    progressionBus.emit({ type: "score-gained", amount, reason });
  }

  recordHarvest(resource: string, amount: number): void {
    this.profile.harvestCount += amount;
    this.addScore(amount, `harvest:${resource}`);
    progressionBus.emit({ type: "harvest", resource, amount, scoreGained: amount });
  }

  recordBuild(structure: string): void {
    this.profile.buildCount += 1;
    this.addScore(5, `build:${structure}`);
    progressionBus.emit({ type: "build", structure, scoreGained: 5 });
  }

  recordKill(creature: string, tier: number): void {
    this.profile.killCount += 1;
    const pts = tier === 1 ? 3 : tier === 2 ? 5 : 40;
    this.addScore(pts, `kill:${creature}`);
    progressionBus.emit({ type: "kill", creature, tier, scoreGained: pts });
  }

  recordExtract(resource: string): void {
    this.profile.extractCount += 1;
    this.addScore(2, `extract:${resource}`);
    progressionBus.emit({ type: "extract", resource, scoreGained: 2 });
  }

  visitNPC(npcId: string, npcName: string): boolean {
    if (this.profile.visitedNPCs.includes(npcId)) {
      progressionBus.emit({ type: "npc-visited", npcId, npcName, firstTime: false });
      return false;
    }
    this.profile.visitedNPCs.push(npcId);
    this.addScore(5, `met:${npcName}`);
    this.save();
    progressionBus.emit({ type: "npc-visited", npcId, npcName, firstTime: true });
    return true;
  }

  unlockOutfit(outfitId: string): boolean {
    if (this.profile.unlockedOutfits.includes(outfitId)) return false;
    this.profile.unlockedOutfits.push(outfitId);
    this.save();
    return true;
  }

  unlockAchievement(id: string): boolean {
    if (this.profile.unlockedAchievements.includes(id)) return false;
    this.profile.unlockedAchievements.push(id);
    this.save();
    return true;
  }

  resetProgress(): void {
    this.profile.score = 0;
    this.profile.harvestCount = 0;
    this.profile.buildCount = 0;
    this.profile.killCount = 0;
    this.profile.extractCount = 0;
    this.profile.visitedNPCs = [];
    this.profile.unlockedAchievements = [];
    this.profile.unlockedOutfits = ["default"];
    this.profile.outfitId = "default";
    this.save();
  }

  onChange(cb: (p: PlayerProfile) => void): void { this.listeners.push(cb); }

  private save(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile)); } catch {}
    for (const cb of this.listeners) cb(this.get());
    progressionBus.emit({ type: "profile-updated", profile: this.get() });
  }

  private load(): PlayerProfile {
    const defaults: PlayerProfile = {
      wallet: null, displayName: "Adventurer", pfp: null, outfitId: "default", spriteKey: "player-brendan",
      score: 0, harvestCount: 0, buildCount: 0, killCount: 0, extractCount: 0,
      unlockedOutfits: ["default"], unlockedAchievements: [], visitedNPCs: [],
      discoveredZones: [], joinedAt: Date.now(), lastActive: Date.now(),
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch {}
    return defaults;
  }
}

export const profileManager =
  typeof window === "undefined"
    ? (null as unknown as ProfileManager)
    : new ProfileManager();
