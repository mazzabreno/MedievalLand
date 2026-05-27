import * as Phaser from "phaser";
import { PLAYER_SPEED, TILE_SIZE, PLAYABLE_ZONE, MAP_COLS, MAP_ROWS, SAFE_ZONES } from "../config/constants";
import { SimpleSprite, Direction } from "../entities/SimpleSprite";
import { OnChainMultiplayer, OnChainPlayer } from "../multiplayer/OnChainMultiplayer";
import { ChatManager, getChannelColor } from "../chat/ChatManager";
import { ChatBubble } from "../chat/ChatBubble";
import { ProfileManager, profileManager } from "../config/profileManager";
import { AchievementEngine } from "../progression/achievementEngine";
import { setupEmojiKeys, showEmoji, type EmojiDef } from "../chat/EmojiSystem";
import { generateMedievalTileset } from "../utils/tilesetGenerator";
import { WorldGenerator } from "../systems/WorldGenerator";
import { CRAFTING_RECIPES } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────────
export type ResourceType = "WOOD" | "STONE" | "FIBER" | "FOOD";
export interface Inventory { WOOD: number; STONE: number; FIBER: number; FOOD: number }

interface ResourceNode {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  resource: ResourceType;
  amount: number;
  depleted: boolean;
}

interface PlacedStructure {
  sprite: Phaser.GameObjects.Image;
  type: string;
}

// Node config
const NODE_TYPES: Array<{
  tileKey: string;
  resource: ResourceType;
  amount: [number, number]; // [min, max]
  scale: number;
  count: number;
}> = [
  { tileKey: "tile-tree",       resource: "WOOD",  amount: [2, 4], scale: 1.8, count: 120 },
  { tileKey: "tile-tree-large", resource: "WOOD",  amount: [3, 6], scale: 2.0, count: 40  },
  { tileKey: "tile-rock",       resource: "STONE", amount: [2, 4], scale: 1.6, count: 80  },
  { tileKey: "tile-bush",       resource: "FIBER", amount: [1, 3], scale: 1.4, count: 60  },
];

const COLLECT_RANGE = TILE_SIZE * 2.5;
const STRUCTURE_SPRITES: Record<string, string> = {
  CAMPFIRE:        "tile-campfire",
  CHEST:           "tile-chest",
  WOODEN_FENCE:    "tile-fence",
  WOODEN_WALL:     "tile-fence",
  WOODEN_DOOR:     "tile-fence",
  CRAFTING_TABLE:  "tile-campfire",
};

export class WorldScene extends Phaser.Scene {
  // ── Core ────────────────────────────────────────────────────────────────────
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

  // ── Multiplayer ─────────────────────────────────────────────────────────────
  private network!: OnChainMultiplayer;
  private chat!: ChatManager;
  private remotePlayers = new Map<string, SimpleSprite>();
  private nameLabels    = new Map<string, Phaser.GameObjects.Text>();
  private activeBubbles = new Map<string, ChatBubble>();
  private profile!: ProfileManager;

  // ── Gameplay ─────────────────────────────────────────────────────────────────
  private inventory: Inventory = { WOOD: 0, STONE: 0, FIBER: 0, FOOD: 0 };
  private resourceNodes: ResourceNode[] = [];
  private placedStructures: PlacedStructure[] = [];
  private buildMode: string | null = null;
  private buildPreview: Phaser.GameObjects.Image | null = null;
  private collectCooldown = 0;

  constructor() {
    super({ key: "WorldScene" });
  }

