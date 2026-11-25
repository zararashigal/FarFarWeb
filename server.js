import express from 'express';
import QRCode from 'qrcode';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createSteamStatusMonitor } from './steam-status.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jokers = JSON.parse(readFileSync(path.join(__dirname, 'public', 'jokers.json'), 'utf8')).jokers;
const spells = JSON.parse(readFileSync(path.join(__dirname, 'spells.json'), 'utf8'));
const weaponUpgrades = JSON.parse(readFileSync(path.join(__dirname, 'weapon-upgrades.json'), 'utf8'));
const app = express();
const steamStatus = createSteamStatusMonitor();
const onVercel = Boolean(process.env.VERCEL);
if (!onVercel) steamStatus.start();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/status', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'status.html')));
app.get('/api/status', async (_req, res, next) => {
  try {
    const steam = onVercel ? await steamStatus.getFreshStatus() : steamStatus.getStatus();
    if (onVercel) {
      const maxAge = Math.floor((Date.parse(steam.nextCheckAt) - Date.now()) / 1000);
      res.set('Cache-Control', 'public, max-age=0, must-revalidate');
      if (maxAge > 0) res.set('Vercel-CDN-Cache-Control', `public, max-age=${maxAge}`);
    } else {
      res.set('Cache-Control', 'no-store');
    }
    res.json({ steam });
  } catch (error) {
    next(error);
  }
});
app.get('/api/spells', (_req, res) => res.json(spells));
app.get('/api/weapon-upgrades', (_req, res) => res.json(weaponUpgrades));
app.get('/api/qr', async (req, res, next) => {
  const value = req.query.url;
  if (typeof value !== 'string' || value.length > 2048) return res.status(400).send('Invalid QR URL');

  let url;
  try { url = new URL(value); } catch { return res.status(400).send('Invalid QR URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) return res.status(400).send('Invalid QR URL');

  try {
    const svg = await QRCode.toString(value, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 4,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.type('image/svg+xml').send(svg);
  } catch (error) {
    next(error);
  }
});
app.get('/api/jokers', (req, res) => {
  const { tier, weapon, scope, q } = req.query;
  const search = q && String(q).toLowerCase();
  res.json(jokers.filter(joker =>
    (!tier || joker.tier === tier) &&
    (!scope || joker.scope === scope) &&
    (!weapon || joker.weapons.includes(weapon)) &&
    (!search || `${joker.name} ${joker.effect}`.toLowerCase().includes(search))
  ));
});

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Server running @ http://localhost:${port}`));
