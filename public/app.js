import { calcBuild, indexJokers, DEFAULT_SLOTS } from './calc.js';

const catalog = await (await fetch('jokers.json')).json();
const jokerById = indexJokers(catalog.jokers);
const searchText = new Map(catalog.jokers.map(joker =>
  [joker.id, `${joker.name} ${joker.effect}`.toLowerCase()]));
const weapons = [...new Set(catalog.jokers.flatMap(joker => joker.weapons))].sort();
const tiers = ['normal', 'fine', 'prime', 'mythic', 'legendary', 'unique'];
const MAX_SLOTS = 16;
const $ = id => document.getElementById(id);

const labels = {
  attackSpeed: 'Attack Speed', reloadSpeed: 'Reload Speed', emptyReloadSpeed: 'Empty-Clip Reload', damage: 'Damage',
  meleeDamage: 'Melee Damage', weakspotDamage: 'Weakspot Damage', regularHitDamage: 'Regular Hit Damage', moveSpeed: 'Speed',
  gravity: 'Gravity', jumpHeight: 'Jump Height', extraJumps: 'Extra Jumps', extraDashes: 'Extra Dashes', maxHp: 'Health',
  damageTaken: 'Damage Taken', healingReceived: 'Healing Received', spellCooldown: 'Spell Cooldown Reduction', shield: 'Shield',
  lifesteal: 'Lifesteal', meleeLifesteal: 'Melee Lifesteal', swapSpeed: 'Weapon Swap Speed', ammoBag: 'Ammo Bag',
  utilityAmmo: 'Utility Ammo', shopDiscount: 'Shop Discount', missionGold: 'Mission Gold', missionSouls: 'Mission Souls',
  accuracy: 'Accuracy', meleeSpeed: 'Melee Speed', meleeRange: 'Melee Range', heal: 'Heal', hpRegen: 'HP Regeneration'
};

const label = stat => labels[stat] ?? stat.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());

const statFamilies = [
  [['ammoBag', 'utilityAmmo', 'ammoRegen', 'ammoSaveChance', 'ammoBoxChance', 'ammoRefundChance'], '#b43ff0', 'ammo'],
  [['maxHp', 'heal', 'hpRegen', 'lifesteal', 'meleeLifesteal', 'hp', 'bottleHealing'], '#8ed21f', 'health'],
  [['spellCooldown', 'spellCooldownReduction'], '#2f9bff', 'spell'],
  [['moveSpeed', 'attackSpeed', 'reloadSpeed', 'meleeSpeed', 'swapSpeed', 'emptyReloadSpeed', 'fireRate'], '#f5c400', 'speed'],
  [['jumpHeight', 'extraJumps', 'extraDashes', 'gravity'], '#9be15d', 'movement'],
  [['damage', 'meleeDamage', 'weakspotDamage', 'regularHitDamage', 'flatDamage', 'markedDamageTaken'], '#f0683a', 'damage'],
  [['damageTaken', 'shield', 'shieldGain', 'minShield', 'healingReceived', 'shieldCost', 'shieldDecay'], '#35c9d6', 'shield']
];
const family = stat => statFamilies.find(group => group[0].includes(stat)) ?? [null, '#d9a441', 'generic'];

