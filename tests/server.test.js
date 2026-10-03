import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer } from "../server/index.js";
import { BLOCK_TYPES, FISH_ITEMS, MAX_STACK_SIZE } from "../server/world.js";
import { WebSocket } from "ws";
import { MODEL_ITEM_BY_ID } from "../shared/models.js";
import { getBaseBlockAt, listCityProperties, terrainHeightAt } from "../shared/world.js";

function nextMessage(socket, predicate = () => true, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for a game server message."));
    }, timeoutMs);
    const onMessage = (raw) => {
      const message = JSON.parse(raw.toString());
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolve(message);
    };
    socket.on("message", onMessage);
  });
}

function connect(url) {
  const socket = new WebSocket(url);
  const opened = new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return { socket, opened };
}

test("loads and saves persistent player profile appearance and statistics", async () => {
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 31 });
  const sockets = [];
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;
    const nameResult = nextMessage(connection.socket, (message) => message.type === "name_result");
    connection.socket.send(JSON.stringify({ type: "name", name: "Profile Tester" }));
    await nameResult;

    const loadedProfile = nextMessage(connection.socket, (message) => message.type === "profile_data");
    connection.socket.send(JSON.stringify({
      type: "profile_load",
      profileId: "6f9619ff-8b86-4d11-b42d-00cf4fc964ff",
    }));
    const initial = (await loadedProfile).profile;
    assert.equal(initial.name, "Profile Tester");
    assert.equal(initial.stats.blocksMined, 0);

    const savedProfile = nextMessage(connection.socket, (message) => message.type === "profile_data");
    connection.socket.send(JSON.stringify({ type: "profile_update", name: "Builder", color: "#d05b43" }));
    const saved = (await savedProfile).profile;
    assert.equal(saved.name, "Builder");
    assert.equal(saved.color, "#d05b43");

    const closed = new Promise((resolve) => connection.socket.once("close", resolve));
    connection.socket.close();
    await closed;
    const reopened = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(reopened.socket);
    const reopenedLobby = nextMessage(reopened.socket, (message) => message.type === "lobby");
    await reopened.opened;
    await reopenedLobby;
    const restoredProfile = nextMessage(reopened.socket, (message) => message.type === "profile_data");
    reopened.socket.send(JSON.stringify({
      type: "profile_load",
      profileId: "6f9619ff-8b86-4d11-b42d-00cf4fc964ff",
    }));
    const restored = (await restoredProfile).profile;
    assert.equal(restored.name, "Builder");
    assert.equal(restored.color, "#d05b43");
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});

test("bots approach nearby players and navigate around walls", async () => {
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 31 });
  const sockets = [];
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;
    const created = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Bot Wall Test" }));
    const roomId = (await created).room.id;
    const started = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    const initial = await started;
    assert.equal(initial.animals.length, 20);
    assert.deepEqual(
      new Set(initial.animals.map(({ habitat }) => habitat)),
      new Set(["village", "coast", "ocean", "forest", "highlands"]),
    );
    assert.ok(initial.animals.every(({ name, model, color }) => name && model && /^#[0-9a-f]{6}$/i.test(color)));

    const room = server.rooms.get(roomId);
    const bot = room.bots.get("bot-moss");
    const animal = room.animals.get("animal-village-0");
    const animalPositions = [...room.animals.values()].map(({ x, z }) => ({ x, z }));
    await new Promise((resolve) => setTimeout(resolve, 800));
    assert.equal(bot.behavior, "follow");

    bot.x = -3.6;
    bot.z = -2;
    bot.targetX = 0;
    bot.targetZ = -2;
    bot.behavior = "wander";
    bot.nextDecisionAt = Date.now() + 5000;
    bot.walking = false;
    animal.x = -3.6;
    animal.z = -2;
    animal.homeX = -3.6;
    animal.homeZ = -2;
    animal.targetX = 0;
    animal.targetZ = -2;
    room.blocks.set("-3,1,-2", "stone");
    await new Promise((resolve) => setTimeout(resolve, 2600));
    assert.ok(bot.z < -2.5 || bot.z > -1.5, `bot did not steer around the wall at z=${bot.z}`);
    assert.ok(bot.x > -2.5, `bot did not continue toward its target at x=${bot.x}`);
    assert.ok(animal.x < -3.5, `animal crossed the wall to x=${animal.x}`);
    await new Promise((resolve) => setTimeout(resolve, 800));
    assert.ok([...room.animals.values()].some((animal, index) =>
      Math.hypot(animal.x - animalPositions[index].x, animal.z - animalPositions[index].z) > 0.01));
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});

