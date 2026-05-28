"use client";

import { useEffect, useState } from "react";
import { InventoryPanel } from "../panels/InventoryPanel";
import { CraftingPanel } from "../panels/CraftingPanel";
import { BuildingPanel } from "../panels/BuildingPanel";
import type { ResourceStack } from "@/shared";

interface PlayerStateUpdate {
  stamina: number;
  maxStamina: number;
  hp: number;
  maxHp: number;
  inventory: ResourceStack[];
  inSafeZone: boolean;
  score: number;
}

type ActivePanel = "inventory" | "crafting" | "building" | null;

export function HUD() {
  const [state, setState] = useState<PlayerStateUpdate>({
    stamina: 200, maxStamina: 200, hp: 100, maxHp: 100, inventory: [], inSafeZone: true, score: 0,
  });
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    let game: import("phaser").Game | null = null;

    const pollGame = setInterval(() => {
      const g = (window as unknown as { __PHASER_GAME__?: import("phaser").Game }).__PHASER_GAME__;
      if (!g) return;
      game = g;
      clearInterval(pollGame);

      game.events.on("player-state-update", (data: PlayerStateUpdate) => setState(data));
      game.events.on("notification", (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 2000);
      });
    }, 300);

    return () => clearInterval(pollGame);
  }, []);

  const toggle = (panel: ActivePanel) => setActivePanel((p) => (p === panel ? null : panel));

  return (
    <div className="ui-overlay inset-0 pointer-events-none">
      {/* Top-left: HP + Stamina */}
      <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
        <Bar label="HP" value={state.hp} max={state.maxHp} color="bg-red-600" />
        <Bar label="ST" value={state.stamina} max={state.maxStamina} color="bg-yellow-500" />
        {state.inSafeZone && (
          <span className="text-xs text-green-400 bg-black/60 px-2 py-0.5 rounded">SAFE ZONE</span>
        )}
      </div>

      {/* Top-right: Score */}
      <div className="absolute top-3 right-3 text-amber-300 text-xs bg-black/60 px-3 py-1 rounded">
        SCORE: {state.score}
      </div>

      {/* Notification toast */}
      {notification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/80 text-amber-200 text-xs px-4 py-2 rounded border border-amber-700">
          {notification}
        </div>
      )}

      {/* Bottom toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
        <ToolbarButton label="BAG" active={activePanel === "inventory"} onClick={() => toggle("inventory")} />
        <ToolbarButton label="CRAFT" active={activePanel === "crafting"} onClick={() => toggle("crafting")} />
        <ToolbarButton label="BUILD" active={activePanel === "building"} onClick={() => toggle("building")} />
      </div>

      {/* Panels */}
      {activePanel === "inventory" && <InventoryPanel inventory={state.inventory} onClose={() => setActivePanel(null)} />}
      {activePanel === "crafting" && <CraftingPanel inventory={state.inventory} onClose={() => setActivePanel(null)} />}
      {activePanel === "building" && <BuildingPanel onClose={() => setActivePanel(null)} />}
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-5 text-amber-300">{label}</span>
      <div className="w-32 h-3 bg-black/60 rounded overflow-hidden border border-amber-900">
        <div className={`h-full ${color} transition-all duration-200`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-amber-200/60">{value}/{max}</span>
    </div>
  );
}

function ToolbarButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-bold border rounded transition-colors ${
        active ? "bg-amber-600 border-amber-400 text-black" : "bg-black/70 border-amber-800 text-amber-300 hover:bg-amber-900/50"
      }`}
    >
      {label}
    </button>
  );
}
