const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');

const MAX_EVENTS = 1000;

function normalizeIpAddress(value) {
  if (typeof value !== 'string') return null;
  const address = value.trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '');
  return net.isIP(address) ? address : null;
}

function getAccessControlFile() {
  if (process.env.VOYAGER_ACCESS_CONTROL_FILE) {
    return path.resolve(process.env.VOYAGER_ACCESS_CONTROL_FILE);
  }
  return process.env.NODE_ENV === 'production'
    ? '/var/lib/voxland/admin/access-control.json'
    : path.resolve('.data/admin-access-control.json');
}

function createIpAccessControl({ filePath = getAccessControlFile() } = {}) {
  let events = [];
  const blockedIps = new Map();
  const activeConnections = new Map();
  let persistQueue = Promise.resolve();

  function persist() {
    const snapshot = JSON.stringify({
      version: 1,
      events,
      blockedIps: [...blockedIps.values()]
    });
    const write = persistQueue.catch(() => {}).then(async () => {
      const directory = path.dirname(filePath);
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      const temporaryFile = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporaryFile, snapshot, { flag: 'wx', mode: 0o600 });
        await fs.rename(temporaryFile, filePath);
        await fs.chmod(filePath, 0o600);
      } catch (error) {
        await fs.rm(temporaryFile, { force: true });
        throw error;
      }
    });
    persistQueue = write;
    return write;
  }

  function addEvent(event) {
    events.unshift({
      id: randomUUID(),
      timestamp: Date.now(),
      ...event
    });
    if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
    return persist().catch(error => {
      console.error('Failed to persist game connectivity log:', error);
    });
  }

  return {
    async initialize() {
      try {
        const contents = await fs.readFile(filePath, 'utf8');
        const saved = JSON.parse(contents);
        if (saved.version !== 1 ||
            !Array.isArray(saved.events) ||
            !Array.isArray(saved.blockedIps)) {
          throw new Error('The saved game access-control data is invalid.');
        }
        events = saved.events.slice(0, MAX_EVENTS);
        for (const entry of saved.blockedIps) {
          const ip = normalizeIpAddress(entry?.ip);
          if (!ip || !Number.isFinite(entry.blockedAt)) {
            throw new Error('The saved IP block list contains invalid data.');
          }
          blockedIps.set(ip, { ip, blockedAt: entry.blockedAt });
        }
      } catch (error) {
        if (error.code === 'ENOENT') return;
        throw error;
      }
    },

    isBlocked(address) {
      const ip = normalizeIpAddress(address);
      return ip !== null && blockedIps.has(ip);
    },

    connected({ connectionId, game, ip: address }) {
      const ip = normalizeIpAddress(address);
      if (!ip || this.isBlocked(ip)) return false;
      const connection = {
        connectionId,
        game,
        ip,
        connectedAt: Date.now()
      };
      activeConnections.set(connectionId, connection);
      void addEvent({ action: 'joined', game, ip });
      return true;
    },

    enteredGame(connectionId, game) {
      const connection = activeConnections.get(connectionId);
      if (!connection) return;
      connection.game = game;
      void addEvent({ action: 'entered', game, ip: connection.ip });
    },

    disconnected(connectionId) {
      const connection = activeConnections.get(connectionId);
      if (!connection) return Promise.resolve();
      activeConnections.delete(connectionId);
      return addEvent({
        action: 'left',
        game: connection.game,
        ip: connection.ip
      });
    },

    flush() {
      return persistQueue;
    },

    async block(address) {
      const ip = normalizeIpAddress(address);
      if (!ip) throw new TypeError('A valid IP address is required.');
      if (blockedIps.has(ip)) return { ip, alreadyBlocked: true };

      const entry = { ip, blockedAt: Date.now() };
      blockedIps.set(ip, entry);
      try {
        await persist();
      } catch (error) {
        blockedIps.delete(ip);
        throw error;
      }
      await addEvent({ action: 'blocked', ip, game: 'All games' });
      return { ip, alreadyBlocked: false };
    },

    async unblock(address) {
      const ip = normalizeIpAddress(address);
      if (!ip) throw new TypeError('A valid IP address is required.');
      const entry = blockedIps.get(ip);
      if (!entry) return { ip, wasBlocked: false };

      blockedIps.delete(ip);
      try {
        await persist();
      } catch (error) {
        blockedIps.set(ip, entry);
        throw error;
      }
      await addEvent({ action: 'unblocked', ip, game: 'All games' });
      return { ip, wasBlocked: true };
    },

    snapshot() {
      return {
        events: events.slice(),
        activeConnections: [...activeConnections.values()],
        blockedIps: [...blockedIps.values()]
      };
    }
  };
}

module.exports = { createIpAccessControl, normalizeIpAddress };
