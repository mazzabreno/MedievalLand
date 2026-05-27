import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  ConnectionMagicRouter,
  createCommitAndUndelegateInstruction,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { SessionKeyManager } from "../solana/sessionKeys";
import {
  buildInitializePlayerIx,
  buildDelegateIx,
  buildUpdatePositionSessionIx,
  buildRecordHarvestIx,
  buildRecordBuildIx,
  buildRecordKillIx,
  isProgramDeployed,
} from "../solana/instructions";
import { derivePlayerPDA, MEDIEVAL_LAND_PROGRAM_ID } from "../solana/program";
import { transactionLog } from "../telemetry/transactionLog";

// ── Endpoints ──────────────────────────────────────────────────────────

const ENDPOINTS = {
  magicRouter:  "https://devnet-router.magicblock.app",
  ephemeral:    "https://devnet.magicblock.app",
  solanaDevnet: "https://api.devnet.solana.com",
} as const;

// Cross-tab multiplayer via BroadcastChannel — instant, zero infrastructure.
const BROADCAST_CHANNEL = "medieval-land-v1";

type BCMsg =
  | { t: "join";  w: string; x: number; y: number; d: number; m: boolean; name?: string; score?: number }
  | { t: "pos";   w: string; x: number; y: number; d: number; m: boolean }
  | { t: "chat";  w: string; text: string }
  | { t: "leave"; w: string };

const POS_THROTTLE_MS = 100;

// ── Types ──────────────────────────────────────────────────────────────

export interface OnChainPlayer {
  wallet: string;
  x: number;
  y: number;
  direction: number;
  isWalking: boolean;
  lastUpdate: number;
  displayName?: string;
  score?: number;
}

type PlayerCallback  = (wallet: string, player: OnChainPlayer) => void;
type RemoveCallback  = (wallet: string) => void;

// ── OnChainMultiplayer ─────────────────────────────────────────────────

/**
 * Multiplayer via two complementary layers:
 *
 *  Layer 1 — BroadcastChannel (always active)
 *    Cross-tab multiplayer within the same browser session.
 *    Zero infrastructure. Perfect for live demo with multiple browser tabs.
 *
 *  Layer 2 — MagicBlock Ephemeral Rollup (activates when program deployed)
 *    Real cross-browser, cross-device multiplayer.
 *    Position updates sent as transactions through Magic Router.
 *    Other clients subscribe via `accountSubscribe` on the ephemeral RPC.
 *    Discovery via `getProgramAccounts` on the ephemeral validator.
 *
 * Both layers share the same callbacks — WorldScene doesn't distinguish.
 */
export class OnChainMultiplayer {
  private routerConnection:    ConnectionMagicRouter;
  private ephemeralConnection: Connection;
  private baseConnection:      Connection;

  private sessionKeys: SessionKeyManager;
  private wallet:    PublicKey | null = null;
  private _connected = false;

  private knownPlayers = new Map<string, OnChainPlayer>();

  private addCallbacks:    PlayerCallback[] = [];
  private removeCallbacks: RemoveCallback[] = [];
  private changeCallbacks: PlayerCallback[] = [];

  private lastPosSent = 0;
  private lastPos = { x: 0, y: 0, direction: 0, isWalking: false };
  private localScore = 0;

