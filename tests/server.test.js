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
    assert.equal((await minedInventory).items.find(([item]) => item === "dirt")[1], 1);

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
