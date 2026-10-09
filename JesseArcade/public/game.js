const socket = io();
window.arcadeSocket = socket;
const gameMenu = document.getElementById('gameMenu');
const jesseCraftScreen = document.getElementById('jesseCraftScreen');
const jesseCraftFrame = document.getElementById('jesseCraftFrame');
let currentRoom = '';
let playerName = '';
const playerTokenStorageKey = 'yugioh-player-token';
const duelSessionStorageKey = 'yugioh-duel-session';
const tabPlayerTokenStorageKey = 'yugioh-tab-player-token';
const tabDuelSessionStorageKey = 'yugioh-tab-duel-session';
let playerToken = sessionStorage.getItem(tabPlayerTokenStorageKey);
if (!playerToken) {
    playerToken = localStorage.getItem(playerTokenStorageKey);
    if (playerToken) {
        localStorage.removeItem(playerTokenStorageKey);
    } else if (window.crypto.randomUUID) {
        playerToken = window.crypto.randomUUID();
    } else {
        const bytes = window.crypto.getRandomValues(new Uint8Array(16));
        playerToken = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    sessionStorage.setItem(tabPlayerTokenStorageKey, playerToken);
}
let selectedCard = null;
let selectedZone = null;
let pendingPlay = null;
let pendingFusion = null;
let pendingEffect = null;
let gameState = null;
let gameOverShown = false;
let battleAnimationId = 0;
const lifePointAnimationIds = Object.create(null);
let cardEffectAnimationTimer = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const gameScreen = document.getElementById('gameScreen');
const gameMenuStatus = document.getElementById('gameMenuStatus');
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomId');
const deckTypeInput = document.getElementById('deckType');
const joinBtn = document.getElementById('joinBtn');
const readyBtn = document.getElementById('readyBtn');
const resignDuelBtn = document.getElementById('resignDuelBtn');
const duelBackToMenuBtn = document.getElementById('duelBackToMenuBtn');
const extraDeckBtn = document.getElementById('extraDeckBtn');
const nextPhaseBtn = document.getElementById('nextPhaseBtn');
const directAttackBtn = document.getElementById('directAttackBtn');
const cardModal = document.getElementById('cardModal');
const modalContent = document.querySelector('.modal-content');
const closeBtn = document.querySelector('.close');
const cancelActionBtn = document.getElementById('cancelActionBtn');
const cardEffectOverlay = document.createElement('div');
cardEffectOverlay.className = 'card-effect-overlay';
cardEffectOverlay.hidden = true;
cardEffectOverlay.setAttribute('role', 'status');
cardEffectOverlay.setAttribute('aria-live', 'assertive');
document.body.appendChild(cardEffectOverlay);

// Event Listeners
document.querySelectorAll('.game-menu-card').forEach(card => {
    card.addEventListener('click', () => {
        if (card.dataset.game === 'jesse-craft') {
            localStorage.setItem('arcade-active-game', 'jesse-craft');
            window.leaveSnakesLaddersSession?.('jesse-craft');
            window.leaveChessScreen?.('jesse-craft');
            window.leaveLudoSession?.('jesse-craft');
            window.leaveUnoSession?.('jesse-craft');
            gameMenu.style.display = 'none';
            gameMenuStatus.textContent = '';
            jesseCraftScreen.hidden = false;
            jesseCraftFrame.src = '/jesse-craft/';
            return;
        }
        if (card.dataset.game === 'ludo') {
            localStorage.setItem('arcade-active-game', 'ludo');
            window.leaveSnakesLaddersSession?.('ludo');
            window.leaveChessScreen?.('ludo');
            window.showLudoScreen();
            return;
        }
        if (card.dataset.game === 'chess') {
            localStorage.setItem('arcade-active-game', 'chess');
            window.leaveSnakesLaddersSession?.('chess');
            window.leaveLudoSession?.('chess');
            window.showChessScreen();
            return;
        }
        if (card.dataset.game === 'snakes-ladders') {
            localStorage.setItem('arcade-active-game', 'snakes-ladders');
            window.leaveLudoSession?.('snakes-ladders');
            window.leaveChessScreen?.('snakes-ladders');
            window.showSnakesLaddersScreen();
            return;
        }
        if (card.dataset.game === 'uno') {
            localStorage.setItem('arcade-active-game', 'uno');
            window.leaveLudoSession?.('uno');
            window.leaveChessScreen?.('uno');
            window.leaveSnakesLaddersSession?.('uno');
            window.showUnoScreen();
            return;
        }
        if (card.dataset.game !== 'yugioh') {
            gameMenuStatus.textContent = `${card.querySelector('.game-menu-name').textContent} is coming soon.`;
            return;
        }
        localStorage.setItem('arcade-active-game', 'yugioh');
        window.leaveLudoSession?.('yugioh');
        window.leaveChessScreen?.('yugioh');
        window.leaveSnakesLaddersSession?.('yugioh');
        window.leaveUnoSession?.('yugioh');
        gameMenu.style.display = 'none';
        loginScreen.style.display = 'flex';
        gameMenuStatus.textContent = '';
    });
});

document.getElementById('backToGameMenuBtn').addEventListener('click', returnToGameMenu);
duelBackToMenuBtn.addEventListener('click', returnToGameMenu);
document.getElementById('backFromJesseCraftBtn').addEventListener('click', () => {
    jesseCraftFrame.src = 'about:blank';
    jesseCraftScreen.hidden = true;
    gameMenu.style.display = 'flex';
    localStorage.setItem('arcade-active-game', 'menu');
});

joinBtn.addEventListener('click', joinGame);
joinBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    joinGame();
});

readyBtn.addEventListener('click', toggleReady);
resignDuelBtn.addEventListener('click', () => {
    if (!gameState || !gameState.gameStarted || gameState.gameOver) return;
    if (!window.confirm('Resign this duel? Your opponent will win.')) return;
    resignDuelBtn.disabled = true;
    socket.emit('resignGame', { roomId: currentRoom });
});
extraDeckBtn.addEventListener('click', () => showExtraDeck());
cancelActionBtn.addEventListener('click', cancelPendingAction);
nextPhaseBtn.addEventListener('click', nextPhase);
directAttackBtn.addEventListener('click', () => {
    if (!selectedZone || selectedZone.type !== 'attacker') return;
    socket.emit('directAttack', {
        roomId: currentRoom,
        attackerIndex: selectedZone.index
    });
    clearZoneSelection();
});

closeBtn.addEventListener('click', closeModal);
closeBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    closeModal();
});

cardModal.addEventListener('click', (e) => {
    if (e.target === cardModal) closeModal();
});

cardModal.addEventListener('touchend', (e) => {
    if (e.target === cardModal) {
        e.preventDefault();
        closeModal();
    }
});

