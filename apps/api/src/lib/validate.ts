import { z } from "zod";
import { errors } from "./errors";

const uuid = z.string().uuid();

/** Reject before the value reaches Postgres, where a bad uuid or bigint becomes a 500. */
export function assertUuid(v: unknown, what: string): string {
  const r = uuid.safeParse(v);
  if (!r.success) throw errors.validation(`${what} is not a valid id.`);
  return r.data;
}

export function assertCursor(v: unknown, what: string): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) {
    throw errors.validation(`${what} must be a whole number, 0 or more.`);
  }
  return v;
}

/** Postgres text cannot hold NUL. */
export function assertNoNul(v: string | undefined | null, what: string) {
  if (v && v.includes("\u0000")) throw errors.validation(`${what} contains a NUL character.`);
}
