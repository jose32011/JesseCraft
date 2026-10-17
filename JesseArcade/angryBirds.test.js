const assert = require('node:assert/strict');
const test = require('node:test');
const { AngryBirdsRoom, simulateShot } = require('./angryBirds');

function playerSocket() {
  return { connected: true, emit() {}, disconnect() {} };
}

function startRoom() {
  const room = new AngryBirdsRoom('duel-room');
  room.join('bird-player-token-01', 'Red', playerSocket());
  room.join('bird-player-token-02', 'Chuck', playerSocket());
  return room;
}

test('Angry Birds duel waits for two players and assigns separate sides', () => {
  const room = new AngryBirdsRoom('duel-room');
  assert.equal(room.join('bird-player-token-01', 'Red', playerSocket()).seat, 0);
  assert.equal(room.started, false);
  assert.equal(room.join('bird-player-token-02', 'Chuck', playerSocket()).seat, 1);
  assert.equal(room.started, true);
  assert.equal(room.stateFor('bird-player-token-02').yourSeat, 1);
});

test('shots are server-authoritative, alternate turns, and damage the rival fort', () => {
  const room = startRoom();
  assert.equal(room.launch('bird-player-token-02', 15, 100).success, false);
  assert.equal(room.launch('bird-player-token-01', 90, 100).success, false);
  assert.equal(room.launch('bird-player-token-01', 15, 100).success, true);
  assert.equal(room.lastShot.hit, 'fort');
  assert.equal(room.fortHealth[1], 2);
  assert.equal(room.turn, 1);
  assert.equal(room.launch('bird-player-token-02', 15, 100).success, true);
  assert.equal(room.fortHealth[0], 2);
});

test('clearing a fort exposes its pig and successful hits end the duel', () => {
  const room = startRoom();
  for (let shot = 0; shot < 3; shot += 1) {
    assert.equal(room.launch('bird-player-token-01', 15, 100).success, true);
    assert.equal(room.launch('bird-player-token-02', 15, 100).success, true);
  }
  assert.equal(room.fortHealth[1], 0);
  assert.equal(room.launch('bird-player-token-01', 15, 100).success, true);
  assert.equal(room.lastShot.hit, 'pig');
  assert.equal(room.pigHealth[1], 60);
  assert.equal(simulateShot(0, 15, 100, 0).hit, 'pig');
});

test('a player can resign and the opponent wins', () => {
  const room = startRoom();
  assert.equal(room.resign('bird-player-token-01'), true);
  assert.equal(room.gameOver, true);
  assert.equal(room.winner, 1);
});

