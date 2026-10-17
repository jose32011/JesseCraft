const LUDO_MODES = new Set(['online', 'vs-ai', 'online-ai']);
const COLORS = ['yellow', 'green', 'red', 'blue'];
const START_OFFSETS = [12, 25, 38, 0];
const SAFE_TRACK_SPACES = new Set([0, 8, 12, 21, 25, 34, 38, 47]);
const TRACK = [
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7],
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7],
  [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14], [7, 13]
];
const HOME_LANES = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
  [[7, 12], [7, 11], [7, 10], [7, 9], [7, 8], [7, 7]]
];
const BASE_CELLS = [
  [[1.8, 1.8], [4.2, 1.8], [1.8, 4.2], [4.2, 4.2]],
  [[10.8, 1.8], [13.2, 1.8], [10.8, 4.2], [13.2, 4.2]],
  [[10.8, 10.8], [13.2, 10.8], [10.8, 13.2], [13.2, 13.2]],
  [[1.8, 10.8], [4.2, 10.8], [1.8, 13.2], [4.2, 13.2]]
];
const PLAYER_SEATS = [0, 2];

class LudoRoom {
  constructor(roomId, random = Math.random) {
    this.roomId = roomId;
    this.random = random;
    this.mode = null;
    this.seats = Array(4).fill(null);
    this.turnOrder = [];
    this.turnIndex = 0;
    this.started = false;
    this.diceValue = null;
    this.lastRoll = null;
    this.legalMoves = [];
    this.winner = null;
    this.resultReason = null;
    this.status = 'Waiting for players to join.';
    this.aiTimer = null;
  }

  join(playerToken, playerName, mode, socket) {
    if (!LUDO_MODES.has(mode)) return { success: false, message: 'Choose a valid Ludo mode.' };
    if (this.mode && this.mode !== mode) {
      return { success: false, message: 'This room is using a different Ludo mode.' };
    }

    const existingSeat = this.seats.find(seat => seat && !seat.isAI && seat.id === playerToken);
    if (existingSeat) {
      if (existingSeat.socket && existingSeat.socket !== socket && existingSeat.socket.connected) {
        existingSeat.socket.emit('ludoSessionReplaced');
        existingSeat.socket.disconnect(true);
      }
      existingSeat.name = playerName;
      existingSeat.socket = socket;
      existingSeat.connected = true;
      if (!this.started) {
        this.status = 'Waiting for the other player to join.';
      } else if (this.currentPlayer() === existingSeat) {
        this.status = this.diceValue === null
          ? `${existingSeat.name}'s turn. Roll the die.`
          : `${existingSeat.name} reconnected. Choose a piece.`;
      } else {
        this.status = `${existingSeat.name} reconnected.`;
      }
      return { success: true, seat: existingSeat.index, reconnected: true };
    }
    if (this.started) {
      return { success: false, message: 'This Ludo game has already started and that player session is not seated.' };
    }

    const humanCount = this.seats.filter(seat => seat && !seat.isAI).length;
    if (mode === 'vs-ai' && humanCount >= 1) {
      return { success: false, message: 'This room is set up for one player against AI.' };
    }
    if (mode !== 'vs-ai' && humanCount >= 2) {
      return { success: false, message: 'This Ludo room already has two human players.' };
    }

    this.mode = mode;
    const seatIndex = PLAYER_SEATS.find(index => !this.seats[index]);
    const seat = {
      id: playerToken,
      index: seatIndex,
      name: playerName,
      color: COLORS[seatIndex],
      isAI: false,
      connected: true,
      socket,
      pieces: [-1, -1, -1, -1]
    };
    this.seats[seatIndex] = seat;

    const requiredHumans = mode === 'vs-ai' ? 1 : 2;
    if (this.seats.filter(candidate => candidate && !candidate.isAI).length === requiredHumans) {
      this.addAiSeats();
      this.start();
    } else {
      this.status = 'Waiting for the other player to join.';
    }
    return { success: true, seat: seatIndex, reconnected: false };
  }

  addAiSeats() {
    const aiSeats = this.mode === 'vs-ai' ? [2] : this.mode === 'online-ai' ? [1, 3] : [];
    aiSeats.forEach(index => {
      this.seats[index] = {
        id: `ai-${index}`,
        index,
        name: `${COLORS[index][0].toUpperCase()}${COLORS[index].slice(1)} CPU`,
        color: COLORS[index],
        isAI: true,
        connected: true,
        socket: null,
        pieces: [-1, -1, -1, -1]
      };
    });
  }

