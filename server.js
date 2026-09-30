import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 3000;
const maxPlayers = 2;
const rooms = new Map();
const clients = new Map();

const app = express();
app.get('/health', (_request, response) => response.json({ ok: true }));

const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  // Let the React app handle client-side routes in production.
  app.get(/^(?!\/ws|\/health).*/, (_request, response) => response.sendFile(join(distPath, 'index.html')));
}

const server = createServer(app);
const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

function send(client, message) {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
}

function roomSummary(room) {
  return {
    id: room.id,
    name: room.name,
    hostName: room.host.name,
    players: room.players.length,
  };
}

function broadcastRoomList() {
  const roomList = [...rooms.values()].map(roomSummary);
  for (const client of clients.keys()) send(client, { type: 'room_list', rooms: roomList });
}

function error(client, message) {
  send(client, { type: 'error', message });
}

function validName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 18;
}

function validRoomName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 40;
}

function createRoomId() {
  let id;
  do {
    id = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(id));
  return id;
}

function leaveRoom(client) {
  const roomId = clients.get(client);
  clients.delete(client);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  room.players = room.players.filter((player) => player.client !== client);
  if (room.players.length === 0) {
    rooms.delete(roomId);
  } else if (room.host.client === client) {
    room.host = room.players[0];
  }
  broadcastRoomList();
}

function handleMessage(client, message) {
  if (!message || typeof message.type !== 'string') {
    error(client, 'Message must include a type.');
    return;
  }

  if (message.type === 'list_rooms') {
    send(client, { type: 'room_list', rooms: [...rooms.values()].map(roomSummary) });
    return;
  }

  if (message.type === 'leave_room') {
    leaveRoom(client);
    send(client, { type: 'room_left' });
    return;
  }

  if (!validName(message.playerName)) {
    error(client, 'Enter a duelist name between 1 and 18 characters.');
    return;
  }
  const playerName = message.playerName.trim();

  if (message.type === 'create_room') {
    if (clients.get(client)) {
      error(client, 'Leave your current room before creating another room.');
      return;
    }
    const name = message.roomName || `${playerName}'s Room`;
    if (!validRoomName(name)) {
      error(client, 'Room names must be between 1 and 40 characters.');
      return;
    }
    const player = { client, name: playerName };
    const room = { id: createRoomId(), name: name.trim(), host: player, players: [player] };
    rooms.set(room.id, room);
    clients.set(client, room.id);
    send(client, { type: 'room_created', room: roomSummary(room) });
    broadcastRoomList();
    return;
  }

  if (message.type === 'join_room') {
    if (clients.get(client)) {
      error(client, 'Leave your current room before joining another room.');
      return;
    }
    if (typeof message.roomId !== 'string' || !/^[A-Z0-9]{6}$/.test(message.roomId)) {
      error(client, 'Enter a valid room code.');
      return;
    }
    const room = rooms.get(message.roomId.toUpperCase());
    if (!room) {
      error(client, 'That room no longer exists.');
      return;
    }
    if (room.players.length >= maxPlayers) {
      error(client, 'That room is full.');
      return;
    }
    const player = { client, name: playerName };
    room.players.push(player);
    clients.set(client, room.id);
    const summary = roomSummary(room);
    for (const roomPlayer of room.players) {
      send(roomPlayer.client, { type: 'room_joined', room: summary });
    }
    broadcastRoomList();
    if (room.players.length === maxPlayers) {
      for (const roomPlayer of room.players) send(roomPlayer.client, { type: 'room_started', room: summary });
    }
    return;
  }

  error(client, 'Unknown message type.');
}

webSocketServer.on('connection', (client) => {
  clients.set(client, null);
  client.on('message', (data) => {
    try {
      handleMessage(client, JSON.parse(data.toString()));
    } catch {
      error(client, 'Messages must be valid JSON.');
    }
  });
  client.on('close', () => leaveRoom(client));
  client.on('error', () => leaveRoom(client));
  send(client, { type: 'connected' });
});

server.on('upgrade', (request, socket, head) => {
  if (request.url !== '/ws') {
    socket.destroy();
    return;
  }
  webSocketServer.handleUpgrade(request, socket, head, (client) => {
    webSocketServer.emit('connection', client, request);
  });
});

server.listen(port, () => {
  console.log(`Duel Links server listening on port ${port}`);
});
