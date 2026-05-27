import Phaser from "phaser";
import { TILE_SIZE } from "../config/gameConfig";
import type { BiomeType, TileType, StructureType } from "../types";

interface GeneratedNode { x: number; y: number; type: TileType }
interface GeneratedStructure { x: number; y: number; type: StructureType }

export class WorldGenerator {
  private scene: Phaser.Scene;
  private width: number;
  private height: number;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.width = width;
    this.height = height;
  }

  generate(biome: BiomeType) {
    const map = this.scene.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: this.width,
      height: this.height,
    });

    const tileset = map.addTilesetImage("tileset-overworld")!;
    const groundLayer = map.createBlankLayer("ground", tileset)!;
    const decorLayer = map.createBlankLayer("decor", tileset)!;

    // Fill base grass
    groundLayer.fill(0); // index 0 = grass tile

    // Dirt path cross
    for (let x = 0; x < this.width; x++) groundLayer.putTileAt(1, x, Math.floor(this.height / 2));
    for (let y = 0; y < this.height; y++) groundLayer.putTileAt(1, Math.floor(this.width / 2), y);

    // Safe zones (3 of them)
    const safeZones: Phaser.Geom.Rectangle[] = [
      new Phaser.Geom.Rectangle(2 * TILE_SIZE, 2 * TILE_SIZE, 8 * TILE_SIZE, 8 * TILE_SIZE),
      new Phaser.Geom.Rectangle(50 * TILE_SIZE, 2 * TILE_SIZE, 8 * TILE_SIZE, 8 * TILE_SIZE),
      new Phaser.Geom.Rectangle(28 * TILE_SIZE, 50 * TILE_SIZE, 8 * TILE_SIZE, 8 * TILE_SIZE),
    ];

    // Mark safe zone tiles
    safeZones.forEach((rect) => {
      const tx = Math.floor(rect.x / TILE_SIZE);
      const ty = Math.floor(rect.y / TILE_SIZE);
      const tw = Math.floor(rect.width / TILE_SIZE);
      const th = Math.floor(rect.height / TILE_SIZE);
      for (let x = tx; x < tx + tw; x++)
        for (let y = ty; y < ty + th; y++)
          groundLayer.putTileAt(2, x, y); // index 2 = safe zone grass
    });

    // Resource nodes
    const resourceNodes: GeneratedNode[] = [];
    const treePositions = this.scatter(15, 10, this.width - 10, 10, this.height - 10, safeZones);
    treePositions.forEach(({ x, y }) => resourceNodes.push({ x: x * TILE_SIZE, y: y * TILE_SIZE, type: "TREE_OAK" }));

    const rockPositions = this.scatter(8, 10, this.width - 10, 10, this.height - 10, safeZones);
    rockPositions.forEach(({ x, y }) => resourceNodes.push({ x: x * TILE_SIZE, y: y * TILE_SIZE, type: "ROCK_NODE" }));

    const berryPositions = this.scatter(6, 10, this.width - 10, 10, this.height - 10, safeZones);
    berryPositions.forEach(({ x, y }) => resourceNodes.push({ x: x * TILE_SIZE, y: y * TILE_SIZE, type: "BERRY_SHRUB" }));

    const structures: GeneratedStructure[] = [];

    return { groundLayer, decorLayer, safeZones, resourceNodes, structures };
  }

  private scatter(
    count: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    exclusionZones: Phaser.Geom.Rectangle[]
  ): Array<{ x: number; y: number }> {
    const result: Array<{ x: number; y: number }> = [];
    let attempts = 0;
    while (result.length < count && attempts < count * 10) {
      attempts++;
      const x = Math.floor(Math.random() * (maxX - minX) + minX);
      const y = Math.floor(Math.random() * (maxY - minY) + minY);
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      if (exclusionZones.some((r) => r.contains(px, py))) continue;
      result.push({ x, y });
    }
    return result;
  }
}