function joinGame() {
    playerName = playerNameInput.value.trim();
    currentRoom = roomIdInput.value.trim();
    
    if (!playerName || !currentRoom) {
        alert('Please enter your name and room ID.');
        return;
    }
    
    localStorage.setItem('arcade-active-game', 'yugioh');
    saveDuelSession();
    sendJoinRequest();
}

function returnToGameMenu() {
    if (currentRoom) socket.emit('leaveGame', { roomId: currentRoom });
    sessionStorage.removeItem(tabDuelSessionStorageKey);
    currentRoom = '';
    gameState = null;
    gameOverShown = false;
    document.querySelector('.game-over')?.remove();
    loginScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    gameMenu.style.display = 'flex';
    localStorage.setItem('arcade-active-game', 'menu');
}

function saveDuelSession() {
    sessionStorage.setItem(tabDuelSessionStorageKey, JSON.stringify({
        roomId: currentRoom,
        playerName,
        deckType: deckTypeInput.value
    }));
}

function sendJoinRequest() {
    joinBtn.disabled = true;
    socket.emit('joinGame', {
        roomId: currentRoom,
        playerName,
        deckType: deckTypeInput.value,
        playerToken
    });
}

socket.on('connect', () => {
    const activeGame = localStorage.getItem('arcade-active-game');
    if (activeGame && activeGame !== 'yugioh') return;
    let savedSession = sessionStorage.getItem(tabDuelSessionStorageKey);
    if (!savedSession) {
        savedSession = localStorage.getItem(duelSessionStorageKey);
        if (savedSession) {
            sessionStorage.setItem(tabDuelSessionStorageKey, savedSession);
            localStorage.removeItem(duelSessionStorageKey);
        }
    }
    if (!savedSession) return;

    try {
        const session = JSON.parse(savedSession);
        if (!session.roomId || !session.playerName || !session.deckType) {
            throw new Error('Saved duel session is incomplete.');
        }
        currentRoom = session.roomId;
        playerName = session.playerName;
        playerNameInput.value = playerName;
        roomIdInput.value = currentRoom;
        deckTypeInput.value = session.deckType;
        sendJoinRequest();
    } catch (error) {
        console.error('Unable to restore saved duel session:', error);
        sessionStorage.removeItem(tabDuelSessionStorageKey);
    }
});

socket.on('joinedGame', ({ success, message }) => {
    joinBtn.disabled = false;
    if (success) {
        gameMenu.style.display = 'none';
        loginScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        document.getElementById('currentRoom').textContent = currentRoom;
    } else {
        alert(message || 'Failed to join game');
    }
});

socket.on('playerJoined', ({ playerName }) => {
    console.log(`${playerName} joined the game`);
});

socket.on('gameStartError', (message) => {
    readyBtn.disabled = false;
    alert(message);
});

socket.on('readyError', (message) => {
    readyBtn.disabled = false;
    setActionStatus(message);
});

socket.on('resignError', message => {
    resignDuelBtn.disabled = false;
    setActionStatus(message);
});

socket.on('playError', (message) => {
    pendingPlay = null;
    clearZoneSelection();
    setActionStatus(message);
});

socket.on('phaseError', (message) => {
    setActionStatus(message);
});

socket.on('attackError', (message) => {
    setActionStatus(message);
});

socket.on('effectError', (message) => {
    pendingEffect = null;
    clearZoneSelection();
    setActionStatus(message);
});

socket.on('fusionError', (message) => {
    pendingFusion = null;
    clearZoneSelection();
    setActionStatus(message);
});

socket.on('playerLeft', () => {
    alert('Opponent left the game');
    resetGame();
});

socket.on('playerDisconnected', (disconnectedPlayerName) => {
    setActionStatus(`${disconnectedPlayerName} disconnected. Waiting for them to reconnect...`);
});

socket.on('sessionReplaced', () => {
    setActionStatus('This duel session was opened in another tab.');
});

socket.on('gameState', (newGameState) => {
    const previousLifePoints = {
        you: readLifePoints('.player-field:not(.opponent)'),
        opponent: readLifePoints('.player-field.opponent')
    };
    gameState = newGameState;
    pendingPlay = null;
    pendingFusion = null;
    pendingEffect = null;
    clearZoneSelection();
    setActionStatus('');
    if (gameState.gameOver) {
        selectedZone = null;
    }
    updateUI();
    if (newGameState.gameStarted) {
        animateLifePointChange(
            '.player-field:not(.opponent)',
            previousLifePoints.you,
            newGameState.you.lifePoints
        );
        animateLifePointChange(
            '.player-field.opponent',
            previousLifePoints.opponent,
            newGameState.opponent.lifePoints
        );
    }
    if (gameState.currentPhase === 'battle' && !gameState.battleAllowed) {
        setActionStatus('The first player cannot attack during their first turn.');
    }
    checkGameOver();
});

socket.on('cardEffectAnimation', effect => {
    showCardEffectAnimation(effect);
});

socket.on('battleAnimation', animation => {
    if (!gameState || !animation ||
        !['attack', 'direct'].includes(animation.kind) ||
        !Number.isInteger(animation.attackerIndex) || animation.attackerIndex < 0 ||
        animation.attackerIndex > 4) return;

    if (animation.triggeredEffect) {
        showCardEffectAnimation({
            ...animation.triggeredEffect,
            isActivator: false
        });
    }

    const animationId = ++battleAnimationId;
    const attackerField = document.querySelector(
        animation.isAttacker ? '.player-field:not(.opponent)' : '.player-field.opponent'
    );
    const attackerZone = attackerField?.querySelector(
        `.monster-zone[data-index="${animation.attackerIndex}"]`
    );
    if (!attackerZone) return;

    document.querySelectorAll('.battle-impact').forEach(impact => impact.remove());
    document.querySelectorAll('.battle-attacker, .battle-target, .battle-damage')
        .forEach(element => element.classList.remove(
            'battle-attacker', 'battle-target', 'battle-damage'
        ));
    attackerZone.classList.add(animation.isAttacker
        ? 'battle-attacker battle-attacker-own'
        : 'battle-attacker battle-attacker-opponent');

    if (animation.kind === 'attack' &&
        Number.isInteger(animation.defenderIndex) &&
        animation.defenderIndex >= 0 && animation.defenderIndex <= 4) {
        const defenderField = document.querySelector(
            animation.isAttacker ? '.player-field.opponent' : '.player-field:not(.opponent)'
        );
        const defenderZone = defenderField?.querySelector(
            `.monster-zone[data-index="${animation.defenderIndex}"]`
        );
        defenderZone?.classList.add('battle-target');
        if (defenderZone) {
            addBattleImpact(
                defenderZone,
                animation.destroyedAttacker || animation.destroyedDefender
                    ? 'DESTROYED'
                    : 'CLASH'
            );
        }
        const attackerDamage = Number.isFinite(animation.attackerDamage)
            ? animation.attackerDamage
            : 0;
        const defenderDamage = Number.isFinite(animation.defenderDamage)
            ? animation.defenderDamage
            : 0;
        if (attackerDamage > 0) {
            showBattleDamage(attackerField, attackerDamage);
        }
        if (defenderDamage > 0) {
            showBattleDamage(defenderField, defenderDamage);
        }
        const damageText = attackerDamage + defenderDamage > 0
            ? ` ${attackerDamage + defenderDamage} LP damage!`
            : '';
        setActionStatus(animation.triggeredEffect
            ? `Attack stopped by ${animation.triggeredEffect.card.name}!`
            : `${animation.attackerName} attacks ${animation.defenderName}!${damageText}`);
    } else {
        const defenderField = document.querySelector(
            animation.isAttacker ? '.player-field.opponent' : '.player-field:not(.opponent)'
        );
        const lifePoints = defenderField?.querySelector('.life-points');
        const damage = Number.isFinite(animation.defenderDamage)
            ? animation.defenderDamage
            : 0;
        if (animation.triggeredEffect) {
            setActionStatus(`Direct attack stopped by ${animation.triggeredEffect.card.name}!`);
        } else {
            lifePoints?.classList.add('battle-damage');
            if (defenderField) {
                addBattleImpact(defenderField, 'DIRECT HIT');
                if (damage > 0) showBattleDamage(defenderField, damage);
            }
            setActionStatus(
                `${animation.attackerName} attacks directly!${damage ? ` ${damage} LP damage!` : ''}`
            );
        }
    }

    window.setTimeout(() => {
        if (animationId !== battleAnimationId) return;
        document.querySelectorAll(
            '.battle-attacker, .battle-target, .battle-damage, .battle-impact'
        ).forEach(element => {
            element.classList.remove(
                'battle-attacker', 'battle-attacker-own', 'battle-attacker-opponent',
                'battle-target', 'battle-damage'
            );
            if (element.classList.contains('battle-impact')) element.remove();
        });
        if (document.getElementById('actionStatus').textContent.includes('attacks')) {
            setActionStatus('');
        }
    }, 1150);
});