test("players cannot move into solid blocks", async () => {
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 31 });
  const sockets = [];
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;
    const created = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Player Wall Test" }));
    const roomId = (await created).room.id;
    const started = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    const initial = await started;
    assert.equal(initial.position.y, 2.65);
    const room = server.rooms.get(roomId);
    const player = server.players.get(initial.id);

    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: 0.2, y: 2.65, z: 0, yaw: 0 },
    }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(player.x, 0.2);

    room.blocks.set("1,1,0", "stone");
    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: 1, y: 2.65, z: 0, yaw: 0 },
    }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(player.x, 0.2);

    room.blocks.set("2,1,0", "water");
    room.blocks.set("2,2,0", "water");
    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: 2, y: 2.65, z: 0, yaw: 0 },
    }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(player.x, 2);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});

test("surface monsters do not damage players underground", async () => {
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 31 });
  const sockets = [];
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;
    const created = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Underground Safety Test" }));
    const roomId = (await created).room.id;
    const started = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    const init = await started;
    const player = server.players.get(init.id);

    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: 1, y: -5, z: 126, yaw: 0 },
    }));
    await new Promise((resolve) => setTimeout(resolve, 450));
    assert.equal(player.health, 100);

    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: 1, y: 2.65, z: 126, yaw: 0 },
    }));
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(player.health, 92);

    const crab = server.rooms.get(roomId).monsters.get("monster-crab");
    crab.x = 0;
    crab.z = 140;
    crab.targetX = 0;
    crab.targetZ = 140;
    crab.lastAttackAt = 0;
    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: 0, y: 2.65, z: 140, yaw: 0 },
    }));
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(player.health, 92);
    assert.ok(server.rooms.has(roomId));
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});

test("monster kills award XP and coins that buy placeable models at the village market", async () => {
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 63 });
  const sockets = [];
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;
    const created = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Home Decor Test" }));
    const roomId = (await created).room.id;
    const started = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    const init = await started;
    const room = server.rooms.get(roomId);
    const player = server.players.get(init.id);
    const crab = room.monsters.get("monster-crab");
    crab.x = 0;
    crab.z = 2;
    crab.targetX = 0;
    crab.targetZ = 2;
    crab.health = 20;
    crab.lastAttackAt = Date.now();

    const attackResult = nextMessage(connection.socket, (message) => message.type === "attack_result");
    connection.socket.send(JSON.stringify({ type: "attack", targetId: crab.id }));
    const attack = await attackResult;
    assert.equal(attack.killed, true);
    assert.deepEqual(attack.reward, {
      xp: 50,
      level: 0,
      coins: 25,
      xpGained: 50,
      coinsGained: 25,
    });
    assert.equal(player.xp, 50);
    assert.equal(player.coins, 25);

    const model = MODEL_ITEM_BY_ID.get("model_plant_001");
    const buyResult = nextMessage(connection.socket, (message) => message.type === "buy_result");
    const balance = nextMessage(connection.socket, (message) => message.type === "currency");
    const inventory = nextMessage(connection.socket, (message) => message.type === "inventory");
    connection.socket.send(JSON.stringify({ type: "buy_model", item: model.id }));
    assert.equal((await buyResult).item, model.id);
    assert.equal((await balance).coins, 25 - model.price);
    assert.equal((await inventory).items.find(([item]) => item === model.id)?.[1], 1);

    const position = { x: -30, y: 100, z: -30 };
    const placed = nextMessage(connection.socket, (message) => message.type === "block");
    connection.socket.send(JSON.stringify({
      type: "edit",
      action: "place",
      position,
      block: model.id,
    }));
    assert.equal((await placed).block, model.id);
    assert.equal(room.blockChanges.get(`${position.x},${position.y},${position.z}`), model.id);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});

test("automatically saves started worlds without a manual save request", async () => {
  const saveDirectory = mkdtempSync(join(tmpdir(), "voxland-autosave-"));
  const server = createGameServer({
    host: "127.0.0.1",
    port: 0,
    seed: 52,
    saveDirectory,
    autosaveIntervalMs: 30,
  });
  const sockets = [];
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;
    const created = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Autosave Test" }));
    const roomId = (await created).room.id;
    const initial = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    const init = await initial;
    const player = server.players.get(init.id);
    const property = listCityProperties(init.seed)[0];
    player.x = property.entranceX;
    player.y = 2.65;
    player.z = property.entranceZ;
    player.coins = property.price;
    const purchasedHome = nextMessage(connection.socket, (message) => message.type === "home_result");
    connection.socket.send(JSON.stringify({ type: "buy_home" }));
    assert.equal((await purchasedHome).success, true);
    const saved = nextMessage(connection.socket, (message) => message.type === "save_result");
    connection.socket.send(JSON.stringify({ type: "save_room" }));
    assert.equal((await saved).saved, true);
    const savePath = join(saveDirectory, `${roomId}.json`);
    const deadline = Date.now() + 1000;
    while (!existsSync(savePath) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    assert.equal(existsSync(savePath), true);
    const savedWorld = JSON.parse(readFileSync(savePath, "utf8"));
    assert.equal(savedWorld.id, roomId);
    assert.equal(savedWorld.autosaveEnabled, true);
    assert.equal(savedWorld.properties[0][0], property.id);
    assert.equal(savedWorld.properties[0][1].ownerName, player.name);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
    rmSync(saveDirectory, { recursive: true, force: true });
  }
});

