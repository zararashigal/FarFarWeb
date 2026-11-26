import dgram from 'node:dgram';
import https from 'node:https';

const STEAM_PLAYERS_URL = 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=3124540';
const EPIC_STATUS_URL = 'https://status.epicgames.com/api/v2/summary.json';
const EPIC_COMPONENTS = {
  lobbies: 'm4xvxnmqdhp5',
  sessions: 'k1l94l0qn82f',
  gameAuthentication: 'r72khk011yj0',
  accountAuthentication: 'cdlw7xs52f66'
};
const GAMELIFT_PORT = 7770;
const GAMELIFT_TIMEOUT = 3000;
const GAMELIFT_PING = Buffer.from('0001000029b100000004e53f9cc4aaaaaaaabbbbbbbb', 'hex');
const GAMELIFT_REGIONS = [
  'af-south-1', 'ap-east-1', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3', 'ap-south-1', 'ap-south-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-southeast-5', 'ap-southeast-7', 'ca-central-1',
  'eu-central-1', 'eu-north-1', 'eu-south-1', 'eu-south-2', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'il-central-1', 'me-south-1', 'mx-central-1', 'sa-east-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'
];
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

function pingGameLiftRegion(region) {
  return new Promise(resolve => {
    const socket = dgram.createSocket('udp4');
    const finish = reachable => {
      clearTimeout(timer);
      socket.close();
      resolve(reachable);
    };
    const timer = setTimeout(() => finish(false), GAMELIFT_TIMEOUT);
    socket.on('message', message => finish(message.equals(GAMELIFT_PING)));
    socket.on('error', () => finish(false));
    socket.send(GAMELIFT_PING, GAMELIFT_PORT, `gamelift-ping.${region}.api.aws`, error => {
      if (error) finish(false);
    });
  });
}

export function createSteamStatusMonitor(fetchStatus = fetchSteamStatus, now = Date.now, pingRegion = pingGameLiftRegion) {
  let latest = { state: 'pending', playerCount: null, checkedAt: null, responseTimeMs: null, playerChange: null };
  let history = [];
  let epicStatus = {};
  let gameLift = null;
  let checking = false;
  let inFlight = null;
  let nextCheckAt = null;

  async function checkEpic() {
    try {
      const response = await fetchStatus(EPIC_STATUS_URL, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`Epic status API returned HTTP ${response.status}`);
      const data = await response.json();
      return Object.fromEntries(Object.entries(EPIC_COMPONENTS).map(([key, id]) => {
        const status = data?.components?.find(item => item.id === id)?.status;
        return [key, typeof status === 'string' ? status : null];
      }));
    } catch (error) {
      console.error('Epic Online Services check failed:', error);
      return {};
    }
  }

  async function checkGameLift() {
    const results = await Promise.all(GAMELIFT_REGIONS.map(region => pingRegion(region).catch(() => false)));
    return {
      online: results.filter(Boolean).length,
      total: GAMELIFT_REGIONS.length,
      offline: GAMELIFT_REGIONS.filter((region, index) => !results[index])
    };
  }

  async function runCheck() {
    checking = true;
    const epicCheck = checkEpic();
    const gameLiftCheck = checkGameLift();
    const started = performance.now();
    try {
      const response = await fetchStatus(`${STEAM_PLAYERS_URL}&_=${now()}`, { signal: AbortSignal.timeout(10_000) });
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
      [epicStatus, gameLift] = await Promise.all([epicCheck, gameLiftCheck]);
      history.push({ checkedAt: latest.checkedAt, playerCount: latest.playerCount });
      history = history.filter(sample => now() - Date.parse(sample.checkedAt) <= HISTORY_WINDOW).slice(-MAX_SAMPLES);
      checking = false;
    }
  }

  function check() {
    if (!inFlight) {
      inFlight = runCheck().finally(() => { inFlight = null; });
    }
    return inFlight;
  }

  async function getFreshStatus() {
    if (inFlight) {
      await inFlight;
    } else if (nextCheckAt === null || now() >= Date.parse(nextCheckAt)) {
      nextCheckAt = new Date(now() + CHECK_INTERVAL).toISOString();
      await check();
    }
    return getStatus();
  }

  function getStatus() {
    const samples = history.filter(sample => now() - Date.parse(sample.checkedAt) <= HISTORY_WINDOW);
    const counts = samples.filter(sample => sample.playerCount !== null).map(sample => sample.playerCount);
    const result = {
      ...latest, epicStatus, gameLift, checking, nextCheckAt, history: samples, recentPeak: counts.length ? Math.max(...counts) : null
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

  return { check, getStatus, getFreshStatus, start };
}
