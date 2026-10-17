const COLORS = ['red', 'yellow', 'green', 'blue'];
const UNO_MODES = ['online', 'vs-ai', 'online-ai'];
const UNO_VARIANTS = ['normal', 'no-mercy'];
const PLAYER_TOKEN_PATTERN = /^[a-zA-Z0-9-]{16,64}$/;

function createDeck(variant = 'normal') {
  const deck = [];
  let id = 0;
  COLORS.forEach(color => {
    deck.push({ id: id++, color, type: 'number', value: 0 });
    for (let value = 1; value <= 9; value += 1) {
      deck.push({ id: id++, color, type: 'number', value });
      deck.push({ id: id++, color, type: 'number', value });
    }
    ['skip', 'reverse', 'draw2'].forEach(type => {
      deck.push({ id: id++, color, type, value: null });
      deck.push({ id: id++, color, type, value: null });
    });
    if (variant === 'no-mercy') {
      ['discardAll', 'skipEveryone', 'draw6', 'draw10'].forEach(type => {
        deck.push({ id: id++, color, type, value: null });
        deck.push({ id: id++, color, type, value: null });
      });
    }
  });
  for (let copy = 0; copy < 4; copy += 1) {
    deck.push({ id: id++, color: null, type: 'wild', value: null });
    deck.push({ id: id++, color: null, type: 'wildDraw4', value: null });
    if (variant === 'no-mercy') {
      deck.push({ id: id++, color: null, type: 'wildDraw6', value: null });
      deck.push({ id: id++, color: null, type: 'wildDraw10', value: null });
    }
  }
  return deck;
}

function shuffle(cards, random = Math.random) {
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
  return cards;
}

class UnoRoom {
  constructor(roomId, random = Math.random) {
    this.roomId = roomId;
    this.random = random;
    this.players = [];
    this.maxPlayers = null;
    this.mode = null;
    this.variant = null;
    this.started = false;
    this.gameOver = false;
    this.winner = null;
    this.resultReason = null;
    this.drawPile = [];
    this.discardPile = [];
    this.currentColor = null;
    this.turnIndex = 0;
    this.direction = 1;
    this.pendingDraw = 0;
    this.drawnCardId = null;
    this.unoPendingToken = null;
    this.wildDraw4Challenge = null;
    this.aiTimer = null;
    this.status = 'Waiting for players to join.';
  }

  join(playerToken, playerName, playerCount, socket, mode = 'online', variant = 'normal') {
    const existing = this.playerForToken(playerToken);
    if (existing) {
      if (existing.socket?.connected && existing.socket !== socket) {
        existing.socket.emit('unoSessionReplaced');
        existing.socket.disconnect(true);
      }
      existing.name = playerName;
      existing.socket = socket;
      existing.connected = true;
      return { success: true, reconnected: true };
    }
    if (this.started) return { success: false, message: 'This UNO game has already started.' };
    if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 4) {
      return { success: false, message: 'Choose between two and four players.' };
    }
    if (!UNO_MODES.includes(mode) || !UNO_VARIANTS.includes(variant)) {
      return { success: false, message: 'Choose a valid game mode and rules variant.' };
    }
    if (mode === 'online-ai' && playerCount < 3) {
      return { success: false, message: 'Choose at least three seats for two players plus AI.' };
    }
    if (this.mode !== null && (this.mode !== mode || this.variant !== variant)) {
      return { success: false, message: 'This room is using different UNO settings.' };
    }
    if (this.maxPlayers !== null && this.maxPlayers !== playerCount) {
      return { success: false, message: `This room is set up for ${this.maxPlayers} players.` };
    }
    if (this.players.length >= playerCount ||
        (mode === 'online-ai' && this.players.filter(player => !player.isAI).length >= 2)) {
      return { success: false, message: 'This room already has all its players.' };
    }

