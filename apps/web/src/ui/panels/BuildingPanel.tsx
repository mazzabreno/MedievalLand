"use client";

import type { StructureType } from "@/shared";
import { STRUCTURE_COSTS } from "@/shared";

const BUILDABLE: StructureType[] = [
  "WOODEN_FENCE", "WOODEN_WALL", "WOODEN_DOOR",
  "CAMPFIRE", "CHEST", "CRAFTING_TABLE",
];

interface Props {
  onClose: () => void;
}

export function BuildingPanel({ onClose }: Props) {
  const selectStructure = (type: StructureType) => {
    // Communicate to Phaser via custom event on window
    window.dispatchEvent(new CustomEvent("medieval:place-structure", { detail: { type } }));
    onClose();
  };

  return (
    <div className="absolute left-3 bottom-20 w-60 bg-black/90 border border-amber-800 rounded p-3 text-amber-200">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold tracking-wider">BUILD</span>
        <button onClick={onClose} className="text-amber-600 hover:text-amber-300 text-xs">✕</button>
      </div>
      <p className="text-xs text-amber-200/50 mb-2">Click to enter placement mode</p>
      <ul className="space-y-1">
        {BUILDABLE.map((type) => {
          const cost = STRUCTURE_COSTS[type];
          return (
            <li
              key={type}
              onClick={() => selectStructure(type)}
              className="flex justify-between text-xs border border-amber-900/50 rounded p-1.5 cursor-pointer hover:bg-amber-900/30"
            >
              <span className="text-amber-300">{type.replace(/_/g, " ")}</span>
              <span className="text-amber-200/70">{cost.amount}x {cost.resource}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
