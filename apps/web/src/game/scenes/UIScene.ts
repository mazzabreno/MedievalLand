import Phaser from "phaser";
import type { WorldScene } from "./WorldScene";

/**
 * Transparent Phaser scene that sits above WorldScene.
 * Emits events consumed by React HUD via the game's EventEmitter.
 */
export class UIScene extends Phaser.Scene {
  private world!: WorldScene;

  constructor() {
    super({ key: "UIScene" });
  }

  init(data: { worldScene: WorldScene }) {
    this.world = data.worldScene;
  }

  create() {
    // Relay player state to React every 250ms
    this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => {
        this.game.events.emit("player-state-update", {
          stamina: this.world.player.stamina,
          maxStamina: this.world.player.maxStamina,
          hp: this.world.player.hp,
          maxHp: this.world.player.maxHp,
          inventory: this.world.player.inventory,
          inSafeZone: this.world.isInSafeZone(this.world.player.sprite.x, this.world.player.sprite.y),
          score: this.world.player.score,
        });
      },
    });
  }
}
