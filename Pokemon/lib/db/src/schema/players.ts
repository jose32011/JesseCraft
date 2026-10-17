import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const playersTable = pgTable("pokemon_players", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  status: text("status").notNull().default("offline"),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Player = typeof playersTable.$inferSelect;