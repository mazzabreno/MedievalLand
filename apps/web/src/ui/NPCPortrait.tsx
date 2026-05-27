"use client";

import { useState, useEffect } from "react";
import type { NPCDefinition } from "@/game/config/npcRegistry";

interface NPCPortraitProps {
  npc: NPCDefinition;
  size?: number;
  variant?: "frame" | "avatar";
  onError?: () => void;
}

export default function NPCPortrait({
  npc,
  size = 128,
  variant = "frame",
  onError,
}: NPCPortraitProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const color = `#${npc.color.toString(16).padStart(6, "0")}`;

  useEffect(() => {
    setImageFailed(false);
  }, [npc.id]);

  if (!npc.portrait || imageFailed) return null;

  const handleError = () => {
    setImageFailed(true);
    onError?.();
  };

  if (variant === "avatar") {
    return (
      <div
        className="rounded-lg overflow-hidden flex-shrink-0"
        style={{ width: size, height: size, border: `2px solid ${color}` }}
      >
        <img
          src={npc.portrait}
          alt={npc.name}
          width={size}
          height={size}
          onError={handleError}
          style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated" }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center"
      style={{ width: size, filter: `drop-shadow(0 0 12px ${color}55)` }}
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{
          width: size,
          height: size,
          border: `2px solid ${color}`,
          boxShadow: `inset 0 0 0 1px ${color}33`,
        }}
      >
        <img
          src={npc.portrait}
          alt={npc.name}
          width={size}
          height={size}
          onError={handleError}
          style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated" }}
        />
      </div>
      <div
        className="mt-2 px-3 py-1 rounded-md w-full text-center"
        style={{
          background: "rgba(10,10,30,0.95)",
          border: `1px solid ${color}`,
          fontFamily: '"Press Start 2P", monospace',
          fontSize: "8px",
          color,
          letterSpacing: "0.05em",
        }}
      >
        {npc.name}
      </div>
    </div>
  );
}
