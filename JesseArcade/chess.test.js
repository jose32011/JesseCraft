const assert = require('node:assert/strict');
const test = require('node:test');
const { ChessRoom } = require('./chess');

function fakeSocket() {
  return {
    connected: true,
    emit() {},
    disconnect() {
      this.connected = false;
    }
  };
}

function createRoom() {
  const room = new ChessRoom('chess-test');
  const whiteToken = 'white-player-token-1234';
  const blackToken = 'black-player-token-1234';
  room.join(whiteToken, 'White Player', fakeSocket());
  room.join(blackToken, 'Black Player', fakeSocket());
  return { room, whiteToken, blackToken };
}

test('chess room waits for both players and assigns white then black', () => {
  const room = new ChessRoom('join-test');
  const white = room.join('white-player-token-1234', 'White Player', fakeSocket());
  assert.equal(white.color, 'w');
  assert.equal(room.started, false);
  const black = room.join('black-player-token-1234', 'Black Player', fakeSocket());
  assert.equal(black.color, 'b');
  assert.equal(room.started, true);
});

test('only the active player can make a legal move', () => {
  const { room, whiteToken, blackToken } = createRoom();
  assert.equal(room.move(blackToken, 'e7', 'e5').success, false);
  assert.equal(room.move(whiteToken, 'e2', 'e5').success, false);
  assert.equal(room.move(whiteToken, 'e2', 'e4').success, true);
  assert.equal(room.move(whiteToken, 'd2', 'd4').success, false);
  assert.equal(room.move(blackToken, 'e7', 'e5').success, true);
});

test('server state includes a board, legal moves, and isolated player colors', () => {
  const { room, whiteToken, blackToken } = createRoom();
  const white = room.stateFor(whiteToken);
  const black = room.stateFor(blackToken);
  assert.equal(white.color, 'w');
  assert.equal(black.color, 'b');
  assert.equal(white.pieces.e1.type, 'k');
  assert.equal(white.pieces.e8.color, 'b');
  assert.ok(white.legalMoves.some(move => move.from === 'e2' && move.to === 'e4'));
  assert.equal(white.yourTurn, true);
  assert.equal(black.yourTurn, false);
});

test('chess.js resolves checkmate and identifies the winning side', () => {
  const { room, whiteToken, blackToken } = createRoom();
  assert.equal(room.move(whiteToken, 'f2', 'f3').success, true);
  assert.equal(room.move(blackToken, 'e7', 'e5').success, true);
  assert.equal(room.move(whiteToken, 'g2', 'g4').success, true);
  assert.equal(room.move(blackToken, 'd8', 'h4').success, true);
  const state = room.stateFor(whiteToken);
  assert.equal(state.checkmate, true);
  assert.equal(state.gameOver, true);
  assert.equal(state.winner, 'b');
});

test('castling and en passant are supported by the chess rules engine', () => {
  const { room, whiteToken, blackToken } = createRoom();
  room.game.load('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(room.move(whiteToken, 'e1', 'g1').success, true);
  assert.equal(room.game.get('g1').type, 'k');
  assert.equal(room.game.get('f1').type, 'r');

  room.game.reset();
  const moves = [
    [whiteToken, 'e2', 'e4'],
    [blackToken, 'a7', 'a6'],
    [whiteToken, 'e4', 'e5'],
    [blackToken, 'd7', 'd5'],
    [whiteToken, 'e5', 'd6']
  ];
  moves.forEach(([token, from, to]) => {
    assert.equal(room.move(token, from, to).success, true);
  });
  assert.equal(room.game.get('d5'), undefined);
  assert.equal(room.game.get('d6').color, 'w');
});

test('promotion supports a selected piece and reconnect preserves the game', () => {
  const { room, whiteToken } = createRoom();
  room.game.load('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  assert.equal(room.move(whiteToken, 'a7', 'a8', 'n').success, true);
  assert.equal(room.game.get('a8').type, 'n');

  const replacement = fakeSocket();
  const result = room.join(whiteToken, 'White Player', replacement);
  assert.equal(result.reconnected, true);
  assert.equal(room.game.get('a8').type, 'n');
  assert.equal(room.stateFor(whiteToken).fen, room.game.fen());
});

test('resigning chess ends the game and awards the win to the opponent', () => {
  const { room, whiteToken, blackToken } = createRoom();
  assert.equal(room.resign(whiteToken), true);
  const white = room.stateFor(whiteToken);
  const black = room.stateFor(blackToken);
  assert.equal(white.gameOver, true);
  assert.equal(white.resultReason, 'resignation');
  assert.equal(white.winner, 'b');
  assert.equal(black.winner, 'b');
  assert.deepEqual(white.legalMoves, []);
  assert.match(white.status, /White resigned\. Black wins/);
  assert.equal(room.move(blackToken, 'e7', 'e5').success, false);
  assert.equal(room.resign(blackToken), false);
});
