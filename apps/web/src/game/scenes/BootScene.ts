import * as Phaser from "phaser";
import { generateMedievalTileset } from "../utils/tilesetGenerator";
import { SimpleSprite } from "../entities/SimpleSprite";
import { NPC_REGISTRY } from "../config/npcRegistry";

// Medieval tileset PNG keys — loaded from public/assets/tilesets/
// Missing files are silently ignored; the WorldGenerator provides a fallback.
const TILESET_KEYS = [
  "MLGrass",
  "MLTerrain",
  "MLTrees",
  "MLBuildings",
  "MLObjects",
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      if (file.key === "world-map") {
        console.info("[BootScene] world.json not found — procedural world will be used");
      } else if (file.key === "avatar-player") {
        console.info("[BootScene] main_char.png missing — generated sprite will be used");
        this.textures.remove(file.key);
      } else if (NPC_REGISTRY.some(n => n.spriteKey === file.key)) {
        console.info(`[BootScene] ${file.key} sprite missing — fallback active`);
        this.textures.remove(file.key);
      }
    });

    // Tiled map JSON with embedded tileset metadata
    this.load.tilemapTiledJSON("world-map", "assets/maps/world.json");

    // Tileset spritesheet PNGs
    for (const key of TILESET_KEYS) {
      this.load.image(key, `assets/tilesets/${key}.png`);
    }

    // Player sprite: 64×64 spritesheet, 4 rows (directions) × 4+ columns (walk frames)
    SimpleSprite.load(this, "avatar-player", "assets/sprites/main_char.png", 64, 64);

    // NPC sprites — deduplicated by spriteKey
    const loadedKeys = new Set<string>();
    for (const npc of NPC_REGISTRY) {
      if (!npc.spriteKey || loadedKeys.has(npc.spriteKey)) continue;
      loadedKeys.add(npc.spriteKey);
      const filename = npc.spriteKey.startsWith("avatar-")
        ? npc.spriteKey.replace(/^avatar-/, "")
        : npc.spriteKey;
      SimpleSprite.load(this, npc.spriteKey, `assets/sprites/${filename}.png`, 64, 64);
    }
  }

  create(): void {
    // Always generate the procedural tileset so WorldGenerator has a fallback texture
    generateMedievalTileset(this);
    this.scene.start("WorldScene");
  }
}
