const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const passwordForm = document.getElementById('passwordForm');
const loginStatus = document.getElementById('loginStatus');
const dashboardStatus = document.getElementById('dashboardStatus');
const passwordStatus = document.getElementById('passwordStatus');
const restartButton = document.getElementById('restartButton');
const refreshButton = document.getElementById('refreshButton');
const samples = { cpu: [], memory: [], network: [], disk: [] };
const MAX_SAMPLES = 60;
let pollTimer = null;
let connectionTimer = null;

function setStatus(element, message, kind = '') {
  element.textContent = message;
  element.className = `status${kind ? ` ${kind}` : ''}`;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'The request failed.');
    error.status = response.status;
    throw error;
  }
  return result;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

function formatRate(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatDuration(seconds) {
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${days ? `${days}d ` : ''}${hours}h ${minutes}m`;
}

function pushSample(key, value) {
  samples[key].push(value);
  if (samples[key].length > MAX_SAMPLES) samples[key].shift();
}

function drawChart(canvas, values, color, percent = false) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = rect.width;
  const height = rect.height;
  const left = 34;
  const right = width - 8;
  const top = 9;
  const bottom = height - 23;
  const maximum = percent ? 100 : Math.max(1, ...values) * 1.15;

  context.clearRect(0, 0, width, height);
  context.font = '10px system-ui, sans-serif';
  context.fillStyle = '#8e9db3';
  context.strokeStyle = 'rgba(145, 160, 183, .15)';
  context.lineWidth = 1;
  for (let row = 0; row <= 4; row += 1) {
    const y = top + (bottom - top) * row / 4;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
    const label = percent ? `${100 - row * 25}%` : formatBytes(maximum * (4 - row) / 4);
    context.fillText(label, 0, y + 3);
  }

  if (values.length < 2) return;
  const points = values.map((value, index) => ({
    x: left + (right - left) * index / Math.max(1, values.length - 1),
    y: bottom - Math.min(maximum, value) / maximum * (bottom - top)
  }));
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.lineJoin = 'round';
  context.stroke();
  context.lineTo(points.at(-1).x, bottom);
  context.lineTo(points[0].x, bottom);
  context.closePath();
  context.fillStyle = `${color}20`;
  context.fill();
}

function appendActivity(name, detail) {
  const row = document.createElement('div');
  row.className = 'activity-row';
  const label = document.createElement('span');
  label.className = 'activity-name';
  label.textContent = name;
  const value = document.createElement('span');
  value.className = 'activity-detail';
  value.textContent = detail;
  row.append(label, value);
  document.getElementById('gameActivity').append(row);
}

function renderMetrics(metrics) {
  const { system } = metrics;
  const memoryPercent = system.memory.usedBytes / system.memory.totalBytes * 100;
  const receive = system.network.receiveBytesPerSecond;
  const send = system.network.sendBytesPerSecond;
  const read = system.disk.readBytesPerSecond;
  const written = system.disk.writeBytesPerSecond;
  document.getElementById('cpuValue').textContent = `${system.cpuPercent.toFixed(1)}%`;
  document.getElementById('loadValue').textContent = `Load ${system.loadAverage.map(value => value.toFixed(2)).join(' · ')}`;
  document.getElementById('memoryValue').textContent = `${memoryPercent.toFixed(1)}%`;
  document.getElementById('memoryDetail').textContent =
    `${formatBytes(system.memory.usedBytes)} used of ${formatBytes(system.memory.totalBytes)}`;
  document.getElementById('networkValue').textContent = `${formatRate(receive)} ↓`;
  document.getElementById('networkDetail').textContent = `${formatRate(send)} upload`;
  document.getElementById('diskValue').textContent = `${formatRate(read)} read`;
  document.getElementById('diskDetail').textContent = `${formatRate(written)} write`;
  document.getElementById('updatedAt').textContent =
    `Updated ${new Date(metrics.timestamp).toLocaleTimeString()} · polling every 2 seconds`;

  pushSample('cpu', system.cpuPercent);
  pushSample('memory', memoryPercent);
  pushSample('network', receive + send);
  pushSample('disk', read + written);
  drawChart(document.getElementById('cpuChart'), samples.cpu, '#69dcff', true);
  drawChart(document.getElementById('memoryChart'), samples.memory, '#77e2ad', true);
  drawChart(document.getElementById('networkChart'), samples.network, '#b59cff');
  drawChart(document.getElementById('diskChart'), samples.disk, '#ffba70');

  const processRows = document.getElementById('processRows');
  processRows.replaceChildren();
  metrics.processes.forEach(process => {
    const row = document.createElement('tr');
    [
      process.name,
      String(process.pid),
      `${process.cpuPercent.toFixed(1)}%`,
      formatBytes(process.memory.residentBytes),
      `${formatBytes(process.memory.heapUsedBytes)} / ${formatBytes(process.memory.heapTotalBytes)}`,
      formatDuration(process.uptimeSeconds)
    ].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    processRows.append(row);
  });

  const activity = document.getElementById('gameActivity');
  activity.replaceChildren();
  const arcade = metrics.games.arcade;
  const arcadeRooms = Object.entries(arcade.rooms)
    .map(([name, count]) => `${name}: ${count}`)
    .join(' · ');
  appendActivity('Arcade', `${arcade.clients} clients · ${arcadeRooms || 'no rooms'}`);
  const craft = metrics.games.jesseCraft;
  appendActivity(
    'JesseCraft',
    `${craft.playersOnline} players · ${craft.activeWorlds} active worlds · ${craft.savedWorlds} saved`
  );
}

function appendCell(row, value, className = '') {
  const cell = document.createElement('td');
  cell.textContent = value;
  if (className) cell.className = className;
  row.append(cell);
  return cell;
}

function createIpButton(label, ip, actionClass, styleClass) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.ip = ip;
  button.className = styleClass;
  button.classList.add(actionClass);
  return button;
}

async function loadConnections() {
  try {
    const data = await request('/api/admin/connections');
    const blocked = new Set(data.blockedIps.map(entry => entry.ip));

    const connectionRows = document.getElementById('connectionRows');
    connectionRows.replaceChildren();
    if (!data.activeConnections.length) {
      const row = connectionRows.insertRow();
      appendCell(row, 'No players currently connected.');
    } else {
      data.activeConnections.forEach(connection => {
        const row = connectionRows.insertRow();
        appendCell(row, connection.game);
        appendCell(row, connection.ip, 'ip-address');
        appendCell(row, new Date(connection.connectedAt).toLocaleString());
        const action = row.insertCell();
        if (!blocked.has(connection.ip)) {
          action.append(createIpButton('Block', connection.ip, 'block-ip', 'small-danger'));
        } else {
          action.textContent = 'Blocked';
        }
      });
    }

    const logRows = document.getElementById('connectionLogRows');
    logRows.replaceChildren();
    if (!data.events.length) {
      const row = logRows.insertRow();
      appendCell(row, 'No connection events recorded.');
    }
    data.events.forEach(entry => {
      const row = logRows.insertRow();
      appendCell(row, new Date(entry.timestamp).toLocaleString());
      appendCell(row, entry.game);
      appendCell(row, entry.ip, 'ip-address');
      appendCell(row, entry.action);
      const action = row.insertCell();
      if (['joined', 'entered'].includes(entry.action) && !blocked.has(entry.ip)) {
        action.append(createIpButton('Block', entry.ip, 'block-ip', 'small-danger'));
      }
    });

    const blockedRows = document.getElementById('blockedIpRows');
    blockedRows.replaceChildren();
    if (!data.blockedIps.length) {
      const row = blockedRows.insertRow();
      appendCell(row, 'No IP addresses are blocked.');
    }
    data.blockedIps.forEach(entry => {
      const row = blockedRows.insertRow();
      appendCell(row, entry.ip, 'ip-address');
      appendCell(row, new Date(entry.blockedAt).toLocaleString());
      const action = row.insertCell();
      action.append(createIpButton('Unblock', entry.ip, 'unblock-ip', 'small-secondary'));
    });
    setStatus(document.getElementById('accessStatus'),
      `Showing up to ${data.events.length} recent events.`, 'success');
  } catch (error) {
    if (error.status === 401) {
      showLogin('Your admin session expired. Sign in again.');
      return;
    }
    setStatus(document.getElementById('accessStatus'), error.message, 'error');
  }
}

document.getElementById('connectionRows').addEventListener('click', handleIpAction);
document.getElementById('connectionLogRows').addEventListener('click', handleIpAction);
document.getElementById('blockedIpRows').addEventListener('click', handleIpAction);

document.getElementById('clearConnectionsButton').addEventListener('click', async event => {
  if (!window.confirm('Clear all saved connectivity history? Blocked IP addresses will remain blocked.')) {
    return;
  }
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await request('/api/admin/connections/events', { method: 'DELETE' });
    await loadConnections();
    setStatus(document.getElementById('accessStatus'), result.message, 'success');
  } catch (error) {
    if (error.status === 401) {
      showLogin('Your admin session expired. Sign in again.');
      return;
    }
    setStatus(document.getElementById('accessStatus'), error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

async function handleIpAction(event) {
  const button = event.target.closest('button[data-ip]');
  if (!button) return;
  const ip = button.dataset.ip;
  const isUnblock = button.classList.contains('unblock-ip');
  const confirmed = window.confirm(isUnblock
    ? `Allow ${ip} to connect to the games again?`
    : `Block ${ip} from all games and disconnect its active sessions?`);
  if (!confirmed) return;

  button.disabled = true;
  try {
    const result = await request('/api/admin/ip-blocks', {
      method: isUnblock ? 'DELETE' : 'POST',
      body: JSON.stringify({ ip })
    });
    setStatus(document.getElementById('accessStatus'), result.message, 'success');
    await loadConnections();
  } catch (error) {
    setStatus(document.getElementById('accessStatus'), error.message, 'error');
    button.disabled = false;
  }
}

async function loadMetrics() {
  try {
    const metrics = await request('/api/admin/metrics');
    renderMetrics(metrics);
    setStatus(dashboardStatus, 'Metrics are updating.', 'success');
  } catch (error) {
    if (error.status === 401) {
      showLogin('Your admin session expired. Sign in again.');
      return;
    }
    setStatus(dashboardStatus, error.message, 'error');
  }
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  setStatus(loginStatus, '');
  loadMetrics();
  loadConnections();
  clearInterval(pollTimer);
  pollTimer = setInterval(loadMetrics, 2000);
  clearInterval(connectionTimer);
  connectionTimer = setInterval(loadConnections, 5000);
}

function showLogin(message = '') {
  clearInterval(pollTimer);
  clearInterval(connectionTimer);
  pollTimer = null;
  connectionTimer = null;
  dashboardView.hidden = true;
  loginView.hidden = false;
  if (message) setStatus(loginStatus, message, 'error');
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setStatus(loginStatus, 'Checking password…');
  try {
    await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: loginForm.elements.password.value })
    });
    loginForm.reset();
    showDashboard();
  } catch (error) {
    setStatus(loginStatus, error.message, 'error');
  } finally {
    submit.disabled = false;
  }
});

passwordForm.addEventListener('submit', async event => {
  event.preventDefault();
  const currentPassword = passwordForm.elements.currentPassword.value;
  const newPassword = passwordForm.elements.newPassword.value;
  if (newPassword !== passwordForm.elements.confirmPassword.value) {
    setStatus(passwordStatus, 'The new passwords do not match.', 'error');
    return;
  }

  const submit = passwordForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setStatus(passwordStatus, 'Updating dashboard password…');
  try {
    const result = await request('/api/admin/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    passwordForm.reset();
    setStatus(passwordStatus, result.message, 'success');
  } catch (error) {
    setStatus(passwordStatus, error.message, 'error');
  } finally {
    submit.disabled = false;
  }
});

refreshButton.addEventListener('click', loadMetrics);
document.getElementById('logoutButton').addEventListener('click', async () => {
  try {
    await request('/api/admin/logout', { method: 'POST' });
    showLogin('You have been signed out.');
  } catch (error) {
    setStatus(dashboardStatus, error.message, 'error');
  }
});

restartButton.addEventListener('click', async () => {
  if (!window.confirm('Restart the JesseCraft and arcade game server now? Players will be disconnected.')) return;
  restartButton.disabled = true;
  setStatus(dashboardStatus, 'Requesting a safe service restart…');
  try {
    const result = await request('/api/admin/restart', { method: 'POST' });
    setStatus(dashboardStatus, `${result.message} Reconnect and sign in again after it comes back.`, 'success');
  } catch (error) {
    setStatus(dashboardStatus, error.message, 'error');
  } finally {
    restartButton.disabled = false;
  }
});

window.addEventListener('resize', () => {
  if (!dashboardView.hidden) {
    drawChart(document.getElementById('cpuChart'), samples.cpu, '#69dcff', true);
    drawChart(document.getElementById('memoryChart'), samples.memory, '#77e2ad', true);
    drawChart(document.getElementById('networkChart'), samples.network, '#b59cff');
    drawChart(document.getElementById('diskChart'), samples.disk, '#ffba70');
  }
});

request('/api/admin/session').then(showDashboard).catch(error => {
  showLogin(error.status === 401 ? '' : error.message);
});
