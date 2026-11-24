import { calcBuild, indexJokers, DEFAULT_SLOTS } from './calc.js';

const catalog = await (await fetch('jokers.json')).json();
const spellData = await (await fetch('/api/spells')).json();
const jokerById = indexJokers(catalog.jokers);
const spellById = new Map(spellData.spells.map(spell => [spell.id, spell]));
const spellSchoolById = new Map(spellData.schools.map(school => [school.id, school]));
let totalSpellCooldown = 0;
const spellCooldownText = spell => {
  const cooldown = Math.max(0, spell.cooldown * (1 + totalSpellCooldown / 100));
  return totalSpellCooldown
    ? `${+cooldown.toFixed(2)}s cooldown (${spell.cooldown}s base)`
    : `${spell.cooldown}s cooldown`;
};
const spellMetaText = spell =>
  `${spellSchoolById.get(spell.school)?.name ?? spell.school} · ${spellCooldownText(spell)}`;
const searchText = new Map(catalog.jokers.map(joker =>
  [joker.id, `${joker.name} ${joker.effect}`.toLowerCase()]));
const weapons = [...new Set(catalog.jokers.flatMap(joker => joker.weapons))].sort();
const tiers = ['normal', 'fine', 'prime', 'mythic', 'legendary', 'unique'];
const MAX_SLOTS = 16;
const MAX_UPGRADE_SLOTS = 26;
const MAX_WEAPON_RAILS = 2;
const SPELL_SLOT_COUNT = 3;
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
const upgradeStats = [
  { id: 'ammoBag', stat: 'ammoBag', label: 'Ammo Bag', perPoint: 5, max: 16, unit: '%' },
  { id: 'health', stat: 'maxHp', label: 'Health', perPoint: 5, max: 6, unit: '%', displayUnit: '' },
  { id: 'spellCooldown', stat: 'spellCooldown', label: 'Spell Cooldown Reduction', perPoint: 2, max: 6, unit: '%', totalSign: -1 },
  { id: 'speed', stat: 'moveSpeed', label: 'Speed', perPoint: 4, max: 6, unit: '%' },
  { id: 'jumpHeight', stat: 'jumpHeight', label: 'Jump Height', perPoint: 7, max: 6, unit: '%' }
];

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
const spellGlyphs = {
  acid: '<path d="M16 3C13 8 8 14 8 20a8 8 0 0 0 16 0c0-6-5-12-8-17z"/><path d="M13 21c0-2 2-5 3-6" fill="none" stroke="#1a1006" stroke-width="2"/>',
  cactus: '<path d="M13 28V12a3 3 0 0 1 6 0v16h-6zM13 20h-3a4 4 0 0 1-4-4v-3h4v3h3zm6-5h3a4 4 0 0 0 4-4V8h-4v3h-3z"/>',
  elec: '<path d="m18 2-9 16h7l-2 12 11-18h-7z"/>',
  fire: '<path d="M18 2c1 7-5 8-3 13 1-2 3-3 5-5 5 7 7 11 4 16a10 10 0 0 1-18-5c0-5 4-9 8-13 0 5 2 6 3 7 2-4 3-8 1-13z"/>',
  frost: '<path d="M16 3v26M4.7 9.5l22.6 13M4.7 22.5l22.6-13M12 5l4 4 4-4M12 27l4-4 4 4M5 14l5-1-1-5M27 18l-5 1 1 5M5 18l5 1-1 5M27 14l-5-1 1-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  voodoo: '<path d="M16 3a11 11 0 0 0-7 19v5h14v-5a11 11 0 0 0-7-19zm-4 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm8 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-7 8h6l-3 3z"/>'
};
const schoolColors = {
  acid: '#8ed21f',
  cactus: '#9be15d',
  elec: '#2f9bff',
  fire: '#f0683a',
  frost: '#35c9d6',
  voodoo: '#b43ff0'
};
const spellIcon = school => `<svg viewBox="0 0 32 32" aria-hidden="true">${spellGlyphs[school] ?? spellGlyphs.acid}</svg>`;
const emptySpellIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M15 5h2v22h-2zM5 15h22v2H5z"/></svg>';
const units = { '%': '%', flat: '', hp: ' HP', sp: ' SP', sec: ' s', x: '×', 'hp/sec': ' HP/s' };
const formatStat = (value, unit) => `${unit !== 'x' && value > 0 ? '+' : ''}${+value.toFixed(2)}${units[unit] ?? ''}`;
const invertedStats = new Set(['gravity', 'damageTaken', 'spellCooldown', 'shieldDecay']);
const statClass = (stat, value) => ((value > 0) !== invertedStats.has(stat) ? 'pos' : 'neg');
const tierColors = { normal: '#a7adb3', fine: '#7ccf6b', prime: '#4ea7f0', mythic: '#c070f0', legendary: '#f2a516', unique: '#ff5b4f' };
const soulIcon = '<svg class="soul-icon" viewBox="80 85 240 315" role="img" aria-label="Souls"><path d="M 213 92 C 188 112, 174 134, 182 152 C 188 164, 200 168, 198 180 C 194 196, 162 216, 132 232 L 256 290 L 223 356 C 192 344, 152 324, 156 300 C 159 283, 178 282, 186 293 C 191 300, 189 310, 185 316 C 202 315, 212 298, 207 281 C 200 260, 168 248, 134 244 L 88 302 C 128 340, 178 370, 236 392 L 313 271 L 216 226 C 238 214, 248 194, 242 174 C 235 154, 212 142, 207 124 C 204 113, 207 102, 213 92 Z"/></svg>';

