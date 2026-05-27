import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import type { StructureType } from "@medieval-land/shared";
import { STRUCTURE_HP, STRUCTURE_COSTS } from "@medieval-land/shared";

export class StructureEntity extends Phaser.GameObjects.Sprite {
  structureType: StructureType;
  hp: number;
  maxHp: number;
  owner: string | null = null;

  constructor(scene: WorldScene, x: number, y: number, type: StructureType) {
    super(scene, x, y, "tileset-structures");
    scene.add.existing(this);

    this.structureType = type;
    this.hp = STRUCTURE_HP[type];
    this.maxHp = this.hp;

    this.setInteractive({ useHandCursor: true });
    this.on("pointerdown", () => this.onInteract(scene));
  }

  onInteract(scene: WorldScene) {
    const player = scene.player;
    const inSafe = scene.isInSafeZone(this.x, this.y);

    if (inSafe) return; // Cannot destroy Safe Zone structures

    if (!player.spendStamina("DESTROY_STRUCTURE")) {
      scene.game.events.emit("notification", "Not enough stamina!");
      return;
    }

    this.hp -= 10;

    if (this.hp <= 0) {
      // Yield ~50% of construction materials
      const cost = STRUCTURE_COSTS[this.structureType];
      const yieldAmount = Math.floor(cost.amount * 0.5);
      if (yieldAmount > 0) {
        scene.droppedItems.add(
          scene.add.text(this.x, this.y, cost.resource[0], { fontSize: "8px" })
            .setData("stack", { type: cost.resource, amount: yieldAmount })
        );
      }
      this.destroy();
    }
  }
}
