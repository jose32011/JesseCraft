const assert = require('node:assert/strict');
const test = require('node:test');
const { LudoRoom, TRACK, HOME_LANES, START_OFFSETS } = require('./ludo');

function fakeSocket() {
  return {
    connected: true,
    emit() {},
    disconnect() {
      this.connected = false;
    }
  };
}

function createOnlineRoom(random = () => 0) {
  const room = new LudoRoom('test-room', random);
  assert.equal(room.join('player-one-token-1234', 'Player One', 'online', fakeSocket()).success, true);
  assert.equal(room.started, false);
  assert.equal(room.join('player-two-token-1234', 'Player Two', 'online', fakeSocket()).success, true);
  assert.equal(room.started, true);
  return room;
}

test('board path and home lanes have the expected Ludo dimensions', () => {
  assert.equal(TRACK.length, 52);
  assert.equal(new Set(TRACK.map(([x, y]) => `${x},${y}`)).size, TRACK.length);
  assert.equal(HOME_LANES.length, 4);
  assert.ok(HOME_LANES.every(lane => lane.length === 6));
  const trackSpaces = new Set(TRACK.map(([x, y]) => `${x},${y}`));
  assert.ok(HOME_LANES.every(lane =>
    lane.every(([x, y]) => !trackSpaces.has(`${x},${y}`))
  ));
  START_OFFSETS.forEach((startOffset, seat) => {
    const [trackX, trackY] = TRACK[(startOffset + TRACK.length - 1) % TRACK.length];
    const [laneX, laneY] = HOME_LANES[seat][0];
    assert.equal(Math.abs(trackX - laneX) + Math.abs(trackY - laneY), 1);
  });
});

test('online mode starts only after both players join and rejects a different mode', () => {
  const room = new LudoRoom('join-test');
  room.join('player-one-token-1234', 'Player One', 'online', fakeSocket());
  assert.equal(room.started, false);
  assert.equal(room.join('player-two-token-1234', 'Player Two', 'vs-ai', fakeSocket()).success, false);
  assert.equal(room.join('player-two-token-1234', 'Player Two', 'online', fakeSocket()).success, true);
  assert.deepEqual(room.turnOrder, [0, 2]);
});

test('players need a six to leave base and a six grants another turn', () => {
  const room = createOnlineRoom(() => 0.99);
  const token = 'player-one-token-1234';
  assert.deepEqual(room.legalMovesFor(room.seatForToken(token), 5), []);
  assert.equal(room.roll(token).success, true);
  assert.deepEqual(room.legalMoves, [0, 1, 2, 3]);
  assert.equal(room.move(token, 0).success, true);
  assert.equal(room.seatForToken(token).pieces[0], 0);
  assert.equal(room.currentPlayer().id, token);
});

test('a non-six with no legal moves passes the turn', () => {
  const room = createOnlineRoom(() => 0);
  const token = 'player-one-token-1234';
  assert.equal(room.roll(token).success, true);
  assert.equal(room.legalMoves.length, 0);
  assert.equal(room.diceValue, null);
  assert.equal(room.currentPlayer().id, 'player-two-token-1234');
});

test('captures return an opponent piece to base on an unsafe track space', () => {
  const room = createOnlineRoom(() => 0);
  const moving = room.seatForToken('player-one-token-1234');
  const target = room.seatForToken('player-two-token-1234');
  moving.pieces[0] = 1;
  target.pieces[0] = 28;
  assert.equal(room.roll(moving.id).success, true);
  const result = room.move(moving.id, 0);
  assert.deepEqual(result.captured, [{ seat: target.index, piece: 0 }]);
  assert.equal(target.pieces[0], -1);
});

test('pieces must reach home with an exact roll and the first player to finish wins', () => {
  const room = createOnlineRoom(() => 0);
  const player = room.seatForToken('player-one-token-1234');
  player.pieces[0] = 56;
  player.pieces[1] = 57;
  player.pieces[2] = 57;
  player.pieces[3] = 57;
  assert.equal(room.roll(player.id).success, true);
  assert.deepEqual(room.legalMoves, [0]);
  assert.equal(room.move(player.id, 0).success, true);
  assert.equal(player.pieces[0], 57);
  assert.equal(room.winner, player.name);
});

test('the AI modes populate their selected seats', () => {
  const againstAi = new LudoRoom('ai-test');
  againstAi.join('player-one-token-1234', 'Player One', 'vs-ai', fakeSocket());
  assert.equal(againstAi.started, true);
  assert.equal(againstAi.seats[2].isAI, true);

  const withAiSeats = new LudoRoom('online-ai-test');
  withAiSeats.join('player-one-token-1234', 'Player One', 'online-ai', fakeSocket());
  withAiSeats.join('player-two-token-1234', 'Player Two', 'online-ai', fakeSocket());
  assert.equal(withAiSeats.started, true);
  assert.equal(withAiSeats.seats[1].isAI, true);
  assert.equal(withAiSeats.seats[3].isAI, true);
  assert.deepEqual(withAiSeats.turnOrder, [0, 1, 2, 3]);
});

test('AI takes a turn and passes to the human when it has no legal move', async () => {
  const room = new LudoRoom('ai-turn-test', () => 0);
  room.join('player-one-token-1234', 'Player One', 'vs-ai', fakeSocket());
  room.turnIndex = 1;
  let broadcasts = 0;
  await room.applyAiTurn(() => broadcasts++);
  assert.equal(room.currentPlayer().id, 'player-one-token-1234');
  assert.equal(broadcasts, 1);
});

test('AI can finish the final piece and win the game', async () => {
  const room = new LudoRoom('ai-win-test', () => 0);
  room.join('player-one-token-1234', 'Player One', 'vs-ai', fakeSocket());
  const ai = room.seats[2];
  ai.pieces = [56, 57, 57, 57];
  room.turnIndex = 1;
  await room.applyAiTurn(() => {});
  assert.equal(ai.pieces[0], 57);
  assert.equal(room.winner, ai.name);
});

test('reconnecting restores the same seat and preserves piece positions', () => {
  const room = createOnlineRoom();
  const token = 'player-one-token-1234';
  const player = room.seatForToken(token);
  player.pieces[2] = 14;
  const replacementSocket = fakeSocket();
  const result = room.join(token, 'Player One', 'online', replacementSocket);
  assert.equal(result.reconnected, true);
  assert.equal(room.seatForToken(token).pieces[2], 14);
  assert.equal(room.seats.filter(seat => seat && !seat.isAI).length, 2);
});

test('resigning Ludo awards the match to the other human and blocks further play', () => {
  const room = createOnlineRoom();
  const token = 'player-one-token-1234';
  const player = room.seatForToken(token);
  const opponent = room.seatForToken('player-two-token-1234');

  assert.equal(room.resign(token, player.socket), true);
  assert.equal(room.winner, opponent.name);
  assert.equal(room.resultReason, 'resignation');
  assert.equal(room.stateFor(token).gameOver, true);
  assert.equal(room.roll('player-two-token-1234').success, false);
  assert.equal(room.resign('player-two-token-1234', opponent.socket), false);
});
