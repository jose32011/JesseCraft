(() => {
    const socket = window.arcadeSocket;
    const menu = document.getElementById('gameMenu');
    const screen = document.getElementById('rtsScreen');
    const setup = document.getElementById('rtsSetup');
    const game = document.getElementById('rtsGame');
    const nameInput = document.getElementById('rtsPlayerName');
    const roomInput = document.getElementById('rtsRoomId');
    const joinButton = document.getElementById('rtsJoinBtn');
    const setupStatus = document.getElementById('rtsSetupStatus');
    const board = document.getElementById('rtsBoard');
    const context = board.getContext('2d');
    const actionButtons = [...document.querySelectorAll('[data-rts-action]')];
    const tokenKey = 'rts-player-token';
    const sessionKey = 'rts-player-session';
    let playerToken = sessionStorage.getItem(tokenKey);
    let currentRoom = '';
    let gameState = null;
    let joining = false;
    let selectedUnits = new Set();

    if (!playerToken) {
        playerToken = window.crypto.randomUUID();
        sessionStorage.setItem(tokenKey, playerToken);
    }

    window.showRtsScreen = () => {
        localStorage.setItem('arcade-active-game', 'rts');
        hideOtherGames();
        menu.style.display = 'none';
        screen.style.display = 'block';
        setup.style.display = 'block';
        game.style.display = 'none';
    };

    window.leaveRtsSession = (nextGame = 'menu') => {
        if (currentRoom) socket.emit('leaveRts', { roomId: currentRoom });
        currentRoom = '';
        gameState = null;
        selectedUnits.clear();
        sessionStorage.removeItem(sessionKey);
        screen.style.display = 'none';
        localStorage.setItem('arcade-active-game', nextGame);
    };

    document.getElementById('rtsBackToMenu').addEventListener('click', () => {
        window.leaveRtsSession('menu');
        menu.style.display = 'flex';
        setupStatus.textContent = '';
    });
    document.getElementById('rtsLeaveBtn').addEventListener('click', () => {
        window.leaveRtsSession('menu');
        menu.style.display = 'flex';
        setup.style.display = 'block';
        game.style.display = 'none';
    });
    joinButton.addEventListener('click', () => joinRoom(false));
    actionButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (!currentRoom || !gameState?.started || gameState.gameOver) return;
            socket.emit('rtsAction', { roomId: currentRoom, type: button.dataset.rtsAction });
        });
    });
    document.getElementById('rtsResignBtn').addEventListener('click', () => {
        if (!gameState?.started || gameState.gameOver ||
            !window.confirm('Resign this Frontier Realms battle? Your rival will win.')) return;
        socket.emit('rtsResign', { roomId: currentRoom });
    });
    board.addEventListener('pointerdown', issueMapCommand);

    function hideOtherGames() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('ludoScreen').style.display = 'none';
        document.getElementById('chessScreen').style.display = 'none';
        document.getElementById('snakesLaddersScreen').style.display = 'none';
        document.getElementById('unoScreen').style.display = 'none';
        document.getElementById('pacmanScreen').style.display = 'none';
        document.getElementById('angryBirdsScreen').style.display = 'none';
    }

    function joinRoom(isRestore) {
        if (joining) return;
        const playerName = nameInput.value.trim();
        const roomId = roomInput.value.trim();
        if (!playerName || !roomId) {
            setupStatus.textContent = 'Enter your name and a room ID.';
            return;
        }
        joining = true;
        currentRoom = roomId;
        sessionStorage.setItem(sessionKey, JSON.stringify({ playerName, roomId }));
        joinButton.disabled = true;
        setupStatus.textContent = isRestore ? 'Rejoining your room...' : 'Joining room...';
        socket.emit('joinRts', { roomId, playerName, playerToken });
    }

    function restoreSession() {
        if (localStorage.getItem('arcade-active-game') !== 'rts') return;
        const saved = sessionStorage.getItem(sessionKey);
        if (!saved) {
            window.showRtsScreen();
            return;
        }
        try {
            const session = JSON.parse(saved);
            if (typeof session.playerName !== 'string' || typeof session.roomId !== 'string') {
                throw new Error('Saved Frontier Realms session is incomplete.');
            }
            nameInput.value = session.playerName;
            roomInput.value = session.roomId;
            window.showRtsScreen();
            joinRoom(true);
        } catch (error) {
            console.error('Unable to restore Frontier Realms session:', error);
            sessionStorage.removeItem(sessionKey);
        }
    }

    socket.on('connect', restoreSession);
    socket.on('rtsJoined', result => {
        joining = false;
        joinButton.disabled = false;
        if (!result.success) {
            setupStatus.textContent = result.message || 'Unable to join this strategy room.';
            sessionStorage.removeItem(sessionKey);
            return;
        }
        currentRoom = result.roomId;
        menu.style.display = 'none';
        screen.style.display = 'block';
        setup.style.display = 'none';
        game.style.display = 'block';
        document.getElementById('rtsCurrentRoom').textContent = currentRoom;
        setupStatus.textContent = '';
        resizeBoard();
    });
    socket.on('rtsState', state => {
        gameState = state;
        currentRoom = state.roomId;
        selectedUnits = new Set([...selectedUnits].filter(id =>
            state.units.some(unit => unit.id === id && unit.owner === state.yourSeat)
        ));
        renderState();
    });
    socket.on('rtsError', message => {
        document.getElementById('rtsTurnStatus').textContent = message;
    });
    socket.on('rtsSessionReplaced', () => {
        document.getElementById('rtsTurnStatus').textContent =
            'This strategy session was opened in another tab.';
    });
    window.addEventListener('resize', resizeBoard);

    function resizeBoard() {
        const bounds = board.getBoundingClientRect();
        if (!bounds.width) return;
        const ratio = window.devicePixelRatio || 1;
        board.width = Math.round(bounds.width * ratio);
        board.height = Math.round(bounds.width * 0.6 * ratio);
        context.setTransform(board.width / 1200, 0, 0, board.height / 720, 0, 0);
        draw();
    }

    function issueMapCommand(event) {
        if (!gameState?.started || gameState.gameOver) return;
        const bounds = board.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width * 1200;
        const y = (event.clientY - bounds.top) / bounds.height * 720;
        const ownUnit = gameState.units
            .filter(unit => unit.owner === gameState.yourSeat)
            .find(unit => Math.hypot(unit.x - x, unit.y - y) < 27);
        if (ownUnit) {
            if (!event.shiftKey) selectedUnits.clear();
            selectedUnits.add(ownUnit.id);
            draw();
            return;
        }
        const enemy = [
            ...gameState.units.filter(unit => unit.owner !== gameState.yourSeat),
            ...gameState.buildings.filter(building => building.owner !== gameState.yourSeat)
        ].find(entity => Math.hypot(entity.x - x, entity.y - y) <
            (entity.type === 'townCenter' ? 48 : entity.type === 'watchtower' ? 32 : 24));
        const node = gameState.resourceNodes.find(item => Math.hypot(item.x - x, item.y - y) < 36);
        if (!selectedUnits.size) return;
        const target = enemy
            ? { kind: 'attack', targetId: enemy.id }
            : node
                ? { kind: 'gather', nodeId: node.id }
                : { kind: 'move', x, y };
        socket.emit('rtsCommand', {
            roomId: currentRoom,
            unitIds: [...selectedUnits],
            target
        });
    }

    function renderState() {
        const player = gameState.players.find(item => item.seat === gameState.yourSeat);
        const rival = gameState.players.find(item => item.seat !== gameState.yourSeat);
        document.getElementById('rtsFaction').textContent = player?.faction ?? '';
        document.getElementById('rtsStatus').textContent = gameState.status;
        const stock = gameState.resources[gameState.yourSeat] ?? { wood: 0, gold: 0 };
        document.getElementById('rtsResources').textContent =
            `Wood ${stock.wood} · Gold ${stock.gold} · Rival ${rival?.name ?? 'waiting'}`;
        const actionsEnabled = gameState.started && !gameState.gameOver;
        actionButtons.forEach(button => {
            button.disabled = !actionsEnabled;
        });
        document.getElementById('rtsResignBtn').disabled = !actionsEnabled;
        const turnStatus = !gameState.started
            ? 'Waiting for one more commander to join this room.'
            : gameState.gameOver
                ? gameState.winner === null
                    ? 'The battle ended in a draw.'
                    : gameState.winner === gameState.yourSeat ? 'You win!' : 'Your rival wins.'
                : 'Select your units, then click a resource, enemy, or map position to issue an order.';
        document.getElementById('rtsTurnStatus').textContent = turnStatus;
        draw();
    }

    function draw() {
        if (!board.width || !board.height) return;
        context.clearRect(0, 0, 1200, 720);
        context.fillStyle = '#9eb779';
        context.fillRect(0, 0, 1200, 720);

        context.fillStyle = 'rgba(234, 224, 185, 0.42)';
        context.fillRect(560, 0, 80, 720);
        context.fillRect(0, 320, 1200, 80);
        context.strokeStyle = 'rgba(75, 105, 65, 0.22)';
        context.lineWidth = 1;
        for (let x = 0; x <= 1200; x += 48) {
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, 720);
            context.stroke();
        }
        for (let y = 0; y <= 720; y += 48) {
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(1200, y);
            context.stroke();
        }

        (gameState?.resourceNodes ?? []).forEach(node => {
            context.fillStyle = node.type === 'wood' ? '#245c38' : '#8e7960';
            context.beginPath();
            context.arc(node.x, node.y, 27, 0, Math.PI * 2);
            context.fill();
            context.fillStyle = node.type === 'wood' ? '#98b951' : '#e0c17d';
            context.font = 'bold 13px system-ui';
            context.textAlign = 'center';
            context.fillText(node.type === 'wood' ? 'WOOD' : 'GOLD', node.x, node.y + 4);
        });

        (gameState?.buildings ?? []).forEach(building => {
            const color = building.owner === gameState.yourSeat ? '#426c91' : '#9f4d44';
            context.fillStyle = color;
            context.strokeStyle = '#282c28';
            context.lineWidth = 3;
            if (building.type === 'townCenter') {
                context.fillRect(building.x - 30, building.y - 26, 60, 52);
                context.strokeRect(building.x - 30, building.y - 26, 60, 52);
            } else {
                context.beginPath();
                context.moveTo(building.x, building.y - 21);
                context.lineTo(building.x + 19, building.y + 15);
                context.lineTo(building.x - 19, building.y + 15);
                context.closePath();
                context.fill();
                context.stroke();
            }
            drawHealthBar(building.x, building.y - 37, 60, building.hp, building.maxHp);
            context.fillStyle = '#fff';
            context.font = '12px system-ui';
            context.textAlign = 'center';
            context.fillText(building.type === 'townCenter' ? 'HALL' : 'TOWER', building.x, building.y + 43);
        });

        (gameState?.units ?? []).forEach(unit => {
            const color = unit.owner === gameState.yourSeat ? '#397fc0' : '#d55549';
            context.fillStyle = color;
            context.strokeStyle = selectedUnits.has(unit.id) ? '#ffe884' : '#20252a';
            context.lineWidth = selectedUnits.has(unit.id) ? 4 : 2;
            context.beginPath();
            context.arc(unit.x, unit.y, unit.type === 'spearman' ? 15 : 12, 0, Math.PI * 2);
            context.fill();
            context.stroke();
            context.fillStyle = '#fff';
            context.font = 'bold 12px system-ui';
            context.textAlign = 'center';
            context.fillText(unit.type === 'villager' ? 'V' : unit.type === 'archer' ? 'A' : 'S', unit.x, unit.y + 4);
            drawHealthBar(unit.x, unit.y - 21, 30, unit.hp, unit.maxHp);
        });
    }

    function drawHealthBar(x, y, width, hp, maxHp) {
        context.fillStyle = '#332d2a';
        context.fillRect(x - width / 2, y, width, 5);
        context.fillStyle = hp / maxHp > 0.45 ? '#8ed46d' : '#e4775c';
        context.fillRect(x - width / 2, y, width * Math.max(0, hp / maxHp), 5);
    }

    socket.on('connect', restoreSession);
})();
