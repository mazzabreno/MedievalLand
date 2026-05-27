"use client";

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { GAME_CONFIG } from "@/game/config/gameConfig";

export default function GameCanvas() {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameRef.current) return;
    gameRef.current = new Phaser.Game({
      ...GAME_CONFIG,
      parent: "game-container",
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div id="game-container" className="w-screen h-screen" />;
}
