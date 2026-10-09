const assert = require('node:assert/strict');
const test = require('node:test');
const { UnoRoom, createDeck } = require('./uno');

function fakeSocket() {
  return { connected: true, emit() {}, disconnect() {} };
}

function createRoom(playerCount = 2, random = () => 0.37) {
  const room = new UnoRoom('uno-test', random);
  for (let index = 0; index < playerCount; index += 1) {
    const result = room.join(
      `player-${index}-token-1234`,
      `Player ${index}`,
      playerCount,
      fakeSocket()
    );
    assert.equal(result.success, true);
  }
  return room;
}

function card(id, color, type = 'number', value = null) {
  return { id, color, type, value };
}

test('standard UNO deck contains 108 proper cards', () => {
  const deck = createDeck();
  assert.equal(deck.length, 108);
  assert.equal(new Set(deck.map(item => item.id)).size, 108);
  for (const color of ['red', 'yellow', 'green', 'blue']) {
    const colored = deck.filter(item => item.color === color);
    assert.equal(colored.filter(item => item.type === 'number').length, 19);
    assert.equal(colored.filter(item => item.type === 'skip').length, 2);
    assert.equal(colored.filter(item => item.type === 'reverse').length, 2);
    assert.equal(colored.filter(item => item.type === 'draw2').length, 2);
    assert.equal(colored.filter(item => item.type === 'number' && item.value === 0).length, 1);
    for (let value = 1; value <= 9; value += 1) {
      assert.equal(colored.filter(item => item.type === 'number' && item.value === value).length, 2);
    }
  }
  assert.equal(deck.filter(item => item.type === 'wild').length, 4);
  assert.equal(deck.filter(item => item.type === 'wildDraw4').length, 4);
});

test('No Mercy deck includes its extra action and wild draw cards', () => {
  const deck = createDeck('no-mercy');
  for (const type of ['discardAll', 'skipEveryone', 'draw6', 'draw10', 'wildDraw6', 'wildDraw10']) {
    assert.ok(deck.some(item => item.type === type), `expected ${type} cards`);
  }
});

test('room deals seven cards and starts once the selected players join', () => {
  const room = new UnoRoom('lobby-test');
  room.join('player-one-token-1234', 'Player One', 3, fakeSocket());
  room.join('player-two-token-1234', 'Player Two', 3, fakeSocket());
  assert.equal(room.started, false);
  room.join('player-three-token-1234', 'Player Three', 3, fakeSocket());
  assert.equal(room.started, true);
  assert.ok(room.players.every(player => player.hand.length === 7));
  assert.equal(room.discardPile[0].type, 'number');
});

test('play validation enforces turns and matching color or symbol', () => {
  const room = createRoom();
  const current = room.players[0];
  const opponent = room.players[1];
  current.hand = [card(500, 'red', 'number', 5), card(501, 'green', 'number', 3)];
  room.discardPile = [card(600, 'blue', 'number', 5)];
  room.currentColor = 'blue';
  assert.equal(room.play(current.id, 501).success, false);
  assert.equal(room.play(opponent.id, 500).success, false);
  assert.equal(room.play(current.id, 500).success, true);
  assert.equal(room.currentColor, 'red');
});

test('wild cards change the active color and Wild Draw Four requires no matching color', () => {
  const room = createRoom();
  const player = room.players[0];
  const wild = card(701, null, 'wild');
  const drawFour = card(702, null, 'wildDraw4');
  player.hand = [card(700, 'blue', 'number', 2), wild, drawFour];
  room.currentColor = 'blue';
  room.discardPile = [card(699, 'blue', 'number', 1)];
  assert.equal(room.play(player.id, wild.id, 'purple').success, false);
  assert.equal(room.play(player.id, wild.id, 'yellow').success, true);
  assert.equal(room.currentColor, 'yellow');
});

test('Wild Draw Four allows a challenge for an illegal play and penalties resolve', () => {
  const illegalRoom = createRoom();
  const attacker = illegalRoom.players[0];
  const challenger = illegalRoom.players[1];
  attacker.hand = [
    card(751, null, 'wildDraw4'),
    card(752, 'blue', 'number', 2),
    card(753, 'red', 'number', 3)
  ];
  illegalRoom.currentColor = 'blue';
  illegalRoom.discardPile = [card(750, 'blue', 'number', 5)];
  assert.equal(illegalRoom.play(attacker.id, 751, 'red').success, true);
  assert.equal(illegalRoom.challengeWildDraw4(challenger.id).challengeWon, true);
  assert.equal(attacker.hand.length, 6);
  assert.equal(illegalRoom.currentPlayer(), challenger);

  const legalRoom = createRoom();
  const legalAttacker = legalRoom.players[0];
  const penalized = legalRoom.players[1];
  legalAttacker.hand = [
    card(761, null, 'wildDraw4'),
    card(762, 'red', 'number', 3),
    card(763, 'green', 'number', 4)
  ];
  legalRoom.currentColor = 'blue';
  legalRoom.discardPile = [card(760, 'blue', 'number', 5)];
  legalRoom.play(legalAttacker.id, 761, 'green');
  assert.equal(legalRoom.challengeWildDraw4(penalized.id).challengeWon, false);
  assert.equal(penalized.hand.length, 13);
  assert.equal(legalRoom.currentPlayer(), legalAttacker);
});

