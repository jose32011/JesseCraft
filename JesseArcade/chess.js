const { Chess } = require('chess.js');

class ChessRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.game = new Chess();
    this.players = [null, null];
    this.started = false;
    this.resignedBy = null;
    this.status = 'Waiting for White to join.';
  }

  join(playerToken, playerName, socket) {
    const existing = this.players.find(player => player && player.id === playerToken);
    if (existing) {
      if (existing.socket?.connected && existing.socket !== socket) {
        existing.socket.emit('chessSessionReplaced');
        existing.socket.disconnect(true);
      }
      existing.name = playerName;
      existing.socket = socket;
      existing.connected = true;
      this.updateStatus();
      return { success: true, color: existing.color, reconnected: true };
    }

    if (this.started) {
      return { success: false, message: 'This chess game has already started.' };
    }
    const color = this.players[0] ? 'b' : 'w';
    const player = {
      id: playerToken,
      name: playerName,
      color,
      socket,
      connected: true
    };
    this.players[color === 'w' ? 0 : 1] = player;
    if (this.players.every(Boolean)) this.started = true;
    this.updateStatus();
    return { success: true, color, reconnected: false };
  }

  playerForToken(playerToken) {
    return this.players.find(player => player && player.id === playerToken) || null;
  }

  move(playerToken, from, to, promotion = 'q') {
    const player = this.playerForToken(playerToken);
    if (!this.started || !player || this.game.isGameOver() || this.resignedBy) {
      return { success: false, message: 'This game is not ready for a move.' };
    }
    if (this.game.turn() !== player.color) {
      return { success: false, message: 'It is not your turn.' };
    }
    if (typeof from !== 'string' || !/^[a-h][1-8]$/.test(from) ||
        typeof to !== 'string' || !/^[a-h][1-8]$/.test(to) ||
        !['q', 'r', 'b', 'n'].includes(promotion)) {
      return { success: false, message: 'That move is not valid.' };
    }

    const legalMove = this.game.moves({ square: from, verbose: true })
      .find(candidate => candidate.to === to &&
        (candidate.promotion || 'q') === promotion);
    if (!legalMove) {
      return { success: false, message: 'That move is not legal.' };
    }

    const move = this.game.move({
      from: legalMove.from,
      to: legalMove.to,
      ...(legalMove.promotion ? { promotion: legalMove.promotion } : {})
    });
    this.updateStatus(move);
    return { success: true, move: { san: move.san, from: move.from, to: move.to } };
  }

  resign(playerToken) {
    const player = this.playerForToken(playerToken);
    if (!this.started || !player || this.game.isGameOver() || this.resignedBy) return false;
    this.resignedBy = player.color;
    this.updateStatus();
    return true;
  }

  disconnect(playerToken, socket) {
    const player = this.playerForToken(playerToken);
    if (!player || player.socket !== socket) return false;
    player.socket = null;
    player.connected = false;
    this.updateStatus();
    return true;
  }

  updateStatus(lastMove = null) {
    if (!this.started) {
      this.status = this.players[0]
        ? 'Waiting for Black to join.'
        : 'Waiting for White to join.';
      return;
    }

    if (this.resignedBy) {
      const winner = this.resignedBy === 'w' ? 'Black' : 'White';
      const resigned = this.resignedBy === 'w' ? 'White' : 'Black';
      this.status = `${resigned} resigned. ${winner} wins.`;
    } else if (this.game.isCheckmate()) {
      const winner = this.game.turn() === 'w' ? 'Black' : 'White';
      this.status = `Checkmate. ${winner} wins.`;
    } else if (this.game.isStalemate()) {
      this.status = 'Draw by stalemate.';
    } else if (this.game.isThreefoldRepetition()) {
      this.status = 'Draw by threefold repetition.';
    } else if (this.game.isInsufficientMaterial()) {
      this.status = 'Draw by insufficient material.';
    } else if (this.game.isDrawByFiftyMoves()) {
      this.status = 'Draw by the fifty-move rule.';
    } else if (this.game.isDraw()) {
      this.status = 'The game is a draw.';
    } else {
      const turn = this.game.turn() === 'w' ? 'White' : 'Black';
      this.status = `${lastMove ? `${lastMove.san}. ` : ''}${this.game.isCheck() ? `${turn} is in check. ` : ''}${turn} to move.`;
    }
  }

  stateFor(playerToken) {
    const player = this.playerForToken(playerToken);
    if (!player) return null;
    const verboseHistory = this.game.history({ verbose: true });
    const lastMove = verboseHistory[verboseHistory.length - 1] || null;
    const checkedKingSquare = this.game.isCheck()
      ? this.game.findPiece({ type: 'k', color: this.game.turn() })[0] || null
      : null;
    const pieces = {};
    this.game.board().forEach((row, rowIndex) => {
      row.forEach((piece, fileIndex) => {
        if (!piece) return;
        const square = `${String.fromCharCode(97 + fileIndex)}${8 - rowIndex}`;
        pieces[square] = { color: piece.color, type: piece.type };
      });
    });
    return {
      roomId: this.roomId,
      started: this.started,
      color: player.color,
      turn: this.game.turn(),
      fen: this.game.fen(),
      history: this.game.history(),
      legalMoves: this.started && !this.game.isGameOver() && !this.resignedBy
        ? this.game.moves({ verbose: true })
        : [],
      pieces,
      lastMove: lastMove ? { from: lastMove.from, to: lastMove.to, san: lastMove.san } : null,
      players: this.players.filter(Boolean).map(seat => ({
        color: seat.color,
        name: seat.name,
        connected: seat.connected
      })),
      check: this.game.isCheck(),
      checkedKingSquare,
      checkmate: this.game.isCheckmate(),
      stalemate: this.game.isStalemate(),
      draw: this.game.isDraw(),
      resultReason: this.resignedBy ? 'resignation' : null,
      gameOver: this.game.isGameOver() || Boolean(this.resignedBy),
      winner: this.resignedBy
        ? (this.resignedBy === 'w' ? 'b' : 'w')
        : this.game.isCheckmate()
        ? (this.game.turn() === 'w' ? 'b' : 'w')
        : null,
      yourTurn: this.started && !this.game.isGameOver() &&
        !this.resignedBy && this.game.turn() === player.color,
      status: this.status
    };
  }
}

