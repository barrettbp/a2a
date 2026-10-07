import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The Supabase transaction pooler (port 6543) does not support prepared statements.
 * The session pooler (port 5432) and a direct connection do.
 */
export const supportsPrepared = (url: string) => !/:6543(\/|\?|$)/.test(url);

export function createDb(url: string) {
  const sql = postgres(url, { max: 10, prepare: supportsPrepared(url) });
  return { db: drizzle(sql, { schema }), sql };
}

/** Any Drizzle Postgres database or transaction (postgres-js in prod, PGlite in tests). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;
