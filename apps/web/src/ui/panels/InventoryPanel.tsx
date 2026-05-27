"use client";

import type { ResourceStack } from "@medieval-land/shared";

interface Props {
  inventory: ResourceStack[];
  onClose: () => void;
}

export function InventoryPanel({ inventory, onClose }: Props) {
  return (
    <Panel title="INVENTORY" onClose={onClose} position="left-3 bottom-20">
      {inventory.length === 0 ? (
        <p className="text-amber-200/50 text-xs">Empty — gather resources in the world</p>
      ) : (
        <ul className="space-y-1">
          {inventory.map((s) => (
            <li key={s.type} className="flex justify-between text-xs">
              <span className="text-amber-300">{s.type}</span>
              <span className="text-white font-bold">x{s.amount}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Panel({ title, onClose, position, children }: {
  title: string; onClose: () => void; position: string; children: React.ReactNode;
}) {
  return (
    <div className={`absolute ${position} w-52 bg-black/90 border border-amber-800 rounded p-3 text-amber-200`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold tracking-wider">{title}</span>
        <button onClick={onClose} className="text-amber-600 hover:text-amber-300 text-xs">✕</button>
      </div>
      {children}
    </div>
  );
}
