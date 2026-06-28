import { pick } from "./utils.js";

// Each upgrade: id, name, icon (emoji), desc, apply(player), optional repeatable & maxStacks.
export const UPGRADES = [
  {
    id: "damage", name: "Righteous Fury", icon: "\u2694\uFE0F",
    desc: "+25% Smite damage", repeatable: true,
    apply: (p) => { p.baseDamage *= 1.25; },
  },
  {
    id: "speed", name: "Swift Justice", icon: "\uD83D\uDC5F",
    desc: "+15% movement speed", repeatable: true, maxStacks: 4,
    apply: (p) => { p.speed *= 1.15; },
  },
  {
    id: "maxhp", name: "Fortitude", icon: "\u2764\uFE0F",
    desc: "+30 max HP and full heal", repeatable: true,
    apply: (p) => { p.maxHp += 30; p.hp = p.maxHp; },
  },
  {
    id: "crit", name: "Holy Precision", icon: "\u2728",
    desc: "+10% crit chance", repeatable: true, maxStacks: 6,
    apply: (p) => { p.critChance = Math.min(0.9, p.critChance + 0.1); },
  },
  {
    id: "attackspeed", name: "Zealotry", icon: "\u26A1",
    desc: "+18% attack speed", repeatable: true, maxStacks: 5,
    apply: (p) => { p.meleeCd *= 0.82; },
  },
  {
    id: "range", name: "Long Reach", icon: "\uD83D\uDCCF",
    desc: "+30% Smite range & arc", repeatable: true, maxStacks: 3,
    apply: (p) => { p.meleeRange *= 1.3; p.meleeArc = Math.min(Math.PI * 1.4, p.meleeArc * 1.15); },
  },
  {
    id: "lifesteal", name: "Vampiric Light", icon: "\uD83E\uDE78",
    desc: "Heal 8% of melee damage dealt", repeatable: true, maxStacks: 4,
    apply: (p) => { p.lifesteal += 0.08; },
  },
  {
    id: "armor", name: "Aegis", icon: "\uD83D\uDEE1\uFE0F",
    desc: "-12% damage taken", repeatable: true, maxStacks: 4,
    apply: (p) => { p.armor = Math.min(0.7, p.armor + 0.12); },
  },
  {
    id: "faith", name: "Devotion", icon: "\uD83D\uDD4A\uFE0F",
    desc: "+40% Faith regen & -15% ability costs", repeatable: true, maxStacks: 4,
    apply: (p) => { p.faithRegen *= 1.4; p.novaCost *= 0.85; p.consecrateCost *= 0.85; },
  },
  {
    id: "nova", name: "Greater Nova", icon: "\uD83D\uDCA5",
    desc: "Holy Nova: +40% damage & radius, -20% cooldown", repeatable: true, maxStacks: 3,
    apply: (p) => { p.novaCdMax *= 0.8; p.novaDmgMult = (p.novaDmgMult || 1) * 1.4; p.novaRadiusMult = (p.novaRadiusMult || 1) * 1.4; },
  },
  {
    id: "consecrate", name: "Hallowed Ground", icon: "\uD83D\uDD25",
    desc: "Consecrate: +50% DPS & duration", repeatable: true, maxStacks: 3,
    apply: (p) => { p.consecDmgMult = (p.consecDmgMult || 1) * 1.5; p.consecDurMult = (p.consecDurMult || 1) * 1.3; },
  },
  {
    id: "thorns", name: "Holy Retribution", icon: "\uD83C\uDF1F",
    desc: "Attackers take 30% of their damage back", repeatable: true, maxStacks: 3,
    apply: (p) => { p.thorns += 0.3; },
  },
  {
    id: "dash", name: "Blessed Wind", icon: "\uD83D\uDCA8",
    desc: "Dash: -25% cooldown & longer", repeatable: true, maxStacks: 3,
    apply: (p) => { p.dashCdMax *= 0.75; p.dashTimeBonus = (p.dashTimeBonus || 0) + 0.06; },
  },
];

// Pick N distinct upgrades respecting stack limits.
export function rollUpgrades(player, n = 3) {
  const stacks = player._upgradeStacks || (player._upgradeStacks = {});
  const available = UPGRADES.filter((u) => {
    const used = stacks[u.id] || 0;
    if (u.maxStacks && used >= u.maxStacks) return false;
    return true;
  });
  const chosen = [];
  const pool = [...available];
  while (chosen.length < n && pool.length > 0) {
    const u = pick(pool);
    chosen.push(u);
    pool.splice(pool.indexOf(u), 1);
  }
  return chosen;
}

export function applyUpgrade(player, upgrade) {
  const stacks = player._upgradeStacks || (player._upgradeStacks = {});
  stacks[upgrade.id] = (stacks[upgrade.id] || 0) + 1;
  upgrade.apply(player);
}
