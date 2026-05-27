"use client";
import * as Phaser from "phaser";

export type Direction = "down" | "left" | "right" | "up";

/**
 * PokeWilds walking sprite format:
 *   128 × 16 px  →  8 frames of 16×16 in a single row
 *   down  = frames 0-1
 *   left  = frames 2-3
 *   right = frames 4-5
 *   up    = frames 6-7
 */
export const PW_DIR_OFFSET: Record<Direction, number> = {
  down:  0,
  left:  2,
  right: 4,
  up:    6,
};

export const FRAME_W = 16;
export const FRAME_H = 16;
export const FRAMES_PER_DIR = 2;
/** Render at 2× so 16px tiles look 32px (matching TILE_SIZE) */
export const SPRITE_SCALE = 2;

export class SimpleSprite {
  private scene:     Phaser.Scene;
  private sprite:    Phaser.GameObjects.Sprite;
  private container: Phaser.GameObjects.Container;
  private dir:       Direction = "down";
  private moving     = false;
  private key:       string;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string) {
    this.scene = scene;
    this.key   = textureKey;

    this.sprite = scene.add.sprite(0, 0, textureKey, 0);
    this.sprite.setOrigin(0.5, 1.0);
    this.sprite.setScale(SPRITE_SCALE);

    this.container = scene.add.container(x, y, [this.sprite]);
    this.registerAnims();
    this.sprite.setFrame(0);
  }

  // ── position ─────────────────────────────────────────────────────────────
  get x() { return this.container.x; }
  set x(v: number) { this.container.x = v; }
  get y() { return this.container.y; }
  set y(v: number) { this.container.y = v; }

  getContainer() { return this.container; }

  // ── animation control ────────────────────────────────────────────────────
  walk(direction: Direction) {
    this.dir = direction;
    const animKey = `${this.key}-walk-${direction}`;
    if (!this.moving || this.sprite.anims.getName() !== animKey) {
      this.moving = true;
      this.sprite.anims.play(animKey, true);
    }
  }

  idle() {
    if (!this.moving) return;
    this.moving = false;
    this.sprite.anims.stop();
    this.sprite.setFrame(PW_DIR_OFFSET[this.dir]);
  }

  face(direction: Direction) {
    this.dir    = direction;
    this.moving = false;
    this.sprite.anims.stop();
    this.sprite.setFrame(PW_DIR_OFFSET[direction]);
  }

  updateDepth() {
    this.container.depth = this.container.y;
  }

  setTexture(textureKey: string) {
    if (textureKey === this.key) return;
    this.key = textureKey;
    this.sprite.setTexture(textureKey);
    this.registerAnims();
    this.face(this.dir);
  }

  destroy() { this.container.destroy(); }

  // ── private ──────────────────────────────────────────────────────────────
  private registerAnims() {
    const dirs: Direction[] = ["down", "left", "right", "up"];
    for (const d of dirs) {
      const k = `${this.key}-walk-${d}`;
      if (this.scene.anims.exists(k)) continue;
      const start = PW_DIR_OFFSET[d];
      this.scene.anims.create({
        key: k,
        frames: this.scene.anims.generateFrameNumbers(this.key, {
          start,
          end: start + FRAMES_PER_DIR - 1,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  // ── static loader ─────────────────────────────────────────────────────────
  static load(scene: Phaser.Scene, key: string, path: string) {
    scene.load.spritesheet(key, path, {
      frameWidth:  FRAME_W,
      frameHeight: FRAME_H,
    });
  }
}
