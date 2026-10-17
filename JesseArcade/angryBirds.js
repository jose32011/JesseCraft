const ROOM_ID_PATTERN = /^[a-zA-Z0-9 _-]{1,40}$/;
const ARENA = { width: 960, height: 480, ground: 410 };
const MAX_SHOTS = 5;
const STARTING_FORT_HEALTH = 3;
const STARTING_PIG_HEALTH = 100;

function simulateShot(seat, angle, power, fortHealth) {
  const radians = angle * Math.PI / 180;
  const direction = seat === 0 ? 1 : -1;
  const launch = { x: seat === 0 ? 100 : 860, y: 365 };
  const targetX = seat === 0 ? 790 : 170;
  const target = { x: targetX, y: 365 };
  const speed = power * 5.7;
  const gravity = 230;
  const path = [launch];
  let hit = null;

  for (let step = 1; step <= 100; step += 1) {
    const time = step * 0.06;
    const point = {
      x: launch.x + direction * Math.cos(radians) * speed * time,
      y: launch.y - Math.sin(radians) * speed * time + gravity * time * time / 2
    };
    path.push(point);
    if (point.y >= ARENA.ground || point.x < 0 || point.x > ARENA.width) break;

    const insideFort = Math.abs(point.x - targetX) <= 42 &&
      point.y >= 322 && point.y <= ARENA.ground;
    if (insideFort && fortHealth > 0) {
      hit = 'fort';
      break;
    }
    if (Math.hypot(point.x - target.x, point.y - target.y) <= 34) {
      hit = 'pig';
      break;
    }
  }
  return { path, hit };
}

class AngryBirdsRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.seats = [null, null];
    this.started = false;
    this.gameOver = false;
    this.winner = null;
    this.turn = 0;
    this.status = 'Waiting for two players to join.';
    this.fortHealth = [STARTING_FORT_HEALTH, STARTING_FORT_HEALTH];
    this.pigHealth = [STARTING_PIG_HEALTH, STARTING_PIG_HEALTH];
    this.shotsLeft = [MAX_SHOTS, MAX_SHOTS];
    this.shotId = 0;
    this.lastShot = null;
  }

  join(playerToken, playerName, socket) {
    const existing = this.seats.find(seat => seat?.id === playerToken);
    if (existing) {
      if (existing.socket && existing.socket !== socket && existing.socket.connected) {
        existing.socket.emit('angryBirdsSessionReplaced');
        existing.socket.disconnect(true);
      }
      existing.name = playerName;
      existing.socket = socket;
      existing.connected = true;
      this.status = this.started ? `${playerName} reconnected.` : this.status;
      return { success: true, seat: existing.seat, reconnected: true };
    }
    if (this.started) {
      return { success: false, message: 'This Angry Birds duel has already started.' };
    }
    const seatIndex = this.seats.findIndex(seat => !seat);
    if (seatIndex < 0) return { success: false, message: 'This Angry Birds room is full.' };

    this.seats[seatIndex] = {
      id: playerToken,
      name: playerName,
      seat: seatIndex,
      connected: true,
      socket
    };
    if (this.seats.every(Boolean)) {
      this.reset();
      this.started = true;
      this.status = `${this.seats[this.turn].name}'s turn. Aim and launch!`;
    } else {
      this.status = 'Waiting for one more player.';
    }
    return { success: true, seat: seatIndex, reconnected: false };
  }

  reset() {
    this.started = false;
    this.gameOver = false;
    this.winner = null;
    this.turn = 0;
    this.fortHealth = [STARTING_FORT_HEALTH, STARTING_FORT_HEALTH];
    this.pigHealth = [STARTING_PIG_HEALTH, STARTING_PIG_HEALTH];
    this.shotsLeft = [MAX_SHOTS, MAX_SHOTS];
    this.shotId = 0;
    this.lastShot = null;
  }

  seatForToken(token) {
    return this.seats.find(seat => seat?.id === token) ?? null;
  }

  launch(playerToken, angle, power) {
    const player = this.seatForToken(playerToken);
    if (!this.started || this.gameOver || !player || player.seat !== this.turn) {
      return { success: false, message: 'Wait for your turn before launching.' };
    }
    if (!Number.isFinite(angle) || angle < 10 || angle > 75 ||
        !Number.isFinite(power) || power < 30 || power > 100) {
      return { success: false, message: 'Choose an angle from 10–75° and power from 30–100.' };
    }

    const targetSeat = 1 - player.seat;
    const shot = simulateShot(player.seat, angle, power, this.fortHealth[targetSeat]);
    this.shotsLeft[player.seat] -= 1;
    this.shotId += 1;
    this.lastShot = {
      id: this.shotId,
      shooter: player.seat,
      angle,
      power,
      path: shot.path,
      hit: shot.hit,
      targetSeat
    };
    if (shot.hit === 'fort') {
      this.fortHealth[targetSeat] = Math.max(0, this.fortHealth[targetSeat] - 1);
      this.status = this.fortHealth[targetSeat] > 0
        ? `${player.name} damaged the rival fort!`
        : `${player.name} smashed the rival fort! The pig is exposed.`;
    } else if (shot.hit === 'pig') {
      this.pigHealth[targetSeat] = Math.max(0, this.pigHealth[targetSeat] - 40);
      this.status = `${player.name} hit the rival pig!`;
      if (this.pigHealth[targetSeat] === 0) {
        this.gameOver = true;
        this.winner = player.seat;
        this.status = `${player.name} wins the duel!`;
      }
    } else {
      this.status = `${player.name} missed.`;
    }

    if (!this.gameOver && this.shotsLeft.every(shots => shots === 0)) {
      this.gameOver = true;
      this.winner = this.pigHealth[0] === this.pigHealth[1]
        ? null
        : this.pigHealth[0] > this.pigHealth[1] ? 0 : 1;
      this.status = this.winner === null
        ? 'The duel is a draw!'
        : `${this.seats[this.winner].name} wins the duel!`;
    }
    if (!this.gameOver) this.turn = targetSeat;
    return { success: true };
  }

  resign(playerToken) {
    const player = this.seatForToken(playerToken);
    if (!player || !this.started || this.gameOver) return false;
    this.gameOver = true;
    this.winner = 1 - player.seat;
    this.status = `${this.seats[this.winner].name} wins by forfeit.`;
    return true;
  }

  disconnect(playerToken, socket) {
    const player = this.seatForToken(playerToken);
    if (!player || player.socket !== socket) return false;
    player.connected = false;
    this.status = `${player.name} disconnected. Waiting for them to reconnect.`;
    return true;
  }

  leave(playerToken, socket) {
    const player = this.seatForToken(playerToken);
    if (!player || player.socket !== socket) return false;
    this.seats[player.seat] = null;
    this.started = false;
    this.gameOver = false;
    this.winner = null;
    this.status = 'Waiting for two players to join.';
    this.lastShot = null;
    return true;
  }

  stateFor(playerToken) {
    const player = this.seatForToken(playerToken);
    return {
      roomId: this.roomId,
      started: this.started,
      gameOver: this.gameOver,
      winner: this.winner,
      yourSeat: player?.seat ?? null,
      turn: this.turn,
      status: this.status,
      fortHealth: [...this.fortHealth],
      pigHealth: [...this.pigHealth],
      shotsLeft: [...this.shotsLeft],
      players: this.seats.filter(Boolean).map(({ id, name, seat, connected }) => ({
        id,
        name,
        seat,
        connected
      })),
      lastShot: this.lastShot
    };
  }
}

