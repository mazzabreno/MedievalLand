"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { NPCDefinition, NPCAction } from "@/game/config/npcRegistry";
import { usePinchZoom } from "@/ui/usePinchZoom";

// All Solana/wallet-adapter code must be client-only
const SolanaProvider     = dynamic(() => import("@/ui/SolanaProvider"),     { ssr: false });
const PhaserGame         = dynamic(() => import("@/game/PhaserGame"),        { ssr: false });
const WalletBar          = dynamic(() => import("@/ui/WalletBar"),           { ssr: false });
const ChatPanel          = dynamic(() => import("@/ui/ChatPanel"),           { ssr: false });
const NPCDialog          = dynamic(() => import("@/ui/NPCDialog"),           { ssr: false });
const ToastStack         = dynamic(() => import("@/ui/ToastStack"),          { ssr: false });
const HUD                = dynamic(() => import("@/ui/HUD"),                 { ssr: false });
const WalletSignBridge   = dynamic(() => import("@/ui/WalletSignBridge"),    { ssr: false });
const MobileControls     = dynamic(() => import("@/ui/MobileControls"),      { ssr: false });
const ZoomControl        = dynamic(() => import("@/ui/ZoomControl"),         { ssr: false });
const InventoryHUD       = dynamic(() => import("@/ui/InventoryHUD"),        { ssr: false });
const BuildToolbar       = dynamic(() => import("@/ui/BuildToolbar"),        { ssr: false });

import ErrorBoundary from "@/ui/ErrorBoundary";

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setIsTouch(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isTouch;
}

export default function Home() {
  const [game, setGame] = useState<Phaser.Game | null>(null);
  const isTouch = useIsTouch();
  const [activeNPC, setActiveNPC] = useState<NPCDefinition | null>(null);
  const [chatOpen, setChatOpen] = useState(() =>
    typeof window === "undefined"
      ? true
      : !window.matchMedia("(pointer: coarse)").matches
  );

  usePinchZoom();

  useEffect(() => {
    if (!game) return;
    const handler = (npc: NPCDefinition) => setActiveNPC(npc);
    game.events.on("npc:interact", handler);
    return () => { game.events.off("npc:interact", handler); };
  }, [game]);

  const handleDialogClose = useCallback(() => {
    setActiveNPC(null);
    game?.events.emit("npc:close");
  }, [game]);

  const handleAction = useCallback((action: NPCAction) => {
    setActiveNPC(null);
    if (action.type === "placeholder") {
      game?.events.emit("npc:close");
      return;
    }
    if (action.type === "link") {
      if (action.url) window.open(action.url, "_blank", "noopener,noreferrer");
      game?.events.emit("npc:close");
      return;
    }
    if (action.type === "tutor" || action.type === "vault" || action.type === "craft") {
      game?.events.emit("npc:close");
      return;
    }
    game?.events.emit("npc:close");
  }, [game]);

  const handleWalletChange = useCallback((wallet: string | null) => {
    if (!game) return;
    if (wallet) {
      game.events.emit("wallet:connected", wallet);
    } else {
      game.events.emit("wallet:disconnected");
    }
  }, [game]);

  return (
    <ErrorBoundary>
      <SolanaProvider>
        {/* Headless bridge so Phaser can request wallet signatures */}
        <WalletSignBridge />
        <main className="w-screen h-screen relative">
          <PhaserGame onGameReady={setGame} />

          {/* Score HUD — top left */}
          <HUD />

          {/* Top-right cluster: wallet + zoom */}
          <div
            className="fixed z-20 flex flex-col items-end gap-2"
            style={{
              top: "max(env(safe-area-inset-top, 0px), 12px)",
              right: "max(env(safe-area-inset-right, 0px), 12px)",
            }}
          >
            <PfpButton gameRef={game} />
            <WalletBar onWalletChange={handleWalletChange} />
            {!isTouch && <ZoomControl />}
          </div>

          <ToastStack />
          <InventoryHUD />
          <BuildToolbar gameRef={game} />
          <MobileControls gameRef={game} chatOpen={chatOpen} onChatToggle={() => setChatOpen((v) => !v)} />
          <ChatPanel gameRef={game} visible={chatOpen} />
          <NPCDialog npc={activeNPC} onClose={handleDialogClose} onAction={handleAction} />
        </main>
      </SolanaProvider>
    </ErrorBoundary>
  );
}

function PfpButton({ gameRef }: { gameRef: Phaser.Game | null }) {
  const [initial, setInitial] = useState("A");

  useEffect(() => {
    if (!gameRef) return;
    const check = setInterval(() => {
      const scene = gameRef.scene.getScene("WorldScene");
      if (scene) {
        const pm = scene.registry.get("profileManager") as any;
        if (pm) {
          const p = pm.get();
          setInitial(p.displayName[0]?.toUpperCase() ?? "A");
          pm.onChange((prof: any) => {
            setInitial(prof.displayName[0]?.toUpperCase() ?? "A");
          });
          clearInterval(check);
        }
      }
    }, 200);
    return () => clearInterval(check);
  }, [gameRef]);

  return (
    <div
      className="rounded-full"
      style={{
        width: 48, height: 48,
        border: "2px solid #9945FF",
        background: "rgba(153,69,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      title="Adventurer"
    >
      <span style={{ color: "#9945FF", fontSize: "18px", fontWeight: "bold" }}>{initial}</span>
    </div>
  );
}
