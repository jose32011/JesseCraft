const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const cardApi = require('./cardApi');
const { registerLudoHandlers } = require('./ludo');
const { registerChessHandlers } = require('./chess');
const { registerSnakesLaddersHandlers } = require('./snakesLadders');
const { registerUnoHandlers } = require('./uno');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const JESSE_CRAFT_BUILD_DIR = path.join(__dirname, 'dist');
const DECK_ARCHETYPES = new Set([
  'Blue-Eyes',
  'Toon',
  'Dark Magician',
  'Cyber Dragon',
  'Elemental HERO',
  'Red-Eyes',
  'Dragonmaid'
]);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/jesse-craft', express.static(JESSE_CRAFT_BUILD_DIR));

// Game state storage
const games = Object.create(null);

// Game class to manage individual game instances
class Game {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = Object.create(null);
    this.turn = 0;
    this.currentPhase = 'draw';
    this.phases = ['draw', 'standby', 'main1', 'battle', 'main2', 'end'];
    this.phaseIndex = 0;
    this.gameStarted = false;
    this.starting = false;
    this.turnNumber = 0;
    this.normalSummonUsed = false;
    this.gameOver = false;
    this.winnerId = null;
    this.resultReason = null;
    this.lastEffect = null;
  }

  addPlayer(socket, playerToken, playerName, deckType) {
    if (this.gameStarted || this.starting ||
        Object.keys(this.players).length >= 2 ||
        !DECK_ARCHETYPES.has(deckType) || this.players[playerToken]) return false;
    
    this.players[playerToken] = {
      name: playerName,
      deckType,
      ready: false,
      socket: socket,
      lifePoints: 8000,
      hand: [],
      deck: [],
      field: {
        monsterZones: [null, null, null, null, null],
        spellTrapZones: [null, null, null, null, null],
        fieldZone: null,
        graveyard: [],
        extraDeck: [],
        banished: []
      }
    };
    return true;
  }

  setPlayerReady(playerId, ready) {
    const player = this.players[playerId];
    if (!player || typeof ready !== 'boolean' || this.gameStarted || this.starting) return false;
    player.ready = ready;
    return true;
  }

  async startGame() {
    const playerCount = Object.keys(this.players).length;
    if (this.gameStarted || this.starting || playerCount !== 2 ||
        !Object.values(this.players).every(player => player.ready)) return false;

    this.starting = true;
    try {
      const playerIds = Object.keys(this.players);
      const decks = await Promise.all(playerIds.map(playerId =>
        cardApi.generateThemedDeck(this.players[playerId].deckType)
      ));
      decks.forEach((deck, index) => {
        const player = this.players[playerIds[index]];
        if (!Array.isArray(deck.mainDeck) || deck.mainDeck.length !== 40 ||
            !Array.isArray(deck.extraDeck) || deck.extraDeck.length > 15) {
          throw new Error(`Invalid generated deck for ${player.deckType}.`);
        }
      });

      playerIds.forEach((playerId, index) => {
        const player = this.players[playerId];
        const { mainDeck, extraDeck } = decks[index];
        player.deck = mainDeck;
        player.field.extraDeck = extraDeck;
        this.shuffleDeck(player.deck);
        for (let i = 0; i < 5; i++) player.hand.push(player.deck.pop());
        console.log(`Player ${player.name} starts with ${player.hand.length} cards and ${player.deck.length} cards in deck`);
      });

      this.turn = 0;
      this.turnNumber = 0;
      this.phaseIndex = 0;
      this.currentPhase = this.phases[0];
      this.gameStarted = true;
      return true;
    } finally {
      this.starting = false;
    }
  }

  shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  getCurrentPlayer() {
    const playerIds = Object.keys(this.players);
    if (playerIds.length === 0) return null;
    return this.players[playerIds[this.turn % playerIds.length]];
  }

  getOpponent(playerId) {
    const playerIds = Object.keys(this.players);
    const opponentId = playerIds.find(id => id !== playerId);
    return this.players[opponentId];
  }

  canNewMonsterAttack() {
    return this.turnNumber > 0;
  }

  nextPhase(playerId) {
    if (!this.gameStarted || this.gameOver || this.getCurrentPlayerId() !== playerId) return false;

    this.phaseIndex = (this.phaseIndex + 1) % this.phases.length;
    this.currentPhase = this.phases[this.phaseIndex];
    
    if (this.currentPhase === 'end') {
      this.turn = (this.turn + 1) % Object.keys(this.players).length;
      this.turnNumber++;
      this.phaseIndex = 0;
      this.currentPhase = this.phases[0];
      this.normalSummonUsed = false;
      const currentPlayer = this.getCurrentPlayer();
      currentPlayer.field.monsterZones.forEach(monster => {
        if (monster) monster.canAttack = monster.position !== 'defense';
      });
      this.drawForCurrentPlayer();
    }
    return true;
  }

  drawForCurrentPlayer() {
    const player = this.getCurrentPlayer();
    if (!player || this.gameOver) return false;
    if (player.deck.length === 0) {
      this.gameOver = true;
      this.winnerId = Object.keys(this.players).find(id => id !== this.getCurrentPlayerId()) || null;
      this.resultReason = 'deck-out';
      return false;
    }

    player.hand.push(player.deck.pop());
    console.log(`Player ${player.name} drew a card; ${player.deck.length} cards remain in deck`);
    return true;
  }

  getCurrentPlayerId() {
    const playerIds = Object.keys(this.players);
    return playerIds.length === 0 ? null : playerIds[this.turn % playerIds.length];
  }

  getRequiredTributes(card) {
    if (!Number.isFinite(card.level) || card.level <= 4) return 0;
    return card.level <= 6 ? 1 : 2;
  }

  playCard(playerId, cardIndex, zone, zoneIndex, action, tributeIndices = []) {
    this.lastEffect = null;
    const player = this.players[playerId];
    if (!player || this.gameOver) return false;

    if (this.getCurrentPlayerId() !== playerId ||
        !['main1', 'main2'].includes(this.currentPhase) ||
        !Number.isInteger(zoneIndex) || zoneIndex < 0 || zoneIndex > 4) {
      return false;
    }
    
    const card = player.hand[cardIndex];
    if (!card) return false;

    if (zone === 'monster') {
      if (card.type !== 'monster') return false;
      if (!['summonAttack', 'summonDefense', 'setDefense'].includes(action)) return false;
      if (this.normalSummonUsed) return false;

      const requiredTributes = this.getRequiredTributes(card);
      if (!Array.isArray(tributeIndices) ||
          tributeIndices.length !== requiredTributes ||
          new Set(tributeIndices).size !== requiredTributes ||
          (player.field.monsterZones[zoneIndex] && !tributeIndices.includes(zoneIndex)) ||
          tributeIndices.some(index =>
            !Number.isInteger(index) ||
            index < 0 ||
            index >= player.field.monsterZones.length ||
            !player.field.monsterZones[index]
          )) {
        return false;
      }

      const position = action === 'summonAttack' ? 'attack' : 'defense';
      tributeIndices.forEach(index => {
        player.field.graveyard.push(player.field.monsterZones[index]);
        player.field.monsterZones[index] = null;
      });
      player.field.monsterZones[zoneIndex] = {
        ...card,
        position,
        faceDown: action === 'setDefense',
        canAttack: position === 'attack' && this.canNewMonsterAttack()
      };
      this.normalSummonUsed = true;
    } else if (zone === 'spellTrap') {
      if (card.type !== 'spell' && card.type !== 'trap') return false;
      if (player.field.spellTrapZones[zoneIndex]) return false;
      if (card.type === 'spell' && action !== 'activateSpell' && action !== 'setSpell') return false;
      if (card.type === 'trap' && action !== 'setTrap') return false;
      if (card.type === 'spell' &&
          ['Dark Hole', 'Monster Reborn', 'Mystical Space Typhoon', 'Polymerization'].includes(card.name) &&
          action === 'activateSpell') return false;
      player.field.spellTrapZones[zoneIndex] = {
        ...card,
        faceDown: action !== 'activateSpell',
        activated: action === 'activateSpell',
        setTurn: action === 'activateSpell' ? null : this.turnNumber
      };
      if (action === 'activateSpell') {
        this.lastEffect = {
          card,
          kind: 'spell',
          description: `${card.name} was activated.`
        };
      }
    } else {
      return false;
    }

    player.hand.splice(cardIndex, 1);
    if (zone === 'monster' && action !== 'setDefense') {
      this.triggerTrapHole(playerId, zoneIndex);
    }
    
    return true;
  }

  triggerTrapHole(summonedPlayerId, monsterIndex) {
    const player = this.players[summonedPlayerId];
    const opponent = this.getOpponent(summonedPlayerId);
    const summoned = player && player.field.monsterZones[monsterIndex];
    if (!player || !opponent || !summoned || summoned.atk < 1000) return false;

    const trapIndex = opponent.field.spellTrapZones.findIndex(card =>
      card && card.name === 'Trap Hole' && card.faceDown && card.setTurn < this.turnNumber
    );
    if (trapIndex < 0) return false;

    const trap = opponent.field.spellTrapZones[trapIndex];
    opponent.field.graveyard.push(trap);
    opponent.field.spellTrapZones[trapIndex] = null;
    player.field.graveyard.push(summoned);
    player.field.monsterZones[monsterIndex] = null;
    this.lastEffect = {
      card: trap,
      kind: 'trap',
      description: `Trap Hole destroyed ${summoned.name} when it was Summoned.`
    };
    return true;
  }

  activateEffect(playerId, cardIndex, target = {}) {
    this.lastEffect = null;
    const player = this.players[playerId];
    const opponent = this.getOpponent(playerId);
    if (!player || !opponent || this.gameOver ||
        this.getCurrentPlayerId() !== playerId ||
        !['main1', 'main2'].includes(this.currentPhase)) return false;

    const card = player.hand[cardIndex];
    if (!card || card.type !== 'spell') return false;

    if (card.name === 'Dark Hole') {
      player.hand.splice(cardIndex, 1);
      player.field.graveyard.push(card);
      [player, opponent].forEach(owner => {
        owner.field.monsterZones.forEach((monster, index) => {
          if (!monster) return;
          owner.field.graveyard.push(monster);
          owner.field.monsterZones[index] = null;
        });
      });
      this.lastEffect = {
        card,
        kind: 'spell',
        description: 'Dark Hole destroyed all monsters on the field.'
      };
      return true;
    }

    if (card.name === 'Mystical Space Typhoon') {
      const targetPlayer = target.side === 'opponent' ? opponent : target.side === 'you' ? player : null;
      const zoneIndex = target.zoneIndex;
      if (!targetPlayer || !Number.isInteger(zoneIndex) ||
          zoneIndex < 0 || zoneIndex >= targetPlayer.field.spellTrapZones.length) return false;
      const targetCard = targetPlayer.field.spellTrapZones[zoneIndex];
      if (!targetCard) return false;
      targetPlayer.field.spellTrapZones[zoneIndex] = null;
      targetPlayer.field.graveyard.push(targetCard);
      player.hand.splice(cardIndex, 1);
      player.field.graveyard.push(card);
      this.lastEffect = {
        card,
        kind: 'spell',
        description: `${card.name} destroyed ${targetCard.name}.`
      };
      return true;
    }

    if (card.name === 'Monster Reborn') {
      const targetPlayer = target.side === 'opponent' ? opponent : target.side === 'you' ? player : null;
      const zoneIndex = target.zoneIndex;
      if (!targetPlayer || !Number.isInteger(target.graveyardIndex) ||
          !Number.isInteger(zoneIndex) || zoneIndex < 0 || zoneIndex > 4 ||
          zoneIndex >= player.field.monsterZones.length || player.field.monsterZones[zoneIndex]) return false;
      const monster = targetPlayer.field.graveyard[target.graveyardIndex];
      if (!monster || monster.type !== 'monster') return false;
      targetPlayer.field.graveyard.splice(target.graveyardIndex, 1);
      player.field.monsterZones[zoneIndex] = {
        ...monster,
        position: 'attack',
        faceDown: false,
        canAttack: this.canNewMonsterAttack()
      };
      player.hand.splice(cardIndex, 1);
      player.field.graveyard.push(card);
      this.lastEffect = {
        card,
        kind: 'spell',
        description: `Monster Reborn Special Summoned ${monster.name}.`
      };
      return true;
    }

    return false;
  }

  getFusionRecipe(name) {
    const normalize = value => String(value || '').toLowerCase();
    const exactNames = (...names) => materials =>
      names.every(name => materials.some(card => normalize(card.name) === normalize(name))) &&
      new Set(materials.map(card => normalize(card.name))).size >= new Set(names.map(normalize)).size;
    const fusionName = normalize(name);
    const twoOf = materialName => materials =>
      materials.length === 2 && materials.every(card => normalize(card.name) === normalize(materialName));

    const recipes = {
      'blue-eyes twin burst dragon': { count: 2, matches: twoOf('Blue-Eyes White Dragon') },
      'blue-eyes alternative ultimate dragon': {
        count: 3,
        matches: materials => materials.length === 3 &&
          materials.every(card => normalize(card.name) === 'blue-eyes white dragon')
      },
      'dark cavalry': {
        count: 2,
        matches: materials => exactNames('Dark Magician')(materials) &&
          materials.some(card => normalize(card.name) !== 'dark magician' &&
            normalize(card.race) === 'warrior')
      },
      'amulet dragon': {
        count: 2,
        matches: materials => exactNames('Dark Magician')(materials) &&
          materials.some(card => normalize(card.name) !== 'dark magician' &&
            normalize(card.race) === 'dragon')
      },
      'cyber twin dragon': { count: 2, matches: twoOf('Cyber Dragon') },
      'elemental hero flame wingman': {
        count: 2,
        matches: exactNames('Elemental HERO Avian', 'Elemental HERO Burstinatrix')
      },
      'elemental hero absolute zero': {
        count: 2,
        matches: materials => materials.length === 2 && materials.some((card, index) =>
          normalize(card.archetype).includes('hero') &&
          materials.some((other, otherIndex) =>
            otherIndex !== index && normalize(other.attribute) === 'water'
          )
        )
      },
      'meteor black dragon': {
        count: 2,
        matches: exactNames('Red-Eyes Black Dragon', 'Meteor Dragon')
      },
      'dragonmaid sheou': {
        count: 2,
        matches: materials => materials.length === 2 && materials.some((card, index) =>
          normalize(card.archetype).includes('dragonmaid') &&
          materials.some((other, otherIndex) =>
            otherIndex !== index && normalize(other.race) === 'dragon' && other.level >= 5
          )
        )
      },
      'house dragonmaid': {
        count: 2,
        matches: materials => materials.length === 2 && materials.some((card, index) =>
          normalize(card.archetype).includes('dragonmaid') &&
          materials.some((other, otherIndex) =>
            otherIndex !== index && normalize(other.race) === 'dragon'
          )
        )
      },
      'mudragon of the swamp': {
        count: 2,
        matches: materials => materials.length === 2 &&
          materials[0].attribute && materials[0].attribute === materials[1].attribute &&
          materials[0].race && materials[1].race && materials[0].race !== materials[1].race
      },
      'starving venom fusion dragon': {
        count: 2,
        source: 'field',
        matches: materials => materials.length === 2 &&
          materials.every(card => normalize(card.attribute) === 'dark')
      }
    };
    return recipes[fusionName] || null;
  }

  fusionSummon(playerId, fusionCardId, materials, zoneIndex) {
    this.lastEffect = null;
    const player = this.players[playerId];
    if (!player || this.gameOver || this.getCurrentPlayerId() !== playerId ||
        !['main1', 'main2'].includes(this.currentPhase) ||
        !Array.isArray(materials) || !Number.isInteger(zoneIndex) ||
        zoneIndex < 0 || zoneIndex > 4) return false;

    const polymerization = player.hand.find(card => card.name === 'Polymerization');
    const fusionIndex = player.field.extraDeck.findIndex(card => card.id === fusionCardId);
    if (!polymerization || fusionIndex < 0) return false;
    const fusion = player.field.extraDeck[fusionIndex];
    const recipe = this.getFusionRecipe(fusion.name);
    if (!recipe || materials.length !== recipe.count ||
        (recipe.source && materials.some(material => material.source !== recipe.source))) return false;

    const seen = new Set();
    const selectedMaterials = [];
    for (const material of materials) {
      if (!material || !['hand', 'field'].includes(material.source) ||
          !Number.isInteger(material.index) || material.index < 0) return false;
      const key = `${material.source}:${material.index}`;
      if (seen.has(key)) return false;
      seen.add(key);

      const card = material.source === 'hand'
        ? player.hand[material.index]
        : player.field.monsterZones[material.index];
      if (!card || card.type !== 'monster' ||
          (material.source === 'field' && card.faceDown)) return false;
      selectedMaterials.push({ ...material, card });
    }
    if (!recipe.matches(selectedMaterials.map(material => material.card))) return false;
    const fieldMaterials = selectedMaterials
      .filter(material => material.source === 'field')
      .map(material => material.index);
    if (player.field.monsterZones[zoneIndex] && !fieldMaterials.includes(zoneIndex)) return false;

    selectedMaterials
      .filter(material => material.source === 'field')
      .forEach(material => {
        player.field.monsterZones[material.index] = null;
        player.field.graveyard.push(material.card);
      });
    selectedMaterials
      .filter(material => material.source === 'hand')
      .sort((first, second) => second.index - first.index)
      .forEach(material => {
        player.hand.splice(material.index, 1);
        player.field.graveyard.push(material.card);
      });
    player.hand.splice(player.hand.indexOf(polymerization), 1);
    player.field.graveyard.push(polymerization);
    player.field.extraDeck.splice(fusionIndex, 1);
    player.field.monsterZones[zoneIndex] = {
      ...fusion,
      position: 'attack',
      faceDown: false,
      canAttack: this.canNewMonsterAttack()
    };
    this.lastEffect = {
      card: polymerization,
      kind: 'spell',
      description: `Polymerization Fusion Summoned ${fusion.name}.`
    };
    return true;
  }

  triggerMirrorForce(attacker, defender) {
    const trapIndex = defender.field.spellTrapZones.findIndex(card =>
      card && card.name === 'Mirror Force' && card.faceDown && card.setTurn < this.turnNumber
    );
    if (trapIndex < 0) return false;

    const trap = defender.field.spellTrapZones[trapIndex];
    defender.field.graveyard.push(trap);
    defender.field.spellTrapZones[trapIndex] = null;
    attacker.field.monsterZones.forEach((monster, index) => {
      if (!monster || monster.position !== 'attack') return;
      attacker.field.graveyard.push(monster);
      attacker.field.monsterZones[index] = null;
    });
    this.lastEffect = {
      card: trap,
      kind: 'trap',
      description: 'Mirror Force destroyed all Attack Position monsters your opponent controlled.'
    };
    return true;
  }

  attack(playerId, attackerIndex, defenderIndex) {
    this.lastEffect = null;
    const player = this.players[playerId];
    const opponent = this.getOpponent(playerId);
    
    if (!player || !opponent || this.gameOver ||
        this.getCurrentPlayerId() !== playerId ||
        this.currentPhase !== 'battle') return false;
    
    const attacker = player.field.monsterZones[attackerIndex];
    const defender = opponent.field.monsterZones[defenderIndex];
    
    if (!attacker || !defender || !attacker.canAttack || attacker.position === 'defense') return false;

    attacker.canAttack = false;
    if (this.triggerMirrorForce(player, opponent)) return true;

    if (defender.position === 'defense') {
      defender.faceDown = false;
      if (attacker.atk > defender.def) {
        opponent.field.graveyard.push(defender);
        opponent.field.monsterZones[defenderIndex] = null;
      } else if (attacker.atk < defender.def) {
        player.lifePoints -= defender.def - attacker.atk;
      }
    } else if (attacker.atk > defender.atk) {
      opponent.field.graveyard.push(defender);
      opponent.field.monsterZones[defenderIndex] = null;
      const damage = attacker.atk - defender.atk;
      opponent.lifePoints -= damage;
    } else if (attacker.atk < defender.atk) {
      // Destroy attacker
      player.field.graveyard.push(attacker);
      player.field.monsterZones[attackerIndex] = null;
      const damage = defender.atk - attacker.atk;
      player.lifePoints -= damage;
    } else {
      // Both destroyed
      player.field.graveyard.push(attacker);
      opponent.field.graveyard.push(defender);
      player.field.monsterZones[attackerIndex] = null;
      opponent.field.monsterZones[defenderIndex] = null;
    }
    
    this.checkLifePointWin();
    return true;
  }

  directAttack(playerId, attackerIndex) {
    this.lastEffect = null;
    const player = this.players[playerId];
    const opponent = this.getOpponent(playerId);
    
    if (!player || !opponent || this.gameOver ||
        this.getCurrentPlayerId() !== playerId ||
        this.currentPhase !== 'battle') return false;
    
    const attacker = player.field.monsterZones[attackerIndex];
    if (!attacker || !attacker.canAttack || attacker.position === 'defense') return false;
    
    // Check if opponent has monsters
    const hasMonsters = opponent.field.monsterZones.some(zone => zone !== null);
    if (hasMonsters) return false;

    attacker.canAttack = false;
    if (this.triggerMirrorForce(player, opponent)) return true;
    opponent.lifePoints -= attacker.atk;
    this.checkLifePointWin();
    return true;
  }

  checkLifePointWin() {
    const players = Object.entries(this.players);
    const defeatedPlayers = players.filter(([, player]) => player.lifePoints <= 0);
    if (defeatedPlayers.length === 0) return false;

    this.gameOver = true;
    const winner = players.find(([playerId]) =>
      !defeatedPlayers.some(([defeatedPlayerId]) => defeatedPlayerId === playerId)
    );
    this.winnerId = winner ? winner[0] : null;
    this.resultReason = 'life-points';
    return true;
  }

  resign(playerId) {
    if (!this.gameStarted || this.gameOver || !this.players[playerId]) return false;
    const winner = Object.keys(this.players).find(id => id !== playerId);
    if (!winner) return false;
    this.gameOver = true;
    this.winnerId = winner;
    this.resultReason = 'resignation';
    return true;
  }

  getGameState(playerId) {
    const player = this.players[playerId];
    const opponent = this.getOpponent(playerId);
    const playerIds = Object.keys(this.players);
    
    console.log(`Getting game state for ${player.name}:`);
    console.log(`  Deck length: ${player.deck.length}`);
    console.log(`  Hand length: ${player.hand.length}`);
    console.log(`  Game started: ${this.gameStarted}`);
    
    return {
      roomId: this.roomId,
      playerCount: Object.keys(this.players).length,
      yourTurn: playerIds.length > 0 && playerIds[this.turn % playerIds.length] === playerId,
      currentPhase: this.currentPhase,
      battleAllowed: this.canNewMonsterAttack(),
      normalSummonUsed: playerId === this.getCurrentPlayerId() && this.normalSummonUsed,
      you: {
        name: player.name,
        deckType: player.deckType,
        isReady: player.ready,
        isWinner: this.winnerId === playerId,
        lifePoints: player.lifePoints,
        hand: player.hand,
        deckCount: player.deck.length,
        field: player.field
      },
      opponent: {
        name: opponent ? opponent.name : null,
        deckType: opponent ? opponent.deckType : null,
        isConnected: Boolean(opponent && opponent.socket?.connected),
        isReady: opponent ? opponent.ready : false,
        lifePoints: opponent ? opponent.lifePoints : null,
        handCount: opponent ? opponent.hand.length : 0,
        deckCount: opponent ? opponent.deck.length : 0,
        field: opponent ? opponent.field : null
      },
      gameStarted: this.gameStarted,
      starting: this.starting,
      gameOver: this.gameOver,
      winner: this.winnerId ? this.players[this.winnerId].name : null,
      resultReason: this.resultReason
    };
  }
}