function registerChessHandlers(io) {
  const rooms = Object.create(null);

  function broadcast(room) {
    room.players.forEach(player => {
      if (player?.socket?.connected) {
        player.socket.emit('chessState', room.stateFor(player.id));
      }
    });
  }

  io.on('connection', socket => {
    socket.on('joinChess', ({ roomId, playerName, playerToken } = {}) => {
      const safeRoomId = typeof roomId === 'string' ? roomId.trim() : '';
      const safeName = typeof playerName === 'string'
        ? playerName.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 20)
        : '';
      const safeToken = typeof playerToken === 'string' &&
        /^[a-zA-Z0-9-]{16,64}$/.test(playerToken) ? playerToken : '';
      if (!safeRoomId || safeRoomId.length > 40 || !safeName || !safeToken) {
        socket.emit('chessJoined', {
          success: false,
          message: 'Enter a name and room ID, and allow browser storage so you can reconnect.'
        });
        return;
      }

      const room = rooms[safeRoomId] || (rooms[safeRoomId] = new ChessRoom(safeRoomId));
      const result = room.join(safeToken, safeName, socket);
      if (!result.success) {
        socket.emit('chessJoined', result);
        return;
      }
      socket.data.chessRoomId = safeRoomId;
      socket.data.chessPlayerToken = safeToken;
      socket.join(`chess:${safeRoomId}`);
      socket.emit('chessJoined', { ...result, roomId: safeRoomId });
      broadcast(room);
    });

    socket.on('chessMove', ({ roomId, from, to, promotion } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.chessPlayerToken;
      const player = room?.playerForToken(token);
      if (!room || socket.data.chessRoomId !== roomId || !player ||
          player.socket !== socket) {
        socket.emit('chessError', 'Rejoin the chess room before moving.');
        return;
      }
      const result = room.move(token, from, to, promotion);
      if (!result.success) socket.emit('chessError', result.message);
      broadcast(room);
    });

    socket.on('chessResign', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.chessPlayerToken;
      const player = room?.playerForToken(token);
      if (!room || socket.data.chessRoomId !== roomId || !player ||
          player.socket !== socket || !room.resign(token)) {
        socket.emit('chessError', 'You can only resign an active chess game.');
        return;
      }
      broadcast(room);
    });

    socket.on('chessLeave', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const player = room?.playerForToken(socket.data.chessPlayerToken);
      if (room && socket.data.chessRoomId === roomId && player?.socket === socket) {
        room.disconnect(socket.data.chessPlayerToken, socket);
        socket.leave(`chess:${roomId}`);
        delete socket.data.chessRoomId;
        delete socket.data.chessPlayerToken;
        broadcast(room);
      }
    });

    socket.on('disconnect', () => {
      const room = rooms[socket.data.chessRoomId];
      if (room && room.disconnect(socket.data.chessPlayerToken, socket)) {
        broadcast(room);
      }
    });
  });

  return rooms;
}

module.exports = { ChessRoom, registerChessHandlers };
