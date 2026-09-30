import test from "node:test";
import assert from "node:assert/strict";
import { createGameServer } from "../server/index.js";
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
    firstPlayer.send(JSON.stringify({ type: "create_room", roomName: "Test World" }));
    const createdRoom = await createdRoomMessage;
    const roomId = createdRoom.room.id;
    const initialMessage = nextMessage(firstPlayer, (message) => message.type === "init");
    firstPlayer.send(JSON.stringify({ type: "start_room" }));
    const initial = await initialMessage;
    assert.equal(initial.type, "init");
    assert.equal(initial.seed, 481516);
    assert.equal(initial.chunkSize, 16);
    assert.equal(initial.blocks, undefined);
    assert.equal(initial.blockChanges, undefined);
    assert.deepEqual(initial.inventory, [
      ["brick", 4],
      ["ice", 4],
      ["oak_log", 3],
      ["oak_planks", 8],
      ["obsidian", 4],
      ["sand", 4],
      ["snow", 4],
      ["stone", 4],
    ]);
    assert.equal(initial.bots.length, 3);

    const initialChunkMessage = nextMessage(firstPlayer, (message) => message.type === "chunk");
    firstPlayer.send(JSON.stringify({ type: "chunk", x: 0, z: 0 }));
    assert.deepEqual((await initialChunkMessage).blockChanges, []);

    const craftedItems = nextMessage(firstPlayer, (message) => message.type === "inventory");
    firstPlayer.send(JSON.stringify({ type: "craft", recipe: "planks" }));
    assert.deepEqual(await craftedItems, {
      type: "inventory",
      items: [
        ["brick", 4],
        ["ice", 4],
        ["oak_log", 2],
        ["oak_planks", 12],
        ["obsidian", 4],
        ["sand", 4],
        ["snow", 4],
        ["stone", 4],
      ],
    });

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
    assert.equal((await placedInventory).items.find(([item]) => item === "stone")[1], 3);

    const droppedInventory = nextMessage(firstPlayer, (message) => message.type === "inventory");
    const droppedSnapshot = nextMessage(
      firstPlayer,
      (message) => message.type === "snapshot" && message.drops?.length > 0,
    );
    firstPlayer.send(JSON.stringify({ type: "drop", item: "oak_planks", count: 1 }));
    assert.equal((await droppedInventory).items.find(([item]) => item === "oak_planks")[1], 11);
    const drop = (await droppedSnapshot).drops[0];

    const pickedInventory = nextMessage(firstPlayer, (message) => message.type === "inventory");
    firstPlayer.send(
      JSON.stringify({
        type: "move",
        position: { x: drop.x, z: drop.z, yaw: 0 },
      }),
    );
    firstPlayer.send(JSON.stringify({ type: "pickup" }));
    assert.equal((await pickedInventory).items.find(([item]) => item === "oak_planks")[1], 12);

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
    assert.deepEqual(joined.inventory, [
      ["brick", 4],
      ["ice", 4],
      ["oak_log", 3],
      ["oak_planks", 8],
      ["obsidian", 4],
      ["sand", 4],
      ["snow", 4],
      ["stone", 4],
    ]);
    const joinedChunkChanges = nextMessage(secondPlayer, (message) => message.type === "chunk");
    secondPlayer.send(JSON.stringify({ type: "chunk", x: 0, z: 0 }));
    assert.deepEqual((await joinedChunkChanges).blockChanges, [
      [[undergroundPosition.x, undergroundPosition.y, undergroundPosition.z], null],
      [[editPosition.x, editPosition.y, editPosition.z], "stone"],
    ]);
    assert.equal(server.rooms.get(roomId).blockChanges.size, 2);

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
    await isolatedInitMessage;
    assert.equal(server.rooms.get(isolatedRoomId).blockChanges.size, 0);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});
