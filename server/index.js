import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { WebSocket, WebSocketServer } from "ws";
import {
  BLOCK_TYPES,
  blockKey,
  canCraft,
  canEditBlock,
  CHUNK_SIZE,
  FISH_TYPES,
  FISH_TYPE_BY_ID,
  getBaseBlockAt,
  MAX_PLANET_CHUNK_X,
  MAX_PLANET_CHUNK_Z,
  MIN_PLANET_CHUNK_X,
  MIN_PLANET_CHUNK_Z,
  MAX_STACK_SIZE,
  PLANET_MAX_X,
  PLANET_MAX_Z,
  PLANET_LATITUDE_BLOCKS,
  PLANET_LONGITUDE_BLOCKS,
  PLANET_MIN_X,
  PLANET_MIN_Z,
  RECIPES,
  WORLD_LOCATIONS,
  isNearHarbor,
  rollFishReward,
  terrainHeightAt,
  wrapPlanetX,
} from "./world.js";

const GAME_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST_DIR = resolve(GAME_DIR, "dist");
const DEFAULT_SAVE_DIRECTORY = resolve(GAME_DIR, ".data", "saves");
const MAX_PLAYER_HEALTH = 100;
const PLAYER_ATTACK_DAMAGE = 20;
const PLAYER_ATTACK_RANGE = 3.5;
const PLAYER_ATTACK_COOLDOWN_MS = 650;
const MONSTER_ATTACK_RANGE = 2;
const MONSTER_ATTACK_DAMAGE = 8;
const MONSTER_ATTACK_COOLDOWN_MS = 1400;
const MONSTER_RESPAWN_MS = 8000;
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function writeJson(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function createBots() {
  return new Map([
    ["bot-moss", { id: "bot-moss", name: "Moss", x: -4, z: -2, yaw: 0, color: "#76b86d", targetX: -4, targetZ: -2 }],
    ["bot-pebble", { id: "bot-pebble", name: "Pebble", x: 1, z: -5, yaw: 0, color: "#d3a36e", targetX: 1, targetZ: -5 }],
    ["bot-fern", { id: "bot-fern", name: "Fern", x: 8, z: 1, yaw: 0, color: "#8f8ed3", targetX: 8, targetZ: 1 }],
  ]);
}

function createMonsters() {
  return new Map([
    ["monster-crab", {
      id: "monster-crab", name: "Dune Crab", species: "crab", x: 0, z: 126, yaw: 0, color: "#e58154",
      homeX: 0, homeZ: 126, targetX: 0, targetZ: 126, health: 60, maxHealth: 60, lastAttackAt: 0, respawnAt: 0,
    }],
    ["monster-slime", {
      id: "monster-slime", name: "Moss Slime", species: "slime", x: 4, z: 210, yaw: 0, color: "#79c66f",
      homeX: 4, homeZ: 210, targetX: 4, targetZ: 210, health: 60, maxHealth: 60, lastAttackAt: 0, respawnAt: 0,
    }],
    ["monster-wisp", {
      id: "monster-wisp", name: "Highland Wisp", species: "wisp", x: 44, z: 284, yaw: 0, color: "#76cbd1",
      homeX: 44, homeZ: 284, targetX: 44, targetZ: 284, health: 60, maxHealth: 60, lastAttackAt: 0, respawnAt: 0,
    }],
  ]);
}

function serializeMonsters(room) {
  return [...room.monsters.values()]
    .filter((monster) => monster.health > 0)
    .map(({ id, name, species, x, z, yaw, color, health, maxHealth }) => ({
      id,
      name,
      species,
      x,
      z,
      yaw,
      color,
      health,
      maxHealth,
    }));
}

function validPlayerPosition(position) {
  return (
    position !== null &&
    typeof position === "object" &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.z) &&
    Number.isFinite(position.yaw) &&
    position.x >= PLANET_MIN_X &&
    position.x < PLANET_MIN_X + PLANET_LONGITUDE_BLOCKS &&
    position.z >= PLANET_MIN_Z &&
    position.z <= PLANET_MAX_Z
  );
}

function safeName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/[<>]/g, "").slice(0, 16);
  return name.length > 0 ? name : null;
}

function createInventory(mode = "survival") {
  return mode === "design" ? new Map([...BLOCK_TYPES].map((block) => [block, 1])) : new Map();
}