  start() {
    this.started = true;
    this.turnOrder = this.mode === 'online-ai' ? [0, 1, 2, 3] : [0, 2];
    this.turnIndex = 0;
    this.status = `${this.currentPlayer().name}'s turn. Roll the die.`;
  }

  currentPlayer() {
    return this.seats[this.turnOrder[this.turnIndex]];
  }

  seatForToken(playerToken) {
    return this.seats.find(seat => seat && !seat.isAI && seat.id === playerToken) || null;
  }

  legalMovesFor(seat, die) {
    return seat.pieces.reduce((moves, progress, pieceIndex) => {
      if ((progress === -1 && die === 6) ||
          (progress >= 0 && progress < 57 && progress + die <= 57)) {
        moves.push(pieceIndex);
      }
      return moves;
    }, []);
  }

  roll(playerToken) {
    const player = this.seatForToken(playerToken);
    if (!this.started || this.winner || !player ||
        this.currentPlayer() !== player || this.diceValue !== null) {
      return { success: false, message: 'It is not your turn to roll.' };
    }

    this.diceValue = Math.floor(this.random() * 6) + 1;
    this.lastRoll = this.diceValue;
    this.legalMoves = this.legalMovesFor(player, this.diceValue);
    if (this.legalMoves.length === 0) {
      const rolledSix = this.diceValue === 6;
      this.diceValue = null;
      this.status = rolledSix
        ? `${player.name} rolled a 6 but has no legal move. Roll again.`
        : `${player.name} rolled ${this.lastRoll} and has no legal move.`;
      if (!rolledSix) this.advanceTurn();
      return { success: true, noMoves: true };
    }

    this.status = this.legalMoves.length === 1
      ? `${player.name} rolled ${this.diceValue}. Move the highlighted piece.`
      : `${player.name} rolled ${this.diceValue}. Choose a piece to move.`;
    return { success: true, noMoves: false };
  }

  move(playerToken, pieceIndex) {
    const player = this.seatForToken(playerToken);
    if (!this.started || this.winner || !player ||
        this.currentPlayer() !== player || !this.legalMoves.includes(pieceIndex)) {
      return { success: false, message: 'That piece cannot move right now.' };
    }

    const die = this.diceValue;
    this.movePiece(player, pieceIndex, die);
    const captured = this.captureAt(player, pieceIndex);
    if (player.pieces.every(progress => progress === 57)) {
      this.winner = player.name;
      this.status = `${player.name} wins Ludo!`;
      this.diceValue = null;
      this.legalMoves = [];
      return { success: true, captured };
    }

    this.diceValue = null;
    this.legalMoves = [];
    if (die === 6) {
      this.status = `${player.name} rolled a 6 and gets another turn.`;
    } else {
      this.advanceTurn();
    }
    return { success: true, captured };
  }

  movePiece(seat, pieceIndex, die) {
    seat.pieces[pieceIndex] = seat.pieces[pieceIndex] === -1
      ? 0
      : seat.pieces[pieceIndex] + die;
  }

  captureAt(movingSeat, pieceIndex) {
    const progress = movingSeat.pieces[pieceIndex];
    if (progress < 0 || progress > 51) return [];
    const landedSpace = (START_OFFSETS[movingSeat.index] + progress) % TRACK.length;
    if (SAFE_TRACK_SPACES.has(landedSpace)) return [];

    const captured = [];
    this.seats.forEach(seat => {
      if (!seat || seat === movingSeat) return;
      seat.pieces.forEach((otherProgress, otherPieceIndex) => {
        if (otherProgress < 0 || otherProgress > 51) return;
        const otherSpace = (START_OFFSETS[seat.index] + otherProgress) % TRACK.length;
        if (otherSpace === landedSpace) {
          seat.pieces[otherPieceIndex] = -1;
          captured.push({ seat: seat.index, piece: otherPieceIndex });
        }
      });
    });
    if (captured.length) {
      this.status = `${movingSeat.name} captured ${captured.length} piece${captured.length === 1 ? '' : 's'}!`;
    }
    return captured;
  }

  advanceTurn() {
    this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
    this.status = `${this.currentPlayer().name}'s turn. Roll the die.`;
  }

  disconnect(playerToken, socket) {
    const player = this.seatForToken(playerToken);
    if (player && player.socket === socket) {
      player.socket = null;
      player.connected = false;
      this.status = `${player.name} disconnected. Waiting for them to reconnect.`;
    }
  }

