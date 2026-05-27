import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import { TILE_SIZE } from "../config/gameConfig";
import { BASE_STAMINA, STAMINA_COSTS } from "@medieval-land/shared";
import type { ResourceStack, ToolType } from "@medieval-land/shared";

export class PlayerEntity {
  scene: WorldScene;
  sprite: Phaser.Physics.Arcade.Sprite;

  hp = 100;
  maxHp = 100;
  stamina = BASE_STAMINA;
  maxStamina = BASE_STAMINA;
  speed = 80;
  attack = 10;
  defense = 0;

  inventory: ResourceStack[] = [];
  equippedTool: ToolType | null = null;
  score = 0;

  private moveSpeed = 80;

  constructor(scene: WorldScene, x: number, y: number) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, "player", 0);
    this.sprite.setCollideWorldBounds(true);

    this.createAnimations();
  }

  handleInput(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasd: Record<string, Phaser.Input.Keyboard.Key>
  ) {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    if (cursors.left.isDown || wasd["A"]?.isDown) vx = -this.moveSpeed;
    else if (cursors.right.isDown || wasd["D"]?.isDown) vx = this.moveSpeed;
    if (cursors.up.isDown || wasd["W"]?.isDown) vy = -this.moveSpeed;
    else if (cursors.down.isDown || wasd["S"]?.isDown) vy = this.moveSpeed;

    body.setVelocity(vx, vy);

    if (vx !== 0 || vy !== 0) {
      const anim = vy < 0 ? "walk-up" : vy > 0 ? "walk-down" : vx < 0 ? "walk-left" : "walk-right";
      this.sprite.play(anim, true);
    } else {
      this.sprite.stop();
    }
  }

  spendStamina(action: keyof typeof STAMINA_COSTS): boolean {
    const cost = STAMINA_COSTS[action];
    if (this.stamina < cost) return false;
    this.stamina -= cost;
    return true;
  }

  addResource(type: ResourceStack["type"], amount: number) {
    const existing = this.inventory.find((s) => s.type === type);
    if (existing) existing.amount += amount;
    else this.inventory.push({ type, amount });
  }

  removeResource(type: ResourceStack["type"], amount: number): boolean {
    const stack = this.inventory.find((s) => s.type === type);
    if (!stack || stack.amount < amount) return false;
    stack.amount -= amount;
    if (stack.amount === 0) this.inventory = this.inventory.filter((s) => s.type !== type);
    return true;
  }

  getResourceAmount(type: ResourceStack["type"]): number {
    return this.inventory.find((s) => s.type === type)?.amount ?? 0;
  }

  die() {
    const { x, y } = this.sprite;
    const inSafe = this.scene.isInSafeZone(x, y);

    if (!inSafe) {
      // Drop all inventory on ground
      this.inventory.forEach((stack) => {
        this.scene.droppedItems.add(
          this.scene.add.text(x, y, stack.type[0], { fontSize: "8px" }).setData("stack", stack)
        );
      });
      this.inventory = [];

      // Leave corpse — skeleton spawns after 10 minutes
      const corpseMarker = this.scene.add.text(x, y, "☠", { fontSize: "16px", color: "#ffffff" });
      (corpseMarker as unknown as { isCorpse: boolean; deadline: number }).isCorpse = true;
      (corpseMarker as unknown as { isCorpse: boolean; deadline: number }).deadline = Date.now() + 10 * 60 * 1000;
      this.scene.droppedItems.add(corpseMarker);
    }

    // Respawn at Safe Zone origin
    this.sprite.setPosition(4 * TILE_SIZE, 4 * TILE_SIZE);
    this.hp = this.maxHp;
  }

  private createAnimations() {
    const anims = this.scene.anims;
    if (anims.exists("walk-down")) return;

    const rows = [{ key: "walk-down", start: 0 }, { key: "walk-left", start: 4 }, { key: "walk-right", start: 8 }, { key: "walk-up", start: 12 }];
    rows.forEach(({ key, start }) => {
      anims.create({ key, frames: anims.generateFrameNumbers("player", { start, end: start + 3 }), frameRate: 8, repeat: -1 });
    });
  }
}
