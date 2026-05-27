"use client";

import { CRAFTING_RECIPES } from "@medieval-land/shared";
import type { ResourceStack } from "@medieval-land/shared";

interface Props {
  inventory: ResourceStack[];
  onClose: () => void;
}

export function CraftingPanel({ inventory, onClose }: Props) {
  const canAfford = (recipe: (typeof CRAFTING_RECIPES)[number]) =>
    recipe.ingredients.every((ing) => {
      const stack = inventory.find((s) => s.type === ing.resource);
      return stack && stack.amount >= ing.amount;
    });

  return (
    <div className="absolute left-3 bottom-20 w-64 bg-black/90 border border-amber-800 rounded p-3 text-amber-200 max-h-80 overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold tracking-wider">CRAFTING</span>
        <button onClick={onClose} className="text-amber-600 hover:text-amber-300 text-xs">✕</button>
      </div>
      <p className="text-xs text-amber-200/50 mb-2">* Table required for some recipes</p>
      <ul className="space-y-2">
        {CRAFTING_RECIPES.map((r) => {
          const affordable = canAfford(r);
          return (
            <li
              key={r.output}
              className={`border rounded p-2 text-xs ${affordable ? "border-amber-700 cursor-pointer hover:bg-amber-900/30" : "border-gray-800 opacity-40"}`}
            >
              <div className="font-bold text-amber-300">{r.output}</div>
              <div className="text-amber-200/70">
                {r.ingredients.map((i) => `${i.amount}x ${i.resource}`).join(", ")}
                {r.requiresCraftingTable && " ⚒"}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