const freshUpgrades = () => ({ ammoBag: 0, health: 0, spellCooldown: 0, speed: 0, jumpHeight: 0 });
const upgradeSlotCount = upgrades => upgradeStats.reduce((total, stat) => total + upgrades[stat.id], 0);
const normalizeUpgrades = upgrades => {
  const normalized = freshUpgrades();
  let remaining = MAX_UPGRADE_SLOTS;
  for (const stat of upgradeStats) {
    const points = Number.isInteger(upgrades?.[stat.id]) ? upgrades[stat.id] : 0;
    normalized[stat.id] = Math.max(0, Math.min(points, stat.max, remaining));
    remaining -= normalized[stat.id];
  }
  return normalized;
};
const normalizeSpells = spells => Array.from({ length: SPELL_SLOT_COUNT }, (_, index) => {
  const id = Array.isArray(spells) && typeof spells[index] === 'string' ? spells[index] : '';
  return spellById.has(id) ? id : '';
});
const freshPlan = () => ({ name: '', upgrades: freshUpgrades(), spells: normalizeSpells(), rails: [{ type: 'hero', slotsMax: DEFAULT_SLOTS, jokers: [] }], active: 0, tier: 'all', q: '', showAll: false });

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

const normalizeRail = rail => {
  if (!rail || typeof rail !== 'object' || !['hero', 'weapon'].includes(rail.type)) return null;
  const slotsMax = Number.isInteger(rail.slotsMax)
    ? Math.max(1, Math.min(rail.slotsMax, MAX_SLOTS + 1))
    : DEFAULT_SLOTS;
  const counts = new Map();

  for (const entry of Array.isArray(rail.jokers) ? rail.jokers : []) {
    if (!entry || typeof entry.id !== 'string') continue;
    const joker = jokerById.get(entry.id);
    const count = entry.count ?? 1;
    if (!joker || !Number.isSafeInteger(count) || count < 1) continue;
    counts.set(entry.id, Math.min(joker.maxStack, (counts.get(entry.id) ?? 0) + count));
  }

  return {
    type: rail.type,
    ...(rail.type === 'weapon' ? { weapon: weapons.includes(rail.weapon) ? rail.weapon : weapons[0] } : {}),
    slotsMax,
    jokers: [...counts].map(([id, count]) => ({ id, count }))
  };
};

