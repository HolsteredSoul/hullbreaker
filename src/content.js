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

// Campaign routes are authored; only approach formations and scenery are seeded.
export const CAMPAIGN = Object.freeze({
  id: 'hullbreaker-campaign-v1', extraLives: [50000, 150000],
  levels: [
    { id: 'carrier-screen', title: 'Carrier Screen', description: 'Break the fighter screen and dismantle the carrier.' },
    { id: 'station-breach', title: 'Station Breach', description: 'Cut the shield feeders inside the docking canyons.' },
    { id: 'lunar-battery', title: 'Lunar Battery', description: 'Silence the moon’s missile-command fortress.' },
    { id: 'fleet-anchorage', title: 'Fleet Anchorage', description: 'Cross the anchorage and destroy both command nodes.' },
    { id: 'nesis', title: 'Nesis', description: 'Break through the orbital defenses and finish the flagship.' },
  ],
});

const target = (id, kind, x, y, extra = {}) => ({
  id, kind, label: id.replaceAll('-', ' ').toUpperCase(), x, y,
  hp: kind === 'core' ? 95 : kind === 'bay' ? 32 : 26,
  radius: kind === 'core' ? 1.8 : 1.2, startAt: 0,
  interval: kind === 'bay' ? 8 : 5.5, squad: 2,
  reward: kind === 'core' ? 7000 : kind === 'bay' ? 1800 : 1200,
  ...extra,
});
const battery = (id, side, y, extra = {}) => target(id, 'battery', side * 6.8, y, { mountX: side * 10.2, mountY: .15, ...extra });
const launcher = (id, x, y, extra = {}) => target(id, 'launcher', x, y, { interval: 6, hp: 28, ...extra });
const scenery = (type, variant = type) => ({ type, variant, length: 130, surfaceY: type === 'space' ? null : -.85 });
const segment = (id, name, environment, duration = 60, targets = [], extra = {}) => ({
  id, name, environment, duration, targets, hazards: [],
  route: [{ at: 0, distance: -24 }, { at: duration, distance: 86 }],
  ...extra,
});
const lane = (id, x, from = 15) => ({ id, x, width: 2.2, from, until: 48, period: 7, activeAfter: 5.6, zone: 'full' });
const defenses = prefix => [battery(`${prefix}-port`, -1, 18), launcher(`${prefix}-missiles`, 4.5, 39), battery(`${prefix}-starboard`, 1, 63)];

function campaignBlueprints() {
  const carrier = segment('carrier', 'CARRIER / COMMAND DECK', scenery('capital', 'carrier'), 60, [
    target('hangar-port', 'bay', -4.8, 18), target('hangar-starboard', 'bay', 4.8, 29),
    battery('port-gun', -1, 38), launcher('deck-launcher', 5, 46),
    target('bridge', 'core', 0, 68, { hp: 110, label: 'COMMAND BRIDGE' }),
  ], { assault: true, completion: ['bridge'], reinforcements: ['hangar-port', 'hangar-starboard'] });
  const station = segment('hub', 'STATION / SHIELD CANYON', scenery('station'), 60, [
    target('feeder-port', 'coolant', -4.8, 18, { label: 'PORT SHIELD FEEDER', hp: 25 }),
    target('feeder-starboard', 'coolant', 4.8, 33, { label: 'STARBOARD SHIELD FEEDER', hp: 25 }),
    target('station-dock', 'bay', -5, 46), launcher('hub-launcher', 5, 52),
    target('defense-hub', 'core', 0, 69, { hp: 115, gates: ['feeder-port', 'feeder-starboard'] }),
  ], { assault: true, completion: ['feeder-port', 'feeder-starboard', 'defense-hub'], reinforcements: ['station-dock'], hazards: [lane('service-barrier', -2.5)] });
  const lunar = segment('fortress', 'MOON / MISSILE FORTRESS', scenery('moon', 'fortress'), 60, [
    target('tracking-radar', 'coolant', -4.8, 17, { label: 'TRACKING RADAR' }),
    launcher('silo-port', -5, 33, { controllerId: 'tracking-radar' }),
    launcher('silo-starboard', 5, 44, { controllerId: 'tracking-radar' }),
    target('command-bunker', 'core', 0, 68, { hp: 130, attack: 'missiles', controllerId: 'tracking-radar', supportIds: ['silo-port', 'silo-starboard'] }),
  ], { assault: true, completion: ['command-bunker'], hazards: [lane('mining-charge', 2.5, 21)] });
  const command = segment('command', 'ANCHORAGE / TWIN COMMAND', scenery('capital', 'command'), 60, [
    battery('command-port-gun', -1, 20), battery('command-starboard-gun', 1, 34),
    target('node-port', 'core', -4.4, 61, { hp: 90, label: 'PORT COMMAND NODE' }),
    target('node-starboard', 'core', 4.4, 70, { hp: 90, label: 'STARBOARD COMMAND NODE', attack: 'missiles' }),
  ], { assault: true, completion: ['node-port', 'node-starboard'], reinforcements: ['anchorage-dock-port', 'anchorage-dock-starboard'] });
  const nesis = segment('flagship', 'NESIS / FLAGSHIP ASSAULT', {
    ...FIRST_MISSION.environment, variant: 'nesis', surfaceY: -.85,
  }, 75, FIRST_MISSION.targets.map(t => ({ ...t, socketId: t.id, startAt: 0,
    controllerId: ['battery', 'core'].includes(t.kind) ? 'turret-a' : undefined,
  })), { assault: true, completion: ['core'], reinforcements: ['bay-a', 'bay-b'],
    boss: { ...FIRST_MISSION.boss, at: 0, coolantId: 'coolant' },
    hazards: [lane('flagship-salvage', -3, 20)],
  });
  return [
    [segment('screen', 'DEEP SPACE / FIGHTER SCREEN', scenery('space')),
      segment('wreckage', 'WRECKAGE / INTERCEPTION', scenery('space', 'wreckage')),
      segment('escort', 'CARRIER ESCORT / HULL FLYOVER', scenery('capital', 'cruiser'), 60, defenses('escort')), carrier],
    [segment('approach', 'DEEP SPACE / STATION APPROACH', scenery('space')),
      segment('cruiser', 'PICKET CRUISER / FLYOVER', scenery('capital', 'cruiser'), 60, defenses('picket')),
      segment('docks', 'STATION / DOCKING CANYONS', scenery('station', 'docks'), 60, defenses('docks'), { hazards: [lane('loading-barrier', -3)] }), station],
    [segment('orbit', 'LUNAR ORBIT / INTERCEPTORS', scenery('space', 'orbit')),
      segment('surface', 'MOON / CRATER FIELDS', scenery('moon', 'craters'), 60, defenses('surface')),
      segment('trench', 'MOON / FORTIFIED TRENCH', scenery('moon', 'trench'), 60, defenses('trench'), { hazards: [lane('trench-charge', 3)] }), lunar],
    [segment('intercept', 'DEEP SPACE / FLEET INTERCEPTION', scenery('space'), 45),
      segment('picket', 'FLEET / CRUISER FLYOVER', scenery('capital', 'cruiser'), 45, defenses('fleet-picket')),
      segment('supply', 'FLEET / SUPPLY CARRIER', scenery('capital', 'carrier'), 45, defenses('supply')),
      segment('perimeter', 'ANCHORAGE / FIGHTER DOCKS', scenery('station', 'docks'), 45, [
        target('anchorage-dock-port', 'bay', -4.8, 20), target('anchorage-dock-starboard', 'bay', 4.8, 48), launcher('perimeter-launcher', 0, 66),
      ]), command],
    [segment('fleet', 'DEEP SPACE / FINAL FLEET SCREEN', scenery('space', 'wreckage'), 45),
      segment('relay', 'MOON / ORBITAL RELAY', scenery('moon', 'fortress'), 60, defenses('relay')),
      segment('gateway', 'STATION / FLAGSHIP GATEWAY', scenery('station'), 60, defenses('gateway'), { hazards: [lane('gateway-barrier', -3)] }), nesis],
  ];
}