  leave(playerToken, socket) {
    const player = this.seatForToken(playerToken);
    if (!player || player.socket !== socket) return false;
    player.socket = null;
    player.connected = false;
    this.status = `${player.name} left. They can rejoin this room.`;
    return true;
  }

  resign(playerToken, socket) {
    const resigningPlayer = this.seatForToken(playerToken);
    if (!this.started || this.winner || !resigningPlayer ||
        resigningPlayer.socket !== socket) return false;

    const otherPlayers = this.turnOrder
      .map(index => this.seats[index])
      .filter(seat => seat && seat !== resigningPlayer);
    const winner = otherPlayers.find(seat => !seat.isAI) || otherPlayers[0];
    if (!winner) return false;

    clearTimeout(this.aiTimer);
    this.winner = winner.name;
    this.resultReason = 'resignation';
    this.diceValue = null;
    this.legalMoves = [];
    this.status = `${resigningPlayer.name} resigned. ${winner.name} wins Ludo.`;
    return true;
  }

  stateFor(playerToken) {
    const player = this.seatForToken(playerToken);
    if (!player) return null;
    const current = this.started ? this.currentPlayer() : null;
    return {
      roomId: this.roomId,
      mode: this.mode,
      started: this.started,
      waiting: !this.started,
      players: this.seats.filter(Boolean).map(seat => ({
        seat: seat.index,
        name: seat.name,
        color: seat.color,
        isAI: seat.isAI,
        connected: seat.connected,
        pieces: seat.pieces.slice()
      })),
      yourSeat: player.index,
      currentSeat: current ? current.index : null,
      currentPlayerName: current ? current.name : null,
      yourTurn: current === player,
      diceValue: this.diceValue,
      lastRoll: this.lastRoll,
      legalMoves: current === player ? this.legalMoves.slice() : [],
      canRoll: Boolean(this.started && !this.winner && current === player && this.diceValue === null),
      winner: this.winner,
      resultReason: this.resultReason,
      gameOver: Boolean(this.winner),
      status: this.status
    };
  }

  async applyAiTurn(broadcast) {
    if (!this.started || this.winner || !this.currentPlayer().isAI) return;
    const ai = this.currentPlayer();
    this.diceValue = Math.floor(this.random() * 6) + 1;
    this.lastRoll = this.diceValue;
    this.legalMoves = this.legalMovesFor(ai, this.diceValue);
    if (!this.legalMoves.length) {
      const getsAnotherTurn = this.diceValue === 6;
      this.diceValue = null;
      this.legalMoves = [];
      if (!getsAnotherTurn) this.advanceTurn();
      else this.status = `${ai.name} rolled a 6 but has no legal move.`;
      broadcast();
      this.scheduleAi(broadcast);
      return;
    }

    const die = this.diceValue;
    const pieceIndex = this.chooseAiMove(ai, die);
    this.movePiece(ai, pieceIndex, die);
    const captured = this.captureAt(ai, pieceIndex);
    if (ai.pieces.every(progress => progress === 57)) {
      this.winner = ai.name;
      this.status = `${ai.name} wins Ludo!`;
    } else if (die !== 6) {
      this.advanceTurn();
    } else {
      this.status = `${ai.name} rolled a 6 and gets another turn.`;
    }
    this.diceValue = null;
    this.legalMoves = [];
    if (captured.length) this.status = `${ai.name} captured a piece!`;
    broadcast();
    this.scheduleAi(broadcast);
  }

  chooseAiMove(seat, die) {
    const candidates = this.legalMoves.map(pieceIndex => {
      const progress = seat.pieces[pieceIndex];
      const nextProgress = progress === -1 ? 0 : progress + die;
      const nextSpace = nextProgress <= 51
        ? (START_OFFSETS[seat.index] + nextProgress) % TRACK.length
        : null;
      const captures = nextSpace === null || SAFE_TRACK_SPACES.has(nextSpace)
        ? 0
        : this.seats.reduce((total, otherSeat) => {
          if (!otherSeat || otherSeat === seat) return total;
          return total + otherSeat.pieces.filter(otherProgress =>
            otherProgress >= 0 && otherProgress <= 51 &&
            (START_OFFSETS[otherSeat.index] + otherProgress) % TRACK.length === nextSpace
          ).length;
        }, 0);
      return {
        pieceIndex,
        score: (nextProgress === 57 ? 1000 : 0) +
          captures * 500 +
          (progress === -1 ? 120 : 0) +
          nextProgress
      };
    });
    const bestScore = Math.max(...candidates.map(candidate => candidate.score));
    const bestMoves = candidates.filter(candidate => candidate.score === bestScore);
    return bestMoves[Math.floor(this.random() * bestMoves.length)].pieceIndex;
  }

