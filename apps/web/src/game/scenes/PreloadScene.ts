import Phaser from "phaser";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
  }

  preload() {
    this.load.setBaseURL("/assets");

    // Tilesets — using PokeWilds-compatible 32x32 tiles for experiment
    this.load.image("tileset-overworld", "tilesets/overworld.png");
    this.load.image("tileset-trees", "tilesets/trees.png");
    this.load.image("tileset-structures", "tilesets/structures.png");

    // Sprites
    this.load.spritesheet("player", "sprites/player.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("wolf", "sprites/wolf.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("bear", "sprites/bear.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("skeleton", "sprites/skeleton.png", { frameWidth: 32, frameHeight: 32 });

    // UI icons
    this.load.image("icon-wood", "sprites/icon_wood.png");
    this.load.image("icon-stone", "sprites/icon_stone.png");
    this.load.image("icon-axe", "sprites/icon_axe.png");
    this.load.image("icon-pickaxe", "sprites/icon_pickaxe.png");
    this.load.image("icon-shovel", "sprites/icon_shovel.png");

    // Progress bar
    const { width, height } = this.scale;
    const bar = this.add.graphics();
    this.load.on("progress", (value: number) => {
      bar.clear();
      bar.fillStyle(0xe8d5a3);
      bar.fillRect(width / 4, height / 2 - 10, (width / 2) * value, 20);
    });
    this.load.on("complete", () => bar.destroy());
  }

  create() {
    this.scene.start("WorldScene");
  }
}
