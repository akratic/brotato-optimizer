export const WEAPON_STAT_LABELS = {
  melee: "Melee Damage",
  ranged: "Ranged Damage",
  elemental: "Elemental Damage",
  armor: "Armor",
  engineering: "Engineering",
  speed: "Speed",
  dodge: "Dodge",
  luck: "Luck",
  life_steal: "Life Steal",
  harvesting: "Harvesting",
  max_hp: "Max HP",
  range: "Range",
  dmgPct: "Damage %",
  atkSpd: "Attack Speed",
  crit: "Crit Chance",
};

export const EHP_STAT_LABELS = { hp: "HP", armor: "Armor", dodge: "Dodge" };

// Stats that display as a percentage in-game, regardless of whether they're
// the weapon's damage stat or one of dmgPct/atkSpd/crit.
const PERCENT_STATS = new Set(["dmgPct", "atkSpd", "crit", "dodge", "life_steal", "harvesting"]);

export function formatWeaponTotal(key, value, damageStat) {
  if (key !== damageStat) return `+${value}%`;
  return PERCENT_STATS.has(key) ? `+${value}%` : `+${value}`;
}
