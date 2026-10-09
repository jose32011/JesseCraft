const BOARD_END = 100;
const SNAKES = new Map([
  [16, 6], [47, 26], [49, 11], [56, 53], [62, 19],
  [64, 60], [87, 24], [93, 73], [95, 75], [99, 78]
]);
const LADDERS = new Map([
  [2, 38], [7, 14], [8, 31], [15, 26], [21, 42],
  [28, 84], [36, 44], [51, 67], [71, 91], [80, 100]
]);
const PLAYER_COLORS = ['red', 'blue', 'green', 'yellow'];

class SnakesLaddersRoom {
  constructor(roomId, random = Math.random) {
    this.roomId = roomId;
    this.random = random;
    this.players = [];
    this.maxPlayers = null;
    this.started = false;
    this.turnIndex = 0;
    this.lastRoll = null;
    this.winner = null;
    this.resultReason = null;
    this.status = 'Waiting for players to join.';
  }

  join(playerToken, playerName, socket, playerCount = 2) {
    const existing = this.playerForToken(playerToken);
    if (existing) {
      if (existing.socket?.connected && existing.socket !== socket) {
        existing.socket.emit('snakesLaddersSessionReplaced');
        existing.socket.disconnect(true);
      }
      existing.name = playerName;
      existing.socket = socket;
      existing.connected = true;
      this.updateStatus();
      return { success: true, color: existing.color, reconnected: true };
    }
    if (this.started) {
      return { success: false, message: 'This Snakes and Ladders game has already started.' };
    }
    if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 4) {
      return { success: false, message: 'Choose between two and four players.' };
    }
    if (this.maxPlayers !== null && this.maxPlayers !== playerCount) {
      return { success: false, message: `This room is set up for ${this.maxPlayers} players.` };
    }
    if (this.players.length >= playerCount) {
      return { success: false, message: 'This room already has all its players.' };
    }

    this.maxPlayers = playerCount;
    const player = {
      id: playerToken,
      name: playerName,
      color: PLAYER_COLORS[this.players.length],
      position: 0,
      socket,
      connected: true
    };
    this.players.push(player);
    if (this.players.length === this.maxPlayers) this.started = true;
    this.updateStatus();
    return { success: true, color: player.color, reconnected: false };
  }

  playerForToken(playerToken) {
    return this.players.find(player => player.id === playerToken) || null;
  }

  currentPlayer() {
    return this.players[this.turnIndex];
  }

  roll(playerToken) {
    const player = this.playerForToken(playerToken);
    if (!this.started || this.winner || !player || player !== this.currentPlayer()) {
      return { success: false, message: 'It is not your turn to roll.' };
    }

    const roll = Math.floor(this.random() * 6) + 1;
    this.lastRoll = roll;
    const destination = player.position + roll;
    if (destination <= BOARD_END) {
      const landed = LADDERS.has(destination)
        ? LADDERS.get(destination)
        : SNAKES.has(destination) ? SNAKES.get(destination) : destination;
      player.position = landed;
      if (landed === BOARD_END) {
        this.winner = player.name;
        this.status = `${player.name} reached 100 and wins!`;
        return { success: true, roll, position: landed, gameOver: true };
      }
      if (LADDERS.has(destination)) {
        this.status = `${player.name} climbed a ladder from ${destination} to ${landed}.`;
      } else if (SNAKES.has(destination)) {
        this.status = `${player.name} slid down a snake from ${destination} to ${landed}.`;
      } else {
        this.status = `${player.name} rolled ${roll} and moved to ${landed}.`;
      }
    } else {
      this.status = `${player.name} rolled ${roll}. They need an exact roll to reach 100.`;
    }

    this.turnIndex = (this.turnIndex + 1) % this.players.length;
    this.status += ` ${this.currentPlayer().name}'s turn.`;
    return { success: true, roll, position: player.position, gameOver: false };
  }

  resign(playerToken, socket) {
    const player = this.playerForToken(playerToken);
    if (!this.started || this.winner || !player || player.socket !== socket) return false;
    const winner = this.players.find(candidate => candidate !== player);
    if (!winner) return false;
    this.winner = winner.name;
    this.resultReason = 'resignation';
    this.status = `${player.name} resigned. ${winner.name} wins.`;
    return true;
  }

  leave(playerToken, socket) {
    const player = this.playerForToken(playerToken);
    if (!player || player.socket !== socket) return false;
    player.socket = null;
    player.connected = false;
    if (!this.winner) this.status = `${player.name} left. They can rejoin this room.`;
    return true;
  }

  disconnect(playerToken, socket) {
    return this.leave(playerToken, socket);
  }

  updateStatus() {
    if (this.winner) return;
    if (!this.started) {
      this.status = this.players.length
        ? `Waiting for ${this.maxPlayers - this.players.length} more player${this.maxPlayers - this.players.length === 1 ? '' : 's'}.`
        : 'Waiting for players to join.';
      return;
    }
    this.status = `${this.currentPlayer().name}'s turn to roll.`;
  }

  stateFor(playerToken) {
    const player = this.playerForToken(playerToken);
    if (!player) return null;
    return {
      roomId: this.roomId,
      started: this.started,
      expectedPlayers: this.maxPlayers,
      players: this.players.map(candidate => ({
        name: candidate.name,
        color: candidate.color,
        position: candidate.position,
        connected: candidate.connected
      })),
      yourColor: player.color,
      currentPlayerName: this.started ? this.currentPlayer().name : null,
      yourTurn: this.started && this.currentPlayer() === player,
      canRoll: this.started && !this.winner && this.currentPlayer() === player,
      lastRoll: this.lastRoll,
      winner: this.winner,
      resultReason: this.resultReason,
      gameOver: Boolean(this.winner),
      status: this.status
    };
  }
}