function addItems(inventory, item, amount) {
  const current = inventory.get(item) ?? 0;
  if (current + amount > MAX_STACK_SIZE) return false;
  inventory.set(item, current + amount);
  return true;
}

function removeItems(inventory, item, amount) {
  const remaining = (inventory.get(item) ?? 0) - amount;
  if (remaining < 0) return false;
  if (remaining === 0) inventory.delete(item);
  else inventory.set(item, remaining);
  return true;
}

function inventoryItems(inventory) {
  return [...inventory].sort(([left], [right]) => left.localeCompare(right));
}

function restoreSavedRoom(saved) {
  if (!saved || typeof saved !== "object") return null;
  const blockChanges = new Map(Array.isArray(saved.blockChanges) ? saved.blockChanges : []);
  const savedPlayers = new Map((Array.isArray(saved.players) ? saved.players : [])
    .filter((player) => typeof player.name === "string" && Array.isArray(player.inventory))
    .map((player) => [player.name.toLowerCase(), {
      ...player,
      xp: Number.isFinite(Number(player.xp)) ? Number(player.xp) : 0,
      level: Number.isFinite(Number(player.level)) ? Number(player.level) : 0,
      coins: Number.isFinite(Number(player.coins)) ? Number(player.coins) : 0,
    }]));
  return {
    id: saved.id,
    name: typeof saved.name === "string" ? saved.name : "Saved world",
    hostId: null,
    members: new Set(),
    mode: saved.mode === "design" ? "design" : "survival",
    seed: Number.isSafeInteger(saved.seed) ? saved.seed : 1,
    started: true,
    blocks: new Map(blockChanges),
    blockChanges,
    droppedItems: new Map(Array.isArray(saved.droppedItems) ? saved.droppedItems : []),
    savedPlayers,
    monsters: createMonsters(),
    saved: true,
  };
}

function loadSavedRooms(saveDirectory) {
  if (!existsSync(saveDirectory)) return [];
  const rooms = [];
  for (const filename of readdirSync(saveDirectory)) {
    const id = filename.replace(/\.json$/i, "");
    if (!/^[A-Z0-9]{6}$/.test(id) || !filename.endsWith(".json")) continue;
    try {
      const saved = JSON.parse(readFileSync(resolve(saveDirectory, filename), "utf8"));
      const room = restoreSavedRoom({ ...saved, id });
      if (room) rooms.push(room);
    } catch {
      continue;
    }
  }
  return rooms;
}

function roomSaveData(room, players) {
  const savedPlayers = new Map(room.savedPlayers ?? []);
  for (const id of room.members) {
    const player = players.get(id);
    if (!player) continue;
    savedPlayers.set(player.name.toLowerCase(), {
      name: player.name,
      x: player.x,
      z: player.z,
      yaw: player.yaw,
      inventory: inventoryItems(player.inventory),
      xp: player.xp ?? 0,
      level: player.level ?? 0,
      coins: player.coins ?? 0,
    });
  }
  room.savedPlayers = savedPlayers;
  room.saved = true;
  return {
    id: room.id,
    name: room.name,
    mode: room.mode,
    seed: room.seed,
    started: room.started,
    blockChanges: [...room.blockChanges],
    droppedItems: [...room.droppedItems],
    players: [...savedPlayers.values()],
  };
}

function persistRoom(room, players, saveDirectory) {
  mkdirSync(saveDirectory, { recursive: true });
  writeFileSync(resolve(saveDirectory, `${room.id}.json`), JSON.stringify(roomSaveData(room, players)));
}