const statIcon = icon => {
  const icons = {
    ammo: '<rect x="8" y="7" width="16" height="18" rx="2"/><path d="M12 7V4h8v3M12 12h8M12 17h8" fill="none" stroke="currentColor" stroke-width="2"/>',
    health: '<path d="M12 4h8v8h8v8h-8v8h-8v-8H4v-8h8z"/>',
    spell: '<path d="m19 3-11 12h7l-2 14 11-17h-8zm-14 5 4 2-4 5zm16 13 4-2-2 6z"/>',
    speed: '<path d="M3 7h6l9 9-9 9H3l9-9zm13 0h6l9 9-9 9h-6l9-9z"/>',
    movement: '<path d="M14.5 5 10 10.5h3.25v4.3l-3.8-3.5a1.25 1.25 0 0 0-1.97.37l-2.3 4.6a1.25 1.25 0 1 0 2.24 1.12l1.68-3.36 4.55 4.2a1.25 1.25 0 0 0 2.1-.92V10.5H19L14.5 5z"/>',
    damage: '<path d="m16 3 3 9 10-3-7 8 7 8-10-3-3 7-3-7-10 3 7-8-7-8 10 3z"/>',
    shield: '<path d="M16 3 27 8v8c0 7-4 12-11 15C9 28 5 23 5 16V8z"/><path d="M16 7 23 10v6c0 5-2 8-7 11-5-3-7-6-7-11v-6z" fill="none" stroke="#1a1006" stroke-width="2"/>',
    generic: '<rect x="7" y="7" width="18" height="18" rx="3" transform="rotate(45 16 16)"/>'
  };
  return `<svg viewBox="${icon === 'movement' ? '0 0 24 24' : '0 0 32 32'}" aria-hidden="true">${icons[icon] ?? icons.generic}</svg>`;
};
const units = { '%': '%', flat: '', hp: ' HP', sp: ' SP', sec: ' s', x: '×', 'hp/sec': ' HP/s' };
const formatStat = (value, unit) => `${unit !== 'x' && value > 0 ? '+' : ''}${+value.toFixed(2)}${units[unit] ?? ''}`;
const invertedStats = new Set(['gravity', 'damageTaken', 'spellCooldown', 'shieldDecay']);
const statClass = (stat, value) => ((value > 0) !== invertedStats.has(stat) ? 'pos' : 'neg');
const tierColors = { normal: '#a7adb3', fine: '#7ccf6b', prime: '#4ea7f0', mythic: '#c070f0', legendary: '#f2a516', unique: '#ff5b4f' };
const soulIcon = '<svg class="soul-icon" viewBox="80 85 240 315" role="img" aria-label="Souls"><path d="M 213 92 C 188 112, 174 134, 182 152 C 188 164, 200 168, 198 180 C 194 196, 162 216, 132 232 L 256 290 L 223 356 C 192 344, 152 324, 156 300 C 159 283, 178 282, 186 293 C 191 300, 189 310, 185 316 C 202 315, 212 298, 207 281 C 200 260, 168 248, 134 244 L 88 302 C 128 340, 178 370, 236 392 L 313 271 L 216 226 C 238 214, 248 194, 242 174 C 235 154, 212 142, 207 124 C 204 113, 207 102, 213 92 Z"/></svg>';

const freshPlan = () => ({ rails: [{ type: 'hero', slotsMax: DEFAULT_SLOTS, jokers: [] }], active: 0, tier: 'all', q: '', showAll: false });

const bytesToBase64 = bytes => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64ToBytes = value => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};

async function loadPlan() {
  try {
    const h = location.hash.slice(1);
    if (h.startsWith('c=') && 'DecompressionStream' in window) {
      const stream = new Blob([base64ToBytes(h.slice(2))]).stream().pipeThrough(new DecompressionStream('deflate'));
      const s = JSON.parse(await new Response(stream).text());
      return { ...freshPlan(), rails: s.rails, active: 0 };
    }
    if (!h.startsWith('b=')) return null;
    const s = JSON.parse(decodeURIComponent(escape(atob(h.slice(2)))));
    return { ...freshPlan(), rails: s.rails, active: 0 };
  } catch { return null; }
}
const loadedPlan = await loadPlan();
const hasOverLimitSharedPlan = Array.isArray(loadedPlan?.rails) &&
  loadedPlan.rails.some(rail => rail.slotsMax > MAX_SLOTS);
let plan = hasOverLimitSharedPlan ? freshPlan() : (loadedPlan ?? freshPlan());
let previousStats = {};
const hasInvalidSlotLimit = () => plan.rails.some(rail =>
  !Number.isFinite(rail.slotsMax ?? DEFAULT_SLOTS) ||
  (rail.slotsMax ?? DEFAULT_SLOTS) < 1 ||
  (rail.slotsMax ?? DEFAULT_SLOTS) > MAX_SLOTS);
let saveVersion = 0;
const savePlan = async () => {
  if (hasInvalidSlotLimit()) return false;
  const version = ++saveVersion;
  const state = JSON.stringify({ rails: plan.rails });
  if ('CompressionStream' in window) {
    const stream = new Blob([state]).stream().pipeThrough(new CompressionStream('deflate'));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    if (version === saveVersion) history.replaceState(null, '', '#c=' + bytesToBase64(compressed));
    return true;
  }
  const encoded = btoa(unescape(encodeURIComponent(state)));
  if (version === saveVersion) history.replaceState(null, '', '#b=' + encoded);
  return true;
};

