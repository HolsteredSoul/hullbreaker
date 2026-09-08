// Content is independent of the renderer and simulation. Add missions here, or
// register them at startup; stable IDs keep saved progress compatible with updates.
export const WEAPONS = Object.freeze({
  vulcan: { name: 'VULCAN', interval: 0.16, damage: 0.75, speed: 27, spread: [-0.09, 0, 0.09], color: 0x9cffe4 },
  laser: { name: 'LANCE', interval: 0.11, damage: 1.65, speed: 40, spread: [0], color: 0x8ed6ff },
  homing: { name: 'SEEKER', interval: 0.25, damage: 1.45, speed: 20, spread: [-0.04, 0.04], color: 0xffd293 },
});

export const missions = new Map();
export function registerMission(definition) {
  if (!definition.id || missions.has(definition.id)) throw new Error('Mission ID must be unique');
  if (!(definition.duration > 0) || !definition.environment || !Array.isArray(definition.targets)) throw new Error('Invalid mission');
  const ids = new Set(definition.targets.map(target => target.id));
  if (ids.size !== definition.targets.length) throw new Error('Target IDs must be unique');
  missions.set(definition.id, definition);
  return definition;
}

export const PROTOTYPE_MISSION = registerMission({
  id: 'nesis-wake', title: 'Nesis / Engine assault', duration: 90,
  environment: {
    type: 'capital', seed: 417, length: 100, model: '/assets/nesis-arcade-v2.glb', assetVersion: 2,
    markings: [
      { x: 0, z: 9, text: '07', sub: 'NESIS / AFT DRIVE', width: 3, height: 2.4 },
      { x: 0, z: -11, text: 'CAUTION', sub: 'SERVICE CONDUIT', width: 3.4, height: 1.4 },
      { x: -11, z: -26.5, text: 'DOCK 01', sub: 'FLIGHT OPERATIONS', width: 2.4, height: 1.2 },
      { x: 0, z: -60, text: 'RESTRICTED', sub: 'JUMP DRIVE ACCESS', width: 4, height: 1.7 },
    ],
  },
  scrollSpeed: 0.65, scrollUntil: 68,
  sectors: [
    { at: 0, name: '01 / ENGINE WAKE', message: 'SKIM THE HULL · AUTO-FIRE ENGAGED' },
    { at: 9, name: '02 / HANGAR TRENCH', message: 'DESTROY LAUNCH BAYS TO CUT REINFORCEMENTS' },
    { at: 42, name: '03 / DEFENSE SPINE', message: 'TURRET CONTROL AHEAD · WATCH THE FIRING ARC' },
    { at: 68, name: '04 / JUMP CORE', message: 'CORE EXPOSED · DISABLE THE JUMP DRIVE' },
  ],
  targets: [
    { id: 'bay-a', kind: 'bay', label: 'BAY A', x: -4.8, y: 19, hp: 28, radius: 1.5, startAt: 9, interval: 9, squad: 2, reward: 1500 },
    { id: 'bay-b', kind: 'bay', label: 'BAY B', x: 4.8, y: 28, hp: 28, radius: 1.5, startAt: 23, interval: 9, squad: 2, reward: 1500 },
    { id: 'turret-a', kind: 'turret', label: 'TURRET CONTROL', x: 0, y: 38, hp: 35, radius: 1.2, startAt: 38, interval: 4.5, reward: 2000 },
    { id: 'core', kind: 'core', label: 'JUMP CORE', x: 0, y: 56, hp: 100, radius: 2, startAt: 68, interval: 1.5, reward: 6000 },
  ],
  patrol: { startAt: 3, interval: 6, stopAt: 67 },
  hazards: [{ id: 'wake-left', x: -6, width: 2, until: 9, period: 5 }, { id: 'wake-right', x: 6, width: 2, until: 9, period: 5 }],
});

export const DIFFICULTIES = Object.freeze({
  rookie: { name: 'ROOKIE', health: 5, bulletSpeed: .8, fireInterval: 1.25 },
  pilot: { name: 'PILOT', health: 4, bulletSpeed: 1, fireInterval: 1 },
});

// Explicit encounter beats leave recovery gaps and make bay cancellation auditable.
const waves = [];
function encounters(from, until, interval, patterns, sourceBay = null) {
  let index = 0;
  for (let at = from; at < until; at += interval) waves.push({ at, pattern: patterns[index++ % patterns.length], side: index % 2 ? -1 : 1, sourceBay });
}
encounters(.8, 6, 2.6, ['scout-vee', 'crossfire']);
encounters(7, 29, 3.1, ['scout-sweep', 'crossfire', 'interceptor-pair', 'scout-gap']);
encounters(30, 40, 2.8, ['crossfire', 'bomber-escort', 'interceptor-pair']);
encounters(41, 51, 3, ['interceptor-pair', 'crossfire', 'scout-gap']);
encounters(53, 63, 2.6, ['bomber-escort', 'crossfire', 'interceptor-pair']);
waves.sort((a, b) => a.at - b.at);