async function initializeDatabase(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS voxland_worlds (
      id CHAR(6) PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const { rows } = await pool.query("SELECT payload FROM voxland_worlds");
  return rows.map(({ payload }) => restoreSavedRoom(payload)).filter(Boolean);
}

async function persistRoomToDatabase(room, players, pool) {
  const payload = roomSaveData(room, players);
  await pool.query(`
    INSERT INTO voxland_worlds (id, payload)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (id) DO UPDATE
    SET payload = EXCLUDED.payload, updated_at = NOW()
  `, [room.id, JSON.stringify(payload)]);
}

function staticResponse(request, response) {
  if (!existsSync(DIST_DIR)) {
    response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    response.end("Build the client first with npm run build.");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  let filePath = resolve(DIST_DIR, `.${pathname}`);
  if (!filePath.startsWith(`${DIST_DIR}${sep}`) && filePath !== DIST_DIR) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  if (pathname === "/" || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = resolve(DIST_DIR, "index.html");
  }

  if (!existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": MIME_TYPES.get(extname(filePath)) ?? "application/octet-stream",
    "cache-control": "no-cache",
  });
  response.end(readFileSync(filePath));
}

export function createGameServer({
  host = "0.0.0.0",
  port = 3001,
  seed: requestedSeed,
  saveDirectory = DEFAULT_SAVE_DIRECTORY,
  databaseUrl = process.env.DATABASE_URL,
} = {}) {
  if (process.env.RAILWAY_ENVIRONMENT && !databaseUrl) {
    throw new Error("DATABASE_URL must be set for Railway deployments.");
  }
  const configuredSeed = requestedSeed ?? process.env.WORLD_SEED;
  const seed = configuredSeed === undefined ? randomInt(0, 0x1_0000_0000) : Number(configuredSeed);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError("WORLD_SEED must be an integer between 0 and 4294967295.");
  }
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
  const players = new Map();
  const rooms = new Map(pool ? [] : loadSavedRooms(saveDirectory).map((room) => [room.id, room]));
  let databaseInitialized = false;
  const bots = createBots();
  const httpServer = createServer(staticResponse);
  const webSocketServer = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    maxPayload: 4096,
  });

  const roomSummary = (room) => ({
    id: room.id,
    name: room.name,
    players: room.members.size,
    maxPlayers: 8,
    started: room.started,
    mode: room.mode,
    saved: Boolean(room.saved),
  });

  const lobbyRooms = () => [...rooms.values()]
    .filter((room) => room.members.size < 8)
    .map(roomSummary);

  const sendLobbyRooms = () => {
    for (const player of players.values()) {
      if (!player.roomId && player.socket.readyState === WebSocket.OPEN) {
        writeJson(player.socket, { type: "room_list", rooms: lobbyRooms() });
      }
    }
  };

  const sendRoomState = (room) => {
    const message = {
      type: "room_state",
      room: roomSummary(room),
      hostId: room.hostId,
      members: [...room.members].map((id) => {
        const member = players.get(id);
        return member ? { id, name: member.name } : null;
      }).filter(Boolean),
    };
    for (const id of room.members) {
      const member = players.get(id);
      if (member?.socket.readyState === WebSocket.OPEN) writeJson(member.socket, message);
    }
  };

  const roomSnapshot = (room) => ({
    type: "snapshot",
    players: [...room.members].map((id) => players.get(id)).filter(Boolean).map(({ id, name, x, z, yaw, color, health }) => ({
      id,
      name,
      x,
      z,
      yaw,
      color,
      health,
    })),
    bots: [...bots.values()],
    monsters: serializeMonsters(room),
    drops: [...room.droppedItems.values()].map(({ id, item, count, x, z }) => ({
      id,
      item,
      count,
      x,
      z,
    })),
  });

  const broadcastToRoom = (room, message) => {
    const encoded = JSON.stringify(message);
    for (const id of room.members) {
      const member = players.get(id);
      if (member?.socket.readyState === WebSocket.OPEN) member.socket.send(encoded);
    }
  };

  const sendInitial = (player, room) => writeJson(player.socket, {
    type: "init",
    id: player.id,
    seed: room.seed,
    mode: room.mode,
    chunkSize: CHUNK_SIZE,
    players: [...room.members].map((id) => players.get(id)).filter(Boolean).map(({ id, name, x, z, yaw, color, health }) => ({
      id,
      name,
      x,
      z,
      yaw,
      color,
      health,
    })),
    bots: [...bots.values()],
    monsters: serializeMonsters(room),
    drops: [...room.droppedItems.values()].map(({ id, item, count, x, z }) => ({ id, item, count, x, z })),
    inventory: inventoryItems(player.inventory),
    health: player.health,
    xp: player.xp ?? 0,
    level: player.level ?? 0,
    coins: player.coins ?? 0,
  });

  const snapshotTimer = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      for (const [id, drop] of room.droppedItems) {
        if (drop.expiresAt <= now) room.droppedItems.delete(id);
      }
      if (room.started) broadcastToRoom(room, roomSnapshot(room));
    }
  }, 100);
  const botTimer = setInterval(() => {
    for (const bot of bots.values()) {
      const deltaX = bot.targetX - bot.x;
      const deltaZ = bot.targetZ - bot.z;
      const distance = Math.hypot(deltaX, deltaZ);

      if (distance < 0.3) {
        bot.targetX = Math.round((Math.random() * 80 - 40) * 2) / 2;
        bot.targetZ = Math.round((Math.random() * 80 - 40) * 2) / 2;
      } else {
        const step = Math.min(0.12, distance);
        bot.x += (deltaX / distance) * step;
        bot.z += (deltaZ / distance) * step;
        bot.yaw = Math.atan2(-deltaX, -deltaZ);
      }
    }
  }, 250);
  const monsterTimer = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (!room.started) continue;
      let changed = false;
      for (const monster of room.monsters.values()) {
        if (monster.health <= 0) {
          if (now < monster.respawnAt) continue;
          monster.x = monster.homeX;
          monster.z = monster.homeZ;
          monster.targetX = monster.homeX;
          monster.targetZ = monster.homeZ;
          monster.health = monster.maxHealth;
          monster.respawnAt = 0;
          changed = true;
          continue;
        }

        let closestPlayer = null;
        let closestDistance = 14;
        for (const id of room.members) {
          const candidate = players.get(id);
          if (!candidate || candidate.health <= 0) continue;
          const latitude = (monster.z - PLANET_MIN_Z + 0.5) / PLANET_LATITUDE_BLOCKS * Math.PI - Math.PI / 2;
          const east = wrapPlanetX(candidate.x - monster.x) * Math.cos(latitude);
          const north = candidate.z - monster.z;
          const distance = Math.hypot(east, north);
          if (distance < closestDistance) {
            closestPlayer = candidate;
            closestDistance = distance;
          }
        }

        if (closestPlayer && closestDistance <= MONSTER_ATTACK_RANGE) {
          if (now - monster.lastAttackAt >= MONSTER_ATTACK_COOLDOWN_MS) {
            closestPlayer.health = Math.max(0, closestPlayer.health - MONSTER_ATTACK_DAMAGE);
            monster.lastAttackAt = now;
            changed = true;
          }
          continue;
        }

        if (closestPlayer) {
          monster.targetX = closestPlayer.x;
          monster.targetZ = closestPlayer.z;
        } else if (Math.hypot(monster.targetX - monster.x, monster.targetZ - monster.z) < 0.3) {
          monster.targetX = monster.homeX + Math.round((Math.random() * 12 - 6) * 2) / 2;
          monster.targetZ = monster.homeZ + Math.round((Math.random() * 12 - 6) * 2) / 2;
        }

        const deltaX = wrapPlanetX(monster.targetX - monster.x);
        const deltaZ = monster.targetZ - monster.z;
        const distance = Math.hypot(deltaX, deltaZ);
        if (distance > 0.3) {
          const step = Math.min(closestPlayer ? 0.28 : 0.1, distance);
          monster.x = wrapPlanetX(monster.x + deltaX / distance * step);
          monster.z += deltaZ / distance * step;
          monster.yaw = Math.atan2(-deltaX, -deltaZ);
          changed = true;
        }
      }
      if (changed) broadcastToRoom(room, roomSnapshot(room));
    }
  }, 250);

  webSocketServer.on("connection", (socket) => {
    const id = randomUUID();
    const colors = ["#e58b64", "#70a8d2", "#d4bd68", "#c27db7"];
    const player = {
      id,
      name: `Guest-${id.slice(0, 4)}`,
      x: 0,
      z: 0,
      yaw: 0,
      health: MAX_PLAYER_HEALTH,
      xp: 0,
      level: 0,
      coins: 0,
      lastAttackAt: 0,
      lastFishAt: 0,
      color: colors[Math.floor(Math.random() * colors.length)],
      inventory: createInventory(),
      socket,
      roomId: null,
    };
    players.set(id, player);
    writeJson(socket, { type: "lobby", playerId: id, rooms: lobbyRooms() });

    socket.on("message", async (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        writeJson(socket, { type: "error", message: "The server could not read that message." });
        return;
      }
      if (message === null || typeof message !== "object") {
        writeJson(socket, { type: "error", message: "Unsupported message." });
        return;
      }

      if (message.type === "list_rooms") {
        writeJson(socket, { type: "room_list", rooms: lobbyRooms() });
        return;
      }

      if (message.type === "create_room") {
        if (player.roomId) {
          writeJson(socket, { type: "error", message: "Leave your current room first." });
          return;
        }
        const roomName = typeof message.roomName === "string"
          ? message.roomName.trim().replace(/[<>]/g, "").slice(0, 30)
          : "";
        let roomId = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
        while (rooms.has(roomId)) roomId = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
        const room = {
          id: roomId,
          name: roomName || `${player.name}'s World`,
          hostId: player.id,
          members: new Set([player.id]),
          mode: message.mode === "design" ? "design" : "survival",
          seed,
          started: false,
          blocks: new Map(),
          blockChanges: new Map(),
          droppedItems: new Map(),
          savedPlayers: new Map(),
          monsters: createMonsters(),
          saved: false,
        };
        rooms.set(roomId, room);
        player.roomId = roomId;
        player.inventory = createInventory(room.mode);
        writeJson(socket, { type: "room_created", room: roomSummary(room), hostId: room.hostId });
        sendRoomState(room);
        sendLobbyRooms();
        return;
      }

      if (message.type === "join_room") {
        const room = rooms.get(String(message.roomId ?? "").toUpperCase());
        if (!room || room.members.size >= 8) {
          writeJson(socket, { type: "error", message: "That room is unavailable." });
          return;
        }
        if (player.roomId) {
          writeJson(socket, { type: "error", message: "Leave your current room first." });
          return;
        }
        room.members.add(player.id);
        player.roomId = room.id;
        const savedPlayer = room.savedPlayers?.get(player.name.toLowerCase());
        player.inventory = savedPlayer
          ? new Map(savedPlayer.inventory)
          : createInventory(room.mode);
        if (savedPlayer) {
          player.x = savedPlayer.x;
          player.z = savedPlayer.z;
          player.yaw = savedPlayer.yaw;
          player.xp = Number.isFinite(Number(savedPlayer.xp)) ? Number(savedPlayer.xp) : 0;
          player.level = Number.isFinite(Number(savedPlayer.level)) ? Number(savedPlayer.level) : 0;
          player.coins = Number.isFinite(Number(savedPlayer.coins)) ? Number(savedPlayer.coins) : 0;
          player.health = Math.max(1, Math.min(MAX_PLAYER_HEALTH, savedPlayer.health ?? MAX_PLAYER_HEALTH));
        }
        if (!room.hostId) room.hostId = player.id;
        writeJson(socket, { type: "room_joined", room: roomSummary(room), hostId: room.hostId });
        sendRoomState(room);
        if (room.started) {
          sendInitial(player, room);
          broadcastToRoom(room, roomSnapshot(room));
        }
        sendLobbyRooms();
        return;
      }

      if (message.type === "leave_room") {
        const room = rooms.get(player.roomId);
        if (room) {
          room.members.delete(player.id);
          player.roomId = null;
          if (room.members.size === 0 && !room.saved) rooms.delete(room.id);
          else {
            if (room.hostId === player.id) room.hostId = room.members.values().next().value;
            sendRoomState(room);
          }
        }
        writeJson(socket, { type: "room_left" });
        sendLobbyRooms();
        return;
      }

      if (message.type === "start_room") {
        const room = rooms.get(player.roomId);
        if (!room || room.hostId !== player.id) {
          writeJson(socket, { type: "error", message: "Only the room host can start the world." });
          return;
        }
        room.started = true;
        for (const memberId of room.members) {
          const member = players.get(memberId);
          if (member) sendInitial(member, room);
        }
        broadcastToRoom(room, roomSnapshot(room));
        sendRoomState(room);
        sendLobbyRooms();
        return;
      }

      if (message.type === "save_room") {
        const room = rooms.get(player.roomId);
        if (!room?.started) {
          writeJson(socket, { type: "save_result", saved: false, message: "Start a world before saving." });
          return;
        }
        try {
          if (pool) await persistRoomToDatabase(room, players, pool);
          else persistRoom(room, players, saveDirectory);
          writeJson(socket, { type: "save_result", saved: true, message: "World saved." });
          sendLobbyRooms();
        } catch {
          writeJson(socket, { type: "save_result", saved: false, message: "World could not be saved." });
        }
        return;
      }

      if (message.type === "name") {
        const name = safeName(message.name);
        if (!name) {
          writeJson(socket, { type: "error", message: "Choose a name between 1 and 16 characters." });
          return;
        }
        player.name = name;
        const room = rooms.get(player.roomId);
        if (room) {
          sendRoomState(room);
          if (room.started) broadcastToRoom(room, roomSnapshot(room));
        }
        writeJson(socket, { type: "name_result", name });
        return;
      }

      if (message.type === "teleport") {
        const room = rooms.get(player.roomId);
        const location = room?.started
          ? WORLD_LOCATIONS.find((candidate) => candidate.id === message.locationId)
          : null;
        const target = room?.started && room.members.has(message.targetId)
          ? players.get(message.targetId)
          : null;
        if (!target && !location) {
          writeJson(socket, {
            type: "error",
            message: message.targetId ? "That player is not in your world." : "That world location is unknown.",
          });
          return;
        }
        player.x = location ? location.x : wrapPlanetX(target.x + 2);
        player.z = location ? location.z : target.z;
        player.yaw = location ? location.yaw : target.yaw;
        writeJson(socket, {
          type: "teleport_result",
          position: { x: player.x, z: player.z, yaw: player.yaw },
          targetId: target?.id ?? null,
          locationId: location?.id ?? null,
          locationName: location?.name ?? null,
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "attack") {
        const room = rooms.get(player.roomId);
        const playerTarget = room?.started && room.members.has(message.targetId)
          ? players.get(message.targetId)
          : null;
        const monsterTarget = room?.started ? room.monsters.get(message.targetId) : null;
        const target = playerTarget ?? monsterTarget;
        const now = Date.now();
        if (
          !room?.started ||
          player.health <= 0 ||
          now - player.lastAttackAt < PLAYER_ATTACK_COOLDOWN_MS
        ) {
          writeJson(socket, { type: "attack_result", hit: false });
          return;
        }
        player.lastAttackAt = now;
        if (!target || target.id === player.id || target.health <= 0) {
          writeJson(socket, { type: "attack_result", hit: false });
          return;
        }

        const latitude = (player.z - PLANET_MIN_Z + 0.5) / PLANET_LATITUDE_BLOCKS * Math.PI - Math.PI / 2;
        const east = wrapPlanetX(target.x - player.x) * Math.cos(latitude);
        const north = target.z - player.z;
        const distance = Math.hypot(east, north);
        const facing = (east * -Math.sin(player.yaw) + north * Math.cos(player.yaw)) / Math.max(distance, 0.001);
        if (distance > PLAYER_ATTACK_RANGE || facing < 0.2) {
          writeJson(socket, { type: "attack_result", hit: false, message: "No target in reach." });
          return;
        }

        target.health = Math.max(0, target.health - PLAYER_ATTACK_DAMAGE);
        if (monsterTarget && target.health === 0) target.respawnAt = now + MONSTER_RESPAWN_MS;
        writeJson(socket, {
          type: "attack_result",
          hit: true,
          targetId: target.id,
          damage: PLAYER_ATTACK_DAMAGE,
          health: target.health,
          monster: Boolean(monsterTarget),
          killed: Boolean(monsterTarget && target.health === 0),
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "fish") {
        const room = rooms.get(player.roomId);
        const now = Date.now();
        if (!room?.started || player.health <= 0) return;
        if ((player.inventory.get("fishing_rod") ?? 0) < 1) {
          writeJson(socket, { type: "fish_result", caught: false, message: "You need a fishing rod to fish." });
          return;
        }
        if (!isNearHarbor(player.x, player.z)) {
          writeJson(socket, { type: "fish_result", caught: false, message: "Go to the harbor pier to fish." });
          return;
        }
        if (now - player.lastFishAt < 2500) {
          writeJson(socket, { type: "fish_result", caught: false, message: "Give the line a moment before casting again." });
          return;
        }
        const fish = rollFishReward();
        if ((player.inventory.get(fish.id) ?? 0) >= MAX_STACK_SIZE) {
          writeJson(socket, { type: "fish_result", caught: false, message: "That fish stack is full." });
          return;
        }
        player.lastFishAt = now;
        addItems(player.inventory, fish.id, 1);
        writeJson(socket, {
          type: "fish_result",
          caught: true,
          item: fish.id,
          rarity: fish.rarity,
          value: fish.value,
          message: `You caught a ${fish.label}!`,
        });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        return;
      }

      if (message.type === "sell") {
        const room = rooms.get(player.roomId);
        if (!room?.started) return;
        const item = typeof message.item === "string" ? message.item : "";
        const count = Number(message.count);
        const fish = FISH_TYPE_BY_ID.get(item);
        if (!fish || !Number.isInteger(count) || count < 1 || !removeItems(player.inventory, item, count)) {
          writeJson(socket, { type: "error", message: "You do not have that many fish to sell." });
          return;
        }
        const payout = fish.value * count;
        player.coins = (player.coins ?? 0) + payout;
        writeJson(socket, {
          type: "sell_result",
          item,
          count,
          value: payout,
          coins: player.coins,
          message: `Sold ${count} ${fish.label} for ${payout} coins.`,
        });
        writeJson(socket, { type: "currency", coins: player.coins });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        return;
      }

      if (message.type === "respawn") {
        const room = rooms.get(player.roomId);
        if (!room?.started || player.health > 0) return;
        player.health = MAX_PLAYER_HEALTH;
        player.x = 0;
        player.z = 0;
        player.yaw = 0;
        writeJson(socket, {
          type: "respawn_result",
          position: { x: player.x, z: player.z, yaw: player.yaw },
          health: player.health,
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "move") {
        if (!rooms.get(player.roomId)?.started || player.health <= 0) return;
        if (!validPlayerPosition(message.position)) {
          writeJson(socket, { type: "error", message: "Movement was outside the world." });
          return;
        }
        player.x = message.position.x;
        player.z = message.position.z;
        player.yaw = message.position.yaw;
        const room = rooms.get(player.roomId);
        if (room) broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "chunk") {
        const room = rooms.get(player.roomId);
        if (!room?.started) return;
        const { x, z } = message;
        if (
          !Number.isSafeInteger(x) ||
          !Number.isSafeInteger(z) ||
          x < MIN_PLANET_CHUNK_X ||
          x > MAX_PLANET_CHUNK_X ||
          z < MIN_PLANET_CHUNK_Z ||
          z > MAX_PLANET_CHUNK_Z
        ) {
          writeJson(socket, { type: "error", message: "That world region is outside the supported range." });
          return;
        }
        const blockChangesInChunk = [];
        for (const [key, type] of room.blockChanges) {
          const [blockX, blockY, blockZ] = key.split(",").map(Number);
          if (Math.floor(blockX / CHUNK_SIZE) === x && Math.floor(blockZ / CHUNK_SIZE) === z) {
            blockChangesInChunk.push([[blockX, blockY, blockZ], type]);
          }
        }
        writeJson(socket, { type: "chunk", x, z, blockChanges: blockChangesInChunk });
        return;
      }

      if (message.type === "drop") {
        const room = rooms.get(player.roomId);
        if (!room?.started) return;
        const { item, count } = message;
        if (
          typeof item !== "string" ||
          !BLOCK_TYPES.has(item) ||
          !Number.isInteger(count) ||
          count < 1 ||
          count > MAX_STACK_SIZE ||
          !removeItems(player.inventory, item, count)
        ) {
          writeJson(socket, { type: "error", message: "You do not have that many items to drop." });
          return;
        }
        const dropId = randomUUID();
        room.droppedItems.set(dropId, {
          id: dropId,
          item,
          count,
          x: wrapPlanetX(player.x - Math.sin(player.yaw) * 2.2),
          z: player.z - Math.cos(player.yaw) * 2.2,
          expiresAt: Date.now() + 300_000,
        });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "pickup") {
        const room = rooms.get(player.roomId);
        if (!room?.started) return;
        let closest;
        let closestDistance = 1.8;
        for (const drop of room.droppedItems.values()) {
          const distance = Math.hypot(wrapPlanetX(drop.x - player.x), drop.z - player.z);
          if (distance < closestDistance) {
            closest = drop;
            closestDistance = distance;
          }
        }
        if (!closest) return;

        const available = MAX_STACK_SIZE - (player.inventory.get(closest.item) ?? 0);
        const amount = Math.min(available, closest.count);
        if (amount < 1) return;
        addItems(player.inventory, closest.item, amount);
        closest.count -= amount;
        if (closest.count === 0) room.droppedItems.delete(closest.id);
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "craft") {
        const recipe = RECIPES.find((candidate) => candidate.id === message.recipe);
        if (!recipe || !canCraft(player.inventory, recipe)) {
          writeJson(socket, { type: "error", message: "You do not have the materials for that recipe." });
          return;
        }
        const currentOutput = player.inventory.get(recipe.result) ?? 0;
        if (currentOutput + recipe.resultCount > MAX_STACK_SIZE) {
          writeJson(socket, { type: "error", message: "That item stack is full." });
          return;
        }
        for (const [item, amount] of Object.entries(recipe.ingredients)) {
          removeItems(player.inventory, item, amount);
        }
        addItems(player.inventory, recipe.result, recipe.resultCount);
        player.xp = (player.xp ?? 0) + 2;
        player.level = (player.level ?? 0) + 2;
        writeJson(socket, { type: "xp", xp: player.xp, level: player.level });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
        return;
      }

      if (message.type === "edit") {
        const room = rooms.get(player.roomId);
        if (!room?.started) return;
        const { action, position, block } = message;
        if (!canEditBlock(position, block, action, room.blocks, room.seed)) {
          writeJson(socket, { type: "error", message: "That block cannot be changed." });
          return;
        }
        const key = blockKey(position.x, position.y, position.z);
        const currentBlock = room.blocks.has(key)
          ? room.blocks.get(key)
          : getBaseBlockAt(position.x, position.y, position.z, room.seed);
        const changedBlock = action === "remove" ? currentBlock : block;
        if (action === "remove") {
          if ((player.inventory.get(changedBlock) ?? 0) >= MAX_STACK_SIZE) {
            writeJson(socket, { type: "error", message: "That item stack is full." });
            return;
          }
          room.blocks.set(key, null);
          addItems(player.inventory, changedBlock, 1);
        } else {
          if (room.mode !== "design" && !removeItems(player.inventory, block, 1)) {
            writeJson(socket, { type: "error", message: "You need that block in your inventory to place it." });
            return;
          }
          room.blocks.set(key, block);
        }
        room.blockChanges.set(key, action === "remove" ? null : block);
        broadcastToRoom(room, { type: "block", action, position, block: changedBlock });
        writeJson(socket, { type: "inventory", items: inventoryItems(player.inventory) });
      }
    });

    socket.on("close", () => {
      const room = rooms.get(player.roomId);
      if (room) {
        room.members.delete(player.id);
        if (room.members.size === 0 && !room.saved) rooms.delete(room.id);
        else {
          if (room.hostId === player.id) room.hostId = room.members.values().next().value;
          sendRoomState(room);
          if (room.started) broadcastToRoom(room, roomSnapshot(room));
        }
      }
      players.delete(id);
      sendLobbyRooms();
    });
  });

  return {
    rooms,
    players,
    bots,
    async listen() {
      if (pool && !databaseInitialized) {
        const savedRooms = await initializeDatabase(pool);
        for (const room of savedRooms) rooms.set(room.id, room);
        databaseInitialized = true;
      }
      return new Promise((resolveListen, rejectListen) => {
        httpServer.once("error", rejectListen);
        httpServer.listen(port, host, () => {
          httpServer.off("error", rejectListen);
          resolveListen(httpServer.address());
        });
      });
    },
    async close() {
      clearInterval(snapshotTimer);
      clearInterval(botTimer);
      clearInterval(monsterTimer);
      for (const socket of webSocketServer.clients) socket.terminate();
      await new Promise((resolveClose) => {
        webSocketServer.close(() => httpServer.close(() => resolveClose()));
      });
      await pool?.end();
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const gameServer = createGameServer({
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 3001),
  });
  const address = await gameServer.listen();
  console.log(`Voxland server listening on ${JSON.stringify(address)}`);

  const shutdown = async () => {
    await gameServer.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
