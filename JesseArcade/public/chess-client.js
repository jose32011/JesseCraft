(() => {
    const socket = window.arcadeSocket;
    const menu = document.getElementById('gameMenu');
    const yugiohSetup = document.getElementById('loginScreen');
    const yugiohGame = document.getElementById('gameScreen');
    const ludoScreen = document.getElementById('ludoScreen');
    const snakesLaddersScreen = document.getElementById('snakesLaddersScreen');
    const unoScreen = document.getElementById('unoScreen');
    const screen = document.getElementById('chessScreen');
    const setup = document.getElementById('chessSetup');
    const game = document.getElementById('chessGame');
    const board = document.getElementById('chessBoard');
    const nameInput = document.getElementById('chessPlayerName');
    const roomInput = document.getElementById('chessRoomId');
    const joinButton = document.getElementById('chessJoinBtn');
    const setupStatus = document.getElementById('chessSetupStatus');
    const promotionPanel = document.getElementById('chessPromotion');
    const promotionSelect = document.getElementById('chessPromotionPiece');
    const promotionConfirm = document.getElementById('chessPromotionConfirm');
    const resignButton = document.getElementById('chessResignBtn');
    const sessionKey = 'chess-player-session';
    const tokenKey = 'chess-player-token';
    const pieceShapes = {
        p: {
            body: 'M19 50 C24 46 26 42 25 37 C23 34 21 31 21 26 A11 11 0 1 1 43 26 C43 31 41 34 39 37 C38 42 40 46 45 50 Q32 54 19 50 Z',
            detail: '<circle cx="32" cy="25" r="7.3" class="piece-shine"/><path d="M26 38 Q32 41 38 38" class="piece-engrave"/>'
        },
        r: {
            body: 'M16 50 C21 46 23 42 23 37 L25 31 L21 27 L21 14 L28 14 L28 19 L31 19 L31 14 L36 14 L36 19 L39 19 L39 14 L46 14 L46 27 L42 31 L44 37 C44 42 46 46 50 50 Q33 54 16 50 Z',
            detail: '<path d="M24 29 H41 M25 36 H39 M23 45 Q32 48 42 45" class="piece-engrave"/><path d="M27 32 V41 M37 32 V41" class="piece-highlight"/>'
        },
        n: {
            body: 'M15 50 C20 45 20 40 17 35 C14 29 17 24 23 21 L21 13 L30 18 L35 15 C43 19 48 27 46 35 C44 41 46 46 51 50 Q33 54 15 50 Z',
            detail: '<path d="M22 22 C28 23 36 28 40 37 M24 27 Q31 29 36 34" class="piece-highlight"/><circle cx="36" cy="23" r="1.8" class="piece-eye"/><path d="M40 29 L47 31 L41 34" class="piece-engrave"/>'
        },
        b: {
            body: 'M18 50 C23 45 26 41 24 36 C21 31 22 27 27 23 C23 18 25 12 32 8 C39 12 41 18 37 23 C42 27 43 31 40 36 C38 41 41 45 46 50 Q32 54 18 50 Z',
            detail: '<path d="M36 14 L29 23 L35 28 L30 34" class="piece-highlight"/><path d="M26 39 Q32 42 38 39" class="piece-engrave"/>'
        },
        q: {
            body: 'M16 50 C21 46 23 41 21 36 L17 26 L25 32 L23 18 L30 28 L32 12 L35 28 L42 18 L40 32 L48 26 L43 37 C41 42 43 46 48 50 Q32 54 16 50 Z',
            detail: '<circle cx="17" cy="24" r="3.5" class="piece-jewel"/><circle cx="23" cy="16" r="3.5" class="piece-jewel"/><circle cx="32" cy="9" r="3.8" class="piece-jewel"/><circle cx="42" cy="16" r="3.5" class="piece-jewel"/><circle cx="49" cy="24" r="3.5" class="piece-jewel"/><path d="M24 36 Q32 39 40 36 M23 44 Q32 47 41 44" class="piece-engrave"/>'
        },
        k: {
            body: 'M16 50 C21 45 23 40 21 35 L24 30 L27 27 L27 23 L22 23 L22 19 L27 19 L27 14 L31 14 L31 19 L35 19 L35 14 L40 14 L40 19 L45 19 L45 23 L40 23 L40 27 L44 30 L47 35 C45 40 47 45 52 50 Q34 54 16 50 Z',
            detail: '<path d="M32 6 V20 M26 13 H38" class="piece-scepter"/><path d="M24 36 Q32 39 40 36 M23 45 Q33 48 43 45" class="piece-engrave"/>'
        }
    };
    let playerToken = localStorage.getItem(tokenKey);
    let currentRoom = '';
    let gameState = null;
    let selectedSquare = null;
    let pendingPromotion = null;
    let isJoining = false;

    if (!playerToken) {
        if (window.crypto.randomUUID) {
            playerToken = window.crypto.randomUUID();
        } else {
            const bytes = window.crypto.getRandomValues(new Uint8Array(16));
            playerToken = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        }
        localStorage.setItem(tokenKey, playerToken);
    }

    window.showChessScreen = () => {
        localStorage.setItem('arcade-active-game', 'chess');
        hideOtherGames();
        screen.style.display = 'block';
        setup.style.display = 'flex';
        game.style.display = 'none';
    };

    window.leaveChessScreen = (nextGame = 'menu') => {
        if (currentRoom) socket.emit('chessLeave', { roomId: currentRoom });
        localStorage.setItem('arcade-active-game', nextGame);
        gameState = null;
        currentRoom = '';
    };

    document.getElementById('chessBackToMenu').addEventListener('click', () => {
        window.leaveChessScreen('menu');
        screen.style.display = 'none';
        setup.style.display = 'flex';
        game.style.display = 'none';
        menu.style.display = 'flex';
        setupStatus.textContent = '';
    });

    document.getElementById('chessLeaveBtn').addEventListener('click', () => {
        window.leaveChessScreen('menu');
        screen.style.display = 'none';
        game.style.display = 'none';
        setup.style.display = 'flex';
        menu.style.display = 'flex';
    });

    joinButton.addEventListener('click', () => joinRoom(false));
    board.addEventListener('click', event => {
        const squareButton = event.target.closest('[data-square]');
        if (!squareButton || !gameState?.yourTurn || gameState.gameOver) return;
        selectOrMove(squareButton.dataset.square);
    });
    board.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const squareButton = event.target.closest('[data-square]');
        if (!squareButton || !gameState?.yourTurn || gameState.gameOver) return;
        event.preventDefault();
        selectOrMove(squareButton.dataset.square);
    });
    promotionConfirm.addEventListener('click', () => {
        if (!pendingPromotion) return;
        sendMove(pendingPromotion.from, pendingPromotion.to, promotionSelect.value);
        pendingPromotion = null;
        promotionPanel.hidden = true;
    });
    resignButton.addEventListener('click', () => {
        if (!gameState?.started || gameState.gameOver ||
            !window.confirm('Resign this chess game? Your opponent will win.')) return;
        resignButton.disabled = true;
        socket.emit('chessResign', { roomId: currentRoom });
    });

    function hideOtherGames() {
        menu.style.display = 'none';
        yugiohSetup.style.display = 'none';
        yugiohGame.style.display = 'none';
        ludoScreen.style.display = 'none';
        snakesLaddersScreen.style.display = 'none';
        unoScreen.style.display = 'none';
    }

    function restoreSession() {
        if (localStorage.getItem('arcade-active-game') !== 'chess') return;
        const saved = localStorage.getItem(sessionKey);
        if (!saved) {
            window.showChessScreen();
            return;
        }
        try {
            const session = JSON.parse(saved);
            if (typeof session.roomId !== 'string' ||
                typeof session.playerName !== 'string') {
                throw new Error('Saved chess session is incomplete.');
            }
            nameInput.value = session.playerName;
            roomInput.value = session.roomId;
            joinRoom(true);
        } catch (error) {
            console.error('Unable to restore saved chess session:', error);
            localStorage.removeItem(sessionKey);
            window.showChessScreen();
        }
    }

    socket.on('connect', restoreSession);
    if (socket.connected) restoreSession();

    socket.on('chessJoined', result => {
        isJoining = false;
        joinButton.disabled = false;
        if (!result.success) {
            setupStatus.textContent = result.message || 'Unable to join this chess room.';
            return;
        }
        currentRoom = result.roomId;
        hideOtherGames();
        screen.style.display = 'block';
        setup.style.display = 'none';
        game.style.display = 'block';
        document.getElementById('chessCurrentRoom').textContent = currentRoom;
        document.getElementById('chessRoomLabel').textContent = currentRoom;
    });

    socket.on('chessState', state => {
        gameState = state;
        currentRoom = state.roomId;
        selectedSquare = null;
        pendingPromotion = null;
        promotionPanel.hidden = true;
        render(state);
    });

    socket.on('chessError', message => {
        document.getElementById('chessTurnStatus').textContent = message;
        resignButton.disabled = false;
    });

    socket.on('chessSessionReplaced', () => {
        document.getElementById('chessTurnStatus').textContent =
            'This chess session was opened in another tab.';
    });

    function joinRoom(isRestore) {
        if (isJoining) return;
        const playerName = nameInput.value.trim();
        const roomId = roomInput.value.trim();
        if (!playerName || !roomId) {
            setupStatus.textContent = 'Enter your name and a room ID to join.';
            return;
        }
        if (!isRestore) {
            localStorage.setItem(sessionKey, JSON.stringify({ playerName, roomId }));
        }
        localStorage.setItem('arcade-active-game', 'chess');
        currentRoom = roomId;
        isJoining = true;
        joinButton.disabled = true;
        setupStatus.textContent = 'Joining room...';
        socket.emit('joinChess', { roomId, playerName, playerToken });
    }

    function selectOrMove(square) {
        if (!gameState) return;
        const legalMoves = gameState.legalMoves || [];
        const candidates = selectedSquare
            ? legalMoves.filter(move => move.from === selectedSquare && move.to === square)
            : [];
        if (candidates.length) {
            const promotion = candidates.find(move => move.promotion);
            if (promotion) {
                pendingPromotion = { from: selectedSquare, to: square };
                promotionPanel.hidden = false;
                promotionSelect.focus();
                return;
            }
            sendMove(selectedSquare, square);
            selectedSquare = null;
            return;
        }

        const piece = gameState.pieces[square];
        if (piece && piece.color === gameState.color &&
            legalMoves.some(move => move.from === square)) {
            selectedSquare = square;
        } else {
            selectedSquare = null;
        }
        renderBoard(gameState);
    }

    function sendMove(from, to, promotion = 'q') {
        socket.emit('chessMove', { roomId: currentRoom, from, to, promotion });
    }

    function render(state) {
        document.getElementById('chessStatus').textContent = state.status;
        document.getElementById('chessYourColor').textContent =
            state.color === 'w' ? 'White' : 'Black';
        document.getElementById('chessTurnStatus').textContent = state.started
            ? state.gameOver
                ? state.status
                : state.yourTurn
                    ? 'Your move'
                    : `${state.turn === 'w' ? 'White' : 'Black'} to move`
            : 'Waiting for the other player to join';
        resignButton.hidden = false;
        resignButton.disabled = !state.started || state.gameOver;
        renderPlayers(state);
        renderBoard(state);
        renderHistory(state.history || []);
    }

    function renderPlayers(state) {
        const white = state.players.find(player => player.color === 'w');
        const black = state.players.find(player => player.color === 'b');
        document.getElementById('chessOpponent').innerHTML =
            playerMarkup(state.color === 'w' ? black : white, 'opponent');
        document.getElementById('chessYou').innerHTML =
            playerMarkup(state.color === 'w' ? white : black, 'you');
    }

    function playerMarkup(player, relation) {
        if (!player) {
            return `<span class="chess-player-piece ${relation}">${renderPieceModel(relation === 'opponent' ? 'b' : 'w', 'k', relation)}</span><span class="chess-player-name">Waiting for ${relation === 'opponent' ? 'opponent' : 'you'}</span>`;
        }
        const colorName = player.color === 'w' ? 'White' : 'Black';
        return `<span class="chess-player-piece ${player.color === 'w' ? 'white' : 'black'}">${renderPieceModel(player.color, 'k', `player-${player.color}`)}</span>` +
            `<span class="chess-player-name">${escapeHtml(player.name)}${player.color === gameState.color ? ' (You)' : ''}</span>` +
            `<span class="chess-player-color">${colorName}${player.connected ? '' : ' · Reconnecting'}</span>`;
    }

    function renderPieceModel(color, type, instance) {
        const ids = {
            body: `chess-${color}-${type}-${instance}`,
            base: `chess-base-${color}-${type}-${instance}`,
            shadow: `chess-shadow-${color}-${type}-${instance}`,
            clip: `chess-clip-${color}-${type}-${instance}`
        };
        const white = color === 'w';
        const colors = white
            ? { light: '#ff8a98', mid: '#b71938', dark: '#590b20', outline: '#340713', glint: '#ffd3d9' }
            : { light: '#7587a2', mid: '#34455f', dark: '#121c2c', outline: '#0a111d', glint: '#dce8fa' };
        const shape = pieceShapes[type];

        return `<svg class="chess-piece-model" viewBox="0 0 64 64" aria-hidden="true" focusable="false">` +
            `<defs>` +
            `<linearGradient id="${ids.body}" x1="0" y1="0" x2="1" y2=".2">` +
            `<stop offset="0" stop-color="${colors.dark}"/><stop offset=".2" stop-color="${colors.mid}"/>` +
            `<stop offset=".48" stop-color="${colors.light}"/><stop offset=".66" stop-color="${colors.mid}"/>` +
            `<stop offset="1" stop-color="${colors.dark}"/>` +
            `</linearGradient>` +
            `<linearGradient id="${ids.base}" x1="0" y1="0" x2="0" y2="1">` +
            `<stop offset="0" stop-color="${colors.light}"/><stop offset=".16" stop-color="${colors.mid}"/>` +
            `<stop offset=".28" stop-color="${colors.dark}"/><stop offset=".45" stop-color="${colors.mid}"/>` +
            `<stop offset=".68" stop-color="${colors.dark}"/><stop offset=".84" stop-color="${colors.mid}"/>` +
            `<stop offset="1" stop-color="${colors.dark}"/>` +
            `</linearGradient>` +
            `<radialGradient id="${ids.shadow}"><stop offset="0" stop-color="#000" stop-opacity=".46"/>` +
            `<stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>` +
            `<linearGradient id="${ids.clip}" x1="0" y1="0" x2="1" y2="0">` +
            `<stop offset="0" stop-color="${colors.glint}" stop-opacity="0"/>` +
            `<stop offset=".28" stop-color="${colors.glint}" stop-opacity=".68"/>` +
            `<stop offset=".52" stop-color="${colors.glint}" stop-opacity=".08"/>` +
            `<stop offset="1" stop-color="${colors.dark}" stop-opacity=".35"/>` +
            `</linearGradient>` +
            `<clipPath id="clip-${ids.body}"><path d="${shape.body}"/></clipPath>` +
            `</defs>` +
            `<ellipse cx="33" cy="59" rx="24" ry="4.5" fill="url(#${ids.shadow})"/>` +
            `<path d="M8 51 Q8 48 13 47 H51 Q56 48 56 51 L53 56 Q32 61 11 56 Z" fill="url(#${ids.base})" stroke="${colors.outline}" stroke-width="1.5"/>` +
            `<path d="M11 50 Q32 46 53 50" fill="none" stroke="${colors.glint}" stroke-width="1.4" opacity=".78"/>` +
            `<ellipse cx="32" cy="47.5" rx="19.5" ry="4" fill="${colors.dark}" stroke="${colors.outline}" stroke-width="1.2"/>` +
            `<ellipse cx="32" cy="46.4" rx="18.6" ry="3.1" fill="url(#${ids.base})" stroke="${colors.glint}" stroke-width=".7"/>` +
            `<path d="M13 46 Q32 41 51 46 L48 50 Q32 53 16 50 Z" fill="url(#${ids.body})" stroke="${colors.outline}" stroke-width="1.1"/>` +
            `<path d="${shape.body}" transform="translate(1.8 1.8)" fill="${colors.dark}" stroke="${colors.outline}" stroke-width="2" stroke-linejoin="round"/>` +
            `<path d="${shape.body}" fill="url(#${ids.body})" stroke="${colors.outline}" stroke-width="1.8" stroke-linejoin="round"/>` +
            `<path d="${shape.body}" fill="url(#${ids.clip})" clip-path="url(#clip-${ids.body})" opacity=".72"/>` +
            `<path d="M22 48 C26 41 25 35 23 31" fill="none" stroke="${colors.glint}" stroke-width="1.3" opacity=".85" stroke-linecap="round"/>` +
            `<g>${shape.detail}</g>` +
            `<style>` +
            `.piece-highlight,.piece-scepter{fill:none;stroke:${colors.glint};stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round;opacity:.92}` +
            `.piece-engrave{fill:none;stroke:${colors.outline};stroke-width:1.3;opacity:.8}` +
            `.piece-jewel{fill:url(#${ids.base});stroke:${colors.glint};stroke-width:1}` +
            `.piece-eye{fill:${white ? '#533d29' : '#e3c987'}}` +
            `.piece-shine{fill:url(#${ids.body});stroke:${colors.glint};stroke-width:1.2}` +
            `</style></svg>`;
    }

    function renderBoard(state) {
        const boardPosition = state.color === 'w'
            ? Array.from({ length: 8 }, (_, row) =>
                Array.from({ length: 8 }, (_, col) => `${String.fromCharCode(97 + col)}${8 - row}`))
            : Array.from({ length: 8 }, (_, row) =>
                Array.from({ length: 8 }, (_, col) => `${String.fromCharCode(104 - col)}${row + 1}`));
        const legalFrom = state.yourTurn
            ? (state.legalMoves || []).filter(move => move.from === selectedSquare)
            : [];
        const legalTargets = new Set(legalFrom.map(move => move.to));
        const canSelectPieces = state.yourTurn && !state.gameOver;
        const cells = [];

        boardPosition.forEach((rank, row) => {
            rank.forEach((square, col) => {
                const piece = state.pieces[square];
                const isLight = (row + col) % 2 === 0;
                const isSelected = selectedSquare === square;
                const classes = [
                    'chess-square',
                    isLight ? 'is-light' : 'is-dark',
                    isSelected ? 'is-selected' : '',
                    legalTargets.has(square) ? 'is-legal-target' : '',
                    state.lastMove && (state.lastMove.from === square || state.lastMove.to === square)
                        ? 'is-last-move'
                        : '',
                    state.checkedKingSquare === square ? 'is-check' : ''
                ].filter(Boolean).join(' ');
                const pieceClass = piece ? (piece.color === 'w' ? 'piece-white' : 'piece-black') : '';
                const isSelectable = canSelectPieces && piece?.color === state.color;
                cells.push(
                    `<button class="${classes}" type="button" data-square="${square}" ` +
                    `aria-label="${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}" ` +
                    `aria-pressed="${isSelected}" ${isSelectable || legalTargets.has(square) ? '' : 'tabindex="-1"'}>` +
                    `${piece ? `<span class="chess-piece ${pieceClass}" aria-hidden="true">${renderPieceModel(piece.color, piece.type, square)}</span>` : ''}` +
                    `${col === 0 ? `<span class="chess-rank-label">${square[1]}</span>` : ''}` +
                    `${row === 7 ? `<span class="chess-file-label">${square[0]}</span>` : ''}` +
                    `${legalTargets.has(square) && !piece ? '<span class="chess-legal-dot" aria-hidden="true"></span>' : ''}` +
                    `${legalTargets.has(square) && piece ? '<span class="chess-capture-ring" aria-hidden="true"></span>' : ''}` +
                    `</button>`
                );
            });
        });
        board.innerHTML = cells.join('');
        board.setAttribute('aria-label',
            `${state.color === 'w' ? 'White' : 'Black'} perspective chessboard`);
    }

    function renderHistory(history) {
        const container = document.getElementById('chessMoveHistory');
        const rows = [];
        for (let index = 0; index < history.length; index += 2) {
            const white = history[index];
            const black = history[index + 1];
            rows.push(`<li><span>${Math.floor(index / 2) + 1}.</span><strong>${escapeHtml(white)}</strong>` +
                `${black ? `<strong>${escapeHtml(black)}</strong>` : ''}</li>`);
        }
        container.innerHTML = rows.reverse().join('');
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }
})();