export const FIRST_MISSION = registerMission({
  ...PROTOTYPE_MISSION, id: 'nesis-strike-v4', title: 'Nesis / Strike run', duration: 110, pace: { moveSpeed: 13, fighterScale: .82, supportDelay: 1.5, chainWindow: 3 },
  environment: { ...PROTOTYPE_MISSION.environment, model: '/assets/nesis-assault-v3.glb' },
  route: [{ at: 0, distance: 0 }, { at: 6, distance: 8 }, { at: 14, distance: 12 }, { at: 24, distance: 19 }, { at: 30, distance: 22 }, { at: 40, distance: 28 }, { at: 52, distance: 38 }, { at: 64, distance: 45 }, { at: 110, distance: 45 }],
  sectors: [
    { at: 0, name: '01 / ENGINE WAKE', message: 'BREAK THROUGH THE SCREEN · EXHAUST LANES PULSE' },
    { at: 6, name: '02 / HANGAR TRENCH', message: 'DISABLE BOTH BAYS · FEWER FIGHTERS IN THE FINALE' },
    { at: 30, name: '03 / FORWARD BATTERIES', message: 'SIDE GUNS ACTIVE · SHOOT THE INNER CONTROL LINKS' },
    { at: 40, name: '04 / BROKEN ARMOUR', message: 'DODGE THE SALVAGE LANES · DISABLE COOLANT TO WEAKEN THE CORE' },
    { at: 52, name: '05 / COMMAND APPROACH', message: 'HEAVY ESCORTS INBOUND · PRESERVE YOUR PULSES' },
    { at: 64, name: '06 / JUMP CORE', message: 'BREAK THREE CORE PHASES · WATCH THE SHIELD CYCLE' },
  ],
  targets: [
    { id: 'bay-a', kind: 'bay', label: 'BAY A', x: -4.8, y: 19, hp: 32, radius: 1.5, startAt: 7, interval: 6, squad: 3, reward: 2000 },
    { id: 'bay-b', kind: 'bay', label: 'BAY B', x: 4.8, y: 28, hp: 32, radius: 1.5, startAt: 15, interval: 6, squad: 3, reward: 2000 },
    { id: 'turret-a', kind: 'turret', label: 'FIRE CONTROL', x: 0, y: 38, hp: 45, radius: 1.2, startAt: 30, interval: 3.8, reward: 2500 },
    { id: 'coolant', kind: 'coolant', label: 'COOLANT PUMP', x: -4.8, y: 44, hp: 30, radius: 1.3, startAt: 40, interval: 999, reward: 2000, mountY: .2, scale: .65 },
    ...[['port-a', -1, 34, 29], ['starboard-a', 1, 34, 31], ['port-b', -1, 48, 52], ['starboard-b', 1, 48, 54]].map(([id, side, y, startAt]) => ({ id, kind: 'battery', label: `${side < 0 ? 'PORT' : 'STBD'} ${y === 34 ? '01' : '02'} LINK`, x: side * 7.2, mountX: side * 11.1, mountY: .2, y, hp: 32, radius: 1.05, startAt, interval: 4.8, reward: 1600, scale: 1.15 })),
    { id: 'core', kind: 'core', label: 'JUMP CORE', x: 0, y: 56, hp: 225, radius: 2, startAt: 64, interval: 2.7, reward: 8000 },
  ],
  waves, recovery: [28, 62],
  boss: { at: 64, phaseHp: 75, shieldPeriod: 6, exposed: 4.8, weakenedExposure: 5.5, reinforcementInterval: 6, transition: .75 },
  patrol: { startAt: Infinity, stopAt: 0, interval: 1 },
  hazards: [
    { id: 'wake-left', x: -6, width: 2, from: 0, until: 7, period: 4, activeAfter: 2.8, zone: 'aft' },
    { id: 'wake-right', x: 6, width: 2, from: 2, until: 7, period: 4, activeAfter: 2.8, zone: 'aft' },
    { id: 'salvage-left', x: -4.5, width: 2.3, from: 40, until: 52, period: 4.5, activeAfter: 3.2, zone: 'full' },
    { id: 'salvage-right', x: 4.5, width: 2.3, from: 42.25, until: 52, period: 4.5, activeAfter: 3.2, zone: 'full' },
  ],
});

export function seededRandom(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