  private bc: BroadcastChannel | null = null;
  private accountSubs = new Map<string, number>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.routerConnection    = new ConnectionMagicRouter(ENDPOINTS.magicRouter,  "confirmed");
    this.ephemeralConnection = new Connection(ENDPOINTS.ephemeral,    "confirmed");
    this.baseConnection      = new Connection(ENDPOINTS.solanaDevnet, "confirmed");
    this.sessionKeys         = new SessionKeyManager();
  }

  get connected(): boolean { return this._connected; }
  get sessionId(): string  { return this.wallet?.toBase58() ?? ""; }
  getSessionKeys(): SessionKeyManager { return this.sessionKeys; }

  // ── Connect ──────────────────────────────────────────────────────────

  async connect(walletPublicKey: PublicKey, displayName?: string): Promise<void> {
    this.wallet = walletPublicKey;
    const walletStr = walletPublicKey.toBase58();

    this._connected = true;

    this.knownPlayers.set(walletStr, {
      wallet: walletStr,
      x: 512, y: 512,
      direction: 0,
      isWalking: false,
      lastUpdate: Date.now(),
      displayName,
    });

    this.startBroadcastChannel(walletStr, displayName);

    if (isProgramDeployed()) {
      await this.startMagicBlockMultiplayer(walletPublicKey, displayName);
    } else {
      const initEntry = transactionLog.record({
        kind: "init", layer: "base",
        label: "Initialize player PDA", status: "pending",
      });
      transactionLog.markConfirmed(initEntry.id, "sim:init");

      const delEntry = transactionLog.record({
        kind: "delegate", layer: "base",
        label: "Delegate PDA → Ephemeral Rollup", status: "pending",
      });
      transactionLog.markConfirmed(delEntry.id, "sim:delegate");

      await this.sessionKeys.authorize(walletPublicKey, this.baseConnection);
    }

    this.cleanupInterval = setInterval(() => this.pruneStale(), 15_000);

    console.log(`[Multiplayer] connected as ${walletStr.slice(0, 8)}… | program=${isProgramDeployed() ? "real" : "sim"}`);
  }

  disconnect(): void {
    if (!this._connected) return;

    this.bc?.postMessage({ t: "leave", w: this.wallet?.toBase58() ?? "" } satisfies BCMsg);
    this.bc?.close();
    this.bc = null;

    for (const subId of this.accountSubs.values()) {
      this.ephemeralConnection.removeAccountChangeListener(subId).catch(() => {});
    }
    this.accountSubs.clear();

    if (this.cleanupInterval) { clearInterval(this.cleanupInterval); this.cleanupInterval = null; }

    if (isProgramDeployed() && this.wallet) {
      this.commitAndUndelegatePlayer(this.wallet).catch(() => {});
    } else {
      const entry = transactionLog.record({
        kind: "undelegate", layer: "base",
        label: "Commit & undelegate session", status: "pending",
      });
      transactionLog.markConfirmed(entry.id, "sim:undelegate");
    }

    this._connected = false;
    this.sessionKeys.revoke(this.routerConnection);
    this.knownPlayers.clear();
  }

  // ── Send input ────────────────────────────────────────────────────────

  sendInput(x: number, y: number, direction: string, isWalking: boolean): void {
    if (!this._connected || !this.wallet) return;

    const roundX = Math.round(x);
    const roundY = Math.round(y);
    const dirNum = ({ down: 0, left: 1, right: 2, up: 3 } as Record<string, number>)[direction] ?? 0;

    if (
      roundX === this.lastPos.x &&
      roundY === this.lastPos.y &&
      dirNum === this.lastPos.direction &&
      isWalking === this.lastPos.isWalking
    ) return;

    const now = Date.now();
    if (now - this.lastPosSent < POS_THROTTLE_MS) return;
    this.lastPosSent = now;

    this.lastPos = { x: roundX, y: roundY, direction: dirNum, isWalking };

    const walletStr = this.wallet.toBase58();
    const local = this.knownPlayers.get(walletStr);
    if (local) {
      local.x = roundX; local.y = roundY;
      local.direction = dirNum; local.isWalking = isWalking;
      local.lastUpdate = now;
    }

    this.bc?.postMessage({
      t: "pos", w: walletStr,
      x: roundX, y: roundY,
      d: dirNum, m: isWalking,
    } satisfies BCMsg);

    if (isProgramDeployed()) {
      const entry = transactionLog.recordMove({ status: "pending" });
      this.sendPositionTransaction(x, y, dirNum)
        .then(sig => { if (sig) transactionLog.markConfirmed(entry.id, sig); })
        .catch(err => transactionLog.markFailed(entry.id, err?.message ?? "tx failed"));
    } else {
      transactionLog.recordMove({ signature: "sim:move", status: "confirmed" });
    }
  }

  sendChat(text: string): void {
    if (!this.wallet) return;
    this.bc?.postMessage({ t: "chat", w: this.wallet.toBase58(), text } satisfies BCMsg);
  }

  /**
   * Records a harvest / build / kill action to the base layer.
   * Main wallet signs (one popup per action — acceptable since these are rare).
   * Falls back to no-op in simulation mode.
   */
  async recordAction(kind: "harvest" | "build" | "kill", value = 1): Promise<void> {
    if (!this.wallet || !isProgramDeployed()) return;

    const label = kind === "harvest" ? "Record harvest" : kind === "build" ? "Record build" : "Record kill";
    const logKind = kind as any;
    const entry = transactionLog.record({ kind: logKind, layer: "base", label, status: "pending" });

    try {
      const ix =
        kind === "harvest" ? buildRecordHarvestIx(this.wallet, 0, value) :
        kind === "build"   ? buildRecordBuildIx(this.wallet, value) :
                             buildRecordKillIx(this.wallet, value);

      const { blockhash } = await this.baseConnection.getLatestBlockhash();
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: this.wallet,
      }).add(ix);

      const sig = await this.requestWalletSign(tx);
      await this.baseConnection.confirmTransaction(sig, "confirmed");
      transactionLog.markConfirmed(entry.id, sig);
    } catch (err: any) {
      transactionLog.markFailed(entry.id, err?.message ?? "record failed");
    }
  }

  onPlayerAdd(cb: PlayerCallback):    void { this.addCallbacks.push(cb); }
  onPlayerRemove(cb: RemoveCallback): void { this.removeCallbacks.push(cb); }
  onPlayerChange(cb: PlayerCallback): void { this.changeCallbacks.push(cb); }

  getActivePlayers(): OnChainPlayer[] {
    return Array.from(this.knownPlayers.values());
  }

  updateScore(score: number): void {
    this.localScore = score;
    const walletStr = this.wallet?.toBase58();
    if (walletStr) {
      const local = this.knownPlayers.get(walletStr);
      if (local) local.score = score;
    }
  }

  // ── Layer 1: BroadcastChannel ─────────────────────────────────────────

  private startBroadcastChannel(walletStr: string, displayName?: string): void {
    if (typeof BroadcastChannel === "undefined") return;

    this.bc = new BroadcastChannel(BROADCAST_CHANNEL);
    this.bc.onmessage = (event: MessageEvent<BCMsg>) => {
      const msg = event.data;
      if (!msg?.t || !msg?.w) return;
      if (msg.w === walletStr) return;

      switch (msg.t) {
        case "join":
          this.handlePlayerJoin(msg.w, msg.x, msg.y, msg.d, msg.m, msg.name, msg.score);
          this.bc?.postMessage({
            t: "join",
            w: walletStr,
            x: this.lastPos.x || 512,
            y: this.lastPos.y || 512,
            d: this.lastPos.direction,
            m: this.lastPos.isWalking,
            name: displayName,
            score: this.localScore,
          } satisfies BCMsg);
          break;
        case "pos":
          this.handlePlayerMove(msg.w, msg.x, msg.y, msg.d, msg.m);
          break;
        case "leave":
          this.handlePlayerLeave(msg.w);
          break;
      }
    };

    this.bc.postMessage({
      t: "join",
      w: walletStr,
      x: 512, y: 512, d: 0, m: false,
      name: displayName,
      score: this.localScore,
    } satisfies BCMsg);

    window.addEventListener("beforeunload", () => {
      this.bc?.postMessage({ t: "leave", w: walletStr } satisfies BCMsg);
    });
  }

  // ── Layer 2: MagicBlock Ephemeral Rollup ──────────────────────────────

  private async startMagicBlockMultiplayer(wallet: PublicKey, displayName?: string): Promise<void> {
    const walletStr = wallet.toBase58();
    const [playerPDA] = derivePlayerPDA(wallet);

    await this.initializePlayerPDA(wallet, displayName ?? walletStr.slice(0, 8));

    let isDelegated = false;
    try {
      const status = await this.routerConnection.getDelegationStatus(playerPDA);
      isDelegated = status.isDelegated;
    } catch {
      // getDelegationStatus may fail on new endpoints — assume not delegated
    }

    if (!isDelegated) {
      await this.sessionKeys.authorize(wallet, this.baseConnection);
      await this.delegateToEphemeral(wallet);
    } else {
      await this.sessionKeys.authorize(wallet, this.routerConnection);
      console.log("[Multiplayer] account already delegated, re-authorized session key via MR");
    }

    await this.discoverPlayers(wallet);

    try {
      this.ephemeralConnection.onProgramAccountChange(
        MEDIEVAL_LAND_PROGRAM_ID,
        (keyedInfo) => {
          this.decodeAndUpdatePlayer(keyedInfo.accountId.toBase58(), keyedInfo.accountInfo.data);
        },
        "processed",
      );
    } catch (err) {
      console.warn("[Multiplayer] program subscription failed:", err);
    }

    this.lastPos = { x: -1, y: -1, direction: -1, isWalking: false };
  }

  private async initializePlayerPDA(wallet: PublicKey, displayName: string): Promise<void> {
    const [pda] = derivePlayerPDA(wallet);
    const existing = await this.baseConnection.getAccountInfo(pda);
    if (existing) return;

    const entry = transactionLog.record({
      kind: "init", layer: "base",
      label: "Initialize player PDA", status: "pending",
    });

    try {
      const ix = buildInitializePlayerIx(wallet, displayName.slice(0, 20));
      const { blockhash } = await this.baseConnection.getLatestBlockhash();
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: wallet }).add(ix);

      const sig = await this.requestWalletSign(tx);
      await this.baseConnection.confirmTransaction(sig, "confirmed");
      transactionLog.markConfirmed(entry.id, sig);
    } catch (err: any) {
      console.error("[Multiplayer] PDA init failed:", err);
      transactionLog.markFailed(entry.id, err?.message ?? "init failed");
      throw err;
    }
  }

  private async delegateToEphemeral(wallet: PublicKey): Promise<void> {
    const entry = transactionLog.record({
      kind: "delegate", layer: "base",
      label: "Delegate PDA → Ephemeral Rollup", status: "pending",
    });
    try {
      const ix = buildDelegateIx(wallet);
      const { blockhash } = await this.baseConnection.getLatestBlockhash();
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: wallet }).add(ix);

      const sig = await this.requestWalletSign(tx);
      await this.baseConnection.confirmTransaction(sig, "confirmed");
      transactionLog.markConfirmed(entry.id, sig);
      console.log("[Multiplayer] PDA delegated to ephemeral rollup:", sig.slice(0, 12));
    } catch (err: any) {
      console.error("[Multiplayer] delegate failed:", err);
      transactionLog.markFailed(entry.id, err?.message ?? "delegate failed");
      // Non-fatal: fall back to BroadcastChannel layer
    }
  }

  private async commitAndUndelegatePlayer(wallet: PublicKey): Promise<void> {
    const entry = transactionLog.record({
      kind: "undelegate", layer: "base",
      label: "Commit & undelegate session", status: "pending",
    });
    try {
      const [playerPDA] = derivePlayerPDA(wallet);
      const sessionKey = this.sessionKeys.getSessionPublicKey();

      const ix = createCommitAndUndelegateInstruction(sessionKey, [playerPDA]);
      const { blockhash } = await this.ephemeralConnection.getLatestBlockhash();
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: sessionKey }).add(ix);

      this.sessionKeys.signTransaction(tx);
      const sig = await this.ephemeralConnection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
      });
      transactionLog.markConfirmed(entry.id, sig);
      console.log("[Multiplayer] committed & undelegated:", sig.slice(0, 12));
    } catch (err: any) {
      transactionLog.markFailed(entry.id, err?.message ?? "undelegate failed");
    }
  }

  private async discoverPlayers(self: PublicKey): Promise<void> {
    try {
      const accounts = await this.ephemeralConnection.getProgramAccounts(
        MEDIEVAL_LAND_PROGRAM_ID,
        { commitment: "processed", encoding: "base64" }
      );

      for (const { pubkey, account } of accounts) {
        const data = account.data;
        const walletStr = pubkey.toBase58();
        if (walletStr === self.toBase58()) continue;
        this.decodeAndUpdatePlayer(walletStr, data);
        this.subscribeToPlayer(pubkey);
      }
    } catch (err) {
      console.info("[Multiplayer] discovery unavailable, relying on broadcast");
    }
  }

  private subscribeToPlayer(playerPDA: PublicKey): void {
    const key = playerPDA.toBase58();
    if (this.accountSubs.has(key)) return;

    const subId = this.ephemeralConnection.onAccountChange(
      playerPDA,
      (accountInfo) => {
        this.decodeAndUpdatePlayer(key, accountInfo.data);
      },
      "processed"
    );
    this.accountSubs.set(key, subId);
  }

  // ── Account data decoder ──────────────────────────────────────────────

  /**
   * Decodes a raw PlayerState account buffer (without pulling in Anchor).
   *
   * Layout (little-endian) after the 8-byte discriminator:
   *   [32]  authority         Pubkey
   *   [33]  session_authority Option<Pubkey>
   *   [4+n] display_name      String (max 20)
   *   [4]   x                 u32
   *   [4]   y                 u32
   *   [1]   direction         u8
   *   [1]   outfit_id         u8
   *   [4]   score             u32
   *   [2]   harvest_count     u16
   *   [2]   build_count       u16
   *   [2]   kill_count        u16
   *   [8]   last_active       i64
   *   [8]   created_at        i64
   */
  private decodeAndUpdatePlayer(pda: string, data: Buffer | Uint8Array): void {
    try {
      const buf = Buffer.from(data);
      if (buf.length < 83) return;

      let offset = 8; // skip 8-byte Anchor discriminator

      const authority = new PublicKey(buf.slice(offset, offset + 32));
      const walletStr = authority.toBase58();
      offset += 32;

      const hasSession = buf.readUInt8(offset) === 1;
      offset += 1 + (hasSession ? 32 : 0);

      const nameLen = Math.min(buf.readUInt32LE(offset), 20);
      offset += 4;
      const displayName = buf.slice(offset, offset + nameLen).toString("utf-8");
      offset += nameLen;

      const x = buf.readUInt32LE(offset); offset += 4;
      const y = buf.readUInt32LE(offset); offset += 4;
      const direction = buf.readUInt8(offset); offset += 1;

      // Skip outfit_id, score, harvest_count, build_count, kill_count
      offset += 1 + 4 + 2 + 2 + 2;

      if (walletStr === this.wallet?.toBase58()) return;

      const existing = this.knownPlayers.get(walletStr);
      const isWalking = existing !== undefined && (x !== existing.x || y !== existing.y);
      this.handlePlayerMove(walletStr, x, y, direction, isWalking, displayName);
    } catch {
      // Corrupt or unrecognized account — skip silently
    }
  }

  // ── Position transaction (Magic Router) ──────────────────────────────

  private async sendPositionTransaction(x: number, y: number, direction: number): Promise<string | null> {
    if (!this.wallet) return null;

    const sessionKey = this.sessionKeys.getSessionPublicKey();
    const ix = buildUpdatePositionSessionIx(
      this.wallet, sessionKey,
      Math.round(x), Math.round(y), direction
    );

    const tx = new Transaction().add(ix);
    tx.feePayer = sessionKey;

    const { blockhash } = await this.routerConnection.getLatestBlockhashForTransaction(tx);
    tx.recentBlockhash = blockhash;
    this.sessionKeys.signTransaction(tx);

    return this.routerConnection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      preflightCommitment: "processed",
    });
  }

  // ── Wallet signing bridge ─────────────────────────────────────────────

  private requestWalletSign(tx: Transaction): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("wallet sign timeout")), 60_000);

      const bus = (globalThis as any).__medievalLandGameEvents as Phaser.Events.EventEmitter | undefined;
      if (!bus) {
        clearTimeout(timeout);
        resolve("sim:no-bus");
        return;
      }

      bus.once("wallet:signedTx", (sig: string) => {
        clearTimeout(timeout);
        resolve(sig);
      });
      bus.once("wallet:signError", (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
      bus.emit("wallet:needSign", tx);
    });
  }

  // ── Player state machine ──────────────────────────────────────────────

  private handlePlayerJoin(
    wallet: string, x: number, y: number, d: number, m: boolean, name?: string, score?: number
  ): void {
    if (this.knownPlayers.has(wallet)) {
      this.handlePlayerMove(wallet, x, y, d, m, name, score);
      return;
    }
    const player: OnChainPlayer = {
      wallet, x, y, direction: d, isWalking: m,
      lastUpdate: Date.now(), displayName: name, score,
    };
    this.knownPlayers.set(wallet, player);
    for (const cb of this.addCallbacks) cb(wallet, player);
  }

  private handlePlayerMove(
    wallet: string, x: number, y: number, d: number, m: boolean, name?: string, score?: number
  ): void {
    let player = this.knownPlayers.get(wallet);
    if (!player) {
      player = { wallet, x, y, direction: d, isWalking: m, lastUpdate: Date.now(), displayName: name, score };
      this.knownPlayers.set(wallet, player);
      for (const cb of this.addCallbacks) cb(wallet, player);
      return;
    }
    player.x = x; player.y = y; player.direction = d; player.isWalking = m;
    player.lastUpdate = Date.now();
    if (name) player.displayName = name;
    if (score !== undefined) player.score = score;
    for (const cb of this.changeCallbacks) cb(wallet, player);
  }

  private handlePlayerLeave(wallet: string): void {
    if (!this.knownPlayers.has(wallet)) return;
    this.knownPlayers.delete(wallet);
    for (const cb of this.removeCallbacks) cb(wallet);
  }

  private pruneStale(): void {
    const cutoff = Date.now() - 20_000;
    for (const [wallet, player] of this.knownPlayers) {
      if (wallet === this.wallet?.toBase58()) continue;
      if (player.lastUpdate < cutoff) this.handlePlayerLeave(wallet);
    }
  }
}
