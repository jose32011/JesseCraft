import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer } from "../server/index.js";
import { BLOCK_TYPES, FISH_ITEMS, MAX_STACK_SIZE } from "../server/world.js";
import { WebSocket } from "ws";
import { MODEL_CATALOG, MODEL_ITEM_BY_ID } from "../shared/models.js";
import { CITY_POLICE_STATION, getBaseBlockAt, listCityProperties, terrainHeightAt } from "../shared/world.js";

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
    assert.equal(initial.animals.length, 26);
    assert.deepEqual(
      new Set(initial.animals.map(({ habitat }) => habitat)),
      new Set(["village", "coast", "ocean", "forest", "highlands", "sky"]),
    );
    assert.ok(initial.animals.every(({ name, model, color }) => name && model && /^#[0-9a-f]{6}$/i.test(color)));
    assert.equal(initial.animals.filter(({ flying }) => flying).length, 6);
    assert.ok(initial.animals.filter(({ flying }) => flying).every(({ y }) => y > 15));

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

test("surface monsters do not damage players underground, at the harbor, or in the city", async () => {
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

    crab.x = 48;
    crab.z = 0;
    crab.targetX = 48;
    crab.targetZ = 0;
    crab.lastAttackAt = 0;
    player.x = 48;
    player.z = 0;
    player.y = terrainHeightAt(48, 0, server.rooms.get(roomId).seed) + 2.65;
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(player.health, 92);
    assert.ok(server.rooms.has(roomId));
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});

test("tanks are drivable and their cannon requires a driver and a valid target", async () => {
  const server = createGameServer({
    host: "127.0.0.1",
    port: 0,
    seed: 49,
    blockRebuildDelayMs: 250,
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
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Tank Battle Test" }));
    const roomId = (await created).room.id;
    const started = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    const init = await started;
    const player = server.players.get(init.id);
    const room = server.rooms.get(roomId);
    const startingInventory = new Map(init.inventory);
    const tank = room.vehicles.get("city-tank-1");
    const crab = room.monsters.get("monster-crab");

    assert.equal(startingInventory.get("iron_armor"), 1);
    assert.equal(startingInventory.get("wooden_sword"), 1);
    assert.equal(startingInventory.get("shield"), 1);
    assert.equal(tank.type, "tank");
    assert.ok(init.vehicles.some((vehicle) => vehicle.id === "city-tank-2" && vehicle.type === "tank"));
    crab.x = 0;
    crab.z = 126;
    crab.targetX = 0;
    crab.targetZ = 126;

    const rejectedFire = nextMessage(connection.socket, (message) => message.type === "attack_result");
    connection.socket.send(JSON.stringify({ type: "tank_fire", targetId: crab.id }));
    assert.equal((await rejectedFire).hit, false);
    assert.equal(crab.health, crab.maxHealth);

    const moveToTank = nextMessage(
      connection.socket,
      (message) => message.type === "snapshot" &&
        message.players.some((entry) => entry.id === init.id && entry.z === tank.z),
    );
    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: tank.x, y: tank.y + 2.65, z: tank.z, yaw: 0 },
    }));
    await moveToTank;

    const entered = nextMessage(connection.socket, (message) => message.type === "vehicle_result");
    connection.socket.send(JSON.stringify({ type: "vehicle_enter", vehicleId: tank.id }));
    assert.equal((await entered).vehicleType, "tank");
    assert.equal(player.vehicleId, tank.id);

    const turretAimedNorth = nextMessage(
      connection.socket,
      (message) => message.type === "snapshot" &&
        message.vehicles?.some((vehicle) =>
          vehicle.id === tank.id && Math.abs(vehicle.turretYaw) < 0.001),
    );
    connection.socket.send(JSON.stringify({
      type: "move",
      position: {
        x: tank.x,
        y: tank.y + 2.65,
        z: tank.z,
        yaw: Math.PI / 2,
        turretYaw: 0,
      },
    }));
    await turretAimedNorth;

    const buildingBlock = { x: 0, y: 1, z: tank.z + 10 };
    const buildingKey = `${buildingBlock.x},${buildingBlock.y},${buildingBlock.z}`;
    room.blocks.set(buildingKey, "red_concrete");
    const destroyedBuildingBlock = nextMessage(
      connection.socket,
      (message) =>
        message.type === "block" &&
        message.action === "remove" &&
        message.position.x === buildingBlock.x &&
        message.position.y === buildingBlock.y &&
        message.position.z === buildingBlock.z,
    );
    const demolition = nextMessage(connection.socket, (message) => message.type === "attack_result");
    const demolitionInventory = nextMessage(connection.socket, (message) => message.type === "inventory");
    connection.socket.send(JSON.stringify({
      type: "tank_fire",
      impactPosition: buildingBlock,
    }));
    const demolitionResult = await demolition;
    assert.equal(demolitionResult.tank, true);
    assert.ok(demolitionResult.demolished > 0);
    assert.equal(
      demolitionResult.loot.find(({ item }) => item === "red_concrete")?.count,
      1,
    );
    assert.equal(
      new Map(demolitionResult.inventory).get("red_concrete"),
      1,
    );
    assert.equal(
      new Map((await demolitionInventory).items).get("red_concrete"),
      1,
    );
    await destroyedBuildingBlock;
    assert.equal(room.blocks.get(buildingKey), null);

    const rebuiltBuildingBlock = nextMessage(
      connection.socket,
      (message) =>
        message.type === "block" &&
        message.action === "rebuild" &&
        message.position.x === buildingBlock.x &&
        message.position.y === buildingBlock.y &&
        message.position.z === buildingBlock.z,
    );
    await rebuiltBuildingBlock;
    assert.equal(room.blocks.get(buildingKey), "red_concrete");

    player.lastAttackAt = 0;
    const fired = nextMessage(connection.socket, (message) => message.type === "attack_result");
    connection.socket.send(JSON.stringify({ type: "tank_fire", targetId: crab.id }));
    const result = await fired;
    assert.equal(result.hit, true);
    assert.equal(result.tank, true);
    assert.equal(result.damage, 45);
    assert.equal(crab.health, crab.maxHealth - 45);

    player.lastAttackAt = 0;
    const aimedShot = nextMessage(connection.socket, (message) => message.type === "attack_result");
    connection.socket.send(JSON.stringify({ type: "tank_fire" }));
    const aimedShotResult = await aimedShot;
    assert.equal(aimedShotResult.hit, true);
    assert.equal(aimedShotResult.targetId, crab.id);

    const plane = room.vehicles.get("airport-plane");
    plane.x = tank.x;
    plane.y = tank.y;
    plane.z = tank.z + 10;
    player.lastAttackAt = 0;
    const planeDestroyed = nextMessage(
      connection.socket,
      (message) => message.type === "attack_result" && message.vehicleHit,
    );
    connection.socket.send(JSON.stringify({
      type: "tank_fire",
      targetVehicleId: plane.id,
    }));
    const planeResult = await planeDestroyed;
    assert.equal(planeResult.destroyed, true);
    assert.match(planeResult.message, /plane was destroyed/);
    assert.equal(room.vehicles.has(plane.id), false);

    const rivalConnection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(rivalConnection.socket);
    const rivalLobby = nextMessage(rivalConnection.socket, (message) => message.type === "lobby");
    await rivalConnection.opened;
    await rivalLobby;
    const rivalInitMessage = nextMessage(rivalConnection.socket, (message) => message.type === "init");
    rivalConnection.socket.send(JSON.stringify({ type: "join_room", roomId }));
    const rivalInit = await rivalInitMessage;
    const rival = server.players.get(rivalInit.id);
    rival.x = tank.x;
    rival.y = terrainHeightAt(tank.x, tank.z + 10, room.seed) + 2.65;
    rival.z = tank.z + 10;
    player.lastAttackAt = 0;
    const playerHit = nextMessage(
      connection.socket,
      (message) => message.type === "attack_result" && message.targetId === rival.id,
    );
    connection.socket.send(JSON.stringify({ type: "tank_fire", targetId: rival.id }));
    assert.equal((await playerHit).hit, true);
    assert.equal(rival.health, 55);

    const tankStartZ = tank.z;
    const movedTank = nextMessage(
      connection.socket,
      (message) => message.type === "snapshot" &&
        message.vehicles?.some((vehicle) => vehicle.id === tank.id && vehicle.z === tankStartZ + 1),
    );
    rival.z = tankStartZ + 0.5;
    rival.y = terrainHeightAt(rival.x, rival.z, room.seed) + 2.65;
    const runOver = nextMessage(
      rivalConnection.socket,
      (message) => message.type === "attack_result" && message.hitByVehicle,
    );
    connection.socket.send(JSON.stringify({
      type: "move",
      position: {
        x: tank.x,
        y: terrainHeightAt(tank.x, tankStartZ + 1, room.seed) + 2.65,
        z: tankStartZ + 1,
        yaw: 0,
      },
    }));
    assert.ok((await movedTank).vehicles.some((vehicle) => vehicle.id === tank.id && vehicle.occupantId === init.id));
    await runOver;
    assert.equal(rival.health, 20);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});

