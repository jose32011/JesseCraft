const assert = require('node:assert/strict');
const { statSync, readFileSync, mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const {
  parseDiskCounters,
  parseNetworkCounters,
  registerAdminDashboard
} = require('./adminDashboard');
const { createIpAccessControl, normalizeIpAddress } = require('./ipAccessControl');

async function withDashboard(options, run) {
  const app = express();
  registerAdminDashboard(app, () => ({
    arcade: { clients: 2, rooms: { uno: 1 } },
    jesseCraft: { playersOnline: 3, activeWorlds: 1, savedWorlds: 2 }
  }), options);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

test('dashboard metrics require login and restart uses the configured game service', async () => {
  const restartedServices = [];
  await withDashboard({
    password: () => 'long-test-admin-password',
    restartService: async serviceName => restartedServices.push(serviceName)
  }, async baseUrl => {
    const unauthorized = await fetch(`${baseUrl}/api/admin/metrics`);
    assert.equal(unauthorized.status, 401);

    const incorrect = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' })
    });
    assert.equal(incorrect.status, 401);

    const login = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-proto': 'https'
      },
      body: JSON.stringify({ password: 'long-test-admin-password' })
    });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.match(setCookie, /Secure/);
    const cookie = setCookie.split(';')[0];

    const metricsResponse = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { cookie }
    });
    assert.equal(metricsResponse.status, 200);
    const metrics = await metricsResponse.json();
    assert.ok(metrics.system.memory.totalBytes > 0);
    assert.equal(metrics.processes[0].name, 'Jesse Arcade + JesseCraft');
    assert.equal(metrics.games.jesseCraft.activeWorlds, 1);

    const unauthorizedRestart = await fetch(`${baseUrl}/api/admin/restart`, { method: 'POST' });
    assert.equal(unauthorizedRestart.status, 401);
    const restart = await fetch(`${baseUrl}/api/admin/restart`, {
      method: 'POST',
      headers: { cookie }
    });
    assert.equal(restart.status, 202);
    const restartAgain = await fetch(`${baseUrl}/api/admin/restart`, {
      method: 'POST',
      headers: { cookie }
    });
    assert.equal(restartAgain.status, 429);
    assert.deepEqual(restartedServices, ['voxland.service']);

    const logout = await fetch(`${baseUrl}/api/admin/logout`, {
      method: 'POST',
      headers: { cookie }
    });
    assert.equal(logout.status, 204);
    const expiredSession = await fetch(`${baseUrl}/api/admin/session`, {
      headers: { cookie }
    });
    assert.equal(expiredSession.status, 401);
  });
});

test('admin login refuses non-HTTPS requests when HTTPS is required', async () => {
  await withDashboard({
    password: () => 'long-test-admin-password',
    requireHttps: () => true
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'long-test-admin-password' })
    });
    assert.equal(response.status, 403);
  });
});

test('dashboard password must contain at least eight characters', async () => {
  await withDashboard({ password: () => 'short7!' }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'short7!' })
    });
    assert.equal(response.status, 503);
  });
  await withDashboard({ password: () => 'eight888' }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'eight888' })
    });
    assert.equal(response.status, 200);
  });
});

