(() => {
    const socket = window.arcadeSocket;
    const menu = document.getElementById('gameMenu');
    const screen = document.getElementById('angryBirdsScreen');
    const setup = document.getElementById('angryBirdsSetup');
    const game = document.getElementById('angryBirdsGame');
    const nameInput = document.getElementById('angryBirdsPlayerName');
    const roomInput = document.getElementById('angryBirdsRoomId');
    const joinButton = document.getElementById('angryBirdsJoinBtn');
    const setupStatus = document.getElementById('angryBirdsSetupStatus');
    const board = document.getElementById('angryBirdsBoard');
    const context = board.getContext('2d');
    const angleInput = document.getElementById('angryBirdsAngle');
    const powerInput = document.getElementById('angryBirdsPower');
    const launchButton = document.getElementById('angryBirdsLaunchBtn');
    const resignButton = document.getElementById('angryBirdsResignBtn');
    const tokenKey = 'angry-birds-player-token';
    const sessionKey = 'angry-birds-player-session';
    let playerToken = localStorage.getItem(tokenKey);
    let currentRoom = '';
    let gameState = null;
    let joining = false;
    let lastAnimatedShot = 0;
    let shotAnimation = null;

    if (!playerToken) {
        playerToken = window.crypto.randomUUID();
        localStorage.setItem(tokenKey, playerToken);
    }

    window.showAngryBirdsScreen = () => {
        localStorage.setItem('arcade-active-game', 'angry-birds');
        hideOtherGames();
        menu.style.display = 'none';
        screen.style.display = 'block';
        setup.style.display = 'block';
        game.style.display = 'none';
    };

    window.leaveAngryBirdsSession = (nextGame = 'menu') => {
        if (currentRoom) socket.emit('leaveAngryBirds', { roomId: currentRoom });
        currentRoom = '';
        gameState = null;
        shotAnimation = null;
        localStorage.removeItem(sessionKey);
        localStorage.setItem('arcade-active-game', nextGame);
    };

    document.getElementById('angryBirdsBackToMenu').addEventListener('click', () => {
        window.leaveAngryBirdsSession('menu');
        screen.style.display = 'none';
        menu.style.display = 'flex';
        setupStatus.textContent = '';
    });
    document.getElementById('angryBirdsLeaveBtn').addEventListener('click', () => {
        window.leaveAngryBirdsSession('menu');
        screen.style.display = 'none';
        menu.style.display = 'flex';
        setup.style.display = 'block';
        game.style.display = 'none';
    });
    joinButton.addEventListener('click', () => joinRoom(false));
    launchButton.addEventListener('click', launch);
    resignButton.addEventListener('click', () => {
        if (!gameState?.started || gameState.gameOver ||
            !window.confirm('Resign this Angry Birds duel? Your opponent will win.')) return;
        resignButton.disabled = true;
        socket.emit('angryBirdsResign', { roomId: currentRoom });
    });
    angleInput.addEventListener('input', () => {
        document.getElementById('angryBirdsAngleValue').value = `${angleInput.value}°`;
        draw();
    });
    powerInput.addEventListener('input', () => {
        document.getElementById('angryBirdsPowerValue').value = `${powerInput.value}%`;
        draw();
    });

    function hideOtherGames() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('ludoScreen').style.display = 'none';
        document.getElementById('chessScreen').style.display = 'none';
        document.getElementById('snakesLaddersScreen').style.display = 'none';
        document.getElementById('unoScreen').style.display = 'none';
        document.getElementById('pacmanScreen').style.display = 'none';
        document.getElementById('rtsScreen').style.display = 'none';
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
        localStorage.setItem(sessionKey, JSON.stringify({ playerName, roomId }));
        joinButton.disabled = true;
        setupStatus.textContent = isRestore ? 'Rejoining your room...' : 'Joining room...';
        socket.emit('joinAngryBirds', { roomId, playerName, playerToken });
    }

    function launch() {
        if (!gameState || gameState.gameOver || gameState.yourSeat !== gameState.turn) return;
        launchButton.disabled = true;
        socket.emit('angryBirdsLaunch', {
            roomId: currentRoom,
            angle: Number(angleInput.value),
            power: Number(powerInput.value)
        });
    }

    function restoreSession() {
        if (localStorage.getItem('arcade-active-game') !== 'angry-birds') return;
        const saved = localStorage.getItem(sessionKey);
        if (!saved) {
            window.showAngryBirdsScreen();
            return;
        }
        try {
            const session = JSON.parse(saved);
            if (typeof session.playerName !== 'string' || typeof session.roomId !== 'string') {
                throw new Error('Saved Angry Birds session is incomplete.');
            }
            nameInput.value = session.playerName;
            roomInput.value = session.roomId;
            window.showAngryBirdsScreen();
            joinRoom(true);
        } catch (error) {
            console.error('Unable to restore Angry Birds session:', error);
            localStorage.removeItem(sessionKey);
        }
    }

    socket.on('connect', restoreSession);
    socket.on('angryBirdsJoined', result => {
        joining = false;
        joinButton.disabled = false;
        if (!result.success) {
            setupStatus.textContent = result.message || 'Unable to join this Angry Birds room.';
            localStorage.removeItem(sessionKey);
            return;
        }
        currentRoom = result.roomId;
        menu.style.display = 'none';
        screen.style.display = 'block';
        setup.style.display = 'none';
        game.style.display = 'block';
        document.getElementById('angryBirdsCurrentRoom').textContent = currentRoom;
        setupStatus.textContent = '';
    });
    socket.on('angryBirdsState', state => {
        gameState = state;
        currentRoom = state.roomId;
        if (state.lastShot && state.lastShot.id !== lastAnimatedShot) {
            lastAnimatedShot = state.lastShot.id;
            shotAnimation = { shot: state.lastShot, startedAt: performance.now() };
        }
        renderState();
    });
    socket.on('angryBirdsError', message => {
        document.getElementById('angryBirdsTurnStatus').textContent = message;
        launchButton.disabled = !isMyTurn();
        resignButton.disabled = !gameState?.started || gameState.gameOver;
    });
    socket.on('angryBirdsSessionReplaced', () => {
        document.getElementById('angryBirdsTurnStatus').textContent =
            'This Angry Birds session was opened in another tab.';
    });

    function isMyTurn() {
        return Boolean(gameState?.started && !gameState.gameOver &&
            gameState.yourSeat === gameState.turn);
    }

    function renderState() {
        document.getElementById('angryBirdsStatus').textContent = gameState.status;
        const player = gameState.players.find(item => item.seat === gameState.yourSeat);
        const rival = gameState.players.find(item => item.seat !== gameState.yourSeat);
        const turnMessage = !gameState.started
            ? 'Waiting for one more player to join this room.'
            : gameState.gameOver
                ? gameState.winner === null
                    ? 'The duel ended in a draw.'
                    : gameState.winner === gameState.yourSeat ? 'You win!' : 'Your rival wins.'
                : gameState.yourSeat === gameState.turn
                    ? 'Your turn — aim and launch!'
                    : `${rival?.name ?? 'Your rival'} is aiming.`;
        document.getElementById('angryBirdsTurnStatus').textContent =
            `${player?.name ?? 'You'} · ${gameState.shotsLeft[gameState.yourSeat] ?? 0} shots left · ${turnMessage}`;
        launchButton.disabled = !isMyTurn();
        resignButton.disabled = !gameState.started || gameState.gameOver;
        draw();
    }

    function drawPig(x, y, health, side) {
        context.fillStyle = health > 0 ? '#8bcf63' : '#59694f';
        context.beginPath();
        context.arc(x, y, 25, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#293626';
        context.beginPath();
        context.arc(x - 8, y - 4, 2.5, 0, Math.PI * 2);
        context.arc(x + 8, y - 4, 2.5, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#fff';
        context.fillRect(x - 13, y - 31, 26, 5);
        context.fillStyle = side === 0 ? '#ffe05c' : '#ff826d';
        context.fillRect(x - 13, y - 31, 26 * Math.max(0, health) / 100, 5);
    }

    function drawBird(x, y, color = '#ef4b45') {
        context.fillStyle = '#25233a';
        context.beginPath();
        context.ellipse(x - 6, y + 20, 18, 5, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = color;
        context.beginPath();
        context.arc(x, y, 18, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#fff';
        context.beginPath();
        context.arc(x + 5, y - 5, 5, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#25233a';
        context.beginPath();
        context.arc(x + 7, y - 5, 2, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#ffcb57';
        context.beginPath();
        context.moveTo(x + 12, y + 1);
        context.lineTo(x + 26, y + 5);
        context.lineTo(x + 12, y + 9);
        context.fill();
    }

    function drawFort(seat, fortHealth, pigHealth) {
        const centerX = seat === 0 ? 790 : 170;
        context.fillStyle = fortHealth > 0 ? '#9b6845' : '#71533e';
        for (let level = 0; level < fortHealth; level += 1) {
            const width = 30 + level * 2;
            const x = seat === 0 ? centerX - 42 + level * 25 : centerX + 42 - level * 25;
            context.fillRect(x - width / 2, 385 - level * 26, width, 24);
            context.strokeStyle = '#e1b987';
            context.strokeRect(x - width / 2, 385 - level * 26, width, 24);
        }
        drawPig(centerX, 365, pigHealth, seat);
        const labelX = seat === 0 ? centerX + 52 : centerX - 52;
        context.fillStyle = '#26334a';
        context.font = 'bold 15px Arial';
        context.textAlign = seat === 0 ? 'left' : 'right';
        context.fillText(`FORT ${fortHealth}`, labelX, 330);
    }

    function drawAim() {
        if (!isMyTurn()) return;
        const seat = gameState.yourSeat;
        const origin = { x: seat === 0 ? 100 : 860, y: 365 };
        const direction = seat === 0 ? 1 : -1;
        const angle = Number(angleInput.value) * Math.PI / 180;
        const power = Number(powerInput.value);
        const speed = power * 5.7;
        const t = 1.2;
        const aim = {
            x: origin.x + direction * Math.cos(angle) * speed * t,
            y: origin.y - Math.sin(angle) * speed * t + 230 * t * t / 2
        };
        context.setLineDash([6, 7]);
        context.strokeStyle = '#26334a';
        context.beginPath();
        context.moveTo(origin.x, origin.y);
        context.lineTo(aim.x, aim.y);
        context.stroke();
        context.setLineDash([]);
    }

    function draw() {
        if (!gameState) return;
        const scale = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(board.clientWidth * scale));
        const height = Math.max(1, Math.round(board.clientHeight * scale));
        if (board.width !== width || board.height !== height) {
            board.width = width;
            board.height = height;
        }
        context.setTransform(board.width / 960, 0, 0, board.height / 480, 0, 0);
        const sky = context.createLinearGradient(0, 0, 0, 410);
        sky.addColorStop(0, '#a8dcff');
        sky.addColorStop(1, '#f9e1b6');
        context.fillStyle = sky;
        context.fillRect(0, 0, 960, 480);
        context.fillStyle = '#d9c387';
        context.beginPath();
        context.ellipse(500, 442, 600, 70, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#81603b';
        context.fillRect(0, 410, 960, 70);
        drawFort(0, gameState.fortHealth[0], gameState.pigHealth[0]);
        drawFort(1, gameState.fortHealth[1], gameState.pigHealth[1]);
        drawBird(100, 365, '#ef4b45');
        drawBird(860, 365, '#f7a744');
        drawAim();

        if (shotAnimation) {
            const elapsed = performance.now() - shotAnimation.startedAt;
            const duration = 1800;
            const shot = shotAnimation.shot;
            const progress = Math.min(1, elapsed / duration);
            const index = Math.floor(progress * (shot.path.length - 1));
            context.beginPath();
            shot.path.slice(0, index + 1).forEach((point, pointIndex) => {
                if (pointIndex === 0) context.moveTo(point.x, point.y);
                else context.lineTo(point.x, point.y);
            });
            context.strokeStyle = '#522c29';
            context.lineWidth = 3;
            context.stroke();
            const position = shot.path[index];
            drawBird(position.x, position.y, shot.shooter === 0 ? '#ef4b45' : '#f7a744');
            if (progress < 1) requestAnimationFrame(draw);
            else if (elapsed > duration + 1100) shotAnimation = null;
        }
    }

    window.addEventListener('resize', draw);
    function restoreAfterLoad() {
        if (localStorage.getItem('arcade-active-game') === 'angry-birds') restoreSession();
    }
    restoreAfterLoad();
})();