const restorePlan = state => {
  const rails = [];
  let weaponRailCount = 0;
  for (const rail of Array.isArray(state?.rails) ? state.rails : []) {
    const normalized = normalizeRail(rail);
    if (!normalized) continue;
    if (normalized.type === 'weapon' && weaponRailCount >= MAX_WEAPON_RAILS) continue;
    if (normalized.type === 'weapon') weaponRailCount++;
    rails.push(normalized);
  }
  if (!rails.some(rail => rail.type === 'hero')) rails.unshift(freshPlan().rails[0]);
  return {
    ...freshPlan(),
    name: typeof state?.name === 'string' ? state.name.slice(0, 12) : '',
    upgrades: normalizeUpgrades(state?.upgrades),
    spells: normalizeSpells(state?.spells),
    rails,
    active: 0
  };
};

async function loadPlan() {
  try {
    const h = location.hash.slice(1);
    if (h.startsWith('c=') && 'DecompressionStream' in window) {
      const stream = new Blob([base64ToBytes(h.slice(2))]).stream().pipeThrough(new DecompressionStream('deflate'));
      const s = JSON.parse(await new Response(stream).text());
      return restorePlan(s);
    }
    if (!h.startsWith('b=')) return null;
    const s = JSON.parse(decodeURIComponent(escape(atob(h.slice(2)))));
    return restorePlan(s);
  } catch { return null; }
}
const loadedPlan = await loadPlan();
const hasOverLimitSharedPlan = Array.isArray(loadedPlan?.rails) &&
  loadedPlan.rails.some(rail => rail.slotsMax > MAX_SLOTS);
let plan = hasOverLimitSharedPlan ? freshPlan() : (loadedPlan ?? freshPlan());
let previousStats = {};
let previousTotals = {};
const hasInvalidSlotLimit = () => plan.rails.some(rail =>
  !Number.isFinite(rail.slotsMax ?? DEFAULT_SLOTS) ||
  (rail.slotsMax ?? DEFAULT_SLOTS) < 1 ||
  (rail.slotsMax ?? DEFAULT_SLOTS) > MAX_SLOTS);
