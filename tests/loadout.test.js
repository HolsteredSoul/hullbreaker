import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignRun } from '../src/campaign.js';
import { compileCampaign, WEAPONS } from '../src/content.js';
import { POWER_RESERVE, PICKUPS } from '../src/weapon-progression.js';

function arena() {
  const sim = new CampaignRun().sim;
  sim.mission = {...sim.mission, waves: [], hazards: [], route: [{at:0,distance:0},{at:60,distance:0}]};
  sim.targets=[];sim.obstacles=[];sim.player.cooldown=1e5;return sim;
}
const take=(sim,type)=>sim.collectPickup(sim.dropPickup(sim.player.x,sim.player.y,type));

test('weapon crates switch and reset power, matching crates upgrade and recharge, rewards pay once',()=>{
  const sim=arena();take(sim,'power');assert.equal(sim.level,2);
  for(const weapon of ['laser','homing','vulcan']){
    const pickup=sim.dropPickup(0,-6,weapon);sim.collectPickup(pickup);
    assert.equal(sim.weapon,weapon);assert.equal(sim.level,1);assert.equal(sim.powerReserve,POWER_RESERVE);
    const score=sim.score;sim.collectPickup(pickup);assert.equal(sim.score,score);
    take(sim,weapon);assert.equal(sim.level,2);take(sim,weapon);assert.equal(sim.level,3);
    sim.powerReserve=2;const before=sim.score;take(sim,weapon);assert.equal(sim.score-before,1500);assert.equal(sim.powerReserve,POWER_RESERVE);
  }
});

test('boosted firing consumes charge, steps down once, and base weapons never run dry',()=>{
  for(const weapon of Object.keys(WEAPONS)){
    const sim=arena();sim.weapon=weapon;sim.level=3;sim.powerReserve=.01;
    sim.fireCampaignWeapon();assert.equal(sim.level,2);assert.equal(sim.events.filter(e=>e.type==='power-depleted').length,1);
    sim.powerReserve=.01;sim.fireCampaignWeapon();assert.equal(sim.level,1);
    for(let i=0;i<600;i++){sim.shots.forEach(s=>s.active=false);sim.fireCampaignWeapon();}
    assert.equal(sim.level,1);assert.ok(sim.shots.some(s=>s.active));
    take(sim,'power');sim.beginTurn();const reserve=sim.powerReserve;sim.update(1);assert.equal(sim.powerReserve,reserve);
    sim.turnRemaining=0;sim.player.health=0;sim.update(.1);assert.equal(sim.powerReserve,reserve);
  }
});

test('shields absorb hits before hull; hull damage lowers power and death resets the fighter',()=>{
  const sim=arena();take(sim,'hull');take(sim,'hull');take(sim,'shield');take(sim,'shield');sim.level=3;
  assert.equal(sim.maxHealth,3);assert.equal(sim.player.health,3);assert.equal(sim.player.shields,2);
  for(let n=1;n>=0;n--){sim.player.invulnerable=0;sim.damagePlayer();sim.damagePlayer();assert.equal(sim.player.shields,n);assert.equal(sim.player.health,3);assert.equal(sim.level,3);}
  sim.player.invulnerable=0;sim.damagePlayer();assert.equal(sim.player.health,2);assert.equal(sim.level,2);assert.equal(sim.lives,3);
  take(sim,'hull');assert.equal(sim.player.health,3);assert.equal(sim.maxHealth,3);
  for(let n=2;n>=0;n--){sim.player.invulnerable=0;sim.damagePlayer();assert.equal(sim.player.health,n);}
  assert.equal(sim.lives,2);assert.equal(sim.maxHealth,1);assert.equal(sim.level,1);assert.equal(sim.player.shields,0);
  for(let i=0;i<60;i++)sim.update(1/60);assert.equal(sim.player.health,1);assert.ok(sim.player.invulnerable>2);
});