const activeRail = () => plan.rails[plan.active];
const countOf = (rail, id) => rail.jokers.find(joker => joker.id === id)?.count ?? 0;
const slotsUsedOnRail = rail => rail.jokers.reduce((total, entry) =>
  total + (jokerById.get(entry.id)?.slotCost ?? 0) * (entry.count ?? 1), 0);
const canSetCount = (rail, joker, count) => {
  const currentCount = countOf(rail, joker.id);
  const nextSlotsUsed = slotsUsedOnRail(rail) - joker.slotCost * currentCount + joker.slotCost * count;
  return count <= currentCount || nextSlotsUsed <= MAX_SLOTS;
};

function setCount(rail, id, count) {
  const joker = jokerById.get(id);
  count = Math.max(0, Math.min(count, joker.maxStack));
  if (!canSetCount(rail, joker, count)) return false;
  const entry = rail.jokers.find(joker => joker.id === id);
  if (entry) entry.count = count;
  else if (count) rail.jokers.push({ id, count });
  rail.jokers = rail.jokers.filter(joker => joker.count > 0);
  return true;
}

const compatible = (joker, rail) => rail.type === 'hero'
  ? joker.scope === 'hero'
  : joker.scope === 'weapon' && (!rail.weapon || joker.weapons.includes(rail.weapon));
const stepper = (id, value) => `<div class="stepper" id="${id}"><button data-d="-1">&lt;</button><span>${value}</span><button data-d="1">&gt;</button></div>`;

function renderFilters() {
  $('filters').innerHTML = `<input type="text" id="q" placeholder="Search name or effect...">` +
    ['all', ...tiers].map(tier => `<button class="chip ${plan.tier === tier ? 'on' : ''}" data-tier="${tier}">${tier}</button>`).join('') +
    `<label class="chip"><input type="checkbox" id="showAll" ${plan.showAll ? 'checked' : ''}> incompatible</label>`;
  $('q').value = plan.q;
  $('q').oninput = event => { plan.q = event.target.value; renderCatalog(); };
  $('showAll').onchange = event => { plan.showAll = event.target.checked; renderCatalog(); };
  $('filters').querySelectorAll('[data-tier]').forEach(button => button.onclick = () => {
    plan.tier = button.dataset.tier;
    renderFilters();
    renderCatalog();
  });
}

function renderCatalog() {
  const rail = activeRail(), query = plan.q.toLowerCase();
  const matches = catalog.jokers.filter(joker =>
    !(joker.obtain?.length === 1 && joker.obtain[0] === 'mission_loot') &&
    (plan.tier === 'all' || joker.tier === plan.tier) &&
    (plan.showAll || compatible(joker, rail)) &&
    (!query || searchText.get(joker.id).includes(query)));

  $('catalog').innerHTML = matches.map(joker => {
    const count = countOf(rail, joker.id), canEquip = compatible(joker, rail);
    return `<div class="card" style="--c:${tierColors[joker.tier]}">
      <span class="n">${joker.name}</span>
      <button class="plus" data-add="${joker.id}" ${!canEquip || count >= joker.maxStack || !canSetCount(rail, joker, count + 1) ? 'disabled' : ''}>+</button>
      <span class="e">${joker.effect}</span>
      <span class="meta">${joker.tier} · ${joker.slotCost} slot${joker.slotCost > 1 ? 's' : ''} · max ${joker.maxStack}${joker.soulCost ? ` · ${joker.soulCost.toLocaleString()} ${soulIcon}` : ''}${count ? ` · equipped ×${count}` : ''}${joker.scope === 'weapon' && joker.weapons.length < 14 ? ` · ${joker.weapons.join(', ')}` : ''}</span>
    </div>`;
  }).join('') || '<div class="empty">No jokers match.</div>';
  $('catalog').querySelectorAll('[data-add]').forEach(button => button.onclick = () => {
    const id = button.dataset.add;
    if (setCount(rail, id, countOf(rail, id) + 1)) update();
  });
}

