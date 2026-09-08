import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN, compileCampaign } from '../src/content.js';
import { CampaignRun } from '../src/campaign.js';
import { RETURN_TURN_SECONDS, returnPassPose } from '../src/flight-path.js';

function advance(sim, seconds, input = { x: 0, y: 0 }, protect = true) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    if (protect) sim.player.invulnerable = 100;
    sim.update(1 / 60, input);
  }
}
test('five deterministic routes have 240 seconds of content, immediate combat and reachable targets', () => {
  const levels = compileCampaign(123);
  assert.equal(levels.length, 5); assert.deepEqual(levels, compileCampaign(123));
  assert.notDeepEqual(levels[0].segments[0].waves, compileCampaign(124)[0].segments[0].waves);
  assert.deepEqual(levels[0].segments.at(-1).waves, compileCampaign(124)[0].segments.at(-1).waves);
  for (const level of levels) {
    assert.equal(level.duration, 240);
    for (const segment of level.segments) {
      assert.equal(segment.waves[0].at, .8);
      for (const target of segment.targets) assert.ok(Math.abs(target.x) <= 7.2);
      for (const hazard of segment.hazards) assert.ok(hazard.activeAfter >= 3.2 && hazard.period > hazard.activeAfter);
      const ids = new Set(level.segments.flatMap(s => s.targets.map(t => t.id)));
      for (const target of segment.targets) for (const id of [...(target.gates || []), ...(target.supportIds || []), ...target.controllerId ? [target.controllerId] : []]) assert.ok(ids.has(id), `Known dependency ${id}`);
    }
  }
});
test('carrier approach transitions and pass reset preserve damage, canceled bays and score', () => {
  const run = new CampaignRun(); const sim = run.sim;
  advance(sim, 180); assert.equal(sim.segmentIndex, 3);
  const bay = sim.targets.find(t => t.kind === 'bay'), bridge = sim.targets.find(t => t.kind === 'core');
  sim.damageTarget(bay, 999); sim.damageTarget(bridge, 12);
  const hp = bridge.hp, launches = bay.launches, score = sim.score;
  sim.damageTarget(bay, 999); assert.equal(sim.score, score);
  sim.player.x = 0; sim.player.cooldown=1e5; advance(sim, 60); assert.ok(sim.turnRemaining > 0);
  const x = sim.player.x, y = sim.player.y;
  advance(sim, RETURN_TURN_SECONDS, { x: 1, y: 1 });
  assert.equal(sim.pass, 2); assert.equal(sim.player.x, x); assert.equal(sim.player.y, y);
  assert.equal(bridge.hp, hp); assert.ok(bay.destroyed); assert.equal(bay.launches, launches);
  const before = sim.enemies.filter(e => e.active).length;
  sim.spawnWave({ sourceBay: bay.id, pattern: 'scout-gap' });
  assert.equal(sim.enemies.filter(e => e.active).length, before);
  assert.equal(sim.status, 'playing');
});
test('lives respawn once, prevent stacked damage, downgrade weapons and end the third fighter', () => {
  const sim = new CampaignRun().sim; sim.level = 3;
  for (let life = 2; life >= 0; life--) {
    sim.player.invulnerable = 0; sim.damagePlayer(); sim.damagePlayer();
    assert.equal(sim.lives, life); assert.equal(sim.player.health, 0);
    if (life) {
      advance(sim, 1, undefined, false); assert.equal(sim.player.health, 1);
      assert.ok(sim.player.invulnerable > 2.4); assert.equal(sim.player.bombs, 2);
      sim.damagePlayer(); assert.equal(sim.lives, life);
    }
  }
  assert.equal(sim.status, 'lost'); assert.equal(sim.level, 1);
  const time = sim.levelTime; advance(sim, 5); assert.equal(sim.levelTime, time);
});
test('feeders gate station hub across passes and earlier anchorage docks own later reinforcements', () => {
  const sim = new CampaignRun({ practiceLevel: 1, practiceSegment: 3 }).sim;
  const hub = sim.targets.find(t => t.gates);
  sim.damageTarget(hub, 999); assert.equal(hub.hp, hub.maxHp);
  sim.damageTarget(sim.targetById(hub.gates[0]), 999);
  sim.enterSegment(3, true); sim.damageTarget(hub, 999); assert.equal(hub.hp, hub.maxHp);
  sim.damageTarget(sim.targetById(hub.gates[1]), 999); sim.damageTarget(hub, 999); assert.equal(sim.status, 'won');
  const fleet = new CampaignRun({ practiceLevel: 3, practiceSegment: 3 }).sim;
  const dock = fleet.targets.find(t => t.kind === 'bay'); fleet.damageTarget(dock, 999); fleet.enterSegment(4);
  fleet.spawnWave({ sourceBay: dock.id, pattern: 'scout-gap' }); assert.equal(fleet.enemies.filter(e => e.active).length, 0);
});
test('clear rewards and extra lives are awarded once and supplies carry between levels', () => {
  const run = new CampaignRun(); const sim = run.sim; sim.enterSegment(3);
  sim.score = 150000; sim.awardExtraLives(); sim.awardExtraLives(); assert.equal(sim.lives, 5);
  assert.deepEqual(sim.extraLivesAwarded, CAMPAIGN.extraLives);
  sim.level = 2; sim.player.bombs = 1; sim.damageTarget(sim.targets.find(t => t.kind === 'core'), 999);
  const score = sim.score; sim.completeLevel(); assert.equal(sim.score, score);
  assert.ok(run.nextLevel()); assert.equal(run.sim.score, score); assert.equal(run.sim.level, 3);
  assert.equal(run.sim.lives, 5); assert.equal(run.sim.player.bombs, 2); assert.equal(run.sim.chain, 0);
  assert.deepEqual(run.sim.extraLivesAwarded, CAMPAIGN.extraLives);
});
test('practice cannot advance a campaign and visual randomness cannot change fighter behavior', () => {
  const run = new CampaignRun({ practiceLevel: 0, practiceSegment: 3 });
  run.sim.damageTarget(run.sim.targets.find(t => t.kind === 'core'), 999); assert.equal(run.nextLevel(), false);
  const a = new CampaignRun().sim, b = new CampaignRun().sim;
  a.burst(0, 0, 100); a.spawnEnemy(0, 17); b.spawnEnemy(0, 17);
  assert.deepEqual(a.enemies[0], b.enemies[0]);
});
test('surface launchers warn, launch destructible missiles and respect radar destruction', () => {
  const sim = new CampaignRun({ practiceLevel: 2, practiceSegment: 3 }).sim;
  const launcher = sim.targets.find(t => t.kind === 'launcher'); sim.time = 25; sim.distance = sim.routeDistance(sim.time);
  launcher.y = launcher.anchorY - sim.distance; launcher.entered = false; sim.waveIndex = 999;
  sim.update(1 / 60); assert.ok(launcher.nextAt - sim.time >= 1.29);
  sim.shots.forEach(s => s.active = false); sim.time = launcher.nextAt; sim.updateLauncher(launcher);
  assert.equal(sim.shots.filter(s => s.active && s.missile && s.source === launcher.id).length, 2);
  sim.damageTarget(sim.targetById(launcher.controllerId), 999); sim.shots.forEach(s => s.active = false);
  sim.time = launcher.nextAt; sim.updateLauncher(launcher);
  assert.equal(sim.shots.filter(s => s.active && s.missile && s.source === launcher.id).length, 1);
});