  // ── create ────────────────────────────────────────────────────────────────────
  create(): void {
    const T = TILE_SIZE;

    // Map
    const hasTiledMap = this.cache.tilemap.exists("world-map");
    const { mapWidth, mapHeight } = hasTiledMap
      ? this.createFromTiledMap()
      : this.createFromGenerator();

    // Resource nodes scattered across map
    this.spawnResourceNodes(mapWidth, mapHeight);

    // ── Player ───────────────────────────────────────────────────────────────
    const sz = SAFE_ZONES[0];
    const spawnX = (sz.col + Math.floor(sz.w / 2)) * T + T / 2;
    const spawnY = (sz.row + Math.floor(sz.h / 2)) * T + T / 2;

    const savedKey = profileManager?.get().spriteKey ?? "player-brendan";
    const textureKey = this.textures.exists(savedKey) ? savedKey : "player-brendan";
    this.avatar = new SimpleSprite(this, spawnX, spawnY, textureKey);

    const container = this.avatar.getContainer();
    this.physics.world.enable(container);
    this.playerBody = container.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setSize(T * 0.5, T * 0.3);
    this.playerBody.setOffset(-T * 0.25, -T * 0.2);
    this.playerBody.setCollideWorldBounds(true);
    for (const cl of this.collisionLayers) this.physics.add.collider(container, cl);

    // Zone walls
    this.setupZoneWalls(container, T);

    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

    // "YOU" label
    container.add(this.add.text(0, -38, "YOU", {
      fontSize: "10px", fontFamily: "monospace",
      color: "#ffffff", align: "center", resolution: 2,
      stroke: "#0a0a1e", strokeThickness: 2,
    }).setOrigin(0.5, 1));

    // Camera
    this.cameras.main.startFollow(container, true, 1.0, 1.0);
    const storedZoom = parseFloat(localStorage.getItem("medieval-land:zoom") ?? "");
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    this.cameras.main.setZoom(isNaN(storedZoom) ? (isTouch ? 1.5 : 2) : storedZoom);
    this.cameras.main.setBackgroundColor(0x2c5222); // match normal-grass colour
    this.cameras.main.roundPixels = true;

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Profile
    this.profile = profileManager;
    this.registry.set("profileManager", this.profile);
    if (!this.registry.get("achievementEngine")) {
      this.registry.set("achievementEngine", new AchievementEngine(this.profile));
    }

    // Chat
    this.chat = new ChatManager();
    this.chat.addSystemMessage("Welcome to MedievalLand — Press E to collect resources");
    this.registry.set("chatManager", this.chat);

    this.game.events.on("chat:send", (text: string) => {
      const channel = this.chat.getActiveChannel();
      const color = getChannelColor(channel);
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

    // ── Keyboard shortcuts ───────────────────────────────────────────────────
    // E — collect resource
    this.input.keyboard!.on("keydown-E", () => {
      if (this.chatInputActive) return;
      this.tryCollect();
    });

    // Escape — cancel build mode
    this.input.keyboard!.on("keydown-ESC", () => {
      this.exitBuildMode();
    });

    // G — debug
    this.input.keyboard!.on("keydown-G", () => {
      this.physics.world.drawDebug = !this.physics.world.drawDebug;
      if (!this.physics.world.drawDebug) this.physics.world.debugGraphic?.clear();
    });

    // ── Mouse / touch for build placement ───────────────────────────────────
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (!this.buildMode || !this.buildPreview) return;
      const wx = ptr.worldX;
      const wy = ptr.worldY;
      // Snap to tile grid
      const tx = Math.floor(wx / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      const ty = Math.floor(wy / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      this.buildPreview.setPosition(tx, ty);
    });

    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (!this.buildMode || ptr.rightButtonDown()) {
        this.exitBuildMode();
        return;
      }
      this.tryPlaceStructure(ptr.worldX, ptr.worldY);
    });

    // ── Game events from React ───────────────────────────────────────────────
    this.game.events.on("camera:zoom", (zoom: number) => {
      this.cameras.main.setZoom(zoom);
    });

    this.game.events.on("touch:joystick", ({ dx, dy }: { dx: number; dy: number }) => {
      this.touchDx = dx; this.touchDy = dy;
    });
    this.game.events.on("touch:stop", () => {
      this.touchDx = 0; this.touchDy = 0;
    });
    this.game.events.on("touch:interact", () => {
      if (!this.chatInputActive) this.tryCollect();
    });

    // Build mode selection from toolbar
    this.game.events.on("build:select", (recipeOutput: string) => {
      this.enterBuildMode(recipeOutput);
    });

    // On-chain
    this.network = new OnChainMultiplayer();
    this.registry.set("network", this.network);
    (globalThis as any).__medievalLandGameEvents = this.game.events;

    this.profile.onChange((p) => this.network?.updateScore(p.score));

    this.game.events.on("wallet:connected", async (walletAddress: string) => {
      try {
        const { PublicKey } = await import("@solana/web3.js");
        this.profile.setWallet(walletAddress);
        await this.network.connect(new PublicKey(walletAddress), this.profile.get().displayName);
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

    // Broadcast initial inventory
    this.emitInventory();
  }

  // ── update ────────────────────────────────────────────────────────────────────
  update(time: number, delta: number): void {
    if (this.collectCooldown > 0) this.collectCooldown -= delta;

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

    if (direction) {
      this.avatar.walk(direction);
      this.currentDirection = direction;
    } else {
      this.avatar.idle();
    }

    this.avatar.updateDepth();

    // Overhead layer fade
    const px = this.avatar.x, py = this.avatar.y;
    for (const layer of this.overheadLayers) {
      const target = layer.depth > py && layer.getTileAtWorldXY(px, py) !== null ? 0.25 : 1.0;
      if (Math.abs(layer.alpha - target) > 0.004) {
        layer.alpha = Phaser.Math.Linear(layer.alpha, target, 0.12);
      }
    }

    // Highlight nearest collectible node
    this.updateNodeHighlights();

    if (this.network.connected) {
      this.network.sendInput(this.avatar.x, this.avatar.y, this.currentDirection, direction !== null);
    }
    this.remotePlayers.forEach((r) => r.updateDepth());
  }

  // ── Resource collection ───────────────────────────────────────────────────────
  private tryCollect(): void {
    if (this.collectCooldown > 0) return;

    const px = this.avatar.x, py = this.avatar.y;
    let nearest: ResourceNode | null = null;
    let nearestDist = COLLECT_RANGE;

    for (const node of this.resourceNodes) {
      if (node.depleted) continue;
      const d = Phaser.Math.Distance.Between(px, py, node.sprite.x, node.sprite.y);
      if (d < nearestDist) { nearestDist = d; nearest = node; }
    }

    if (!nearest) return;

    // Collect 1–amount resources from this node
    const gained = Phaser.Math.Between(1, nearest.amount);
    this.inventory[nearest.resource] = (this.inventory[nearest.resource] ?? 0) + gained;

    // Visual feedback
    const popup = this.add.text(nearest.sprite.x, nearest.sprite.y - 20,
      `+${gained} ${nearest.resource}`, {
        fontSize: "11px", fontFamily: '"Press Start 2P", monospace',
        color: nearest.resource === "WOOD" ? "#a0522d" : nearest.resource === "STONE" ? "#aaaaaa" : "#55cc55",
        stroke: "#000000", strokeThickness: 3, resolution: 2,
      }).setOrigin(0.5, 1).setDepth(99999);
    this.tweens.add({
      targets: popup, y: popup.y - 30, alpha: 0, duration: 1000,
      onComplete: () => popup.destroy(),
    });

    // Deplete node
    nearest.depleted = true;
    nearest.label.destroy();
    this.tweens.add({
      targets: nearest.sprite, alpha: 0, scaleX: 0.1, scaleY: 0.1,
      duration: 400, onComplete: () => nearest!.sprite.destroy(),
    });

    // Respawn after 30s
    const { x, y, resource, amount } = { x: nearest.sprite.x, y: nearest.sprite.y,
      resource: nearest.resource, amount: nearest.amount };
    this.time.delayedCall(30000, () => {
      const idx = this.resourceNodes.indexOf(nearest!);
      if (idx !== -1) this.resourceNodes.splice(idx, 1);
    });

    this.collectCooldown = 400;
    this.emitInventory();
    this.profile.recordHarvest(nearest.resource, gained);
    this.game.events.emit("game:harvest");

    // Try auto-play sound
    if (this.cache.audio.exists("sfx-cut") && nearest.resource === "WOOD") {
      this.sound.play("sfx-cut", { volume: 0.5 });
    } else if (this.cache.audio.exists("sfx-dig") && nearest.resource === "STONE") {
      this.sound.play("sfx-dig", { volume: 0.5 });
    }
  }

  private updateNodeHighlights(): void {
    const px = this.avatar.x, py = this.avatar.y;
    for (const node of this.resourceNodes) {
      if (node.depleted) continue;
      const d = Phaser.Math.Distance.Between(px, py, node.sprite.x, node.sprite.y);
      const inRange = d < COLLECT_RANGE;
      node.label.setVisible(inRange);
      node.sprite.setTint(inRange ? 0xffffff : 0xdddddd);
    }
  }

  // ── Build mode ────────────────────────────────────────────────────────────────
  private enterBuildMode(recipeOutput: string): void {
    // Check if player has resources
    const recipe = CRAFTING_RECIPES.find(r => r.output === recipeOutput);
    if (!recipe) return;

    for (const ing of recipe.ingredients) {
      if ((this.inventory[ing.resource as ResourceType] ?? 0) < ing.amount) {
        this.chat.addSystemMessage(`Not enough ${ing.resource} (need ${ing.amount})`);
        this.emitInventory();
        return;
      }
    }

    this.exitBuildMode();
    this.buildMode = recipeOutput;

    const spriteKey = STRUCTURE_SPRITES[recipeOutput] ?? "tile-campfire";
    if (this.textures.exists(spriteKey)) {
      this.buildPreview = this.add.image(0, 0, spriteKey)
        .setAlpha(0.6).setDepth(99998).setScale(1.8);
    }

    this.chat.addSystemMessage(`Build mode: ${recipeOutput} — Click to place, Esc to cancel`);
    this.game.events.emit("build:mode", { active: true, recipe: recipeOutput });
  }

  private exitBuildMode(): void {
    if (this.buildPreview) { this.buildPreview.destroy(); this.buildPreview = null; }
    if (this.buildMode) {
      this.buildMode = null;
      this.game.events.emit("build:mode", { active: false });
    }
  }

  private tryPlaceStructure(wx: number, wy: number): void {
    if (!this.buildMode) return;

    const recipe = CRAFTING_RECIPES.find(r => r.output === this.buildMode);
    if (!recipe) return;

    // Final resource check
    for (const ing of recipe.ingredients) {
      if ((this.inventory[ing.resource as ResourceType] ?? 0) < ing.amount) {
        this.chat.addSystemMessage(`Not enough ${ing.resource}`);
        return;
      }
    }

    // Consume resources
    for (const ing of recipe.ingredients) {
      this.inventory[ing.resource as ResourceType] -= ing.amount;
    }

    // Snap to tile
    const tx = Math.floor(wx / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    const ty = Math.floor(wy / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;

    const spriteKey = STRUCTURE_SPRITES[this.buildMode] ?? "tile-campfire";
    if (this.textures.exists(spriteKey)) {
      const s = this.add.image(tx, ty, spriteKey).setScale(1.8).setDepth(ty);
      this.placedStructures.push({ sprite: s, type: this.buildMode });
    }

    this.emitInventory();
    this.profile.recordBuild(this.buildMode);
    this.game.events.emit("game:build");

    if (this.cache.audio.exists("sfx-gate")) this.sound.play("sfx-gate", { volume: 0.5 });

    // Stay in build mode if still have resources for more
    const stillHas = recipe.ingredients.every(
      ing => (this.inventory[ing.resource as ResourceType] ?? 0) >= ing.amount
    );
    if (!stillHas) this.exitBuildMode();
  }

  // ── Spawn resource nodes ──────────────────────────────────────────────────────
  private spawnResourceNodes(mapWidth: number, mapHeight: number): void {
    const T = TILE_SIZE;
    const safeRect = {
      x: SAFE_ZONES[0].col * T - T,
      y: SAFE_ZONES[0].row * T - T,
      w: (SAFE_ZONES[0].w + 2) * T,
      h: (SAFE_ZONES[0].h + 2) * T,
    };

    const margin = T * 3;
    const rng = Phaser.Math.RND;

    for (const cfg of NODE_TYPES) {
      if (!this.textures.exists(cfg.tileKey)) continue;

      for (let i = 0; i < cfg.count; i++) {
        let x: number, y: number, tries = 0;
        do {
          x = rng.between(margin, mapWidth  - margin);
          y = rng.between(margin, mapHeight - margin);
          tries++;
        } while (
          tries < 20 &&
          x > safeRect.x && x < safeRect.x + safeRect.w &&
          y > safeRect.y && y < safeRect.y + safeRect.h
        );

        const sprite = this.add.image(x, y, cfg.tileKey)
          .setScale(cfg.scale)
          .setTint(0xdddddd)
          .setDepth(y);

        const label = this.add.text(x, y - cfg.scale * 10, `[E] ${cfg.resource}`, {
          fontSize: "7px", fontFamily: "monospace",
          color: "#ffffff", stroke: "#000000", strokeThickness: 2,
          resolution: 2,
        }).setOrigin(0.5, 1).setDepth(y + 1).setVisible(false);

        const amount = rng.between(cfg.amount[0], cfg.amount[1]);
        this.resourceNodes.push({ sprite, label, resource: cfg.resource, amount, depleted: false });
      }
    }

    // Decorative: flowers and grass-detail (no collection)
    const decorDefs: Array<{ key: string; count: number; scale: number; tint: number }> = [
      { key: "tile-flower",       count: 120, scale: 1.0, tint: 0xffffff },
      { key: "tile-grass-detail", count: 160, scale: 1.1, tint: 0xddffdd },
      { key: "tile-torch",        count:  12, scale: 1.4, tint: 0xffffff },
    ];
    for (const { key, count, scale, tint } of decorDefs) {
      if (!this.textures.exists(key)) continue;
      for (let i = 0; i < count; i++) {
        const x = rng.between(margin, mapWidth  - margin);
        const y = rng.between(margin, mapHeight - margin);
        this.add.image(x, y, key).setScale(scale).setDepth(y).setTint(tint);
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  private emitInventory(): void {
    window.dispatchEvent(new CustomEvent("medieval-land:inventory", {
      detail: { ...this.inventory },
    }));
    // Also emit crafting availability
    const available = CRAFTING_RECIPES.filter(r =>
      r.ingredients.every(ing => (this.inventory[ing.resource as ResourceType] ?? 0) >= ing.amount)
    ).map(r => r.output);
    window.dispatchEvent(new CustomEvent("medieval-land:craftable", { detail: available }));
  }

  private setupZoneWalls(
    container: Phaser.GameObjects.Container,
    T: number
  ): void {
    const PZ = PLAYABLE_ZONE;
    const zoneX1 = PZ.col1 * T, zoneY1 = PZ.row1 * T;
    const zoneW  = (PZ.col2 - PZ.col1) * T;
    const zoneH  = (PZ.row2 - PZ.row1) * T;
    const wt = 3 * T;
    const walls = this.physics.add.staticGroup();
    const addWall = (wx: number, wy: number, w: number, h: number) => {
      const r = this.add.rectangle(wx, wy, w, h).setVisible(false);
      this.physics.add.existing(r, true);
      walls.add(r);
    };
    addWall(zoneX1 + zoneW / 2,            zoneY1 - wt / 2,              zoneW,         wt);
    addWall(zoneX1 + zoneW / 2,            zoneY1 + zoneH + wt / 2,      zoneW,         wt);
    addWall(zoneX1 - wt / 2,               zoneY1 + zoneH / 2,           wt, zoneH + wt * 2);
    addWall(zoneX1 + zoneW + wt / 2,       zoneY1 + zoneH / 2,           wt, zoneH + wt * 2);
    this.physics.add.collider(container, walls);
  }

  private showBubble(target: Phaser.GameObjects.Container, text: string, color: string): void {
    new ChatBubble(this, target, text, color);
  }

  // ── Map creation ──────────────────────────────────────────────────────────────
  private createFromTiledMap(): { mapWidth: number; mapHeight: number } {
    const TILESET_KEYS = ["MLGrass", "MLTerrain", "MLTrees", "MLBuildings", "MLObjects"];
    const map = this.make.tilemap({ key: "world-map" });
    const allTilesets = TILESET_KEYS
      .map(n => map.addTilesetImage(n, n))
      .filter((ts): ts is Phaser.Tilemaps.Tileset => ts !== null);

    for (let i = 0; i < map.layers.length; i++) {
      const layer = map.createLayer(i, allTilesets);
      if (!layer) continue;
      layer.setCollisionFromCollisionGroup();
      if (layer.filterTiles((t: Phaser.Tilemaps.Tile) => t.collides).length > 0) {
        this.collisionLayers.push(layer);
      }
      layer.setDepth(i);
    }
    return { mapWidth: map.widthInPixels, mapHeight: map.heightInPixels };
  }

  private createFromGenerator(): { mapWidth: number; mapHeight: number } {
    const generator = new WorldGenerator(this, MAP_COLS, MAP_ROWS);
    const { groundLayer, decorLayer } = generator.generate("GREEN_FIELD");
    groundLayer.setDepth(0);
    decorLayer.setDepth(1);
    return { mapWidth: MAP_COLS * TILE_SIZE, mapHeight: MAP_ROWS * TILE_SIZE };
  }

  // ── Network ───────────────────────────────────────────────────────────────────
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
    const k = keys[(wallet.charCodeAt(0) + wallet.charCodeAt(1)) % keys.length];
    const tex = this.textures.exists(k) ? k : "player-brendan";
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
    const dirs: Direction[] = ["down", "left", "right", "up"];
    if (player.isWalking && dirs[player.direction]) avatar.walk(dirs[player.direction]);
    else avatar.idle();
  }
}
