import { Router, type IRouter } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, lobbiesTable, playersTable } from "@workspace/db";
import {
  CreateLobbyBody,
  CreatePlayerBody,
  DeletePlayerParams,
  GetLobbyParams,
  JoinLobbyBody,
  JoinLobbyParams,
  PublishBattleEventBody,
  PublishBattleEventParams,
  SaveTeamBody,
  SaveTeamParams,
  StartBattleParams,
} from "@workspace/api-zod";
import { POKEMON_CATALOG } from "../pokemon-catalog";
import { pokemonTypeForId } from "../pokemon-types";

const router: IRouter = Router();

const pokemon = [
  [1, "Bulbasaur", "grass", 294], [2, "Ivysaur", "grass", 405], [3, "Venusaur", "grass", 525],
  [4, "Charmander", "fire", 309], [5, "Charmeleon", "fire", 405], [6, "Charizard", "fire", 534],
  [7, "Squirtle", "water", 314], [8, "Wartortle", "water", 405], [9, "Blastoise", "water", 530],
  [25, "Pikachu", "electric", 320], [26, "Raichu", "electric", 485], [133, "Eevee", "normal", 325],
  [134, "Vaporeon", "water", 525], [135, "Jolteon", "electric", 525], [196, "Espeon", "psychic", 525],
  [448, "Lucario", "fighting", 525], [94, "Gengar", "ghost", 500], [658, "Greninja", "water", 530],
  [282, "Gardevoir", "psychic", 518], [149, "Dragonite", "dragon", 600], [150, "Mewtwo", "psychic", 680],
] as const;

let seedPromise: Promise<void> | null = null;

type PokemonCard = {
  id: number;
  name: string;
  type: string;
  hp: number;
  image: string;
};

function pokemonCard(id: number): PokemonCard {
  const featured = pokemon.find((candidate) => candidate[0] === id);
  const item = featured ?? [id, POKEMON_CATALOG[id - 1]?.[1] ?? `Pokémon ${id}`, "normal", 300 + (id % 120)] as const;
  return {
    id,
    name: item[1],
    type: pokemonTypeForId(id),
    hp: item[3],
    image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
  };
}

async function ensureSeed() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await db.select({ id: playersTable.id }).from(playersTable).limit(1);
      if (existing.length) return;
      await db.insert(playersTable).values([
        { id: "player-ash", username: "Ash Ketchum", status: "online", wins: 12, losses: 4 },
        { id: "player-misty", username: "Misty", status: "online", wins: 9, losses: 6 },
        { id: "player-brock", username: "Brock", status: "offline", wins: 7, losses: 8 },
        { id: "player-serena", username: "Serena", status: "battling", wins: 18, losses: 3 },
      ]);
    })();
  }
  await seedPromise;
}

async function player(id: string) {
  const rows = await db.select().from(playersTable).where(eq(playersTable.id, id)).limit(1);
  return rows[0] ?? null;
}