test("generates seeded terrain and shares chunk edits with joining players", async () => {
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 481516 });
  const sockets = [];
  try {
    const address = await server.listen();
    const url = `ws://127.0.0.1:${address.port}/ws`;
    const firstConnection = connect(url);
    const firstPlayer = firstConnection.socket;
    sockets.push(firstPlayer);

    const lobbyMessage = nextMessage(firstPlayer, (message) => message.type === "lobby");
    await firstConnection.opened;
    assert.equal((await lobbyMessage).type, "lobby");
    const createdRoomMessage = nextMessage(firstPlayer, (message) => message.type === "room_created");
    firstPlayer.send(JSON.stringify({ type: "create_room", roomName: "Test World", mode: "design" }));
    const createdRoom = await createdRoomMessage;
    const roomId = createdRoom.room.id;
    const initialMessage = nextMessage(firstPlayer, (message) => message.type === "init");
    firstPlayer.send(JSON.stringify({ type: "start_room" }));
    const initial = await initialMessage;
    assert.equal(initial.type, "init");
    assert.equal(initial.seed, 481516);
    assert.equal(initial.mode, "design");
    assert.equal(initial.chunkSize, 16);
    assert.equal(initial.blocks, undefined);
    assert.equal(initial.blockChanges, undefined);
    assert.equal(initial.monsters.length, 3);
    assert.ok(initial.monsters.some((monster) => monster.id === "monster-crab"));
    assert.equal(initial.inventory.length, BLOCK_TYPES.size);
    assert.ok(initial.inventory.every(([, count]) => count === 1));
    assert.equal(initial.bots.length, 3);
    assert.ok(initial.vehicles.some((vehicle) => vehicle.id === "airport-plane"));
    assert.ok(initial.vehicles.some((vehicle) => vehicle.id === "airport-car"));
    assert.ok(initial.vehicles.filter((vehicle) => vehicle.id.startsWith("city-car-")).length > 5);
    assert.deepEqual(initial.properties, []);

    const property = listCityProperties(initial.seed)[0];
    const player = server.players.get(initial.id);
    player.x = property.entranceX;
    player.y = terrainHeightAt(property.entranceX, property.entranceZ, initial.seed) + 2.65;
    player.z = property.entranceZ;
    const purchasedHome = nextMessage(firstPlayer, (message) => message.type === "home_result");
    firstPlayer.send(JSON.stringify({ type: "buy_home" }));
    const purchaseResult = await purchasedHome;
    assert.equal(purchaseResult.success, true);
    assert.equal(purchaseResult.properties[0].id, property.id);
    assert.equal(purchaseResult.properties[0].ownerName, player.name);

    player.x = 0;
    player.y = 2.65;
    player.z = 0;
    const returnedHome = nextMessage(firstPlayer, (message) => message.type === "home_result");
    firstPlayer.send(JSON.stringify({ type: "home_teleport", propertyId: property.id }));
    const homeResult = await returnedHome;
    assert.equal(homeResult.success, true);
    assert.equal(homeResult.position.x, property.entranceX);
    assert.equal(homeResult.position.z, property.entranceZ);
    const enteredHome = nextMessage(
      firstPlayer,
      (message) => message.type === "snapshot" &&
        message.players.some((entry) =>
          entry.id === initial.id &&
          entry.x === property.entranceX &&
          entry.z === property.entranceZ + 1,
        ),
    );
    firstPlayer.send(JSON.stringify({
      type: "move",
      position: { x: property.entranceX, y: 2.65, z: property.entranceZ + 1, yaw: 0 },
    }));
    assert.ok((await enteredHome).players.some((entry) => entry.id === initial.id));

    const walkingPosition = nextMessage(
      firstPlayer,
      (message) => message.type === "snapshot" &&
        message.players.some((player) => player.id === initial.id && player.x === 1 && player.y === 2.65),
    );
    firstPlayer.send(JSON.stringify({
      type: "move",
      position: { x: 1, y: 2.65, z: 0, yaw: 0 },
    }));
    assert.ok((await walkingPosition).players.some((player) => player.id === initial.id && player.x === 1));
    firstPlayer.send(JSON.stringify({
      type: "move",
      position: { x: 0, y: terrainHeightAt(0, 0, initial.seed) + 2.65, z: 0, yaw: 0 },
    }));

    const flightEnabled = nextMessage(firstPlayer, (message) => message.type === "fly_result");
    firstPlayer.send(JSON.stringify({ type: "fly_toggle", enabled: true }));
    assert.equal((await flightEnabled).enabled, true);
    const flownPosition = nextMessage(
      firstPlayer,
      (message) => message.type === "snapshot" &&
        message.players.some((player) => player.id === initial.id && player.x === 10 && player.y === 20),
    );
    firstPlayer.send(JSON.stringify({
      type: "move",
      position: { x: 10, y: 20, z: 10, yaw: 0 },
    }));
    assert.ok((await flownPosition).players.some((player) => player.id === initial.id && player.x === 10 && player.y === 20));
    const flightCollision = nextMessage(firstPlayer, (message) => message.type === "move_rejected");
    server.rooms.get(roomId).blocks.set("11,18,10", "stone");
    firstPlayer.send(JSON.stringify({
      type: "move",
      position: { x: 11, y: 20, z: 10, yaw: 0 },
    }));
    const rejectedMove = await flightCollision;
    assert.deepEqual(rejectedMove.position, { x: 10, y: 20, z: 10, yaw: 0 });
    server.rooms.get(roomId).blocks.delete("11,18,10");
    firstPlayer.send(JSON.stringify({
      type: "move",
      position: { x: 0, y: terrainHeightAt(0, 0, initial.seed) + 2.65, z: 0, yaw: 0 },
    }));
    const carHeight = terrainHeightAt(-12, 0, initial.seed) + 2.65;
    const carApproach = nextMessage(
      firstPlayer,
      (message) => message.type === "snapshot" &&
        message.players.some((player) => player.id === initial.id && player.x === -12),
    );
    firstPlayer.send(JSON.stringify({
      type: "move",
      position: { x: -12, y: carHeight, z: 0, yaw: 0 },
    }));
    await carApproach;
    const enteredCar = nextMessage(firstPlayer, (message) => message.type === "vehicle_result");
    firstPlayer.send(JSON.stringify({ type: "vehicle_enter", vehicleId: "starter-car" }));
    assert.equal((await enteredCar).vehicleType, "car");
    const drivenCar = nextMessage(
      firstPlayer,
      (message) => message.type === "snapshot" &&
        message.vehicles?.some((vehicle) => vehicle.id === "starter-car" && vehicle.x === -11),
    );
    firstPlayer.send(JSON.stringify({
      type: "move",
      position: { x: -11, y: carHeight, z: 0, yaw: 0 },
    }));
    assert.ok((await drivenCar).vehicles.some((vehicle) => vehicle.id === "starter-car" && vehicle.occupantId === initial.id));
    const exitedCar = nextMessage(firstPlayer, (message) => message.type === "vehicle_result");
    firstPlayer.send(JSON.stringify({ type: "vehicle_exit" }));
    assert.equal((await exitedCar).vehicleId, null);
    firstPlayer.send(JSON.stringify({
      type: "move",
      position: { x: 0, y: terrainHeightAt(0, 0, initial.seed) + 2.65, z: 0, yaw: 0 },
    }));

    const initialChunkMessage = nextMessage(firstPlayer, (message) => message.type === "chunk");
    firstPlayer.send(JSON.stringify({ type: "chunk", x: 0, z: 0 }));
    assert.deepEqual((await initialChunkMessage).blockChanges, []);

    const craftedItems = nextMessage(firstPlayer, (message) => message.type === "inventory");
    firstPlayer.send(JSON.stringify({ type: "craft", recipe: "planks" }));
    const crafted = await craftedItems;
    assert.equal(crafted.type, "inventory");
    assert.equal(crafted.items.find(([item]) => item === "oak_log")?.[1], undefined);
    assert.equal(crafted.items.find(([item]) => item === "oak_planks")[1], 5);

    const undergroundPosition = { x: 0, y: -1, z: 0 };
    const minedBlock = nextMessage(firstPlayer, (message) => message.type === "block");
    const minedInventory = nextMessage(firstPlayer, (message) => message.type === "inventory");
    firstPlayer.send(
      JSON.stringify({
        type: "edit",
        action: "remove",
        position: undergroundPosition,
        block: "dirt",
      }),
    );
    assert.equal((await minedBlock).action, "remove");
    assert.equal((await minedInventory).items.find(([item]) => item === "dirt")[1], 2);

    assert.equal(getBaseBlockAt(0, -2, 0, initial.seed), "dirt");
    server.players.get(initial.id).inventory.set("dirt", MAX_STACK_SIZE);
    const overflowBlock = nextMessage(firstPlayer, (message) => message.type === "block");
    const overflowInventory = nextMessage(firstPlayer, (message) => message.type === "inventory");
    firstPlayer.send(JSON.stringify({
      type: "edit",
      action: "remove",
      position: { x: 0, y: -2, z: 0 },
      block: "dirt",
    }));
    assert.equal((await overflowBlock).action, "remove");
    assert.equal((await overflowInventory).items.find(([item]) => item === "dirt")[1], MAX_STACK_SIZE + 1);

    const editPosition = { x: 0, y: 15, z: 0 };
    const editBroadcast = nextMessage(firstPlayer, (message) => message.type === "block");
    const placedInventory = nextMessage(firstPlayer, (message) => message.type === "inventory");
    firstPlayer.send(
      JSON.stringify({
        type: "edit",
        action: "place",
        position: editPosition,
        block: "stone",
      }),
    );
    assert.equal((await editBroadcast).type, "block");
    assert.equal((await placedInventory).items.find(([item]) => item === "stone")[1], 1);

    const droppedInventory = nextMessage(firstPlayer, (message) => message.type === "inventory");
    const droppedSnapshot = nextMessage(
      firstPlayer,
      (message) => message.type === "snapshot" && message.drops?.length > 0,
    );
    firstPlayer.send(JSON.stringify({ type: "drop", item: "oak_planks", count: 1 }));
    assert.equal((await droppedInventory).items.find(([item]) => item === "oak_planks")[1], 4);
    const drop = (await droppedSnapshot).drops[0];

    const pickedInventory = nextMessage(firstPlayer, (message) => message.type === "inventory");
    firstPlayer.send(
      JSON.stringify({
        type: "move",
        position: { x: drop.x, z: drop.z, yaw: 0 },
      }),
    );
    firstPlayer.send(JSON.stringify({ type: "pickup" }));
    assert.equal((await pickedInventory).items.find(([item]) => item === "oak_planks")[1], 5);

    const secondConnection = connect(url);
    const secondPlayer = secondConnection.socket;
    sockets.push(secondPlayer);
    const secondLobbyMessage = nextMessage(secondPlayer, (message) => message.type === "lobby");
    await secondConnection.opened;
    const secondLobby = await secondLobbyMessage;
    assert.ok(secondLobby.rooms.some((room) => room.name === "Test World"));
    const joinedMessage = nextMessage(secondPlayer, (message) => message.type === "init");
    secondPlayer.send(JSON.stringify({ type: "join_room", roomId }));
    const joined = await joinedMessage;
    assert.equal(joined.seed, 481516);
    assert.equal(joined.mode, "design");
    assert.equal(joined.inventory.length, BLOCK_TYPES.size);
    const joinedChunkChanges = nextMessage(secondPlayer, (message) => message.type === "chunk");
    secondPlayer.send(JSON.stringify({ type: "chunk", x: 0, z: 0 }));
    assert.deepEqual((await joinedChunkChanges).blockChanges, [
      [[undergroundPosition.x, undergroundPosition.y, undergroundPosition.z], null],
      [[0, -2, 0], null],
      [[editPosition.x, editPosition.y, editPosition.z], "stone"],
    ]);
    assert.equal(server.rooms.get(roomId).blockChanges.size, 3);

    const renamedResult = nextMessage(secondPlayer, (message) => message.type === "name_result");
    const renamedSnapshot = nextMessage(
      firstPlayer,
      (message) => message.type === "snapshot" && message.players.some((player) => player.id === joined.id && player.name === "Builder Two"),
    );
    secondPlayer.send(JSON.stringify({ type: "name", name: "Builder Two" }));
    assert.equal((await renamedResult).name, "Builder Two");
    await renamedSnapshot;

    const teleportResult = nextMessage(firstPlayer, (message) => message.type === "teleport_result");
    firstPlayer.send(JSON.stringify({ type: "teleport", targetId: joined.id }));
    const teleported = await teleportResult;
    const joinedPlayer = joined.players.find((player) => player.id === joined.id);
    assert.equal(teleported.position.x, joinedPlayer.x + 2);
    assert.equal(teleported.position.z, joinedPlayer.z);

    const beachTeleportResult = nextMessage(firstPlayer, (message) => message.type === "teleport_result");
    firstPlayer.send(JSON.stringify({ type: "teleport", locationId: "beach" }));
    const beachTeleport = await beachTeleportResult;
    assert.equal(beachTeleport.locationId, "beach");
    assert.deepEqual(beachTeleport.position, { x: 0, y: 2.65, z: 124, yaw: 0 });
    const airportTeleportResult = nextMessage(firstPlayer, (message) => message.type === "teleport_result");
    firstPlayer.send(JSON.stringify({ type: "teleport", locationId: "airport" }));
    const airportTeleport = await airportTeleportResult;
    assert.equal(airportTeleport.locationId, "airport");
    assert.equal(airportTeleport.locationName, "Glass City Airport");
    assert.deepEqual(airportTeleport.position, { x: 72, y: 2.65, z: -72, yaw: Math.PI });
    const returnToBeach = nextMessage(firstPlayer, (message) => message.type === "teleport_result");
    firstPlayer.send(JSON.stringify({ type: "teleport", locationId: "beach" }));
    await returnToBeach;
    const crab = server.rooms.get(roomId).monsters.get("monster-crab");
    crab.health = 20;
    const monsterAttack = nextMessage(firstPlayer, (message) => message.type === "attack_result");
    firstPlayer.send(JSON.stringify({ type: "attack", targetId: "monster-crab" }));
    const monsterHit = await monsterAttack;
    assert.equal(monsterHit.hit, true);
    assert.equal(monsterHit.monster, true);
    assert.equal(monsterHit.health, 0);
    assert.equal(monsterHit.killed, true);
    assert.equal(monsterHit.reward.xpGained, 50);
    assert.equal(monsterHit.reward.coinsGained, 25);
    assert.equal(server.players.get(initial.id).xp, 52);
    assert.equal(server.players.get(initial.id).coins, 25);

    crab.health = 60;
    server.players.get(initial.id).lastAttackAt = 0;
    const weaponAttack = nextMessage(firstPlayer, (message) => message.type === "attack_result");
    firstPlayer.send(JSON.stringify({ type: "attack", targetId: "monster-crab", weapon: "steel_sword" }));
    const weaponHit = await weaponAttack;
    assert.equal(weaponHit.hit, true);
    assert.equal(weaponHit.damage, 42);
    assert.equal(weaponHit.health, 18);

    server.players.get(initial.id).lastAttackAt = 0;
    server.players.get(initial.id).inventory.delete("steel_sword");
    const rejectedWeaponAttack = nextMessage(firstPlayer, (message) => message.type === "attack_result");
    firstPlayer.send(JSON.stringify({ type: "attack", targetId: "monster-crab", weapon: "steel_sword" }));
    const rejectedWeaponHit = await rejectedWeaponAttack;
    assert.equal(rejectedWeaponHit.hit, false);
    assert.match(rejectedWeaponHit.message, /do not have that weapon/i);

    const isolatedConnection = connect(url);
    const isolatedPlayer = isolatedConnection.socket;
    sockets.push(isolatedPlayer);
    const isolatedLobbyMessage = nextMessage(isolatedPlayer, (message) => message.type === "lobby");
    await isolatedConnection.opened;
    await isolatedLobbyMessage;
    const isolatedCreatedMessage = nextMessage(isolatedPlayer, (message) => message.type === "room_created");
    isolatedPlayer.send(JSON.stringify({ type: "create_room", roomName: "Isolated World" }));
    const isolatedRoomId = (await isolatedCreatedMessage).room.id;
    const isolatedInitMessage = nextMessage(isolatedPlayer, (message) => message.type === "init");
    isolatedPlayer.send(JSON.stringify({ type: "start_room" }));
    const isolatedInit = await isolatedInitMessage;
    assert.equal(isolatedInit.mode, "survival");
    assert.deepEqual(isolatedInit.inventory, []);
    assert.equal(server.rooms.get(isolatedRoomId).blockChanges.size, 0);

    const rejectedTeleport = nextMessage(firstPlayer, (message) => message.type === "error");
    firstPlayer.send(JSON.stringify({ type: "teleport", targetId: isolatedInit.id }));
    assert.match((await rejectedTeleport).message, /not in your world/i);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});

