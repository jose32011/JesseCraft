import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt, randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import {
  BLOCK_TYPES,
  blockKey,
  canCraft,
  canEditBlock,
  CHUNK_SIZE,
  getBaseBlockAt,
  MAX_PLANET_CHUNK_X,
  MAX_PLANET_CHUNK_Z,
  MIN_PLANET_CHUNK_X,
  MIN_PLANET_CHUNK_Z,
  MAX_STACK_SIZE,
  PLANET_MAX_X,
  PLANET_MAX_Z,
  PLANET_LONGITUDE_BLOCKS,
  PLANET_MIN_X,
  PLANET_MIN_Z,
  RECIPES,
  terrainHeightAt,
  wrapPlanetX,
} from "./world.js";

const GAME_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST_DIR = resolve(GAME_DIR, "dist");
const DEFAULT_SAVE_DIRECTORY = resolve(GAME_DIR, ".data", "saves");
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

function loadSavedRooms(saveDirectory) {
  if (!existsSync(saveDirectory)) return [];
  const rooms = [];
  for (const filename of readdirSync(saveDirectory)) {
    const id = filename.replace(/\.json$/i, "");
    if (!/^[A-Z0-9]{6}$/.test(id) || !filename.endsWith(".json")) continue;
    try {
      const saved = JSON.parse(readFileSync(resolve(saveDirectory, filename), "utf8"));
      const blockChanges = new Map(Array.isArray(saved.blockChanges) ? saved.blockChanges : []);
      const savedPlayers = new Map((Array.isArray(saved.players) ? saved.players : [])
        .filter((player) => typeof player.name === "string" && Array.isArray(player.inventory))
        .map((player) => [player.name.toLowerCase(), player]));
      rooms.push({
        id,
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
        saved: true,
      });
    } catch {
      continue;
    }
  }
  return rooms;
}

function persistRoom(room, players, saveDirectory) {
  mkdirSync(saveDirectory, { recursive: true });
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
    });
  }
  room.savedPlayers = savedPlayers;
  room.saved = true;
  writeFileSync(resolve(saveDirectory, `${room.id}.json`), JSON.stringify({
    id: room.id,
    name: room.name,
    mode: room.mode,
    seed: room.seed,
    started: room.started,
    blockChanges: [...room.blockChanges],
    droppedItems: [...room.droppedItems],
    players: [...savedPlayers.values()],
  }));
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
} = {}) {
  const configuredSeed = requestedSeed ?? process.env.WORLD_SEED;
  const seed = configuredSeed === undefined ? randomInt(0, 0x1_0000_0000) : Number(configuredSeed);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError("WORLD_SEED must be an integer between 0 and 4294967295.");
  }
  const players = new Map();
  const rooms = new Map(loadSavedRooms(saveDirectory).map((room) => [room.id, room]));
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
    players: [...room.members].map((id) => players.get(id)).filter(Boolean).map(({ id, name, x, z, yaw, color }) => ({
      id,
      name,
      x,
      z,
      yaw,
      color,
    })),
    bots: [...bots.values()],
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
    players: [...room.members].map((id) => players.get(id)).filter(Boolean).map(({ id, name, x, z, yaw, color }) => ({
      id,
      name,
      x,
      z,
      yaw,
      color,
    })),
    bots: [...bots.values()],
    drops: [...room.droppedItems.values()].map(({ id, item, count, x, z }) => ({ id, item, count, x, z })),
    inventory: inventoryItems(player.inventory),
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

  webSocketServer.on("connection", (socket) => {
    const id = randomUUID();
    const colors = ["#e58b64", "#70a8d2", "#d4bd68", "#c27db7"];
    const player = {
      id,
      name: `Guest-${id.slice(0, 4)}`,
      x: 0,
      z: 0,
      yaw: 0,
      color: colors[Math.floor(Math.random() * colors.length)],
      inventory: createInventory(),
      socket,
      roomId: null,
    };
    players.set(id, player);
    writeJson(socket, { type: "lobby", playerId: id, rooms: lobbyRooms() });

    socket.on("message", (raw) => {
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
          persistRoom(room, players, saveDirectory);
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
        const target = room?.started && room.members.has(message.targetId)
          ? players.get(message.targetId)
          : null;
        if (!target) {
          writeJson(socket, { type: "error", message: "That player is not in your world." });
          return;
        }
        player.x = wrapPlanetX(target.x + 2);
        player.z = target.z;
        player.yaw = target.yaw;
        writeJson(socket, {
          type: "teleport_result",
          position: { x: player.x, z: player.z, yaw: player.yaw },
          targetId: target.id,
        });
        broadcastToRoom(room, roomSnapshot(room));
        return;
      }

      if (message.type === "move") {
        if (!rooms.get(player.roomId)?.started) return;
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
          if (room.mode !== "design" && (player.inventory.get(changedBlock) ?? 0) >= MAX_STACK_SIZE) {
            writeJson(socket, { type: "error", message: "That item stack is full." });
            return;
          }
          room.blocks.set(key, null);
          if (room.mode !== "design") addItems(player.inventory, changedBlock, 1);
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
    listen() {
      return new Promise((resolveListen, rejectListen) => {
        httpServer.once("error", rejectListen);
        httpServer.listen(port, host, () => {
          httpServer.off("error", rejectListen);
          resolveListen(httpServer.address());
        });
      });
    },
    close() {
      clearInterval(snapshotTimer);
      clearInterval(botTimer);
      for (const socket of webSocketServer.clients) socket.terminate();
      return new Promise((resolveClose) => {
        webSocketServer.close(() => httpServer.close(() => resolveClose()));
      });
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
