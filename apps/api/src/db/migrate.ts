import { migrate } from "drizzle-orm/postgres-js/migrator";
import { loadEnv } from "../env";
import { createDb } from "./client";

const env = loadEnv();
const { db, sql } = createDb(env.DATABASE_URL);
await migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
await sql.end();
console.log("migrations applied");
