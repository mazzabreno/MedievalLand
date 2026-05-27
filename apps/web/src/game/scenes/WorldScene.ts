import * as Phaser from "phaser";
import { PLAYER_SPEED, TILE_SIZE, PLAYABLE_ZONE, MAP_COLS, MAP_ROWS, SAFE_ZONES } from "../config/constants";
import { SimpleSprite, Direction } from "../entities/SimpleSprite";
import { OnChainMultiplayer, OnChainPlayer } from "../multiplayer/OnChainMultiplayer";
import { ChatManager, getChannelColor } from "../chat/ChatManager";
import { ChatBubble } from "../chat/ChatBubble";
import { NPCSprite } from "../entities/NPCSprite";
import { NPC_REGISTRY } from "../config/npcRegistry";
import { ProfileManager, profileManager } from "../config/profileManager";
import { AchievementEngine } from "../progression/achievementEngine";
import { setupEmojiKeys, showEmoji, type EmojiDef } from "../chat/EmojiSystem";
import { generateMedievalTileset } from "../utils/tilesetGenerator";
import { WorldGenerator } from "../systems/WorldGenerator";

const TILESET_KEYS = [
  "MLGrass", "MLTerrain", "MLTrees", "MLBuildings", "MLObjects",
];

export class WorldScene extends Phaser.Scene {
  private avatar!: SimpleSprite;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  private overheadLayers: Phaser.Tilemaps.TilemapLayer[] = [];

  private network!: OnChainMultiplayer;
  private chat!: ChatManager;
  private remotePlayers = new Map<string, SimpleSprite>();
  private nameLabels = new Map<string, Phaser.GameObjects.Text>();
  private activeBubbles = new Map<string, ChatBubble>();
  private currentDirection: Direction = "down";
  private chatInputActive = false;
  private npcSprites: NPCSprite[] = [];
  private interactionBlocked = false;
  private profile!: ProfileManager;
  private touchDx = 0;
  private touchDy = 0;

  constructor() {
    super({ key: "WorldScene" });
  }