    this.maxPlayers = playerCount;
    this.mode = mode;
    this.variant = variant;
    this.players.push({
      id: playerToken,
      name: playerName,
      hand: [],
      socket,
      connected: true,
      isAI: false,
      eliminated: false
    });
    const humansJoined = this.players.filter(player => !player.isAI).length;
    if (mode === 'vs-ai' || (mode === 'online-ai' && humansJoined === 2)) {
      this.addAiPlayers();
      this.start();
    } else if (this.players.length === this.maxPlayers) this.start();
    else this.status = `Waiting for ${this.maxPlayers - this.players.length} more player${this.maxPlayers - this.players.length === 1 ? '' : 's'}.`;
    return { success: true, reconnected: false };
  }

  addAiPlayers() {
    while (this.players.length < this.maxPlayers) {
      const seat = this.players.length + 1;
      this.players.push({
        id: `ai-${seat}`,
        name: `AI ${seat}`,
        hand: [],
        socket: null,
        connected: true,
        isAI: true,
        eliminated: false
      });
    }
  }

  start() {
    this.started = true;
    this.drawPile = shuffle(createDeck(this.variant), this.random);
    this.players.forEach(player => {
      player.hand = this.drawPile.splice(0, 7);
    });
    const firstCardIndex = this.drawPile.findIndex(card => card.type === 'number');
    const [firstCard] = this.drawPile.splice(firstCardIndex, 1);
    this.discardPile.push(firstCard);
    this.currentColor = firstCard.color;
    this.status = `${this.currentPlayer().name}'s turn. Match the top card or draw.`;
  }

  playerForToken(playerToken) {
    return this.players.find(player => player.id === playerToken) || null;
  }

  currentPlayer() {
    if (!this.players.length) return null;
    for (let attempt = 0; attempt < this.players.length; attempt += 1) {
      const player = this.players[this.turnIndex];
      if (player && !player.eliminated) return player;
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
    }
    return null;
  }

  cardIsPlayable(card) {
    if (!card) return false;
    if (this.pendingDraw) {
      return this.variant === 'no-mercy' &&
        this.drawAmount(card) >= this.pendingDraw;
    }
    const topCard = this.discardPile[this.discardPile.length - 1];
    if (card.type.startsWith('wild')) return true;
    return card.color === this.currentColor ||
      (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) ||
      (card.type !== 'number' && card.type === topCard.type);
  }

  play(playerToken, cardId, chosenColor, targetToken) {
    const player = this.playerForToken(playerToken);
    if (!this.started || this.gameOver || !player || player !== this.currentPlayer()) {
      return { success: false, message: 'It is not your turn to play.' };
    }
    if (this.unoPendingToken && this.unoPendingToken !== playerToken) {
      this.penalizeMissedUno();
    }
    if (this.drawnCardId !== null && this.drawnCardId !== cardId) {
      return { success: false, message: 'You can only play the card you just drew.' };
    }
    const cardIndex = player.hand.findIndex(card => card.id === cardId);
    const card = player.hand[cardIndex];
    if (!card) return { success: false, message: 'That card is not in your hand.' };
    if (this.pendingDraw && !this.cardIsPlayable(card)) {
      return { success: false, message: 'Play a draw card to stack the penalty or draw the cards.' };
    }
    const currentColorBeforePlay = this.currentColor;
    const wildDraw4WasIllegal = card.type === 'wildDraw4' &&
      player.hand.some(candidate => candidate.id !== card.id &&
        candidate.color === currentColorBeforePlay);
    if (card.type.startsWith('wild')) {
      if (!COLORS.includes(chosenColor)) {
        return { success: false, message: 'Choose a color for the wild card.' };
      }
    } else if (!this.cardIsPlayable(card)) {
      return { success: false, message: 'That card does not match the color or symbol.' };
    }
    if (card.type === 'number' && card.value === 7 && this.variant === 'no-mercy' &&
        (!targetToken || !this.playerForToken(targetToken) ||
         this.playerForToken(targetToken) === player || this.playerForToken(targetToken).eliminated)) {
      return { success: false, message: 'Choose another active player to swap hands with.' };
    }
    player.hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    this.drawnCardId = null;
    this.currentColor = card.color || chosenColor;
    this.wildDraw4Challenge = card.type === 'wildDraw4' && this.variant === 'normal'
      ? {
        offenderToken: playerToken,
        offenderName: player.name,
        wasIllegal: wildDraw4WasIllegal
      }
      : null;
    if (card.type === 'discardAll' && this.variant === 'no-mercy') {
      const discarded = player.hand.filter(candidate => candidate.color === card.color);
      player.hand = player.hand.filter(candidate => candidate.color !== card.color);
      this.discardPile.push(...discarded);
    }
    if (card.type === 'number' && card.value === 7 && this.variant === 'no-mercy') {
      const target = this.playerForToken(targetToken);
      [player.hand, target.hand] = [target.hand, player.hand];
    }
    if (card.type === 'number' && card.value === 0 && this.variant === 'no-mercy') {
      const activePlayers = this.activePlayers();
      const hands = activePlayers.map(candidate => candidate.hand);
      for (let index = 0; index < activePlayers.length; index += 1) {
        const recipient = (index + this.direction + activePlayers.length) % activePlayers.length;
        activePlayers[recipient].hand = hands[index];
      }
    }
    if (player.hand.length === 0) {
      this.gameOver = true;
      this.winner = player.name;
      this.unoPendingToken = null;
      this.status = `${player.name} wins UNO!`;
      return { success: true, card };
    }
    this.unoPendingToken = player.hand.length === 1 ? playerToken : null;

    let skipped = false;
    if (card.type === 'skip' || card.type === 'skipEveryone') skipped = true;
    if (card.type === 'reverse') {
      this.direction *= -1;
      if (this.players.length === 2) skipped = true;
    }
    const drawAmount = this.drawAmount(card);
    if (drawAmount) this.pendingDraw += drawAmount;
    const skippedEveryone = card.type === 'skipEveryone';
    this.advanceTurn(skippedEveryone ? 0 : skipped ? 2 : 1);
    this.status = this.pendingDraw
      ? `${player.name} played ${this.cardLabel(card)}. ${this.currentPlayer().name} must draw ${this.pendingDraw}.`
      : `${player.name} played ${this.cardLabel(card)}. ${this.currentPlayer().name}'s turn.`;
    return { success: true, card };
  }

  draw(playerToken) {
    const player = this.playerForToken(playerToken);
    if (!this.started || this.gameOver || !player || player !== this.currentPlayer()) {
      return { success: false, message: 'It is not your turn to draw.' };
    }
    if (this.unoPendingToken && this.unoPendingToken !== playerToken) {
      this.penalizeMissedUno();
    }
    if (this.drawnCardId !== null) {
      this.pass(playerToken);
      return { success: true, cards: [], passed: true };
    }
    if (this.pendingDraw && this.variant === 'no-mercy' &&
        player.hand.some(card => this.cardIsPlayable(card))) {
      return { success: false, message: 'Stack a playable draw card instead of drawing.' };
    }
    const penalty = this.pendingDraw;
    const count = penalty || 1;
    const cards = [];
    for (let index = 0; index < count; index += 1) {
      const card = this.takeCard();
      if (!card) break;
      player.hand.push(card);
      cards.push(card);
    }
    this.pendingDraw = 0;
    if (penalty) {
      this.advanceTurn();
      this.wildDraw4Challenge = null;
      if (this.eliminateIfOverLimit(player)) {
        return { success: true, cards, penalty, eliminated: true };
      }
      this.status = `${player.name} drew ${cards.length} penalty cards. ${this.currentPlayer().name}'s turn.`;
      return { success: true, cards, penalty };
    }
    if (this.variant === 'no-mercy' && player.hand.length > 25) {
      this.eliminateIfOverLimit(player);
      return { success: true, cards, eliminated: true };
    }
    const playableCard = cards.find(card => this.cardIsPlayable(card));
    if (playableCard) {
      this.drawnCardId = playableCard.id;
      this.status = `${player.name} drew a playable card. Play it or pass.`;
      return { success: true, cards, playableCardId: playableCard.id };
    }
    this.advanceTurn();
    this.status = `${player.name} drew a card. ${this.currentPlayer().name}'s turn.`;
    return { success: true, cards, passed: true };
  }

  pass(playerToken) {
    const player = this.playerForToken(playerToken);
    if (!player || player !== this.currentPlayer() || this.drawnCardId === null) {
      return { success: false, message: 'You cannot pass right now.' };
    }
    if (this.unoPendingToken && this.unoPendingToken !== playerToken) {
      this.penalizeMissedUno();
    }
    this.drawnCardId = null;
    this.advanceTurn();
    this.status = `${player.name} passed. ${this.currentPlayer().name}'s turn.`;
    return { success: true };
  }

  takeCard() {
    if (this.drawPile.length === 0 && this.discardPile.length > 1) {
      const top = this.discardPile.pop();
      this.drawPile = shuffle(this.discardPile.splice(0), this.random);
      this.discardPile.push(top);
    }
    return this.drawPile.pop() || null;
  }

  drawAmount(card) {
    if (card.type === 'draw2') return 2;
    if (card.type === 'wildDraw4') return 4;
    if (card.type === 'draw6' || card.type === 'wildDraw6') return 6;
    if (card.type === 'draw10' || card.type === 'wildDraw10') return 10;
    return 0;
  }

  activePlayers() {
    return this.players.filter(player => !player.eliminated);
  }

  eliminateIfOverLimit(player) {
    if (this.variant !== 'no-mercy' || player.hand.length <= 25) return false;
    player.eliminated = true;
    this.unoPendingToken = null;
    this.pendingDraw = 0;
    this.wildDraw4Challenge = null;
    const activePlayers = this.activePlayers();
    if (activePlayers.length === 1) {
      this.gameOver = true;
      this.winner = activePlayers[0].name;
      this.status = `${player.name} exceeded 25 cards. ${this.winner} wins No Mercy!`;
    } else {
      this.status = `${player.name} exceeded 25 cards and is eliminated.`;
    }
    return true;
  }

  takeAiTurn() {
    const player = this.currentPlayer();
    if (!player?.isAI || this.gameOver) return false;
    if (this.unoPendingToken === player.id) this.callUno(player.id);
    const playable = player.hand.filter(card => this.cardIsPlayable(card));
    if (playable.length) {
      const card = playable.find(candidate => candidate.color === this.currentColor) || playable[0];
      const color = card.color || COLORS
        .slice()
        .sort((left, right) => player.hand.filter(item => item.color === right).length -
          player.hand.filter(item => item.color === left).length)[0];
      const target = card.type === 'number' && card.value === 7 && this.variant === 'no-mercy'
        ? this.activePlayers().find(candidate => candidate !== player)
        : null;
      const result = this.play(player.id, card.id, color, target?.id);
      if (result.success && this.unoPendingToken === player.id) this.callUno(player.id);
      return result.success;
    }
    if (this.drawnCardId !== null) return this.pass(player.id).success;
    const result = this.draw(player.id);
    if (result.playableCardId !== undefined) {
      const drawn = player.hand.find(card => card.id === result.playableCardId);
      const color = drawn?.color || COLORS
        .slice()
        .sort((left, right) => player.hand.filter(item => item.color === right).length -
          player.hand.filter(item => item.color === left).length)[0];
      if (drawn) return this.play(player.id, drawn.id, color).success;
    }
    return result.success;
  }

  callUno(playerToken) {
    const player = this.playerForToken(playerToken);
    if (!player || !this.unoPendingToken) {
      return { success: false, message: 'There is no UNO call to make.' };
    }
    if (playerToken === this.unoPendingToken) {
      this.unoPendingToken = null;
      this.status = `${player.name} called UNO!`;
      return { success: true, called: true };
    }
    if (player !== this.currentPlayer() || this.gameOver) {
      return { success: false, message: 'Only the next player can catch a missed UNO call.' };
    }
    this.penalizeMissedUno();
    return { success: true, caught: true };
  }

  penalizeMissedUno() {
    const offender = this.playerForToken(this.unoPendingToken);
    if (!offender) return;
    for (let count = 0; count < 2; count += 1) {
      const card = this.takeCard();
      if (card) offender.hand.push(card);
    }
    this.unoPendingToken = null;
    this.status = `${offender.name} missed UNO and draws two cards.`;
  }

  challengeWildDraw4(playerToken) {
    const challenger = this.playerForToken(playerToken);
    if (!this.started || this.gameOver || challenger !== this.currentPlayer() ||
        !this.wildDraw4Challenge || this.pendingDraw !== 4) {
      return { success: false, message: 'There is no Wild Draw Four to challenge.' };
    }
    if (this.unoPendingToken && this.unoPendingToken !== playerToken) {
      this.penalizeMissedUno();
    }
    const challenge = this.wildDraw4Challenge;
    const offender = this.playerForToken(challenge.offenderToken);
    this.pendingDraw = 0;
    this.wildDraw4Challenge = null;
    this.drawnCardId = null;
    if (challenge.wasIllegal && offender) {
      for (let count = 0; count < 4; count += 1) {
        const card = this.takeCard();
        if (card) offender.hand.push(card);
      }
      this.status = `${challenger.name} won the challenge. ${challenge.offenderName} draws four cards.`;
    } else {
      for (let count = 0; count < 6; count += 1) {
        const card = this.takeCard();
        if (card) challenger.hand.push(card);
      }
      this.advanceTurn();
      this.status = `${challenger.name} lost the challenge and draws six cards. ${this.currentPlayer().name}'s turn.`;
    }
    return { success: true, challengeWon: challenge.wasIllegal };
  }

  advanceTurn(steps = 1) {
    if (!this.players.length) return;
    for (let step = 0; step < steps; step += 1) {
      let attempts = 0;
      do {
        this.turnIndex = (this.turnIndex + this.direction + this.players.length) % this.players.length;
        attempts += 1;
      } while (this.players[this.turnIndex].eliminated && attempts <= this.players.length);
    }
    this.drawnCardId = null;
  }

  cardLabel(card) {
    if (card.type === 'number') return `${card.color} ${card.value}`;
    return card.type === 'wildDraw4' ? 'Wild Draw Four'
      : card.type === 'draw2' ? `${card.color} Draw Two`
        : card.type === 'wild' ? 'Wild'
          : `${card.color} ${card.type}`;
  }

  resign(playerToken, socket) {
    const player = this.playerForToken(playerToken);
    if (!this.started || this.gameOver || !player || player.socket !== socket) return false;
    const winner = this.players.find(candidate => candidate !== player);
    if (!winner) return false;
    this.gameOver = true;
    this.winner = winner.name;
    this.resultReason = 'resignation';
    this.status = `${player.name} resigned. ${winner.name} wins UNO.`;
    return true;
  }

  leave(playerToken, socket) {
    const player = this.playerForToken(playerToken);
    if (!player || player.socket !== socket) return false;
    player.socket = null;
    player.connected = false;
    if (!this.gameOver) this.status = `${player.name} left. They can rejoin this room.`;
    return true;
  }

  stateFor(playerToken) {
    const player = this.playerForToken(playerToken);
    if (!player) return null;
    const current = this.currentPlayer();
    const canPlay = this.started && current === player && !this.gameOver
      ? player.hand.filter(card => {
        if (this.drawnCardId !== null && this.drawnCardId !== card.id) return false;
        if (this.pendingDraw) return this.cardIsPlayable(card);
        if (card.type === 'wildDraw4') return true;
        return card.type.startsWith('wild') || card.color === this.currentColor ||
          (card.type === 'number' && this.discardPile.at(-1).type === 'number' &&
            card.value === this.discardPile.at(-1).value) ||
          (card.type !== 'number' && card.type === this.discardPile.at(-1).type);
      }).map(card => card.id)
      : [];
    return {
      roomId: this.roomId,
      started: this.started,
      gameOver: this.gameOver,
      winner: this.winner,
      resultReason: this.resultReason,
      mode: this.mode,
      variant: this.variant,
      status: this.status,
      players: this.players.map(candidate => ({
        name: candidate.name,
        you: candidate === player,
        connected: candidate.connected,
        isAI: candidate.isAI,
        eliminated: candidate.eliminated,
        seat: this.players.indexOf(candidate),
        cardCount: candidate.hand.length,
        isCurrentTurn: candidate === current && !this.gameOver
      })),
      yourHand: player.hand.map(card => ({ ...card })),
      currentCard: { ...this.discardPile.at(-1) },
      currentColor: this.currentColor,
      currentPlayerName: current?.name || null,
      yourTurn: current === player && !this.gameOver,
      canDraw: this.started && current === player && !this.gameOver && this.drawnCardId === null &&
        (!this.pendingDraw || this.variant !== 'no-mercy' ||
          !player.hand.some(card => this.cardIsPlayable(card))),
      canPass: this.started && current === player && this.drawnCardId !== null,
      canPlay,
      pendingDraw: this.pendingDraw,
      unoPendingName: this.playerForToken(this.unoPendingToken)?.name || null,
      youNeedToCallUno: this.unoPendingToken === playerToken,
      canCatchUno: Boolean(this.unoPendingToken && this.unoPendingToken !== playerToken &&
        current === player && !this.gameOver),
      canChallenge: Boolean(this.variant === 'normal' && this.started && current === player &&
        this.wildDraw4Challenge && this.pendingDraw === 4 && !this.gameOver),
      drawPileCount: this.drawPile.length,
      direction: this.direction
    };
  }
}