function renderTabs() {
  $('tabs').innerHTML = plan.rails.map((rail, index) =>
    `<button class="tab ${index === plan.active ? 'on' : ''}" data-i="${index}">${rail.type === 'hero' ? 'Hero' : (rail.weapon || 'Weapon')}</button>`).join('') +
    `<button class="tab" id="addRail">+ Weapon</button>`;
  $('tabs').querySelectorAll('[data-i]').forEach(button => button.onclick = () => {
    plan.active = +button.dataset.i;
    renderAll();
  });
  $('addRail').onclick = () => {
    plan.rails.push({ type: 'weapon', weapon: 'Revolver', slotsMax: DEFAULT_SLOTS, jokers: [] });
    plan.active = plan.rails.length - 1;
    renderAll();
  };
}

function slotCircles(rail, stats) {
  const cells = [];
  let number = 0;
  rail.jokers.forEach(({ id, count }) => {
    const joker = jokerById.get(id);
    for (let n = 0; n < count; n++) {
      number++;
      for (let slot = 0; slot < joker.slotCost; slot++) {
        cells.push({ joker, first: slot === 0, id, number });
      }
    }
  });
  const rows = Math.ceil(Math.max(14, stats.slotsMax, cells.length) / 7) * 7;
  let html = '';
  for (let index = 0; index < rows; index++) {
    const cell = cells[index];
    if (cell) html += `<button class="slot filled ${index >= stats.slotsMax ? 'over' : ''} ${cell.first ? '' : 'cont'}" style="--tc:${tierColors[cell.joker.tier]}" data-rm="${cell.id}" title="${cell.joker.name} - click to remove one">${cell.first ? cell.number : ''}</button>`;
    else if (index < stats.slotsMax) html += '<button class="slot" data-focus title="Empty slot">+</button>';
    else html += `<button class="slot locked" tabindex="-1"></button>`;
  }
  return html;
}

function renderRail(build) {
  const rail = activeRail(), stats = build[plan.active];
  $('railTitle').textContent = rail.type === 'hero' ? 'Hero' : (rail.weapon || 'Weapon');
  $('railSlots').textContent = `${stats.slotsUsed} / ${stats.slotsMax}`;
  const pipCount = Math.max(14, stats.slotsMax, stats.slotsUsed);
  const pips = Array.from({ length: pipCount }, (_, index) =>
    `<i class="pip ${index < stats.slotsUsed ? (stats.slotsUsed > stats.slotsMax ? 'over' : 'on') : ''}"></i>`).join('');
  $('rail').innerHTML = `
    <div class="pipwrap"><span class="l">Joker slots</span><div class="pips">${pips}</div><span class="cnt">${stats.slotsUsed}/${stats.slotsMax}</span></div>
    ${rail.type === 'weapon' ? `<div class="setrow"><span class="l">Weapon</span>${stepper('weaponStep', rail.weapon)}</div>` : ''}
    <div class="setrow"><span class="l">Unlocked slots</span>${stepper('slotStep', stats.slotsMax)}${rail.type === 'weapon' ? '<button class="btn" id="delRail">Remove</button>' : ''}</div>
    <div class="slots">${slotCircles(rail, stats)}</div>
    ${stats.errors.map(error => `<div class="err">${error}</div>`).join('')}
    ${rail.jokers.map(({ id, count }) => {
      const joker = jokerById.get(id);
      return `<div class="row" style="--c:${tierColors[joker.tier]}">
        <div class="t"><b>${joker.name}</b><small>${joker.effect}</small></div>
        <div class="qty"><button class="mini" data-m="${id}">-</button><b>${count}</b><button class="mini" data-p="${id}" ${count >= joker.maxStack || !canSetCount(rail, joker, count + 1) ? 'disabled' : ''}>+</button></div>
      </div>`;
    }).join('') || '<div class="empty">No jokers yet - press + on a joker in the list.</div>'}`;
  if (rail.type === 'weapon') {
    $('weaponStep').onclick = event => {
      const direction = +event.target.dataset.d;
      if (!direction) return;
      const index = weapons.indexOf(rail.weapon);
      rail.weapon = weapons[(index + direction + weapons.length) % weapons.length];
      renderTabs();
      update();
    };
    $('delRail').onclick = () => {
      plan.rails.splice(plan.active, 1);
      plan.active = 0;
      renderAll();
    };
  }
  $('slotStep').onclick = event => {
    const direction = +event.target.dataset.d;
    if (!direction) return;
    rail.slotsMax = Math.max(1, Math.min(MAX_SLOTS, (rail.slotsMax ?? DEFAULT_SLOTS) + direction));
    update();
  };
  $('rail').querySelectorAll('[data-rm], [data-m], [data-p]').forEach(button => button.onclick = () => {
    const id = button.dataset.rm || button.dataset.m || button.dataset.p;
    const amount = button.dataset.p ? 1 : -1;
    if (setCount(rail, id, countOf(rail, id) + amount)) update();
  });
  $('rail').querySelectorAll('[data-focus]').forEach(button => button.onclick = () => $('q')?.focus());
}

