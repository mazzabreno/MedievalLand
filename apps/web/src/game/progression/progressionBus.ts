import type { PlayerProfile } from "@/game/config/profileManager";

export type ProgressionEvent =
  | { type: "craft"; item: string; scoreGained: number }
  | { type: "harvest"; resource: string; amount: number; scoreGained: number }
  | { type: "build"; structure: string; scoreGained: number }
  | { type: "kill"; creature: string; tier: number; scoreGained: number }
  | { type: "extract"; resource: string; scoreGained: number }
  | { type: "npc-visited"; npcId: string; npcName: string; firstTime: boolean }
  | { type: "score-gained"; amount: number; reason: string }
  | { type: "achievement-unlocked"; id: string; title: string; description: string; icon: string }
  | { type: "outfit-unlocked"; outfitId: string; outfitName: string }
  | { type: "profile-updated"; profile: PlayerProfile };

export type ProgressionEventType = ProgressionEvent["type"];

type Listener<T extends ProgressionEventType = ProgressionEventType> = (
  event: Extract<ProgressionEvent, { type: T }>
) => void;

class ProgressionBus {
  private listeners: Map<ProgressionEventType | "*", Set<Listener<any>>> = new Map();

  on<T extends ProgressionEventType>(type: T, listener: Listener<T>): () => void;
  on(type: "*", listener: (event: ProgressionEvent) => void): () => void;
  on(type: ProgressionEventType | "*", listener: Listener<any>): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
    return () => this.listeners.get(type)?.delete(listener);
  }

  emit(event: ProgressionEvent): void {
    const typed = this.listeners.get(event.type);
    if (typed) for (const l of typed) { try { l(event); } catch (err) { console.error("[progressionBus]", err); } }
    const wildcard = this.listeners.get("*");
    if (wildcard) for (const l of wildcard) { try { l(event); } catch (err) { console.error("[progressionBus]", err); } }
  }
}

export const progressionBus = new ProgressionBus();
