import { Keypair, PublicKey, Transaction, Connection } from "@solana/web3.js";
import { buildAuthorizeSessionIx, buildRevokeSessionIx, isProgramDeployed } from "./instructions";

const STORAGE_KEY = "medieval-land-session-key";

export class SessionKeyManager {
  private sessionKey: Keypair;
  private mainWallet: PublicKey | null = null;
  private authorized = false;

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const bytes = Uint8Array.from(JSON.parse(stored));
        this.sessionKey = Keypair.fromSecretKey(bytes);
      } catch {
        this.sessionKey = Keypair.generate();
      }
    } else {
      this.sessionKey = Keypair.generate();
    }
    this.persist();
  }

  getSessionKey(): Keypair        { return this.sessionKey; }
  getSessionPublicKey(): PublicKey { return this.sessionKey.publicKey; }
  isAuthorized(): boolean          { return this.authorized; }
  getMainWallet(): PublicKey | null { return this.mainWallet; }

  async authorize(walletPublicKey: PublicKey, connection: Connection): Promise<void> {
    this.mainWallet = walletPublicKey;

    if (!isProgramDeployed()) {
      this.authorized = true;
      console.log(`[SessionKey] sim-authorized ${this.sessionKey.publicKey.toBase58().slice(0, 8)}...`);
      return;
    }

    try {
      const ix = buildAuthorizeSessionIx(walletPublicKey, this.sessionKey.publicKey);
      const { blockhash } = await connection.getLatestBlockhash();
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: walletPublicKey }).add(ix);
      const sig = await this.requestWalletSign(tx);
      await connection.confirmTransaction(sig, "confirmed");
      this.authorized = true;
    } catch (err: any) {
      this.authorized = true;
      console.warn("[SessionKey] on-chain authorize failed, using local auth:", err?.message);
    }
  }

  signTransaction(tx: Transaction): Transaction {
    tx.partialSign(this.sessionKey);
    return tx;
  }

  async revoke(connection?: Connection): Promise<void> {
    this.authorized = false;
    if (isProgramDeployed() && this.mainWallet && connection) {
      try {
        const ix = buildRevokeSessionIx(this.mainWallet);
        const { blockhash } = await connection.getLatestBlockhash();
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: this.mainWallet }).add(ix);
        this.requestWalletSign(tx).catch(() => {});
      } catch {}
    }
    this.mainWallet = null;
    localStorage.removeItem(STORAGE_KEY);
    this.sessionKey = Keypair.generate();
    this.persist();
  }

  private requestWalletSign(tx: Transaction): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("wallet sign timeout")), 60_000);
      const bus = (globalThis as any).__medievalLandGameEvents as
        | { once: (e: string, cb: (...a: any[]) => void) => void; emit: (e: string, ...a: any[]) => void }
        | undefined;
      if (!bus) { clearTimeout(timeout); resolve("sim:no-bus"); return; }
      bus.once("wallet:signedTx", (sig: string) => { clearTimeout(timeout); resolve(sig); });
      bus.once("wallet:signError", (err: Error) => { clearTimeout(timeout); reject(err); });
      bus.emit("wallet:needSign", tx);
    });
  }

  private persist(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.sessionKey.secretKey))); } catch {}
  }
}
