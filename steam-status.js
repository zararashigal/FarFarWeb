import https from 'node:https';

const STEAM_PLAYERS_URL = 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=3124540';
const CHECK_INTERVAL = 90_000;
const STALE_AFTER = CHECK_INTERVAL * 2;
const HISTORY_WINDOW = 24 * 60 * 60 * 1000;
const MAX_SAMPLES = HISTORY_WINDOW / CHECK_INTERVAL + 1;

async function fetchSteamStatus(url, options) {
  const response = await new Promise((resolve, reject) => {
    https.get(url, options, resolve).on('error', reject);
  });
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  return {
    ok: response.statusCode >= 200 && response.statusCode < 300,
    status: response.statusCode,
    json: async () => JSON.parse(Buffer.concat(chunks).toString('utf8'))
  };
}

export function createSteamStatusMonitor(fetchStatus = fetchSteamStatus, now = Date.now) {
  let latest = { state: 'pending', playerCount: null, checkedAt: null, responseTimeMs: null, playerChange: null };
  let history = [];
  let checking = false;
  let nextCheckAt = null;

  async function check() {
    if (checking) return;
    checking = true;
    const started = performance.now();
    try {
      const response = await fetchStatus(STEAM_PLAYERS_URL, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`Steam API returned HTTP ${response.status}`);
      const data = await response.json();
      const count = data?.response?.player_count;
      if (data?.response?.result !== 1) {
        throw new Error(`Steam API returned result ${data?.response?.result}`);
      }
      const validCount = Number.isSafeInteger(count) && count >= 0;
      if (!validCount) console.error('Steam API returned an invalid player count');
      const checkedAt = new Date(now()).toISOString();
      const playerChange = validCount && latest.state === 'available' && latest.playerCount !== null &&
        Date.parse(checkedAt) - Date.parse(latest.checkedAt) <= STALE_AFTER
        ? count - latest.playerCount
        : null;
      latest = {
        state: 'available', playerCount: validCount ? count : null, checkedAt,
        responseTimeMs: Math.round(performance.now() - started), playerChange
      };
    } catch (error) {
      console.error('Steam player count check failed:', error);
      latest = {
        state: 'unavailable', playerCount: null, checkedAt: new Date(now()).toISOString(),
        responseTimeMs: Math.round(performance.now() - started), playerChange: null
      };
    } finally {
      history.push({ checkedAt: latest.checkedAt, playerCount: latest.playerCount });
      history = history.filter(sample => now() - Date.parse(sample.checkedAt) <= HISTORY_WINDOW).slice(-MAX_SAMPLES);
      checking = false;
    }
  }

  function getStatus() {
    const samples = history.filter(sample => now() - Date.parse(sample.checkedAt) <= HISTORY_WINDOW);
    const counts = samples.filter(sample => sample.playerCount !== null).map(sample => sample.playerCount);
    const result = {
      ...latest, checking, nextCheckAt, history: samples, recentPeak: counts.length ? Math.max(...counts) : null
    };
    if (latest.checkedAt && now() - Date.parse(latest.checkedAt) > STALE_AFTER) {
      result.state = 'stale';
    }
    return result;
  }

  function start() {
    nextCheckAt = new Date(now() + CHECK_INTERVAL).toISOString();
    check();
    const timer = setInterval(() => {
      nextCheckAt = new Date(now() + CHECK_INTERVAL).toISOString();
      check();
    }, CHECK_INTERVAL);
    timer.unref();
    return timer;
  }

  return { check, getStatus, start };
}
