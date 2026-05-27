"use client";

import dynamic from "next/dynamic";
import { HUD } from "@/ui/components/HUD";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const GameCanvas = dynamic(() => import("@/ui/components/GameCanvas"), { ssr: false });

export default function HomePage() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-8 bg-[#0d0d0d]">
        <h1 className="text-4xl font-bold text-amber-400 tracking-widest">MEDIEVALLAND</h1>
        <p className="text-sm text-amber-200/60">A persistent on-chain survival RPG</p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div id="game-root">
      <GameCanvas />
      <HUD />
    </div>
  );
}
