import { createHash, randomBytes } from "node:crypto";

export type TokenPrefix = "own" | "agt" | "inv";

/** 32 random bytes, base64url, with a recognisable prefix. Plaintext is shown once. */
export function generateToken(prefix: TokenPrefix): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

/** 'r_' + 10 chars base32. Shareable, not secret. */
export function generateRoomId(): string {
  const bytes = randomBytes(10);
  let out = "r_";
  for (const b of bytes) out += BASE32[b % 32];
  return out;
}