test("rejoins an active world with player state after a disconnect", async () => {
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 9876 });
  const sockets = [];
  try {
    const address = await server.listen();
    const url = `ws://127.0.0.1:${address.port}/ws`;
    const firstConnection = connect(url);
    sockets.push(firstConnection.socket);
    const firstLobby = nextMessage(firstConnection.socket, (message) => message.type === "lobby");
    await firstConnection.opened;
    await firstLobby;
    const firstName = nextMessage(firstConnection.socket, (message) => message.type === "name_result");
    firstConnection.socket.send(JSON.stringify({ type: "name", name: "Refresh Tester" }));
    await firstName;

    const createdMessage = nextMessage(firstConnection.socket, (message) => message.type === "room_created");
    firstConnection.socket.send(JSON.stringify({ type: "create_room", roomName: "Refresh World" }));
    const roomId = (await createdMessage).room.id;
    const firstInit = nextMessage(firstConnection.socket, (message) => message.type === "init");
    firstConnection.socket.send(JSON.stringify({ type: "start_room" }));
    const initial = await firstInit;
    const player = server.players.get(initial.id);
    player.x = 24;
    player.z = 37;
    player.y = terrainHeightAt(player.x, player.z, 9876) + 2.15;
    player.yaw = 1.25;
    player.inventory.set("oak_planks", 7);

    const firstClosed = new Promise((resolve) => firstConnection.socket.once("close", resolve));
    firstConnection.socket.close();
    await firstClosed;

    const resumedConnection = connect(url);
    sockets.push(resumedConnection.socket);
    const resumedLobby = nextMessage(resumedConnection.socket, (message) => message.type === "lobby");
    await resumedConnection.opened;
    await resumedLobby;
    const resumedName = nextMessage(resumedConnection.socket, (message) => message.type === "name_result");
    resumedConnection.socket.send(JSON.stringify({ type: "name", name: "Refresh Tester" }));
    await resumedName;
    const resumedInit = nextMessage(resumedConnection.socket, (message) => message.type === "init");
    resumedConnection.socket.send(JSON.stringify({ type: "join_room", roomId }));
    const restored = await resumedInit;

    assert.equal(restored.seed, 9876);
    assert.deepEqual(restored.position, {
      x: 24,
      y: terrainHeightAt(24, 37, 9876) + 2.65,
      z: 37,
      yaw: 1.25,
    });
    assert.equal(restored.inventory.find(([item]) => item === "oak_planks")[1], 7);
    assert.equal(server.rooms.get(roomId).members.size, 1);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});

