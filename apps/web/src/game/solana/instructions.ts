import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  delegateBufferPdaFromDelegatedAccountAndOwnerProgram,
  delegationRecordPdaFromDelegatedAccount,
  delegationMetadataPdaFromDelegatedAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { MEDIEVAL_LAND_PROGRAM_ID, DELEGATION_PROGRAM_ID, derivePlayerPDA } from "./program";
import { sha256 } from "@noble/hashes/sha256";

function ixDiscriminator(name: string): Buffer {
  const preimage = `global:${name}`;
  const digest = sha256(new TextEncoder().encode(preimage));
  return Buffer.from(digest.slice(0, 8));
}

const DISC = {
  initializePlayer:      ixDiscriminator("initialize_player"),
  authorizeSession:      ixDiscriminator("authorize_session"),
  revokeSession:         ixDiscriminator("revoke_session"),
  updatePosition:        ixDiscriminator("update_position"),
  updatePositionSession: ixDiscriminator("update_position_session"),
  recordHarvest:         ixDiscriminator("record_harvest"),
  recordBuild:           ixDiscriminator("record_build"),
  recordKill:            ixDiscriminator("record_kill"),
  recordExtractSession:  ixDiscriminator("record_extract_session"),
  delegate:              ixDiscriminator("delegate"),
} as const;

function packU32LE(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value >>> 0, 0);
  return buf;
}

function packU8(value: number): Buffer {
  return Buffer.from([value & 0xff]);
}

function packString(value: string, maxLen = 20): Buffer {
  const truncated = value.slice(0, maxLen);
  const bytes = Buffer.from(truncated, "utf-8");
  const out = Buffer.alloc(4 + bytes.length);
  out.writeUInt32LE(bytes.length, 0);
  bytes.copy(out, 4);
  return out;
}

export function buildInitializePlayerIx(authority: PublicKey, displayName: string): TransactionInstruction {
  const [playerPda] = derivePlayerPDA(authority);
  return new TransactionInstruction({
    programId: MEDIEVAL_LAND_PROGRAM_ID,
    keys: [
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISC.initializePlayer, packString(displayName)]),
  });
}

export function buildAuthorizeSessionIx(authority: PublicKey, sessionKey: PublicKey): TransactionInstruction {
  const [playerPda] = derivePlayerPDA(authority);
  return new TransactionInstruction({
    programId: MEDIEVAL_LAND_PROGRAM_ID,
    keys: [
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([DISC.authorizeSession, Buffer.from(sessionKey.toBytes())]),
  });
}

export function buildRevokeSessionIx(authority: PublicKey): TransactionInstruction {
  const [playerPda] = derivePlayerPDA(authority);
  return new TransactionInstruction({
    programId: MEDIEVAL_LAND_PROGRAM_ID,
    keys: [
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: DISC.revokeSession,
  });
}

export function buildUpdatePositionSessionIx(
  playerWallet: PublicKey, sessionKey: PublicKey,
  x: number, y: number, direction: number
): TransactionInstruction {
  const [playerPda] = derivePlayerPDA(playerWallet);
  return new TransactionInstruction({
    programId: MEDIEVAL_LAND_PROGRAM_ID,
    keys: [
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: sessionKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([DISC.updatePositionSession, packU32LE(Math.max(0, Math.round(x))), packU32LE(Math.max(0, Math.round(y))), packU8(direction)]),
  });
}

export function buildRecordHarvestIx(authority: PublicKey, resourceType: number, amount: number): TransactionInstruction {
  const [playerPda] = derivePlayerPDA(authority);
  return new TransactionInstruction({
    programId: MEDIEVAL_LAND_PROGRAM_ID,
    keys: [
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([DISC.recordHarvest, packU8(resourceType), packU32LE(amount)]),
  });
}

export function buildRecordBuildIx(authority: PublicKey, structureType: number): TransactionInstruction {
  const [playerPda] = derivePlayerPDA(authority);
  return new TransactionInstruction({
    programId: MEDIEVAL_LAND_PROGRAM_ID,
    keys: [
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([DISC.recordBuild, packU8(structureType)]),
  });
}

export function buildRecordKillIx(authority: PublicKey, creatureTier: number): TransactionInstruction {
  const [playerPda] = derivePlayerPDA(authority);
  return new TransactionInstruction({
    programId: MEDIEVAL_LAND_PROGRAM_ID,
    keys: [
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([DISC.recordKill, packU8(creatureTier)]),
  });
}

export function buildDelegateIx(authority: PublicKey): TransactionInstruction {
  const [playerPda] = derivePlayerPDA(authority);
  const delegateBuffer = delegateBufferPdaFromDelegatedAccountAndOwnerProgram(playerPda, MEDIEVAL_LAND_PROGRAM_ID);
  const delegationRecord = delegationRecordPdaFromDelegatedAccount(playerPda);
  const delegationMetadata = delegationMetadataPdaFromDelegatedAccount(playerPda);
  return new TransactionInstruction({
    programId: MEDIEVAL_LAND_PROGRAM_ID,
    keys: [
      { pubkey: authority,               isSigner: true,  isWritable: true  },
      { pubkey: playerPda,               isSigner: false, isWritable: true  },
      { pubkey: MEDIEVAL_LAND_PROGRAM_ID,isSigner: false, isWritable: false },
      { pubkey: delegateBuffer,          isSigner: false, isWritable: true  },
      { pubkey: delegationRecord,        isSigner: false, isWritable: true  },
      { pubkey: delegationMetadata,      isSigner: false, isWritable: true  },
      { pubkey: DELEGATION_PROGRAM_ID,   isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISC.delegate,
  });
}

export function isProgramDeployed(): boolean {
  return MEDIEVAL_LAND_PROGRAM_ID.toBase58() !== "11111111111111111111111111111111";
}
