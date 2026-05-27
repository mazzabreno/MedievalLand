"use client";
import { useEffect, useState } from "react";

interface Inventory { WOOD: number; STONE: number; FIBER: number; FOOD: number }

const ICONS: Record<keyof Inventory, string> = {
  WOOD:  "🪵",
  STONE: "🪨",
  FIBER: "🌿",
  FOOD:  "🍎",
};

const COLORS: Record<keyof Inventory, string> = {
  WOOD:  "#a0522d",
  STONE: "#aaaaaa",
  FIBER: "#55cc55",
  FOOD:  "#ff7755",
};

export default function InventoryHUD() {
  const [inv, setInv] = useState<Inventory>({ WOOD: 0, STONE: 0, FIBER: 0, FOOD: 0 });

  useEffect(() => {
    const handler = (e: Event) => setInv((e as CustomEvent<Inventory>).detail);
    window.addEventListener("medieval-land:inventory", handler);
    return () => window.removeEventListener("medieval-land:inventory", handler);
  }, []);

  const resources = Object.entries(inv) as [keyof Inventory, number][];
  const hasAny = resources.some(([, v]) => v > 0);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 72,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 8,
        fontFamily: '"Press Start 2P", monospace',
        zIndex: 30,
        pointerEvents: "none",
        opacity: hasAny ? 1 : 0.4,
        transition: "opacity 0.3s",
      }}
    >
      {resources.map(([key, val]) => (
        <div
          key={key}
          style={{
            background: "rgba(10,10,30,0.92)",
            border: `1px solid ${COLORS[key]}55`,
            borderRadius: 8,
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 54,
          }}
        >
          <span style={{ fontSize: 14 }}>{ICONS[key]}</span>
          <span style={{ fontSize: 9, color: COLORS[key], minWidth: 16, textAlign: "right" }}>
            {val}
          </span>
        </div>
      ))}
    </div>
  );
}
