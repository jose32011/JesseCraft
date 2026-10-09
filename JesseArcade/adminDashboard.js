const { execFile } = require('node:child_process');
const express = require('express');
const {
  createHash,
  randomBytes,
  timingSafeEqual
} = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');

const SESSION_COOKIE = 'voxland_admin_session';
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 16;
const sessions = new Map();
const loginAttempts = new Map();
let lastCpuCounters = null;
let lastDiskCounters = null;
let lastNetworkCounters = null;
let lastSampleAt = null;
let lastProcessCpu = process.cpuUsage();
let lastRestartAt = 0;

function parseCpuCounters(contents) {
  const cpuLine = contents.split('\n').find(line => line.startsWith('cpu '));
  if (!cpuLine) throw new Error('The system CPU counters are unavailable.');
  const values = cpuLine.trim().split(/\s+/).slice(1).map(Number);
  if (values.length < 5 || values.some(value => !Number.isFinite(value))) {
    throw new Error('The system CPU counters are invalid.');
  }
  const idle = values[3] + values[4];
  return { idle, total: values.reduce((sum, value) => sum + value, 0) };
}

function parseNetworkCounters(contents) {
  const totals = { received: 0, sent: 0 };
  for (const line of contents.split('\n').slice(2)) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const interfaceName = line.slice(0, separator).trim();
    if (!interfaceName || interfaceName === 'lo') continue;
    const values = line.slice(separator + 1).trim().split(/\s+/).map(Number);
    if (values.length < 9 || values.some(value => !Number.isFinite(value))) continue;
    totals.received += values[0];
    totals.sent += values[8];
  }
  return totals;
}

function parseDiskCounters(contents) {
  const totals = { read: 0, written: 0 };
  for (const line of contents.split('\n')) {
    const [major, minor, device, , , sectorsRead, , , , sectorsWritten] = line.trim().split(/\s+/);
    if (!device || !/^\d+$/.test(major) || !/^\d+$/.test(minor)) continue;
    if (/^(loop|ram|fd|sr|dm-|md)/.test(device)) continue;
    if (/^(sd[a-z]+\d+|vd[a-z]+\d+|xvd[a-z]+\d+|nvme\d+n\d+p\d+|mmcblk\d+p\d+)$/.test(device)) continue;
    const read = Number(sectorsRead);
    const written = Number(sectorsWritten);
    if (!Number.isFinite(read) || !Number.isFinite(written)) continue;
    totals.read += read * 512;
    totals.written += written * 512;
  }
  return totals;
}

function rate(current, previous, elapsedMs) {
  if (!previous || elapsedMs <= 0) return 0;
  return Math.max(0, (current - previous) / (elapsedMs / 1000));
}

async function collectSystemMetrics(gameMetrics) {
  const [cpuContents, diskContents, networkContents] = await Promise.all([
    fs.readFile('/proc/stat', 'utf8'),
    fs.readFile('/proc/diskstats', 'utf8'),
    fs.readFile('/proc/net/dev', 'utf8')
  ]);
  const now = Date.now();
  const cpu = parseCpuCounters(cpuContents);
  const disk = parseDiskCounters(diskContents);
  const network = parseNetworkCounters(networkContents);
  const elapsedMs = lastSampleAt === null ? 0 : now - lastSampleAt;
  const cpuTotalDelta = lastCpuCounters ? cpu.total - lastCpuCounters.total : 0;
  const cpuIdleDelta = lastCpuCounters ? cpu.idle - lastCpuCounters.idle : 0;
  const processCpu = process.cpuUsage();
  const processCpuMicros = processCpu.user - lastProcessCpu.user +
    processCpu.system - lastProcessCpu.system;
  const cpuPercent = cpuTotalDelta > 0
    ? Math.max(0, Math.min(100, (1 - cpuIdleDelta / cpuTotalDelta) * 100))
    : 0;
  const processCpuPercent = elapsedMs > 0
    ? Math.max(0, Math.min(100, processCpuMicros / (elapsedMs * 1000 * os.cpus().length) * 100))
    : 0;
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const metrics = {
    timestamp: now,
    system: {
      cpuPercent,
      memory: { totalBytes: totalMemory, usedBytes: usedMemory, freeBytes: freeMemory },
      network: {
        receiveBytesPerSecond: rate(network.received, lastNetworkCounters?.received, elapsedMs),
        sendBytesPerSecond: rate(network.sent, lastNetworkCounters?.sent, elapsedMs)
      },
      disk: {
        readBytesPerSecond: rate(disk.read, lastDiskCounters?.read, elapsedMs),
        writeBytesPerSecond: rate(disk.written, lastDiskCounters?.written, elapsedMs)
      },
      loadAverage: os.loadavg()
    },
    processes: [{
      name: 'Jesse Arcade + JesseCraft',
      pid: process.pid,
      cpuPercent: processCpuPercent,
      memory: {
        residentBytes: process.memoryUsage().rss,
        heapUsedBytes: process.memoryUsage().heapUsed,
        heapTotalBytes: process.memoryUsage().heapTotal
      },
      uptimeSeconds: process.uptime()
    }],
    games: gameMetrics()
  };
  lastCpuCounters = cpu;
  lastDiskCounters = disk;
  lastNetworkCounters = network;
  lastSampleAt = now;
  lastProcessCpu = processCpu;
  return metrics;
}

function readCookie(request, cookieName) {
  const cookies = request.headers.cookie?.split(';') ?? [];
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === cookieName) return valueParts.join('=');
  }
  return '';
}