test("crafting awards XP levels and restores them with saved worlds", async () => {
  const saveDirectory = mkdtempSync(join(tmpdir(), "voxland-saves-xp-"));
  const sockets = [];
  let server = createGameServer({ host: "127.0.0.1", port: 0, seed: 4321, saveDirectory });
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;
    const nameMessage = nextMessage(connection.socket, (message) => message.type === "name_result");
    connection.socket.send(JSON.stringify({ type: "name", name: "XP Saver" }));
    await nameMessage;
    const created = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "XP World", mode: "design" }));
    const roomId = (await created).room.id;
    const init = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    const initial = await init;
    assert.equal(initial.xp, 0);
    assert.equal(initial.level, 0);

    const xpMessage = nextMessage(connection.socket, (message) => message.type === "xp");
    const inventoryMessage = nextMessage(connection.socket, (message) => message.type === "inventory");
    connection.socket.send(JSON.stringify({ type: "craft", recipe: "planks" }));
    const xp = await xpMessage;
    assert.equal(xp.xp, 2);
    assert.equal(xp.level, 2);
    assert.equal((await inventoryMessage).items.find(([item]) => item === "oak_planks")[1], 5);

    const saveMessage = nextMessage(connection.socket, (message) => message.type === "save_result");
    connection.socket.send(JSON.stringify({ type: "save_room" }));
    assert.equal((await saveMessage).saved, true);
    await server.close();
    sockets.length = 0;

    server = createGameServer({ host: "127.0.0.1", port: 0, seed: 1, saveDirectory });
    const restoredAddress = await server.listen();
    const restoredConnection = connect(`ws://127.0.0.1:${restoredAddress.port}/ws`);
    sockets.push(restoredConnection.socket);
    const restoredLobby = nextMessage(restoredConnection.socket, (message) => message.type === "lobby");
    await restoredConnection.opened;
    await restoredLobby;
    const restoredName = nextMessage(restoredConnection.socket, (message) => message.type === "name_result");
    restoredConnection.socket.send(JSON.stringify({ type: "name", name: "XP Saver" }));
    await restoredName;
    const restoredJoin = nextMessage(restoredConnection.socket, (message) => message.type === "init");
    restoredConnection.socket.send(JSON.stringify({ type: "join_room", roomId }));
    const restored = await restoredJoin;
    assert.equal(restored.xp, 2);
    assert.equal(restored.level, 2);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
    rmSync(saveDirectory, { recursive: true, force: true });
  }
});

