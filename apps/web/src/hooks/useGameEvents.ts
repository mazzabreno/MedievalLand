"use client";

import { useEffect } from "react";
import type Phaser from "phaser";

type GameEventCallback = (data: unknown) => void;

export function useGameEvent(event: string, callback: GameEventCallback) {
  useEffect(() => {
    let game: Phaser.Game | null = null;

    const poll = setInterval(() => {
      const g = (window as unknown as { __PHASER_GAME__?: Phaser.Game }).__PHASER_GAME__;
      if (!g) return;
      game = g;
      clearInterval(poll);
      game.events.on(event, callback);
    }, 200);

    return () => {
      clearInterval(poll);
      game?.events.off(event, callback);
    };
  }, [event, callback]);
}
