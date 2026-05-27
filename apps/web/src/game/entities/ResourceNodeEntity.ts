import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import type { TileType } from "@medieval-land/shared";

const NODE_YIELDS: Partial<Record<TileType, { resource: "WOOD" | "STONE" | "FIBER" | "FOOD"; amount: number; requiredTool: "AXE" | "PICKAXE" | null }>> = {
  TREE_OAK: { resource: "WOOD", amount: 3, requiredTool: "AXE" },
  BUSH: { resource: "FIBER", amount: 2, requiredTool: null },
  BERRY_SHRUB: { resource: "FOOD", amount: 2, requiredTool: null },
  ROCK_NODE: { resource: "STONE", amount: 2, requiredTool: "PICKAXE" },
};

export class ResourceNodeEntity extends Phaser.GameObjects.Sprite {
  nodeType: TileType;
  depleted = false;
  hp: number;
  maxHp: number;

  private static HP_BY_TYPE: Partial<Record<TileType, number>> = {
    TREE_OAK: 5,
    BUSH: 2,
    BERRY_SHRUB: 2,
    ROCK_NODE: 8,
  };

  constructor(scene: WorldScene, x: number, y: number, type: TileType) {
    const textureKey = type === "TREE_OAK" ? "tileset-trees" : "tileset-overworld";
    super(scene, x, y, textureKey);
    scene.add.existing(this);

    this.nodeType = type;
    this.hp = ResourceNodeEntity.HP_BY_TYPE[type] ?? 3;
    this.maxHp = this.hp;
    this.setInteractive({ useHandCursor: true });

    this.on("pointerdown", () => this.onInteract(scene));
  }

  onInteract(scene: WorldScene) {
    if (this.depleted) return;
    const { player } = scene;
    const yield_ = NODE_YIELDS[this.nodeType];
    if (!yield_) return;

    // Check tool requirement
    if (yield_.requiredTool && player.equippedTool !== yield_.requiredTool) {
      scene.game.events.emit("notification", `Need ${yield_.requiredTool} to harvest this`);
      return;
    }

    const action = this.nodeType === "ROCK_NODE" ? "MINE" : "CHOP";
    if (!player.spendStamina(action)) {
      scene.game.events.emit("notification", "Not enough stamina!");
      return;
    }

    this.hp--;
    player.addResource(yield_.resource, yield_.amount);
    scene.game.events.emit("notification", `+${yield_.amount} ${yield_.resource}`);

    if (this.hp <= 0) {
      this.setAlpha(0.3);
      this.depleted = true;
      // Finite nodes — do not respawn automatically (GDD rule)
    }
  }
}