function registerAngryBirdsHandlers(io) {
  const rooms = Object.create(null);

  function broadcast(room) {
    room.seats.forEach(seat => {
      if (seat?.socket?.connected) {
        seat.socket.emit('angryBirdsState', room.stateFor(seat.id));
      }
    });
  }

  io.on('connection', socket => {
    socket.on('joinAngryBirds', ({ roomId, playerName, playerToken } = {}) => {
      const safeRoomId = typeof roomId === 'string' ? roomId.trim() : '';
      const safeName = typeof playerName === 'string'
        ? playerName.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 20)
        : '';
      const safeToken = typeof playerToken === 'string' &&
        /^[a-zA-Z0-9-]{16,64}$/.test(playerToken) ? playerToken : '';
      if (!ROOM_ID_PATTERN.test(safeRoomId) || !safeName || !safeToken) {
        socket.emit('angryBirdsJoined', {
          success: false,
          message: 'Enter your name and room ID, and allow browser storage.'
        });
        return;
      }

      const room = rooms[safeRoomId] || (rooms[safeRoomId] = new AngryBirdsRoom(safeRoomId));
      const result = room.join(safeToken, safeName, socket);
      if (!result.success) {
        socket.emit('angryBirdsJoined', result);
        return;
      }
      socket.data.angryBirdsRoomId = safeRoomId;
      socket.data.angryBirdsPlayerToken = safeToken;
      socket.join(`angry-birds:${safeRoomId}`);
      socket.emit('angryBirdsJoined', { ...result, roomId: safeRoomId });
      broadcast(room);
    });

    socket.on('angryBirdsLaunch', ({ roomId, angle, power } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.angryBirdsPlayerToken;
      const player = room?.seatForToken(token);
      if (!room || socket.data.angryBirdsRoomId !== roomId ||
          !player || player.socket !== socket) {
        socket.emit('angryBirdsError', 'Rejoin the Angry Birds room before launching.');
        return;
      }
      const result = room.launch(token, angle, power);
      if (!result.success) socket.emit('angryBirdsError', result.message);
      broadcast(room);
    });

    socket.on('angryBirdsResign', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.angryBirdsPlayerToken;
      const player = room?.seatForToken(token);
      if (!room || socket.data.angryBirdsRoomId !== roomId ||
          !player || player.socket !== socket || !room.resign(token)) {
        socket.emit('angryBirdsError', 'You can only resign an active Angry Birds duel.');
        return;
      }
      broadcast(room);
    });

    socket.on('leaveAngryBirds', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.angryBirdsPlayerToken;
      if (!room || socket.data.angryBirdsRoomId !== roomId ||
          !room.leave(token, socket)) return;
      socket.leave(`angry-birds:${roomId}`);
      delete socket.data.angryBirdsRoomId;
      delete socket.data.angryBirdsPlayerToken;
      broadcast(room);
      if (room.seats.every(seat => !seat)) delete rooms[roomId];
    });

    socket.on('disconnect', () => {
      const room = rooms[socket.data.angryBirdsRoomId];
      if (room && room.disconnect(socket.data.angryBirdsPlayerToken, socket)) broadcast(room);
    });
  });

  return rooms;
}

module.exports = { AngryBirdsRoom, registerAngryBirdsHandlers, simulateShot };
