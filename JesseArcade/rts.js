const ROOM_ID_PATTERN = /^[a-zA-Z0-9 _-]{1,40}$/;
const WORLD = { width: 1200, height: 720 };
const TICK_MS = 250;
const FACTIONS = ['Sunward Pact', 'Duskforge League'];
const RESOURCE_NODES = [
  { id: 'wood-west', type: 'wood', x: 430, y: 160, remaining: 120 },
  { id: 'gold-west', type: 'gold', x: 430, y: 560, remaining: 100 },
  { id: 'wood-east', type: 'wood', x: 770, y: 560, remaining: 120 },
  { id: 'gold-east', type: 'gold', x: 770, y: 160, remaining: 100 }
];
const UNIT_STATS = {
  villager: { hp: 55, speed: 44, range: 18, damage: 3, cooldown: 12 },
  spearman: { hp: 105, speed: 68, range: 42, damage: 16, cooldown: 7 },
  archer: { hp: 72, speed: 58, range: 180, damage: 11, cooldown: 10 }
};
const BUILDING_STATS = {
  townCenter: { hp: 420, range: 0, damage: 0 },
  watchtower: { hp: 155, range: 205, damage: 18 }
};
const COSTS = {
  villager: { wood: 30, gold: 0 },
  spearman: { wood: 25, gold: 15 },
  archer: { wood: 20, gold: 35 },
  watchtower: { wood: 90, gold: 45 }
};

class RtsRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.seats = [null, null];
    this.started = false;
    this.gameOver = false;
    this.winner = null;
    this.status = 'Waiting for two commanders to join.';
    this.resources = [{ wood: 150, gold: 100 }, { wood: 150, gold: 100 }];
    this.units = [];
    this.buildings = [];
    this.resourceNodes = RESOURCE_NODES.map(node => ({ ...node }));
    this.nextEntityId = 1;
    this.tickCount = 0;
    this.aiTimer = null;
  }

  join(token, name, socket) {
    const existing = this.seats.find(seat => seat?.id === token);
    if (existing) {
      if (existing.socket && existing.socket !== socket && existing.socket.connected) {
        existing.socket.emit('rtsSessionReplaced');
        existing.socket.disconnect(true);
      }
      existing.name = name;
      existing.socket = socket;
      existing.connected = true;
      return { success: true, seat: existing.seat, reconnected: true };
    }
    if (this.started) return { success: false, message: 'This strategy room is already in battle.' };
    const seatIndex = this.seats.findIndex(seat => !seat);
    if (seatIndex < 0) return { success: false, message: 'This strategy room is full.' };
    this.seats[seatIndex] = {
      id: token,
      name,
      seat: seatIndex,
      faction: FACTIONS[seatIndex],
      connected: true,
      socket
    };
    if (this.seats.every(Boolean)) this.start();
    else this.status = 'Waiting for one more commander.';
    return { success: true, seat: seatIndex, reconnected: false };
  }

  start() {
    this.started = true;
    this.gameOver = false;
    this.winner = null;
    this.tickCount = 0;
    this.nextEntityId = 1;
    this.resources = [{ wood: 150, gold: 100 }, { wood: 150, gold: 100 }];
    this.units = [];
    this.buildings = [];
    this.resourceNodes = RESOURCE_NODES.map(node => ({ ...node }));
    for (const seat of this.seats) {
      const x = seat.seat === 0 ? 125 : WORLD.width - 125;
      this.addBuilding(seat.seat, 'townCenter', x, WORLD.height / 2);
      this.addUnit(seat.seat, 'villager', x + (seat.seat === 0 ? 36 : -36), WORLD.height / 2 - 48);
      this.addUnit(seat.seat, 'villager', x + (seat.seat === 0 ? 36 : -36), WORLD.height / 2);
      this.addUnit(seat.seat, 'spearman', x + (seat.seat === 0 ? 56 : -56), WORLD.height / 2 + 48);
    }
    this.status = 'Gather resources, train troops, and destroy the rival town center.';
  }

  addUnit(owner, type, x, y) {
    const stats = UNIT_STATS[type];
    const unit = {
      id: `unit-${this.nextEntityId++}`,
      owner,
      type,
      x,
      y,
      hp: stats.hp,
      maxHp: stats.hp,
      target: null,
      cooldown: 0,
      gatherCooldown: 0
    };
    this.units.push(unit);
    return unit;
  }

  addBuilding(owner, type, x, y) {
    const stats = BUILDING_STATS[type];
    const building = {
      id: `building-${this.nextEntityId++}`,
      owner,
      type,
      x,
      y,
      hp: stats.hp,
      maxHp: stats.hp,
      cooldown: 0
    };
    this.buildings.push(building);
    return building;
  }

  seatForToken(token) {
    return this.seats.find(seat => seat?.id === token) ?? null;
  }

  canAfford(seat, item) {
    const cost = COSTS[item];
    const stock = this.resources[seat];
    return cost && stock.wood >= cost.wood && stock.gold >= cost.gold;
  }

  spend(seat, item) {
    const cost = COSTS[item];
    this.resources[seat].wood -= cost.wood;
    this.resources[seat].gold -= cost.gold;
  }

  action(token, type) {
    const player = this.seatForToken(token);
    if (!this.started || this.gameOver || !player) {
      return { success: false, message: 'Join an active strategy battle first.' };
    }
    if (!['villager', 'spearman', 'archer', 'watchtower'].includes(type)) {
      return { success: false, message: 'That unit or building is not available.' };
    }
    if (!this.canAfford(player.seat, type)) {
      return { success: false, message: 'Not enough wood or gold.' };
    }
    this.spend(player.seat, type);
    if (type === 'watchtower') {
      const baseX = player.seat === 0 ? 205 : WORLD.width - 205;
      const existing = this.buildings.filter(building => building.owner === player.seat && building.type === type);
      if (existing.length >= 3) {
        this.resources[player.seat].wood += COSTS[type].wood;
        this.resources[player.seat].gold += COSTS[type].gold;
        return { success: false, message: 'You can build up to three watchtowers.' };
      }
      const offset = existing.length * 34;
      this.addBuilding(player.seat, type, baseX, WORLD.height / 2 + offset);
      this.status = `${player.name} built a watchtower.`;
    } else {
      const baseX = player.seat === 0 ? 170 : WORLD.width - 170;
      this.addUnit(
        player.seat,
        type,
        baseX,
        WORLD.height / 2 + (Math.random() - 0.5) * 60
      );
      this.status = `${player.name} trained a ${type}.`;
    }
    return { success: true };
  }

  command(token, unitIds, target) {
    const player = this.seatForToken(token);
    if (!this.started || this.gameOver || !player || !Array.isArray(unitIds) ||
        unitIds.length === 0 || unitIds.length > 30 || !target || typeof target !== 'object') {
      return { success: false, message: 'Select one or more of your units first.' };
    }
    const selected = unitIds
      .map(id => this.units.find(unit => unit.id === id && unit.owner === player.seat))
      .filter(Boolean);
    if (!selected.length) return { success: false, message: 'Those units are no longer available.' };

    if (target.kind === 'gather') {
      const node = this.resourceNodes.find(item => item.id === target.nodeId && item.remaining > 0);
      if (!node || selected.some(unit => unit.type !== 'villager')) {
        return { success: false, message: 'Only villagers can gather at an available resource node.' };
      }
      selected.forEach(unit => {
        unit.target = { kind: 'gather', nodeId: node.id };
      });
      this.status = `${player.name} sent villagers to gather ${node.type}.`;
      return { success: true };
    }

    if (target.kind === 'attack') {
      const enemyUnit = this.units.find(unit => unit.id === target.targetId && unit.owner !== player.seat);
      const enemyBuilding = this.buildings.find(building =>
        building.id === target.targetId && building.owner !== player.seat
      );
      const enemy = enemyUnit ?? enemyBuilding;
      if (!enemy) return { success: false, message: 'That enemy target is no longer available.' };
      selected.forEach(unit => {
        unit.target = { kind: 'attack', targetId: enemy.id };
      });
      this.status = `${player.name} ordered an attack.`;
      return { success: true };
    }

    if (target.kind === 'move' && Number.isFinite(target.x) && Number.isFinite(target.y)) {
      const destination = {
        x: Math.max(35, Math.min(WORLD.width - 35, target.x)),
        y: Math.max(35, Math.min(WORLD.height - 35, target.y))
      };
      selected.forEach((unit, index) => {
        const rowSize = Math.min(3, selected.length - Math.floor(index / 3) * 3);
        const offsetX = (index % 3 - (rowSize - 1) / 2) * 18;
        const rowCount = Math.ceil(selected.length / 3);
        const offsetY = (Math.floor(index / 3) - (rowCount - 1) / 2) * 18;
        unit.target = {
          kind: 'move',
          x: Math.max(35, Math.min(WORLD.width - 35, destination.x + offsetX)),
          y: Math.max(35, Math.min(WORLD.height - 35, destination.y + offsetY))
        };
      });
      return { success: true };
    }
    return { success: false, message: 'That command is invalid.' };
  }

  moveToward(entity, x, y, speed) {
    const dx = x - entity.x;
    const dy = y - entity.y;
    const distance = Math.hypot(dx, dy);
    const step = speed * TICK_MS / 1000;
    if (distance <= step) {
      entity.x = x;
      entity.y = y;
      return true;
    }
    entity.x += dx / distance * step;
    entity.y += dy / distance * step;
    return false;
  }

  resolveCombat(unit) {
    if (unit.cooldown > 0) {
      unit.cooldown -= 1;
      return;
    }
    const stats = UNIT_STATS[unit.type];
    if (stats.damage <= 3) return;
    let target = null;
    if (unit.target?.kind === 'attack') {
      target = this.units.find(item => item.id === unit.target.targetId && item.owner !== unit.owner) ??
        this.buildings.find(item => item.id === unit.target.targetId && item.owner !== unit.owner) ??
        null;
    } else {
      target = this.units
        .filter(item => item.owner !== unit.owner)
        .sort((first, second) =>
          Math.hypot(first.x - unit.x, first.y - unit.y) -
          Math.hypot(second.x - unit.x, second.y - unit.y)
        )[0] ?? null;
    }
    if (!target) return;
    const distance = Math.hypot(target.x - unit.x, target.y - unit.y);
    if (distance > stats.range) {
      if (unit.target?.kind === 'attack') this.moveToward(unit, target.x, target.y, stats.speed);
      return;
    }
    target.hp -= stats.damage;
    unit.cooldown = stats.cooldown;
  }

  resolveTower(building) {
    if (building.type !== 'watchtower' || building.cooldown > 0) {
      if (building.cooldown > 0) building.cooldown -= 1;
      return;
    }
    const target = this.units
      .filter(unit => unit.owner !== building.owner &&
        Math.hypot(unit.x - building.x, unit.y - building.y) <= BUILDING_STATS.watchtower.range)
      .sort((first, second) =>
        Math.hypot(first.x - building.x, first.y - building.y) -
        Math.hypot(second.x - building.x, second.y - building.y)
      )[0];
    if (!target) return;
    target.hp -= BUILDING_STATS.watchtower.damage;
    building.cooldown = 12;
  }

  tick() {
    if (!this.started || this.gameOver || this.seats.some(seat => !seat?.connected)) return;
    this.tickCount += 1;
    for (const unit of this.units) {
      if (unit.hp <= 0) continue;
      if (unit.target?.kind === 'move') {
        if (this.moveToward(unit, unit.target.x, unit.target.y, UNIT_STATS[unit.type].speed)) {
          unit.target = null;
        }
      } else if (unit.target?.kind === 'gather') {
        const node = this.resourceNodes.find(item => item.id === unit.target.nodeId && item.remaining > 0);
        if (!node) {
          unit.target = null;
          continue;
        }
        if (Math.hypot(node.x - unit.x, node.y - unit.y) > 32) {
          this.moveToward(unit, node.x, node.y, UNIT_STATS.villager.speed);
        } else {
          unit.gatherCooldown += 1;
          if (unit.gatherCooldown >= 8) {
            unit.gatherCooldown = 0;
            node.remaining -= 1;
            this.resources[unit.owner][node.type] += 8;
            this.status = `${this.seats[unit.owner].name} gathered ${node.type}.`;
          }
        }
      }
      this.resolveCombat(unit);
    }
    this.units = this.units.filter(unit => unit.hp > 0);
    this.buildings.forEach(building => this.resolveTower(building));
    const defeated = this.buildings.find(building => building.type === 'townCenter' && building.hp <= 0);
    if (defeated) {
      this.gameOver = true;
      this.winner = 1 - defeated.owner;
      this.status = `${this.seats[this.winner].name} destroyed the town center and wins!`;
    }
    this.buildings = this.buildings.filter(building => building.hp > 0);
  }

  resign(token) {
    const player = this.seatForToken(token);
    if (!player || !this.started || this.gameOver) return false;
    this.gameOver = true;
    this.winner = 1 - player.seat;
    this.status = `${this.seats[this.winner].name} wins by forfeit.`;
    return true;
  }

  disconnect(token, socket) {
    const player = this.seatForToken(token);
    if (!player || player.socket !== socket) return false;
    player.connected = false;
    this.status = `${player.name} disconnected. Waiting for them to reconnect.`;
    return true;
  }

  leave(token, socket) {
    const player = this.seatForToken(token);
    if (!player || player.socket !== socket) return false;
    this.seats[player.seat] = null;
    this.started = false;
    this.gameOver = false;
    this.winner = null;
    this.units = [];
    this.buildings = [];
    this.status = 'Waiting for two commanders to join.';
    return true;
  }

  stateFor(token) {
    const player = this.seatForToken(token);
    return {
      roomId: this.roomId,
      started: this.started,
      gameOver: this.gameOver,
      winner: this.winner,
      yourSeat: player?.seat ?? null,
      status: this.status,
      resources: this.resources.map(item => ({ ...item })),
      players: this.seats.filter(Boolean).map(({ id, name, seat, faction, connected }) => ({
        id,
        name,
        seat,
        faction,
        connected
      })),
      units: this.units.map(({ id, owner, type, x, y, hp, maxHp }) => ({
        id, owner, type, x, y, hp, maxHp
      })),
      buildings: this.buildings.map(({ id, owner, type, x, y, hp, maxHp }) => ({
        id, owner, type, x, y, hp, maxHp
      })),
      resourceNodes: this.resourceNodes.filter(node => node.remaining > 0).map(node => ({ ...node }))
    };
  }
}

