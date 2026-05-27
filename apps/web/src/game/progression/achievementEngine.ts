import type { ProfileManager, PlayerProfile } from "@/game/config/profileManager";
import { progressionBus } from "./progressionBus";
import { ACHIEVEMENTS, OUTFIT_NAMES } from "./achievementRegistry";

/**
 * Listens to the ProfileManager and fires achievement / outfit unlock
 * events onto the progression bus when thresholds are crossed.
 *
 * Idempotent: re-evaluating an already-unlocked achievement is a no-op.
 * The first evaluation after construct fires *no* events even if the profile
 * already satisfies achievements — we only celebrate the moment of crossing.
 */
export class AchievementEngine {
  private profileMgr: ProfileManager;
  private unlocked: Set<string>;

  constructor(profileMgr: ProfileManager) {
    this.profileMgr = profileMgr;
    const profile = profileMgr.get();
    this.unlocked = new Set(profile.unlockedAchievements ?? []);
    profileMgr.onChange((p) => this.evaluate(p));
  }

  bootstrap(): void {
    this.evaluate(this.profileMgr.get());
  }

  private evaluate(profile: PlayerProfile): void {
    const profileUnlocked = new Set(profile.unlockedAchievements);
    for (const id of this.unlocked) {
      if (!profileUnlocked.has(id)) this.unlocked.delete(id);
    }

    for (const ach of ACHIEVEMENTS) {
      if (this.unlocked.has(ach.id)) continue;
      if (!ach.check(profile)) continue;

      this.unlocked.add(ach.id);
      this.profileMgr.unlockAchievement(ach.id);

      progressionBus.emit({
        type: "achievement-unlocked",
        id: ach.id,
        title: ach.title,
        description: ach.description,
        icon: ach.icon,
      });

      if (ach.outfitReward) {
        const newly = this.profileMgr.unlockOutfit(ach.outfitReward);
        if (newly) {
          progressionBus.emit({
            type: "outfit-unlocked",
            outfitId: ach.outfitReward,
            outfitName: OUTFIT_NAMES[ach.outfitReward] ?? ach.outfitReward,
          });
        }
      }
    }
  }
}