test('dashboard password changes are authenticated, persistent, and stored as a hash', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'voxland-admin-password-'));
  const passwordFile = path.join(directory, 'admin', 'password.json');
  try {
    await withDashboard({
      password: () => 'initial-dashboard-password',
      passwordFile
    }, async baseUrl => {
      const login = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-proto': 'https'
        },
        body: JSON.stringify({ password: 'initial-dashboard-password' })
      });
      assert.equal(login.status, 200);
      const oldCookie = login.headers.get('set-cookie').split(';')[0];

      const wrongCurrent = await fetch(`${baseUrl}/api/admin/password`, {
        method: 'POST',
        headers: { cookie: oldCookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'incorrect-dashboard-password',
          newPassword: 'eight888'
        })
      });
      assert.equal(wrongCurrent.status, 401);

      const shortNewPassword = await fetch(`${baseUrl}/api/admin/password`, {
        method: 'POST',
        headers: { cookie: oldCookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'initial-dashboard-password',
          newPassword: 'short7!'
        })
      });
      assert.equal(shortNewPassword.status, 400);

      const changed = await fetch(`${baseUrl}/api/admin/password`, {
        method: 'POST',
        headers: { cookie: oldCookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'initial-dashboard-password',
          newPassword: 'eight888'
        })
      });
      assert.equal(changed.status, 200);
      assert.match(await changed.text(), /Other sessions have been signed out/);
      assert.match(changed.headers.get('set-cookie'), /HttpOnly/);
      assert.equal((await fetch(`${baseUrl}/api/admin/metrics`, {
        headers: { cookie: oldCookie }
      })).status, 401);

      const stored = readFileSync(passwordFile, 'utf8');
      assert.equal(stored.includes('eight888'), false);
      assert.equal(statSync(passwordFile).mode & 0o777, 0o600);
    });

    await withDashboard({ password: () => 'initial-dashboard-password', passwordFile }, async baseUrl => {
      const oldPassword = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'initial-dashboard-password' })
      });
      assert.equal(oldPassword.status, 401);
      const newPassword = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'eight888' })
      });
      assert.equal(newPassword.status, 200);
    });

    rmSync(passwordFile);
    await withDashboard({ password: () => 'initial-dashboard-password', passwordFile }, async baseUrl => {
      const bootstrapAfterRotation = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'initial-dashboard-password' })
      });
      assert.equal(bootstrapAfterRotation.status, 503);
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('saved-world deletion requires an admin session and forwards the world ID', async () => {
  const deletedRoomIds = [];
  await withDashboard({
    password: () => 'long-test-admin-password',
    deleteSavedWorld: async roomId => {
      deletedRoomIds.push(roomId);
      return { success: true, message: 'Test world was deleted.' };
    }
  }, async baseUrl => {
    const unauthorized = await fetch(`${baseUrl}/api/admin/saved-worlds/delete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomId: 'ABC123' })
    });
    assert.equal(unauthorized.status, 401);
    assert.deepEqual(deletedRoomIds, []);

    const login = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-proto': 'https'
      },
      body: JSON.stringify({ password: 'long-test-admin-password' })
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];

    const invalidId = await fetch(`${baseUrl}/api/admin/saved-worlds/delete`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ roomId: '../etc/passwd' })
    });
    assert.equal(invalidId.status, 400);
    assert.deepEqual(deletedRoomIds, []);

    const deletion = await fetch(`${baseUrl}/api/admin/saved-worlds/delete`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ roomId: 'abc123' })
    });
    assert.equal(deletion.status, 200);
    assert.deepEqual(await deletion.json(), { message: 'Test world was deleted.' });
    assert.deepEqual(deletedRoomIds, ['abc123']);
  });
});

test('connectivity log and IP blocks persist and normalize mapped IPv4 addresses', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'voxland-access-control-'));
  const filePath = path.join(directory, 'access-control.json');
  try {
    assert.equal(normalizeIpAddress('::ffff:192.0.2.10'), '192.0.2.10');
    assert.equal(normalizeIpAddress('not-an-ip'), null);

    const accessControl = createIpAccessControl({ filePath });
    await accessControl.initialize();
    assert.equal(accessControl.connected({
      connectionId: 'arcade:one',
      game: 'Arcade',
      ip: '::ffff:192.0.2.10'
    }), true);
    await accessControl.flush();
    assert.equal(accessControl.snapshot().activeConnections[0].ip, '192.0.2.10');
    assert.equal(accessControl.snapshot().events[0].action, 'joined');
    accessControl.enteredGame('arcade:one', 'Chess');
    await accessControl.flush();
    assert.equal(accessControl.snapshot().activeConnections[0].game, 'Chess');
    assert.equal(accessControl.snapshot().events[0].action, 'entered');
    assert.equal(accessControl.snapshot().events[0].game, 'Chess');

    await accessControl.block('192.0.2.10');
    assert.equal(accessControl.isBlocked('192.0.2.10'), true);
    accessControl.disconnected('arcade:one');
    await accessControl.flush();

    const restored = createIpAccessControl({ filePath });
    await restored.initialize();
    assert.equal(restored.isBlocked('::ffff:192.0.2.10'), true);
    assert.ok(restored.snapshot().events.some(event => event.action === 'left'));
    assert.equal(restored.snapshot().activeConnections.length, 0);

    await restored.unblock('192.0.2.10');
    assert.equal(restored.isBlocked('192.0.2.10'), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('connectivity and IP block APIs require admin login', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'voxland-access-api-'));
  try {
    const accessControl = createIpAccessControl({
      filePath: path.join(directory, 'access-control.json')
    });
    await accessControl.initialize();
    const disconnectedIps = [];
    await withDashboard({
      password: () => 'long-test-admin-password',
      accessControl,
      disconnectBlockedIp: async ip => disconnectedIps.push(ip)
    }, async baseUrl => {
      const unauthenticated = await fetch(`${baseUrl}/api/admin/connections`);
      assert.equal(unauthenticated.status, 401);
      const forbiddenBlock = await fetch(`${baseUrl}/api/admin/ip-blocks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ip: '192.0.2.20' })
      });
      assert.equal(forbiddenBlock.status, 401);

      const login = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-proto': 'https'
        },
        body: JSON.stringify({ password: 'long-test-admin-password' })
      });
      const cookie = login.headers.get('set-cookie').split(';')[0];

      const invalidIp = await fetch(`${baseUrl}/api/admin/ip-blocks`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ ip: 'not-an-ip' })
      });
      assert.equal(invalidIp.status, 400);

      const block = await fetch(`${baseUrl}/api/admin/ip-blocks`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ ip: '192.0.2.20' })
      });
      assert.equal(block.status, 200);
      assert.deepEqual(disconnectedIps, ['192.0.2.20']);
      const snapshot = await fetch(`${baseUrl}/api/admin/connections`, {
        headers: { cookie }
      });
      assert.equal((await snapshot.json()).blockedIps[0].ip, '192.0.2.20');

      const unblock = await fetch(`${baseUrl}/api/admin/ip-blocks`, {
        method: 'DELETE',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ ip: '192.0.2.20' })
      });
      assert.equal(unblock.status, 200);
      assert.equal(accessControl.isBlocked('192.0.2.20'), false);
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('system parsers aggregate network counters and ignore disk partitions', () => {
  const network = parseNetworkCounters([
    'Inter-| Receive | Transmit',
    ' face |bytes packets errs drop fifo frame compressed multicast|bytes packets errs drop fifo colls carrier compressed',
    '  eth0: 100 1 0 0 0 0 0 0 200 1 0 0 0 0 0 0',
    '    lo: 900 1 0 0 0 0 0 0 900 1 0 0 0 0 0 0'
  ].join('\n'));
  assert.deepEqual(network, { received: 100, sent: 200 });

  const disks = parseDiskCounters([
    '8 0 sda 1 0 10 0 2 0 20 0 0 0 0',
    '8 1 sda1 1 0 100 0 2 0 200 0 0 0 0',
    '7 0 loop0 1 0 300 0 2 0 400 0 0 0 0'
  ].join('\n'));
  assert.deepEqual(disks, { read: 5120, written: 10240 });
});
