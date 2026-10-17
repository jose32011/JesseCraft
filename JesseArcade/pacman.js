const WIDTH = 19;
const HEIGHT = 15;
const ROLE_SEATS = { pacman: 0, monster: 1 };
const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);
const DELTAS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0]
};
const PACMAN_START = { x: 9, y: 7 };
const MONSTER_STARTS = [
  { x: 9, y: 1 },
  { x: 1, y: 13 },
  { x: 17, y: 13 },
  { x: 17, y: 1 }
];
const POWER_DURATION_TICKS = 28;

function makeMaze() {
  const maze = Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) =>
      x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1 ? '#' : '.'
    )
  );

  for (const x of [4, 9, 14]) {
    for (let y = 2; y < HEIGHT - 2; y += 1) {
      if (![3, 7, 11].includes(y)) maze[y][x] = '#';
    }
  }
  for (const y of [4, 10]) {
    for (let x = 2; x < WIDTH - 2; x += 1) {
      if (![3, 6, 9, 12, 15].includes(x)) maze[y][x] = '#';
    }
  }

  for (const { x, y } of [PACMAN_START, ...MONSTER_STARTS]) maze[y][x] = ' ';
  for (const [x, y] of [[1, 1], [17, 1], [1, 13], [17, 13]]) maze[y][x] = 'o';
  return maze;
}

class PacmanRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.seats = [null, null];
    this.maze = makeMaze();
    this.monsters = [];
    this.started = false;
    this.gameOver = false;
    this.winner = null;
    this.status = 'Waiting for Pac-Man and the monster player to join.';
    this.lives = 3;
    this.score = 0;
    this.powerTicks = 0;
    this.tickCount = 0;
    this.aiTimer = null;
  }

  join(playerToken, playerName, role, socket) {
    if (!Object.hasOwn(ROLE_SEATS, role)) {
      return { success: false, message: 'Choose Pac-Man or Monster.' };
    }
    const existing = this.seats.find(seat => seat?.id === playerToken);
    if (existing) {
      if (existing.socket && existing.socket !== socket && existing.socket.connected) {
        existing.socket.emit('pacmanSessionReplaced');
        existing.socket.disconnect(true);
      }
      existing.name = playerName;
      existing.socket = socket;
      existing.connected = true;
      this.status = this.started
        ? `${playerName} reconnected.`
        : 'Waiting for Pac-Man and the monster player to join.';
      return { success: true, role: existing.role, reconnected: true };
    }
    if (this.started) {
      return { success: false, message: 'This Pac-Man game has already started.' };
    }

    const seatIndex = ROLE_SEATS[role];
    if (this.seats[seatIndex]) {
      return { success: false, message: `The ${role} role is already taken.` };
    }

    const seat = {
      id: playerToken,
      name: playerName,
      role,
      x: role === 'pacman' ? PACMAN_START.x : MONSTER_STARTS[0].x,
      y: role === 'pacman' ? PACMAN_START.y : MONSTER_STARTS[0].y,
      direction: null,
      connected: true,
      socket
    };
    this.seats[seatIndex] = seat;
    if (this.seats.every(Boolean)) {
      this.start();
      return { success: true, role, started: true };
    }
    this.status = `Waiting for the ${role === 'pacman' ? 'monster player' : 'Pac-Man'} to join.`;
    return { success: true, role, started: false };
  }

  start() {
    this.started = true;
    this.gameOver = false;
    this.winner = null;
    this.lives = 3;
    this.score = 0;
    this.powerTicks = 0;
    this.tickCount = 0;
    this.maze = makeMaze();
    this.seats[0].x = PACMAN_START.x;
    this.seats[0].y = PACMAN_START.y;
    this.seats[1].x = MONSTER_STARTS[0].x;
    this.seats[1].y = MONSTER_STARTS[0].y;
    this.seats.forEach(seat => {
      seat.direction = null;
    });
    this.monsters = MONSTER_STARTS.slice(1).map((position, index) => ({
      id: `ai-monster-${index + 1}`,
      name: `Monster CPU ${index + 1}`,
      ...position,
      direction: null,
      isAI: true
    }));
    this.status = 'Collect every pellet and avoid the monsters!';
  }

  setDirection(playerToken, direction) {
    const player = this.seatForToken(playerToken);
    if (!this.started || this.gameOver || !player || !DIRECTIONS.has(direction)) return false;
    player.direction = direction;
    return true;
  }

  seatForToken(playerToken) {
    return this.seats.find(seat => seat?.id === playerToken) ?? null;
  }

  canMove(x, y) {
    return y >= 0 && y < HEIGHT && x >= 0 && x < WIDTH && this.maze[y][x] !== '#';
  }

  move(actor, direction) {
    const [dx, dy] = DELTAS[direction] ?? [0, 0];
    if (this.canMove(actor.x + dx, actor.y + dy)) {
      actor.x += dx;
      actor.y += dy;
      actor.direction = direction;
    }
  }

  nextAiDirection(monster) {
    const pacman = this.seats[0];
    const queue = [{ x: monster.x, y: monster.y, firstDirection: null }];
    const visited = new Set([`${monster.x},${monster.y}`]);
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current.x === pacman.x && current.y === pacman.y) {
        return current.firstDirection ?? 'left';
      }
      for (const direction of ['up', 'left', 'down', 'right']) {
        const [dx, dy] = DELTAS[direction];
        const x = current.x + dx;
        const y = current.y + dy;
        const key = `${x},${y}`;
        if (visited.has(key) || !this.canMove(x, y)) continue;
        visited.add(key);
        queue.push({
          x,
          y,
          firstDirection: current.firstDirection ?? direction
        });
      }
    }
    return null;
  }

  collide(monster) {
    const pacman = this.seats[0];
    if (pacman.x !== monster.x || pacman.y !== monster.y) return;
    if (this.powerTicks > 0) {
      monster.x = MONSTER_STARTS[0].x;
      monster.y = MONSTER_STARTS[0].y;
      this.score += 200;
      this.status = `Pac-Man caught ${monster.name}!`;
      return;
    }

    this.lives -= 1;
    if (this.lives <= 0) {
      this.gameOver = true;
      this.winner = 'monster';
      this.status = 'The monsters caught Pac-Man. Monster wins!';
      return;
    }
    pacman.x = PACMAN_START.x;
    pacman.y = PACMAN_START.y;
    pacman.direction = null;
    this.status = `Caught! ${this.lives} ${this.lives === 1 ? 'life' : 'lives'} left.`;
  }

  tick() {
    if (!this.started || this.gameOver || this.seats.some(seat => !seat?.connected)) return;
    this.tickCount += 1;
    if (this.powerTicks > 0) this.powerTicks -= 1;

    this.move(this.seats[0], this.seats[0].direction);
    const pellet = this.maze[this.seats[0].y][this.seats[0].x];
    if (pellet === '.') {
      this.maze[this.seats[0].y][this.seats[0].x] = ' ';
      this.score += 10;
    } else if (pellet === 'o') {
      this.maze[this.seats[0].y][this.seats[0].x] = ' ';
      this.score += 50;
      this.powerTicks = POWER_DURATION_TICKS;
    }

    const humanMonster = this.seats[1];
    this.move(humanMonster, humanMonster.direction);
    this.collide(humanMonster);
    for (const monster of this.monsters) {
      const direction = this.nextAiDirection(monster);
      if (direction) this.move(monster, direction);
      this.collide(monster);
    }

    if (!this.gameOver && this.maze.every(row => row.every(tile => tile !== '.' && tile !== 'o'))) {
      this.gameOver = true;
      this.winner = 'pacman';
      this.status = 'Pac-Man collected every pellet and wins!';
    }
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
    this.seats[ROLE_SEATS[player.role]] = null;
    if (this.aiTimer) clearInterval(this.aiTimer);
    this.aiTimer = null;
    this.started = false;
    this.gameOver = false;
    this.monsters = [];
    this.status = 'Waiting for Pac-Man and the monster player to join.';
    return true;
  }

  stateFor(playerToken) {
    const player = this.seatForToken(playerToken);
    return {
      roomId: this.roomId,
      started: this.started,
      gameOver: this.gameOver,
      winner: this.winner,
      status: this.status,
      role: player?.role ?? null,
      maze: this.maze.map(row => row.join('')),
      lives: this.lives,
      score: this.score,
      powerTicks: this.powerTicks,
      players: this.seats.filter(Boolean).map(({ id, name, role, x, y, direction, connected }) => ({
        id,
        name,
        role,
        x,
        y,
        direction,
        connected
      })),
      monsters: this.monsters.map(({ id, name, x, y, direction }) => ({
        id,
        name,
        x,
        y,
        direction,
        isAI: true
      }))
    };
  }
}

