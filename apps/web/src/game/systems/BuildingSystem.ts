import type { WorldScene } from "../scenes/WorldScene";
import type { StructureType } from "@/shared";
import { STRUCTURE_COSTS } from "@/shared";
import { StructureEntity } from "../entities/StructureEntity";

export class BuildingSystem {
  private scene: WorldScene;
  private placementMode = false;
  private pendingType: StructureType | null = null;
  private ghost: Phaser.GameObjects.Sprite | null = null;

  constructor(scene: WorldScene) {
    this.scene = scene;

    scene.input.on("pointermove", this.onPointerMove, this);
    scene.input.on("pointerdown", this.onPointerDown, this);
  }

  enterPlacementMode(type: StructureType) {
    this.pendingType = type;
    this.placementMode = true;
    this.ghost = this.scene.add.sprite(0, 0, "tileset-structures").setAlpha(0.5);
  }

  exitPlacementMode() {
    this.placementMode = false;
    this.pendingType = null;
    this.ghost?.destroy();
    this.ghost = null;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.placementMode || !this.ghost) return;
    const cam = this.scene.cameras.main;
    const worldX = pointer.x / cam.zoom + cam.scrollX;
    const worldY = pointer.y / cam.zoom + cam.scrollY;
    this.ghost.setPosition(
      Math.floor(worldX / 32) * 32 + 16,
      Math.floor(worldY / 32) * 32 + 16
    );
    const canPlace = !this.scene.isInSafeZone(this.ghost.x, this.ghost.y);
    this.ghost.setTint(canPlace ? 0x00ff00 : 0xff0000);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.placementMode || !this.pendingType || !this.ghost) return;
    if (pointer.rightButtonDown()) { this.exitPlacementMode(); return; }

    const x = this.ghost.x;
    const y = this.ghost.y;

    if (this.scene.isInSafeZone(x, y)) {
      this.scene.game.events.emit("notification", "Cannot build in Safe Zone");
      return;
    }

    const cost = STRUCTURE_COSTS[this.pendingType];
    if (!this.scene.player.removeResource(cost.resource, cost.amount)) {
      this.scene.game.events.emit("notification", `Need ${cost.amount}x ${cost.resource}`);
      return;
    }

    if (!this.scene.player.spendStamina("PLACE_STRUCTURE")) {
      this.scene.game.events.emit("notification", "Not enough stamina!");
      this.scene.player.addResource(cost.resource, cost.amount); // refund
      return;
    }

    const structure = new StructureEntity(this.scene, x, y, this.pendingType);
    structure.owner = "local-player";
    this.scene.structures.add(structure);
    this.exitPlacementMode();
  }
}
