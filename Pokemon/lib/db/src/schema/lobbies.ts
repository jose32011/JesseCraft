import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const lobbiesTable = pgTable("pokemon_lobbies", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  hostPlayerId: text("host_player_id").notNull(),
  guestPlayerId: text("guest_player_id"),
  status: text("status").notNull().default("waiting"),
  hostReady: boolean("host_ready").notNull().default(false),
  guestReady: boolean("guest_ready").notNull().default(false),
  hostTeam: integer("host_team").array().notNull().default([]),
  guestTeam: integer("guest_team").array().notNull().default([]),
  battleTurn: integer("battle_turn").notNull().default(0),
  battleEvent: text("battle_event"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Lobby = typeof lobbiesTable.$inferSelect;