let saveVersion = 0;
const savePlan = async () => {
  if (hasInvalidSlotLimit()) return false;
  const version = ++saveVersion;
  const state = JSON.stringify({ name: plan.name, upgrades: plan.upgrades, spells: plan.spells, rails: plan.rails });
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
const setUpgrade = (id, direction) => {
  const stat = upgradeStats.find(entry => entry.id === id);
  if (!stat) return false;
  const current = plan.upgrades[id];
  const next = current + direction;
  if (next < 0 || next > stat.max) return false;
  if (direction > 0 && upgradeSlotCount(plan.upgrades) >= MAX_UPGRADE_SLOTS) return false;
  plan.upgrades[id] = next;
  return true;
};
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

let activeSpellSlot = -1;

function closeSpellPicker() {
  const container = $('spellSlots');
  container?.querySelectorAll('.spell-slot-wrap.open').forEach(wrapper => {
    wrapper.classList.remove('open');
    wrapper.querySelector('.spell-slot').setAttribute('aria-expanded', 'false');
  });
  container?.querySelector('.spell-picker')?.classList.remove('open');
  activeSpellSlot = -1;
}

function renderSpells() {
  const container = $('spellSlots');
  container.replaceChildren();
  activeSpellSlot = -1;
  const wrappers = [];

  for (let index = 0; index < SPELL_SLOT_COUNT; index++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'spell-slot-wrap';
    const button = document.createElement('button');
    button.className = 'spell-slot';
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    const tooltip = document.createElement('div');
    tooltip.className = 'spell-tooltip';
    tooltip.id = `spellTooltip${index}`;
    tooltip.setAttribute('role', 'tooltip');
    const spellName = document.createElement('strong');
    const spellMeta = document.createElement('span');
    spellMeta.className = 'spell-meta';
    const spellEffect = document.createElement('span');
    spellEffect.className = 'spell-effect';
    tooltip.append(spellName, spellMeta, spellEffect);

    wrapper.append(button, tooltip);
    container.append(wrapper);
    wrappers.push({ wrapper, button, tooltip });

    const updateSlot = () => {
      const spell = spellById.get(plan.spells[index]);
      button.classList.toggle('filled', Boolean(spell));
      button.innerHTML = spell ? spellIcon(spell.school) : emptySpellIcon;
      button.style.setProperty('--c', spell ? schoolColors[spell.school] : 'var(--gold)');
      button.setAttribute('aria-controls', 'spellPicker');
      button.setAttribute('aria-label', spell
        ? `Spell slot ${index + 1}: ${spell.name}`
        : `Choose a spell for slot ${index + 1}`);
      button.setAttribute('aria-describedby', tooltip.id);
      spellName.textContent = spell?.name ?? `Spell slot ${index + 1}`;
      spellMeta.textContent = spell
        ? spellMetaText(spell)
        : 'Choose a spell';
      spellEffect.textContent = spell?.effect ?? '';
    };
    updateSlot();
    button.onclick = () => {
      const wasOpen = activeSpellSlot === index;
      closeSpellPicker();
      if (wasOpen) return;
      activeSpellSlot = index;
      wrapper.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      const picker = container.querySelector('.spell-picker');
      picker.classList.add('open');
      picker.style.top = window.matchMedia('(max-width: 1000px)').matches
        ? `${container.offsetHeight + 8}px`
        : `${wrapper.offsetTop}px`;
      picker.querySelector('label').textContent = `Spell slot ${index + 1}`;
      const select = picker.querySelector('select');
      select.setAttribute('aria-label', `Choose spell for slot ${index + 1}`);
      select.value = plan.spells[index];
      updatePickerInfo();
      select.focus();
    };
  }

  const picker = document.createElement('div');
  picker.className = 'spell-picker';
  picker.id = 'spellPicker';
  const title = document.createElement('label');
  title.htmlFor = 'spellPickerSelect';
  title.textContent = 'Choose spell';
  const select = document.createElement('select');
  select.id = title.htmlFor;
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Choose spell';
  select.append(empty);
  for (const school of spellData.schools) {
    const group = document.createElement('optgroup');
    group.label = school.name;
    for (const id of school.spells) {
      const spell = spellById.get(id);
      if (!spell) continue;
      const option = document.createElement('option');
      option.value = spell.id;
      option.textContent = spell.name;
      group.append(option);
    }
    select.append(group);
  }
  const info = document.createElement('div');
  info.className = 'spell-picker-info';
  const meta = document.createElement('span');
  meta.className = 'spell-meta';
  const effect = document.createElement('span');
  effect.className = 'spell-effect';
  info.append(meta, effect);
  picker.append(title, select, info);
  container.append(picker);

  const updatePickerInfo = () => {
    const spell = spellById.get(select.value);
    meta.textContent = spell
      ? spellMetaText(spell)
      : '';
    effect.textContent = spell?.effect ?? '';
  };
  select.onchange = () => {
    if (activeSpellSlot < 0) return;
    plan.spells[activeSpellSlot] = select.value;
    updatePickerInfo();
    const slot = wrappers[activeSpellSlot];
    const spell = spellById.get(select.value);
    slot.button.classList.toggle('filled', Boolean(spell));
    slot.button.innerHTML = spell ? spellIcon(spell.school) : emptySpellIcon;
    slot.button.style.setProperty('--c', spell ? schoolColors[spell.school] : 'var(--gold)');
    slot.button.setAttribute('aria-label', spell
      ? `Spell slot ${activeSpellSlot + 1}: ${spell.name}`
      : `Choose a spell for slot ${activeSpellSlot + 1}`);
    slot.spellName.textContent = spell?.name ?? `Spell slot ${activeSpellSlot + 1}`;
    slot.spellMeta.textContent = spell
      ? spellMetaText(spell)
      : 'Choose a spell';
    slot.spellEffect.textContent = spell?.effect ?? '';
    savePlan();
    closeSpellPicker();
  };

  for (const slot of wrappers) {
    slot.spellName = slot.tooltip.querySelector('strong');
    slot.spellMeta = slot.tooltip.querySelector('.spell-meta');
    slot.spellEffect = slot.tooltip.querySelector('.spell-effect');
  }
}

function updateSpellCooldownDisplays() {
  const container = $('spellSlots');
  container?.querySelectorAll('.spell-slot-wrap').forEach((wrapper, index) => {
    const spell = spellById.get(plan.spells[index]);
    if (spell) wrapper.querySelector('.spell-meta').textContent = spellMetaText(spell);
  });

  const select = container?.querySelector('.spell-picker select');
  const meta = container?.querySelector('.spell-picker-info .spell-meta');
  const spell = spellById.get(select?.value);
  if (meta) meta.textContent = spell ? spellMetaText(spell) : '';
}

document.addEventListener('click', event => {
  const container = $('spellSlots');
  if (!container) return;
  if (!container.contains(event.target)) {
    closeSpellPicker();
    return;
  }
  if (activeSpellSlot < 0) return;
  if (event.target instanceof Element && event.target.closest('.spell-picker, .spell-slot')) return;
  closeSpellPicker();
});

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
    `<button class="tab" id="addRail" ${plan.rails.filter(rail => rail.type === 'weapon').length >= MAX_WEAPON_RAILS ? 'disabled' : ''}>+ Weapon</button>`;
  $('tabs').querySelectorAll('[data-i]').forEach(button => button.onclick = () => {
    plan.active = +button.dataset.i;
    renderAll();
  });
  $('addRail').onclick = () => {
    if (plan.rails.filter(rail => rail.type === 'weapon').length >= MAX_WEAPON_RAILS) return;
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

function renderUpgrades() {
  const total = upgradeSlotCount(plan.upgrades);
  const totalPips = Array.from({ length: MAX_UPGRADE_SLOTS }, (_, index) =>
    `<i class="upgrade-total-pip ${index < total ? 'on' : ''}"></i>`).join('');
  const rows = upgradeStats.map(stat => {
    const points = plan.upgrades[stat.id], [, color, glyph] = family(stat.stat);
    const value = points * stat.perPoint;
    const pips = Array.from({ length: stat.max }, (_, index) =>
      `<i class="upgrade-pip ${index < points ? 'on' : ''}"></i>`).join('');
    return `<div class="upgrade-row" style="--c:${color}">
      <span class="upgrade-label"><span class="upgrade-icon">${statIcon(glyph)}</span><span>${stat.label}</span></span>
      <span class="upgrade-value">+${value}${stat.displayUnit ?? stat.unit}</span>
      <button class="upgrade-arrow" data-upgrade="${stat.id}" data-d="-1" ${points === 0 ? 'disabled' : ''}>&lt;</button>
      <span class="upgrade-pips">${pips}</span>
      <button class="upgrade-arrow" data-upgrade="${stat.id}" data-d="1" ${points >= stat.max || total >= MAX_UPGRADE_SLOTS ? 'disabled' : ''}>&gt;</button>
    </div>`;
  }).join('');
  return `<div class="upgrade-panel">
    <div class="upgrade-head"><span class="upgrade-title">Upgrade slots</span><div class="upgrade-total-pips">${totalPips}</div><span class="upgrade-count">${total}/${MAX_UPGRADE_SLOTS}</span></div>
    ${rows}
  </div>`;
}

function renderRail(build) {
  const rail = activeRail(), stats = build[plan.active];
  $('railTitle').textContent = rail.type === 'hero' ? 'Hero' : (rail.weapon || 'Weapon');
  $('railSlots').textContent = `${stats.slotsUsed} / ${stats.slotsMax}`;
  const pipCount = Math.max(14, stats.slotsMax, stats.slotsUsed);
  const pips = Array.from({ length: pipCount }, (_, index) =>
    `<i class="pip ${index < stats.slotsUsed ? (stats.slotsUsed > stats.slotsMax ? 'over' : 'on') : ''}"></i>`).join('');
  $('rail').innerHTML = `
    ${rail.type === 'hero' ? renderUpgrades() : ''}
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
  $('rail').querySelectorAll('[data-upgrade]').forEach(button => button.onclick = () => {
    if (setUpgrade(button.dataset.upgrade, +button.dataset.d)) update();
  });
  $('rail').querySelectorAll('[data-focus]').forEach(button => button.onclick = () => $('q')?.focus());
}

function statRow(stat, unit, value, options = {}) {
  const [, color, glyph] = family(stat);
  const displayValue = stat === 'spellCooldown' ? Math.abs(value) : value;
  const previousValue = options.was === undefined
    ? undefined
    : stat === 'spellCooldown' ? Math.abs(options.was) : options.was;
  return `<div class="srow ${options.changed ? 'changed' : ''}" style="--c:${color}">
    <span class="ico">${statIcon(glyph)}</span>
    <span class="lbl">${label(stat)}${options.note ? `<small>${options.note}</small>` : ''}</span>
    <span class="val ${value ? statClass(stat, value) : ''}">${value ? formatStat(displayValue, unit) : '0%'}${previousValue !== undefined ? `<em>was ${previousValue ? formatStat(previousValue, unit) : '0'}</em>` : ''}</span></div>`;
}

function renderStats(build) {
  const bonuses = build[plan.active].effective;
  const currentStats = {};
  for (const bonus of Object.values(bonuses.passive)) {
    currentStats[`${bonus.stat}|${bonus.unit}`] = bonus;
  }
  const totalStats = { ...currentStats };
  for (const stat of upgradeStats) {
    const points = plan.upgrades[stat.id];
    if (!points) continue;
    const unit = stat.totalUnit ?? stat.unit;
    const key = `${stat.stat}|${unit}`;
    totalStats[key] = {
      stat: stat.stat,
      unit,
      value: (totalStats[key]?.value ?? 0) + points * stat.perPoint * (stat.totalSign ?? 1)
    };
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
  const oldTotals = previousTotals[plan.active] ?? {};
  const hasPreviousTotal = Object.keys(oldTotals).length > 0;
  const totalKeys = Object.keys(totalStats).sort((a, b) =>
    label(a.split('|')[0]).localeCompare(label(b.split('|')[0])));
  const totalRows = totalKeys.map(key => {
    const [stat, unit] = key.split('|');
    const value = totalStats[key]?.value ?? 0;
    const oldValue = oldTotals[key]?.value ?? 0;
    const changed = hasPreviousTotal && value !== oldValue;
    return statRow(stat, unit, value, changed ? { changed, was: oldValue } : {});
  }).join('');
  const conditional = bonuses.conditional
    .map(bonus => statRow(bonus.stat, bonus.unit, bonus.value, { note: bonus.note }))
    .join('');
  const rail = activeRail();
  $('stats').innerHTML = `
    <div class="hint">${rail.type === 'weapon' ? `${rail.weapon || 'Weapon'} rail combined with Hero rail.` : 'Hero rail.'} Bonuses are added together.</div>
    <h3>Total</h3>${totalRows || '<div class="empty">No stat bonuses or base upgrades.</div>'}
    <h3>Always active</h3>${rows || '<div class="empty">No flat stat bonuses.</div>'}
    <h3>Conditional / scaling</h3>${conditional || '<div class="empty">None.</div>'}`;
  previousStats[plan.active] = currentStats;
  previousTotals[plan.active] = totalStats;
  return totalStats;
}

function update() {
  const build = calcBuild(catalog, plan.rails, jokerById);
  renderRail(build);
  const totalStats = renderStats(build);
  totalSpellCooldown = totalStats['spellCooldown|%']?.value ?? 0;
  updateSpellCooldownDisplays();
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
  $('buildName').value = plan.name;
  renderTabs();
  renderFilters();
  renderSpells();
  update();
}

$('buildName').oninput = event => {
  plan.name = event.target.value.slice(0, 12);
  event.target.value = plan.name;
  savePlan();
};

$('reset').onclick = () => {
  plan = freshPlan();
  previousStats = {};
  previousTotals = {};
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
