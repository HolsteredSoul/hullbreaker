import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignRun} from '../src/campaign.js';
import {compileCampaign} from '../src/content.js';
import {steerAroundScenery,clearSpawnX} from '../src/enemy-navigation.js';
import {sweepBox} from '../src/collision.js';

test('enemies steer around cover and brake relative to scrolling scenery without phasing through it',()=>{
 const wall={x:0,y:0,w:3,d:2,bottom:-1,top:2};
 const enemy={x:0,y:6,kind:'gunship',navVx:0};
 const velocity=steerAroundScenery(enemy,{vx:0,vy:-4},[wall],0,0);
 assert.ok(Math.abs(velocity.vx)>0 || velocity.vy>-4);assert.ok(enemy.avoiding);
 assert.equal(sweepBox(0,6,velocity.vx*1.65,6+velocity.vy*1.65,wall,1.2,0,0,.2),Infinity);
 assert.notEqual(clearSpawnX(0,0,1.2,[wall]),0);
 assert.equal(clearSpawnX(0,0,1.2,[{...wall,w:50}]),null);
 const below={...wall,top:-1};assert.deepEqual(steerAroundScenery(enemy,{vx:0,vy:-4},[below],0,2),{vx:0,vy:-4});
});

test('station canyons and moon trenches across three seeds retain attacking waves without terrain suicides',()=>{
 for(const seed of [417,42,901])for(const level of compileCampaign(seed))for(const segment of level.segments){
  if(!['station','moon'].includes(segment.environment.type))continue;
  const sim=new CampaignRun({seed,practiceLevel:level.index,practiceSegment:segment.segmentIndex}).sim;
  sim.player.cooldown=1e6;let peak=0,shots=0;const original=sim.hostileShot.bind(sim);
  sim.hostileShot=(...args)=>{shots++;return original(...args);};
  for(let i=0;i<Math.floor((segment.duration-.1)*60);i++){
   sim.player.invulnerable=999;sim.update(1/60);peak=Math.max(peak,sim.enemies.filter(e=>e.active).length);
  }
  assert.equal(sim.enemyTerrainCrashes,0,seed+' / '+segment.id);
  assert.ok(sim.enemySerial>=80);assert.ok(shots>100);assert.ok(peak<=30);
  assert.ok(sim.enemies.filter(e=>e.active).length<20,'Waves keep moving through the battlefield');
 }
});

test('armoured turrets have denser bursts with preserved warnings, controller weakening and destruction cancellation',()=>{
 const gunSim=new CampaignRun({practiceLevel:0,practiceSegment:3}).sim;
 const gun=gunSim.targets.find(t=>t.kind==='battery');assert.ok(gun.hp>=49);assert.equal(gun.burstCount,4);assert.ok(gun.interval<=3.3);
 gunSim.time=gun.nextAt=0;gunSim.distance=gun.anchorY;gun.y=0;
 const gunShots=[];gunSim.hostileShot=(...args)=>{gunShots.push(args);return {};};
 for(let i=0;i<4;i++){gunSim.time=i*.151;gunSim.updateBattery(gun,1/60);}
 assert.equal(gunShots.length,4);assert.ok(gunShots.every(s=>s[4]===7.5));
 const sim=new CampaignRun({practiceLevel:2,practiceSegment:3}).sim,launcher=sim.targets.find(t=>t.kind==='launcher');
 assert.ok(launcher.hp>=60);assert.equal(launcher.salvoCount,2);
 sim.time=(launcher.anchorY-16+24)*sim.mission.duration/110;sim.waveIndex=999;sim.player.cooldown=999;sim.update(1/60);
 assert.ok(launcher.nextAt-sim.time>=1.29);
 const shots=[];sim.hostileShot=(...args)=>{shots.push(args);return {};};
 sim.time=launcher.nextAt;sim.updateLauncher(launcher);assert.equal(shots.length,2);assert.equal(launcher.burstLeft,1);
 sim.time+=.31;sim.updateLauncher(launcher);assert.equal(shots.length,2);
 sim.time+=.02;sim.updateLauncher(launcher);assert.equal(shots.length,4);assert.equal(launcher.burstLeft,0);
 sim.time=launcher.nextAt;sim.updateLauncher(launcher);sim.damageTarget(launcher,999);sim.time+=1;sim.updateLauncher(launcher);assert.equal(shots.length,6);
 sim.enterSegment(sim.segmentIndex,true);assert.ok(launcher.destroyed);assert.equal(launcher.burstLeft,0);
});