test("builds custom boats at the harbor workshop, sails on water, and saves boat designs", async () => {
  const saveDirectory = mkdtempSync(join(tmpdir(), "voxland-boats-"));
  let server = createGameServer({ host: "127.0.0.1", port: 0, seed: 343, saveDirectory });
  const sockets = [];
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;
    const created = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Boat Workshop Test" }));
    const roomId = (await created).room.id;
    const started = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    const init = await started;
    const player = server.players.get(init.id);
    const room = server.rooms.get(roomId);

    const rejected = nextMessage(connection.socket, (message) => message.type === "boat_result");
    connection.socket.send(JSON.stringify({
      type: "boat_build",
      design: { name: "Faraway", size: "cutter", windows: 4, hullColor: "#4b6173", sailColor: "#426c83", cabin: true, sail: true },
    }));
    assert.equal((await rejected).success, false);

    const atWorkshop = nextMessage(
      connection.socket,
      (message) => message.type === "snapshot" &&
        message.players.some((entry) => entry.id === init.id && entry.x === 11 && entry.z === 124),
    );
    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: 11, y: 2.65, z: 124, yaw: 0 },
    }));
    await atWorkshop;
    player.inventory.set("oak_planks", 40);
    player.inventory.set("glass", 10);
    player.inventory.set("oak_door", 2);

    const builtSnapshot = nextMessage(
      connection.socket,
      (message) => message.type === "snapshot" &&
        message.vehicles?.some((vehicle) => vehicle.type === "boat" && vehicle.design?.name === "Blue Horizon"),
    );
    const built = nextMessage(connection.socket, (message) => message.type === "boat_result");
    connection.socket.send(JSON.stringify({
      type: "boat_build",
      design: { name: "Blue Horizon", size: "cutter", windows: 4, hullColor: "#4b6173", sailColor: "#426c83", cabin: true, sail: true },
    }));
    const result = await built;
    assert.equal(result.success, true);
    const snapshot = await builtSnapshot;
    const boat = snapshot.vehicles.find(({ type }) => type === "boat");
    assert.equal(boat.ownerId, init.id);
    assert.equal(boat.y, 0);
    assert.equal(player.inventory.get("oak_planks"), 16);
    assert.equal(player.inventory.get("glass"), 6);
    assert.equal(player.inventory.get("oak_door"), 1);

    const atBoat = nextMessage(
      connection.socket,
      (message) => message.type === "snapshot" &&
        message.players.some((entry) => entry.id === init.id && entry.x === boat.x && entry.z === boat.z),
    );
    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: boat.x, y: 2.65, z: boat.z, yaw: 0 },
    }));
    await atBoat;
    const entered = nextMessage(connection.socket, (message) => message.type === "vehicle_result");
    connection.socket.send(JSON.stringify({ type: "vehicle_enter", vehicleId: boat.id }));
    assert.equal((await entered).vehicleType, "boat");

    const sailed = nextMessage(
      connection.socket,
      (message) => message.type === "snapshot" &&
        message.vehicles?.some((vehicle) => vehicle.id === boat.id && vehicle.z === boat.z + 1),
    );
    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: boat.x, y: 2.65, z: boat.z + 1, yaw: 0 },
    }));
    await sailed;
    const rejectedLand = nextMessage(connection.socket, (message) => message.type === "move_rejected");
    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: 0, y: 2.65, z: 0, yaw: 0 },
    }));
    await rejectedLand;

    const saved = nextMessage(connection.socket, (message) => message.type === "save_result");
    connection.socket.send(JSON.stringify({ type: "save_room" }));
    assert.equal((await saved).saved, true);
    await server.close();
    server = createGameServer({ host: "127.0.0.1", port: 0, seed: 1, saveDirectory });
    assert.deepEqual(
      server.rooms.get(roomId).vehicles.get(boat.id).design,
      boat.design,
    );
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
    rmSync(saveDirectory, { recursive: true, force: true });
  }
});

