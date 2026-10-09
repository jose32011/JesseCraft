(() => {
    const socket = window.arcadeSocket;
    const gameMenu = document.getElementById('gameMenu');
    const yugiohSetup = document.getElementById('loginScreen');
    const yugiohGame = document.getElementById('gameScreen');
    const ludoScreen = document.getElementById('ludoScreen');
    const snakesLaddersScreen = document.getElementById('snakesLaddersScreen');
    const unoScreen = document.getElementById('unoScreen');
    const setup = document.getElementById('ludoSetup');
    const game = document.getElementById('ludoGame');
    const nameInput = document.getElementById('ludoPlayerName');
    const roomInput = document.getElementById('ludoRoomId');
    const modeInput = document.getElementById('ludoMode');
    const joinButton = document.getElementById('ludoJoinBtn');
    const setupStatus = document.getElementById('ludoSetupStatus');
    const rollButton = document.getElementById('ludoRollBtn');
    const resignButton = document.getElementById('ludoResignBtn');
    const movePrompt = document.getElementById('ludoMovePrompt');
    const board = document.getElementById('ludoBoard');
    const die = document.getElementById('ludoDie');
    const dieFace = document.getElementById('ludoDieFace');
    const tokenKey = 'ludo-player-token';
    const sessionKey = 'ludo-player-session';
    const colors = ['yellow', 'green', 'red', 'blue'];
    const colorValues = {
        yellow: '#f4b52f',
        green: '#34c759',
        red: '#ed4a4a',
        blue: '#367df4'
    };
    const startOffsets = [12, 25, 38, 0];
    const safeSpaces = new Set([0, 8, 12, 21, 25, 34, 38, 47]);
    const track = [
        [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
        [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7],
        [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
        [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
        [7, 0], [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
        [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7],
        [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
        [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14], [7, 13]
    ];
    const homeLanes = [
        [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
        [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
        [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
        [[7, 12], [7, 11], [7, 10], [7, 9], [7, 8], [7, 7]]
    ];
    const baseCells = [
        [[2, 2], [4, 2], [2, 4], [4, 4]],
        [[11, 2], [13, 2], [11, 4], [13, 4]],
        [[11, 11], [13, 11], [11, 13], [13, 13]],
        [[2, 11], [4, 11], [2, 13], [4, 13]]
    ];
    let playerToken = localStorage.getItem(tokenKey);
    let currentRoom = '';
    let gameState = null;
    let previousRoll = null;

    if (!playerToken) {
        if (window.crypto.randomUUID) {
            playerToken = window.crypto.randomUUID();
        } else {
            const bytes = window.crypto.getRandomValues(new Uint8Array(16));
            playerToken = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        }
        localStorage.setItem(tokenKey, playerToken);
    }

    window.showLudoScreen = () => {
        localStorage.setItem('arcade-active-game', 'ludo');
        gameMenu.style.display = 'none';
        yugiohSetup.style.display = 'none';
        yugiohGame.style.display = 'none';
        snakesLaddersScreen.style.display = 'none';
        unoScreen.style.display = 'none';
        ludoScreen.style.display = 'block';
        setup.style.display = 'flex';
    };

    document.getElementById('ludoBackToMenu').addEventListener('click', () => {
        ludoScreen.style.display = 'none';
        gameMenu.style.display = 'flex';
        localStorage.setItem('arcade-active-game', 'menu');
        setupStatus.textContent = '';
    });

    document.getElementById('ludoLeaveBtn').addEventListener('click', () => {
        window.leaveLudoSession();
        game.style.display = 'none';
        setup.style.display = 'block';
        ludoScreen.style.display = 'none';
        gameMenu.style.display = 'flex';
        setupStatus.textContent = '';
    });

    window.leaveLudoSession = (nextGame = 'menu') => {
        if (currentRoom) socket.emit('leaveLudo', { roomId: currentRoom });
        localStorage.removeItem(sessionKey);
        localStorage.setItem('arcade-active-game', nextGame);
        gameState = null;
        currentRoom = '';
    };

    joinButton.addEventListener('click', () => joinRoom(false));
    rollButton.addEventListener('click', () => {
        if (gameState?.canRoll) socket.emit('ludoRoll', { roomId: currentRoom });
    });
    resignButton.addEventListener('click', () => {
        if (!gameState?.started || gameState.gameOver ||
            !window.confirm('Resign this Ludo game? Another player will win.')) return;
        resignButton.disabled = true;
        socket.emit('resignLudo', { roomId: currentRoom });
    });

    board.addEventListener('click', event => {
        const piece = event.target.closest('[data-piece-seat]');
        if (!piece || !gameState) return;
        const seat = Number(piece.dataset.pieceSeat);
        const pieceIndex = Number(piece.dataset.pieceIndex);
        if (seat === gameState.yourSeat && gameState.legalMoves.includes(pieceIndex)) {
            socket.emit('ludoMove', { roomId: currentRoom, pieceIndex });
        }
    });

    board.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const piece = event.target.closest('[data-piece-seat]');
        if (!piece || !gameState) return;
        const seat = Number(piece.dataset.pieceSeat);
        const pieceIndex = Number(piece.dataset.pieceIndex);
        if (seat === gameState.yourSeat && gameState.legalMoves.includes(pieceIndex)) {
            event.preventDefault();
            socket.emit('ludoMove', { roomId: currentRoom, pieceIndex });
        }
    });

    socket.on('connect', () => {
        const activeGame = localStorage.getItem('arcade-active-game');
        if (activeGame && activeGame !== 'ludo') return;
        const saved = localStorage.getItem(sessionKey);
        if (!saved) return;
        try {
            const session = JSON.parse(saved);
            if (typeof session.roomId !== 'string' ||
                typeof session.playerName !== 'string' ||
                typeof session.mode !== 'string') {
                throw new Error('Saved Ludo session is incomplete.');
            }
            nameInput.value = session.playerName;
            roomInput.value = session.roomId;
            modeInput.value = session.mode;
            joinRoom(true);
        } catch (error) {
            console.error('Unable to restore saved Ludo session:', error);
            localStorage.removeItem(sessionKey);
        }
    });

    socket.on('ludoJoined', result => {
        joinButton.disabled = false;
        if (!result.success) {
            setupStatus.textContent = result.message || 'Unable to join this Ludo room.';
            localStorage.removeItem(sessionKey);
            return;
        }
        currentRoom = result.roomId;
        gameMenu.style.display = 'none';
        yugiohSetup.style.display = 'none';
        yugiohGame.style.display = 'none';
        setup.style.display = 'none';
        game.style.display = 'block';
        ludoScreen.style.display = 'block';
        document.getElementById('ludoCurrentRoom').textContent = currentRoom;
        setupStatus.textContent = '';
    });

    socket.on('ludoState', state => {
        gameState = state;
        currentRoom = state.roomId;
        render(state);
    });

    socket.on('ludoError', message => {
        movePrompt.textContent = message;
        resignButton.disabled = false;
    });

    socket.on('ludoSessionReplaced', () => {
        movePrompt.textContent = 'This Ludo session was opened in another tab.';
    });

    function joinRoom(isRestore) {
        const playerName = nameInput.value.trim();
        const roomId = roomInput.value.trim();
        const mode = modeInput.value;
        if (!playerName || !roomId) {
            setupStatus.textContent = 'Enter your name and a room ID to join.';
            return;
        }
        if (!isRestore) {
            localStorage.setItem(sessionKey, JSON.stringify({ roomId, playerName, mode }));
        }
        localStorage.setItem('arcade-active-game', 'ludo');
        currentRoom = roomId;
        setupStatus.textContent = 'Joining room...';
        joinButton.disabled = true;
        socket.emit('joinLudo', { roomId, playerName, mode, playerToken });
    }

    function render(state) {
        document.getElementById('ludoStatus').textContent = state.status;
        document.getElementById('ludoCurrentPlayer').textContent =
            state.currentPlayerName || (state.waiting ? 'Waiting' : '—');
        setDieFace(state.lastRoll);
        rollButton.disabled = !state.canRoll;
        resignButton.hidden = false;
        resignButton.disabled = !state.started || state.gameOver;
        rollButton.textContent = state.canRoll ? 'Roll die' : 'Roll die';
        movePrompt.textContent = state.waiting
            ? state.mode === 'online'
                ? 'Waiting for the second human player.'
                : state.mode === 'online-ai'
                    ? 'Waiting for the second human player. Two AI players will join.'
                    : 'Preparing your game...'
            : state.yourTurn
                ? state.diceValue
                    ? `You rolled ${state.diceValue}. Choose a highlighted piece on the board to move.`
                    : 'Your turn. Roll the die.'
                : `${state.currentPlayerName || 'Opponent'} is playing.`;

        renderPlayers(state);
        renderBoard(state);
    }

    function setDieFace(value) {
        die.setAttribute('aria-label', value ? `Last die roll: ${value}` : 'No die roll yet');
        dieFace.dataset.value = String(value || 0);
        if (!value) return;

        if (value !== previousRoll) {
            die.classList.remove('is-rolling');
            void die.offsetWidth;
            die.classList.add('is-rolling');
            window.setTimeout(() => die.classList.remove('is-rolling'), 720);
            previousRoll = value;
        }
    }

    function renderPlayers(state) {
        const container = document.getElementById('ludoPlayers');
        container.replaceChildren();
        state.players.forEach(player => {
            const card = document.createElement('div');
            card.className = `ludo-player-card color-${player.color}` +
                (player.seat === state.currentSeat ? ' is-current' : '');
            const name = document.createElement('strong');
            name.textContent = player.name + (player.seat === state.yourSeat ? ' (You)' : '');
            const meta = document.createElement('span');
            meta.textContent = player.isAI
                ? 'Computer player'
                : player.connected ? 'Online' : 'Reconnecting';
            card.append(name, meta);
            container.append(card);
        });
    }

    function renderBoard(state) {
        const svg = [`<svg viewBox="0 0 15 15" role="img" aria-label="Ludo board">`];
        svg.push('<defs>');
        Object.entries(colorValues).forEach(([color, baseColor]) => {
            const highlight = color === 'yellow' ? '#fff3ba' : '#ffffff';
            const shadow = color === 'yellow' ? '#9c5e0c' : '#172640';
            svg.push(`<radialGradient id="pawn-${color}" cx="30%" cy="20%" r="85%">`);
            svg.push(`<stop offset="0" stop-color="${highlight}"/><stop offset=".28" stop-color="${baseColor}"/>`);
            svg.push(`<stop offset="1" stop-color="${shadow}"/></radialGradient>`);
            svg.push(`<linearGradient id="base-${color}" x1="0" y1="0" x2="0" y2="1">`);
            svg.push(`<stop offset="0" stop-color="${highlight}"/><stop offset=".45" stop-color="${baseColor}"/>`);
            svg.push(`<stop offset="1" stop-color="${shadow}"/></linearGradient>`);
        });
        svg.push('</defs>');
        svg.push('<rect width="15" height="15" rx=".18" fill="#f5f6f8"/>');
        const bases = [
            { x: 0, y: 0, seat: 0 },
            { x: 9, y: 0, seat: 1 },
            { x: 9, y: 9, seat: 2 },
            { x: 0, y: 9, seat: 3 }
        ];
        bases.forEach(base => {
            const color = colorValues[colors[base.seat]];
            svg.push(`<rect x="${base.x}" y="${base.y}" width="6" height="6" fill="${color}"/>`);
            svg.push(`<rect x="${base.x + 1}" y="${base.y + 1}" width="4" height="4" rx=".35" fill="#fff" opacity=".9"/>`);
        });

        track.forEach(([x, y], index) => {
            svg.push(`<rect class="ludo-track-cell" x="${x}" y="${y}" width="1" height="1"/>`);
            if (safeSpaces.has(index)) {
                svg.push(`<text x="${x + 0.5}" y="${y + 0.72}" text-anchor="middle" class="ludo-safe-star">★</text>`);
            }
        });
        homeLanes.forEach((lane, seat) => {
            lane.forEach(([x, y]) => {
                svg.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${colorValues[colors[seat]]}" stroke="#59606b" stroke-width=".06"/>`);
            });
        });

        const startCells = startOffsets.map(offset => track[offset]);
        startCells.forEach(([x, y], seat) => {
            svg.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${colorValues[colors[seat]]}" stroke="#59606b" stroke-width=".06"/>`);
        });
        svg.push('<polygon points="6,6 9,6 7.5,7.5" fill="#f4b52f"/>');
        svg.push('<polygon points="9,6 9,9 7.5,7.5" fill="#34c759"/>');
        svg.push('<polygon points="9,9 6,9 7.5,7.5" fill="#ed4a4a"/>');
        svg.push('<polygon points="6,9 6,6 7.5,7.5" fill="#367df4"/>');

        const pieces = [];
        state.players.forEach(player => {
            player.pieces.forEach((progress, pieceIndex) => {
                const [x, y] = pieceCoordinates(player.seat, pieceIndex, progress);
                pieces.push({ player, pieceIndex, x, y });
            });
        });
        pieces.forEach(piece => {
            const sameCell = pieces.filter(other => other.x === piece.x && other.y === piece.y);
            const offset = sameCell.length > 1 ? sameCell.indexOf(piece) : 0;
            const offsets = [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]];
            const [dx, dy] = offsets[offset % offsets.length];
            const legal = piece.player.seat === state.yourSeat &&
                state.legalMoves.includes(piece.pieceIndex);
            const color = piece.player.color;
            svg.push(`<g class="ludo-piece${legal ? ' is-legal' : ''}" data-piece-seat="${piece.player.seat}" data-piece-index="${piece.pieceIndex}" tabindex="${legal ? '0' : '-1'}" role="button" aria-label="Move ${color} piece ${piece.pieceIndex + 1}" transform="translate(${piece.x + dx} ${piece.y + dy})">`);
            svg.push('<circle class="ludo-piece-hit-area" r=".4" fill="transparent" pointer-events="all"/>');
            svg.push('<g class="ludo-piece-art" transform="translate(0 .04)">');
            svg.push('<ellipse class="ludo-piece-shadow" cx="0" cy=".18" rx=".34" ry=".13"/>');
            svg.push(`<ellipse cx="0" cy=".16" rx=".33" ry=".15" fill="url(#base-${color})" stroke="#fff" stroke-width=".055"/>`);
            svg.push(`<path d="M-.24 .16 C-.23 .02-.14-.06-.12-.17 A.22.22 0 1 1 .12-.17 C.14-.06.23.02.24.16 Q0 .27-.24.16Z" fill="url(#pawn-${color})" stroke="#fff" stroke-width=".055"/>`);
            svg.push(`<circle cx="-.075" cy="-.255" r=".047" fill="#fff" opacity=".55"/>`);
            svg.push(`<text y=".205" text-anchor="middle" class="ludo-piece-number">${piece.pieceIndex + 1}</text></g></g>`);
        });
        svg.push('</svg>');
        board.innerHTML = svg.join('');
    }

    function pieceCoordinates(seat, pieceIndex, progress) {
        if (progress < 0) return baseCells[seat][pieceIndex];
        const cell = progress <= 51
            ? track[(startOffsets[seat] + progress) % track.length]
            : homeLanes[seat][Math.min(progress - 52, 5)];
        return [cell[0] + 0.5, cell[1] + 0.5];
    }
})();
