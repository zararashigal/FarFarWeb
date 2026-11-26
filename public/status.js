const playerCount = document.getElementById('playerCount');
const epicElements = {
  lobbies: document.getElementById('epicLobbies'),
  sessions: document.getElementById('epicSessions'),
  gameAuthentication: document.getElementById('epicGameAuthentication'),
  accountAuthentication: document.getElementById('epicAccountAuthentication')
};
const gameLiftStatus = document.getElementById('gameLiftStatus');
const playerChange = document.getElementById('playerChange');
const recentPeak = document.getElementById('recentPeak');
const responseTime = document.getElementById('responseTime');
const playerHistory = document.getElementById('playerHistory');
const historyStart = document.getElementById('historyStart');
const historyEnd = document.getElementById('historyEnd');
const historyTooltip = document.getElementById('historyTooltip');
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

function setEpicStatus(element, state, status) {
  element.className = '';
  if (state === 'pending') {
    element.textContent = 'Checking...';
  } else if (state === 'stale') {
    element.textContent = 'Out of date';
  } else if (status === 'operational') {
    element.textContent = 'Online';
    element.className = 'status-reachable';
  } else if (status === 'degraded_performance') {
    element.textContent = 'Degraded';
  } else if (status === 'under_maintenance') {
    element.textContent = 'Maintenance';
  } else {
    element.textContent = 'Offline';
    element.className = 'status-unreachable';
  }
}

function renderEpicStatus(steam) {
  for (const [key, element] of Object.entries(epicElements)) {
    setEpicStatus(element, steam.state, steam.epicStatus?.[key]);
  }
}

function showPointTooltip(dot, sample) {
  const container = historyTooltip.parentElement.getBoundingClientRect();
  const point = dot.getBoundingClientRect();
  historyTooltip.firstElementChild.textContent = `${sample.playerCount.toLocaleString()} players`;
  historyTooltip.lastElementChild.textContent = new Date(sample.checkedAt).toLocaleString();
  historyTooltip.style.display = 'flex';
  const half = historyTooltip.offsetWidth / 2;
  const center = point.left + point.width / 2 - container.left;
  historyTooltip.style.left = `${Math.min(Math.max(center, half), container.width - half)}px`;
  historyTooltip.style.top = `${point.top - container.top}px`;
}

function renderGameLiftStatus(steam) {
  const { gameLift } = steam;
  gameLiftStatus.className = '';
  gameLiftStatus.title = '';
  if (steam.state === 'pending') {
    gameLiftStatus.textContent = 'Checking...';
  } else if (steam.state === 'stale') {
    gameLiftStatus.textContent = 'Out of date';
  } else if (!gameLift) {
    gameLiftStatus.textContent = 'Unavailable';
  } else {
    gameLiftStatus.textContent = `${gameLift.online}/${gameLift.total} online`;
    if (gameLift.online === gameLift.total) gameLiftStatus.className = 'status-reachable';
    else if (gameLift.online === 0) gameLiftStatus.className = 'status-unreachable';
    if (gameLift.offline.length) gameLiftStatus.title = `Not responding: ${gameLift.offline.join(', ')}`;
  }
}

function renderHistory(history) {
  historyTooltip.style.display = '';
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
  const peak = max || 1;
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
    const y = 96 - sample.playerCount / peak * 92;
    path += `${drawing ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
    drawing = true;
    previousTime = time;
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    dot.setAttribute('r', '2');
    dot.addEventListener('mouseenter', () => showPointTooltip(dot, sample));
    dot.addEventListener('mouseleave', () => { historyTooltip.style.display = ''; });
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
    renderEpicStatus(steam);
    renderGameLiftStatus(steam);
    if (steam.state === 'available') {
      const validCount = Number.isSafeInteger(steam.playerCount) && steam.playerCount >= 0;
      playerCount.textContent = validCount ? steam.playerCount.toLocaleString() : 'Unavailable';
      playerCount.title = validCount
        ? `Steam player count checked ${checkedAt}.`
        : `Steam returned an invalid player count. Last checked ${checkedAt}.`;
    } else if (steam.state === 'stale') {
      playerCount.textContent = 'Unavailable';
      playerCount.title = `Steam player count is out of date. Last checked ${checkedAt}.`;
    } else if (steam.state === 'pending') {
      playerCount.textContent = 'Checking...';
      playerCount.title = 'Waiting for the first Steam player count check.';
    } else {
      playerCount.textContent = 'Unavailable';
      playerCount.title = checkedAt
        ? `Steam player count could not be retrieved. Last checked ${checkedAt}.`
        : 'Steam player count could not be retrieved.';
    }
  } catch (error) {
    console.error('Could not load status:', error);
    nextCheckAt = null;
    checking = false;
    gameLiftStatus.textContent = 'Unavailable';
    gameLiftStatus.className = '';
    gameLiftStatus.title = '';
    for (const element of Object.values(epicElements)) {
      element.textContent = 'Unavailable';
      element.className = '';
    }
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