function registerSnakesLaddersHandlers(io) {
  const rooms = Object.create(null);

  function broadcast(room) {
    room.players.forEach(player => {
      if (player.socket?.connected) {
        player.socket.emit('snakesLaddersState', room.stateFor(player.id));
      }
    });
  }

  io.on('connection', socket => {
    socket.on('joinSnakesLadders', ({ roomId, playerName, playerToken, playerCount } = {}) => {
      const safeRoomId = typeof roomId === 'string' ? roomId.trim() : '';
      const safeName = typeof playerName === 'string'
        ? playerName.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 20)
        : '';
      const safeToken = typeof playerToken === 'string' &&
        /^[a-zA-Z0-9-]{16,64}$/.test(playerToken) ? playerToken : '';
      if (!safeRoomId || safeRoomId.length > 40 || !safeName || !safeToken ||
          !Number.isInteger(playerCount) || playerCount < 2 || playerCount > 4) {
        socket.emit('snakesLaddersJoined', {
          success: false,
          message: 'Enter a name and room ID, choose 2–4 players, and allow browser storage so you can reconnect.'
        });
        return;
      }

      const room = rooms[safeRoomId] ||
        (rooms[safeRoomId] = new SnakesLaddersRoom(safeRoomId));
      const result = room.join(safeToken, safeName, socket, playerCount);
      if (!result.success) {
        socket.emit('snakesLaddersJoined', result);
        return;
      }
      socket.data.snakesLaddersRoomId = safeRoomId;
      socket.data.snakesLaddersPlayerToken = safeToken;
      socket.emit('snakesLaddersJoined', { ...result, roomId: safeRoomId });
      broadcast(room);
    });

    socket.on('snakesLaddersRoll', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.snakesLaddersPlayerToken;
      const player = room?.playerForToken(token);
      if (!room || socket.data.snakesLaddersRoomId !== roomId ||
          !player || player.socket !== socket) {
        socket.emit('snakesLaddersError', 'Rejoin the room before rolling.');
        return;
      }
      const result = room.roll(token);
      if (!result.success) socket.emit('snakesLaddersError', result.message);
      broadcast(room);
    });

    socket.on('snakesLaddersResign', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.snakesLaddersPlayerToken;
      const player = room?.playerForToken(token);
      if (!room || socket.data.snakesLaddersRoomId !== roomId ||
          !player || player.socket !== socket || !room.resign(token, socket)) {
        socket.emit('snakesLaddersError', 'You can only resign an active game.');
        return;
      }
      broadcast(room);
    });

    socket.on('leaveSnakesLadders', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.snakesLaddersPlayerToken;
      if (room && socket.data.snakesLaddersRoomId === roomId &&
          room.leave(token, socket)) {
        socket.leave(`snakes-ladders:${roomId}`);
        delete socket.data.snakesLaddersRoomId;
        delete socket.data.snakesLaddersPlayerToken;
        broadcast(room);
      }
    });

    socket.on('disconnect', () => {
      const room = rooms[socket.data.snakesLaddersRoomId];
      if (room && room.disconnect(socket.data.snakesLaddersPlayerToken, socket)) {
        broadcast(room);
      }
    });
  });

  return rooms;
}

module.exports = {
  BOARD_END,
  LADDERS,
  SNAKES,
  SnakesLaddersRoom,
  registerSnakesLaddersHandlers
};