function broadcastGameState(game) {
  Object.keys(game.players).forEach(playerId => {
    const player = game.players[playerId];
    if (player.socket?.connected) {
      player.socket.emit('gameState', game.getGameState(playerId));
    }
  });
}

function broadcastBattleAnimation(game, attackerId, animation) {
  Object.entries(game.players).forEach(([playerId, player]) => {
    if (player.socket?.connected) {
      player.socket.emit('battleAnimation', {
        ...animation,
        isAttacker: playerId === attackerId
      });
    }
  });
}

function broadcastCardEffect(game, activatorId) {
  if (!game.lastEffect) return;
  Object.entries(game.players).forEach(([playerId, player]) => {
    if (player.socket?.connected) {
      player.socket.emit('cardEffectAnimation', {
        ...game.lastEffect,
        isActivator: playerId === activatorId
      });
    }
  });
}

function isCurrentPlayerSocket(game, socket, roomId) {
  const playerToken = socket.data.playerToken;
  return socket.data.roomId === roomId &&
    playerToken &&
    game.players[playerToken]?.socket === socket;
}

function endAllArcadeGames(roomGroups) {
  let endedRooms = 0;
  const socketFields = {
    yugioh: ['roomId', 'playerToken'],
    ludo: ['ludoRoomId', 'ludoPlayerToken'],
    chess: ['chessRoomId', 'chessPlayerToken'],
    snakesLadders: ['snakesLaddersRoomId', 'snakesLaddersPlayerToken'],
    uno: ['unoRoomId', 'unoPlayerToken']
  };

  Object.entries(roomGroups).forEach(([game, rooms]) => {
    Object.entries(rooms).forEach(([roomId, room]) => {
      endedRooms += 1;
      clearTimeout(room.aiTimer);
      room.aiTimer = null;
      const players = room.seats || room.players || [];
      const playerList = Array.isArray(players) ? players : Object.values(players);
      playerList.forEach(player => {
        const playerSocket = player?.socket;
        if (!playerSocket) return;
        playerSocket.leave?.(
          game === 'yugioh' ? roomId :
            game === 'snakesLadders' ? `snakes-ladders:${roomId}` :
              `${game}:${roomId}`
        );
        socketFields[game].forEach(field => {
          if (playerSocket.data) delete playerSocket.data[field];
        });
      });
      delete rooms[roomId];
    });
  });

  return { endedRooms };
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('endAllArcadeGames', () => {
    const { endedRooms } = endAllArcadeGames(arcadeRoomGroups);
    io.emit('arcadeGamesEnded', { endedRooms });
  });

  socket.on('joinGame', ({ roomId, playerName, deckType, playerToken } = {}) => {
    const safeRoomId = typeof roomId === 'string' ? roomId.trim() : '';
    const safePlayerName = typeof playerName === 'string'
      ? playerName.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 20)
      : '';
    const safePlayerToken = typeof playerToken === 'string' &&
      /^[a-zA-Z0-9-]{16,64}$/.test(playerToken) ? playerToken : '';
    if (!safeRoomId || safeRoomId.length > 40 || !safePlayerName || !safePlayerToken ||
        !DECK_ARCHETYPES.has(deckType)) {
      socket.emit('joinedGame', {
        success: false,
        message: 'Enter a player name and room ID, choose a valid deck, and enable browser storage to resume the duel.'
      });
      return;
    }

    if (!games[safeRoomId]) {
      games[safeRoomId] = new Game(safeRoomId);
    }
    
    const game = games[safeRoomId];
    let success = false;
    const existingPlayer = game.players[safePlayerToken];
    if (existingPlayer) {
      if ((game.starting && existingPlayer.deckType !== deckType) ||
          (game.gameStarted && existingPlayer.deckType !== deckType)) {
        socket.emit('joinedGame', {
          success: false,
          message: 'This saved player session cannot rejoin this duel.'
        });
        return;
      }
      if (existingPlayer.socket?.connected && existingPlayer.socket !== socket) {
        socket.emit('joinedGame', {
          success: false,
          message: 'This duelist is already connected in another tab. Keep playing in that tab, or wait for it to disconnect before rejoining.'
        });
        return;
      }
      existingPlayer.socket = socket;
      existingPlayer.name = safePlayerName;
      if (!game.gameStarted) existingPlayer.deckType = deckType;
      success = true;
    } else {
      success = game.addPlayer(socket, safePlayerToken, safePlayerName, deckType);
    }
    
    if (success) {
      socket.data.playerToken = safePlayerToken;
      socket.data.roomId = safeRoomId;
      socket.join(safeRoomId);
      socket.emit('joinedGame', { success: true, roomId: safeRoomId });
      io.to(safeRoomId).emit('playerJoined', {
        playerName: safePlayerName,
        reconnected: Boolean(existingPlayer)
      });
      broadcastGameState(game);
    } else {
      socket.emit('joinedGame', {
        success: false,
        message: 'This room is full or its duel has already started.'
      });
    }
  });

  socket.on('setReady', async ({ roomId, ready } = {}) => {
    const game = games[roomId];
    const playerToken = socket.data.playerToken;
    if (!game || !isCurrentPlayerSocket(game, socket, roomId) ||
        !game.setPlayerReady(playerToken, ready)) {
      socket.emit('readyError', 'Your readiness could not be updated. Rejoin the room and try again.');
      return;
    }
    if (Object.keys(game.players).length !== 2 ||
        !Object.values(game.players).every(player => player.ready)) {
      broadcastGameState(game);
      return;
    }

    const startPromise = game.startGame();
    broadcastGameState(game);
    try {
      if (await startPromise) {
        if (games[roomId] !== game) return;
        broadcastGameState(game);
      }
    } catch (error) {
      if (games[roomId] !== game) return;
      console.error(`Failed to start game in room ${roomId}:`, error);
      Object.values(game.players).forEach(player => {
        player.ready = false;
        player.socket?.emit('gameStartError',
          'Unable to build the selected decks. Check the card API connection and try again.');
      });
      broadcastGameState(game);
    }
  });

  socket.on('resignGame', ({ roomId } = {}) => {
    const game = games[roomId];
    if (!game || !isCurrentPlayerSocket(game, socket, roomId) ||
        !game.resign(socket.data.playerToken)) {
      socket.emit('resignError', 'You can only resign an active duel.');
      return;
    }
    broadcastGameState(game);
  });

  socket.on('leaveGame', ({ roomId } = {}) => {
    const game = games[roomId];
    const playerToken = socket.data.playerToken;
    const player = game?.players[playerToken];
    if (!game || !isCurrentPlayerSocket(game, socket, roomId) || !player) return;

    player.socket = null;
    socket.leave(roomId);
    delete socket.data.roomId;
    delete socket.data.playerToken;
    Object.values(game.players).forEach(otherPlayer => {
      if (otherPlayer.socket?.connected) {
        otherPlayer.socket.emit('playerDisconnected', player.name);
      }
    });
    broadcastGameState(game);
  });

  socket.on('nextPhase', ({ roomId }) => {
    const game = games[roomId];
    const playerToken = socket.data.playerToken;
    if (game && isCurrentPlayerSocket(game, socket, roomId) && game.nextPhase(playerToken)) {
      broadcastGameState(game);
    } else {
      socket.emit('phaseError', 'Only the active player can advance the phase.');
    }
  });

  socket.on('playCard', ({ roomId, cardIndex, zone, zoneIndex, action, tributeIndices }) => {
    const game = games[roomId];
    const playerToken = socket.data.playerToken;
    if (game && isCurrentPlayerSocket(game, socket, roomId)) {
      const played = game.playCard(playerToken, cardIndex, zone, zoneIndex, action, tributeIndices);
      if (!played) {
        socket.emit('playError', 'That play is not legal in the current phase or board state.');
        return;
      }
      broadcastGameState(game);
      broadcastCardEffect(game, playerToken);
    }
  });

  socket.on('activateEffect', ({ roomId, cardIndex, target } = {}) => {
    const game = games[roomId];
    const playerToken = socket.data.playerToken;
    if (!game || !isCurrentPlayerSocket(game, socket, roomId) ||
        !game.activateEffect(playerToken, cardIndex, target)) {
      socket.emit('effectError', 'That supported card effect cannot be activated now.');
      return;
    }
    broadcastGameState(game);
    broadcastCardEffect(game, playerToken);
  });

  socket.on('fusionSummon', ({ roomId, fusionCardId, materials, zoneIndex } = {}) => {
    const game = games[roomId];
    const playerToken = socket.data.playerToken;
    if (!game || !isCurrentPlayerSocket(game, socket, roomId) ||
        !game.fusionSummon(playerToken, fusionCardId, materials, zoneIndex)) {
      socket.emit('fusionError',
        'Fusion Summon failed. Check Polymerization, the materials, and the selected Monster Zone.');
      return;
    }
    broadcastGameState(game);
    broadcastCardEffect(game, playerToken);
  });

  socket.on('attack', ({ roomId, attackerIndex, defenderIndex }) => {
    const game = games[roomId];
    const playerToken = socket.data.playerToken;
    const player = game?.players[playerToken];
    const opponent = game?.getOpponent(playerToken);
    if (!Number.isInteger(attackerIndex) || attackerIndex < 0 || attackerIndex > 4 ||
        !Number.isInteger(defenderIndex) || defenderIndex < 0 || defenderIndex > 4) {
      socket.emit('attackError', 'Choose a valid attacker and opposing Monster Zone.');
      return;
    }
    const attacker = player?.field.monsterZones[attackerIndex];
    const defender = opponent?.field.monsterZones[defenderIndex];
    if (!player || !opponent) {
      socket.emit('attackError', 'Rejoin the duel before attacking.');
      return;
    }
    const attackerLifePoints = player.lifePoints;
    const defenderLifePoints = opponent.lifePoints;
    if (!game || !isCurrentPlayerSocket(game, socket, roomId) ||
        !attacker || !defender ||
        !game.attack(playerToken, attackerIndex, defenderIndex)) {
      socket.emit('attackError',
        'Attack failed. You need an available Attack Position monster during your Battle Phase.');
      return;
    }

    const destroyedAttacker = player.field.monsterZones[attackerIndex] === null;
    const destroyedDefender = opponent.field.monsterZones[defenderIndex] === null;
    broadcastGameState(game);
    broadcastBattleAnimation(game, playerToken, {
      kind: 'attack',
      attackerIndex,
      defenderIndex,
      attackerName: attacker.name,
      defenderName: defender.name,
      destroyedAttacker,
      destroyedDefender,
      triggeredEffect: game.lastEffect,
      attackerDamage: Math.max(0, attackerLifePoints - player.lifePoints),
      defenderDamage: Math.max(0, defenderLifePoints - opponent.lifePoints)
    });
  });

  socket.on('directAttack', ({ roomId, attackerIndex }) => {
    const game = games[roomId];
    const playerToken = socket.data.playerToken;
    const player = game?.players[playerToken];
    if (!Number.isInteger(attackerIndex) || attackerIndex < 0 || attackerIndex > 4) {
      socket.emit('attackError', 'Choose a valid attacking monster.');
      return;
    }
    const attacker = player?.field.monsterZones[attackerIndex];
    if (!player) {
      socket.emit('attackError', 'Rejoin the duel before attacking.');
      return;
    }
    const defender = game?.getOpponent(playerToken);
    const defenderLifePoints = defender?.lifePoints;
    if (!game || !isCurrentPlayerSocket(game, socket, roomId) || !attacker ||
        !game.directAttack(playerToken, attackerIndex)) {
      socket.emit('attackError',
        'Direct attack failed. It requires an available attacker and no opposing monsters.');
      return;
    }

    broadcastGameState(game);
    broadcastBattleAnimation(game, playerToken, {
      kind: 'direct',
      attackerIndex,
      attackerName: attacker.name,
      triggeredEffect: game.lastEffect,
      defenderDamage: defenderLifePoints === undefined || !defender
        ? 0
        : Math.max(0, defenderLifePoints - defender.lifePoints)
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const game = games[socket.data.roomId];
    const player = game && game.players[socket.data.playerToken];
    if (player && player.socket === socket) {
      player.socket = null;
      Object.values(game.players).forEach(otherPlayer => {
        if (otherPlayer.socket?.connected) {
          otherPlayer.socket.emit('playerDisconnected', player.name);
        }
      });
    }
  });
});

const arcadeRoomGroups = {
  yugioh: games,
  ludo: registerLudoHandlers(io),
  chess: registerChessHandlers(io),
  snakesLadders: registerSnakesLaddersHandlers(io),
  uno: registerUnoHandlers(io)
};

async function startServer() {
  if (!fs.existsSync(path.join(JESSE_CRAFT_BUILD_DIR, 'index.html'))) {
    throw new Error('JesseCraft build is missing. Run "npm run build:jesse-craft" from JesseArcade.');
  }

  const { createGameServer } = await import('../server/index.js');
  const jesseCraftServer = createGameServer({ httpServer: server });

  server.once('listening', async () => {
    try {
      await jesseCraftServer.listen();
      console.log(`Jesse Arcade running on port ${PORT}`);
    } catch (error) {
      console.error('Failed to initialize JesseCraft multiplayer:', error);
      await jesseCraftServer.close();
      server.close(() => process.exit(1));
    }
  });
  server.listen(PORT, HOST);

  const shutdown = async () => {
    await jesseCraftServer.close();
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('Failed to start Jesse Arcade:', error);
    process.exitCode = 1;
  });
}

module.exports = { Game, DECK_ARCHETYPES, app, server, endAllArcadeGames };
