import type { PlayerEntity } from "../entities/PlayerEntity";
import { STAMINA_REGEN_PER_10MIN } from "@medieval-land/shared";

/** Regenerates player stamina in real time. 10 per 10 minutes = 1 per minute. */
export class StaminaSystem {
  private player: PlayerEntity;
  private lastRegen = Date.now();
  private readonly REGEN_INTERVAL_MS = 60_000; // 1 minute

  constructor(player: PlayerEntity) {
    this.player = player;
  }

  update() {
    const now = Date.now();
    const elapsed = now - this.lastRegen;
    const ticks = Math.floor(elapsed / this.REGEN_INTERVAL_MS);
    if (ticks > 0) {
      const regen = ticks * (STAMINA_REGEN_PER_10MIN / 10);
      this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + regen);
      this.lastRegen += ticks * this.REGEN_INTERVAL_MS;
    }
  }
}
