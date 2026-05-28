"use client";
import * as Phaser from "phaser";
import { generateMedievalTileset, generateFallbackTiles, rebuildTilesetWithPokeWildsAssets } from "../utils/tilesetGenerator";
import { SimpleSprite } from "../entities/SimpleSprite";
import { PLAYER_SPRITES } from "../config/npcRegistry";

// ── PokeWilds raw asset base URL ─────────────────────────────────────────────
const PW = "https://raw.githubusercontent.com/SheerSt/pokewilds/main";

// ── Player trainer walking sprites ───────────────────────────────────────────
const PLAYER_TRAINER_FILES: Array<{ key: string; url: string }> = PLAYER_SPRITES.map(p => ({
  key: p.key,
  url: `${PW}/player/${p.key.replace("player-", "")}-walking.png`,
}));

// NPC trainers (fixed from npcRegistry)
const NPC_TRAINER_FILES: Array<{ key: string; url: string }> = [
  { key: "npc-gold",    url: `${PW}/player/gold-walking.png`    },
  { key: "npc-hilbert", url: `${PW}/player/hilbert-walking.png` },
  { key: "npc-rosa",    url: `${PW}/player/rosa-walking.png`    },
  { key: "npc-leaf",    url: `${PW}/player/leaf-walking.png`    },
  { key: "npc-lyra",    url: `${PW}/player/lyra-walking.png`    },
];

// ── Tile images — loaded directly from PokeWilds GitHub ──────────────────────
// Verified paths as of 2025 (see tiles/ and root of repo):
//   root:  ground1.png, ground2.png, rock_small1.png, grass1.png
//   tiles: bush1.png, campfire1.png, chest1.png, fence1_NS.png,
//          flower1-5.png, grass_short2.png, green1.png, desert1-6.png,
//          berrytree_*.png, grass2_under.png, grass2_over.png
//   tiles/autotiles: autotile_path1.png, autotile_shore1-3.png
const TILE_IMAGES: Array<{ key: string; url: string }> = [
  // Ground base tiles (root of repo) ✅
  { key: "tile-ground1",     url: `${PW}/ground1.png`                                  },
  { key: "tile-ground2",     url: `${PW}/ground2.png`                                  },
  // Environment / terrain ✅
  { key: "tile-path",        url: `${PW}/tiles/autotiles/autotile_path1.png`           },
  { key: "tile-shore",       url: `${PW}/tiles/autotiles/autotile_shore1.png`          },
  { key: "tile-green1",      url: `${PW}/tiles/green1.png`                             },
  { key: "tile-desert",      url: `${PW}/tiles/desert1.png`                            },
  // Trees — use PokeWilds berry tree sprites as world trees ✅
  { key: "tile-tree",        url: `${PW}/tiles/berrytree_lum.png`                      },
  { key: "tile-tree-large",  url: `${PW}/tiles/berrytree_aspear.png`                   },
  // Two-tile encounter-grass sprites (under = ground layer, over = canopy) ✅
  { key: "tile-tree-under",  url: `${PW}/tiles/grass2_under.png`                       },
  { key: "tile-tree-over",   url: `${PW}/tiles/grass2_over.png`                        },
  // Objects / resources ✅
  { key: "tile-rock",        url: `${PW}/rock_small1.png`                              },
  { key: "tile-bush",        url: `${PW}/tiles/bush1.png`                              },
  // Structures ✅
  { key: "tile-campfire",    url: `${PW}/tiles/campfire1.png`                          },
  { key: "tile-chest",       url: `${PW}/tiles/chest1.png`                             },
  { key: "tile-fence",       url: `${PW}/tiles/fence1_NS.png`                          },
  // Decoration ✅
  { key: "tile-flower",      url: `${PW}/tiles/flower1.png`                            },
  { key: "tile-flower2",     url: `${PW}/tiles/flower2.png`                            },
  { key: "tile-grass-tall",  url: `${PW}/tiles/grass3_over.png`                        },
  { key: "tile-grass-short", url: `${PW}/tiles/grass_short2.png`                       },
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // Silence 404s — procedural fallbacks cover all missing assets
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      console.info(`[BootScene] asset not found (ok): ${file.key}`);
      this.textures.remove(file.key);
    });

    // Optional Tiled map (local)
    this.load.tilemapTiledJSON("world-map", "assets/maps/world.json");

    // ── Player trainer sprites (from PokeWilds GitHub) ─────────────────────
    for (const { key, url } of PLAYER_TRAINER_FILES) {
      SimpleSprite.load(this, key, url);
    }

    // ── NPC trainer sprites ────────────────────────────────────────────────
    for (const { key, url } of NPC_TRAINER_FILES) {
      SimpleSprite.load(this, key, url);
    }

    // ── Tile images (from PokeWilds GitHub) ────────────────────────────────
    for (const { key, url } of TILE_IMAGES) {
      this.load.image(key, url);
    }

    // ── FX overlays (local, low-priority) ─────────────────────────────────
    for (let i = 1; i <= 4; i++) {
      this.load.image(`shade${i}`, `assets/fx/shade${i}.png`);
    }

    // ── Sounds (local, optional) ───────────────────────────────────────────
    const sounds = ["cut", "dig", "step", "enter", "exit", "save", "score", "gate"];
    for (const s of sounds) {
      this.load.audio(`sfx-${s}`, `assets/sounds/${s}.ogg`);
    }
    this.load.audio("music-overworld", "assets/music/overworld.ogg");
    this.load.audio("music-forest",    "assets/music/forest.ogg");

    // ── Loading progress bar ───────────────────────────────────────────────
    const { width, height } = this.scale;
    const bar = this.add.graphics();
    const bg  = this.add.graphics()
      .fillStyle(0x000000, 0.7)
      .fillRect(width * 0.1 - 4, height * 0.5 - 12, width * 0.8 + 8, 32);

    this.add.text(width * 0.5, height * 0.5 - 28,
      "Loading MedievalLand…",
      { fontSize: "10px", fontFamily: '"Press Start 2P", monospace', color: "#9945ff" }
    ).setOrigin(0.5, 0.5);

    this.load.on("progress", (v: number) => {
      bar.clear();
      bar.fillStyle(0x9945ff, 0.9).fillRect(width * 0.1, height * 0.5 - 8, width * 0.8 * v, 16);
    });
    this.load.on("complete", () => { bar.destroy(); bg.destroy(); });
  }

  create(): void {
    // 1. Generate procedural canvas tileset (fallback base)
    generateMedievalTileset(this);
    // 2. If real PokeWilds ground tiles loaded, use them for the tileset
    rebuildTilesetWithPokeWildsAssets(this);
    // 3. Generate pixel-art fallbacks for any object tiles that still 404'd
    generateFallbackTiles(this);

    this.scene.start("WorldScene");
  }
}
