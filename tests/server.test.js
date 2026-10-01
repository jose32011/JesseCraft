import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer } from "../server/index.js";
import { BLOCK_TYPES } from "../server/world.js";
import { WebSocket } from "ws";

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
      [[editPosition.x, editPosition.y, editPosition.z], "stone"],
    ]);
    assert.equal(server.rooms.get(roomId).blockChanges.size, 2);

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
    assert.deepEqual(beachTeleport.position, { x: 0, z: 124, yaw: 0 });
    const monsterAttack = nextMessage(firstPlayer, (message) => message.type === "attack_result");
    firstPlayer.send(JSON.stringify({ type: "attack", targetId: "monster-crab" }));
    const monsterHit = await monsterAttack;
    assert.equal(monsterHit.hit, true);
    assert.equal(monsterHit.monster, true);
    assert.equal(monsterHit.health, 40);

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
    assert.deepEqual(restored.position, { x: 24, z: 37, yaw: 1.25 });
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
    assert.equal((await inventory).items.find(([item]) => item === "raw_fish")[1], 1);

    const cooldown = nextMessage(connection.socket, (message) => message.type === "fish_result");
    connection.socket.send(JSON.stringify({ type: "fish" }));
    assert.equal((await cooldown).caught, false);
    assert.equal(server.rooms.get(roomId).members.size, 1);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});
