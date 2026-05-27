import { PublicKey } from "@solana/web3.js";

const ENV_PROGRAM_ID =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_MEDIEVAL_LAND_PROGRAM_ID
    : undefined;

export const MEDIEVAL_LAND_PROGRAM_ID = new PublicKey(
  ENV_PROGRAM_ID && ENV_PROGRAM_ID.length >= 32
    ? ENV_PROGRAM_ID
    : "11111111111111111111111111111111"
);

export const DELEGATION_PROGRAM_ID = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
);

export const PLAYER_SEED = "player";

export function derivePlayerPDA(
  wallet: PublicKey,
  programId: PublicKey = MEDIEVAL_LAND_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_SEED), wallet.toBuffer()],
    programId
  );
}

export interface OnChainPlayerState {
  authority: PublicKey;
  displayName: string;
  x: number;
  y: number;
  direction: number;
  outfitId: number;
  score: number;
  harvestCount: number;
  buildCount: number;
  killCount: number;
  lastActive: number;
  createdAt: number;
}

export const EPHEMERAL_CONFIG = {
  delegationDuration: 0,
  commitFrequencyMs: 3000,
  maxPlayersPerSession: 50,
} as const;
