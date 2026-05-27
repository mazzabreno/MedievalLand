import * as Phaser from "phaser";
import { generateMedievalTileset } from "../utils/tilesetGenerator";
import { SimpleSprite } from "../entities/SimpleSprite";
import { PLAYER_SPRITES } from "../config/npcRegistry";

// ── Player trainers ──────────────────────────────────────────────────────────
// All selectable player sprites + the 5 NPC trainers
const PLAYER_TRAINER_FILES: Array<{ key: string; file: string }> = [
  ...PLAYER_SPRITES.map(p => ({
    key:  p.key,
    file: p.key.replace("player-", "") + "-walking.png",
  })),
];

// NPC trainers (fixed assignments from npcRegistry)
const NPC_TRAINER_FILES: Array<{ key: string; file: string }> = [
  { key: "npc-gold",    file: "gold-walking.png"    },
  { key: "npc-hilbert", file: "hilbert-walking.png" },
  { key: "npc-rosa",    file: "rosa-walking.png"    },
  { key: "npc-leaf",    file: "leaf-walking.png"    },
  { key: "npc-lyra",    file: "lyra-walking.png"    },
];

// ── Tile images (individual PNGs from PokeWilds) ─────────────────────────────
const TILE_IMAGES: Array<{ key: string; file: string }> = [
  { key: "tile-ground1",     file: "ground1.png"      },
  { key: "tile-ground2",     file: "ground2.png"      },
  { key: "tile-path",        file: "path1.png"        },
  { key: "tile-water",       file: "water1.png"       },
  { key: "tile-tree",        file: "tree1.png"        },
  { key: "tile-tree-large",  file: "tree_large1.png"  },
  { key: "tile-rock",        file: "rock1.png"        },
  { key: "tile-bush",        file: "bush1.png"        },
  { key: "tile-campfire",    file: "campfire1.png"    },
  { key: "tile-chest",       file: "chest1.png"       },
  { key: "tile-fence",       file: "fence1.png"       },
  { key: "tile-flower",      file: "flower1.png"      },
  { key: "tile-grass-detail",file: "grass_detail.png" },
  { key: "tile-torch",       file: "torch.png"        },
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // Silence 404s gracefully — procedural fallback covers missing assets
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      console.info(`[BootScene] asset not found (ok): ${file.key}`);
      this.textures.remove(file.key);
    });

    // Optional Tiled map
    this.load.tilemapTiledJSON("world-map", "assets/maps/world.json");

    // ── Player trainer sprites ─────────────────────────────────────────────
    for (const { key, file } of PLAYER_TRAINER_FILES) {
      SimpleSprite.load(this, key, `assets/sprites/${file}`);
    }

    // ── NPC trainer sprites ────────────────────────────────────────────────
    for (const { key, file } of NPC_TRAINER_FILES) {
      SimpleSprite.load(this, key, `assets/sprites/${file}`);
    }

    // ── Tile images ────────────────────────────────────────────────────────
    for (const { key, file } of TILE_IMAGES) {
      this.load.image(key, `assets/tilesets/${file}`);
    }

    // ── Day/night overlays ─────────────────────────────────────────────────
    for (let i = 1; i <= 4; i++) {
      this.load.image(`shade${i}`, `assets/fx/shade${i}.png`);
    }
    this.load.image("torch-mask", "assets/fx/torch_mask.png");

    // ── UI ─────────────────────────────────────────────────────────────────
    this.load.image("ui-frame",   "assets/ui/frame.png");
    this.load.image("ui-textbox", "assets/ui/textbox.png");

    // ── Sounds ────────────────────────────────────────────────────────────
    const sounds = ["cut", "dig", "step", "enter", "exit", "save", "score", "gate"];
    for (const s of sounds) {
      this.load.audio(`sfx-${s}`, `assets/sounds/${s}.ogg`);
    }

    // ── Music ─────────────────────────────────────────────────────────────
    this.load.audio("music-overworld", "assets/music/overworld.ogg");
    this.load.audio("music-night",     "assets/music/night.ogg");
    this.load.audio("music-forest",    "assets/music/forest.ogg");

    // Loading progress bar
    const { width, height } = this.scale;
    const bar = this.add.graphics();
    this.load.on("progress", (v: number) => {
      bar.clear();
      bar.fillStyle(0x9945ff, 0.8);
      bar.fillRect(width * 0.1, height * 0.5 - 8, width * 0.8 * v, 16);
    });
    this.load.on("complete", () => bar.destroy());
  }

  create(): void {
    // Always generate procedural tileset so WorldGenerator has a canvas fallback
    generateMedievalTileset(this);
    this.scene.start("WorldScene");
  }
}
