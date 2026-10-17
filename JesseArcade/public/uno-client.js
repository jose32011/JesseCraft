(() => {
    const socket = window.arcadeSocket;
    const menu = document.getElementById('gameMenu');
    const yugiohSetup = document.getElementById('loginScreen');
    const yugiohGame = document.getElementById('gameScreen');
    const ludoScreen = document.getElementById('ludoScreen');
    const chessScreen = document.getElementById('chessScreen');
    const snakesScreen = document.getElementById('snakesLaddersScreen');
    const screen = document.getElementById('unoScreen');
    const setup = document.getElementById('unoSetup');
    const game = document.getElementById('unoGame');
    const nameInput = document.getElementById('unoPlayerName');
    const roomInput = document.getElementById('unoRoomId');
    const playerCountInput = document.getElementById('unoPlayerCount');
    const modeInput = document.getElementById('unoMode');
    const variantInput = document.getElementById('unoVariant');
    const setupHint = document.getElementById('unoSetupHint');
    const joinButton = document.getElementById('unoJoinBtn');
    const setupStatus = document.getElementById('unoSetupStatus');
    const hand = document.getElementById('unoHand');
    const drawButton = document.getElementById('unoDrawBtn');
    const passButton = document.getElementById('unoPassBtn');
    const callButton = document.getElementById('unoCallBtn');
    const challengeButton = document.getElementById('unoChallengeBtn');
    const resignButton = document.getElementById('unoResignBtn');
    const colorSelect = document.getElementById('unoColorChoice');
    const colorLabel = document.getElementById('unoColorLabel');
    const targetSelect = document.getElementById('unoTargetChoice');
    const targetLabel = document.getElementById('unoTargetLabel');
    const tokenKey = 'uno-player-token';
    const sessionKey = 'uno-player-session';
    const colors = ['red', 'yellow', 'green', 'blue'];
    let playerToken = localStorage.getItem(tokenKey);
    let currentRoom = '';
    let state = null;
    let selectedCardId = null;
    let selectedTargetToken = '';
    let isJoining = false;
    let activeHandPointer = null;
    let suppressHandClick = false;

    if (!playerToken) {
        playerToken = window.crypto.randomUUID
            ? window.crypto.randomUUID()
            : Array.from(window.crypto.getRandomValues(new Uint8Array(16)),
                byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(tokenKey, playerToken);
    }

    function updateSetupHint() {
        if (modeInput.value === 'online-ai' && Number(playerCountInput.value) < 3) {
            playerCountInput.value = '3';
        }
        setupHint.textContent = modeInput.value === 'vs-ai'
            ? `Play alone against ${Number(playerCountInput.value) - 1} AI player${Number(playerCountInput.value) === 2 ? '' : 's'}.`
            : modeInput.value === 'online-ai'
                ? `Two people join the same room; the other ${Number(playerCountInput.value) - 2} seat${Number(playerCountInput.value) === 3 ? '' : 's'} are AI.`
                : 'Both players choose the same room ID and player count. Wild cards let you choose the next color.';
        if (variantInput.value === 'no-mercy') {
            setupHint.textContent += ' No Mercy adds stackable draw cards, 7 hand swaps, 0 hand rotations, and elimination above 25 cards.';
        }
    }

    window.showUnoScreen = () => {
        localStorage.setItem('arcade-active-game', 'uno');
        hideOtherGames();
        screen.style.display = 'block';
        setup.style.display = 'flex';
        game.style.display = 'none';
    };

    window.leaveUnoSession = (nextGame = 'menu') => {
        if (currentRoom) socket.emit('leaveUno', { roomId: currentRoom });
        localStorage.removeItem(sessionKey);
        localStorage.setItem('arcade-active-game', nextGame);
        currentRoom = '';
        state = null;
        selectedCardId = null;
    };

    document.getElementById('unoBackToMenu').addEventListener('click', () => {
        localStorage.setItem('arcade-active-game', 'menu');
        screen.style.display = 'none';
        menu.style.display = 'flex';
        setupStatus.textContent = '';
    });

    document.getElementById('unoLeaveBtn').addEventListener('click', () => {
        window.leaveUnoSession('menu');
        game.style.display = 'none';
        setup.style.display = 'flex';
        screen.style.display = 'none';
        menu.style.display = 'flex';
        setupStatus.textContent = '';
    });

    joinButton.addEventListener('click', () => joinRoom(false));
    modeInput.addEventListener('change', updateSetupHint);
    variantInput.addEventListener('change', updateSetupHint);
    playerCountInput.addEventListener('change', updateSetupHint);
    drawButton.addEventListener('click', () => {
        if (state?.canDraw) socket.emit('unoDraw', { roomId: currentRoom });
    });
    passButton.addEventListener('click', () => {
        if (state?.canPass) socket.emit('unoPass', { roomId: currentRoom });
    });
    callButton.addEventListener('click', () => {
        if (state?.youNeedToCallUno || state?.canCatchUno) {
            socket.emit('unoCall', { roomId: currentRoom });
        }
    });
    challengeButton.addEventListener('click', () => {
        if (state?.canChallenge) socket.emit('unoChallenge', { roomId: currentRoom });
    });
    colorSelect.addEventListener('change', submitSelectedCard);
    resignButton.addEventListener('click', () => {
        if (!state?.started || state.gameOver ||
            !window.confirm('Resign this UNO game? Your opponent will win.')) return;
        resignButton.disabled = true;
        socket.emit('unoResign', { roomId: currentRoom });
    });
    targetSelect.addEventListener('change', () => {
        selectedTargetToken = targetSelect.value;
        submitSelectedCard();
    });
    hand.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'touch' || !event.isPrimary) return;
        activeHandPointer = {
            id: event.pointerId,
            startX: event.clientX,
            startScrollLeft: hand.scrollLeft,
            dragging: false
        };
    });
    hand.addEventListener('pointermove', event => {
        if (!activeHandPointer || event.pointerId !== activeHandPointer.id) return;
        const deltaX = event.clientX - activeHandPointer.startX;
        if (!activeHandPointer.dragging && Math.abs(deltaX) >= 8) {
            activeHandPointer.dragging = true;
        }
        if (activeHandPointer.dragging) {
            hand.scrollLeft = activeHandPointer.startScrollLeft - deltaX;
        }
    });
    const finishHandPointer = event => {
        if (!activeHandPointer || event.pointerId !== activeHandPointer.id) return;
        if (activeHandPointer.dragging) {
            suppressHandClick = true;
            window.setTimeout(() => {
                suppressHandClick = false;
            }, 500);
        }
        activeHandPointer = null;
    };
    hand.addEventListener('pointerup', finishHandPointer);
    hand.addEventListener('pointercancel', finishHandPointer);
    hand.addEventListener('click', event => {
        if (!suppressHandClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressHandClick = false;
    }, true);

    function hideOtherGames() {
        menu.style.display = 'none';
        yugiohSetup.style.display = 'none';
        yugiohGame.style.display = 'none';
        ludoScreen.style.display = 'none';
        chessScreen.style.display = 'none';
        snakesScreen.style.display = 'none';
    }

    function joinRoom(isRestore) {
        if (isJoining) return;
        const playerName = nameInput.value.trim();
        const roomId = roomInput.value.trim();
        const playerCount = Number(playerCountInput.value);
        const mode = modeInput.value;
        const variant = variantInput.value;
        if (mode === 'online-ai' && playerCount < 3) {
            setupStatus.textContent = 'Choose at least three total seats for two players plus AI.';
            return;
        }
        if (!playerName || !roomId) {
            setupStatus.textContent = 'Enter your name and a room ID to join.';
            return;
        }
        currentRoom = roomId;
        if (!isRestore) {
            localStorage.setItem(sessionKey, JSON.stringify({ playerName, roomId, playerCount, mode, variant }));
        }
        localStorage.setItem('arcade-active-game', 'uno');
        setupStatus.textContent = 'Joining room...';
        joinButton.disabled = true;
        isJoining = true;
        socket.emit('joinUno', { playerName, roomId, playerToken, playerCount, mode, variant });
    }

    function restoreSession() {
        if (localStorage.getItem('arcade-active-game') !== 'uno') return;
        const saved = localStorage.getItem(sessionKey);
        if (!saved) {
            window.showUnoScreen();
            return;
        }
        try {
            const session = JSON.parse(saved);
            if (typeof session.playerName !== 'string' ||
                typeof session.roomId !== 'string' ||
                !Number.isInteger(session.playerCount) ||
                session.playerCount < 2 || session.playerCount > 4) {
                throw new Error('Saved UNO session is incomplete.');
            }
            nameInput.value = session.playerName;
            roomInput.value = session.roomId;
            playerCountInput.value = String(session.playerCount);
            modeInput.value = ['online', 'vs-ai', 'online-ai'].includes(session.mode)
                ? session.mode
                : 'online';
            variantInput.value = ['normal', 'no-mercy'].includes(session.variant)
                ? session.variant
                : 'normal';
            updateSetupHint();
            joinRoom(true);
        } catch (error) {
            console.error('Unable to restore saved UNO session:', error);
            localStorage.removeItem(sessionKey);
            window.showUnoScreen();
        }
    }

    socket.on('connect', restoreSession);
    if (socket.connected) restoreSession();

    socket.on('unoJoined', result => {
        isJoining = false;
        joinButton.disabled = false;
        if (!result.success) {
            setupStatus.textContent = result.message || 'Unable to join this UNO room.';
            localStorage.removeItem(sessionKey);
            return;
        }
        currentRoom = result.roomId;
        document.getElementById('unoCurrentRoom').textContent = currentRoom;
        hideOtherGames();
        screen.style.display = 'block';
        setup.style.display = 'none';
        game.style.display = 'block';
        setupStatus.textContent = '';
    });

    socket.on('unoState', nextState => {
        state = nextState;
        currentRoom = nextState.roomId;
        if (!nextState.yourHand.some(card => card.id === selectedCardId)) {
            selectedCardId = null;
        }
        render(nextState);
    });

    socket.on('unoError', message => {
        document.getElementById('unoTurnStatus').textContent = message;
        if (!state?.gameOver) resignButton.disabled = !state?.started;
    });

    socket.on('unoSessionReplaced', () => {
        document.getElementById('unoTurnStatus').textContent =
            'This UNO session was opened in another tab.';
    });

    function render(nextState) {
        document.getElementById('unoModeSummary').textContent =
            `${nextState.variant === 'no-mercy' ? 'NO MERCY' : 'CLASSIC'} · ${nextState.mode === 'vs-ai'
                ? 'VS AI'
                : nextState.mode === 'online-ai' ? '2 PLAYERS + AI' : 'ONLINE'}`;
        document.getElementById('unoTurnStatus').textContent = nextState.gameOver
            ? nextState.status
            : !nextState.started
                ? `Waiting for ${nextState.players.length === 1 ? 'another player' : 'players'} to join.`
                : nextState.yourTurn
                    ? nextState.pendingDraw
                        ? nextState.variant === 'no-mercy' && nextState.canPlay.length
                            ? `Stack a draw card or draw ${nextState.pendingDraw} penalty cards.`
                            : `Draw ${nextState.pendingDraw} penalty cards.`
                        : nextState.canPass
                            ? 'Play the card you drew or pass.'
                            : 'Your turn. Match the color or symbol.'
                    : `${nextState.currentPlayerName} is playing.`;
        document.getElementById('unoDeckCount').textContent = String(nextState.drawPileCount);
        const colorName = document.getElementById('unoCurrentColor');
        colorName.textContent = nextState.currentColor
            ? nextState.currentColor[0].toUpperCase() + nextState.currentColor.slice(1)
            : '—';
        colorName.className = nextState.currentColor
            ? `uno-color-name color-${nextState.currentColor}`
            : 'uno-color-name';
        drawButton.disabled = !nextState.canDraw;
        passButton.disabled = !nextState.canPass;
        callButton.hidden = !nextState.youNeedToCallUno && !nextState.canCatchUno;
        callButton.disabled = callButton.hidden;
        callButton.textContent = nextState.youNeedToCallUno
            ? 'Call UNO!'
            : `Catch ${nextState.unoPendingName}!`;
        challengeButton.hidden = !nextState.canChallenge;
        challengeButton.disabled = challengeButton.hidden;
        const selectedCard = nextState.yourHand.find(card => card.id === selectedCardId);
        const needsTarget = selectedCard?.type === 'number' && selectedCard.value === 7 &&
            nextState.variant === 'no-mercy';
        targetSelect.hidden = !needsTarget;
        targetLabel.hidden = !needsTarget;
        if (needsTarget) renderTargetChoices(nextState);
        resignButton.disabled = !nextState.started || nextState.gameOver;
        renderPlayers(nextState);
        const selected = selectedCard;
        const needsColor = selected && isWild(selected);
        colorSelect.hidden = !needsColor;
        colorLabel.hidden = !needsColor;
        const topCard = document.getElementById('unoTopCard');
        if (nextState.currentCard) {
            renderCard(topCard, nextState.currentCard);
        } else {
            topCard.replaceChildren();
            topCard.className = 'uno-empty-card';
            topCard.textContent = 'Waiting';
        }
        renderHand(nextState);
    }

    function submitSelectedCard() {
        if (!state || !state.yourTurn || !state.canPlay.includes(selectedCardId)) return false;
        const selected = state.yourHand.find(card => card.id === selectedCardId);
        if (!selected) return false;
        const needsTarget = selected.type === 'number' && selected.value === 7 &&
            state.variant === 'no-mercy';
        if ((isWild(selected) && !colors.includes(colorSelect.value)) ||
            (needsTarget && !state.players.some(player =>
                !player.you && !player.eliminated && String(player.seat) === selectedTargetToken))) {
            return false;
        }
        socket.emit('unoPlay', {
            roomId: currentRoom,
            cardId: selected.id,
            ...(isWild(selected) ? { chosenColor: colorSelect.value } : {}),
            ...(needsTarget ? { targetSeat: Number(selectedTargetToken) } : {})
        });
        selectedCardId = null;
        selectedTargetToken = '';
        colorSelect.value = '';
        return true;
    }

    function renderTargetChoices(nextState) {
        const activeOpponents = nextState.players.filter(player => !player.you && !player.eliminated);
        const priorValue = selectedTargetToken;
        targetSelect.replaceChildren();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Choose a player';
        targetSelect.append(placeholder);
        activeOpponents.forEach(player => {
            const option = document.createElement('option');
            option.value = String(player.seat);
            option.textContent = `${player.name}${player.isAI ? ' (AI)' : ''}`;
            targetSelect.append(option);
        });
        selectedTargetToken = activeOpponents.some(player => String(player.seat) === priorValue)
            ? priorValue
            : '';
        targetSelect.value = selectedTargetToken;
    }

    function renderPlayers(nextState) {
        const players = document.getElementById('unoPlayers');
        players.replaceChildren();
        nextState.players.forEach(player => {
            const card = document.createElement('div');
            card.className = `uno-player-card${player.isCurrentTurn ? ' is-current' : ''}`;
            const name = document.createElement('strong');
            name.textContent = player.name + (player.you ? ' (You)' : '');
            const count = document.createElement('span');
            count.textContent = player.eliminated
                ? `${player.cardCount} cards · Eliminated`
                : `${player.cardCount} cards · ${player.isAI ? 'AI' : player.connected ? 'Online' : 'Reconnecting'}`;
            const back = document.createElement('span');
            back.className = 'uno-opponent-cards';
            back.setAttribute('aria-hidden', 'true');
            for (let index = 0; index < Math.min(player.cardCount, 7); index += 1) {
                const cardBack = document.createElement('i');
                back.append(cardBack);
            }
            card.append(name, count, back);
            players.append(card);
        });
    }

    function renderHand(nextState) {
        hand.replaceChildren();
        nextState.yourHand.forEach(card => {
            const playable = nextState.canPlay.includes(card.id);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `uno-card${playable ? ' is-playable' : ''}${selectedCardId === card.id ? ' is-selected' : ''}`;
            button.disabled = !playable;
            button.setAttribute('aria-label', describeCard(card));
            button.setAttribute('aria-pressed', String(selectedCardId === card.id));
            renderCard(button, card);
            button.addEventListener('click', () => {
                selectedCardId = card.id;
                selectedTargetToken = '';
                colorSelect.value = '';
                const selected = nextState.yourHand.find(candidate => candidate.id === card.id);
                const needsColor = selected && isWild(selected);
                colorSelect.hidden = !needsColor;
                colorLabel.hidden = !needsColor;
                const needsTarget = selected?.type === 'number' && selected.value === 7 &&
                    nextState.variant === 'no-mercy';
                targetLabel.hidden = !needsTarget;
                targetSelect.hidden = !needsTarget;
                if (needsTarget) {
                    renderTargetChoices(nextState);
                } else if (!needsColor) {
                    submitSelectedCard();
                }
                renderHand(nextState);
            });
            hand.append(button);
        });
    }

    function renderCard(container, card) {
        container.replaceChildren();
        container.classList.add('uno-card');
        container.classList.toggle('is-wild', isWild(card));
        container.classList.toggle('is-number', card.type === 'number');
        container.classList.toggle('is-action', card.type !== 'number' && !isWild(card));
        colors.forEach(color => container.classList.remove(`color-${color}`));
        if (card.color) container.classList.add(`color-${card.color}`);
        const cornerTop = document.createElement('span');
        cornerTop.className = 'uno-card-corner is-top';
        cornerTop.textContent = cornerLabel(card);
        const symbol = document.createElement('span');
        symbol.className = `uno-card-symbol type-${card.type}`;
        symbol.setAttribute('aria-hidden', 'true');
        if (isWild(card)) {
            const wheel = document.createElement('span');
            wheel.className = 'uno-wild-wheel';
            colors.forEach(color => {
                const quarter = document.createElement('i');
                quarter.className = `color-${color}`;
                wheel.append(quarter);
            });
            symbol.append(wheel);
            const penalty = card.type === 'wildDraw4' ? '+4'
                : card.type === 'wildDraw6' ? '+6'
                    : card.type === 'wildDraw10' ? '+10'
                        : '';
            if (penalty) {
                const badge = document.createElement('span');
                badge.className = 'uno-wild-penalty';
                badge.textContent = penalty;
                symbol.append(badge);
            }
        } else {
            symbol.textContent = card.type === 'number' ? String(card.value) : actionSymbol(card.type);
        }
        const label = document.createElement('span');
        label.className = 'uno-card-label';
        label.textContent = isWild(card) ? wildLabel() : card.type === 'number' ? '' : actionLabel(card);
        const cornerBottom = document.createElement('span');
        cornerBottom.className = 'uno-card-corner is-bottom';
        cornerBottom.textContent = cornerTop.textContent;
        container.append(cornerTop, symbol);
        if (label.textContent) container.append(label);
        container.append(cornerBottom);
    }

    function isWild(card) {
        return card.type.startsWith('wild');
    }

    function compactLabel(card) {
        if (card.type === 'draw2') return '+2';
        if (card.type === 'wildDraw4') return '+4';
        if (card.type === 'draw6' || card.type === 'wildDraw6') return '+6';
        if (card.type === 'draw10' || card.type === 'wildDraw10') return '+10';
        if (card.type === 'discardAll') return 'ALL';
        if (card.type === 'skipEveryone') return 'SKIP';
        if (card.type === 'wild') return 'W';
        if (card.type === 'reverse') return 'R';
        return 'S';
    }

    function actionSymbol(type) {
        if (type === 'skip') return '⊘';
        if (type === 'reverse') return '⇄';
        if (type === 'draw2') return '+2';
        if (type === 'wildDraw4') return '+4';
        if (type === 'draw6' || type === 'wildDraw6') return '+6';
        if (type === 'draw10' || type === 'wildDraw10') return '+10';
        if (type === 'discardAll') return 'ALL';
        if (type === 'skipEveryone') return 'SKIP';
        return 'WILD';
    }

    function cornerLabel(card) {
        if (card.type === 'number') return String(card.value);
        if (card.type === 'skip') return '⊘';
        if (card.type === 'reverse') return '⇄';
        return compactLabel(card);
    }

    function actionLabel(card) {
        if (card.type === 'skip') return 'Skip';
        if (card.type === 'reverse') return 'Reverse';
        if (card.type === 'draw2') return 'Draw 2';
        if (card.type === 'draw6') return 'Draw 6';
        if (card.type === 'draw10') return 'Draw 10';
        if (card.type === 'discardAll') return 'Discard all';
        if (card.type === 'skipEveryone') return 'Skip all';
        return compactLabel(card);
    }

    function wildLabel() {
        return 'Wild';
    }

    function describeCard(card) {
        const title = card.type === 'number'
            ? String(card.value)
            : card.type === 'skip' ? 'Skip'
                : card.type === 'reverse' ? 'Reverse'
                    : card.type === 'draw2' ? 'Draw two'
                        : card.type === 'wildDraw4' ? 'Wild draw four'
                            : card.type === 'wildDraw6' ? 'Wild draw six'
                                : card.type === 'wildDraw10' ? 'Wild draw ten'
                                    : card.type === 'discardAll' ? 'Discard all'
                                        : card.type === 'skipEveryone' ? 'Skip everyone'
                                            : 'Wild';
        return `${card.color ? `${card.color} ` : ''}${title}`;
    }
})();