function setSessionCookie(response, request, token, maxAgeSeconds) {
  const secure = request.secure ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`
  );
}

function runSystemdRestart(serviceName) {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/systemctl', ['--no-block', 'restart', serviceName], { timeout: 10000 }, error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function registerAdminDashboard(app, gameMetrics, {
  password = () => process.env.VOYAGER_ADMIN_PASSWORD,
  restartService = runSystemdRestart,
  deleteSavedWorld = async () => {
    throw new Error('Saved-world deletion is unavailable.');
  },
  requireHttps = () => process.env.NODE_ENV === 'production'
} = {}) {
  app.set('trust proxy', 1);
  app.use('/api/admin', (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/admin', express.json({ limit: '1kb' }));

  const authorize = (request, response) => {
    const token = readCookie(request, SESSION_COOKIE);
    const expiresAt = sessions.get(token);
    if (expiresAt && expiresAt > Date.now()) return true;
    sessions.delete(token);
    response.status(401).json({ error: 'Admin login required.' });
    return false;
  };

  app.post('/api/admin/login', (request, response) => {
    if (requireHttps() && !request.secure) {
      response.status(403).json({ error: 'Admin login requires HTTPS.' });
      return;
    }
    const configuredPassword = password();
    if (!configuredPassword || configuredPassword.length < MIN_PASSWORD_LENGTH) {
      response.status(503).json({
        error: 'Dashboard login is unavailable. Set VOYAGER_ADMIN_PASSWORD to a dashboard-only password with at least 16 characters.'
      });
      return;
    }

    const address = request.ip || request.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const previous = loginAttempts.get(address);
    if (previous && now < previous.lockedUntil) {
      response.setHeader('Retry-After', Math.ceil((previous.lockedUntil - now) / 1000));
      response.status(429).json({ error: 'Too many login attempts. Try again later.' });
      return;
    }
    if (previous && now - previous.firstAttemptAt > LOGIN_WINDOW_MS) loginAttempts.delete(address);

    const submittedPassword = typeof request.body?.password === 'string'
      ? request.body.password
      : '';
    const expectedDigest = createHash('sha256').update(configuredPassword).digest();
    const submittedDigest = createHash('sha256').update(submittedPassword).digest();
    if (!timingSafeEqual(expectedDigest, submittedDigest)) {
      const attempt = loginAttempts.get(address) ?? { failures: 0, firstAttemptAt: now, lockedUntil: 0 };
      attempt.failures += 1;
      if (attempt.failures >= MAX_LOGIN_ATTEMPTS) attempt.lockedUntil = now + LOGIN_WINDOW_MS;
      loginAttempts.set(address, attempt);
      response.status(attempt.lockedUntil > now ? 429 : 401).json({
        error: attempt.lockedUntil > now ? 'Too many login attempts. Try again later.' : 'Incorrect admin password.'
      });
      return;
    }

    loginAttempts.delete(address);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_LIFETIME_MS);
    setSessionCookie(response, request, token, SESSION_LIFETIME_MS / 1000);
    response.json({ authenticated: true });
  });

  app.post('/api/admin/logout', (request, response) => {
    const token = readCookie(request, SESSION_COOKIE);
    sessions.delete(token);
    setSessionCookie(response, request, '', 0);
    response.status(204).end();
  });

  app.get('/api/admin/session', (request, response) => {
    const token = readCookie(request, SESSION_COOKIE);
    const expiresAt = sessions.get(token);
    if (!expiresAt || expiresAt <= Date.now()) {
      sessions.delete(token);
      response.status(401).json({ error: 'Admin login required.' });
      return;
    }
    response.json({ authenticated: true });
  });

  app.get('/api/admin/metrics', async (request, response) => {
    if (!authorize(request, response)) return;
    try {
      response.json(await collectSystemMetrics(gameMetrics));
    } catch (error) {
      console.error('Failed to collect VPS admin metrics:', error);
      response.status(503).json({ error: 'VPS metrics are temporarily unavailable.' });
    }
  });

  app.post('/api/admin/restart', async (request, response) => {
    if (!authorize(request, response)) return;
    const serviceName = process.env.VOYAGER_SYSTEMD_SERVICE || 'voxland.service';
    if (!/^[a-zA-Z0-9_.@-]+\.service$/.test(serviceName)) {
      response.status(500).json({ error: 'The configured systemd service name is invalid.' });
      return;
    }
    if (Date.now() - lastRestartAt < 30000) {
      response.status(429).json({ error: 'A restart was requested recently. Wait 30 seconds before trying again.' });
      return;
    }
    lastRestartAt = Date.now();
    try {
      await restartService(serviceName);
      response.status(202).json({ message: `Restart requested for ${serviceName}.` });
    } catch (error) {
      lastRestartAt = 0;
      console.error(`Failed to restart ${serviceName}:`, error);
      response.status(503).json({ error: 'The game service could not be restarted by systemd.' });
    }
  });

  app.post('/api/admin/saved-worlds/delete', async (request, response) => {
    if (!authorize(request, response)) return;
    const roomId = request.body?.roomId;
    if (typeof roomId !== 'string' || !/^[A-Z0-9]{6}$/i.test(roomId)) {
      response.status(400).json({ error: 'A valid saved-world ID is required.' });
      return;
    }
    try {
      const result = await deleteSavedWorld(roomId);
      if (!result.success) {
        response.status(result.status || 503).json({ error: result.message || 'The saved world could not be deleted.' });
        return;
      }
      response.json({ message: result.message });
    } catch (error) {
      console.error(`Failed to delete saved world ${roomId}:`, error);
      response.status(503).json({ error: 'The saved world could not be deleted.' });
    }
  });
}

module.exports = {
  collectSystemMetrics,
  parseCpuCounters,
  parseDiskCounters,
  parseNetworkCounters,
  registerAdminDashboard
};