test("the second tank driver can fire using the aim in the firing request", async () => {
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 117 });
  const sockets = [];
  try {
    const address = await server.listen();
    const first = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(first.socket);
    const firstLobby = nextMessage(first.socket, (message) => message.type === "lobby");
    await first.opened;
    await firstLobby;
    const created = nextMessage(first.socket, (message) => message.type === "room_created");
    first.socket.send(JSON.stringify({ type: "create_room", roomName: "Two Tank Test" }));
    const roomId = (await created).room.id;
    const firstStart = nextMessage(first.socket, (message) => message.type === "init");
    first.socket.send(JSON.stringify({ type: "start_room" }));
    const firstInit = await firstStart;
    const room = server.rooms.get(roomId);
    const targetTank = room.vehicles.get("city-tank-1");
    const targetPlayer = server.players.get(firstInit.id);
    targetPlayer.x = targetTank.x;
    targetPlayer.y = targetTank.y + 2.65;
    targetPlayer.z = targetTank.z;
    const enteredTarget = nextMessage(first.socket, (message) => message.type === "vehicle_result");
    first.socket.send(JSON.stringify({ type: "vehicle_enter", vehicleId: targetTank.id }));
    await enteredTarget;

    const second = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(second.socket);
    const secondLobby = nextMessage(second.socket, (message) => message.type === "lobby");
    await second.opened;
    await secondLobby;
    const secondInitMessage = nextMessage(second.socket, (message) => message.type === "init");
    second.socket.send(JSON.stringify({ type: "join_room", roomId }));
    const secondInit = await secondInitMessage;
    const shooter = server.players.get(secondInit.id);
    const shooterTank = room.vehicles.get("city-tank-5");
    shooter.x = shooterTank.x;
    shooter.y = shooterTank.y + 2.65;
    shooter.z = shooterTank.z;
    const enteredShooter = nextMessage(second.socket, (message) => message.type === "vehicle_result");
    second.socket.send(JSON.stringify({ type: "vehicle_enter", vehicleId: shooterTank.id }));
    await enteredShooter;

    shooterTank.turretYaw = Math.PI;
    shooterTank.turretPitch = 0;
    targetTank.health = 100;
    targetTank.maxHealth = 100;
    const hit = nextMessage(
      second.socket,
      (message) => message.type === "attack_result" && message.vehicleHit,
    );
    second.socket.send(JSON.stringify({
      type: "tank_fire",
      targetVehicleId: targetTank.id,
      aimYaw: 0,
      aimPitch: 0,
    }));
    const result = await hit;
    assert.equal(result.hit, true);
    assert.equal(result.destroyed, true);
    assert.equal(room.vehicles.has(targetTank.id), false);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});

