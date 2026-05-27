import type { WorldScene } from "../scenes/WorldScene";
import type { CreatureEntity } from "../entities/CreatureEntity";

export class CombatSystem {
  private scene: WorldScene;

  constructor(scene: WorldScene) {
    this.scene = scene;
  }

  checkProximityAggro() {
    const { player, creatures } = this.scene;
    creatures.getChildren().forEach((obj) => {
      const creature = obj as CreatureEntity;
      const dx = player.sprite.x - creature.x;
      const dy = player.sprite.y - creature.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 40 && !creature.aggro) {
        creature.aggro = true;
      }
    });
  }
}
