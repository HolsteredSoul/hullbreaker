import test from 'node:test';
import assert from 'node:assert/strict';
import { PROTOTYPE_MISSION as FIRST_MISSION, registerMission } from '../src/content.js';
import { Simulation, FIELD, segmentHits } from '../src/simulation.js';

function advance(sim, seconds, input = { x: 0, y: 0 }) { for (let i = 0; i < Math.round(seconds * 60); i++) { sim.player.invulnerable = 2; sim.update(1 / 60, input); sim.events.length = 0; } }

test('destroying a bay permanently stops its launches and awards score once', () => {
  const sim = new Simulation(FIRST_MISSION); advance(sim, 10);
  const bay = sim.targets.find(t => t.id === 'bay-a'); assert.equal(bay.launches, 1);
  sim.damageTarget(bay, 1000); const score = sim.score, launches = bay.launches;
  sim.damageTarget(bay, 1000); assert.equal(sim.score, score);
  advance(sim, 52); assert.equal(bay.launches, launches); assert.ok(sim.targets.find(t => t.id === 'bay-b').launches > 0);
});
test('destroying both bays cancels their final reinforcements', () => {
  const sim = new Simulation(FIRST_MISSION); sim.targets.filter(t => t.kind === 'bay').forEach(t => sim.damageTarget(t, 1000));
  advance(sim, 69); sim.enemies.forEach(e => { e.active = false; }); advance(sim, 2);
  assert.equal(sim.enemies.filter(e => e.active).length, 0);
});
test('movement is bounded and independent of 40 vs 60 Hz render grouping', () => {
  const sim = new Simulation(FIRST_MISSION); advance(sim, 3, { x: 1, y: -1 });
  assert.equal(sim.player.x, FIELD.maxX); assert.equal(sim.player.y, FIELD.minY);
  const a = new Simulation(FIRST_MISSION), b = new Simulation(FIRST_MISSION);
  for (let i = 0; i < 120; i++) a.update(1 / 60, { x: 0.2, y: 0 });
  let accumulator = 0;
  for (let i = 0; i < 80; i++) { accumulator += 1 / 40; while (accumulator >= 1 / 60) { b.update(1 / 60, { x: 0.2, y: 0 }); accumulator -= 1 / 60; } }
  assert.ok(Math.abs(a.player.x - b.player.x) < 1e-8); assert.equal(a.shots.filter(s => s.active).length, b.shots.filter(s => s.active).length);
});
test('pulse clears hostile projectiles, damages visible targets and cannot go negative', () => {
  const sim = new Simulation(FIRST_MISSION); advance(sim, 10);
  sim.hostileShot(1, 1, 0, -1); assert.equal(sim.bomb(), true);
  assert.equal(sim.shots.filter(s => s.active && !s.friendly).length, 0);
  assert.ok(sim.targets[0].hp < sim.targets[0].maxHp); sim.bomb(); assert.equal(sim.bomb(), false); assert.equal(sim.player.bombs, 0);
});
test('invulnerability prevents stacked damage and ended simulations do not advance', () => {
  const sim = new Simulation(FIRST_MISSION); sim.player.invulnerable = 0;
  sim.damagePlayer(); sim.damagePlayer(); assert.equal(sim.player.health, 2);
  sim.player.invulnerable = 0; sim.damagePlayer(); sim.player.invulnerable = 0; sim.damagePlayer();
  assert.equal(sim.status, 'lost'); const time = sim.time; sim.update(1); assert.equal(sim.time, time);
});
test('the core can win the mission; timeout produces an escape loss', () => {
  const sim = new Simulation(FIRST_MISSION); advance(sim, 69);
  sim.damageTarget(sim.targets.find(t => t.kind === 'core'), 1000); assert.equal(sim.status, 'won');
  const timeout = new Simulation(FIRST_MISSION); timeout.player.x = 8; advance(timeout, 91); assert.equal(timeout.status, 'lost');
});
test('fast bullets hit along the whole traveled segment', () => {
  assert.equal(segmentHits(0, -5, 0, 5, 0, 0, 0.4), true);
  assert.equal(segmentHits(2, -5, 2, 5, 0, 0, 0.4), false);
});
test('all weapon loadouts can damage a bay through normal simulation', () => {
  for (const weapon of ['vulcan', 'laser', 'homing']) {
    const sim = new Simulation(FIRST_MISSION, weapon); sim.player.x = -4.8; advance(sim, 17);
    assert.ok(sim.targets[0].hp < sim.targets[0].maxHp, weapon);
  }
});
test('alternate environment and target definitions run without renderer dependencies', () => {
  const station = registerMission({ ...FIRST_MISSION, id: 'test-station', environment: { type: 'station', seed: 99 }, targets: [{ ...FIRST_MISSION.targets[0], id: 'dock-1' }] });
  const sim = new Simulation(station); advance(sim, 10); assert.equal(sim.targets[0].id, 'dock-1'); assert.equal(sim.targets[0].launches, 1);
  assert.throws(() => registerMission(station), /unique/);
});
