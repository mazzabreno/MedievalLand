import * as Phaser from "phaser";
import { PLAYER_SPEED, TILE_SIZE, PLAYABLE_ZONE, MAP_COLS, MAP_ROWS, SAFE_ZONES } from "../config/constants";
import { SimpleSprite, Direction } from "../entities/SimpleSprite";
import { OnChainMultiplayer, OnChainPlayer } from "../multiplayer/OnChainMultiplayer";
import { ChatManager, getChannelColor } from "../chat/ChatManager";
import { ChatBubble } from "../chat/ChatBubble";
import { ProfileManager, profileManager } from "../config/profileManager";
import { AchievementEngine } from "../progression/achievementEngine";
import { setupEmojiKeys, showEmoji, type EmojiDef } from "../chat/EmojiSystem";
import { WorldGenerator, type NodePositions } from "../systems/WorldGenerator";
import { CRAFTING_RECIPES } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────────
export type ResourceType = "WOOD" | "STONE" | "FIBER" | "FOOD";
export interface Inventory {
  WOOD: number; STONE: number; FIBER: number; FOOD: number;
  AXE: number; PICKAXE: number; SHOVEL: number; SWORD: number; BOW: number;
}

interface ResourceNode {
  sprite:    Phaser.GameObjects.Image;
  overSprite?: Phaser.GameObjects.Image;  // top half of 2-tile trees
  label:     Phaser.GameObjects.Text;
  resource:  ResourceType;
  amount:    number;   // max yield
  depleted:  boolean;
}

interface PlacedStructure {
  sprite: Phaser.GameObjects.Image;
  type: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const COLLECT_RANGE = TILE_SIZE * 2.5;

/** Base gather time (ms) — slowed to emphasise progression */
const GATHER_TIME: Record<ResourceType, number> = {
  WOOD:  3200,
  STONE: 4000,
  FIBER: 2200,
  FOOD:  1600,
};

const STRUCTURE_SPRITES: Record<string, string> = {
  CAMPFIRE:       "tile-campfire",
  CHEST:          "tile-chest",
  WOODEN_FENCE:   "tile-fence",
  WOODEN_WALL:    "tile-fence",
  WOODEN_DOOR:    "tile-fence",
  CRAFTING_TABLE: "tile-campfire",
};

/** Tool outputs — crafted into inventory, never enter placement mode */
const TOOL_TYPES = new Set(["AXE", "PICKAXE", "SHOVEL", "SWORD", "BOW"]);

const RESOURCE_COLOR: Record<ResourceType, number> = {
  WOOD:  0xa0522d,
  STONE: 0xaaaaaa,
  FIBER: 0x55cc55,
  FOOD:  0xff7755,
};

// ── Scene ─────────────────────────────────────────────────────────────────────
export class WorldScene extends Phaser.Scene {
  // ── Core ─────────────────────────────────────────────────────────────────────
  private avatar!: SimpleSprite;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  private overheadLayers:  Phaser.Tilemaps.TilemapLayer[] = [];
  private currentDirection: Direction = "down";
  private chatInputActive = false;
  private touchDx = 0;
  private touchDy = 0;

  // ── Multiplayer ────────────────────────────────────────────────────────────
  private network!: OnChainMultiplayer;
  private chat!: ChatManager;
  private remotePlayers = new Map<string, SimpleSprite>();
  private nameLabels    = new Map<string, Phaser.GameObjects.Text>();
  private activeBubbles = new Map<string, ChatBubble>();
  private profile!: ProfileManager;

  // ── Resources / building ───────────────────────────────────────────────────
  private inventory: Inventory = {
    WOOD: 0, STONE: 0, FIBER: 0, FOOD: 0,
    AXE: 0, PICKAXE: 0, SHOVEL: 0, SWORD: 0, BOW: 0,
  };
  private resourceNodes: ResourceNode[] = [];
  private placedStructures: PlacedStructure[] = [];
  private buildMode: string | null = null;
  private buildPreview: Phaser.GameObjects.Image | null = null;