  scheduleAi(broadcast) {
    clearTimeout(this.aiTimer);
    if (!this.started || this.winner || !this.currentPlayer().isAI) return;
    this.aiTimer = setTimeout(() => this.applyAiTurn(broadcast), 650);
  }
}

function registerLudoHandlers(io) {
  const rooms = Object.create(null);

  function broadcast(room) {
    room.seats.forEach(seat => {
      if (seat && !seat.isAI && seat.socket?.connected) {
        seat.socket.emit('ludoState', room.stateFor(seat.id));
      }
    });
  }

  function scheduleAi(room) {
    room.scheduleAi(() => broadcast(room));
  }

  io.on('connection', socket => {
    socket.on('joinLudo', ({ roomId, playerName, mode, playerToken } = {}) => {
      const safeRoomId = typeof roomId === 'string' ? roomId.trim() : '';
      const safeName = typeof playerName === 'string'
        ? playerName.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 20)
        : '';
      const safeToken = typeof playerToken === 'string' &&
        /^[a-zA-Z0-9-]{16,64}$/.test(playerToken) ? playerToken : '';
      if (!safeRoomId || safeRoomId.length > 40 || !safeName || !safeToken ||
          !LUDO_MODES.has(mode)) {
        socket.emit('ludoJoined', {
          success: false,
          message: 'Enter a name and room ID, choose a mode, and allow browser storage.'
        });
        return;
      }

      const room = rooms[safeRoomId] || (rooms[safeRoomId] = new LudoRoom(safeRoomId));
      const result = room.join(safeToken, safeName, mode, socket);
      if (!result.success) {
        socket.emit('ludoJoined', result);
        return;
      }
      socket.data.ludoRoomId = safeRoomId;
      socket.data.ludoPlayerToken = safeToken;
      socket.join(`ludo:${safeRoomId}`);
      socket.emit('ludoJoined', { ...result, roomId: safeRoomId });
      broadcast(room);
      scheduleAi(room);
    });

    socket.on('ludoRoll', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.ludoPlayerToken;
      const player = room && room.seatForToken(token);
      if (!room || socket.data.ludoRoomId !== roomId || !player || player.socket !== socket) {
        socket.emit('ludoError', 'Rejoin the Ludo room before rolling.');
        return;
      }
      const result = room.roll(token);
      if (!result.success) socket.emit('ludoError', result.message);
      broadcast(room);
      scheduleAi(room);
    });

    socket.on('ludoMove', ({ roomId, pieceIndex } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.ludoPlayerToken;
      const player = room && room.seatForToken(token);
      if (!room || socket.data.ludoRoomId !== roomId || !player || player.socket !== socket) {
        socket.emit('ludoError', 'Rejoin the Ludo room before moving a piece.');
        return;
      }
      const result = room.move(token, pieceIndex);
      if (!result.success) socket.emit('ludoError', result.message);
      broadcast(room);
      scheduleAi(room);
    });

    socket.on('resignLudo', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.ludoPlayerToken;
      const player = room && room.seatForToken(token);
      if (!room || socket.data.ludoRoomId !== roomId || !player ||
          player.socket !== socket || !room.resign(token, socket)) {
        socket.emit('ludoError', 'You can only resign an active Ludo game.');
        return;
      }
      broadcast(room);
    });

    socket.on('leaveLudo', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.ludoPlayerToken;
      if (room && socket.data.ludoRoomId === roomId && room.leave(token, socket)) {
        socket.leave(`ludo:${roomId}`);
        delete socket.data.ludoRoomId;
        delete socket.data.ludoPlayerToken;
        broadcast(room);
      }
    });

    socket.on('disconnect', () => {
      const room = rooms[socket.data.ludoRoomId];
      if (room) {
        room.disconnect(socket.data.ludoPlayerToken, socket);
        broadcast(room);
      }
    });
  });

  return rooms;
}

module.exports = {
  BASE_CELLS,
  COLORS,
  HOME_LANES,
  LudoRoom,
  SAFE_TRACK_SPACES,
  START_OFFSETS,
  TRACK,
  registerLudoHandlers
};
