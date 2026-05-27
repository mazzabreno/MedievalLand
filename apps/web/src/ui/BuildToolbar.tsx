"use client";
import { useEffect, useState, useCallback } from "react";
import { CRAFTING_RECIPES } from "@/game/types";

const ICONS: Record<string, string> = {
  WOODEN_FENCE:    "🪵",
  WOODEN_WALL:     "🧱",
  WOODEN_DOOR:     "🚪",
  CAMPFIRE:        "🔥",
  CHEST:           "📦",
  CRAFTING_TABLE:  "⚒️",
  AXE:             "🪓",
  PICKAXE:         "⛏️",
  SHOVEL:          "🪛",
  SWORD:           "⚔️",
  BOW:             "🏹",
};

export default function BuildToolbar({ gameRef }: { gameRef: Phaser.Game | null }) {
  const [craftable, setCraftable]   = useState<string[]>([]);
  const [selected,  setSelected]    = useState<string | null>(null);
  const [buildActive, setBuildActive] = useState(false);

  useEffect(() => {
    const onCraftable = (e: Event) => setCraftable((e as CustomEvent<string[]>).detail);
    window.addEventListener("medieval-land:craftable", onCraftable);
    return () => window.removeEventListener("medieval-land:craftable", onCraftable);
  }, []);

  useEffect(() => {
    if (!gameRef) return;
    const onMode = ({ active }: { active: boolean }) => {
      setBuildActive(active);
      if (!active) setSelected(null);
    };
    gameRef.events.on("build:mode", onMode);
    return () => { gameRef.events.off("build:mode", onMode); };
  }, [gameRef]);

  const select = useCallback((output: string) => {
    if (!gameRef) return;
    if (selected === output) {
      gameRef.events.emit("build:select", null);
      setSelected(null);
    } else {
      setSelected(output);
      gameRef.events.emit("build:select", output);
    }
  }, [gameRef, selected]);

  // Show only placeable/craftable structures and tools
  const recipes = CRAFTING_RECIPES;
  const structures = recipes.filter(r =>
    ["WOODEN_FENCE","WOODEN_WALL","WOODEN_DOOR","CAMPFIRE","CHEST","CRAFTING_TABLE"].includes(r.output)
  );
  const tools = recipes.filter(r =>
    ["AXE","PICKAXE","SHOVEL","SWORD","BOW"].includes(r.output)
  );

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        paddingBottom: 8,
        fontFamily: '"Press Start 2P", monospace',
      }}
    >
      {buildActive && (
        <div style={{
          fontSize: 8, color: "#9945FF",
          background: "rgba(10,10,30,0.9)",
          padding: "4px 12px", borderRadius: 6,
          border: "1px solid #9945FF55",
        }}>
          BUILD MODE — Click to place · Esc to cancel
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        {/* Structures */}
        {structures.map(r => {
          const can = craftable.includes(r.output);
          const active = selected === r.output;
          return (
            <button
              key={r.output}
              onClick={() => can && select(r.output)}
              title={`${r.output}\n${r.ingredients.map(i => `${i.amount}× ${i.resource}`).join(", ")}`}
              style={{
                width: 44, height: 44,
                borderRadius: 8,
                border: active
                  ? "2px solid #9945FF"
                  : can ? "1px solid rgba(153,69,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
                background: active
                  ? "rgba(153,69,255,0.3)"
                  : can ? "rgba(10,10,30,0.9)" : "rgba(10,10,30,0.5)",
                cursor: can ? "pointer" : "not-allowed",
                opacity: can ? 1 : 0.35,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                fontSize: 18,
                boxShadow: active ? "0 0 10px #9945FF88" : "none",
                transition: "all 0.15s",
              }}
            >
              <span>{ICONS[r.output] ?? "📦"}</span>
              <span style={{ fontSize: 6, color: "#ffffff88", marginTop: 2 }}>
                {r.ingredients.map(i => `${i.amount}${i.resource[0]}`).join(" ")}
              </span>
            </button>
          );
        })}

        {/* Divider */}
        <div style={{ width: 1, background: "rgba(255,255,255,0.1)", margin: "4px 2px" }} />

        {/* Tools */}
        {tools.map(r => {
          const can = craftable.includes(r.output);
          return (
            <button
              key={r.output}
              onClick={() => can && select(r.output)}
              title={`${r.output}\n${r.ingredients.map(i => `${i.amount}× ${i.resource}`).join(", ")}`}
              style={{
                width: 44, height: 44,
                borderRadius: 8,
                border: can ? "1px solid rgba(20,241,149,0.4)" : "1px solid rgba(255,255,255,0.1)",
                background: can ? "rgba(10,10,30,0.9)" : "rgba(10,10,30,0.5)",
                cursor: can ? "pointer" : "not-allowed",
                opacity: can ? 1 : 0.35,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                fontSize: 18,
                transition: "all 0.15s",
              }}
            >
              <span>{ICONS[r.output] ?? "🔧"}</span>
              <span style={{ fontSize: 6, color: "#ffffff88", marginTop: 2 }}>
                {r.ingredients.map(i => `${i.amount}${i.resource[0]}`).join(" ")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
