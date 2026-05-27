import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import type { CreatureType } from "@medieval-land/shared";
import { CREATURE_TIERS, CREATURE_SCORE_POINTS } from "@medieval-land/shared";

const CREATURE_HP: Record<CreatureType, number> = {
  WOLF: 20,
  BEAR: 40,
  WILD_BOAR: 30,
  SKELETON: 25,
  OGRE: 120,
  TROLL: 100,
};

const CREATURE_SPEED: Record<CreatureType, number> = {
  WOLF: 60,
  BEAR: 45,
  WILD_BOAR: 70,
  SKELETON: 40,
  OGRE: 30,
  TROLL: 25,
};

const CREATURE_DAMAGE: Record<CreatureType, number> = {
  WOLF: 5,
  BEAR: 12,
  WILD_BOAR: 8,
  SKELETON: 7,
  OGRE: 20,
  TROLL: 18,
};

export class CreatureEntity extends Phaser.GameObjects.Sprite {
  creatureType: CreatureType;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  aggro = false;

  private attackCooldown = 0;
  private wanderTimer = 0;
  private wanderDir = { x: 0, y: 0 };

  constructor(scene: WorldScene, x: number, y: number, type: CreatureType) {
    super(scene, x, y, type.toLowerCase());
    scene.add.existing(this);

    this.creatureType = type;
    this.hp = CREATURE_HP[type];
    this.maxHp = this.hp;
    this.speed = CREATURE_SPEED[type];
    this.damage = CREATURE_DAMAGE[type];

    this.setInteractive({ useHandCursor: true });
    this.on("pointerdown", () => this.onAttacked(scene));
  }

  update() {
    const scene = this.scene as WorldScene;
    const player = scene.player;
    const dx = player.sprite.x - this.x;
    const dy = player.sprite.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const aggroRange = this.creatureType === "SKELETON" ? 96 : 64;

    if (dist < aggroRange) {
      this.aggro = true;
    }

    if (this.aggro) {
      const nx = dx / dist;
      const ny = dy / dist;
      this.x += nx * (this.speed / 60);
      this.y += ny * (this.speed / 60);

      // Attack player
      if (dist < 20 && Date.now() > this.attackCooldown) {
        player.hp -= this.damage;
        this.attackCooldown = Date.now() + 1000;
        if (player.hp <= 0) player.die();
      }
    } else {
      // Wander
      if (Date.now() > this.wanderTimer) {
        const angle = Math.random() * Math.PI * 2;
        this.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
        this.wanderTimer = Date.now() + 2000 + Math.random() * 3000;
      }
      this.x += this.wanderDir.x * (this.speed * 0.4) / 60;
      this.y += this.wanderDir.y * (this.speed * 0.4) / 60;
    }
  }

  onAttacked(scene: WorldScene) {
    const player = scene.player;
    if (!player.spendStamina("ATTACK")) {
      scene.game.events.emit("notification", "Not enough stamina!");
      return;
    }

    this.hp -= player.attack;
    this.aggro = true;

    if (this.hp <= 0) this.die(scene);
  }

  private die(scene: WorldScene) {
    const tier = CREATURE_TIERS[this.creatureType];
    const points = CREATURE_SCORE_POINTS[tier];
    scene.player.score += points;
    scene.game.events.emit("notification", `+${points} score`);
    this.destroy();
  }
}