function addBattleImpact(target, label) {
    const impact = document.createElement('span');
    impact.className = 'battle-impact';
    impact.setAttribute('aria-hidden', 'true');
    impact.textContent = label;
    target.appendChild(impact);
}

function showBattleDamage(field, amount) {
    const lifePoints = field?.querySelector('.life-points');
    if (!lifePoints) return;
    lifePoints.classList.add('battle-damage');
    addBattleImpact(lifePoints, `-${amount} LP`);
}

function readLifePoints(fieldSelector) {
    const value = document.querySelector(`${fieldSelector} .lp-value`)?.textContent;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function animateLifePointChange(fieldSelector, previousValue, nextValue) {
    if (!Number.isFinite(previousValue) || !Number.isFinite(nextValue)) return;
    const valueElement = document.querySelector(`${fieldSelector} .lp-value`);
    if (!valueElement) return;
    if (nextValue >= previousValue) {
        valueElement.textContent = String(nextValue);
        return;
    }

    const animationId = (lifePointAnimationIds[fieldSelector] || 0) + 1;
    lifePointAnimationIds[fieldSelector] = animationId;
    const startedAt = performance.now();
    const duration = 1000;
    const change = previousValue - nextValue;
    const tick = now => {
        if (animationId !== lifePointAnimationIds[fieldSelector] ||
            !valueElement.isConnected) return;
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        valueElement.textContent = String(
            Math.max(nextValue, Math.round(previousValue - change * eased))
        );
        if (progress < 1) window.requestAnimationFrame(tick);
    };
    valueElement.textContent = String(previousValue);
    window.requestAnimationFrame(tick);
}

function showCardEffectAnimation(effect) {
    if (!effect || !effect.card || typeof effect.card.name !== 'string' ||
        typeof effect.description !== 'string') return;

    window.clearTimeout(cardEffectAnimationTimer);
    cardEffectOverlay.hidden = false;
    cardEffectOverlay.replaceChildren();
    cardEffectOverlay.className = `card-effect-overlay is-visible ${effect.kind === 'trap' ? 'is-trap' : 'is-spell'}`;
    const card = document.createElement('div');
    card.className = 'card-effect-cinematic-card';
    const imageUrl = effect.card.images?.[0]?.image_url;
    if (typeof imageUrl === 'string' && imageUrl.startsWith('https://')) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = effect.card.name;
        card.appendChild(image);
    } else {
        const fallback = document.createElement('span');
        fallback.className = 'card-effect-fallback';
        fallback.textContent = effect.kind === 'trap' ? 'TRAP' : 'SPELL';
        card.appendChild(fallback);
    }

    const text = document.createElement('div');
    text.className = 'card-effect-cinematic-text';
    const heading = document.createElement('strong');
    heading.textContent = `${effect.card.name} activated`;
    const description = document.createElement('span');
    description.textContent = effect.description;
    text.append(heading, description);
    cardEffectOverlay.append(card, text);
    cardEffectAnimationTimer = window.setTimeout(() => {
        cardEffectOverlay.classList.remove('is-visible');
        cardEffectAnimationTimer = window.setTimeout(() => {
            cardEffectOverlay.hidden = true;
        }, 260);
    }, 2050);
}

function toggleReady() {
    if (!gameState || gameState.gameStarted || gameState.starting) return;
    readyBtn.disabled = true;
    socket.emit('setReady', {
        roomId: currentRoom,
        ready: !gameState.you.isReady
    });
}

function nextPhase() {
    socket.emit('nextPhase', { roomId: currentRoom });
}