function registerPacmanHandlers(io) {
  const rooms = Object.create(null);

  function broadcast(room) {
    room.seats.forEach(seat => {
      if (seat?.socket?.connected) seat.socket.emit('pacmanState', room.stateFor(seat.id));
    });
  }

  io.on('connection', socket => {
    socket.on('joinPacman', ({ roomId, playerName, playerToken, role } = {}) => {
      const safeRoomId = typeof roomId === 'string' ? roomId.trim() : '';
      const safeName = typeof playerName === 'string'
        ? playerName.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 20)
        : '';
      const safeToken = typeof playerToken === 'string' &&
        /^[a-zA-Z0-9-]{16,64}$/.test(playerToken) ? playerToken : '';
      if (!safeRoomId || safeRoomId.length > 40 || !safeName || !safeToken ||
          !Object.hasOwn(ROLE_SEATS, role)) {
        socket.emit('pacmanJoined', {
          success: false,
          message: 'Enter your name and room ID, choose a role, and allow browser storage.'
        });
        return;
      }

      const room = rooms[safeRoomId] || (rooms[safeRoomId] = new PacmanRoom(safeRoomId));
      const result = room.join(safeToken, safeName, role, socket);
      if (!result.success) {
        socket.emit('pacmanJoined', result);
        return;
      }
      socket.data.pacmanRoomId = safeRoomId;
      socket.data.pacmanPlayerToken = safeToken;
      socket.join(`pacman:${safeRoomId}`);
      socket.emit('pacmanJoined', { ...result, roomId: safeRoomId });
      if (result.started && !room.aiTimer) {
        room.aiTimer = setInterval(() => {
          room.tick();
          broadcast(room);
        }, 250);
        room.aiTimer.unref?.();
      }
      broadcast(room);
    });

    socket.on('pacmanDirection', ({ roomId, direction } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.pacmanPlayerToken;
      const player = room?.seatForToken(token);
      if (!room || socket.data.pacmanRoomId !== roomId ||
          !player || player.socket !== socket || !room.setDirection(token, direction)) {
        socket.emit('pacmanError', 'Rejoin the Pac-Man room before moving.');
      }
    });

    socket.on('leavePacman', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.pacmanPlayerToken;
      if (!room || socket.data.pacmanRoomId !== roomId || !room.leave(token, socket)) return;
      socket.leave(`pacman:${roomId}`);
      delete socket.data.pacmanRoomId;
      delete socket.data.pacmanPlayerToken;
      broadcast(room);
      if (room.seats.every(seat => !seat)) delete rooms[roomId];
    });

    socket.on('disconnect', () => {
      const room = rooms[socket.data.pacmanRoomId];
      if (room && room.disconnect(socket.data.pacmanPlayerToken, socket)) broadcast(room);
    });
  });

  return rooms;
}

module.exports = { PacmanRoom, makeMaze, registerPacmanHandlers };
