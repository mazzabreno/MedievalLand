"use client";
import { useEffect, useState } from "react";

interface Inventory {
  WOOD: number; STONE: number; FIBER: number; FOOD: number;
  AXE: number; PICKAXE: number; SHOVEL: number; SWORD: number; BOW: number;
  stamina: number; maxStamina: number; inSafeZone: boolean;
}

type ResourceKey = "WOOD" | "STONE" | "FIBER" | "FOOD";
type ToolKey     = "AXE" | "PICKAXE" | "SHOVEL" | "SWORD" | "BOW";

const RESOURCE_ICONS: Record<ResourceKey, string> = {
  WOOD: "🪵", STONE: "🪨", FIBER: "🌿", FOOD: "🍎",
};
const RESOURCE_COLORS: Record<ResourceKey, string> = {
  WOOD: "#a0522d", STONE: "#aaaaaa", FIBER: "#55cc55", FOOD: "#ff7755",
};

const TOOL_ICONS: Record<ToolKey, string> = {
  AXE: "🪓", PICKAXE: "⛏️", SHOVEL: "🪚", SWORD: "⚔️", BOW: "🏹",
};
const TOOL_COLOR = "#ffd700";

const RESOURCE_KEYS: ResourceKey[] = ["WOOD", "STONE", "FIBER", "FOOD"];
const TOOL_KEYS: ToolKey[]         = ["AXE", "PICKAXE", "SHOVEL", "SWORD", "BOW"];

const EMPTY: Inventory = {
  WOOD: 0, STONE: 0, FIBER: 0, FOOD: 0,
  AXE: 0, PICKAXE: 0, SHOVEL: 0, SWORD: 0, BOW: 0,
  stamina: 200, maxStamina: 200, inSafeZone: true,
};

export default function InventoryHUD() {
  const [inv, setInv] = useState<Inventory>(EMPTY);

  useEffect(() => {
    const handler = (e: Event) =>
      setInv({ ...EMPTY, ...(e as CustomEvent<Partial<Inventory>>).detail });
    window.addEventListener("medieval-land:inventory", handler);
    return () => window.removeEventListener("medieval-land:inventory", handler);
  }, []);

  const ownedTools  = TOOL_KEYS.filter(k => inv[k] > 0);
  const hasAny      = RESOURCE_KEYS.some(k => inv[k] > 0) || ownedTools.length > 0;
  const staminaPct  = Math.max(0, Math.min(100, (inv.stamina / inv.maxStamina) * 100));
  const staminaLow  = staminaPct < 25;
  const staminaColor = inv.inSafeZone ? "#14F195" : (staminaLow ? "#ff4444" : "#ffd700");

  return (
    <div
      style={{
        position: "fixed",
        bottom: 72,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        fontFamily: '"Press Start 2P", monospace',
        zIndex: 30,
        pointerEvents: "none",
        opacity: hasAny ? 1 : 0.4,
        transition: "opacity 0.3s",
      }}
    >
      {/* Resources row */}
      <div style={{ display: "flex", gap: 8 }}>
        {RESOURCE_KEYS.map((key) => (
          <div
            key={key}
            style={{
              background: "rgba(10,10,30,0.92)",
              border: `1px solid ${RESOURCE_COLORS[key]}55`,
              borderRadius: 8,
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 54,
            }}
          >
            <span style={{ fontSize: 14 }}>{RESOURCE_ICONS[key]}</span>
            <span style={{ fontSize: 9, color: RESOURCE_COLORS[key], minWidth: 16, textAlign: "right" }}>
              {inv[key]}
            </span>
          </div>
        ))}
      </div>

      {/* Stamina bar */}
      <div style={{
        width: "100%", maxWidth: 280,
        background: "rgba(10,10,30,0.88)",
        border: `1px solid ${staminaColor}44`,
        borderRadius: 6,
        padding: "4px 8px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ fontSize: 8, color: staminaColor, minWidth: 14 }}>ST</span>
        <div style={{
          flex: 1, height: 6, background: "rgba(255,255,255,0.08)",
          borderRadius: 3, overflow: "hidden",
        }}>
          <div style={{
            width: `${staminaPct}%`, height: "100%",
            background: staminaColor,
            borderRadius: 3,
            transition: "width 0.3s ease, background 0.3s",
          }} />
        </div>
        <span style={{ fontSize: 7, color: staminaColor, minWidth: 28, textAlign: "right" }}>
          {inv.stamina}/{inv.maxStamina}
        </span>
        {inv.inSafeZone && (
          <span style={{ fontSize: 7, color: "#14F195", opacity: 0.7 }}>⚡</span>
        )}
      </div>

      {/* Tools row — only visible when player owns at least one tool */}
      {ownedTools.length > 0 && (
        <div style={{ display: "flex", gap: 6 }}>
          {ownedTools.map((key) => (
            <div
              key={key}
              style={{
                background: "rgba(10,10,30,0.92)",
                border: `1px solid ${TOOL_COLOR}44`,
                borderRadius: 6,
                padding: "4px 8px",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span style={{ fontSize: 12 }}>{TOOL_ICONS[key]}</span>
              <span style={{ fontSize: 8, color: TOOL_COLOR }}>
                {key} ×{inv[key]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