function updateUI() {
    if (!gameState) return;

    const ownDeckLabel = gameState.you.deckType || 'Deck';
    const opponentDeckLabel = gameState.opponent.deckType || 'Deck';
    const lobbyStatus = document.getElementById('lobbyStatus');
    readyBtn.style.display = gameState.gameStarted ? 'none' : 'inline-block';
    resignDuelBtn.style.display = 'inline-block';
    resignDuelBtn.disabled = !gameState.gameStarted || gameState.starting || gameState.gameOver;
    readyBtn.disabled = gameState.starting;
    readyBtn.textContent = gameState.starting
        ? 'Preparing decks...'
        : gameState.you.isReady ? 'Ready ✓ (Cancel)' : 'Ready Up';
    extraDeckBtn.style.display = gameState.gameStarted ? 'inline-block' : 'none';
    extraDeckBtn.textContent = `Extra Deck (${gameState.you.field.extraDeck.length})`;
    if (!gameState.gameStarted) {
        const opponentStatus = gameState.opponent.name
            ? `${gameState.opponent.name}: ${opponentDeckLabel} — ${gameState.opponent.isConnected === false
                ? 'Reconnecting'
                : gameState.opponent.isReady ? 'Ready' : 'Not ready'}`
            : 'Waiting for opponent';
        lobbyStatus.textContent =
            `You: ${ownDeckLabel} — ${gameState.you.isReady ? 'Ready' : 'Not ready'} · ${opponentStatus}`;
    } else {
        lobbyStatus.textContent = gameState.opponent.isConnected === false
            ? `${ownDeckLabel} vs ${opponentDeckLabel} — opponent reconnecting`
            : `${ownDeckLabel} vs ${opponentDeckLabel}`;
    }
    
    // Update game info
    document.getElementById('turnPlayer').textContent = gameState.yourTurn ? 'Your Turn' : 'Opponent\'s Turn';
    document.getElementById('currentPhase').textContent = gameState.currentPhase;
    
    // Update player info
    const yourField = document.querySelector('.player-field:not(.opponent)');
    yourField.querySelector('.player-name').textContent = gameState.you.name;
    yourField.querySelector('.lp-value').textContent = gameState.you.lifePoints;
    yourField.querySelector('.deck-count').textContent = gameState.gameStarted ? gameState.you.deckCount : '—';
    yourField.querySelector('.hand-count-value').textContent = gameState.you.hand.length;
    yourField.querySelector('.graveyard-count-value').textContent = gameState.you.field && gameState.you.field.graveyard ? gameState.you.field.graveyard.length : 0;
    
    // Update opponent info
    const opponentField = document.querySelector('.player-field.opponent');
    if (gameState.opponent.name) {
        opponentField.querySelector('.player-name').textContent = gameState.opponent.name;
        opponentField.querySelector('.lp-value').textContent = gameState.opponent.lifePoints;
        opponentField.querySelector('.deck-count').textContent = gameState.gameStarted ? gameState.opponent.deckCount : '—';
        opponentField.querySelector('.hand-count-value').textContent = gameState.opponent.handCount;
        opponentField.querySelector('.graveyard-count-value').textContent = gameState.opponent.field && gameState.opponent.field.graveyard ? gameState.opponent.field.graveyard.length : 0;
    }
    
    // Update field zones (only if game has started)
    if (gameState.gameStarted) {
        updateFieldZones(gameState.you.field, false);
        updateFieldZones(gameState.opponent.field, true);
    } else {
        // Clear zones if game hasn't started
        document.querySelectorAll('.zone').forEach(zone => {
            zone.innerHTML = '';
        });
    }
    
    // Add deck and graveyard handlers
    addDeckGraveyardHandlers();
    
    // Update deck and graveyard visuals
    const playerDeckVisual = document.getElementById('playerDeckVisual');
    const playerGraveyardVisual = document.getElementById('playerGraveyardVisual');
    const opponentDeckVisual = document.getElementById('opponentDeckVisual');
    const opponentGraveyardVisual = document.getElementById('opponentGraveyardVisual');
    
    if (playerDeckVisual) playerDeckVisual.textContent = '';
    if (playerGraveyardVisual) playerGraveyardVisual.textContent = '⚰️';
    if (opponentDeckVisual) opponentDeckVisual.textContent = '';
    if (opponentGraveyardVisual) opponentGraveyardVisual.textContent = '⚰️';
    
    // Update hand
    updateHand();
    
    // Update button states
    nextPhaseBtn.disabled = !gameState.yourTurn || !gameState.gameStarted || gameState.gameOver;
    const phases = ['draw', 'standby', 'main1', 'battle', 'main2', 'end'];
    const nextPhaseName = phases[(phases.indexOf(gameState.currentPhase) + 1) % phases.length];
    nextPhaseBtn.textContent = gameState.currentPhase === 'end'
        ? 'End Turn'
        : `Next: ${nextPhaseName === 'main1' || nextPhaseName === 'main2'
            ? `Main ${nextPhaseName.slice(-1)}`
            : nextPhaseName[0].toUpperCase() + nextPhaseName.slice(1)}`;
    
    // Add visual indicator for your turn
    if (gameState.yourTurn) {
        yourField.style.opacity = '1';
        opponentField.style.opacity = '0.7';
    } else {
        yourField.style.opacity = '0.7';
        opponentField.style.opacity = '1';
    }
}

function updateFieldZones(field, isOpponent) {
    const fieldClass = isOpponent ? '.player-field.opponent' : '.player-field:not(.opponent)';
    const container = document.querySelector(fieldClass);
    
    // Check if field exists (might not be initialized before game starts)
    if (!field || !field.monsterZones) {
        // Clear zones if field doesn't exist
        container.querySelectorAll('.zone').forEach(zone => {
            zone.innerHTML = '';
        });
        return;
    }
    
    // Update monster zones
    const monsterZones = container.querySelectorAll('.monster-zone');
    monsterZones.forEach(zone => {
        const index = Number(zone.dataset.index);
        zone.innerHTML = '';
        const card = field.monsterZones[index];
        if (card) {
            const cardElement = createCardElement(card, isOpponent);
            zone.appendChild(cardElement);
            
            if (!isOpponent && gameState.yourTurn && gameState.currentPhase === 'battle' &&
                card.canAttack && card.position !== 'defense') {
                cardElement.classList.add('can-attack');
                cardElement.addEventListener('click', () => selectAttacker(index));
            }
        }
        
        zone.onclick = () => handleZoneClick('monster', index, isOpponent);
    });
    
    // Update spell/trap zones
    const spellTrapZones = container.querySelectorAll('.spell-trap-zone');
    spellTrapZones.forEach((zone, index) => {
        zone.innerHTML = '';
        const card = field.spellTrapZones ? field.spellTrapZones[index] : null;
        if (card) {
            const cardElement = createCardElement(card, isOpponent);
            zone.appendChild(cardElement);
        }
        
        zone.onclick = () => handleZoneClick('spellTrap', index, isOpponent);
    });
    
    // Update field zone
    const fieldZone = container.querySelector('.field-zone');
    fieldZone.innerHTML = '';
    if (field.fieldZone) {
        const cardElement = createCardElement(field.fieldZone, isOpponent);
        fieldZone.appendChild(cardElement);
    }
}