test("fighter jets can be boarded, flown, and synchronized", async () => {
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 719 });
  const sockets = [];
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;
    const created = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Jet Test" }));
    const roomId = (await created).room.id;
    const started = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    const init = await started;
    const jet = init.vehicles.find(({ id }) => id === "airport-jet-1");
    assert.equal(jet.type, "jet");
    assert.ok(init.vehicles.filter(({ type }) => type === "jet").length >= 3);
    const player = server.players.get(init.id);
    player.x = jet.x;
    player.y = 2.65;
    player.z = jet.z;

    const entered = nextMessage(connection.socket, (message) => message.type === "vehicle_result");
    connection.socket.send(JSON.stringify({ type: "vehicle_enter", vehicleId: jet.id }));
    assert.equal((await entered).vehicleType, "jet");

    const tookOff = nextMessage(connection.socket, (message) => message.type === "fly_result");
    connection.socket.send(JSON.stringify({ type: "fly_toggle", enabled: true }));
    assert.equal((await tookOff).enabled, true);

    const flying = nextMessage(
      connection.socket,
      (message) => message.type === "snapshot" &&
        message.vehicles?.some((vehicle) => vehicle.id === jet.id && vehicle.y === 8),
    );
    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: jet.x, y: 10.65, z: jet.z, yaw: 0 },
    }));
    const snapshot = await flying;
    assert.equal(snapshot.vehicles.find(({ id }) => id === jet.id).type, "jet");
    assert.equal(snapshot.vehicles.find(({ id }) => id === jet.id).occupantId, init.id);
    assert.equal(server.rooms.get(roomId).vehicles.get(jet.id).y, 8);

    const secondConnection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(secondConnection.socket);
    const secondLobby = nextMessage(secondConnection.socket, (message) => message.type === "lobby");
    await secondConnection.opened;
    await secondLobby;
    const secondInitMessage = nextMessage(secondConnection.socket, (message) => message.type === "init");
    secondConnection.socket.send(JSON.stringify({ type: "join_room", roomId }));
    const secondInit = await secondInitMessage;
    const targetJet = server.rooms.get(roomId).vehicles.get("airport-jet-2");
    const targetPlayer = server.players.get(secondInit.id);
    targetPlayer.x = targetJet.x;
    targetPlayer.y = player.y;
    targetPlayer.z = targetJet.z;
    const targetEntered = nextMessage(secondConnection.socket, (message) => message.type === "vehicle_result");
    secondConnection.socket.send(JSON.stringify({ type: "vehicle_enter", vehicleId: targetJet.id }));
    await targetEntered;
    const targetTookOff = nextMessage(secondConnection.socket, (message) => message.type === "fly_result");
    secondConnection.socket.send(JSON.stringify({ type: "fly_toggle", enabled: true }));
    assert.equal((await targetTookOff).enabled, true);

    const room = server.rooms.get(roomId);
    player.x = jet.x;
    player.y = 20;
    player.z = jet.z;
    player.yaw = Math.PI;
    jet.x = player.x;
    jet.y = player.y - 2.65;
    jet.z = player.z;
    targetPlayer.x = targetJet.x;
    targetPlayer.y = player.y;
    targetPlayer.z = jet.z - 10;
    targetJet.x = targetPlayer.x;
    targetJet.y = targetPlayer.y - 2.65;
    targetJet.z = targetPlayer.z;
    for (const monster of room.monsters.values()) {
      monster.x = player.x + 40;
      monster.y = player.y;
      monster.z = player.z + 40;
    }
    const hit = nextMessage(
      connection.socket,
      (message) => message.type === "attack_result" && message.aircraft,
    );
    const hitNotice = nextMessage(
      secondConnection.socket,
      (message) => message.type === "attack_result" && message.hitByAircraft,
    );
    connection.socket.send(JSON.stringify({
      type: "aircraft_fire",
      aimYaw: Math.PI,
      aimPitch: 0,
    }));
    assert.equal((await hit).hit, true);
    await hitNotice;
    assert.equal(targetPlayer.health, 75);

    const landed = nextMessage(connection.socket, (message) => message.type === "fly_result");
    connection.socket.send(JSON.stringify({ type: "fly_toggle", enabled: false }));
    assert.equal((await landed).enabled, false);
    assert.equal(jet.airborne, false);
    assert.equal(player.y, terrainHeightAt(player.x, player.z, room.seed) + 2.65);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});