test('full defenses convert to score once and current loadout survives level changes but not fresh practice',()=>{
  const run=new CampaignRun();const sim=run.sim;
  take(sim,'laser');take(sim,'hull');take(sim,'hull');take(sim,'shield');take(sim,'shield');
  for(const type of ['hull','shield']){const before=sim.score,p=sim.dropPickup(0,-6,type);sim.collectPickup(p);sim.collectPickup(p);assert.equal(sim.score-before,1000);}
  sim.player.health=2;sim.completeLevel();assert.ok(run.nextLevel());
  assert.equal(run.sim.weapon,'laser');assert.equal(run.sim.level,2);assert.equal(run.sim.player.health,2);assert.equal(run.sim.maxHealth,3);assert.equal(run.sim.player.shields,2);
  const practice=new CampaignRun({practiceLevel:2}).sim;assert.equal(practice.maxHealth,1);assert.equal(practice.player.shields,0);assert.equal(practice.level,1);
});

test('every battery is a physical reachable mount: each weapon destroys it through actual scenery',()=>{
  for(const level of compileCampaign(417))for(const segment of level.segments)for(const definition of segment.targets.filter(t=>t.kind==='battery'))for(const weapon of Object.keys(WEAPONS)){
    const sim=new CampaignRun({practiceLevel:level.index,practiceSegment:segment.segmentIndex,weapon}).sim;
    const turret=sim.targets.find(t=>t.id===definition.id);assert.equal(turret.x,turret.mountX);
    // Keep every real hull/debris collider. Isolate the battery to measure its firing lane.
    sim.targets=[turret];sim.mission={...sim.mission,waves:[],hazards:[],completion:undefined};
    sim.time=(turret.anchorY-16+24)/110*segment.duration;sim.distance=sim.routeDistance(sim.time);sim.previousDistance=sim.distance;
    sim.player.x=turret.x;sim.player.y=-6;
    for(let i=0;i<900&&!turret.destroyed;i++){sim.player.invulnerable=100;sim.update(1/60);}
    assert.ok(turret.destroyed,weapon+' / '+definition.id+' HP '+turret.hp);
  }
});

test('colours and labels distinguish all pickup types, supplies exist during assaults, weapon crates do not magnetise a switch',()=>{
  for(const weapon of Object.keys(WEAPONS))assert.equal(WEAPONS[weapon].color,PICKUPS[weapon].color);
  assert.equal(new Set(Object.values(PICKUPS).map(p=>p.color)).size,7);
  assert.equal(new Set(Object.values(PICKUPS).map(p=>p.label[0])).size,7);
  const supplied=new Set(compileCampaign(417).flatMap(l=>l.segments.flatMap(s=>s.waves.filter(w=>w.pattern==='supply-escort').map(w=>w.rewardType))));
  assert.deepEqual(supplied,new Set(['weapon','shield','hull','power','pulse']));
  for(const l of compileCampaign(417))assert.ok(l.segments.at(-1).waves.some(w=>w.pattern==='supply-escort'));
  const sim=arena(),pickup=sim.dropPickup(2.5,-6,'laser');sim.update(.1);assert.equal(pickup.x,2.5);assert.equal(sim.weapon,'vulcan');
  assert.deepEqual([0,1,2].map(()=>sim.dropPickup(0,0,'weapon').pickupType),['vulcan','laser','homing']);
});

test('a clearing shot during respawn carries a living replacement into the next level',()=>{
  const run=new CampaignRun(),sim=run.sim;sim.enterSegment(3);sim.player.invulnerable=0;sim.damagePlayer();
  assert.equal(sim.player.health,0);assert.equal(sim.lives,2);
  sim.damageTarget(sim.targets.find(t=>t.kind==='core'),999);assert.equal(sim.status,'won');assert.equal(sim.player.health,1);
  assert.ok(run.nextLevel());assert.equal(run.sim.player.health,1);assert.equal(run.sim.lives,2);assert.ok(run.sim.controlsEnabled);
});
