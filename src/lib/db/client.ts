import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let db: PostgresJsDatabase<typeof schema> | undefined;

/** Lazily connect so `next build` works without a DATABASE_URL. */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // `prepare: false` keeps this compatible with poolers (Neon, Supabase, PgBouncer).
  const client = postgres(url, { max: 5, prepare: false });
  db = drizzle(client, { schema });
  return db;
}