function statRow(stat, unit, value, options = {}) {
  const [, color, glyph] = family(stat);
  return `<div class="srow ${options.changed ? 'changed' : ''}" style="--c:${color}">
    <span class="ico">${statIcon(glyph)}</span>
    <span class="lbl">${label(stat)}${options.note ? `<small>${options.note}</small>` : ''}</span>
    <span class="val ${value ? statClass(stat, value) : ''}">${value ? formatStat(value, unit) : '0%'}${options.was !== undefined ? `<em>was ${options.was ? formatStat(options.was, unit) : '0'}</em>` : ''}</span></div>`;
}

function renderStats(build) {
  const bonuses = build[plan.active].effective;
  const currentStats = {};
  for (const bonus of Object.values(bonuses.passive)) {
    currentStats[`${bonus.stat}|${bonus.unit}`] = bonus;
  }

  const oldStats = previousStats[plan.active] ?? {};
  const hasPrevious = Object.keys(oldStats).length > 0;
  const keys = Object.keys(currentStats).sort((a, b) =>
    label(a.split('|')[0]).localeCompare(label(b.split('|')[0])));
  const rows = keys.map(key => {
    const [stat, unit] = key.split('|');
    const value = currentStats[key]?.value ?? 0;
    const oldValue = oldStats[key]?.value ?? 0;
    const changed = hasPrevious && value !== oldValue;
    return statRow(stat, unit, value, changed ? { changed, was: oldValue } : {});
  }).join('');
  const conditional = bonuses.conditional
    .map(bonus => statRow(bonus.stat, bonus.unit, bonus.value, { note: bonus.note }))
    .join('');
  const rail = activeRail();
  $('stats').innerHTML = `
    <div class="hint">${rail.type === 'weapon' ? `${rail.weapon || 'Weapon'} rail combined with Hero rail.` : 'Hero rail.'} Bonuses are added together.</div>
    <h3>Always active</h3>${rows || '<div class="empty">No flat stat bonuses.</div>'}
    <h3>Conditional / scaling</h3>${conditional || '<div class="empty">None.</div>'}`;
  previousStats[plan.active] = currentStats;
}

function update() {
  const build = calcBuild(catalog, plan.rails, jokerById);
  renderRail(build);
  renderStats(build);
  renderCatalog();
  renderSoulTotal();
  $('share').disabled = hasInvalidSlotLimit();
  savePlan();
}

function renderSoulTotal() {
  let total = 0;
  for (const rail of plan.rails) {
    for (const { id, count = 1 } of rail.jokers) {
      total += jokerById.get(id).soulCost * count;
    }
  }
  $('soulTotal').innerHTML = `Total: ${total.toLocaleString()} ${soulIcon}`;
}

function renderAll() {
  renderTabs();
  renderFilters();
  update();
}

$('reset').onclick = () => {
  plan = freshPlan();
  previousStats = {};
  renderAll();
};

$('share').onclick = async () => {
  if (hasInvalidSlotLimit()) return;
  await savePlan();
  try {
    await navigator.clipboard.writeText(location.href);
    $('share').textContent = 'Copied!';
    setTimeout(() => $('share').textContent = 'Copy share link', 1500);
  } catch {
    prompt('Copy this link:', location.href);
  }
};

if (hasOverLimitSharedPlan) {
  document.body.style.background = '#000';
  $('app').innerHTML = '<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); display:flex; flex-direction:column; align-items:center; gap:14px; max-width:90vw"><div class="err" role="alert" style="margin:0; padding:12px 18px; font-size:24px; text-align:center">Error 67: Build exceeds maximum build slots</div><button class="btn" id="errorReturn" type="button">Return</button></div>';
  $('errorReturn').onclick = () => location.replace(location.pathname + location.search);
} else {
  renderAll();
}
