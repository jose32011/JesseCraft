(() => {
    const socket = window.arcadeSocket;
    const menu = document.getElementById('gameMenu');
    const screen = document.getElementById('pacmanScreen');
    const setup = document.getElementById('pacmanSetup');
    const game = document.getElementById('pacmanGame');
    const nameInput = document.getElementById('pacmanPlayerName');
    const roomInput = document.getElementById('pacmanRoomId');
    const roleInput = document.getElementById('pacmanRole');
    const joinButton = document.getElementById('pacmanJoinBtn');
    const setupStatus = document.getElementById('pacmanSetupStatus');
    const board = document.getElementById('pacmanBoard');
    const context = board.getContext('2d');
    const tokenKey = 'pacman-player-token';
    const sessionKey = 'pacman-player-session';
    let playerToken = localStorage.getItem(tokenKey);
    let currentRoom = '';
    let gameState = null;
    let joining = false;

    if (!playerToken) {
        playerToken = window.crypto.randomUUID
            ? window.crypto.randomUUID()
            : Array.from(window.crypto.getRandomValues(new Uint8Array(16)),
                byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(tokenKey, playerToken);
    }

    window.showPacmanScreen = () => {
        localStorage.setItem('arcade-active-game', 'pacman');
        hideOtherGames();
        menu.style.display = 'none';
        screen.style.display = 'block';
        setup.style.display = 'block';
        game.style.display = 'none';
    };

    window.leavePacmanSession = (nextGame = 'menu') => {
        if (currentRoom) socket.emit('leavePacman', { roomId: currentRoom });
        currentRoom = '';
        gameState = null;
        localStorage.removeItem(sessionKey);
        localStorage.setItem('arcade-active-game', nextGame);
    };

    document.getElementById('pacmanBackToMenu').addEventListener('click', () => {
        window.leavePacmanSession('menu');
        screen.style.display = 'none';
        menu.style.display = 'flex';
        setupStatus.textContent = '';
    });
    document.getElementById('pacmanLeaveBtn').addEventListener('click', () => {
        window.leavePacmanSession('menu');
        screen.style.display = 'none';
        menu.style.display = 'flex';
        setup.style.display = 'block';
        game.style.display = 'none';
    });
    joinButton.addEventListener('click', () => joinRoom(false));

    function hideOtherGames() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('ludoScreen').style.display = 'none';
        document.getElementById('chessScreen').style.display = 'none';
        document.getElementById('snakesLaddersScreen').style.display = 'none';
        document.getElementById('unoScreen').style.display = 'none';
        document.getElementById('angryBirdsScreen').style.display = 'none';
        document.getElementById('rtsScreen').style.display = 'none';
    }

    function joinRoom(isRestore) {
        if (joining) return;
        const playerName = nameInput.value.trim();
        const roomId = roomInput.value.trim();
        const role = roleInput.value;
        if (!playerName || !roomId) {
            setupStatus.textContent = 'Enter your name and a room ID.';
            return;
        }
        currentRoom = roomId;
        joining = true;
        localStorage.setItem(sessionKey, JSON.stringify({ playerName, roomId, role }));
        joinButton.disabled = true;
        setupStatus.textContent = isRestore ? 'Rejoining your room...' : 'Joining room...';
        socket.emit('joinPacman', { roomId, playerName, playerToken, role });
    }

    socket.on('connect', () => {
        restoreSession();
    });

    socket.on('pacmanJoined', result => {
        joining = false;
        joinButton.disabled = false;
        if (!result.success) {
            setupStatus.textContent = result.message || 'Unable to join this Pac-Man room.';
            localStorage.removeItem(sessionKey);
            return;
        }
        currentRoom = result.roomId;
        menu.style.display = 'none';
        screen.style.display = 'block';
        setup.style.display = 'none';
        game.style.display = 'block';
        document.getElementById('pacmanCurrentRoom').textContent = currentRoom;
        document.getElementById('pacmanRoleLabel').textContent =
            result.role === 'pacman' ? 'PAC-MAN' : 'MONSTER';
        document.getElementById('pacmanControlsHint').textContent =
            result.role === 'pacman'
                ? 'Use arrow keys or WASD to collect pellets and avoid every monster.'
                : 'Use arrow keys or WASD to hunt Pac-Man. Three AI monsters help you.';
        setupStatus.textContent = '';
    });

    socket.on('pacmanState', state => {
        gameState = state;
        currentRoom = state.roomId;
        draw();
        document.getElementById('pacmanStatus').textContent = state.status;
        document.getElementById('pacmanScore').textContent =
            `Lives ${'●'.repeat(state.lives)}${'○'.repeat(3 - state.lives)} · Score ${state.score}`;
    });

    socket.on('pacmanError', message => {
        document.getElementById('pacmanStatus').textContent = message;
    });
    socket.on('pacmanSessionReplaced', () => {
        document.getElementById('pacmanStatus').textContent =
            'This Pac-Man session was opened in another tab.';
    });

    window.addEventListener('keydown', event => {
        if (!gameState?.started || gameState.gameOver || game.style.display === 'none') return;
        const direction = {
            ArrowUp: 'up', w: 'up', W: 'up',
            ArrowDown: 'down', s: 'down', S: 'down',
            ArrowLeft: 'left', a: 'left', A: 'left',
            ArrowRight: 'right', d: 'right', D: 'right'
        }[event.key];
        if (!direction) return;
        event.preventDefault();
        socket.emit('pacmanDirection', { roomId: currentRoom, direction });
    });

    function drawCharacter(x, y, role, direction, color, radius) {
        const size = board.width / gameState.maze[0].length;
        const centerX = (x + 0.5) * size;
        const centerY = (y + 0.5) * size;
        if (role === 'pacman') {
            const facing = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[direction] ?? 0;
            const mouth = Math.PI * (0.12 + Math.abs(Math.sin(Date.now() / 100)) * 0.18);
            context.fillStyle = '#ffe05c';
            context.beginPath();
            context.moveTo(centerX, centerY);
            context.arc(centerX, centerY, radius, facing + mouth, facing + 2 * Math.PI - mouth);
            context.closePath();
            context.fill();
            return;
        }
        context.fillStyle = color;
        context.beginPath();
        context.arc(centerX, centerY, radius, Math.PI, 0);
        context.lineTo(centerX + radius, centerY + radius * 0.65);
        for (let point = 3; point >= -3; point -= 1) {
            context.lineTo(centerX + point * radius / 3, centerY + radius * (point % 2 === 0 ? 0.45 : 0.72));
        }
        context.closePath();
        context.fill();
        context.fillStyle = '#fff';
        context.beginPath();
        context.arc(centerX - radius * 0.3, centerY - radius * 0.12, radius * 0.18, 0, Math.PI * 2);
        context.arc(centerX + radius * 0.3, centerY - radius * 0.12, radius * 0.18, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#171729';
        context.beginPath();
        context.arc(centerX - radius * 0.3, centerY - radius * 0.12, radius * 0.08, 0, Math.PI * 2);
        context.arc(centerX + radius * 0.3, centerY - radius * 0.12, radius * 0.08, 0, Math.PI * 2);
        context.fill();
    }

    function draw() {
        if (!gameState?.maze?.length) return;
        const columns = gameState.maze[0].length;
        const rows = gameState.maze.length;
        const tileSize = Math.min(34, Math.floor(720 / columns));
        board.width = columns * tileSize;
        board.height = rows * tileSize;
        context.fillStyle = '#050817';
        context.fillRect(0, 0, board.width, board.height);
        gameState.maze.forEach((row, y) => {
            [...row].forEach((tile, x) => {
                const centerX = (x + 0.5) * tileSize;
                const centerY = (y + 0.5) * tileSize;
                if (tile === '#') {
                    context.fillStyle = '#132859';
                    context.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
                    context.strokeStyle = '#31529d';
                    context.strokeRect(x * tileSize + 3, y * tileSize + 3, tileSize - 6, tileSize - 6);
                } else if (tile === '.') {
                    context.fillStyle = '#f6dfae';
                    context.beginPath();
                    context.arc(centerX, centerY, 2.2, 0, Math.PI * 2);
                    context.fill();
                } else if (tile === 'o') {
                    context.fillStyle = '#fff1a8';
                    context.beginPath();
                    context.arc(centerX, centerY, 5, 0, Math.PI * 2);
                    context.fill();
                }
            });
        });
        if (gameState.powerTicks > 0) {
            context.fillStyle = '#76e8ff';
            context.globalAlpha = 0.28 + Math.abs(Math.sin(Date.now() / 120)) * 0.3;
            context.fillRect(0, 0, board.width, board.height);
            context.globalAlpha = 1;
        }
        const radius = tileSize * 0.38;
        gameState.players.forEach(player => {
            if (player.role === 'pacman') drawCharacter(player.x, player.y, 'pacman', player.direction, '#ffe05c', radius);
            else drawCharacter(player.x, player.y, 'monster', player.direction, '#f15b75', radius);
        });
        gameState.monsters.forEach(monster =>
            drawCharacter(monster.x, monster.y, 'monster', monster.direction, '#79d8f0', radius)
        );
    }

    function restoreSession() {
        if (localStorage.getItem('arcade-active-game') !== 'pacman') return;
        const saved = localStorage.getItem(sessionKey);
        if (!saved) {
            window.showPacmanScreen();
            return;
        }
        try {
            const session = JSON.parse(saved);
            if (typeof session.playerName !== 'string' ||
                typeof session.roomId !== 'string' ||
                !['pacman', 'monster'].includes(session.role)) {
                throw new Error('Saved Pac-Man session is incomplete.');
            }
            nameInput.value = session.playerName;
            roomInput.value = session.roomId;
            roleInput.value = session.role;
            window.showPacmanScreen();
            joinRoom(true);
        } catch (error) {
            console.error('Unable to restore Pac-Man session:', error);
            localStorage.removeItem(sessionKey);
        }
    }
    restoreSession();
})();
