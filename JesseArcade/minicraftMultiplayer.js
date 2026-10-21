const { WebSocketServer } = require('ws');

const MINICRAFT_PATH = '/ws/minicraft';
const ROOM_CODE_PATTERN = /^[A-Za-z0-9_-]{3,24}$/;
const MAX_PLAYERS_PER_ROOM = 8;
const MAX_EDITS_PER_ROOM = 200000;
const MAX_BLOCK_ID = 255;
const MAX_COORDINATE = 10000000;
const MAX_HEIGHT = 512;
const MAX_ENTITIES_PER_ROOM = 64;
const ENTITY_KINDS = new Set(['horse', 'car', 'bot']);
const ENTITY_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** 32-bit FNV-1a hash, so every client given the same room code builds the same world */
function seedForRoom(code) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) {
    hash ^= code.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** World name shown in the lobby list; defaults to 'World' */
function parseWorldName(value) {
  if (typeof value !== 'string') return 'World';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) || 'World';
}

const isInteger = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max;

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

function parseBlock(message) {
  const { x, y, z, id } = message;
  if (!isInteger(x, -MAX_COORDINATE, MAX_COORDINATE)) return null;
  if (!isInteger(z, -MAX_COORDINATE, MAX_COORDINATE)) return null;
  if (!isInteger(y, 0, MAX_HEIGHT)) return null;
  if (!isInteger(id, 0, MAX_BLOCK_ID)) return null;
  return { x, y, z, id };
}

/** Horse, car or bot state that a player's client drives and the room shares */
function parseEntity(message) {
  const { id, kind, x, y, z, yaw } = message;
  if (typeof id !== 'string' || !ENTITY_ID_PATTERN.test(id)) return null;
  if (!ENTITY_KINDS.has(kind)) return null;
  if (![x, y, z, yaw].every(isFiniteNumber)) return null;
  const color = typeof message.color === 'string' && COLOR_PATTERN.test(message.color) ? message.color : null;
  const name = typeof message.name === 'string'
    ? message.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20) || null
    : null;
  return { id, kind, x, y, z, yaw, color, name };
}

function parseMove(message) {
  const { x, y, z, yaw, pitch } = message;
  if (![x, y, z, yaw, pitch].every(isFiniteNumber)) return null;
  return { x, y, z, yaw, pitch };
}

/**
 * Minicraft multiplayer rooms. Each room has a seed derived from its code,
 * the block edits made in it and the players currently inside. Rooms exist
 * only while someone is in them.
 *
 * Attaches to the arcade's HTTP server beside the other games' sockets and
 * uses the same IP access control.
 */
