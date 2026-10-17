import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePGlite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import path from "node:path";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;
const schemaSql = `
  CREATE TABLE IF NOT EXISTS pokemon_players (
    id text PRIMARY KEY,
    username text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'offline',
    wins integer NOT NULL DEFAULT 0,
    losses integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS pokemon_lobbies (
    id text PRIMARY KEY,
    code text NOT NULL UNIQUE,
    host_player_id text NOT NULL,
    guest_player_id text,
    status text NOT NULL DEFAULT 'waiting',
    host_ready boolean NOT NULL DEFAULT false,
    guest_ready boolean NOT NULL DEFAULT false,
    host_team integer[] NOT NULL DEFAULT '{}',
    guest_team integer[] NOT NULL DEFAULT '{}',
    battle_turn integer NOT NULL DEFAULT 0,
    battle_event text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`;

const database = process.env.DATABASE_URL
  ? (() => {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      return {
        db: drizzlePostgres(pool, { schema }),
        initialize: async () => {
          await pool.query(schemaSql);
        },
        close: () => pool.end(),
      };
    })()
  : (() => {
      const embedded = new PGlite(
        process.env.POKEMON_DATA_DIR ??
          path.resolve(process.cwd(), ".data/pokemon-arena"),
      );
      return {
        db: drizzlePGlite(embedded, { schema }),
        initialize: () => embedded.exec(schemaSql),
        close: () => embedded.close(),
      };
    })();

export const db = database.db;
export const initializeDatabase = database.initialize;
export const closeDatabase = database.close;

export * from "./schema";
