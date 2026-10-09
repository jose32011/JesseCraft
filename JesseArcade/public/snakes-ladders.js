(() => {
    const socket = window.arcadeSocket;
    const menu = document.getElementById('gameMenu');
    const yugiohSetup = document.getElementById('loginScreen');
    const yugiohGame = document.getElementById('gameScreen');
    const ludoScreen = document.getElementById('ludoScreen');
    const chessScreen = document.getElementById('chessScreen');
    const unoScreen = document.getElementById('unoScreen');
    const screen = document.getElementById('snakesLaddersScreen');
    const setup = document.getElementById('snakesLaddersSetup');
    const game = document.getElementById('snakesLaddersGame');
    const nameInput = document.getElementById('snakesLaddersPlayerName');
    const roomInput = document.getElementById('snakesLaddersRoomId');
    const playerCountInput = document.getElementById('snakesLaddersPlayerCount');
    const joinButton = document.getElementById('snakesLaddersJoinBtn');
    const setupStatus = document.getElementById('snakesLaddersSetupStatus');
    const board = document.getElementById('snakesLaddersBoard');
    const rollButton = document.getElementById('snakesLaddersRollBtn');
    const resignButton = document.getElementById('snakesLaddersResignBtn');
    const turnStatus = document.getElementById('snakesLaddersTurnStatus');
    const die = document.getElementById('snakesLaddersDie');
    const tokenKey = 'snakes-ladders-player-token';
    const sessionKey = 'snakes-ladders-player-session';
    const ladders = new Map([
        [2, 38], [7, 14], [8, 31], [15, 26], [21, 42],
        [28, 84], [36, 44], [51, 67], [71, 91], [80, 100]
    ]);
    const snakes = new Map([
        [16, 6], [47, 26], [49, 11], [56, 53], [62, 19],
        [64, 60], [87, 24], [93, 73], [95, 75], [99, 78]
    ]);
    const colors = { red: '#f1484d', blue: '#2979e8', green: '#38ad63', yellow: '#ffc928' };
    let playerToken = localStorage.getItem(tokenKey);
    let currentRoom = '';
    let gameState = null;
    let isJoining = false;

    if (!playerToken) {
        playerToken = window.crypto.randomUUID
            ? window.crypto.randomUUID()
            : Array.from(window.crypto.getRandomValues(new Uint8Array(16)),
                byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(tokenKey, playerToken);
    }

    window.showSnakesLaddersScreen = () => {
        localStorage.setItem('arcade-active-game', 'snakes-ladders');
        hideOtherGames();
        screen.style.display = 'block';
        setup.style.display = 'flex';
        game.style.display = 'none';
    };

    window.leaveSnakesLaddersSession = (nextGame = 'menu') => {
        if (currentRoom) socket.emit('leaveSnakesLadders', { roomId: currentRoom });
        localStorage.removeItem(sessionKey);
        localStorage.setItem('arcade-active-game', nextGame);
        currentRoom = '';
        gameState = null;
    };

    document.getElementById('snakesLaddersBackToMenu').addEventListener('click', () => {
        localStorage.setItem('arcade-active-game', 'menu');
        screen.style.display = 'none';
        menu.style.display = 'flex';
        setupStatus.textContent = '';
    });

    document.getElementById('snakesLaddersLeaveBtn').addEventListener('click', () => {
        window.leaveSnakesLaddersSession('menu');
        game.style.display = 'none';
        setup.style.display = 'flex';
        screen.style.display = 'none';
        menu.style.display = 'flex';
        setupStatus.textContent = '';
    });

    joinButton.addEventListener('click', () => joinRoom(false));
    rollButton.addEventListener('click', () => {
        if (gameState?.canRoll) {
            socket.emit('snakesLaddersRoll', { roomId: currentRoom });
        }
    });
    resignButton.addEventListener('click', () => {
        if (!gameState?.started || gameState.gameOver ||
            !window.confirm('Resign this game? Your opponent will win.')) return;
        resignButton.disabled = true;
        socket.emit('snakesLaddersResign', { roomId: currentRoom });
    });

    function hideOtherGames() {
        menu.style.display = 'none';
        yugiohSetup.style.display = 'none';
        yugiohGame.style.display = 'none';
        ludoScreen.style.display = 'none';
        chessScreen.style.display = 'none';
        unoScreen.style.display = 'none';
    }

    function joinRoom(isRestore) {
        if (isJoining) return;
        const playerName = nameInput.value.trim();
        const roomId = roomInput.value.trim();
        if (!playerName || !roomId) {
            setupStatus.textContent = 'Enter your name and a room ID to join.';
            return;
        }
        currentRoom = roomId;
        if (!isRestore) {
            localStorage.setItem(sessionKey, JSON.stringify({
                playerName,
                roomId,
                playerCount: Number(playerCountInput.value)
            }));
        }
        localStorage.setItem('arcade-active-game', 'snakes-ladders');
        setupStatus.textContent = 'Joining room...';
        joinButton.disabled = true;
        isJoining = true;
        socket.emit('joinSnakesLadders', {
            playerName,
            roomId,
            playerToken,
            playerCount: Number(playerCountInput.value)
        });
    }

    function restoreSession() {
        if (localStorage.getItem('arcade-active-game') !== 'snakes-ladders') return;
        const saved = localStorage.getItem(sessionKey);
        if (!saved) {
            window.showSnakesLaddersScreen();
            return;
        }
        try {
            const session = JSON.parse(saved);
            if (typeof session.playerName !== 'string' ||
                typeof session.roomId !== 'string' ||
                !Number.isInteger(session.playerCount) ||
                session.playerCount < 2 || session.playerCount > 4) {
                throw new Error('Saved Snakes and Ladders session is incomplete.');
            }
            nameInput.value = session.playerName;
            roomInput.value = session.roomId;
            playerCountInput.value = String(session.playerCount);
            joinRoom(true);
        } catch (error) {
            console.error('Unable to restore Snakes and Ladders session:', error);
            localStorage.removeItem(sessionKey);
            window.showSnakesLaddersScreen();
        }
    }

    socket.on('connect', restoreSession);
    if (socket.connected) restoreSession();

    socket.on('snakesLaddersJoined', result => {
        isJoining = false;
        joinButton.disabled = false;
        if (!result.success) {
            setupStatus.textContent = result.message || 'Unable to join this room.';
            localStorage.removeItem(sessionKey);
            return;
        }
        currentRoom = result.roomId;
        document.getElementById('snakesLaddersCurrentRoom').textContent = currentRoom;
        hideOtherGames();
        screen.style.display = 'block';
        setup.style.display = 'none';
        game.style.display = 'block';
        setupStatus.textContent = '';
    });

    socket.on('snakesLaddersState', state => {
        gameState = state;
        currentRoom = state.roomId;
        render(state);
    });

    socket.on('snakesLaddersError', message => {
        turnStatus.textContent = message;
        resignButton.disabled = Boolean(gameState?.gameOver);
    });

    socket.on('snakesLaddersSessionReplaced', () => {
        turnStatus.textContent = 'This game session was opened in another tab.';
    });

    function render(state) {
        document.getElementById('snakesLaddersStatus').textContent = state.status;
        turnStatus.textContent = state.gameOver
            ? state.status
            : state.started
                ? state.yourTurn ? 'Your turn: roll the die.' : `${state.currentPlayerName} is playing.`
                : `Waiting for ${state.expectedPlayers - state.players.length} more player${state.expectedPlayers - state.players.length === 1 ? '' : 's'}.`;
        rollButton.disabled = !state.canRoll;
        resignButton.disabled = !state.started || state.gameOver;
        die.textContent = state.lastRoll || '—';
        die.setAttribute('aria-label', state.lastRoll
            ? `Last die roll: ${state.lastRoll}`
            : 'No die roll yet');
        renderPlayers(state);
        renderBoard(state);
    }

    function renderPlayers(state) {
        const container = document.getElementById('snakesLaddersPlayers');
        container.replaceChildren();
        state.players.forEach(player => {
            const card = document.createElement('div');
            card.className = `sl-player-card${player.name === state.currentPlayerName && !state.gameOver ? ' is-current' : ''}`;
            const marker = document.createElement('span');
            marker.className = `sl-player-marker color-${player.color}`;
            marker.textContent = player.position;
            marker.setAttribute('aria-hidden', 'true');
            const details = document.createElement('div');
            const name = document.createElement('strong');
            name.textContent = player.name + (player.color === state.yourColor ? ' (You)' : '');
            const position = document.createElement('span');
            position.textContent = `${player.position}% · ${player.connected ? 'Online' : 'Reconnecting'}`;
            details.append(name, position);
            card.append(marker, details);
            container.append(card);
        });
    }

    function renderBoard(state) {
        const positions = new Map();
        state.players.forEach(player => {
            if (player.position > 0) {
                const tokens = positions.get(player.position) || [];
                tokens.push(player);
                positions.set(player.position, tokens);
            }
        });
        const cells = [];
        for (let displayRow = 0; displayRow < 10; displayRow += 1) {
            const rowFromBottom = 9 - displayRow;
            for (let column = 0; column < 10; column += 1) {
                const offset = rowFromBottom % 2 === 0 ? column : 9 - column;
                const number = rowFromBottom * 10 + offset + 1;
                const cell = document.createElement('div');
                cell.className = 'sl-cell';
                cell.setAttribute('role', 'gridcell');
                cell.setAttribute('aria-label', `Square ${number}`);
                if (number === 1 || number === 100) cell.classList.add('is-endpoint');
                const label = document.createElement('span');
                label.className = 'sl-cell-number';
                label.textContent = String(number);
                cell.append(label);
                (positions.get(number) || []).forEach(player => {
                    const token = document.createElement('span');
                    token.className = `sl-token color-${player.color}`;
                    token.textContent = player.color[0].toUpperCase();
                    token.setAttribute('aria-label', player.name);
                    cell.append(token);
                });
                cells.push(cell);
            }
        }
        const routes = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        routes.classList.add('sl-routes');
        routes.setAttribute('viewBox', '0 0 10 10');
        routes.setAttribute('aria-hidden', 'true');
        ladders.forEach((end, start) => drawLadder(routes, start, end));
        snakes.forEach((end, start) => drawSnake(routes, start, end));
        board.replaceChildren(...cells, routes);
    }

    function squareCenter(number) {
        const row = Math.floor((number - 1) / 10);
        const offset = (number - 1) % 10;
        const column = row % 2 === 0 ? offset : 9 - offset;
        return { x: column + 0.5, y: 9 - row + 0.5 };
    }

    function svgPath(routes, className, path) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        element.setAttribute('class', className);
        element.setAttribute('d', path);
        routes.append(element);
        return element;
    }

    function drawLadder(routes, startNumber, endNumber) {
        const start = squareCenter(startNumber);
        const end = squareCenter(endNumber);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        const offsetX = -dy / length * 0.13;
        const offsetY = dx / length * 0.13;
        const startX = start.x - offsetX;
        const startY = start.y - offsetY;
        const endX = end.x - offsetX;
        const endY = end.y - offsetY;
        const otherStartX = start.x + offsetX;
        const otherStartY = start.y + offsetY;
        const otherEndX = end.x + offsetX;
        const otherEndY = end.y + offsetY;
        svgPath(routes, 'sl-ladder-rail', `M${startX},${startY} L${endX},${endY}`);
        svgPath(routes, 'sl-ladder-rail', `M${otherStartX},${otherStartY} L${otherEndX},${otherEndY}`);
        for (let rung = 1; rung <= 5; rung += 1) {
            const progress = rung / 6;
            const x = start.x + dx * progress;
            const y = start.y + dy * progress;
            svgPath(routes, 'sl-ladder-rung',
                `M${x - offsetX},${y - offsetY} L${x + offsetX},${y + offsetY}`);
        }
    }

    function drawSnake(routes, headNumber, tailNumber) {
        const head = squareCenter(headNumber);
        const tail = squareCenter(tailNumber);
        const dx = tail.x - head.x;
        const dy = tail.y - head.y;
        const length = Math.hypot(dx, dy);
        const curveX = -dy / length * 0.3;
        const curveY = dx / length * 0.3;
        const path = `M${head.x},${head.y} C${head.x + dx * 0.25 + curveX},${head.y + dy * 0.25 + curveY} ${head.x + dx * 0.75 - curveX},${head.y + dy * 0.75 - curveY} ${tail.x},${tail.y}`;
        svgPath(routes, 'sl-snake-shadow', path);
        svgPath(routes, 'sl-snake-body', path);
        const headElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        headElement.setAttribute('class', 'sl-snake-head');
        headElement.setAttribute('cx', String(head.x));
        headElement.setAttribute('cy', String(head.y));
        headElement.setAttribute('r', '.16');
        routes.append(headElement);
    }
})();