function createMinicraftServer({ httpServer, accessControl, resolveClientIp = (request) => request.socket.remoteAddress }) {
  const rooms = new Map();
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 8192 });

  const send = (socket, message) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };

  const broadcast = (room, message, except = null) => {
    const encoded = JSON.stringify(message);
    for (const member of room.members) {
      if (member !== except && member.readyState === member.OPEN) member.send(encoded);
    }
  };

  const leaveRoom = (socket) => {
    const room = socket.minicraftRoom;
    if (!room) return;
    socket.minicraftRoom = null;
    room.members.delete(socket);
    const id = socket.minicraftPlayer?.id;
    if (id) room.players.delete(id);
    socket.minicraftPlayer = null;
    if (room.members.size === 0) {
      rooms.delete(room.code);
      return;
    }
    // Hand the horses, cars and bots this player was driving to a remaining member
    const successor = [...room.members][0].minicraftPlayer?.id;
    for (const entity of room.entities.values()) {
      if (entity.owner !== id) continue;
      entity.owner = successor;
      broadcast(room, { type: 'entity_owner', id: entity.id, owner: successor });
    }
    if (id) broadcast(room, { type: 'player_left', id });
  };

  const handleJoin = (socket, message) => {
    if (socket.minicraftRoom) return;
    const code = typeof message.room === 'string' ? message.room : '';
    const id = typeof message.id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(message.id) ? message.id : '';
    const name = typeof message.name === 'string'
      ? message.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20) || 'Player'
      : 'Player';
    if (!ROOM_CODE_PATTERN.test(code) || !id) {
      send(socket, { type: 'error', message: 'Invalid room code or player id.' });
      return;
    }

    let room = rooms.get(code);
    if (!room) {
      if (!message.create) {
        send(socket, { type: 'error', message: 'No lobby with that code. Check the code or create a new lobby.' });
        return;
      }
      room = {
        code,
        world: parseWorldName(message.world),
        host: name,
        seed: seedForRoom(code),
        edits: new Map(),
        members: new Set(),
        players: new Map(),
        entities: new Map(),
      };
      rooms.set(code, room);
    }
    if (room.members.size >= MAX_PLAYERS_PER_ROOM) {
      send(socket, { type: 'error', message: 'This room is full.' });
      return;
    }

    const player = { id, name, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    socket.minicraftRoom = room;
    socket.minicraftPlayer = player;
    room.members.add(socket);
    room.players.set(id, player);

    send(socket, {
      type: 'welcome',
      code: room.code,
      world: room.world,
      host: room.host,
      seed: room.seed,
      edits: [...room.edits].map(([key, blockId]) => [...key.split(',').map(Number), blockId]),
      players: [...room.players.values()].filter((other) => other !== player),
      entities: [...room.entities.values()],
    });
    broadcast(room, { type: 'player_joined', player }, socket);
  };

  const handleMessage = (socket, raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') return;

    if (message.type === 'join') {
      handleJoin(socket, message);
      return;
    }

    if (message.type === 'list') {
      send(socket, {
        type: 'rooms',
        rooms: [...rooms.values()].map((room) => ({
          code: room.code,
          world: room.world,
          host: room.host,
          players: room.members.size,
          maxPlayers: MAX_PLAYERS_PER_ROOM,
        })),
      });
      return;
    }

    const room = socket.minicraftRoom;
    if (!room) return;

    if (message.type === 'move') {
      const move = parseMove(message);
      if (!move) return;
      Object.assign(socket.minicraftPlayer, move);
      broadcast(room, { type: 'player_moved', id: socket.minicraftPlayer.id, ...move }, socket);
    } else if (message.type === 'block') {
      const block = parseBlock(message);
      if (!block) return;
      const key = `${block.x},${block.y},${block.z}`;
      if (!room.edits.has(key) && room.edits.size >= MAX_EDITS_PER_ROOM) {
        send(socket, { type: 'error', message: 'This room has reached its edit limit.' });
        return;
      }
      room.edits.set(key, block.id);
      broadcast(room, { type: 'block', ...block }, socket);
    } else if (message.type === 'entity') {
      const entity = parseEntity(message);
      if (!entity) return;
      const playerId = socket.minicraftPlayer.id;
      const existing = room.entities.get(entity.id);
      if (existing && existing.owner !== playerId) {
        // Someone else already drives this entity: send the authoritative copy back
        send(socket, { type: 'entity', ...existing });
        return;
      }
      if (!existing && room.entities.size >= MAX_ENTITIES_PER_ROOM) return;
      const stored = { ...entity, owner: playerId };
      room.entities.set(entity.id, stored);
      broadcast(room, { type: 'entity', ...stored }, socket);
    }
  };

  webSocketServer.on('connection', (socket) => {
    socket.on('message', (raw) => handleMessage(socket, raw));
    socket.on('close', () => leaveRoom(socket));
    socket.on('error', () => leaveRoom(socket));
  });

  // Several WebSocket servers share this HTTP server, and each one aborts
  // upgrades that are not for its own path. Route upgrades here by path and
  // hand every other request to the listeners that were already attached.
  const existingUpgradeListeners = httpServer.rawListeners('upgrade');
  httpServer.removeAllListeners('upgrade');
  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = (request.url || '').split('?')[0];
    if (pathname !== MINICRAFT_PATH) {
      for (const listener of existingUpgradeListeners) listener.call(httpServer, request, socket, head);
      return;
    }
    let clientIp;
    try {
      clientIp = resolveClientIp(request);
    } catch {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    if (accessControl?.isBlocked(clientIp)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (ws) => {
      webSocketServer.emit('connection', ws, request);
    });
  });

  return {
    metrics: () => ({
      activeRooms: rooms.size,
      playersOnline: [...rooms.values()].reduce((total, room) => total + room.members.size, 0),
    }),
    close() {
      for (const room of rooms.values()) {
        for (const member of room.members) member.terminate();
      }
      rooms.clear();
      return new Promise((resolve) => webSocketServer.close(() => resolve()));
    },
  };
}

module.exports = { createMinicraftServer, seedForRoom, MINICRAFT_PATH };