function createCardElement(card, isOpponent) {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${card.type}`;
    if (card.position === 'defense') cardElement.classList.add('position-defense');
    
    if (card.faceDown) {
        cardElement.classList.add('face-down');
        cardElement.innerHTML = '<div class="card-name">SET</div>';
    } else {
        // Check if card has images from API
        if (card.images && card.images.length > 0) {
            const imageUrl = card.images[0].image_url_small || card.images[0].image_url;
            let cardHTML = `<img src="${imageUrl}" alt="${card.name}" class="card-image">`;
            cardHTML += `<div class="card-text-overlay">`;
            cardHTML += `<div class="card-name">${card.name}</div>`;
            
            if (card.type === 'monster') {
                cardHTML += `<div class="card-attribute">${getAttributeSymbol(card.attribute)}</div>`;
                cardHTML += `<div class="card-stats">Level: ${card.level}</div>`;
                cardHTML += `<div class="atk-def">ATK: ${card.atk} / DEF: ${card.def}</div>`;
            }
            
            cardHTML += `<div class="card-description">${card.description}</div>`;
            cardHTML += `</div>`;
            cardElement.innerHTML = cardHTML;
            
            // Handle image load error - show text overlay if image fails
            const img = cardElement.querySelector('.card-image');
            img.onerror = function() {
                this.style.display = 'none';
                cardElement.classList.add('no-image');
                const overlay = cardElement.querySelector('.card-text-overlay');
                overlay.style.display = 'flex';
            };
        } else {
            // Fallback to text-only display
            cardElement.classList.add('no-image');
            let cardHTML = `<div class="card-name">${card.name}</div>`;
            
            if (card.type === 'monster') {
                cardHTML += `<div class="card-attribute">${getAttributeSymbol(card.attribute)}</div>`;
                cardHTML += `<div class="card-stats">Level: ${card.level}</div>`;
                cardHTML += `<div class="atk-def">ATK: ${card.atk} / DEF: ${card.def}</div>`;
            }
            
            cardHTML += `<div class="card-description">${card.description}</div>`;
            cardElement.innerHTML = cardHTML;
        }
    }
    
    return cardElement;
}

function getAttributeSymbol(attribute) {
    const symbols = {
        'DARK': '🌙',
        'LIGHT': '☀️',
        'EARTH': '🌍',
        'WATER': '💧',
        'FIRE': '🔥',
        'WIND': '💨'
    };
    return symbols[attribute] || '⭐';
}

function updateHand() {
    const handContainer = document.getElementById('handCards');
    handContainer.innerHTML = '';
    
    gameState.you.hand.forEach((card, index) => {
        const cardElement = createCardElement(card, false);
        
        // Both click and touch events for better mobile support
        cardElement.addEventListener('click', (e) => {
            e.preventDefault();
            if (pendingFusion && !pendingFusion.choosingZone) {
                chooseFusionMaterial('hand', index);
                return;
            }
            showCardModal(card, index);
        });
        
        handContainer.appendChild(cardElement);
    });
}

function getFusionMaterialCount(card) {
    return card.name === 'Blue-Eyes Alternative Ultimate Dragon' ? 3 : 2;
}

function showExtraDeck(polymerizationHandIndex = null) {
    if (!gameState || !gameState.gameStarted) return;
    const cardDetails = document.getElementById('cardDetails');
    const cardActions = document.getElementById('cardActions');
    const hasPolymerization = polymerizationHandIndex !== null ||
        gameState.you.hand.some(card => card.name === 'Polymerization');
    cardDetails.innerHTML = '<h3>Your Extra Deck</h3><p>Only the listed Fusion recipes are supported.</p>';
    cardActions.innerHTML = '';

    gameState.you.field.extraDeck.forEach(card => {
        const entry = document.createElement('div');
        entry.className = 'extra-deck-entry';
        if (card.images && card.images.length > 0) {
            const image = document.createElement('img');
            image.src = card.images[0].image_url;
            image.alt = card.name;
            image.className = 'modal-card-image';
            entry.appendChild(image);
        }
        const name = document.createElement('strong');
        name.textContent = card.name;
        entry.appendChild(name);
        const details = document.createElement('p');
        details.textContent = card.description || 'Fusion Monster';
        entry.appendChild(details);

        const button = document.createElement('button');
        button.textContent = hasPolymerization ? 'Choose materials' : 'Requires Polymerization';
        button.disabled = !hasPolymerization || !gameState.yourTurn ||
            !['main1', 'main2'].includes(gameState.currentPhase) || gameState.gameOver;
        button.onclick = () => beginFusionSummon(card);
        entry.appendChild(button);
        cardActions.appendChild(entry);
    });
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.onclick = closeModal;
    cardActions.appendChild(closeButton);
    cardModal.style.display = 'flex';
}

function beginFusionSummon(fusionCard) {
    if (!gameState.you.hand.some(card => card.name === 'Polymerization')) {
        setActionStatus('You need Polymerization in your hand.');
        return;
    }
    closeModal();
    pendingFusion = {
        fusionCardId: fusionCard.id,
        materialSource: fusionCard.name === 'Starving Venom Fusion Dragon' ? 'field' : null,
        materialCount: getFusionMaterialCount(fusionCard),
        materials: [],
        choosingZone: false
    };
    highlightFusionMaterialTargets();
    setActionStatus(pendingFusion.materialSource === 'field'
        ? `Select ${pendingFusion.materialCount} DARK Fusion Material monsters on your field.`
        : `Select ${pendingFusion.materialCount} Fusion Material monster${pendingFusion.materialCount === 1 ? '' : 's'} from your hand or field.`);
}

function highlightFusionMaterialTargets() {
    clearZoneSelection();
    document.querySelectorAll('.player-field:not(.opponent) .monster-zone').forEach(zone => {
        const card = zone.querySelector('.card');
        if (card && !card.classList.contains('face-down')) {
            zone.classList.add('available-zone');
        }
    });
    if (pendingFusion && pendingFusion.materialSource !== 'field') {
        document.querySelectorAll('#handCards .card').forEach(card =>
            card.classList.add('available-zone')
        );
    }
}

function chooseFusionMaterial(source, index) {
    if (!pendingFusion || pendingFusion.choosingZone) return;
    if (pendingFusion.materialSource && source !== pendingFusion.materialSource) return;
    if (pendingFusion.materials.some(material =>
        material.source === source && material.index === index
    )) return;

    const card = source === 'hand'
        ? gameState.you.hand[index]
        : gameState.you.field.monsterZones[index];
    if (!card || card.type !== 'monster' || (source === 'field' && card.faceDown)) return;
    pendingFusion.materials.push({ source, index });
    const selectedElement = source === 'hand'
        ? document.querySelectorAll('#handCards .card')[index]
        : document.querySelectorAll('.player-field:not(.opponent) .monster-zone')[index]
            .querySelector('.card');
    if (selectedElement) selectedElement.classList.add('fusion-material-selected');

    const remaining = pendingFusion.materialCount - pendingFusion.materials.length;
    if (remaining > 0) {
        setActionStatus(`Select ${remaining} more Fusion Material monster${remaining === 1 ? '' : 's'}.`);
        return;
    }

    pendingFusion.choosingZone = true;
    clearZoneSelection();
    const materialFieldIndices = pendingFusion.materials
        .filter(material => material.source === 'field')
        .map(material => material.index);
    document.querySelectorAll('.player-field:not(.opponent) .monster-zone').forEach(zone => {
        const index = Number(zone.dataset.index);
        if (!zone.querySelector('.card') || materialFieldIndices.includes(index)) {
            zone.classList.add('available-zone');
        }
    });
    pendingFusion.materials.forEach(material => {
        const element = material.source === 'hand'
            ? document.querySelectorAll('#handCards .card')[material.index]
            : document.querySelectorAll('.player-field:not(.opponent) .monster-zone')[material.index]
                .querySelector('.card');
        if (element) element.classList.add('fusion-material-selected');
    });
    setActionStatus('Select an empty Monster Zone for the Fusion Monster.');
}

function cancelPendingAction() {
    pendingPlay = null;
    pendingFusion = null;
    pendingEffect = null;
    clearZoneSelection();
    setActionStatus('');
}

function showCardModal(card, handIndex) {
    selectedCard = { card, handIndex };
    
    const cardDetails = document.getElementById('cardDetails');
    let detailsHTML = `<h3>${card.name}</h3>`;
    
    // Add card image if available
    if (card.images && card.images.length > 0) {
        const imageUrl = card.images[0].image_url;
        detailsHTML += `<img src="${imageUrl}" alt="${card.name}" class="modal-card-image" onerror="this.onerror=null;this.src='${card.images[0].image_url_small || ''}';">`;
    }
    
    detailsHTML += `<p><strong>Type:</strong> ${card.type}</p>`;
    
    if (card.type === 'monster') {
        detailsHTML += `<p><strong>Attribute:</strong> ${card.attribute}</p>`;
        detailsHTML += `<p><strong>Level:</strong> ${card.level}</p>`;
        detailsHTML += `<p><strong>ATK:</strong> ${card.atk}</p>`;
        detailsHTML += `<p><strong>DEF:</strong> ${card.def}</p>`;
    }
    
    detailsHTML += `<p><strong>Description:</strong> ${card.description}</p>`;
    cardDetails.innerHTML = detailsHTML;
    
    const cardActions = document.getElementById('cardActions');
    cardActions.innerHTML = '';
    
    const canPlay = gameState.gameStarted && !gameState.gameOver && gameState.yourTurn &&
        (gameState.currentPhase === 'main1' || gameState.currentPhase === 'main2');
    if (canPlay && card.type === 'monster') {
        if (gameState.normalSummonUsed) {
            addActionHint(cardActions, 'You have already used your Normal Summon/Set this turn.');
        } else {
            const tributes = getRequiredTributes(card);
            const availableMonsters = gameState.you.field.monsterZones.filter(Boolean).length;
            const tributeLabel = tributes === 0
                ? ''
                : ` (${tributes} Tribute${tributes === 1 ? '' : 's'})`;
            [
                [`Summon in Attack Position${tributeLabel}`, 'summonAttack'],
                [`Summon in Defense Position${tributeLabel}`, 'summonDefense'],
                [`Set in Defense Position${tributeLabel}`, 'setDefense']
            ].forEach(([label, action]) => {
                const button = document.createElement('button');
                button.textContent = label;
                button.disabled = availableMonsters < tributes;
                button.onclick = () => selectCardZone(card, handIndex, 'monster', action);
                cardActions.appendChild(button);
            });
            if (availableMonsters < tributes) {
                addActionHint(cardActions, `You need ${tributes} monster${tributes === 1 ? '' : 's'} to Tribute.`);
            }
        }
    } else if (canPlay && card.type === 'spell') {
        const addButton = (label, handler) => {
            const button = document.createElement('button');
            button.textContent = label;
            button.onclick = handler;
            cardActions.appendChild(button);
        };
        if (card.name === 'Dark Hole') {
            addButton('Activate Dark Hole', () => {
                closeModal();
                socket.emit('activateEffect', { roomId: currentRoom, cardIndex: handIndex });
                setActionStatus('Activating Dark Hole...');
            });
        } else if (card.name === 'Mystical Space Typhoon') {
            addButton('Activate: choose a Spell/Trap to destroy', () => {
                closeModal();
                pendingEffect = { kind: 'mst', handIndex };
                highlightSpellTrapTargets();
                setActionStatus('Choose a Spell/Trap on either field to destroy.');
            });
        } else if (card.name === 'Monster Reborn') {
            addButton('Activate Monster Reborn', () => showMonsterRebornTargets(handIndex));
        } else if (card.name === 'Polymerization') {
            addButton('Activate: choose a Fusion Monster', () => showExtraDeck(handIndex));
        } else {
            addButton('Activate Spell (effect not implemented)', () =>
                selectCardZone(card, handIndex, 'spellTrap', 'activateSpell'));
        }
        addButton('Set Spell', () => selectCardZone(card, handIndex, 'spellTrap', 'setSpell'));
    } else if (canPlay && card.type === 'trap') {
        const button = document.createElement('button');
        button.textContent = 'Set Trap';
        button.onclick = () => selectCardZone(card, handIndex, 'spellTrap', 'setTrap');
        cardActions.appendChild(button);
    } else if (card.type === 'monster' || card.type === 'spell' || card.type === 'trap') {
        const message = !gameState.gameStarted
            ? 'Start the game to play cards.'
            : !gameState.yourTurn
                ? 'You can play cards on your turn.'
                : 'You can play cards during Main Phase 1 or Main Phase 2.';
        addActionHint(cardActions, message);
    }
    
    cardModal.style.display = 'flex';
}

function getRequiredTributes(card) {
    if (!Number.isFinite(card.level) || card.level <= 4) return 0;
    return card.level <= 6 ? 1 : 2;
}

function addActionHint(container, message) {
    const hint = document.createElement('p');
    hint.className = 'card-action-hint';
    hint.textContent = message;
    container.appendChild(hint);
}

function showMonsterRebornTargets(handIndex) {
    const cardDetails = document.getElementById('cardDetails');
    const cardActions = document.getElementById('cardActions');
    cardDetails.innerHTML = '<h3>Monster Reborn</h3><p>Choose a monster in either Graveyard.</p>';
    cardActions.innerHTML = '';
    const targets = [
        ...gameState.you.field.graveyard.map((card, index) => ({ card, index, side: 'you' })),
        ...gameState.opponent.field.graveyard.map((card, index) => ({ card, index, side: 'opponent' }))
    ].filter(target => target.card.type === 'monster');

    if (targets.length === 0) {
        addActionHint(cardActions, 'There are no monsters in either Graveyard.');
    } else {
        targets.forEach(({ card, index, side }) => {
            const button = document.createElement('button');
            button.textContent = `${side === 'you' ? 'Your' : 'Opponent'} GY: ${card.name}`;
            button.onclick = () => {
                pendingEffect = { kind: 'reborn', handIndex, side, graveyardIndex: index };
                closeModal();
                highlightPlacementZones('monster', []);
                setActionStatus('Choose an empty Monster Zone for the revived monster.');
            };
            cardActions.appendChild(button);
        });
    }
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = closeModal;
    cardActions.appendChild(cancelButton);
    cardModal.style.display = 'flex';
}

function highlightSpellTrapTargets() {
    clearZoneSelection();
    document.querySelectorAll('.spell-trap-zone').forEach(zone => {
        if (zone.querySelector('.card')) zone.classList.add('available-zone');
    });
}

function selectCardZone(card, handIndex, zoneType, action) {
    closeModal();
    const tributeCount = zoneType === 'monster' ? getRequiredTributes(card) : 0;
    const tributeIndices = [];
    pendingPlay = {
        handIndex,
        zone: zoneType,
        action,
        tributeCount,
        tributeIndices,
        selectingTributes: tributeCount > 0
    };
    const selector = zoneType === 'monster' ? '.monster-zone' : '.spell-trap-zone';
    const zones = document.querySelectorAll(`.player-field:not(.opponent) ${selector}`);
    const hasPlacementSpace = Array.from(zones).some(zone =>
        !zone.querySelector('.card') ||
        (zoneType === 'monster' && tributeCount > 0 && zone.querySelector('.card'))
    );
    const availableTributes = gameState.you.field.monsterZones.filter(Boolean).length;
    if (!hasPlacementSpace || availableTributes < tributeCount) {
        pendingPlay = null;
        showCardModal(card, handIndex);
        setActionStatus(!hasPlacementSpace
            ? 'There is no space for this card.'
            : `You need ${tributeCount} monster${tributeCount === 1 ? '' : 's'} to Tribute.`);
        return;
    }

    if (tributeCount > 0) {
        zones.forEach(zone => {
            if (zone.querySelector('.card')) zone.classList.add('available-zone');
        });
        setActionStatus(`Select ${tributeCount} monster${tributeCount === 1 ? '' : 's'} to Tribute.`);
    } else {
        highlightPlacementZones(zoneType, []);
        setActionStatus(`Select an empty ${zoneType === 'monster' ? 'Monster' : 'Spell/Trap'} Zone.`);
    }
}

function highlightPlacementZones(zoneType, tributeIndices) {
    clearZoneSelection();
    const selector = zoneType === 'monster' ? '.monster-zone' : '.spell-trap-zone';
    document.querySelectorAll(`.player-field:not(.opponent) ${selector}`).forEach(zone => {
        const index = Number(zone.dataset.index);
        const zoneCard = zone.querySelector('.card');
        if (!zoneCard || tributeIndices.includes(index)) {
            zone.classList.add('available-zone');
        }
    });
}

function clearZoneSelection() {
    const zones = document.querySelectorAll('.zone');
    zones.forEach(zone => {
        zone.style.borderColor = '';
        zone.style.background = '';
        zone.classList.remove('available-zone');
    });
    document.querySelectorAll('#handCards .card.available-zone').forEach(card =>
        card.classList.remove('available-zone')
    );
    document.querySelectorAll('.fusion-material-selected').forEach(card =>
        card.classList.remove('fusion-material-selected')
    );
    selectedZone = null;
    directAttackBtn.style.display = 'none';
}

function selectAttacker(attackerIndex) {
    if (!gameState.opponent.field) return;

    selectedZone = { type: 'attacker', index: attackerIndex };
    const opponentZones = document.querySelectorAll('.player-field.opponent .monster-zone');
    opponentZones.forEach(zone => {
        const index = Number(zone.dataset.index);
        const hasTarget = Boolean(gameState.opponent.field.monsterZones[index]);
        if (hasTarget || !gameState.opponent.field.monsterZones.some(Boolean)) {
            zone.classList.add('available-zone');
        }
    });
    directAttackBtn.style.display = gameState.opponent.field.monsterZones.some(Boolean)
        ? 'none'
        : 'inline-block';
    setActionStatus(gameState.opponent.field.monsterZones.some(Boolean)
        ? 'Choose an opponent monster to attack.'
        : 'Your opponent has no monsters. Select Direct Attack or an empty opposing Monster Zone.');
}

function handleZoneClick(zone, index, isOpponent) {
    if (!gameState.yourTurn || !gameState.gameStarted || gameState.gameOver) return;

    if (pendingEffect) {
        if (pendingEffect.kind === 'mst') {
            if (zone !== 'spellTrap' ||
                !(isOpponent
                    ? gameState.opponent.field.spellTrapZones[index]
                    : gameState.you.field.spellTrapZones[index])) return;
            socket.emit('activateEffect', {
                roomId: currentRoom,
                cardIndex: pendingEffect.handIndex,
                target: { side: isOpponent ? 'opponent' : 'you', zoneIndex: index }
            });
            pendingEffect = null;
            clearZoneSelection();
            setActionStatus('Activating Mystical Space Typhoon...');
            return;
        }
        if (pendingEffect.kind === 'reborn') {
            if (isOpponent || zone !== 'monster' ||
                gameState.you.field.monsterZones[index]) return;
            socket.emit('activateEffect', {
                roomId: currentRoom,
                cardIndex: pendingEffect.handIndex,
                target: {
                    side: pendingEffect.side,
                    graveyardIndex: pendingEffect.graveyardIndex,
                    zoneIndex: index
                }
            });
            pendingEffect = null;
            clearZoneSelection();
            setActionStatus('Activating Monster Reborn...');
            return;
        }
    }

    if (pendingFusion) {
        if (isOpponent || zone !== 'monster') return;
        if (!pendingFusion.choosingZone) {
            if (gameState.you.field.monsterZones[index]) {
                chooseFusionMaterial('field', index);
            }
            return;
        }
        const selectedFieldMaterials = pendingFusion.materials
            .filter(material => material.source === 'field')
            .map(material => material.index);
        if (gameState.you.field.monsterZones[index] &&
            !selectedFieldMaterials.includes(index)) return;
        socket.emit('fusionSummon', {
            roomId: currentRoom,
            fusionCardId: pendingFusion.fusionCardId,
            materials: pendingFusion.materials,
            zoneIndex: index
        });
        pendingFusion = null;
        clearZoneSelection();
        setActionStatus('Performing Fusion Summon...');
        return;
    }

    if (pendingPlay) {
        if (isOpponent) return;

        if (pendingPlay.selectingTributes) {
            if (zone !== 'monster' ||
                !gameState.you.field.monsterZones[index] ||
                pendingPlay.tributeIndices.includes(index)) return;

            pendingPlay.tributeIndices.push(index);
            if (pendingPlay.tributeIndices.length < pendingPlay.tributeCount) {
                setActionStatus(`Select ${pendingPlay.tributeCount - pendingPlay.tributeIndices.length} more monster${pendingPlay.tributeCount - pendingPlay.tributeIndices.length === 1 ? '' : 's'} to Tribute.`);
                return;
            }

            pendingPlay.selectingTributes = false;
            highlightPlacementZones('monster', pendingPlay.tributeIndices);
            setActionStatus('Now select an available Monster Zone.');
            return;
        }

        if (pendingPlay.zone !== zone) return;

        const targetZones = zone === 'monster'
            ? gameState.you.field.monsterZones
            : gameState.you.field.spellTrapZones;
        if (targetZones[index] && !pendingPlay.tributeIndices.includes(index)) return;

        socket.emit('playCard', {
            roomId: currentRoom,
            cardIndex: pendingPlay.handIndex,
            zone: pendingPlay.zone,
            zoneIndex: index,
            action: pendingPlay.action,
            tributeIndices: pendingPlay.tributeIndices
        });
        pendingPlay = null;
        clearZoneSelection();
        setActionStatus('Placing card...');
        return;
    }

    if (selectedZone && selectedZone.type === 'attacker' && isOpponent && zone === 'monster') {
        if (!gameState.opponent.field.monsterZones.some(Boolean)) {
            socket.emit('directAttack', {
                roomId: currentRoom,
                attackerIndex: selectedZone.index
            });
        } else if (gameState.opponent.field.monsterZones[index]) {
            socket.emit('attack', {
                roomId: currentRoom,
                attackerIndex: selectedZone.index,
                defenderIndex: index
            });
        } else {
            return;
        }
        clearZoneSelection();
    }
}

function setActionStatus(message) {
    const status = document.getElementById('actionStatus');
    if (status) status.textContent = message;
    cancelActionBtn.style.display = pendingPlay || pendingFusion || pendingEffect
        ? 'inline-block'
        : 'none';
}

function closeModal() {
    cardModal.style.display = 'none';
    clearZoneSelection();
}

function checkGameOver() {
    if (!gameState || !gameState.gameStarted || !gameState.gameOver || gameOverShown) return;
    
    gameOverShown = true;
    const won = gameState.you.isWinner;
    showGameOver(won, gameState.resultReason);
}

function showGameOver(won, resultReason) {
    document.querySelector('.game-over')?.remove();
    const gameOverDiv = document.createElement('div');
    gameOverDiv.className = 'game-over';
    const result = resultReason === 'resignation' ? 'A player resigned.'
        : resultReason === 'deck-out' ? 'The active player could not draw from an empty deck.'
        : resultReason === 'life-points' ? 'A player reached 0 Life Points.'
            : 'The Duel has ended.';
    const heading = document.createElement('h2');
    heading.textContent = gameState.winner === null
        ? 'Duel Over'
        : won ? 'You Win!' : 'You Lose!';
    const description = document.createElement('p');
    description.textContent = result;
    const setupButton = document.createElement('button');
    setupButton.type = 'button';
    setupButton.textContent = 'Set Up Another Duel';
    setupButton.addEventListener('click', startAnotherDuel);
    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.textContent = '← All games';
    menuButton.addEventListener('click', returnToGameMenu);
    gameOverDiv.append(heading, description, setupButton, menuButton);
    document.body.appendChild(gameOverDiv);
}

function startAnotherDuel() {
    sessionStorage.removeItem(tabDuelSessionStorageKey);
    currentRoom = '';
    gameState = null;
    gameOverShown = false;
    document.querySelector('.game-over')?.remove();
    document.querySelectorAll('.zone').forEach(zone => {
        zone.replaceChildren();
    });
    document.getElementById('handCards').replaceChildren();
    playerName = playerNameInput.value.trim();
    roomIdInput.value = `duel-${createRoomSuffix()}`;
    localStorage.setItem('arcade-active-game', 'yugioh');
    gameScreen.style.display = 'none';
    gameMenu.style.display = 'none';
    loginScreen.style.display = 'flex';
    setActionStatus('');
}

function createRoomSuffix() {
    if (window.crypto.randomUUID) return window.crypto.randomUUID().slice(0, 8);
    const bytes = window.crypto.getRandomValues(new Uint8Array(4));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function resetGame() {
    gameState = null;
    gameOverShown = false;
    selectedCard = null;
    selectedZone = null;
    pendingPlay = null;
    pendingFusion = null;
    pendingEffect = null;
    setActionStatus('');
    loginScreen.style.display = 'flex';
    gameScreen.style.display = 'none';
    readyBtn.style.display = 'none';
    extraDeckBtn.style.display = 'none';
    
    // Clear field
    document.querySelectorAll('.zone').forEach(zone => {
        zone.innerHTML = '';
    });
    
    // Clear hand
    document.getElementById('handCards').innerHTML = '';
}

// Add click handlers for deck and graveyard
function addDeckGraveyardHandlers() {
    const playerDeckVisual = document.getElementById('playerDeckVisual');
    const playerGraveyardVisual = document.getElementById('playerGraveyardVisual');
    
    if (playerDeckVisual) {
        playerDeckVisual.addEventListener('click', () => showDeck());
        playerDeckVisual.addEventListener('touchend', (e) => {
            e.preventDefault();
            showDeck();
        });
    }
    
    if (playerGraveyardVisual) {
        playerGraveyardVisual.addEventListener('click', () => showGraveyard());
        playerGraveyardVisual.addEventListener('touchend', (e) => {
            e.preventDefault();
            showGraveyard();
        });
    }
}

function showDeck() {
    if (!gameState || !gameState.gameStarted) {
        alert('The game has not started yet');
        return;
    }

    if (gameState.you.deckCount === 0) {
        alert('Your deck is empty');
        return;
    }
    
    const cardDetails = document.getElementById('cardDetails');
    cardDetails.innerHTML = `
        <h3>Your Deck</h3>
        <p>Cards remaining: ${gameState.you.deckCount}</p>
        <p><em>(Deck contents are hidden during gameplay)</em></p>
    `;
    
    const cardActions = document.getElementById('cardActions');
    cardActions.innerHTML = '<button onclick="closeModal()">Close</button>';
    
    cardModal.style.display = 'flex';
}

function showGraveyard() {
    if (!gameState || !gameState.you.field.graveyard) {
        alert('Graveyard is empty or game not started');
        return;
    }
    
    const graveyard = gameState.you.field.graveyard;
    const cardDetails = document.getElementById('cardDetails');
    
    let graveyardHTML = '<h3>Your Graveyard</h3>';
    graveyardHTML += `<p>Cards in graveyard: ${graveyard.length}</p>`;
    
    if (graveyard.length > 0) {
        graveyardHTML += '<div id="graveyardCards" style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 15px;"></div>';
        cardDetails.innerHTML = graveyardHTML;
        
        const graveyardContainer = document.getElementById('graveyardCards');
        graveyard.forEach((card, index) => {
            const cardElement = createCardElement(card, false);
            cardElement.style.width = '60px';
            cardElement.style.height = '84px';
            cardElement.style.fontSize = '8px';
            graveyardContainer.appendChild(cardElement);
        });
    } else {
        graveyardHTML += '<p><em>Graveyard is empty</em></p>';
        cardDetails.innerHTML = graveyardHTML;
    }
    
    const cardActions = document.getElementById('cardActions');
    cardActions.innerHTML = '<button onclick="closeModal()">Close</button>';
    
    cardModal.style.display = 'flex';
}