test('a missed UNO call can be caught before the next player acts', () => {
  const room = createRoom();
  const player = room.players[0];
  const opponent = room.players[1];
  player.hand = [card(851, 'red', 'number', 5), card(852, 'green', 'number', 2)];
  room.currentColor = 'blue';
  room.discardPile = [card(850, 'blue', 'number', 5)];
  room.play(player.id, 851);
  assert.equal(room.stateFor(player.id).youNeedToCallUno, true);
  assert.equal(room.callUno(opponent.id).caught, true);
  assert.equal(player.hand.length, 3);
  assert.equal(room.stateFor(player.id).youNeedToCallUno, false);
});

test('draw two penalizes the next player and skips their turn', () => {
  const room = createRoom();
  const current = room.players[0];
  const opponent = room.players[1];
  current.hand = [card(801, 'red', 'draw2'), card(802, 'blue', 'number', 8)];
  opponent.hand = [];
  room.currentColor = 'red';
  room.discardPile = [card(800, 'red', 'number', 4)];
  assert.equal(room.play(current.id, 801).success, true);
  assert.equal(room.pendingDraw, 2);
  assert.equal(room.currentPlayer(), opponent);
  assert.equal(room.stateFor(opponent.id).canPlay.length, 0);
  const result = room.draw(opponent.id);
  assert.equal(result.penalty, 2);
  assert.equal(opponent.hand.length, 2);
  assert.equal(room.currentPlayer(), current);
});

test('reverse changes turn direction and acts as a skip in a two-player game', () => {
  const room = createRoom();
  const current = room.players[0];
  current.hand = [card(901, 'red', 'reverse'), card(902, 'green', 'number', 4)];
  room.currentColor = 'red';
  room.discardPile = [card(900, 'red', 'number', 2)];
  room.play(current.id, 901);
  assert.equal(room.direction, -1);
  assert.equal(room.currentPlayer(), current);
});

test('drawing a playable card allows only that card to be played or passed', () => {
  const room = createRoom();
  const player = room.players[0];
  player.hand = [card(1001, 'red', 'number', 3)];
  room.discardPile = [card(1000, 'blue', 'number', 5)];
  room.currentColor = 'blue';
  room.drawPile = [card(1002, 'blue', 'number', 7)];
  assert.equal(room.draw(player.id).playableCardId, 1002);
  assert.equal(room.play(player.id, 1001).success, false);
  assert.equal(room.play(player.id, 1002).success, true);
});

test('playing the last card wins and resignation awards the game to an opponent', () => {
  const room = createRoom();
  const player = room.players[0];
  player.hand = [card(1101, 'red', 'number', 5)];
  room.currentColor = 'red';
  room.discardPile = [card(1100, 'blue', 'number', 5)];
  assert.equal(room.play(player.id, 1101).success, true);
  assert.equal(room.winner, player.name);
  assert.equal(room.stateFor(player.id).gameOver, true);

  const resignRoom = createRoom(3);
  const resigning = resignRoom.players[0];
  assert.equal(resignRoom.resign(resigning.id, resigning.socket), true);
  assert.equal(resignRoom.winner, 'Player 1');
  assert.equal(resignRoom.resultReason, 'resignation');
});

test('solo and two-human modes fill remaining UNO seats with AI', () => {
  const solo = new UnoRoom('solo-ai');
  solo.join('human-token-0000001', 'Human', 3, fakeSocket(), 'vs-ai', 'normal');
  assert.equal(solo.started, true);
  assert.equal(solo.players.filter(player => player.isAI).length, 2);
  const computer = solo.players[2];
  solo.discardPile = [card(1200, 'red', 'number', 5)];
  solo.currentColor = 'red';
  solo.turnIndex = 2;
  computer.hand = [card(1201, 'red', 'number', 2), card(1202, 'blue', 'number', 1)];
  assert.equal(solo.takeAiTurn(), true);
  assert.equal(solo.currentPlayer(), solo.players[0]);
  assert.equal(computer.hand.length, 1);

  const partners = new UnoRoom('two-humans-and-ai');
  partners.join('human-token-0000002', 'Human One', 4, fakeSocket(), 'online-ai', 'normal');
  assert.equal(partners.started, false);
  partners.join('human-token-0000003', 'Human Two', 4, fakeSocket(), 'online-ai', 'normal');
  assert.equal(partners.started, true);
  assert.equal(partners.players.filter(player => !player.isAI).length, 2);
  assert.equal(partners.players.filter(player => player.isAI).length, 2);
});