async function lobbyPayload(id: string) {
  const rows = await db.select().from(lobbiesTable).where(eq(lobbiesTable.id, id)).limit(1);
  const lobby = rows[0];
  if (!lobby) return null;
  const host = await player(lobby.hostPlayerId);
  const guest = lobby.guestPlayerId ? await player(lobby.guestPlayerId) : null;
  if (!host) return null;
  return {
    id: lobby.id,
    code: lobby.code,
    host: { id: host.id, username: host.username, status: host.status as "online" | "offline" | "battling", wins: host.wins, losses: host.losses },
    guest: guest
      ? { id: guest.id, username: guest.username, status: guest.status as "online" | "offline" | "battling", wins: guest.wins, losses: guest.losses }
      : null,
    status: lobby.status as "waiting" | "team-select" | "battle" | "complete",
    hostReady: lobby.hostReady,
    guestReady: lobby.guestReady,
    hostTeam: (lobby.hostTeam ?? []).map(pokemonCard),
    guestTeam: (lobby.guestTeam ?? []).map(pokemonCard),
    battleTurn: lobby.battleTurn,
    battleEvent: lobby.battleEvent ? JSON.parse(lobby.battleEvent) : null,
  };
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

router.get("/players", async (_req, res) => {
  await ensureSeed();
  const rows = await db.select().from(playersTable).orderBy(sql`${playersTable.createdAt} desc`);
  res.json(rows.map((p) => ({ id: p.id, username: p.username, status: p.status, wins: p.wins, losses: p.losses })));
});

router.post("/players", async (req, res) => {
  const body = CreatePlayerBody.parse(req.body);
  const created = {
    id: randomId("player"),
    username: body.username.trim(),
    status: "offline",
    wins: 0,
    losses: 0,
  } as const;
  const [row] = await db.insert(playersTable).values(created).returning();
  res.status(201).json(row);
});

router.delete("/players/:id", async (req, res) => {
  const { id } = DeletePlayerParams.parse(req.params);
  await db.delete(playersTable).where(eq(playersTable.id, id));
  res.status(204).send();
});

router.get("/lobbies", async (_req, res) => {
  await ensureSeed();
  const rows = await db.select({ id: lobbiesTable.id }).from(lobbiesTable).where(eq(lobbiesTable.status, "waiting")).orderBy(sql`${lobbiesTable.createdAt} desc`);
  const payloads = (await Promise.all(rows.map((row) => lobbyPayload(row.id)))).filter(Boolean);
  res.json(payloads);
});

router.post("/lobbies", async (req, res): Promise<void> => {
  await ensureSeed();
  const body = CreateLobbyBody.parse(req.body);
  const host = await player(body.hostPlayerId);
  if (!host) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  const id = randomId("lobby");
  const [row] = await db.insert(lobbiesTable).values({
    id,
    code: randomCode(),
    hostPlayerId: host.id,
    status: "waiting",
  }).returning();
  await db.update(playersTable).set({ status: "online" }).where(eq(playersTable.id, host.id));
  res.status(201).json(await lobbyPayload(row.id));
});

router.get("/lobbies/:id", async (req, res): Promise<void> => {
  const { id } = GetLobbyParams.parse(req.params);
  const payload = await lobbyPayload(id);
  if (!payload) {
    res.status(404).json({ error: "Lobby not found" });
    return;
  }
  res.json(payload);
});

router.post("/lobbies/:id/join", async (req, res): Promise<void> => {
  const { id } = JoinLobbyParams.parse(req.params);
  const { playerId } = JoinLobbyBody.parse(req.body);
  const lobbyRows = await db.select().from(lobbiesTable).where(eq(lobbiesTable.id, id)).limit(1);
  const lobby = lobbyRows[0];
  const joining = await player(playerId);
  if (!lobby || !joining) {
    res.status(404).json({ error: "Lobby or player not found" });
    return;
  }
  if (lobby.hostPlayerId === playerId) {
    res.status(409).json({ error: "The host is already in this lobby" });
    return;
  }
  const [joined] = await db.update(lobbiesTable)
    .set({ guestPlayerId: playerId, status: "team-select" })
    .where(and(
      eq(lobbiesTable.id, id),
      eq(lobbiesTable.status, "waiting"),
      isNull(lobbiesTable.guestPlayerId),
    ))
    .returning();
  if (!joined) {
    res.status(409).json({ error: "Lobby is already full or no longer open" });
    return;
  }
  await db.update(playersTable).set({ status: "online" }).where(eq(playersTable.id, playerId));
  res.json(await lobbyPayload(id));
});

router.post("/lobbies/:id/team", async (req, res): Promise<void> => {
  const { id } = SaveTeamParams.parse(req.params);
  const { playerId, pokemonIds } = SaveTeamBody.parse(req.body);
  const lobbyRows = await db.select().from(lobbiesTable).where(eq(lobbiesTable.id, id)).limit(1);
  const lobby = lobbyRows[0];
  if (!lobby) {
    res.status(404).json({ error: "Lobby not found" });
    return;
  }
  const isHost = lobby.hostPlayerId === playerId;
  const isGuest = lobby.guestPlayerId === playerId;
  if (!isHost && !isGuest) {
    res.status(403).json({ error: "Player is not in this lobby" });
    return;
  }
  const bothReady = isHost ? lobby.guestReady : lobby.hostReady;
  await db.update(lobbiesTable).set(isHost
    ? { hostTeam: pokemonIds, hostReady: true, status: bothReady ? "battle" : "team-select" }
    : { guestTeam: pokemonIds, guestReady: true, status: bothReady ? "battle" : "team-select" }
  ).where(eq(lobbiesTable.id, id));
  res.json(await lobbyPayload(id));
});

router.post("/lobbies/:id/start", async (req, res): Promise<void> => {
  const { id } = StartBattleParams.parse(req.params);
  const lobbyRows = await db.select().from(lobbiesTable).where(eq(lobbiesTable.id, id)).limit(1);
  const lobby = lobbyRows[0];
  if (!lobby) {
    res.status(404).json({ error: "Lobby not found" });
    return;
  }
  if (!lobby.hostReady || !lobby.guestReady) {
    res.status(409).json({ error: "Both players must be ready" });
    return;
  }
  await db.update(lobbiesTable).set({ status: "battle" }).where(eq(lobbiesTable.id, id));
  await db.update(playersTable).set({ status: "battling" }).where(and(eq(playersTable.id, lobby.hostPlayerId), eq(playersTable.status, "online")));
  if (lobby.guestPlayerId) await db.update(playersTable).set({ status: "battling" }).where(eq(playersTable.id, lobby.guestPlayerId));
  res.json(await lobbyPayload(id));
});

router.post("/lobbies/:id/event", async (req, res): Promise<void> => {
  const { id } = PublishBattleEventParams.parse(req.params);
  const body = PublishBattleEventBody.parse(req.body);
  const lobbyRows = await db.select().from(lobbiesTable).where(eq(lobbiesTable.id, id)).limit(1);
  const lobby = lobbyRows[0];
  if (!lobby) {
    res.status(404).json({ error: "Lobby not found" });
    return;
  }
  if (lobby.status !== "battle") {
    res.status(409).json({ error: "Battle has not started" });
    return;
  }
  if (lobby.hostPlayerId !== body.playerId && lobby.guestPlayerId !== body.playerId) {
    res.status(403).json({ error: "Player is not in this lobby" });
    return;
  }
  const expectedPlayerId = lobby.battleTurn % 2 === 0 ? lobby.hostPlayerId : lobby.guestPlayerId;
  if (expectedPlayerId !== body.playerId) {
    res.status(409).json({ error: "It is not this player's turn" });
    return;
  }
  const event = {
    eventId: randomId("battle-event"),
    playerId: body.playerId,
    turn: lobby.battleTurn + 1,
    moveName: body.moveName,
    moveType: body.moveType,
    moveKind: body.moveKind,
    movePower: body.movePower,
    moveDescription: body.moveDescription,
  };
  await db.update(lobbiesTable).set({
    battleTurn: event.turn,
    battleEvent: JSON.stringify(event),
  }).where(eq(lobbiesTable.id, id));
  res.json(await lobbyPayload(id));
});

router.get("/dashboard-summary", async (_req, res) => {
  await ensureSeed();
  const [players, active, ready] = await Promise.all([
    db.select({ id: playersTable.id }).from(playersTable),
    db.select({ id: lobbiesTable.id }).from(lobbiesTable).where(sql`${lobbiesTable.status} in ('waiting', 'team-select', 'battle')`),
    db.select({ id: lobbiesTable.id }).from(lobbiesTable).where(sql`${lobbiesTable.hostReady} = true or ${lobbiesTable.guestReady} = true`),
  ]);
  res.json({
    totalPlayers: players.length,
    activeLobbies: active.length,
    battlesToday: active.filter(() => false).length,
    readyTeams: ready.length,
  });
});

export default router;