  // ── Timed gathering ────────────────────────────────────────────────────────
  private gatherTarget:   ResourceNode | null = null;
  private gatherProgress  = 0;   // 0 → 1
  private gatherDurationMs = 0;
  private gatherArc:  Phaser.GameObjects.Graphics | null = null;
  private gatherText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "WorldScene" });
  }

  // ── create ────────────────────────────────────────────────────────────────
  create(): void {
    const T = TILE_SIZE;

    const hasTiledMap = this.cache.tilemap.exists("world-map");
    const { mapWidth, mapHeight, nodePositions } = hasTiledMap
      ? { ...this.createFromTiledMap(), nodePositions: null }
      : this.createFromGenerator();

    // Spawn resource nodes using biome-aware positions (or random fallback)
    this.spawnResourceNodes(mapWidth, mapHeight, nodePositions ?? undefined);

    // ── Player ────────────────────────────────────────────────────────────
    const sz = SAFE_ZONES[0];
    const spawnX = (sz.col + Math.floor(sz.w / 2)) * T + T / 2;
    const spawnY = (sz.row + Math.floor(sz.h / 2)) * T + T / 2;

    const savedKey  = profileManager?.get().spriteKey ?? "player-brendan";
    const texKey    = this.textures.exists(savedKey) ? savedKey : "player-brendan";
    this.avatar     = new SimpleSprite(this, spawnX, spawnY, texKey);

    const container = this.avatar.getContainer();
    this.physics.world.enable(container);
    this.playerBody = container.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setSize(T * 0.5, T * 0.3);
    this.playerBody.setOffset(-T * 0.25, -T * 0.2);
    this.playerBody.setCollideWorldBounds(true);
    for (const cl of this.collisionLayers) this.physics.add.collider(container, cl);

    this.setupZoneWalls(container, T);
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

    container.add(this.add.text(0, -38, "YOU", {
      fontSize: "10px", fontFamily: "monospace",
      color: "#ffffff", align: "center", resolution: 2,
      stroke: "#0a0a1e", strokeThickness: 2,
    }).setOrigin(0.5, 1));

    // Gather-progress HUD (fixed in screen space → created as Scene graphics)
    this.gatherArc  = this.add.graphics().setDepth(99999);
    this.gatherText = this.add.text(0, 0, "", {
      fontSize: "8px", fontFamily: '"Press Start 2P", monospace',
      color: "#ffffff", stroke: "#000000", strokeThickness: 3, resolution: 2,
    }).setOrigin(0.5, 1).setDepth(100000);

    this.cameras.main.startFollow(container, true, 1.0, 1.0);
    const storedZoom = parseFloat(localStorage.getItem("medieval-land:zoom") ?? "");
    const isTouch    = window.matchMedia("(pointer: coarse)").matches;
    this.cameras.main.setZoom(isNaN(storedZoom) ? (isTouch ? 1.5 : 2) : storedZoom);
    this.cameras.main.setBackgroundColor(0x2a5420);
    this.cameras.main.roundPixels = true;

    // ── Input ─────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // ── Profile / chat / progression ─────────────────────────────────────
    this.profile = profileManager;
    this.registry.set("profileManager", this.profile);
    if (!this.registry.get("achievementEngine")) {
      this.registry.set("achievementEngine", new AchievementEngine(this.profile));
    }
    this.chat = new ChatManager();
    this.chat.addSystemMessage("Welcome — press [E] near a resource to start gathering");
    this.registry.set("chatManager", this.chat);

    this.game.events.on("chat:send", (text: string) => {
      const channel = this.chat.getActiveChannel();
      const color   = getChannelColor(channel);
      this.chat.addMessage(channel, this.network?.sessionId ?? "local",
        this.profile.get().displayName, text, color);
      this.showBubble(this.avatar.getContainer(), text, color);
      if (this.network?.connected) this.network.sendChat(text);
    });
    this.game.events.on("chat:focus", (focused: boolean) => {
      this.chatInputActive = focused;
      if (this.input.keyboard) this.input.keyboard.enabled = !focused;
    });

    setupEmojiKeys(this, () => this.avatar.getContainer(), () => this.chatInputActive, (emoji) => {
      this.chat.addMessage("local", "local", this.profile.get().displayName, emoji.symbol, emoji.color);
    });
    this.game.events.on("emoji:trigger", (emoji: EmojiDef) => {
      showEmoji(this, this.avatar.getContainer(), emoji);
      this.chat.addMessage("local", "local", this.profile.get().displayName, emoji.symbol, emoji.color);
    });

    // ── Keyboard shortcuts ────────────────────────────────────────────────
    this.input.keyboard!.on("keydown-E", () => {
      if (this.chatInputActive || this.buildMode) return;
      if (this.gatherTarget) {
        this.cancelGather();           // press again = cancel
      } else {
        this.tryStartGather();
      }
    });
    this.input.keyboard!.on("keydown-ESC", () => {
      this.cancelGather();
      this.exitBuildMode();
    });
    this.input.keyboard!.on("keydown-G", () => {
      this.physics.world.drawDebug = !this.physics.world.drawDebug;
      if (!this.physics.world.drawDebug) this.physics.world.debugGraphic?.clear();
    });

    // ── Pointer (build placement) ─────────────────────────────────────────
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (!this.buildMode || !this.buildPreview) return;
      const tx = Math.floor(ptr.worldX / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      const ty = Math.floor(ptr.worldY / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      this.buildPreview.setPosition(tx, ty);
    });
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (!this.buildMode || ptr.rightButtonDown()) { this.exitBuildMode(); return; }
      this.tryPlaceStructure(ptr.worldX, ptr.worldY);
    });

    // ── Game events from React ────────────────────────────────────────────
    this.game.events.on("camera:zoom", (zoom: number) => this.cameras.main.setZoom(zoom));
    this.game.events.on("touch:joystick", ({ dx, dy }: { dx: number; dy: number }) => {
      this.touchDx = dx; this.touchDy = dy;
    });
    this.game.events.on("touch:stop",     () => { this.touchDx = 0; this.touchDy = 0; });
    this.game.events.on("touch:interact", () => {
      if (!this.chatInputActive && !this.buildMode) {
        if (this.gatherTarget) this.cancelGather(); else this.tryStartGather();
      }
    });
    this.game.events.on("build:select", (recipe: string) => this.enterBuildMode(recipe));

    // ── On-chain ─────────────────────────────────────────────────────────
    this.network = new OnChainMultiplayer();
    this.registry.set("network", this.network);
    (globalThis as any).__medievalLandGameEvents = this.game.events;
    this.profile.onChange((p) => this.network?.updateScore(p.score));

    this.game.events.on("wallet:connected", async (addr: string) => {
      try {
        const { PublicKey } = await import("@solana/web3.js");
        this.profile.setWallet(addr);
        await this.network.connect(new PublicKey(addr), this.profile.get().displayName);
        this.chat.addSystemMessage("On-chain session started.");
        this.setupNetworkCallbacks();
      } catch (err: any) {
        console.error("[WorldScene] session error:", err);
        this.chat.addSystemMessage("Session offline (local mode)");
      }
    });
    this.game.events.on("wallet:disconnected", () => {
      this.network.disconnect();
      this.chat.addSystemMessage("Session ended");
    });
    this.game.events.on("game:harvest", () => this.network?.recordAction("harvest"));
    this.game.events.on("game:build",   () => this.network?.recordAction("build"));

    this.emitInventory();
  }

  // ── update ────────────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (this.chatInputActive) {
      this.playerBody.setVelocity(0);
      this.avatar.idle();
      return;
    }

    this.playerBody.setVelocity(0);

    const kbUp    = this.cursors.up.isDown    || this.wasd.up.isDown;
    const kbDown  = this.cursors.down.isDown  || this.wasd.down.isDown;
    const kbLeft  = this.cursors.left.isDown  || this.wasd.left.isDown;
    const kbRight = this.cursors.right.isDown || this.wasd.right.isDown;

    let direction: Direction | null = null;
    let vx = 0, vy = 0;

    if (kbLeft)       { vx = -PLAYER_SPEED; direction = "left"; }
    else if (kbRight) { vx =  PLAYER_SPEED; direction = "right"; }
    if (kbUp)         { vy = -PLAYER_SPEED; direction = direction ?? "up"; }
    else if (kbDown)  { vy =  PLAYER_SPEED; direction = direction ?? "down"; }
    if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071; }

    const touchActive = Math.abs(this.touchDx) > 0.1 || Math.abs(this.touchDy) > 0.1;
    if (touchActive) {
      vx = this.touchDx * PLAYER_SPEED;
      vy = this.touchDy * PLAYER_SPEED;
      direction = Math.abs(this.touchDx) >= Math.abs(this.touchDy)
        ? (this.touchDx < 0 ? "left" : "right")
        : (this.touchDy < 0 ? "up" : "down");
    }

    this.playerBody.setVelocity(vx, vy);
    if (direction) { this.avatar.walk(direction); this.currentDirection = direction; }
    else             this.avatar.idle();

    this.avatar.updateDepth();

    // Overhead fade
    const px = this.avatar.x, py = this.avatar.y;
    for (const layer of this.overheadLayers) {
      const target = layer.depth > py && layer.getTileAtWorldXY(px, py) !== null ? 0.25 : 1.0;
      if (Math.abs(layer.alpha - target) > 0.004)
        layer.alpha = Phaser.Math.Linear(layer.alpha, target, 0.12);
    }

    // Update gathering progress
    if (this.gatherTarget) this.tickGather(delta);

    // Update node proximity highlights
    this.updateNodeHighlights();

    // Multiplayer
    if (this.network.connected)
      this.network.sendInput(this.avatar.x, this.avatar.y, this.currentDirection, direction !== null);
    this.remotePlayers.forEach((r) => r.updateDepth());
  }

  // ── Timed gathering ───────────────────────────────────────────────────────

  /** Determine gather duration (ms) with tool bonus */
  private gatherDuration(resource: ResourceType): number {
    const base = GATHER_TIME[resource] ?? 3000;
    if (resource === "WOOD"  && this.inventory.AXE     > 0) return base * 0.5;
    if (resource === "STONE" && this.inventory.PICKAXE > 0) return base * 0.5;
    if (resource === "FIBER" && this.inventory.SHOVEL  > 0) return base * 0.5;
    return base;
  }

  private tryStartGather(): void {
    const px = this.avatar.x, py = this.avatar.y;
    let nearest: ResourceNode | null = null;
    let nearestDist = COLLECT_RANGE;
    for (const node of this.resourceNodes) {
      if (node.depleted) continue;
      const d = Phaser.Math.Distance.Between(px, py, node.sprite.x, node.sprite.y);
      if (d < nearestDist) { nearestDist = d; nearest = node; }
    }
    if (!nearest) return;

    this.gatherTarget    = nearest;
    this.gatherProgress  = 0;
    this.gatherDurationMs = this.gatherDuration(nearest.resource);

    this.chat.addSystemMessage(`Gathering ${nearest.resource}…`);
  }

  private tickGather(delta: number): void {
    if (!this.gatherTarget) return;

    // Cancel if player walked away
    const d = Phaser.Math.Distance.Between(
      this.avatar.x, this.avatar.y,
      this.gatherTarget.sprite.x, this.gatherTarget.sprite.y,
    );
    if (d > COLLECT_RANGE) { this.cancelGather(); return; }

    this.gatherProgress += delta / this.gatherDurationMs;

    if (this.gatherProgress >= 1) {
      this.finishGather();
    } else {
      this.drawGatherArc();
    }
  }

  private drawGatherArc(): void {
    if (!this.gatherArc || !this.gatherTarget) return;
    const { x, y } = this.gatherTarget.sprite;
    const R   = 14;
    const col = RESOURCE_COLOR[this.gatherTarget.resource];

    this.gatherArc.clear();
    // Background ring
    this.gatherArc.lineStyle(4, 0x000000, 0.55).strokeCircle(x, y - 22, R);
    // Progress arc
    this.gatherArc.lineStyle(4, col, 1);
    this.gatherArc.beginPath();
    this.gatherArc.arc(
      x, y - 22, R,
      -Math.PI / 2,
      -Math.PI / 2 + this.gatherProgress * Math.PI * 2,
      false,
    );
    this.gatherArc.strokePath();

    // Seconds-remaining label
    const secsLeft = ((1 - this.gatherProgress) * this.gatherDurationMs / 1000).toFixed(1);
    if (this.gatherText) {
      this.gatherText.setText(secsLeft + "s");
      this.gatherText.setPosition(x, y - 38);
    }
  }

  private finishGather(): void {
    const node = this.gatherTarget!;
    this.cancelGather();

    const gained = Phaser.Math.Between(1, node.amount);
    this.inventory[node.resource] = (this.inventory[node.resource] ?? 0) + gained;

    // Floating popup
    const popup = this.add.text(node.sprite.x, node.sprite.y - 20,
      `+${gained} ${node.resource}`, {
        fontSize: "11px", fontFamily: '"Press Start 2P", monospace',
        color: `#${RESOURCE_COLOR[node.resource].toString(16).padStart(6, "0")}`,
        stroke: "#000000", strokeThickness: 3, resolution: 2,
      }).setOrigin(0.5, 1).setDepth(99999);
    this.tweens.add({ targets: popup, y: popup.y - 32, alpha: 0, duration: 1100,
      onComplete: () => popup.destroy() });

    // Deplete & animate out
    node.depleted = true;
    node.label.destroy();
    const stumpTargets: Phaser.GameObjects.Image[] = [node.sprite];
    if (node.overSprite) stumpTargets.push(node.overSprite);
    this.tweens.add({
      targets: stumpTargets,
      alpha: 0, scaleX: 0.1, scaleY: 0.1,
      duration: 400,
      onComplete: () => { node.sprite.destroy(); node.overSprite?.destroy(); },
    });

    // Remove from list after 30s
    this.time.delayedCall(30_000, () => {
      const idx = this.resourceNodes.indexOf(node);
      if (idx !== -1) this.resourceNodes.splice(idx, 1);
    });

    this.emitInventory();
    this.profile.recordHarvest(node.resource, gained);
    this.game.events.emit("game:harvest");

    if (this.cache.audio.exists("sfx-cut")  && node.resource === "WOOD")
      this.sound.play("sfx-cut",  { volume: 0.5 });
    else if (this.cache.audio.exists("sfx-dig") && node.resource === "STONE")
      this.sound.play("sfx-dig",  { volume: 0.5 });
  }

  private cancelGather(): void {
    this.gatherTarget   = null;
    this.gatherProgress = 0;
    this.gatherArc?.clear();
    this.gatherText?.setText("");
  }

  // ── Node proximity highlights ─────────────────────────────────────────────
  private updateNodeHighlights(): void {
    const px = this.avatar.x, py = this.avatar.y;
    for (const node of this.resourceNodes) {
      if (node.depleted) continue;
      const d = Phaser.Math.Distance.Between(px, py, node.sprite.x, node.sprite.y);
      const inRange = d < COLLECT_RANGE;
      node.label.setVisible(inRange);
      // Highlight active gather target
      const tint = node === this.gatherTarget ? 0xffffaa : (inRange ? 0xffffff : 0xdddddd);
      node.sprite.setTint(tint);
      node.overSprite?.setTint(tint);
    }
  }

  // ── Build mode / crafting ─────────────────────────────────────────────────
  private enterBuildMode(recipeOutput: string): void {
    const recipe = CRAFTING_RECIPES.find(r => r.output === recipeOutput);
    if (!recipe) return;

    // Check ingredients for both tools and structures
    for (const ing of recipe.ingredients) {
      if ((this.inventory[ing.resource as ResourceType] ?? 0) < ing.amount) {
        this.chat.addSystemMessage(`Not enough ${ing.resource} (need ${ing.amount})`);
        return;
      }
    }

    // ── Tools: craft immediately into inventory ──────────────────────────────
    if (TOOL_TYPES.has(recipeOutput)) {
      for (const ing of recipe.ingredients)
        this.inventory[ing.resource as ResourceType] -= ing.amount;
      this.inventory[recipeOutput as "AXE" | "PICKAXE" | "SHOVEL" | "SWORD" | "BOW"]++;

      // Floating popup at player position
      const popup = this.add.text(this.avatar.x, this.avatar.y - 24,
        `✔ Crafted ${recipeOutput}!`, {
          fontSize: "9px", fontFamily: '"Press Start 2P", monospace',
          color: "#ffd700", stroke: "#000000", strokeThickness: 3, resolution: 2,
        }).setOrigin(0.5, 1).setDepth(99999);
      this.tweens.add({ targets: popup, y: popup.y - 36, alpha: 0, duration: 1400,
        onComplete: () => popup.destroy() });

      this.chat.addSystemMessage(`Crafted ${recipeOutput}!`);
      this.emitInventory();
      return;
    }

    // ── Structures: enter placement mode ────────────────────────────────────
    this.exitBuildMode();
    this.buildMode = recipeOutput;
    const spriteKey = STRUCTURE_SPRITES[recipeOutput] ?? "tile-campfire";
    if (this.textures.exists(spriteKey)) {
      this.buildPreview = this.add.image(0, 0, spriteKey)
        .setAlpha(0.6).setDepth(99998).setScale(1.8);
    }
    this.chat.addSystemMessage(`Build: ${recipeOutput} — Click to place · Esc to cancel`);
    this.game.events.emit("build:mode", { active: true, recipe: recipeOutput });
  }

  private exitBuildMode(): void {
    if (this.buildPreview) { this.buildPreview.destroy(); this.buildPreview = null; }
    if (this.buildMode)    { this.buildMode = null; this.game.events.emit("build:mode", { active: false }); }
  }

  private tryPlaceStructure(wx: number, wy: number): void {
    if (!this.buildMode) return;
    const recipe = CRAFTING_RECIPES.find(r => r.output === this.buildMode);
    if (!recipe) return;
    for (const ing of recipe.ingredients) {
      if ((this.inventory[ing.resource as ResourceType] ?? 0) < ing.amount) {
        this.chat.addSystemMessage(`Not enough ${ing.resource}`); return;
      }
    }
    for (const ing of recipe.ingredients)
      this.inventory[ing.resource as ResourceType] -= ing.amount;

    const tx = Math.floor(wx / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    const ty = Math.floor(wy / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    const key = STRUCTURE_SPRITES[this.buildMode] ?? "tile-campfire";
    if (this.textures.exists(key)) {
      const s = this.add.image(tx, ty, key).setScale(1.8).setDepth(ty);
      this.placedStructures.push({ sprite: s, type: this.buildMode });
    }
    this.emitInventory();
    this.profile.recordBuild(this.buildMode);
    this.game.events.emit("game:build");
    if (this.cache.audio.exists("sfx-gate")) this.sound.play("sfx-gate", { volume: 0.5 });

    const stillHas = recipe.ingredients.every(
      ing => (this.inventory[ing.resource as ResourceType] ?? 0) >= ing.amount
    );
    if (!stillHas) this.exitBuildMode();
  }

  // ── Spawn resource nodes ──────────────────────────────────────────────────
  private spawnResourceNodes(
    mapWidth: number,
    mapHeight: number,
    positions?: NodePositions,
  ): void {
    const T   = TILE_SIZE;
    const rng = Phaser.Math.RND;

    if (positions) {
      // Biome-aware placement from WorldGenerator
      this.placeNodes(positions.trees,   "tile-tree",       "WOOD",  [2, 4], 1.0);
      this.placeNodes(positions.larges,  "tile-tree-large", "WOOD",  [3, 6], 1.0);
      this.placeNodes(positions.rocks,   "tile-rock",       "STONE", [2, 4], 1.6);
      this.placeNodes(positions.bushes,  "tile-bush",       "FIBER", [1, 3], 1.4);

      // tall grass disabled — tile-grass-tall renders as solid block

      // Decorative flowers (no collection)
      for (const p of positions.flowers) {
        const key = rng.frac() < 0.5 ? "tile-flower" : "tile-flower2";
        if (this.textures.exists(key))
          this.add.image(p.x, p.y, key).setScale(1.0).setDepth(p.y);
      }
      // Torches at safe-zone corners
      for (const p of positions.torches) {
        if (this.textures.exists("tile-torch"))
          this.add.image(p.x, p.y, "tile-torch").setScale(1.2).setDepth(p.y);
      }
      return;
    }

    // ── Fallback: fully random scatter ──────────────────────────────────────
    const margin = T * 4;
    const safeRect = SAFE_ZONES[0];
    const avoidSafe = (x: number, y: number) => {
      const sx = safeRect.col * T - T, sy = safeRect.row * T - T;
      const sw = (safeRect.w + 2) * T,  sh = (safeRect.h + 2) * T;
      return x > sx && x < sx + sw && y > sy && y < sy + sh;
    };

    const spread = (key: string, res: ResourceType, amt: [number,number], scale: number, count: number) => {
      if (!this.textures.exists(key)) return;
      for (let i = 0; i < count; i++) {
        let x = 0, y = 0, tries = 0;
        do {
          x = rng.between(margin, mapWidth  - margin);
          y = rng.between(margin, mapHeight - margin);
          tries++;
        } while (tries < 20 && avoidSafe(x, y));

        const sprite = this.add.image(x, y, key).setScale(scale).setTint(0xbbbbbb).setDepth(y);
        const label  = this.add.text(x, y - scale * 10, `[E] ${res}`, {
          fontSize: "7px", fontFamily: "monospace",
          color: "#ffffff", stroke: "#000000", strokeThickness: 2, resolution: 2,
        }).setOrigin(0.5, 1).setDepth(y + 1).setVisible(false);
        this.resourceNodes.push({ sprite, label, resource: res,
          amount: rng.between(amt[0], amt[1]), depleted: false });
      }
    };

    spread("tile-tree",       "WOOD",  [2,4], 1.0, 100);
    spread("tile-tree-large", "WOOD",  [3,6], 1.0,  30);
    spread("tile-rock",       "STONE", [2,4], 1.6,  60);
    spread("tile-bush",       "FIBER", [1,3], 1.4,  50);

    const decorKeys: [string, number][] = [
      ["tile-flower",  100], ["tile-flower2", 80], ["tile-grass-short", 120],
    ];
    for (const [key, count] of decorKeys) {
      if (!this.textures.exists(key)) continue;
      for (let i = 0; i < count; i++) {
        const x = rng.between(margin, mapWidth  - margin);
        const y = rng.between(margin, mapHeight - margin);
        this.add.image(x, y, key).setScale(1.0).setDepth(y);
      }
    }
  }

  /** Place resource-node sprites from a pre-computed position list.
   *  For WOOD nodes, uses two-tile trees (under + over) when PokeWilds assets exist.
   */
  private placeNodes(
    positions: Array<{x: number; y: number}>,
    textureKey: string,
    resource: ResourceType,
    amountRange: [number, number],
    scale: number,
  ): void {
    const rng = Phaser.Math.RND;
    const T   = TILE_SIZE;

    // Two-tile tree rendering: under=trunk/base, over=canopy (one tile above)
    const useTwoTile = resource === "WOOD"
      && this.textures.exists("tile-tree-under")
      && this.textures.exists("tile-tree-over");

    if (!useTwoTile && !this.textures.exists(textureKey)) return;

    for (const { x, y } of positions) {
      let sprite: Phaser.GameObjects.Image;
      let overSprite: Phaser.GameObjects.Image | undefined;

      if (useTwoTile) {
        // Under part: at foot position, depth sorts with player
        sprite = this.add.image(x, y, "tile-tree-under")
          .setScale(scale).setDepth(y);
        // Over part: one tile above, same Y-sort depth as its world-Y
        const overY = y - T * scale;
        overSprite = this.add.image(x, overY, "tile-tree-over")
          .setScale(scale).setDepth(overY);
      } else {
        sprite = this.add.image(x, y, textureKey)
          .setScale(scale).setTint(0xdddddd).setDepth(y);
      }

      const labelY = useTwoTile ? y - T * scale * 1.8 : y - scale * 10;
      const label = this.add.text(x, labelY, `[E] ${resource}`, {
        fontSize: "7px", fontFamily: "monospace",
        color: "#ffffff", stroke: "#000000", strokeThickness: 2, resolution: 2,
      }).setOrigin(0.5, 1).setDepth(y + 1).setVisible(false);

      const amount = rng.between(amountRange[0], amountRange[1]);
      this.resourceNodes.push({ sprite, overSprite, label, resource, amount, depleted: false });
    }
  }

  /** Scatter decorative tall-grass sprites from a position list */
  private placeTallGrass(positions: Array<{x: number; y: number}>, scale = 1.0): void {
    if (!this.textures.exists("tile-grass-tall")) return;
    const rng = Phaser.Math.RND;
    for (const { x, y } of positions) {
      if (rng.frac() > 0.35) continue; // only 35% of eligible tiles get tall grass
      this.add.image(x, y, "tile-grass-tall")
        .setScale(scale).setDepth(y + 0.5).setAlpha(0.85);
    }
  }

  // ── Inventory broadcast ───────────────────────────────────────────────────
  private emitInventory(): void {
    window.dispatchEvent(new CustomEvent("medieval-land:inventory", {
      detail: {
        WOOD:    this.inventory.WOOD,
        STONE:   this.inventory.STONE,
        FIBER:   this.inventory.FIBER,
        FOOD:    this.inventory.FOOD,
        AXE:     this.inventory.AXE,
        PICKAXE: this.inventory.PICKAXE,
        SHOVEL:  this.inventory.SHOVEL,
        SWORD:   this.inventory.SWORD,
        BOW:     this.inventory.BOW,
      },
    }));
    const available = CRAFTING_RECIPES.filter(r =>
      r.ingredients.every(ing => (this.inventory[ing.resource as keyof Inventory] ?? 0) >= ing.amount)
    ).map(r => r.output);
    window.dispatchEvent(new CustomEvent("medieval-land:craftable", { detail: available }));
  }

  // ── Zone walls ────────────────────────────────────────────────────────────
  private setupZoneWalls(container: Phaser.GameObjects.Container, T: number): void {
    const PZ = PLAYABLE_ZONE;
    const x1 = PZ.col1 * T, y1 = PZ.row1 * T;
    const W  = (PZ.col2 - PZ.col1) * T, H = (PZ.row2 - PZ.row1) * T;
    const wt = 3 * T;
    const walls = this.physics.add.staticGroup();
    const add = (wx: number, wy: number, w: number, h: number) => {
      const r = this.add.rectangle(wx, wy, w, h).setVisible(false);
      this.physics.add.existing(r, true);
      walls.add(r);
    };
    add(x1 + W / 2,     y1 - wt / 2,      W,          wt);
    add(x1 + W / 2,     y1 + H + wt / 2,  W,          wt);
    add(x1 - wt / 2,    y1 + H / 2,       wt, H + wt * 2);
    add(x1 + W + wt / 2, y1 + H / 2,      wt, H + wt * 2);
    this.physics.add.collider(container, walls);
  }

  private showBubble(target: Phaser.GameObjects.Container, text: string, color: string): void {
    new ChatBubble(this, target, text, color);
  }

  // ── Map creation ──────────────────────────────────────────────────────────
  private createFromTiledMap(): { mapWidth: number; mapHeight: number; nodePositions: null } {
    const TILESET_KEYS = ["MLGrass", "MLTerrain", "MLTrees", "MLBuildings", "MLObjects"];
    const map = this.make.tilemap({ key: "world-map" });
    const allTilesets = TILESET_KEYS
      .map(n => map.addTilesetImage(n, n))
      .filter((ts): ts is Phaser.Tilemaps.Tileset => ts !== null);
    for (let i = 0; i < map.layers.length; i++) {
      const layer = map.createLayer(i, allTilesets);
      if (!layer) continue;
      layer.setCollisionFromCollisionGroup();
      if (layer.filterTiles((t: Phaser.Tilemaps.Tile) => t.collides).length > 0)
        this.collisionLayers.push(layer);
      layer.setDepth(i);
    }
    return { mapWidth: map.widthInPixels, mapHeight: map.heightInPixels, nodePositions: null };
  }

  private createFromGenerator(): { mapWidth: number; mapHeight: number; nodePositions: NodePositions } {
    const generator = new WorldGenerator(this, MAP_COLS, MAP_ROWS);
    const { groundLayer, decorLayer, nodePositions } = generator.generate("GREEN_FIELD");
    groundLayer.setDepth(0);
    decorLayer.setDepth(1);
    return { mapWidth: MAP_COLS * TILE_SIZE, mapHeight: MAP_ROWS * TILE_SIZE, nodePositions };
  }

  // ── Multiplayer ───────────────────────────────────────────────────────────
  private setupNetworkCallbacks(): void {
    this.network.onPlayerAdd((wallet, player) => {
      if (wallet !== this.network.sessionId) this.addRemotePlayer(wallet, player);
    });
    this.network.onPlayerRemove((wallet) => this.removeRemotePlayer(wallet));
    this.network.onPlayerChange((wallet, player) => {
      if (wallet !== this.network.sessionId) this.updateRemotePlayer(wallet, player);
    });
  }

  private addRemotePlayer(wallet: string, player: OnChainPlayer): void {
    const keys = ["player-may","player-gold","player-hilbert","player-calem","player-hilda","player-leaf"];
    const k    = keys[(wallet.charCodeAt(0) + wallet.charCodeAt(1)) % keys.length];
    const tex  = this.textures.exists(k) ? k : "player-brendan";
    const avatar = new SimpleSprite(this, player.x, player.y, tex);
    this.remotePlayers.set(wallet, avatar);
    const name = player.displayName ?? `${wallet.slice(0,4)}…${wallet.slice(-4)}`;
    const label = this.add.text(0, -38, name, {
      fontSize: "9px", fontFamily: "monospace", color: "#aaaacc",
      align: "center", resolution: 2, stroke: "#0a0a1e", strokeThickness: 2,
    }).setOrigin(0.5, 1);
    avatar.getContainer().add(label);
    this.nameLabels.set(wallet, label);
    this.chat.addSystemMessage(`${name} entered the realm`);
  }

  private removeRemotePlayer(wallet: string): void {
    this.remotePlayers.get(wallet)?.destroy();
    this.remotePlayers.delete(wallet);
    this.nameLabels.get(wallet)?.destroy();
    this.nameLabels.delete(wallet);
    this.activeBubbles.get(wallet)?.destroy();
    this.activeBubbles.delete(wallet);
    this.chat.addSystemMessage("An adventurer left the realm");
  }

  private updateRemotePlayer(wallet: string, player: OnChainPlayer): void {
    const avatar = this.remotePlayers.get(wallet);
    if (!avatar) return;
    this.tweens.add({ targets: avatar.getContainer(), x: player.x, y: player.y, duration: 100, ease: "Linear" });
    const dirs: Direction[] = ["down","left","right","up"];
    if (player.isWalking && dirs[player.direction]) avatar.walk(dirs[player.direction]);
    else avatar.idle();
  }
}
