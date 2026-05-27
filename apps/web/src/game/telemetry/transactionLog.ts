export type TxKind =
  | "move" | "harvest" | "build" | "craft" | "init"
  | "delegate" | "commit" | "undelegate" | "system";

export type TxLayer = "base" | "ephemeral" | "local";
export type TxStatus = "pending" | "confirmed" | "failed";

export interface TxEntry {
  id: string;
  kind: TxKind;
  layer: TxLayer;
  status: TxStatus;
  label: string;
  signature?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  batchCount?: number;
  batchSpanMs?: number;
}

type Listener = (entries: ReadonlyArray<TxEntry>) => void;

const MAX_ENTRIES = 200;
const MOVE_COALESCE_WINDOW_MS = 1500;

class TransactionLogService {
  private entries: TxEntry[] = [];
  private listeners = new Set<Listener>();
  private nextId = 1;
  private currentMoveBatch: TxEntry | null = null;

  recordMove(params: { signature?: string; status?: TxStatus }): TxEntry {
    const now = Date.now();
    const { signature, status = "confirmed" } = params;

    if (this.currentMoveBatch && now - this.currentMoveBatch.updatedAt < MOVE_COALESCE_WINDOW_MS) {
      const batch = this.currentMoveBatch;
      batch.batchCount = (batch.batchCount ?? 1) + 1;
      batch.batchSpanMs = now - batch.createdAt;
      batch.updatedAt = now;
      if (signature) batch.signature = signature;
      batch.label = this.moveBatchLabel(batch);
      batch.status = status;
      this.notify();
      return batch;
    }

    const entry: TxEntry = {
      id: this.mintId(), kind: "move", layer: "ephemeral", status,
      label: "Position update", signature, createdAt: now, updatedAt: now,
      batchCount: 1, batchSpanMs: 0,
    };
    entry.label = this.moveBatchLabel(entry);
    this.currentMoveBatch = entry;
    this.push(entry);
    return entry;
  }

  record(params: { kind: Exclude<TxKind, "move">; layer: TxLayer; label: string; status?: TxStatus; signature?: string }): TxEntry {
    const now = Date.now();
    const entry: TxEntry = {
      id: this.mintId(), kind: params.kind, layer: params.layer, label: params.label,
      status: params.status ?? "pending", signature: params.signature, createdAt: now, updatedAt: now,
    };
    this.currentMoveBatch = null;
    this.push(entry);
    return entry;
  }

  markConfirmed(id: string, signature: string): void {
    const e = this.entries.find((e) => e.id === id);
    if (!e) return;
    e.status = "confirmed"; e.signature = signature; e.updatedAt = Date.now();
    this.notify();
  }

  markFailed(id: string, error: string): void {
    const e = this.entries.find((e) => e.id === id);
    if (!e) return;
    e.status = "failed"; e.error = error; e.updatedAt = Date.now();
    this.notify();
  }

  getAll(): ReadonlyArray<TxEntry> { return this.entries; }
  clear(): void { this.entries = []; this.currentMoveBatch = null; this.notify(); }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.entries);
    return () => this.listeners.delete(listener);
  }

  private push(entry: TxEntry): void {
    this.entries.unshift(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES;
    this.notify();
  }

  private notify(): void {
    const snapshot = this.entries.slice();
    for (const l of this.listeners) { try { l(snapshot); } catch (err) { console.error("[TransactionLog]", err); } }
  }

  private mintId(): string { return `tx-${Date.now().toString(36)}-${(this.nextId++).toString(36)}`; }
  private moveBatchLabel(e: TxEntry): string {
    const count = e.batchCount ?? 1;
    if (count <= 1) return "Position update";
    const span = e.batchSpanMs ?? 0;
    return span < 1000 ? `${count} moves` : `${count} moves in ${(span / 1000).toFixed(1)}s`;
  }
}

export const transactionLog = new TransactionLogService();

export function getExplorerUrl(entry: TxEntry): string | null {
  if (!entry.signature) return null;
  if (entry.layer === "ephemeral") return `https://explorer.magicblock.app/?cluster=devnet.magicblock.app&tx=${entry.signature}`;
  if (entry.layer === "base") return `https://explorer.solana.com/tx/${entry.signature}?cluster=devnet`;
  return null;
}
