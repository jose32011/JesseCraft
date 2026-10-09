const assert = require('node:assert/strict');
const test = require('node:test');
const cardApi = require('./cardApi');
const { Game } = require('./server');

function fakeSocket() {
  return {
    connected: true,
    messages: [],
    emit(event, payload) {
      this.messages.push({ event, payload });
    }
  };
}

test('Yu-Gi-Oh lobby starts after both unique players ready and deals opening hands', async () => {
  const originalGenerateThemedDeck = cardApi.generateThemedDeck;
  cardApi.generateThemedDeck = async () => ({
    mainDeck: Array.from({ length: 40 }, (_, index) => ({ id: index })),
    extraDeck: []
  });

  try {
    const game = new Game('ready-flow-test');
    assert.equal(game.addPlayer(fakeSocket(), 'player-one-token-1234', 'Player One', 'Blue-Eyes'), true);
    assert.equal(game.addPlayer(fakeSocket(), 'player-two-token-1234', 'Player Two', 'Toon'), true);

    assert.equal(game.setPlayerReady('player-one-token-1234', true), true);
    assert.equal(game.gameStarted, false);
    assert.equal(game.setPlayerReady('player-two-token-1234', true), true);
    assert.equal(await game.startGame(), true);

    assert.equal(game.gameStarted, true);
    assert.equal(game.starting, false);
    assert.equal(game.players['player-one-token-1234'].hand.length, 5);
    assert.equal(game.players['player-two-token-1234'].hand.length, 5);
    assert.equal(game.players['player-one-token-1234'].deck.length, 35);
    assert.equal(game.players['player-two-token-1234'].deck.length, 35);
  } finally {
    cardApi.generateThemedDeck = originalGenerateThemedDeck;
  }
});

test('Yu-Gi-Oh lobby does not start with only one ready player', async () => {
  const game = new Game('one-ready-test');
  game.addPlayer(fakeSocket(), 'player-one-token-1234', 'Player One', 'Blue-Eyes');
  game.addPlayer(fakeSocket(), 'player-two-token-1234', 'Player Two', 'Toon');
  assert.equal(game.setPlayerReady('player-one-token-1234', true), true);
  assert.equal(await game.startGame(), false);
  assert.equal(game.gameStarted, false);
});

test('failed deck generation leaves both hands and decks untouched for retry', async () => {
  const originalGenerateThemedDeck = cardApi.generateThemedDeck;
  cardApi.generateThemedDeck = async archetype => ({
    mainDeck: Array.from(
      { length: archetype === 'Toon' ? 39 : 40 },
      (_, index) => ({ id: index })
    ),
    extraDeck: []
  });

  try {
    const game = new Game('failed-deck-test');
    game.addPlayer(fakeSocket(), 'player-one-token-1234', 'Player One', 'Blue-Eyes');
    game.addPlayer(fakeSocket(), 'player-two-token-1234', 'Player Two', 'Toon');
    game.setPlayerReady('player-one-token-1234', true);
    game.setPlayerReady('player-two-token-1234', true);

    await assert.rejects(game.startGame(), /Invalid generated deck/);
    assert.equal(game.gameStarted, false);
    assert.equal(game.starting, false);
    Object.values(game.players).forEach(player => {
      assert.equal(player.hand.length, 0);
      assert.equal(player.deck.length, 0);
    });
  } finally {
    cardApi.generateThemedDeck = originalGenerateThemedDeck;
  }
});

test('resigning an active Yu-Gi-Oh duel awards the win to the opponent', () => {
  const game = new Game('resign-test');
  game.addPlayer(fakeSocket(), 'player-one-token-1234', 'Player One', 'Blue-Eyes');
  game.addPlayer(fakeSocket(), 'player-two-token-1234', 'Player Two', 'Toon');
  game.gameStarted = true;

  assert.equal(game.resign('player-one-token-1234'), true);
  assert.equal(game.gameOver, true);
  assert.equal(game.winnerId, 'player-two-token-1234');
  assert.equal(game.resultReason, 'resignation');
  assert.equal(game.resign('player-two-token-1234'), false);
});

test('activated spells and Trap Hole expose card-effect animation details', () => {
  const game = new Game('card-animation-test');
  const playerId = 'player-one-token-1234';
  const opponentId = 'player-two-token-1234';
  game.addPlayer(fakeSocket(), playerId, 'Player One', 'Blue-Eyes');
  game.addPlayer(fakeSocket(), opponentId, 'Player Two', 'Toon');
  game.gameStarted = true;
  game.currentPhase = 'main1';
  const spell = {
    id: 9001,
    name: 'Dark Hole',
    type: 'spell',
    images: [{ image_url: 'https://example.test/dark-hole.jpg' }]
  };
  const summoned = {
    id: 9002,
    name: 'Test Dragon',
    type: 'monster',
    level: 4,
    atk: 1500,
    def: 1200
  };
  game.players[playerId].hand.push(spell);
  game.players[opponentId].field.monsterZones[0] = { ...summoned };
  assert.equal(game.activateEffect(playerId, 0), true);
  assert.equal(game.lastEffect.card.name, 'Dark Hole');
  assert.match(game.lastEffect.description, /destroyed all monsters/);
  assert.equal(game.players[opponentId].field.monsterZones[0], null);

  game.currentPhase = 'main1';
  game.turnNumber = 2;
  game.players[playerId].hand.push(summoned);
  game.players[opponentId].field.spellTrapZones[0] = {
    name: 'Trap Hole',
    type: 'trap',
    faceDown: true,
    setTurn: 1
  };
  assert.equal(game.playCard(playerId, 0, 'monster', 0, 'summonAttack', []), true);
  assert.equal(game.lastEffect.card.name, 'Trap Hole');
  assert.match(game.lastEffect.description, /destroyed Test Dragon/);
});

test('battle damage is reflected in Life Points before animation delivery', () => {
  const game = new Game('battle-damage-animation-test');
  const playerId = 'player-one-token-1234';
  const opponentId = 'player-two-token-1234';
  game.addPlayer(fakeSocket(), playerId, 'Player One', 'Blue-Eyes');
  game.addPlayer(fakeSocket(), opponentId, 'Player Two', 'Toon');
  game.gameStarted = true;
  game.currentPhase = 'battle';
  game.turnNumber = 1;
  game.players[playerId].field.monsterZones[0] = {
    name: 'Attacker',
    type: 'monster',
    atk: 2500,
    def: 2000,
    position: 'attack',
    canAttack: true
  };
  game.players[opponentId].field.monsterZones[0] = {
    name: 'Defender',
    type: 'monster',
    atk: 1800,
    def: 1600,
    position: 'attack',
    canAttack: false
  };

  assert.equal(game.attack(playerId, 0, 0), true);
  assert.equal(game.players[opponentId].lifePoints, 7300);
  assert.equal(game.players[opponentId].field.monsterZones[0], null);
});
