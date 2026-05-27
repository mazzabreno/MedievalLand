import Phaser from "phaser";
import { TILE_SIZE, MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from "../config/gameConfig";
import { PlayerEntity } from "../entities/PlayerEntity";
import { ResourceNodeEntity } from "../entities/ResourceNodeEntity";
import { CreatureEntity } from "../entities/CreatureEntity";
import { StructureEntity } from "../entities/StructureEntity";
import { StaminaSystem } from "../systems/StaminaSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { BuildingSystem } from "../systems/BuildingSystem";
import { WorldGenerator } from "../systems/WorldGenerator";
import type { TileType } from "@medieval-land/shared";

export class WorldScene extends Phaser.Scene {
  player!: PlayerEntity;
  resourceNodes!: Phaser.GameObjects.Group;
  creatures!: Phaser.GameObjects.Group;
  structures!: Phaser.GameObjects.Group;
  droppedItems!: Phaser.GameObjects.Group;

  staminaSystem!: StaminaSystem;
  combatSystem!: CombatSystem;
  buildingSystem!: BuildingSystem;

  groundLayer!: Phaser.Tilemaps.TilemapLayer;
  decorLayer!: Phaser.Tilemaps.TilemapLayer;
  safeZones: Phaser.Geom.Rectangle[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super({ key: "WorldScene" });
  }

  create() {
    const generator = new WorldGenerator(this, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
    const { groundLayer, decorLayer, safeZones, resourceNodes, structures } =
      generator.generate("GREEN_FIELD");

    this.groundLayer = groundLayer;
    this.decorLayer = decorLayer;
    this.safeZones = safeZones;

    this.resourceNodes = this.add.group();
    this.creatures = this.add.group();
    this.structures = this.add.group();
    this.droppedItems = this.add.group();

    resourceNodes.forEach((n) => this.resourceNodes.add(new ResourceNodeEntity(this, n.x, n.y, n.type)));
    structures.forEach((s) => this.structures.add(new StructureEntity(this, s.x, s.y, s.type)));

    this.player = new PlayerEntity(this, 4 * TILE_SIZE, 4 * TILE_SIZE);

    this.staminaSystem = new StaminaSystem(this.player);
    this.combatSystem = new CombatSystem(this);
    this.buildingSystem = new BuildingSystem(this);

    // Camera follows player
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);

    // World bounds
    this.physics.world.setBounds(0, 0, MAP_WIDTH_TILES * TILE_SIZE, MAP_HEIGHT_TILES * TILE_SIZE);
    this.cameras.main.setBounds(0, 0, MAP_WIDTH_TILES * TILE_SIZE, MAP_HEIGHT_TILES * TILE_SIZE);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;

    // Spawn initial creatures
    this.spawnInitialCreatures();

    // World tick
    this.time.addEvent({
      delay: 60_000,
      loop: true,
      callback: this.onWorldTick,
      callbackScope: this,
    });

    // UI scene launched on top
    this.scene.launch("UIScene", { worldScene: this });
  }

  update(_time: number, _delta: number) {
    this.player.handleInput(this.cursors, this.wasd);
    this.staminaSystem.update();

    this.creatures.getChildren().forEach((c) => (c as CreatureEntity).update());
    this.combatSystem.checkProximityAggro();
  }

  isInSafeZone(x: number, y: number): boolean {
    return this.safeZones.some((rect) => rect.contains(x, y));
  }

  private spawnInitialCreatures() {
    const spawnPoints = [
      { x: 30, y: 20, type: "WOLF" as const },
      { x: 40, y: 15, type: "BEAR" as const },
      { x: 50, y: 35, type: "WILD_BOAR" as const },
      { x: 25, y: 45, type: "WOLF" as const },
    ];
    spawnPoints.forEach(({ x, y, type }) => {
      this.creatures.add(new CreatureEntity(this, x * TILE_SIZE, y * TILE_SIZE, type));
    });
  }

  private onWorldTick() {
    // Check for corpse->skeleton spawn
    this.droppedItems.getChildren().forEach((item: Phaser.GameObjects.GameObject) => {
      const corpse = item as unknown as { isCorpse?: boolean; deadline?: number; x: number; y: number };
      if (corpse.isCorpse && corpse.deadline && Date.now() > corpse.deadline) {
        this.creatures.add(new CreatureEntity(this, corpse.x, corpse.y, "SKELETON"));
        item.destroy();
      }
    });
  }
}