test('every weapon can complete every authored assault through normal shots and return passes', () => {
  for (const weapon of ['vulcan', 'laser', 'homing']) for (let levelIndex = 0; levelIndex < 5; levelIndex++) {
    const last = compileCampaign(417)[levelIndex].segments.length - 1;
    const sim = new CampaignRun({ weapon, practiceLevel: levelIndex, practiceSegment: last }).sim;
    for (let frame = 0; frame < 60 * 310 && sim.status === 'playing'; frame++) {
      sim.player.invulnerable = 100;
      const candidates = sim.targets.filter(t => sim.targetVisible(t) && !sim.isTargetShielded(t));
      const wanted = candidates.filter(t => sim.mission.completion.includes(t.id));
      const target = (wanted.length ? wanted : candidates).sort((a, b) => a.y - b.y)[0];
      const x = target ? Math.sign(target.x - sim.player.x) * Math.min(1, Math.abs(target.x - sim.player.x) / .22) : 0;
      sim.update(1 / 60, { x, y: sim.player.y > -6 ? -1 : 0 });
      if (frame % 60 === 0) assert.ok(sim.enemies.filter(e => e.active).length <= sim.mission.combat.maxEnemies, 'Fighter population remains bounded');
    }
    assert.equal(sim.status, 'won', `${weapon} / ${sim.definition.title}: ${sim.targets.filter(t => !t.destroyed).map(t => `${t.label} ${t.hp}`).join(', ')}`);
  }
});

