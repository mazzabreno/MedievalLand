import * as Phaser from "phaser";

export type Direction = "down" | "left" | "right" | "up";
export type DirectionRow = Record<Direction, number>;

// Player spritesheet row order: down=0, right=1, up=2, left=3
export const PLAYER_DIRECTION_ROW: DirectionRow = {
  down: 0,
  right: 1,
  up: 2,
  left: 3,
};

// NPC spritesheets (exported by DOM): down, up, right, left
export const NPC_DIRECTION_ROW: DirectionRow = {
  down: 0,
  up: 1,
  right: 2,
  left: 3,
};

export class SimpleSprite {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite;
  private container: Phaser.GameObjects.Container;
  private currentDirection: Direction = "down";
  private isWalking = false;
  private textureKey: string;
  private directionRow: DirectionRow;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string,
    directionRow: DirectionRow = PLAYER_DIRECTION_ROW
  ) {
    this.scene = scene;
    this.textureKey = textureKey;
    this.directionRow = directionRow;

    const FOOT_Y_LOCAL = -2;

    this.sprite = scene.add.sprite(0, FOOT_Y_LOCAL, textureKey);
    this.sprite.setOrigin(0.5, 1.0);

    const frame = scene.textures.get(textureKey).get(0);
    const frameHeight = frame.height || 48;
    if (frameHeight >= 56) {
      this.sprite.setScale(0.5);
    }

    this.container = scene.add.container(x, y, [this.sprite]);

    this.registerAnimations();
    this.sprite.setFrame(0);
  }

  get x(): number { return this.container.x; }
  set x(v: number) { this.container.x = v; }

  get y(): number { return this.container.y; }
  set y(v: number) { this.container.y = v; }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  walk(direction: Direction): void {
    this.currentDirection = direction;
    if (!this.isWalking || this.sprite.anims.getName() !== `${this.textureKey}-walk-${direction}`) {
      this.isWalking = true;
      this.sprite.anims.play(`${this.textureKey}-walk-${direction}`, true);
    }
  }

  idle(): void {
    if (!this.isWalking) return;
    this.isWalking = false;
    this.sprite.anims.stop();
    const row = this.directionRow[this.currentDirection];
    this.sprite.setFrame(row * 4);
  }

  face(direction: Direction): void {
    this.currentDirection = direction;
    this.isWalking = false;
    this.sprite.anims.stop();
    const row = this.directionRow[direction];
    this.sprite.setFrame(row * 4);
  }

  updateDepth(): void {
    this.container.depth = this.container.y;
  }

  setTexture(textureKey: string, directionRow?: DirectionRow): void {
    if (textureKey === this.textureKey) return;
    this.textureKey = textureKey;
    if (directionRow) this.directionRow = directionRow;
    this.sprite.setTexture(textureKey);
    this.registerAnimations();
    this.idle();
  }

  destroy(): void {
    this.container.destroy();
  }

  private registerAnimations(): void {
    const directions: Direction[] = ["down", "left", "right", "up"];
    const cols = 4;

    for (const dir of directions) {
      const row = this.directionRow[dir];
      const key = `${this.textureKey}-walk-${dir}`;

      if (!this.scene.anims.exists(key)) {
        this.scene.anims.create({
          key,
          frames: this.scene.anims.generateFrameNumbers(this.textureKey, {
            start: row * cols,
            end: row * cols + cols - 1,
          }),
          frameRate: 8,
          repeat: -1,
        });
      }
    }
  }

  static load(
    scene: Phaser.Scene,
    key: string,
    path: string,
    frameWidth: number,
    frameHeight: number
  ): void {
    scene.load.spritesheet(key, path, { frameWidth, frameHeight });
  }
}
