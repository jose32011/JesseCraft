const assert = require('node:assert/strict');
const test = require('node:test');
const { PacmanRoom, makeMaze } = require('./pacman');

function playerSocket() {
  return { connected: true, emit() {}, disconnect() {} };
}

test('Pac-Man maze is rectangular and has an open spawn for every character', () => {
  const maze = makeMaze();
  assert.equal(maze.length, 15);
  assert.equal(maze.every(row => row.length === 19), true);
  assert.notEqual(maze[7][9], '#');
  assert.notEqual(maze[1][9], '#');
});

test('Pac-Man starts with one monster player and three AI monsters', () => {
  const room = new PacmanRoom('test-room');
  assert.equal(room.join('pacman-token-0001', 'Pac', 'pacman', playerSocket()).started, false);
  assert.equal(room.join('monster-token-001', 'Monster', 'monster', playerSocket()).started, true);
  assert.equal(room.started, true);
  assert.equal(room.monsters.length, 3);
  assert.equal(room.stateFor('pacman-token-0001').role, 'pacman');
});

test('Pac-Man collects pellets and invalid directions are rejected', () => {
  const room = new PacmanRoom('test-room');
  room.join('pacman-token-0001', 'Pac', 'pacman', playerSocket());
  room.join('monster-token-001', 'Monster', 'monster', playerSocket());

  assert.equal(room.setDirection('pacman-token-0001', 'sideways'), false);
  assert.equal(room.setDirection('pacman-token-0001', 'right'), true);
  room.tick();
  assert.equal(room.score, 10);
  assert.equal(room.maze[7][10], ' ');
});

test('a monster collision costs a life and eventually awards the win to the monster', () => {
  const room = new PacmanRoom('test-room');
  room.join('pacman-token-0001', 'Pac', 'pacman', playerSocket());
  room.join('monster-token-001', 'Monster', 'monster', playerSocket());
  room.seats[1].x = room.seats[0].x;
  room.seats[1].y = room.seats[0].y;

  room.tick();
  room.tick();
  room.tick();
  assert.equal(room.lives, 0);
  assert.equal(room.gameOver, true);
  assert.equal(room.winner, 'monster');
});

