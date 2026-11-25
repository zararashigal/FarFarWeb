const playerCount = document.getElementById('playerCount');
const steamStatus = document.getElementById('steamStatus');
const playerChange = document.getElementById('playerChange');
const recentPeak = document.getElementById('recentPeak');
const responseTime = document.getElementById('responseTime');
const playerHistory = document.getElementById('playerHistory');
const historyStart = document.getElementById('historyStart');
const historyEnd = document.getElementById('historyEnd');
const statusCountdown = document.getElementById('statusCountdown');
let nextCheckAt = null, checking = false, fetching = false, refreshTimer;

function updateCountdown() {
  if (checking) {
    statusCountdown.textContent = 'Checking...';
  } else if (nextCheckAt === null) {
    statusCountdown.textContent = 'Unavailable';
  } else {
    const seconds = Math.ceil((nextCheckAt - Date.now()) / 1000);
    statusCountdown.textContent = seconds > 0
      ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
      : 'Due';
  }
}

function renderHistory(history) {
  playerHistory.replaceChildren();
  historyStart.textContent = '';
  historyEnd.textContent = '';
  const valid = history.filter(sample => Number.isSafeInteger(sample.playerCount) && sample.playerCount >= 0);
  if (!valid.length) {
    playerHistory.setAttribute('aria-label', 'No recent player count data available');
    return;
  }
  const counts = valid.map(sample => sample.playerCount);
  const min = Math.min(...counts), max = Math.max(...counts);
  const first = Date.parse(history[0].checkedAt), last = Date.parse(history[history.length - 1].checkedAt);
  let path = '', drawing = false, previousTime = null;
  for (const sample of history) {
    if (!Number.isSafeInteger(sample.playerCount) || sample.playerCount < 0) {
      drawing = false;
      continue;
    }
    const time = Date.parse(sample.checkedAt);
    if (previousTime !== null && time - previousTime > 180_000) drawing = false;
    const x = last === first ? 300 : 4 + (time - first) / (last - first) * 592;
    const y = max === min ? 50 : 96 - (sample.playerCount - min) / (max - min) * 92;
    path += `${drawing ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
    drawing = true;
    previousTime = time;
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    dot.setAttribute('r', '2');
    playerHistory.append(dot);
  }
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', path);
  playerHistory.prepend(line);
  historyStart.textContent = new Date(first).toLocaleString();
  historyEnd.textContent = first === last ? '' : new Date(last).toLocaleString();
  playerHistory.setAttribute('aria-label', `Recent Steam player activity, ${min.toLocaleString()} to ${max.toLocaleString()} players`);
}

async function updateStatus() {
  if (fetching) return;
  fetching = true;
  clearTimeout(refreshTimer);
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error(`Status API returned HTTP ${response.status}`);
    const { steam } = await response.json();
    const scheduled = Date.parse(steam.nextCheckAt);
    nextCheckAt = Number.isFinite(scheduled) ? scheduled : null;
    checking = steam.checking;
    const checkedAt = steam.checkedAt ? new Date(steam.checkedAt).toLocaleString() : '';
    const current = steam.state !== 'stale' && steam.state !== 'pending';
    const change = current ? steam.playerChange : null;
    playerChange.textContent = Number.isSafeInteger(change) ? `${change > 0 ? '+' : ''}${change.toLocaleString()}` : '-';
    recentPeak.textContent = Number.isSafeInteger(steam.recentPeak) ? steam.recentPeak.toLocaleString() : '-';
    responseTime.textContent = steam.state === 'available' && Number.isSafeInteger(steam.responseTimeMs) ? `${steam.responseTimeMs} ms` : '-';
    renderHistory(steam.history);
    steamStatus.className = '';
    if (steam.state === 'available') {
      steamStatus.textContent = 'Online';
      steamStatus.className = 'status-reachable';
      const validCount = Number.isSafeInteger(steam.playerCount) && steam.playerCount >= 0;
      playerCount.textContent = validCount ? steam.playerCount.toLocaleString() : 'Unavailable';
      playerCount.title = validCount
        ? `Steam player count checked ${checkedAt}.`
        : `Steam returned an invalid player count. Last checked ${checkedAt}.`;
    } else if (steam.state === 'stale') {
      steamStatus.textContent = 'Out of date';
      playerCount.textContent = 'Unavailable';
      playerCount.title = `Steam player count is out of date. Last checked ${checkedAt}.`;
    } else if (steam.state === 'pending') {
      steamStatus.textContent = 'Checking...';
      playerCount.textContent = 'Checking...';
      playerCount.title = 'Waiting for the first Steam player count check.';
    } else {
      steamStatus.textContent = 'Offline';
      steamStatus.className = 'status-unreachable';
      playerCount.textContent = 'Unavailable';
      playerCount.title = checkedAt
        ? `Steam player count could not be retrieved. Last checked ${checkedAt}.`
        : 'Steam player count could not be retrieved.';
    }
  } catch (error) {
    console.error('Could not load status:', error);
    nextCheckAt = null;
    checking = false;
    steamStatus.textContent = 'Unavailable';
    steamStatus.className = '';
    playerCount.textContent = 'Unavailable';
    playerChange.textContent = '-';
    recentPeak.textContent = '-';
    responseTime.textContent = '-';
    renderHistory([]);
    playerCount.title = 'Could not load status from Far Far Web.';
  } finally {
    fetching = false;
    updateCountdown();
    const remaining = nextCheckAt === null ? 0 : nextCheckAt - Date.now();
    const delay = checking ? 2_000 : remaining > 0 ? Math.min(90_000, remaining + 1_000) : nextCheckAt === null ? 90_000 : 2_000;
    refreshTimer = setTimeout(() => {
      if (!document.hidden) updateStatus();
    }, delay);
  }
}

updateStatus();
setInterval(() => {
  if (!document.hidden) updateCountdown();
}, 1_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateStatus();
});