test("planes can fire their guns at ground enemies", async () => {
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 921 });
  const sockets = [];
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;
    const created = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Plane Gun Test" }));
    const roomId = (await created).room.id;
    const started = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    const init = await started;
    const room = server.rooms.get(roomId);
    const player = server.players.get(init.id);
    const plane = room.vehicles.get("airport-plane");
    player.x = plane.x;
    player.y = plane.y + 2.65;
    player.z = plane.z;
    const entered = nextMessage(connection.socket, (message) => message.type === "vehicle_result");
    connection.socket.send(JSON.stringify({ type: "vehicle_enter", vehicleId: plane.id }));
    await entered;
    const tookOff = nextMessage(connection.socket, (message) => message.type === "fly_result");
    connection.socket.send(JSON.stringify({ type: "fly_toggle", enabled: true }));
    assert.equal((await tookOff).enabled, true);

    const moved = nextMessage(
      connection.socket,
      (message) => message.type === "snapshot" &&
        message.vehicles?.some((vehicle) => vehicle.id === plane.id && vehicle.airborne),
    );
    connection.socket.send(JSON.stringify({
      type: "move",
      position: { x: plane.x, y: 20, z: plane.z, yaw: 0 },
    }));
    await moved;
    const monster = room.monsters.get("monster-crab");
    for (const candidate of room.monsters.values()) {
      if (candidate === monster) continue;
      candidate.x = player.x + 40;
      candidate.y = player.y;
      candidate.z = player.z + 40;
    }
    monster.x = player.x;
    monster.y = player.y;
    monster.z = player.z + 12;
    player.lastAttackAt = 0;

    const shot = nextMessage(
      connection.socket,
      (message) => message.type === "attack_result" && message.aircraft,
    );
    connection.socket.send(JSON.stringify({
      type: "aircraft_fire",
      aimYaw: 0,
      aimPitch: 0,
    }));
    const result = await shot;
    assert.equal(result.hit, true);
    assert.equal(result.targetId, monster.id);
    assert.equal(monster.health, monster.maxHealth - 25);
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
    assert.equal(init.coins, 100);
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
      coins: 125,
      xpGained: 50,
      coinsGained: 25,
    });
    assert.equal(player.xp, 50);
    assert.equal(player.coins, 125);

    player.x = 40;
    player.z = 40;
    const model = MODEL_ITEM_BY_ID.get("model_plant_001");
    const buyResult = nextMessage(connection.socket, (message) => message.type === "buy_result");
    const balance = nextMessage(connection.socket, (message) => message.type === "currency");
    const inventory = nextMessage(connection.socket, (message) => message.type === "inventory");
    connection.socket.send(JSON.stringify({ type: "buy_model", item: model.id }));
    assert.equal((await buyResult).item, model.id);
    assert.equal((await balance).coins, 125 - model.price);
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
    assert.equal(initial.animals.length, 26);
    assert.equal(initial.animals.filter(({ flying }) => flying).length, 6);
    assert.ok(initial.animals.some(({ name }) => name === "Sunstreak"));
    const room = server.rooms.get(roomId);
    assert.ok(room.monsters.has("monster-spider"));
    assert.ok(room.monsters.has("monster-golem"));
    assert.ok(room.monsters.has("monster-phantom"));
    assert.equal(room.monsters.get("monster-spider").active, false);
    assert.equal(initial.inventory.length, BLOCK_TYPES.size + MODEL_CATALOG.length);
    assert.ok(initial.inventory.every(([, count]) => count === 64));
    assert.equal(initial.coins, 20_000);
    assert.equal(initial.bots.length, 3);
    assert.ok(initial.vehicles.some((vehicle) => vehicle.id === "airport-plane"));
    assert.equal(initial.vehicles.filter(({ type }) => type === "jet").length, 3);
    assert.ok(initial.vehicles.filter(({ type }) => type === "tank").length >= 8);
    assert.ok(initial.vehicles.some((vehicle) => vehicle.id === "airport-car"));
    assert.ok(initial.vehicles.filter((vehicle) => vehicle.id.startsWith("city-car-")).length > 5);
    assert.ok(new Set(initial.vehicles.filter(({ id }) => id.startsWith("city-car-")).map(({ color }) => color)).size >= 8);
    assert.equal(initial.vehicles.filter(({ type }) => type === "police").length, 3);
    assert.equal(getBaseBlockAt(CITY_POLICE_STATION.x - 8, 1, CITY_POLICE_STATION.z, initial.seed), "white_concrete");
    assert.equal(getBaseBlockAt(CITY_POLICE_STATION.x, 7, CITY_POLICE_STATION.z, initial.seed), "blue_concrete");
    assert.equal(getBaseBlockAt(CITY_POLICE_STATION.x, 1, CITY_POLICE_STATION.z - 8, initial.seed), "oak_door");
    assert.deepEqual(initial.properties, []);

    const property = listCityProperties(initial.seed)[0];
    const player = server.players.get(initial.id);
    player.x = property.entranceX;
    player.y = terrainHeightAt(property.entranceX, property.entranceZ, initial.seed) + 2.65;
    player.z = property.entranceZ;
    const doorPosition = { x: property.x, y: 1, z: property.entranceZ + 1 };
    assert.equal(getBaseBlockAt(doorPosition.x, doorPosition.y, doorPosition.z, initial.seed), "oak_door");
    const lockedDoor = nextMessage(firstPlayer, (message) => message.type === "door_result");
    firstPlayer.send(JSON.stringify({ type: "door_toggle", position: doorPosition }));
    assert.match((await lockedDoor).message, /Locked: purchase/);
    assert.equal(server.rooms.get(roomId).openDoors.size, 0);

    const purchasedHome = nextMessage(firstPlayer, (message) => message.type === "home_result");
    firstPlayer.send(JSON.stringify({ type: "buy_home" }));
    const purchaseResult = await purchasedHome;
    assert.equal(purchaseResult.success, true);
    assert.equal(purchaseResult.properties[0].id, property.id);
    assert.equal(purchaseResult.properties[0].ownerName, player.name);
    const openedDoor = nextMessage(firstPlayer, (message) => message.type === "door_result");
    firstPlayer.send(JSON.stringify({ type: "door_toggle", position: doorPosition }));
    assert.equal((await openedDoor).open, true);
    assert.equal(server.rooms.get(roomId).openDoors.has(`${doorPosition.x},1,${doorPosition.z}`), true);
    const closedDoor = nextMessage(firstPlayer, (message) => message.type === "door_result");
    firstPlayer.send(JSON.stringify({ type: "door_toggle", position: doorPosition }));
    assert.equal((await closedDoor).open, false);
    const reopenedDoor = nextMessage(firstPlayer, (message) => message.type === "door_result");
    firstPlayer.send(JSON.stringify({ type: "door_toggle", position: doorPosition }));
    assert.equal((await reopenedDoor).open, true);

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
    assert.equal(crafted.items.find(([item]) => item === "oak_log")[1], 63);
    assert.equal(crafted.items.find(([item]) => item === "oak_planks")[1], 68);

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
    assert.equal((await minedInventory).items.find(([item]) => item === "dirt")[1], MAX_STACK_SIZE + 1);

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
    assert.equal((await placedInventory).items.find(([item]) => item === "stone")[1], 64);

    const droppedInventory = nextMessage(firstPlayer, (message) => message.type === "inventory");
    const droppedSnapshot = nextMessage(
      firstPlayer,
      (message) => message.type === "snapshot" && message.drops?.length > 0,
    );
    firstPlayer.send(JSON.stringify({ type: "drop", item: "oak_planks", count: 1 }));
    assert.equal((await droppedInventory).items.find(([item]) => item === "oak_planks")[1], 67);
    const drop = (await droppedSnapshot).drops[0];

    const pickedInventory = nextMessage(firstPlayer, (message) => message.type === "inventory");
    firstPlayer.send(
      JSON.stringify({
        type: "move",
        position: { x: drop.x, z: drop.z, yaw: 0 },
      }),
    );
    firstPlayer.send(JSON.stringify({ type: "pickup" }));
    assert.equal((await pickedInventory).items.find(([item]) => item === "oak_planks")[1], 68);

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
    assert.equal(joined.inventory.length, BLOCK_TYPES.size + MODEL_CATALOG.length);
    assert.equal(joined.coins, 20_000);
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
    assert.equal(server.players.get(initial.id).coins, 20_025);

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
    const isolatedInventory = new Map(isolatedInit.inventory);
    assert.equal(isolatedInventory.get("iron_armor"), 1);
    assert.equal(isolatedInventory.get("wooden_sword"), 1);
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
    assert.equal((await inventoryMessage).items.find(([item]) => item === "oak_planks")[1], 68);

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

