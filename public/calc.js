export const DEFAULT_SLOTS = 14;

export const PARAM_STATS = new Set([
  'duration', 'cooldown', 'delay', 'interval', 'minCooldown', 'baseCooldownMax', 'clipPortion',
  'goldPerHp', 'hpCap', 'bulletsPerBurst', 'killCounterThreshold', 'markDuration', 'hpThreshold',
  'maxMeleeSpeed', 'maxReloadSpeed', 'maxDamage', 'maxBonus', 'maxOverhealShield', 'meleeDamageMax',
  'executeThreshold', 'minShield', 'bullets', 'arrows', 'homingBullets'
]);

export const indexJokers = jokers => new Map(jokers.map(joker => [joker.id, joker]));
const statKey = (stat, unit) => `${stat}|${unit}`;

function addPassive(stats, stat, unit, value) {
  const key = statKey(stat, unit);
  stats[key] = { stat, unit, value: Math.round(((stats[key]?.value ?? 0) + value) * 1000) / 1000 };
}

function addConditional(bonuses, stat, unit, note, value, source) {
  const match = bonuses.find(bonus => bonus.stat === stat && bonus.unit === unit && bonus.note === note);
  if (match) {
    match.value = Math.round((match.value + value) * 1000) / 1000;
    match.sources.push(source);
  } else {
    bonuses.push({ stat, unit, note, value, sources: [source] });
  }
}

export function calcRail(rail, jokerById, totalJokers) {
  const result = {
    slotsUsed: 0, slotsMax: rail.slotsMax ?? DEFAULT_SLOTS,
    passive: {}, conditional: [], errors: [], tiers: new Set(), count: 0
  };
  const entries = [];

  for (const { id, count = 1 } of rail.jokers) {
    const joker = jokerById.get(id);
    if (!joker) {
      result.errors.push(`Unknown joker: ${id}`);
      continue;
    }

    if (count > joker.maxStack) result.errors.push(`${joker.name}: max stack is ${joker.maxStack}`);
    if (rail.type === 'hero' && joker.scope !== 'hero') result.errors.push(`${joker.name} is a weapon joker and cannot go on the hero`);
    if (rail.type === 'weapon') {
      if (joker.scope === 'hero') result.errors.push(`${joker.name} is a hero joker and cannot go on a weapon`);
      else if (rail.weapon && !joker.weapons.includes(rail.weapon)) result.errors.push(`${joker.name} does not work with ${rail.weapon}`);
    }
    result.slotsUsed += joker.slotCost * count;
    result.count += count;
    result.tiers.add(joker.tier);
    entries.push({ joker, count });
  }
  if (result.slotsUsed > result.slotsMax) {
    result.errors.push(`Slot budget exceeded: ${result.slotsUsed}/${result.slotsMax}`);
  }

  for (const { joker, count } of entries) {
    for (const bonus of joker.stats) {
      if (PARAM_STATS.has(bonus.stat)) continue;
      const value = bonus.value * count;

      // These perks scale from the rail, not only their own stack count.
      if (joker.id === 'joker-trick') {
        addPassive(result.passive, bonus.stat, bonus.unit, value * result.tiers.size);
        continue;
      }
      if (joker.id === 'joker-dealer' && bonus.stat === 'maxHp') {
        addPassive(result.passive, bonus.stat, bonus.unit, value * totalJokers);
        continue;
      }
      if (bonus.note) addConditional(result.conditional, bonus.stat, bonus.unit, bonus.note, value, joker.name);
      else addPassive(result.passive, bonus.stat, bonus.unit, value);
    }
  }

  result.tiers = [...result.tiers];
  return result;
}

export function mergeRails(hero, weapon) {
  const passive = {};
  for (const rail of [hero.passive, weapon.passive]) {
    for (const bonus of Object.values(rail)) addPassive(passive, bonus.stat, bonus.unit, bonus.value);
  }

  const conditional = [];
  for (const rail of [hero.conditional, weapon.conditional]) {
    for (const bonus of rail) {
      addConditional(conditional, bonus.stat, bonus.unit, bonus.note, bonus.value, ...bonus.sources);
    }
  }
  return { passive, conditional };
}

export function calcBuild(catalog, rails, jokerById = indexJokers(catalog.jokers)) {
  const totalJokers = rails.reduce((total, rail) =>
    total + rail.jokers.reduce((count, joker) => count + (joker.count ?? 1), 0), 0);
  const results = rails.map(rail => calcRail(rail, jokerById, totalJokers));
  const heroIndex = rails.findIndex(rail => rail.type === 'hero');
  const hero = results[heroIndex] ?? { passive: {}, conditional: [] };

  return results.map((result, index) => ({
    ...result,
    effective: rails[index].type === 'weapon'
      ? mergeRails(hero, result)
      : { passive: result.passive, conditional: result.conditional }
  }));
}
