import Phaser from "phaser";
import { PreloadScene } from "../scenes/PreloadScene";
import { WorldScene } from "../scenes/WorldScene";
import { UIScene } from "../scenes/UIScene";

export const TILE_SIZE = 32;
export const MAP_WIDTH_TILES = 64;
export const MAP_HEIGHT_TILES = 64;

export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: typeof window !== "undefined" ? window.innerWidth : 1280,
  height: typeof window !== "undefined" ? window.innerHeight : 720,
  backgroundColor: "#2d5a27",
  pixelArt: true,
  zoom: 2,
  scene: [PreloadScene, WorldScene, UIScene],
  physics: {
    default: "arcade",
    arcade: {
      debug: process.env.NODE_ENV === "development",
      gravity: { x: 0, y: 0 },
    },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
