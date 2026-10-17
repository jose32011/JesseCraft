const assert = require('node:assert/strict');
const test = require('node:test');
const { LADDERS, SNAKES, SnakesLaddersRoom } = require('./snakesLadders');

function fakeSocket() {
  return { connected: true, emit() {}, disconnect() {} };
}

function createRoom(random = () => 0) {
  const room = new SnakesLaddersRoom('snakes-ladders-test', random);
  room.join('player-one-token-1234', 'Player One', fakeSocket());
  room.join('player-two-token-1234', 'Player Two', fakeSocket());
  return room;
}

test('Snakes and Ladders starts when two players join and waits for the current turn', () => {
  const room = new SnakesLaddersRoom('lobby-test');
  room.join('player-one-token-1234', 'Player One', fakeSocket());
  assert.equal(room.started, false);
  room.join('player-two-token-1234', 'Player Two', fakeSocket());
  assert.equal(room.started, true);
  assert.equal(room.stateFor('player-one-token-1234').canRoll, true);
  assert.equal(room.stateFor('player-two-token-1234').canRoll, false);
});

test('Snakes and Ladders supports two to four players in a room', () => {
  const room = new SnakesLaddersRoom('four-player-test');
  [1, 2, 3].forEach(index => {
    const result = room.join(`player-${index}-token-1234`, `Player ${index}`, fakeSocket(), 4);
    assert.equal(result.success, true);
    assert.equal(room.started, false);
  });
  room.join('player-4-token-1234', 'Player 4', fakeSocket(), 4);
  assert.equal(room.started, true);
  assert.equal(room.players.length, 4);
  assert.equal(room.stateFor('player-4-token-1234').players[3].color, 'yellow');
});

test('rolling moves current player and passes turn', () => {
  const room = createRoom(() => 0.5);
  const result = room.roll('player-one-token-1234');
  assert.equal(result.roll, 4);
  assert.equal(room.players[0].position, 4);
  assert.equal(room.currentPlayer().id, 'player-two-token-1234');
});

test('landing on a ladder or snake moves the player to its endpoint', () => {
  const ladderRoom = createRoom(() => 0.99);
  ladderRoom.players[0].position = 1;
  ladderRoom.roll('player-one-token-1234');
  assert.equal(ladderRoom.players[0].position, LADDERS.get(7));

  const snakeRoom = createRoom(() => 0.99);
  snakeRoom.players[0].position = 10;
  snakeRoom.roll('player-one-token-1234');
  assert.equal(snakeRoom.players[0].position, SNAKES.get(16));
});

test('overshooting 100 does not move the token and a player must roll exactly to win', () => {
  const room = createRoom(() => 0.2);
  room.players[0].position = 99;
  room.roll('player-one-token-1234');
  assert.equal(room.players[0].position, 99);
  assert.equal(room.winner, null);

  room.turnIndex = 0;
  room.random = () => 0.2;
  room.players[0].position = 98;
  room.roll('player-one-token-1234');
  assert.equal(room.players[0].position, 100);
  assert.equal(room.winner, 'Player One');
  assert.equal(room.stateFor('player-one-token-1234').gameOver, true);
});

test('resigning ends an active game and awards it to the opponent', () => {
  const room = createRoom();
  const player = room.players[0];
  assert.equal(room.resign(player.id, player.socket), true);
  assert.equal(room.winner, 'Player Two');
  assert.equal(room.resultReason, 'resignation');
  assert.equal(room.roll('player-two-token-1234').success, false);
});