test('No Mercy stacks draw penalties and lets players swap hands with a 7', () => {
  const room = createRoom(3);
  room.variant = 'no-mercy';
  const [first, second] = room.players;
  first.hand = [card(1301, 'red', 'draw2'), card(1302, 'blue', 'number', 1)];
  second.hand = [card(1303, null, 'wildDraw6'), card(1304, 'yellow', 'number', 2)];
  room.discardPile = [card(1300, 'red', 'number', 3)];
  room.currentColor = 'red';
  assert.equal(room.play(first.id, 1301).success, true);
  assert.equal(room.pendingDraw, 2);
  assert.equal(room.stateFor(second.id).canPlay.includes(1303), true);
  assert.equal(room.play(second.id, 1303, 'blue').success, true);
  assert.equal(room.pendingDraw, 8);

  room.pendingDraw = 0;
  room.unoPendingToken = null;
  room.wildDraw4Challenge = null;
  room.turnIndex = 0;
  first.hand = [card(1311, 'blue', 'number', 7), card(1312, 'green', 'number', 1)];
  second.hand = [card(1313, 'yellow', 'number', 4), card(1314, 'red', 'number', 2)];
  room.discardPile = [card(1310, 'red', 'number', 7)];
  room.currentColor = 'red';
  assert.equal(room.play(first.id, 1311, undefined, second.id).success, true);
  assert.deepEqual(first.hand, [card(1313, 'yellow', 'number', 4), card(1314, 'red', 'number', 2)]);
  assert.deepEqual(second.hand, [card(1312, 'green', 'number', 1)]);
});

test('No Mercy discard-all and skip-everyone actions resolve', () => {
  const room = createRoom(3);
  room.variant = 'no-mercy';
  const [first, second] = room.players;
  first.hand = [
    card(1401, 'red', 'discardAll'),
    card(1402, 'red', 'number', 3),
    card(1403, 'blue', 'number', 4),
    card(1404, 'blue', 'skipEveryone')
  ];
  room.discardPile = [card(1400, 'red', 'number', 2)];
  room.currentColor = 'red';
  assert.equal(room.play(first.id, 1401).success, true);
  assert.deepEqual(first.hand.map(item => item.id), [1403, 1404]);
  room.turnIndex = 0;
  room.currentColor = 'blue';
  room.discardPile = [card(1405, 'blue', 'number', 9)];
  assert.equal(room.play(first.id, 1404).success, true);
  assert.equal(room.currentPlayer(), first);
  assert.equal(room.players[1], second);
});

test('No Mercy rotates hands on zero and eliminates players above 25 cards', () => {
  const room = createRoom(3);
  room.variant = 'no-mercy';
  const [first, second, third] = room.players;
  first.hand = [card(1501, 'red', 'number', 0), card(1502, 'blue', 'number', 3)];
  second.hand = [card(1503, 'yellow', 'number', 1)];
  third.hand = [card(1504, 'green', 'number', 2)];
  room.discardPile = [card(1500, 'red', 'number', 4)];
  room.currentColor = 'red';
  assert.equal(room.play(first.id, 1501).success, true);
  assert.deepEqual(second.hand, [card(1502, 'blue', 'number', 3)]);
  assert.deepEqual(third.hand, [card(1503, 'yellow', 'number', 1)]);
  assert.deepEqual(first.hand, [card(1504, 'green', 'number', 2)]);

  room.turnIndex = 1;
  room.unoPendingToken = null;
  second.hand = Array.from({ length: 20 }, (_, index) => card(1600 + index, 'blue', 'number', index % 10));
  room.pendingDraw = 6;
  room.drawPile = Array.from({ length: 6 }, (_, index) => card(1700 + index, 'red', 'number', index % 10));
  assert.equal(room.draw(second.id).eliminated, true);
  assert.equal(second.eliminated, true);
  assert.equal(room.currentPlayer(), third);

  const singleDrawRoom = createRoom();
  singleDrawRoom.variant = 'no-mercy';
  singleDrawRoom.players[0].hand = Array.from({ length: 25 }, (_, index) =>
    card(1800 + index, 'red', 'number', index % 10));
  singleDrawRoom.discardPile = [card(1799, 'red', 'number', 1)];
  singleDrawRoom.currentColor = 'red';
  singleDrawRoom.drawPile = [card(1825, 'red', 'number', 5)];
  assert.equal(singleDrawRoom.draw(singleDrawRoom.players[0].id).eliminated, true);
  assert.equal(singleDrawRoom.players[0].eliminated, true);
});
