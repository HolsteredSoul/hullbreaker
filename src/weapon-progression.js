// Arcade tiers change coverage and behavior, not only an invisible multiplier.
export const MAX_POWER = 3;
export const POWER_RESERVE = 24; // Seconds of boosted firing per tier; tier one is unlimited.
export const PICKUPS = {
  power: { label: 'P · POWER + CHARGE', color: 0xa1ffcf },
  vulcan: { label: 'V · VULCAN', color: 0xff896f },
  laser: { label: 'L · LANCE', color: 0x79cfff },
  homing: { label: 'M · SEEKER', color: 0xd5a2ff },
  shield: { label: 'S · SHIELD', color: 0x58e5ff },
  hull: { label: 'H · HULL', color: 0xf6e28a },
  pulse: { label: 'B · PULSE', color: 0xffbd70 },
};
const tiers = {
  vulcan: [
    { interval: .16, damage: .85, speed: 31, angles: [-.08, 0, .08], width: 1, name: 'TRIPLE SHOT' },
    { interval: .135, damage: .95, speed: 32, angles: [-.21, -.1, 0, .1, .21], width: 1.2, name: 'FIVE-WAY' },
    { interval: .11, damage: 1.05, speed: 34, angles: [-.34, -.22, -.11, 0, .11, .22, .34], width: 1.5, name: 'SEVEN-WAY STORM' },
  ],
  laser: [
    { interval: .15, damage: 2, speed: 44, offsets: [0], pierce: 0, width: 1.5, name: 'LANCE' },
    { interval: .13, damage: 2.1, speed: 46, offsets: [-.35, .35], pierce: 1, width: 1.8, name: 'TWIN PIERCER' },
    { interval: .11, damage: 2.25, speed: 48, offsets: [-.6, 0, .6], pierce: 2, width: 2.6, name: 'TRIPLE PIERCER' },
  ],
  homing: [
    { interval: .3, damage: 1.6, speed: 23, angles: [-.12, .12], width: 1, name: 'TWIN SEEKER' },
    { interval: .27, damage: 1.75, speed: 25, angles: [-.3, -.1, .1, .3], width: 1.15, name: 'QUAD SEEKER' },
    { interval: .24, damage: 1.9, speed: 27, angles: [-.4, -.24, -.08, .08, .24, .4], width: 1.3, name: 'SIX-MISSILE SALVO' },
  ],
};
export function weaponTier(weapon, level) { return tiers[weapon][Math.max(0, Math.min(MAX_POWER - 1, level - 1))]; }
export function upgradeWeapon(sim, source = 'pickup') {
  const previous = sim.level;
  sim.level = Math.min(MAX_POWER, sim.level + 1);
  sim.powerReserve = POWER_RESERVE;
  const bonus = previous === MAX_POWER ? 1500 : source === 'clear' ? 0 : 500;
  sim.score += bonus;
  sim.emit('power-up', { source, previous, level: sim.level, bonus, maxed: previous === MAX_POWER, name: weaponTier(sim.weapon, sim.level).name });
  return bonus;
}

export function collectWeapon(sim, weapon) {
  if (weapon === sim.weapon) return upgradeWeapon(sim, 'matching-weapon');
  const previous = sim.weapon;
  sim.weapon = weapon; sim.level = 1; sim.powerReserve = POWER_RESERVE;
  sim.player.cooldown = .1; sim.score += 500;
  sim.emit('weapon-change', { previous, weapon, bonus: 500 });
  return 500;
}

export function depletePower(sim, seconds) {
  if (sim.level <= 1) return;
  sim.powerReserve -= seconds;
  if (sim.powerReserve > 0) return;
  sim.level--; sim.powerReserve = POWER_RESERVE;
  sim.emit('power-depleted', { level: sim.level });
}
