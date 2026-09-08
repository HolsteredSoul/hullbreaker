import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_MISSION as mission } from '../src/content.js';
import { Simulation } from '../src/simulation.js';
const step = (sim, seconds) => { for (let i=0;i<Math.round(seconds*60);i++) { sim.player.invulnerable=2; sim.update(1/60); } };
function at(time, weapon='vulcan') {
  const sim=new Simulation(mission,weapon); sim.time=time; sim.distance=sim.routeDistance(time);
  sim.waveIndex=mission.waves.filter(w=>w.at<time).length; sim.recoveryIndex=mission.recovery.filter(t=>t<time).length;
  sim.targets.forEach(t=>{t.y=t.anchorY-sim.distance; t.nextAt=Math.max(t.nextAt,time+2);}); return sim;
}
test('six-sector route is continuous, monotonic and reaches the boss without padding the approach',()=>{
  const sim=new Simulation(mission); let prior=-1;
  for(let t=0;t<=mission.duration;t+=.1){const d=sim.routeDistance(t);assert.ok(d>=prior);prior=d;}
  for(const p of mission.route)assert.equal(sim.routeDistance(p.at),p.distance);
  assert.equal(sim.routeDistance(mission.boss.at),45);assert.equal(mission.sectors.length,6);
  assert.equal(new Set(mission.waves.map(w=>w.pattern)).size,6);
});
test('core rejects early damage and shields, caps phase damage and requires three exposures',()=>{
  const sim=at(mission.boss.at-1),core=sim.targets.find(t=>t.kind==='core');
  sim.damageTarget(core,999); assert.equal(core.hp,225);
  sim.time=mission.boss.at+.2;sim.damageTarget(core,999);assert.equal(core.hp,225);
  for(let phase=1;phase<=3;phase++){
    sim.time=sim.phaseStarted+1.3;assert.equal(sim.bossState,'exposed');sim.damageTarget(core,999);
    assert.equal(core.hp,(3-phase)*75);
    if(phase<3){assert.equal(sim.status,'playing');assert.equal(sim.bossState,'transition');sim.damageTarget(core,999);assert.equal(core.hp,(3-phase)*75);}
  }
  assert.equal(sim.status,'won');
});
test('coolant extends exposure; fire control reduces actual battery volleys',()=>{
  const sim=at(mission.boss.at+.8);assert.equal(sim.bossState,'shielded');sim.damageTarget(sim.targets.find(t=>t.kind==='coolant'),999);assert.equal(sim.bossState,'exposed');
  for(const disabled of [false,true]){
    const s=at(32),gun=s.targets.find(t=>t.id==='port-a');
    if(disabled)s.damageTarget(s.targets.find(t=>t.kind==='turret'),999);
    gun.nextAt=32;for(let i=0;i<31;i++){s.time=32+i/60;s.updateBattery(gun,1/60);}
    const shots=s.shots.filter(b=>b.active&&b.source===gun.id);assert.equal(shots.length,disabled?1:3);
    assert.ok(shots.every(b=>b.x < -8 && b.entry===.35 && b.height>0),'shots start at physical mount');
    assert.ok(gun.nextAt >= 32 + gun.interval*(disabled?1.5:1));
  }
});
test('battery aim locks before firing and destruction cancels the remaining burst',()=>{
  const sim=at(32),gun=sim.targets.find(t=>t.id==='port-a');gun.nextAt=33;
  sim.updateBattery(gun,1/60);const x=gun.aimX;sim.time=32.8;sim.player.x=7;sim.updateBattery(gun,1/60);assert.equal(gun.aimX,x);
  sim.time=33;sim.updateBattery(gun,1/60);assert.equal(gun.burstLeft,2);sim.damageTarget(gun,999);step(sim,.5);
  assert.equal(gun.burstLeft,0);assert.ok(sim.shots.filter(s=>s.source===gun.id&&s.active).length<=1);
});
test('all weapons can disable reachable side links and finish every core phase',()=>{
  for(const weapon of ['vulcan','laser','homing']){
    const sim=at(32,weapon),gun=sim.targets.find(t=>t.id==='port-a');sim.player.x=gun.x;step(sim,18);assert.ok(gun.destroyed,weapon+' side relay');
    const boss=at(mission.boss.at,weapon);boss.player.x=0;
    // Isolate boss damage throughput from escorts and player survival.
    boss.targets.filter(t=>t.kind!=='core').forEach(t=>boss.damageTarget(t,999));step(boss,mission.duration-mission.boss.at);
    assert.equal(boss.status,'won',weapon+' boss deadline');
  }
});
test('destroyed bays cancel local launches and finale reinforcements',()=>{
  const sim=at(mission.boss.at);sim.targets.filter(t=>t.kind==='bay').forEach(t=>sim.damageTarget(t,999));sim.player.x=8;step(sim,15);
  assert.equal(sim.enemies.filter(e=>e.active).length,0);
  const live=at(mission.boss.at);live.player.x=8;step(live,1);assert.equal(live.enemies.filter(e=>e.active).length,2);
});
test('support windows grant once, cap supplies, and postpone battery fire',()=>{
  const sim=at(mission.recovery[0]-.1);sim.player.health=2;sim.player.bombs=1;step(sim,.2);
  assert.equal(sim.player.health,3);assert.equal(sim.player.bombs,2);step(sim,1);assert.equal(sim.player.bombs,2);
  assert.equal(sim.events.filter(e=>e.type==='recovery').length,1);
  assert.ok(sim.targets.every(t=>t.nextAt>=mission.recovery[0]+mission.pace.supportDelay));
});
test('hazards telegraph before activation; Rookie slows shots and precision reduces movement',()=>{
  const sim=at(40);const lane=mission.hazards.find(h=>h.id==='salvage-left');assert.equal(sim.hazardState(lane),'warning');sim.time=43.5;assert.equal(sim.hazardState(lane),'active');sim.time=53;assert.equal(sim.hazardState(lane),'off');
  const rookie=new Simulation(mission,'vulcan','rookie');assert.equal(rookie.maxHealth,5);assert.equal(rookie.hostileShot(0,0,0,-1,10).vy,-8);
  const a=new Simulation(mission),b=new Simulation(mission);a.update(.1,{x:1,y:0});b.update(.1,{x:1,y:0,focus:true});assert.ok(Math.abs(b.player.x/a.player.x-.55)<1e-9);
});
test('bay launch protection expires and a fresh sortie resets director and supplies',()=>{
  const sim=at(40);const enemy=sim.spawnEnemy(0,-6);sim.player.cooldown=999;sim.player.invulnerable=0;sim.update(.1);assert.equal(sim.player.health,4);assert.equal(enemy.y,-6);
  step(sim,.8);assert.ok(enemy.y < -6 || !enemy.active);
  const fresh=new Simulation(mission);assert.equal(fresh.waveIndex,0);assert.equal(fresh.recoveryIndex,0);assert.equal(fresh.player.bombs,2);assert.equal(fresh.bossPhase,1);
});
test('recycled player projectiles do not inherit battery origin or entry protection',()=>{
  const sim=new Simulation(mission),shot=sim.hostileShot(0,0,0,-1);
  Object.assign(shot,{active:false,source:'port-a',entry:.35,height:1.2});sim.update(1/60);
  assert.equal(shot.friendly,true);assert.equal(shot.source,null);assert.equal(shot.entry,0);assert.equal(shot.height,0);
});
test('the intact-system finale is completable and escape still ends the full mission',()=>{
  for(const weapon of ['vulcan','laser','homing']){
    const sim=at(mission.boss.at,weapon);step(sim,mission.duration-mission.boss.at);assert.equal(sim.status,'won',weapon+' intact-system finale');
  }
  const timeout=at(mission.duration-.1);timeout.player.x=8;step(timeout,.2);assert.equal(timeout.status,'lost');assert.ok(timeout.events.some(e=>e.type==='lost'&&e.reason.includes('jump drive')));
});
test('the opening moves into combat immediately and crosses the wake within six seconds',()=>{
  const sim=new Simulation(mission);step(sim,1);
  assert.ok(sim.enemies.some(e=>e.active&&e.y<17),'visible attackers in the first second');
  step(sim,5);assert.ok(sim.distance>=7.9,'wake traversal no longer takes 35 seconds');
  assert.ok(sim.events.filter(e=>e.type==='wave').length>=2);
});
test('crossing waves traverse laterally and kill chains expire or reset on damage',()=>{
  const sim=new Simulation(mission);sim.spawnWave({pattern:'crossfire',side:1});const enemy=sim.enemies.find(e=>e.active),x=enemy.x;step(sim,.5);
  assert.ok(enemy.x<x-2);assert.ok(enemy.angle>1&&enemy.angle<3,'craft faces its crossing flight direction');
  for(let i=0;i<10;i++)sim.awardKill({x:0,y:5,active:true});
  assert.equal(sim.chain,10);assert.ok(sim.pickups.some(p=>p.active));assert.ok(sim.score>1200);
  sim.waveIndex=mission.waves.length;sim.enemies.forEach(e=>e.active=false);sim.shots.forEach(s=>s.active=false);sim.player.cooldown=999;
  step(sim,3.1);assert.equal(sim.chain,0);
  sim.awardKill({x:0,y:5,active:true});sim.player.invulnerable=0;sim.damagePlayer();assert.equal(sim.chain,0);
});