function registerUnoHandlers(io) {
  const rooms = Object.create(null);
  function scheduleAi(room) {
    if (room.aiTimer) clearTimeout(room.aiTimer);
    if (!room.started || room.gameOver || !room.currentPlayer()?.isAI) return;
    room.aiTimer = setTimeout(() => {
      room.aiTimer = null;
      room.takeAiTurn();
      broadcast(room);
    }, 450);
    room.aiTimer.unref?.();
  }

  function broadcast(room) {
    room.players.forEach(player => {
      if (player.socket?.connected) player.socket.emit('unoState', room.stateFor(player.id));
    });
    scheduleAi(room);
  }

  io.on('connection', socket => {
    socket.on('joinUno', ({ roomId, playerName, playerToken, playerCount, mode, variant } = {}) => {
      const safeRoom = typeof roomId === 'string' ? roomId.trim() : '';
      const safeName = typeof playerName === 'string'
        ? playerName.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 20)
        : '';
      const safeToken = typeof playerToken === 'string' && PLAYER_TOKEN_PATTERN.test(playerToken)
        ? playerToken : '';
      if (!safeRoom || safeRoom.length > 40 || !safeName || !safeToken ||
          !Number.isInteger(playerCount) || playerCount < 2 || playerCount > 4 ||
          !UNO_MODES.includes(mode) || !UNO_VARIANTS.includes(variant) ||
          (mode === 'online-ai' && playerCount < 3)) {
        socket.emit('unoJoined', {
          success: false,
          message: 'Enter your name and room ID, choose valid game settings, and allow browser storage.'
        });
        return;
      }
      const room = rooms[safeRoom] || (rooms[safeRoom] = new UnoRoom(safeRoom));
      const result = room.join(safeToken, safeName, playerCount, socket, mode, variant);
      if (!result.success) {
        socket.emit('unoJoined', result);
        return;
      }
      socket.data.unoRoomId = safeRoom;
      socket.data.unoPlayerToken = safeToken;
      socket.join(`uno:${safeRoom}`);
      socket.emit('unoJoined', { ...result, roomId: safeRoom });
      broadcast(room);
    });

    socket.on('unoPlay', ({ roomId, cardId, chosenColor, targetSeat } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.unoPlayerToken;
      const player = room?.playerForToken(token);
      if (!room || socket.data.unoRoomId !== roomId || player?.socket !== socket) {
        socket.emit('unoError', 'Rejoin the UNO room before playing.');
        return;
      }
      const targetToken = Number.isInteger(targetSeat) && targetSeat >= 0 &&
        targetSeat < room.players.length ? room.players[targetSeat].id : null;
      const result = room.play(token, cardId, chosenColor, targetToken);
      if (!result.success) socket.emit('unoError', result.message);
      broadcast(room);
    });

    socket.on('unoDraw', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.unoPlayerToken;
      const player = room?.playerForToken(token);
      if (!room || socket.data.unoRoomId !== roomId || player?.socket !== socket) {
        socket.emit('unoError', 'Rejoin the UNO room before drawing.');
        return;
      }
      const result = room.draw(token);
      if (!result.success) socket.emit('unoError', result.message);
      broadcast(room);
    });

    socket.on('unoPass', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.unoPlayerToken;
      const player = room?.playerForToken(token);
      if (!room || socket.data.unoRoomId !== roomId || player?.socket !== socket) {
        socket.emit('unoError', 'Rejoin the UNO room before passing.');
        return;
      }
      const result = room.pass(token);
      if (!result.success) socket.emit('unoError', result.message);
      broadcast(room);
    });

    socket.on('unoCall', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.unoPlayerToken;
      const player = room?.playerForToken(token);
      if (!room || socket.data.unoRoomId !== roomId || player?.socket !== socket) {
        socket.emit('unoError', 'Rejoin the UNO room before calling UNO.');
        return;
      }
      const result = room.callUno(token);
      if (!result.success) socket.emit('unoError', result.message);
      broadcast(room);
    });

    socket.on('unoChallenge', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.unoPlayerToken;
      const player = room?.playerForToken(token);
      if (!room || socket.data.unoRoomId !== roomId || player?.socket !== socket) {
        socket.emit('unoError', 'Rejoin the UNO room before challenging.');
        return;
      }
      const result = room.challengeWildDraw4(token);
      if (!result.success) socket.emit('unoError', result.message);
      broadcast(room);
    });

    socket.on('unoResign', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.unoPlayerToken;
      const player = room?.playerForToken(token);
      if (!room || socket.data.unoRoomId !== roomId || player?.socket !== socket ||
          !room.resign(token, socket)) {
        socket.emit('unoError', 'You can only resign an active UNO game.');
        return;
      }
      broadcast(room);
    });

    socket.on('leaveUno', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.unoPlayerToken;
      if (room && socket.data.unoRoomId === roomId && room.leave(token, socket)) {
        socket.leave(`uno:${roomId}`);
        delete socket.data.unoRoomId;
        delete socket.data.unoPlayerToken;
        broadcast(room);
      }
    });

    socket.on('disconnect', () => {
      const room = rooms[socket.data.unoRoomId];
      if (room && room.leave(socket.data.unoPlayerToken, socket)) broadcast(room);
    });
  });
  return rooms;
}

module.exports = { COLORS, UnoRoom, createDeck, registerUnoHandlers, shuffle };