export function compileCampaign(seed = 417) {
  return campaignBlueprints().map((segments, levelIndex) => {
    const meta = CAMPAIGN.levels[levelIndex];
    const random = seededRandom((seed ^ Math.imul(levelIndex + 1, 0x45d9f3b)) >>> 0);
    const allIds = new Set(segments.flatMap(s => s.targets.map(t => t.id)));
    if (allIds.size !== segments.reduce((n, s) => n + s.targets.length, 0)) throw new Error('Duplicate campaign target');
    const qualify = id => `${meta.id}:${id}`;
    const compiled = segments.map((s, index) => {
      const patterns = ['scout-vee', 'scout-gap', 'scout-sweep', 'crossfire', 'interceptor-pair', 'bomber-escort'];
      const encounterRandom = s.assault ? seededRandom(990 + levelIndex) : random;
      const waves = [];
      for (let at = .8, beat = 0; at < s.duration - 3; beat++) {
        waves.push({ at, pattern: patterns[Math.floor(encounterRandom() * (levelIndex === 0 && index === 0 ? 4 : patterns.length))], side: encounterRandom() < .5 ? -1 : 1 });
        // A short rest every fifth formation, without empty travel stretches.
        at += beat % 5 === 4 ? 5.5 : 3.6 - levelIndex * .18;
      }
      for (const sourceBay of s.reinforcements || []) {
        if (!allIds.has(sourceBay)) throw new Error(`Unknown reinforcement bay: ${sourceBay}`);
        for (let at = 9; at < s.duration - 3; at += 12) waves.push({ at, pattern: 'scout-gap', sourceBay: qualify(sourceBay), side: 1 });
      }
      const targets = s.targets.map(t => ({ ...t, id: qualify(t.id),
        gates: t.gates?.map(qualify), controllerId: t.controllerId ? qualify(t.controllerId) : undefined,
        supportIds: t.supportIds?.map(qualify),
      }));
      const environment = { ...s.environment, seed: (seed ^ Math.imul(100 + levelIndex * 10 + index, 7919)) >>> 0 };
      return { ...s, id: `${meta.id}/${s.id}`, title: meta.title, campaign: true, segmentIndex: index,
        environment, combatSeed: (seed ^ Math.imul(1 + levelIndex * 10 + index, 3571)) >>> 0,
        targets, waves: waves.sort((a, b) => a.at - b.at),
        completion: s.completion?.map(qualify),
        boss: s.boss ? { ...s.boss, coolantId: qualify(s.boss.coolantId) } : undefined,
        pace: { ...FIRST_MISSION.pace }, sectors: [{ at: 0, name: s.name, message: s.assault ? 'ASSAULT INBOUND · DAMAGE PERSISTS ON RETURN PASSES' : s.name }],
        recovery: [], patrol: { startAt: Infinity, interval: 1, stopAt: 0 },
      };
    });
    return { ...meta, index: levelIndex, seed, segments: compiled, duration: compiled.reduce((sum, s) => sum + s.duration, 0) };
  });
}