test("saves a world and restores its terrain, mode, seed, and player inventory", async () => {
  const saveDirectory = mkdtempSync(join(tmpdir(), "voxland-saves-"));
  const sockets = [];
  let server = createGameServer({ host: "127.0.0.1", port: 0, seed: 7654, saveDirectory });
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobbyMessage = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobbyMessage;
    const nameMessage = nextMessage(connection.socket, (message) => message.type === "name_result");
    connection.socket.send(JSON.stringify({ type: "name", name: "Saver" }));
    await nameMessage;
    const createdMessage = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Saved Island" }));
    const roomId = (await createdMessage).room.id;
    const initMessage = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    await initMessage;

    const changedPosition = { x: 0, y: -1, z: 0 };
    const blockMessage = nextMessage(connection.socket, (message) => message.type === "block");
    const inventoryMessage = nextMessage(connection.socket, (message) => message.type === "inventory");
    connection.socket.send(JSON.stringify({ type: "edit", action: "remove", position: changedPosition, block: "dirt" }));
    await blockMessage;
    await inventoryMessage;

    const savedMessage = nextMessage(connection.socket, (message) => message.type === "save_result");
    connection.socket.send(JSON.stringify({ type: "save_room" }));
    assert.equal((await savedMessage).saved, true);
    const savePath = join(saveDirectory, `${roomId}.json`);
    const legacySave = JSON.parse(readFileSync(savePath, "utf8"));
    legacySave.vehicles = legacySave.vehicles.filter((vehicle) => vehicle.id === "starter-car");
    writeFileSync(savePath, JSON.stringify(legacySave));
    await server.close();
    sockets.length = 0;

    server = createGameServer({ host: "127.0.0.1", port: 0, seed: 1, saveDirectory });
    assert.equal(server.rooms.has(roomId), true);
    const restoredAddress = await server.listen();
    const restoredConnection = connect(`ws://127.0.0.1:${restoredAddress.port}/ws`);
    sockets.push(restoredConnection.socket);
    const restoredLobby = nextMessage(restoredConnection.socket, (message) => message.type === "lobby");
    await restoredConnection.opened;
    const lobby = await restoredLobby;
    assert.ok(lobby.rooms.some((room) => room.id === roomId && room.saved));
    const restoredName = nextMessage(restoredConnection.socket, (message) => message.type === "name_result");
    restoredConnection.socket.send(JSON.stringify({ type: "name", name: "Saver" }));
    await restoredName;
    const restoredInitMessage = nextMessage(restoredConnection.socket, (message) => message.type === "init");
    restoredConnection.socket.send(JSON.stringify({ type: "join_room", roomId }));
    const restored = await restoredInitMessage;
    assert.equal(restored.seed, 7654);
    assert.equal(restored.mode, "survival");
    assert.equal(restored.inventory.find(([item]) => item === "dirt")[1], 1);
    assert.ok(restored.vehicles.some((vehicle) => vehicle.id === "airport-plane"));
    assert.ok(restored.vehicles.some((vehicle) => vehicle.id === "airport-car"));
    const restoredChunk = nextMessage(restoredConnection.socket, (message) => message.type === "chunk");
    restoredConnection.socket.send(JSON.stringify({ type: "chunk", x: 0, z: 0 }));
    assert.ok((await restoredChunk).blockChanges.some(([[x, y, z], type]) => x === 0 && y === -1 && z === 0 && type === null));
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
    rmSync(saveDirectory, { recursive: true, force: true });
  }
});

