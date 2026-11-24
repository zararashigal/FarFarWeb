import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jokers = JSON.parse(readFileSync(path.join(__dirname, 'public', 'jokers.json'), 'utf8')).jokers;
const app = express();

app.use(express.static(path.join(__dirname, 'public')));
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