  create(): void {
    const T = TILE_SIZE;
    let mapWidth:  number;
    let mapHeight: number;

    // ── Map setup — Tiled if available, procedural fallback ───────────────────
    const hasTiledMap = this.cache.tilemap.exists("world-map");

    if (hasTiledMap) {
      const result = this.createFromTiledMap();
      mapWidth  = result.mapWidth;
      mapHeight = result.mapHeight;
    } else {
      const result = this.createFromGenerator();
      mapWidth  = result.mapWidth;
      mapHeight = result.mapHeight;
    }

    // ── Player spawn ──────────────────────────────────────────────────────────
    // First safe zone center: SAFE_ZONES[0] = { col:2, row:2, w:8, h:8 }
    const sz = SAFE_ZONES[0];
    const spawnX = (sz.col + Math.floor(sz.w / 2)) * T + T / 2;
    const spawnY = (sz.row + Math.floor(sz.h / 2)) * T + T / 2;

    // Use the trainer sprite saved in the player's profile (default: brendan)
    const savedKey = profileManager?.get().spriteKey ?? "player-brendan";
    const playerTextureKey = this.textures.exists(savedKey) ? savedKey : "player-brendan";
    this.avatar = new SimpleSprite(this, spawnX, spawnY, playerTextureKey);

    const container = this.avatar.getContainer();
    this.physics.world.enable(container);
    this.playerBody = container.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setSize(T * 0.5, T * 0.3);
    this.playerBody.setOffset(-T * 0.25, -T * 0.2);
    this.playerBody.setCollideWorldBounds(true);
    for (const cl of this.collisionLayers) {
      this.physics.add.collider(container, cl);
    }

    // ── Playable-zone boundary walls ──────────────────────────────────────────
    const PZ = PLAYABLE_ZONE;
    const zoneX1    = PZ.col1 * T;
    const zoneY1    = PZ.row1 * T;
    const zoneW     = (PZ.col2 - PZ.col1) * T;
    const zoneH     = (PZ.row2 - PZ.row1) * T;
    const wallThick = 3 * T;
    const zoneWalls = this.physics.add.staticGroup();
    const addZoneWall = (wx: number, wy: number, w: number, h: number) => {
      const r = this.add.rectangle(wx, wy, w, h).setVisible(false);
      this.physics.add.existing(r, true);
      zoneWalls.add(r);
    };
    addZoneWall(zoneX1 + zoneW / 2,            zoneY1 - wallThick / 2,            zoneW,              wallThick);
    addZoneWall(zoneX1 + zoneW / 2,            zoneY1 + zoneH + wallThick / 2,    zoneW,              wallThick);
    addZoneWall(zoneX1 - wallThick / 2,         zoneY1 + zoneH / 2,                wallThick, zoneH + wallThick * 2);
    addZoneWall(zoneX1 + zoneW + wallThick / 2, zoneY1 + zoneH / 2,                wallThick, zoneH + wallThick * 2);
    this.physics.add.collider(container, zoneWalls);

    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

    // "YOU" label
    const youLabel = this.add.text(0, -38, "YOU", {
      fontSize: "10px", fontFamily: "monospace",
      color: "#ffffff", align: "center",
      resolution: 2,
      stroke: "#0a0a1e",
      strokeThickness: 2,
    }).setOrigin(0.5, 1);
    container.add(youLabel);

    // Camera
    this.cameras.main.startFollow(container, true, 1.0, 1.0);
    const storedZoom = parseFloat(localStorage.getItem("medieval-land:zoom") ?? "");
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    this.cameras.main.setZoom(isNaN(storedZoom) ? (isTouchDevice ? 1.5 : 2) : storedZoom);
    this.cameras.main.setBackgroundColor(0x061a2c);
    this.cameras.main.roundPixels = true;

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Profile system
    this.profile = profileManager;
    this.registry.set("profileManager", this.profile);

    if (!this.registry.get("achievementEngine")) {
      const engine = new AchievementEngine(this.profile);
      this.registry.set("achievementEngine", engine);
    }

    // Chat system
    this.chat = new ChatManager();
    this.chat.addSystemMessage("Welcome to MedievalLand");
    this.registry.set("chatManager", this.chat);

    this.game.events.on("chat:send", (text: string) => {
      const channel = this.chat.getActiveChannel();
      const color = getChannelColor(channel);

      this.chat.addMessage(
        channel,
        this.network?.sessionId ?? "local",
        this.profile.get().displayName,
        text,
        color
      );

      this.showBubble(this.avatar.getContainer(), text, color);

      if (this.network?.connected) {
        this.network.sendChat(text);
      }
    });

    this.game.events.on("chat:focus", (focused: boolean) => {
      this.chatInputActive = focused;
      if (this.input.keyboard) {
        this.input.keyboard.enabled = !focused;
      }
    });

    setupEmojiKeys(
      this,
      () => this.avatar.getContainer(),
      () => this.chatInputActive,
      (emoji) => {
        this.chat.addMessage("local", "local", this.profile.get().displayName, emoji.symbol, emoji.color);
      }
    );

    this.game.events.on("emoji:trigger", (emoji: EmojiDef) => {
      showEmoji(this, this.avatar.getContainer(), emoji);
      this.chat.addMessage("local", "local", this.profile.get().displayName, emoji.symbol, emoji.color);
    });

    this.game.events.on("profile:outfit", (outfitId: string) => {
      const textureKey = `avatar-${outfitId}`;
      if (this.textures.exists(textureKey)) {
        this.avatar.setTexture(textureKey);
      }
    });

    // NPCs
    for (const def of NPC_REGISTRY) {
      const npcX = def.tileX * T + T / 2;
      const npcY = def.tileY * T + T / 2;
      const npc = new NPCSprite(this, def, npcX, npcY, this.collisionLayers);
      this.npcSprites.push(npc);

      const npcContainer = npc.getContainer();
      this.physics.world.enable(npcContainer);
      const npcBody = npcContainer.body as Phaser.Physics.Arcade.Body;
      npcBody.setSize(T * 0.6, T * 0.4);
      npcBody.setOffset(-T * 0.3, -T * 0.2);
      npcBody.setImmovable(true);
      this.physics.add.collider(container, npcContainer);
    }

    // G key — toggle debug
    this.input.keyboard!.on("keydown-G", () => {
      this.physics.world.drawDebug = !this.physics.world.drawDebug;
      if (!this.physics.world.drawDebug) {
        this.physics.world.debugGraphic?.clear();
      }
    });

    this.game.events.on("npc:close", () => {
      this.interactionBlocked = false;
    });

    this.game.events.on("camera:zoom", (zoom: number) => {
      this.cameras.main.setZoom(zoom);
    });

    this.game.events.on("touch:joystick", ({ dx, dy }: { dx: number; dy: number }) => {
      this.touchDx = dx;
      this.touchDy = dy;
    });
    this.game.events.on("touch:stop", () => {
      this.touchDx = 0;
      this.touchDy = 0;
    });
    this.game.events.on("touch:interact", () => {
      if (this.chatInputActive || this.interactionBlocked) return;
      const nearby = this.npcSprites.find((n) => n.isInRange);
      if (nearby) {
        this.interactionBlocked = true;
        this.game.events.emit("npc:interact", nearby.def);
      }
    });

    this.input.keyboard!.on("keydown-E", () => {
      if (this.chatInputActive || this.interactionBlocked) return;
      const nearby = this.npcSprites.find((n) => n.isInRange);
      if (nearby) {
        this.interactionBlocked = true;
        this.game.events.emit("npc:interact", nearby.def);
      }
    });

    // On-chain multiplayer via MagicBlock Ephemeral Rollups
    this.network = new OnChainMultiplayer();
    this.registry.set("network", this.network);

    // Expose game event bus globally so the multiplayer layer and WalletSignBridge
    // can request wallet signatures from React.
    (globalThis as any).__medievalLandGameEvents = this.game.events;

    this.profile.onChange((p) => {
      this.network?.updateScore(p.score);
    });

    this.game.events.on("wallet:connected", async (walletAddress: string) => {
      try {
        const { PublicKey } = await import("@solana/web3.js");
        this.profile.setWallet(walletAddress);
        const displayName = this.profile.get().displayName;
        this.network.updateScore(this.profile.get().score);
        await this.network.connect(new PublicKey(walletAddress), displayName);
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

    // Record on-chain actions
    this.game.events.on("game:harvest", () => this.network?.recordAction("harvest"));
    this.game.events.on("game:build",   () => this.network?.recordAction("build"));
    this.game.events.on("game:kill",    () => this.network?.recordAction("kill"));
  }

  update(): void {
    if (this.chatInputActive || this.interactionBlocked) {
      this.playerBody.setVelocity(0);
      this.avatar.idle();
      for (const npc of this.npcSprites) {
        npc.checkProximity(this.avatar.x, this.avatar.y);
      }
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
    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    const touchActive = Math.abs(this.touchDx) > 0.1 || Math.abs(this.touchDy) > 0.1;
    if (touchActive) {
      vx = this.touchDx * PLAYER_SPEED;
      vy = this.touchDy * PLAYER_SPEED;
      if (Math.abs(this.touchDx) >= Math.abs(this.touchDy)) {
        direction = this.touchDx < 0 ? "left" : "right";
      } else {
        direction = this.touchDy < 0 ? "up" : "down";
      }
    }

    this.playerBody.setVelocity(vx, vy);

    if (direction) {
      this.avatar.walk(direction);
      this.currentDirection = direction;
    } else {
      this.avatar.idle();
    }

    this.avatar.updateDepth();

    // Overhead fade
    {
      const px = this.avatar.x;
      const py = this.avatar.y;
      for (const layer of this.overheadLayers) {
        const isAbove = layer.depth > py;
        const target = isAbove && layer.getTileAtWorldXY(px, py) !== null
          ? 0.25
          : 1.0;
        if (Math.abs(layer.alpha - target) > 0.004) {
          layer.alpha = Phaser.Math.Linear(layer.alpha, target, 0.12);
        }
      }
    }

    for (const npc of this.npcSprites) {
      npc.checkProximity(this.avatar.x, this.avatar.y);
    }

    if (this.network.connected) {
      this.network.sendInput(
        this.avatar.x,
        this.avatar.y,
        this.currentDirection,
        direction !== null
      );
    }

    this.remotePlayers.forEach((remote) => {
      remote.updateDepth();
    });
  }

  // ── Map creation helpers ──────────────────────────────────────────────

  private createFromTiledMap(): { mapWidth: number; mapHeight: number } {
    const map = this.make.tilemap({ key: "world-map" });

    const allTilesets = TILESET_KEYS
      .map(n => map.addTilesetImage(n, n))
      .filter((ts): ts is Phaser.Tilemaps.Tileset => ts !== null);

    const FOREGROUND_PREFIXES = ["Tree", "Canopy"];
    const FOREGROUND_DEPTH = 10000;
    const Y_SORT_PREFIXES   = ["Tree", "Decor", "Object"];

    for (let i = 0; i < map.layers.length; i++) {
      const layerName = map.layers[i].name;
      const layer = map.createLayer(i, allTilesets);
      if (!layer) continue;

      layer.setCollisionFromCollisionGroup();
      const collidingTiles = layer.filterTiles((t: Phaser.Tilemaps.Tile) => t.collides);

      if (collidingTiles.length > 0) {
        if (Y_SORT_PREFIXES.some(p => layerName.startsWith(p))) {
          let maxBottomY = 0;
          for (const tile of collidingTiles) {
            const worldY = layer.tileToWorldY(tile.y)!;
            if (worldY + map.tileHeight > maxBottomY) maxBottomY = worldY + map.tileHeight;
          }
          layer.setDepth(maxBottomY);
          this.overheadLayers.push(layer);
        } else {
          layer.setDepth(i);
        }
        this.collisionLayers.push(layer);
      } else if (FOREGROUND_PREFIXES.some(p => layerName.startsWith(p))) {
        layer.setDepth(FOREGROUND_DEPTH);
        this.overheadLayers.push(layer);
      } else {
        layer.setDepth(i);
      }
    }

    return { mapWidth: map.widthInPixels, mapHeight: map.heightInPixels };
  }

  private createFromGenerator(): { mapWidth: number; mapHeight: number } {
    // Use the procedural generator as a fallback when no Tiled map is loaded
    const generator = new WorldGenerator(this, MAP_COLS, MAP_ROWS);
    const { groundLayer, decorLayer } = generator.generate("GREEN_FIELD");

    groundLayer.setDepth(0);
    decorLayer.setDepth(1);

    const mapWidth  = MAP_COLS * TILE_SIZE;
    const mapHeight = MAP_ROWS * TILE_SIZE;

    return { mapWidth, mapHeight };
  }

  // ── Network setup ──────────────────────────────────────────────────────

  private setupNetworkCallbacks(): void {
    this.network.onPlayerAdd((wallet, player) => {
      if (wallet === this.network.sessionId) return;
      this.addRemotePlayer(wallet, player);
    });

    this.network.onPlayerRemove((wallet) => {
      this.removeRemotePlayer(wallet);
    });

    this.network.onPlayerChange((wallet, player) => {
      if (wallet === this.network.sessionId) return;
      this.updateRemotePlayer(wallet, player);
    });
  }

  private addRemotePlayer(wallet: string, player: OnChainPlayer): void {
    // Remote players use a random trainer sprite from the available pool
    const remoteKeys = ["player-may","player-gold","player-hilbert","player-calem","player-hilda","player-leaf"];
    const remoteKey = remoteKeys[Math.abs(wallet.charCodeAt(0) + wallet.charCodeAt(1)) % remoteKeys.length];
    const remoteTexture = this.textures.exists(remoteKey) ? remoteKey : "player-brendan";
    const avatar = new SimpleSprite(this, player.x, player.y, remoteTexture);
    this.remotePlayers.set(wallet, avatar);

    const shortAddr = `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
    const displayName = player.displayName ?? shortAddr;

    const label = this.add.text(0, -38, displayName, {
      fontSize: "9px", fontFamily: "monospace",
      color: "#aaaacc", align: "center",
      resolution: 2,
      stroke: "#0a0a1e",
      strokeThickness: 2,
    }).setOrigin(0.5, 1);
    avatar.getContainer().add(label);
    this.nameLabels.set(wallet, label);

    this.chat.addSystemMessage(`${displayName} entered the realm`);
  }

  private removeRemotePlayer(wallet: string): void {
    const avatar = this.remotePlayers.get(wallet);
    if (avatar) {
      avatar.destroy();
      this.remotePlayers.delete(wallet);
    }

    const label = this.nameLabels.get(wallet);
    if (label) {
      label.destroy();
      this.nameLabels.delete(wallet);
    }

    const bubble = this.activeBubbles.get(wallet);
    if (bubble) {
      bubble.destroy();
      this.activeBubbles.delete(wallet);
    }

    this.chat.addSystemMessage(`An adventurer left the realm`);
  }

  private updateRemotePlayer(wallet: string, player: OnChainPlayer): void {
    const avatar = this.remotePlayers.get(wallet);
    if (!avatar) return;

    const container = avatar.getContainer();
    this.tweens.add({
      targets: container,
      x: player.x,
      y: player.y,
      duration: 100,
      ease: "Linear",
    });

    const dirs: Direction[] = ["down", "left", "right", "up"];
    if (player.isWalking && dirs[player.direction]) {
      avatar.walk(dirs[player.direction]);
    } else {
      avatar.idle();
    }
  }

  private showBubble(
    target: Phaser.GameObjects.Container,
    text: string,
    color: string
  ): void {
    new ChatBubble(this, target, text, color);
  }
}