test("deletes a saved world only after every player has left", async () => {
  const saveDirectory = mkdtempSync(join(tmpdir(), "voxland-delete-save-"));
  const server = createGameServer({ host: "127.0.0.1", port: 0, seed: 83, saveDirectory });
  const sockets = [];
  try {
    const address = await server.listen();
    const connection = connect(`ws://127.0.0.1:${address.port}/ws`);
    sockets.push(connection.socket);
    const lobby = nextMessage(connection.socket, (message) => message.type === "lobby");
    await connection.opened;
    await lobby;

    const created = nextMessage(connection.socket, (message) => message.type === "room_created");
    connection.socket.send(JSON.stringify({ type: "create_room", roomName: "Delete Test" }));
    const roomId = (await created).room.id;
    const started = nextMessage(connection.socket, (message) => message.type === "init");
    connection.socket.send(JSON.stringify({ type: "start_room" }));
    await started;
    const saved = nextMessage(connection.socket, (message) => message.type === "save_result");
    connection.socket.send(JSON.stringify({ type: "save_room" }));
    assert.equal((await saved).saved, true);

    const activeDelete = await server.deleteSavedWorld(roomId);
    assert.equal(activeDelete.success, false);
    assert.equal(activeDelete.status, 409);
    assert.equal(existsSync(join(saveDirectory, `${roomId}.json`)), true);

    const left = nextMessage(connection.socket, (message) => message.type === "room_left");
    connection.socket.send(JSON.stringify({ type: "leave_room" }));
    await left;
    const deleted = await server.deleteSavedWorld(roomId);
    assert.equal(deleted.success, true);
    assert.equal(server.rooms.has(roomId), false);
    assert.equal(existsSync(join(saveDirectory, `${roomId}.json`)), false);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
    rmSync(saveDirectory, { recursive: true, force: true });
  }
});

test("blocks banned IP addresses from opening a JesseCraft websocket", async () => {
  const accessControl = {
    isBlocked: ip => ip === "203.0.113.9",
    connected: () => {
      throw new Error("Blocked IP should not become a player.");
    },
    disconnected() {}
  };
  const server = createGameServer({
    host: "127.0.0.1",
    port: 0,
    seed: 83,
    accessControl,
    resolveClientIp: () => "203.0.113.9"
  });
  try {
    const address = await server.listen();
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    socket.on("error", () => {});
    const rejection = new Promise((resolve) => {
      socket.once("unexpected-response", (_request, response) => resolve(response.statusCode));
    });
    assert.equal(await rejection, 403);
    assert.equal(server.players.size, 0);
  } finally {
    await server.close();
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