function registerRtsHandlers(io) {
  const rooms = Object.create(null);

  function broadcast(room) {
    room.seats.forEach(seat => {
      if (seat?.socket?.connected) seat.socket.emit('rtsState', room.stateFor(seat.id));
    });
  }

  io.on('connection', socket => {
    socket.on('joinRts', ({ roomId, playerName, playerToken } = {}) => {
      const safeRoomId = typeof roomId === 'string' ? roomId.trim() : '';
      const safeName = typeof playerName === 'string'
        ? playerName.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 20)
        : '';
      const safeToken = typeof playerToken === 'string' &&
        /^[a-zA-Z0-9-]{16,64}$/.test(playerToken) ? playerToken : '';
      if (!ROOM_ID_PATTERN.test(safeRoomId) || !safeName || !safeToken) {
        socket.emit('rtsJoined', {
          success: false,
          message: 'Enter your name and room ID, and allow browser storage.'
        });
        return;
      }
      const room = rooms[safeRoomId] || (rooms[safeRoomId] = new RtsRoom(safeRoomId));
      const result = room.join(safeToken, safeName, socket);
      if (!result.success) {
        socket.emit('rtsJoined', result);
        return;
      }
      socket.data.rtsRoomId = safeRoomId;
      socket.data.rtsPlayerToken = safeToken;
      socket.join(`rts:${safeRoomId}`);
      socket.emit('rtsJoined', { ...result, roomId: safeRoomId });
      if (result.seat === 1 && !room.aiTimer) {
        room.aiTimer = setInterval(() => {
          room.tick();
          broadcast(room);
        }, TICK_MS);
        room.aiTimer.unref?.();
      }
      broadcast(room);
    });

    socket.on('rtsAction', ({ roomId, type } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.rtsPlayerToken;
      const player = room?.seatForToken(token);
      if (!room || socket.data.rtsRoomId !== roomId ||
          !player || player.socket !== socket) {
        socket.emit('rtsError', 'Rejoin the strategy room before issuing orders.');
        return;
      }
      const result = room.action(token, type);
      if (!result.success) socket.emit('rtsError', result.message);
      broadcast(room);
    });

    socket.on('rtsCommand', ({ roomId, unitIds, target } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.rtsPlayerToken;
      const player = room?.seatForToken(token);
      if (!room || socket.data.rtsRoomId !== roomId ||
          !player || player.socket !== socket) {
        socket.emit('rtsError', 'Rejoin the strategy room before issuing orders.');
        return;
      }
      const result = room.command(token, unitIds, target);
      if (!result.success) socket.emit('rtsError', result.message);
      broadcast(room);
    });

    socket.on('rtsResign', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.rtsPlayerToken;
      const player = room?.seatForToken(token);
      if (!room || socket.data.rtsRoomId !== roomId ||
          !player || player.socket !== socket || !room.resign(token)) {
        socket.emit('rtsError', 'You can only resign an active strategy battle.');
        return;
      }
      broadcast(room);
    });

    socket.on('leaveRts', ({ roomId } = {}) => {
      const room = rooms[roomId];
      const token = socket.data.rtsPlayerToken;
      if (!room || socket.data.rtsRoomId !== roomId || !room.leave(token, socket)) return;
      if (room.aiTimer) clearInterval(room.aiTimer);
      room.aiTimer = null;
      socket.leave(`rts:${roomId}`);
      delete socket.data.rtsRoomId;
      delete socket.data.rtsPlayerToken;
      broadcast(room);
      if (room.seats.every(seat => !seat)) delete rooms[roomId];
    });

    socket.on('disconnect', () => {
      const room = rooms[socket.data.rtsRoomId];
      if (room && room.disconnect(socket.data.rtsPlayerToken, socket)) broadcast(room);
    });
  });

  return rooms;
}

module.exports = { RtsRoom, registerRtsHandlers };
