import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignRun } from '../src/campaign.js';
import { weaponTier } from '../src/weapon-progression.js';
import { sweepBox } from '../src/collision.js';
import { compileCampaign } from '../src/content.js';

function arena(){
  const sim=new CampaignRun().sim;
  sim.mission={...sim.mission,waves:[],hazards:[],route:[{at:0,distance:0},{at:60,distance:0}]};
  sim.distance=0;sim.previousDistance=0;sim.targets=[];sim.obstacles=[];sim.player.cooldown=1e5;
  return sim;
}
function bullet(sim,values){const shot=sim.shots.find(s=>!s.active);Object.assign(shot,{active:true,x:0,y:-4,vx:0,vy:80,age:0,entry:0,height:0,damage:5,friendly:true,homing:false,missile:false,pierce:0,source:null,hitIds:new Set(),...values});return shot;}
const wall=()=>({id:'wall',x:0,y:0,w:2,d:1,bottom:-.5,top:2,hp:10,maxHp:10,destroyed:false});

test('power tiers visibly increase streams, sustained output and weapon-specific abilities',()=>{
  for(const [weapon,counts] of [['vulcan',[3,5,7]],['laser',[1,2,3]],['homing',[2,4,6]]]){
    let previous=0;
    for(let level=1;level<=3;level++){
      const sim=arena();sim.weapon=weapon;sim.level=level;sim.player.cooldown=0;sim.update(1/60);
      const shots=sim.shots.filter(s=>s.active&&s.friendly);assert.equal(shots.length,counts[level-1]);
      const tier=weaponTier(weapon,level),output=shots.length*tier.damage/tier.interval;
      assert.ok(output>previous*1.4);previous=output;
      if(weapon==='laser')assert.equal(shots[0].pierce,level-1);
    }
  }
});
test('seekers split across live targets and piercing lances cannot repeatedly hit one fighter',()=>{
  const sim=arena();sim.weapon='homing';sim.level=3;
  for(const x of [-5,0,5])sim.spawnEnemy(x,10);
  sim.fireCampaignWeapon();assert.equal(new Set(sim.shots.filter(s=>s.active).map(s=>s.targetId)).size,3);
  const lance=arena(),enemy=lance.spawnEnemy(0,3,'gunship');enemy.hp=50;enemy.entry=0;
  const shot=bullet(lance,{y:1,vy:10,pierce:2,damage:2});lance.update(.1);const hp=enemy.hp;lance.update(.01);
  assert.equal(enemy.hp,hp);assert.ok(shot.active);
});
test('power and pulse rewards reach a bottom-positioned fighter and pay only once',()=>{
  const sim=arena();const pickup=sim.dropPickup(0,16,'power');
  for(let i=0;i<600&&pickup.active;i++)sim.update(1/60);
  assert.equal(pickup.active,false);assert.equal(sim.level,2);assert.equal(sim.score,500);
  sim.collectPickup(pickup);assert.equal(sim.score,500);
  sim.level=3;const max=sim.dropPickup(0,-6);sim.collectPickup(max);assert.equal(sim.score,2000);
  sim.player.bombs=2;const pulse=sim.dropPickup(0,-6,'pulse');sim.collectPickup(pulse);assert.equal(sim.player.bombs,3);assert.equal(sim.score,2250);
  sim.collectPickup(sim.dropPickup(0,-6,'pulse'));assert.equal(sim.player.bombs,3);assert.equal(sim.score,3250);
});
test('clean squad bonuses are once-only and canceled by escapes or partial spawns',()=>{
  const sim=arena();sim.spawnWave({pattern:'double-vee',bonus:500});
  for(const enemy of sim.enemies.filter(e=>e.active))sim.awardKill(enemy);
  assert.equal(sim.events.filter(e=>e.type==='formation-clear').length,1);const score=sim.score;
  sim.awardKill(sim.enemies[0]);assert.equal(sim.score,score);
  sim.events=[];sim.spawnWave({pattern:'pincer',bonus:500});const enemies=sim.enemies.filter(e=>e.active);
  sim.finishFormation(enemies[0],false);enemies[0].active=false;
  enemies.slice(1).forEach(e=>sim.awardKill(e));assert.equal(sim.events.filter(e=>e.type==='formation-clear').length,0);
});
test('solid cover stops fast bullets, missiles and piercing fire before targets behind it',()=>{
  for(const friendly of [true,false])for(const missile of [true,false]){
    const sim=arena();sim.obstacles=[wall()];sim.player.invulnerable=0;
    const enemy=sim.spawnEnemy(0,4,'gunship');enemy.hp=100;enemy.cooldown=100;
    const shot=bullet(sim,{friendly,missile,pierce:2,y:friendly?-4:4,vy:friendly?80:-80});
    sim.update(.1);assert.equal(shot.active,false);assert.equal(enemy.hp,100);assert.equal(sim.lives,3);
  }
});
test('cover destruction persists across passes; decks below flight altitude do not block shots',()=>{
  const sim=new CampaignRun({practiceLevel:0,practiceSegment:3}).sim;
  const wreck=sim.obstacles.find(o=>o.destructible);sim.damageObstacle(wreck,99);const score=sim.score;
  sim.enterSegment(3,true);assert.ok(sim.obstacles.find(o=>o.id===wreck.id).destroyed);
  sim.damageObstacle(wreck,99);assert.equal(sim.score,score);
  const deck=arena();deck.obstacles=[{...wall(),bottom:-2,top:-.65}];const shot=bullet(deck);deck.update(.1);assert.ok(shot.active);
});
test('fighters collide with structures, and protected movement cannot leave the steering field',()=>{
  const sim=arena();sim.obstacles=[wall()];const enemy=sim.spawnEnemy(0,2);enemy.entry=0;sim.update(.6);assert.equal(enemy.active,false);
  const player=arena();player.player.y=-3;player.player.invulnerable=0;player.obstacles=[wall()];player.update(.3,{x:0,y:1});assert.equal(player.lives,2);
  const protectedSim=arena();protectedSim.player.y=-9;protectedSim.obstacles=[{...wall(),y:-9}];protectedSim.update(.1);
  assert.ok(protectedSim.player.y>=-9&&protectedSim.player.y<=12&&Math.abs(protectedSim.player.x)<=8);
  assert.equal(sweepBox(protectedSim.player.x,protectedSim.player.y,protectedSim.player.x,protectedSim.player.y,protectedSim.obstacles[0],.42),Infinity);
});
test('generated assaults mix roles at higher density while retaining breaks and a bounded population',()=>{
  for(const level of compileCampaign(417))for(const segment of level.segments){
    const kinds=new Set(segment.waves.map(w=>w.pattern));assert.ok(kinds.size>=5);
    assert.ok(segment.waves.length/segment.duration>.3);assert.equal(segment.combat.maxEnemies,30);
    assert.ok(segment.waves.some((w,i)=>i&&w.at-segment.waves[i-1].at>=3.5));
  }
});

test('surface weapons and launching fighters clear their own mount, while enemy debris damage gives no player score',()=>{
  const sim=arena();sim.targets=[{id:'gun',kind:'core',x:0,y:0,anchorY:0,hp:100,maxHp:100,radius:1.8,startAt:0,nextAt:0,interval:2,entered:true}];
  sim.update(1/60);const shots=sim.shots.filter(s=>s.active&&!s.friendly);assert.equal(shots.length,5);assert.ok(shots.every(s=>s.source==='gun'));
  const bay=arena();bay.targets=[{id:'bay',kind:'bay',x:0,y:0,anchorY:0,hp:100,maxHp:100,radius:1.5,startAt:0,nextAt:0,interval:8,squad:2,launches:0,entered:true}];
  for(let i=0;i<60;i++)bay.update(1/60);assert.equal(bay.enemies.filter(e=>e.active).length,2);
  const wreck={...wall(),destructible:true};sim.damageObstacle(wreck,99,false);assert.ok(wreck.destroyed);assert.equal(sim.score,0);
});
