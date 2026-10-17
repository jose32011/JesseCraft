const assert = require('node:assert/strict');
const test = require('node:test');
const { RtsRoom } = require('./rts');

function playerSocket() {
  return { connected: true, emit() {}, disconnect() {} };
}

function startRoom() {
  const room = new RtsRoom('frontier-room');
  room.join('rts-player-token-001', 'Sol', playerSocket());
  room.join('rts-player-token-002', 'Ash', playerSocket());
  return room;
}

test('Frontier Realms starts with two factions, town centers, and villagers', () => {
  const room = new RtsRoom('frontier-room');
  room.join('rts-player-token-001', 'Sol', playerSocket());
  assert.equal(room.started, false);
  room.join('rts-player-token-002', 'Ash', playerSocket());
  assert.equal(room.started, true);
  assert.equal(room.units.length, 6);
  assert.equal(room.buildings.length, 2);
  assert.equal(room.stateFor('rts-player-token-002').yourSeat, 1);
});

test('villagers gather finite map resources and add them to player stock', () => {
  const room = startRoom();
  const villager = room.units.find(unit => unit.owner === 0 && unit.type === 'villager');
  const node = room.resourceNodes.find(item => item.id === 'wood-west');
  const initialWood = room.resources[0].wood;
  assert.equal(room.command('rts-player-token-001', [villager.id], {
    kind: 'gather',
    nodeId: node.id
  }).success, true);
  for (let tick = 0; tick < 100; tick += 1) room.tick();
  assert.ok(room.resources[0].wood > initialWood);
  assert.ok(node.remaining < 120);
});

test('training and building spend resources and enforce tower limits', () => {
  const room = startRoom();
  const initialGold = room.resources[0].gold;
  assert.equal(room.action('rts-player-token-001', 'archer').success, true);
  assert.equal(room.resources[0].gold, initialGold - 35);
  room.resources[0].wood = 500;
  room.resources[0].gold = 500;
  for (let tower = 0; tower < 3; tower += 1) {
    assert.equal(room.action('rts-player-token-001', 'watchtower').success, true);
  }
  const stock = { ...room.resources[0] };
  assert.equal(room.action('rts-player-token-001', 'watchtower').success, false);
  assert.deepEqual(room.resources[0], stock);
});

test('commands only affect owned units and accept bounded move destinations', () => {
  const room = startRoom();
  const unit = room.units.find(item => item.owner === 0);
  const enemy = room.units.find(item => item.owner === 1);
  assert.equal(room.command('rts-player-token-001', [enemy.id], {
    kind: 'move', x: 500, y: 360
  }).success, false);
  assert.equal(room.command('rts-player-token-001', [unit.id], {
    kind: 'move', x: 50000, y: -20
  }).success, true);
  assert.equal(unit.target.x, 1165);
  assert.equal(unit.target.y, 35);
});

test('destroying a town center ends the battle and awards the other seat', () => {
  const room = startRoom();
  const attacker = room.units.find(unit => unit.owner === 0 && unit.type === 'spearman');
  const townCenter = room.buildings.find(building => building.owner === 1);
  attacker.x = townCenter.x - 40;
  attacker.y = townCenter.y;
  townCenter.hp = 1;
  assert.equal(room.command('rts-player-token-001', [attacker.id], {
    kind: 'attack', targetId: townCenter.id
  }).success, true);
  room.tick();
  assert.equal(room.gameOver, true);
  assert.equal(room.winner, 0);
});

test('only the current socket can mark a player disconnected', () => {
  const room = startRoom();
  const original = room.seats[0].socket;
  const replacement = playerSocket();
  room.join('rts-player-token-001', 'Sol', replacement);
  assert.equal(room.disconnect('rts-player-token-001', original), false);
  assert.equal(room.seats[0].connected, true);
});