test('return-pass pressure is bounded, preserves warnings and rewards mastery', () => {
  const sim = new CampaignRun({ practiceLevel: 0, practiceSegment: 3 }).sim;
  for (const pass of [2, 4, 20]) {
    sim.pass = pass; sim.enterSegment(3, true);
    assert.ok(sim.difficulty.bulletSpeed <= 1.12); assert.ok(sim.difficulty.fireInterval >= .76);
  }
  sim.pass = 1; sim.damageTarget(sim.targets.find(t => t.kind === 'core'), 999);
  assert.equal(sim.rank, 'S'); assert.equal(sim.clearBonus, 11000);
});

test('return path follows its heading, clears the installation and rejoins without a world-space jump', () => {
  for (const x of [-8, 0, 8]) {
    const origin = { x, y: -6 }, travel = 110;
    const first = returnPassPose(0, origin, travel), last = returnPassPose(1, origin, travel);
    assert.equal(first.x, x); assert.equal(first.z, 6); assert.equal(first.y, 0);
    assert.equal(last.x, x); assert.equal(last.z - travel, first.z); assert.equal(last.y, 0);
    assert.ok(Math.abs(Math.sin(last.heading)) < 1e-8); assert.ok(Math.abs(last.bank) < 1e-8);
    for (let i = 1; i < 1000; i++) {
      const u = i / 1000, p = returnPassPose(u, origin, travel), ahead = returnPassPose(u + .00001, origin, travel);
      const dx = ahead.x - p.x, dz = ahead.z - p.z, length = Math.hypot(dx, dz);
      const alignment = (dx * -Math.sin(p.heading) + dz * -Math.cos(p.heading)) / length;
      assert.ok(alignment > .9999, `heading follows motion at ${u}`);
      assert.ok(Math.hypot(dx, dz) < .02, 'continuous travel');
      if (p.x > x + 5) assert.ok(p.y > 9.9, 'climbs before crossing structures');
    }
  }
});

test('Nesis retains phase progress on repeated passes and bays cannot launch before entry warnings', () => {
  const sim = new CampaignRun({ practiceLevel: 4, practiceSegment: 3 }).sim;
  const core = sim.targets.find(t => t.kind === 'core');
  for (const phase of [1, 2]) {
    sim.time = sim.phaseStarted + sim.mission.boss.shieldPeriod - .1;
    sim.damageTarget(core, 999);
    assert.equal(sim.bossPhase, phase + 1);
    const hp = core.hp;
    sim.enterSegment(3, true);
    assert.equal(core.hp, hp); assert.equal(sim.bossPhase, phase + 1);
  }
  const carrier = new CampaignRun({ practiceLevel: 0, practiceSegment: 3 }).sim;
  const bay = carrier.targets.find(t => t.kind === 'bay');
  carrier.time = (bay.anchorY - 17.5 + 24) * carrier.mission.duration / 110;
  bay.nextAt = carrier.time; carrier.update(1 / 60);
  assert.equal(bay.launches, 0, 'No launch just outside the warning zone');
  advance(carrier, .4);
  assert.ok(bay.entered); assert.ok(bay.nextAt - carrier.time > 1);
  assert.equal(bay.launches, 0);
});