test("fishing requires a rod and uses the harbor cooldown", async () => {
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 321 });
  const sockets = [];
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;
    const created = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Rod Test" }));
    const roomId = (await created).room.id;
    const init = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    await init;

    const player = [...server.players.values()][0];
    player.inventory.delete("fishing_rod");

    const moved = nextMessage(connection.socket, (message) => message.type === "snapshot");
    connection.socket.send(JSON.stringify({ type: "move", position: { x: 0, z: 140, yaw: 0 } }));
    await moved;
    const missingRod = nextMessage(connection.socket, (message) => message.type === "fish_result");
    connection.socket.send(JSON.stringify({ type: "fish" }));
    assert.equal((await missingRod).caught, false);
    assert.match((await missingRod).message, /fishing rod/i);

    player.inventory.set("fishing_rod", 1);
    const caught = nextMessage(connection.socket, (message) => message.type === "fish_result");
    const inventory = nextMessage(connection.socket, (message) => message.type === "inventory");
    connection.socket.send(JSON.stringify({ type: "fish" }));
    assert.equal((await caught).caught, true);
    assert.ok((await inventory).items.some(([item]) => FISH_ITEMS.includes(item)));
    assert.equal(server.rooms.get(roomId).members.size, 1);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});

test("fishing is limited to the harbor and awards fish with a cooldown", async () => {
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 321 });
  const sockets = [];
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;
    const created = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Fishing Test" }));
    const roomId = (await created).room.id;
    const init = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    await init;

    const player = [...server.players.values()][0];
    player.inventory.set("fishing_rod", 1);

    const inlandResult = nextMessage(connection.socket, (message) => message.type === "fish_result");
    connection.socket.send(JSON.stringify({ type: "fish" }));
    assert.equal((await inlandResult).caught, false);

    const moved = nextMessage(connection.socket, (message) => message.type === "snapshot");
    connection.socket.send(JSON.stringify({ type: "move", position: { x: 0, z: 140, yaw: 0 } }));
    await moved;
    const caught = nextMessage(connection.socket, (message) => message.type === "fish_result");
    const inventory = nextMessage(connection.socket, (message) => message.type === "inventory");
    connection.socket.send(JSON.stringify({ type: "fish" }));
    assert.equal((await caught).caught, true);
    const fishInventory = (await inventory).items;
    assert.ok(fishInventory.some(([item, count]) => FISH_ITEMS.includes(item) && count === 1));

    const cooldown = nextMessage(connection.socket, (message) => message.type === "fish_result");
    connection.socket.send(JSON.stringify({ type: "fish" }));
    assert.equal((await cooldown).caught, false);
    assert.equal(server.rooms.get(roomId).members.size, 1);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});
