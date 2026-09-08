import { WEAPONS, DIFFICULTIES, seededRandom } from './content.js';
import { SQUADS } from './encounters.js';
import { weaponTier, upgradeWeapon, collectWeapon, depletePower, POWER_RESERVE, PICKUPS } from './weapon-progression.js';
import { sweepBox, sweepCircle } from './collision.js';

export const FIELD = Object.freeze({ minX: -8, maxX: 8, minY: -9, maxY: 12 });
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const pool = (count) => Array.from({ length: count }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0 }));
function obtain(items, values) {
  const item = items.find(entry => !entry.active);
  if (item) Object.assign(item, { active: true, age: 0, vx: 0, vy: 0, entry: 0, height: 0, source: null, sourceBay:null, pierce: 0, hitIds: null, targetId: null, width: 1, waveId: null, pickupType: 'power' }, values);
  return item;
}
// Swept point vs circle avoids tunneling, including at lower rendering rates.
export function segmentHits(ax, ay, bx, by, cx, cy, radius) {
  const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
  const t = length2 ? clamp(((cx - ax) * dx + (cy - ay) * dy) / length2, 0, 1) : 0;
  return (ax + t * dx - cx) ** 2 + (ay + t * dy - cy) ** 2 <= radius * radius;
}

export class Simulation {
  constructor(mission, weapon = 'vulcan', difficulty = 'pilot') {
    if (!WEAPONS[weapon]) throw new Error('Unknown weapon');
    this.mission = mission;
    this.weapon = weapon;
    this.difficulty = DIFFICULTIES[difficulty] || DIFFICULTIES.pilot;
    this.maxHealth = mission.route ? this.difficulty.health : 3;
    this.waveIndex = 0; this.recoveryIndex = 0; this.bossPhase = 1; this.phaseStarted = mission.boss?.at ?? 0; this.transitionUntil = 0;
    this.time = 0; this.distance = 0; this.status = 'playing'; this.score = 0; this.kills = 0; this.level = 1;
    this.chain = 0; this.chainUntil = 0;
    this.powerReserve = POWER_RESERVE; this.weaponDropIndex = 0;
    this.random = seededRandom(mission.combatSeed ?? mission.environment.seed);
    this.fxRandom = seededRandom(mission.environment.seed ^ 0xabcdef);
    this.player = { x: 0, y: -6, health: this.maxHealth, bombs: 2, invulnerable: 1.5, cooldown: 0 };
    this.targets = mission.targets.map(target => ({ ...target, anchorY: target.y, maxHp: target.hp, destroyed: false, nextAt: target.startAt, launches: 0, flash: 0 }));
    this.enemies = pool(64); this.shots = pool(mission.campaign ? 1024 : 480); this.particles = pool(450); this.pickups = pool(12);
    this.enemySerial = 0; this.waveSerial = 0; this.formations = new Map(); this.powerKills = 0;
    this.obstacles = (mission.obstacles || []).map(o=>({...o,destroyed:false,maxHp:o.hp}));
    this.events = []; this.nextPatrol = mission.patrol.startAt; this.sector = -1;
    this.reinforcementAt = mission.boss?.at ?? 70; this.bombFlash = 0;
  }
  routeDistance(time) {
    const route = this.mission.route;
    if (!route) return Math.min(time, this.mission.scrollUntil) * this.mission.scrollSpeed;
    const i = Math.max(0, route.findLastIndex(p => p.at <= time)), a = route[i], b = route[i + 1] || a;
    return a.distance + (b.distance - a.distance) * clamp((time - a.at) / (b.at - a.at || 1), 0, 1);
  }
  get bossState() {
    const boss = this.mission.boss;
    if (!boss || this.time < boss.at) return 'dormant';
    if (this.time < this.transitionUntil) return 'transition';
    const cooled = boss.coolantId ? this.targetById(boss.coolantId)?.destroyed : this.targets.some(t => t.kind === 'coolant' && t.destroyed);
    const exposed = cooled ? boss.weakenedExposure : boss.exposed;
    return (this.time - this.phaseStarted) % boss.shieldPeriod < boss.shieldPeriod - exposed ? 'shielded' : 'exposed';
  }
  hazardState(hazard) {
    if (this.time < (hazard.from || 0) || this.time >= hazard.until) return 'off';
    return (this.time - (hazard.from || 0)) % hazard.period > (hazard.activeAfter ?? 3.2) ? 'active' : 'warning';
  }
  spawnWave(wave) {
    if (wave.sourceBay && this.targetById(wave.sourceBay)?.destroyed) return;
    const side = wave.side || 1;
    if (this.mission.campaign && SQUADS[wave.pattern]) {
      const id = ++this.waveSerial, squad = SQUADS[wave.pattern];
      const state = { remaining: 0, clean: true, bonus: wave.bonus || 400 }; this.formations.set(id, state);
      for (const [x,y,kind,path='forward'] of squad) {
        const enemy = this.spawnEnemy(x*side,y,kind);
        if (!enemy) { state.clean=false; continue; }
        Object.assign(enemy,{waveId:id,path,originX:x*side,x:x*side,vx:path==='cross'?-Math.sign(x*side)*4.2:0,rewardType:wave.rewardType||'power'});
        state.remaining++;
      }
      if (!state.remaining) this.formations.delete(id);
      this.emit('wave', {pattern:wave.pattern}); return;
    }
    if (wave.pattern === 'crossfire') {
      for (let i=0;i<3;i++) {
        const enemy = this.spawnEnemy(side*10, 15+i*2, 'scout');
        if (enemy) Object.assign(enemy, { x: side*(10+i*1.4), path: 'cross', vx: -side*5.8, entry: 0 });
      }
      this.emit('wave', { pattern: wave.pattern }); return;
    }
    const formations = {
      'scout-vee': [[-3,18,'scout'],[0,16,'scout'],[3,18,'scout']],
      'scout-gap': [[-6,17,'scout'],[-3,18,'scout'],[5,18,'scout']],
      'scout-sweep': [[-5*side,17,'scout'],[-2*side,19,'scout'],[side,21,'scout']],
      'interceptor-pair': [[-4,18,'interceptor'],[4,20,'interceptor']],
      'bomber-escort': [[side*2,19,'bomber'],[-5,17,'scout'],[5,17,'scout']],
    };
    for (const [x,y,kind] of formations[wave.pattern] || []) this.spawnEnemy(x,y,kind);
    this.emit('wave', { pattern: wave.pattern });
  }
  updateBattery(target, dt) {
    if (!this.targetVisible(target)) { target.burstLeft = 0; return; }
    if (target.nextAt - this.time > .35 || target.aimX === undefined) {
      target.aimX = this.player.x; target.aimY = this.player.y;
    }
    target.aimAngle = -Math.atan2(target.aimX - target.mountX, target.aimY - target.y);
    if (this.time >= target.nextAt && !target.burstLeft) {
      target.burstLeft = this.controllerDisabled(target) ? 1 : 3;
      target.burstAt = this.time;
    }
    if (target.burstLeft && this.time >= target.burstAt) {
      const dx = target.aimX - target.mountX, dy = target.aimY - target.y, length = Math.hypot(dx,dy) || 1;
      const shot = this.hostileShot(target.mountX + dx / length * 2.4, target.y + dy / length * 2.4, dx, dy, 6);
      if (shot) Object.assign(shot, { source: target.id, height: 1.2, entry: .35 });
      target.burstLeft--; target.burstAt += .18;
      if (!target.burstLeft) target.nextAt = this.time + target.interval * this.difficulty.fireInterval * (this.controllerDisabled(target) ? 1.5 : 1);
    }
  }
  targetById(id) { return this.targets.find(t => t.id === id); }
  controllerDisabled(target) {
    return this.mission.campaign ? !!this.targetById(target.controllerId)?.destroyed : this.targets.some(t => t.kind === 'turret' && t.destroyed);
  }
  isTargetShielded(target) {
    return !!target.gates?.some(id => !this.targetById(id)?.destroyed) || (target.kind === 'core' && !!this.mission.boss && this.bossState !== 'exposed');
  }
  updateLauncher(target) {
    if (!this.targetVisible(target)) return;
    if (target.nextAt - this.time > .35 || target.aimX === undefined) { target.aimX = this.player.x; target.aimY = this.player.y; }
    target.aimAngle = -Math.atan2(target.aimX - target.x, target.aimY - target.y);
    if (this.time < target.nextAt) return;
    const disabled = this.controllerDisabled(target);
    const dx = target.aimX - target.x, dy = target.aimY - target.y, length = Math.hypot(dx, dy) || 1;
    for (const offset of disabled ? [0] : [-.55, .55]) {
      const shot = this.hostileShot(target.x + dx / length * .86 - dy / length * offset, target.y + dy / length * .86 + dx / length * offset, dx, dy, 4.5, true);
      if (shot) { shot.source = target.id; shot.entry = .35; shot.height = .6; }
    }
    target.nextAt = this.time + target.interval * this.difficulty.fireInterval * (disabled ? 1.5 : 1);
  }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  burst(x, y, count = 20, color = 'orange') {
    for (let i = 0; i < count; i++) {
      const angle = this.fxRandom() * Math.PI * 2, speed = 1 + this.fxRandom() * 6;
      obtain(this.particles, { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.25 + this.fxRandom() * 0.6, color });
    }
  }
  spawnEnemy(x, y, kind = 'scout') {
    if (this.mission.route && this.enemies.filter(e => e.active).length >= (this.mission.combat?.maxEnemies ?? 18)) return null;
    const enemy = obtain(this.enemies, { x: clamp(x, -7.5, 7.5), y, originX: x, kind, hp: kind === 'bomber' ? 4 : 2, cooldown: 1.2 + this.random(), phase: this.random() * 6.28, dash: false });
    if (enemy) { enemy.entry = this.mission.route && y < 16 ? .7 : 0; enemy.dashX = null; enemy.path = 'forward'; enemy.angle = Math.PI; if (this.mission.route && kind === 'bomber') enemy.hp = 6; }
    if (enemy && this.mission.campaign) Object.assign(enemy,{id:++this.enemySerial,hp:kind==='gunship'?18:kind==='bomber'?10:kind==='supply'?7:3,cooldown:.65+this.random()*.3,aimX:undefined,aimY:undefined,volleys:0,dashY:null});
    return enemy;
  }
  hostileShot(x, y, dx, dy, speed = 7, missile = false) {
    const length = Math.hypot(dx, dy) || 1;
    speed *= this.mission.route ? this.difficulty.bulletSpeed * (this.mission.combat?.bulletSpeed ?? 1) : 1;
    return obtain(this.shots, { x, y, vx: dx / length * speed, vy: dy / length * speed, friendly: false, damage: 1, missile, homing: false, height: 0, entry: 0, source: null });
  }
  damageTarget(target, damage) {
    if (target.destroyed || this.isTargetShielded(target)) return;
    if (target.kind === 'core' && this.mission.boss) {
      if (this.bossState !== 'exposed') return;
      const floor = (3 - this.bossPhase) * this.mission.boss.phaseHp;
      damage = Math.min(damage, target.hp - floor);
      if (target.hp - damage <= floor && this.bossPhase < 3) {
        this.bossPhase++; this.transitionUntil = this.time + (this.mission.boss.transition ?? 2); this.phaseStarted = this.transitionUntil;
        for (const shot of this.shots) if (!shot.friendly) shot.active = false;
        this.emit('boss-phase', { phase: this.bossPhase });
      }
    }
    target.hp = Math.max(0, target.hp - damage); target.flash = 0.08;
    if (target.hp > 0) return;
    target.destroyed = true;
    target.burstLeft = 0;
    this.score += target.reward;
    this.burst(target.x, target.y, 55);
    this.emit('target-destroyed', { id: target.id, kind: target.kind, label: target.label });
    if (target.kind === 'bay') this.dropPickup(target.x, target.y, 'power');
    if (target.kind === 'core' && !this.mission.campaign) { this.status = 'won'; this.score += this.player.health * 1000; this.emit('won'); }
  }
  damagePlayer() {
    const player = this.player;
    if (player.invulnerable > 0 || this.status !== 'playing') return;
    player.health--; player.invulnerable = 1.7;
    this.chain = 0;
    this.burst(player.x, player.y, 24, 'mint'); this.emit('hit');
    if (player.health <= 0) { this.status = 'lost'; this.emit('lost', { reason: 'Your fighter was destroyed. Try taking out the bays earlier.' }); }
  }
  bomb() {
    if (this.status !== 'playing' || this.player.bombs <= 0 || this.player.health <= 0 || this.turnRemaining > 0) return false;
    this.player.bombs--; this.player.invulnerable = Math.max(1.2, this.player.invulnerable); this.bombFlash = 1;
    for (const shot of this.shots) if (!shot.friendly) shot.active = false;
    for (const enemy of this.enemies) if (enemy.active) { if(this.mission.campaign)this.awardKill(enemy); else {enemy.active = false; this.score += 100; this.kills++; this.burst(enemy.x, enemy.y, 12);} }
    for (const obstacle of this.obstacles) if(obstacle.destructible&&!obstacle.destroyed&&Math.abs(obstacle.y-this.distance)<18)this.damageObstacle(obstacle,20);
    for (const target of this.targets) if (this.targetVisible(target)) this.damageTarget(target, 13);
    this.emit('bomb'); return true;
  }
  targetVisible(target) { return !target.destroyed && target.y < 17 && target.y > -11 && this.time >= (this.mission.route || target.kind === 'core' ? target.startAt : 0); }
  awardKill(enemy) {
    if (!enemy.active) return;
    this.finishFormation(enemy, true);
    enemy.active = false; this.kills++;
    if (this.mission.pace) { this.chain++; this.chainUntil = this.time + this.mission.pace.chainWindow; }
    const points = (this.mission.campaign ? enemy.kind==='gunship'?350:enemy.kind==='bomber'?250:enemy.kind==='interceptor'?180:100 : 120) * Math.min(4, 1 + Math.floor(this.chain / 5));
    this.score += points;
    this.burst(enemy.x, enemy.y, 24); this.emit('kill');
    if (this.mission.campaign) {
      this.powerKills++;
      if(enemy.kind==='supply'){this.dropPickup(enemy.x,enemy.y,enemy.rewardType);if(enemy.rewardType==='power')this.powerKills=0;}
      else if(this.powerKills>=18){this.dropPickup(enemy.x,enemy.y,'power');this.powerKills=0;}
    } else if (this.mission.pace && this.kills % 10 === 0) this.dropPickup(enemy.x,enemy.y);
  }
  finishFormation(enemy, killed) {
    const wave=this.formations.get(enemy.waveId);if(!wave)return;
    wave.remaining--;if(!killed)wave.clean=false;
    if(wave.remaining<=0){if(wave.clean){this.score+=wave.bonus;this.emit('formation-clear',{bonus:wave.bonus,x:enemy.x,y:enemy.y});}this.formations.delete(enemy.waveId);}
  }
  dropPickup(x,y,pickupType='power') {
    // Fixed weapon crates are deliberately collected or avoided; magnets never force a switch.
    if (pickupType === 'weapon') pickupType = ['vulcan', 'laser', 'homing'][this.weaponDropIndex++ % 3];
    if (!PICKUPS[pickupType]) return null;
    return obtain(this.pickups,{x:clamp(x,-7,7),y,life:14,pickupType});
  }
  collectPickup(pickup) {
    if(!pickup?.active||this.player.health<=0||this.status!=='playing'||this.turnRemaining>0)return;
    pickup.active=false;
    if(!this.mission.campaign){this.player.health=Math.min(this.maxHealth,this.player.health+1);this.score+=500;this.level=Math.min(3,this.level+1);this.emit('pickup');return;}
    if(WEAPONS[pickup.pickupType]) collectWeapon(this,pickup.pickupType);
    else if(pickup.pickupType==='shield'){
      const maxed=this.player.shields>=2,bonus=maxed?1000:250;
      this.player.shields=Math.min(2,(this.player.shields||0)+1);this.score+=bonus;
      this.emit('shield-pickup',{bonus,maxed,shields:this.player.shields});
    }else if(pickup.pickupType==='hull'){
      const maxed=this.maxHealth>=3&&this.player.health>=3,bonus=maxed?1000:250;
      this.maxHealth=Math.min(3,this.maxHealth+1);this.player.health=this.maxHealth;this.score+=bonus;
      this.emit('hull-pickup',{bonus,maxed,health:this.player.health});
    }else if(pickup.pickupType==='pulse'){
      const maxed=this.player.bombs>=3,bonus=maxed?1000:250;this.player.bombs=Math.min(3,this.player.bombs+1);this.score+=bonus;
      this.emit('pulse-pickup',{bonus,maxed});
    }else upgradeWeapon(this);
  }
  damageObstacle(obstacle,damage,credit=true){
    if(!obstacle.destructible||obstacle.destroyed)return;
    obstacle.hp=Math.max(0,obstacle.hp-damage);
    if(!obstacle.hp){obstacle.destroyed=true;if(credit)this.score+=100;this.burst(obstacle.x,obstacle.y-this.distance,24);this.emit('obstacle-destroyed',{id:obstacle.id});}
  }
  sceneryContact(ax,ay,bx,by,radius=0,ah=0,bh=ah,source=null,verticalRadius=radius){
    let time=Infinity,obstacle=null;
    for(const box of this.activeObstacles || []){
      if(box.destroyed||source&&box.source===source)continue;
      if(Math.max(ax,bx)<box.x-box.w/2-radius||Math.min(ax,bx)>box.x+box.w/2+radius||Math.max(ay+(this.previousDistance??this.distance),by+this.distance)<box.y-box.d/2-radius||Math.min(ay+(this.previousDistance??this.distance),by+this.distance)>box.y+box.d/2+radius)continue;
      const t=sweepBox(ax,ay+(this.previousDistance??this.distance),bx,by+this.distance,box,radius,ah,bh,verticalRadius);
      if(t<time){time=t;obstacle=box;}
    }
    return {time,obstacle};
  }
  fireCampaignWeapon(){
    const tier=weaponTier(this.weapon,this.level),lanes=tier.angles||tier.offsets;
    const targets=[...this.enemies.filter(e=>e.active&&e.y>this.player.y),...this.targets.filter(t=>this.targetVisible(t)&&!this.isTargetShielded(t)&&t.y>this.player.y)].sort((a,b)=>Math.hypot(a.x-this.player.x,a.y-this.player.y)-Math.hypot(b.x-this.player.x,b.y-this.player.y));
    for(let i=0;i<lanes.length;i++){
      const angle=tier.angles?.[i]||0;
      obtain(this.shots,{x:this.player.x+(tier.offsets?.[i]??(i-(lanes.length-1)/2)*.13),y:this.player.y+.7,
        vx:Math.sin(angle)*tier.speed,vy:Math.cos(angle)*tier.speed,speed:tier.speed,friendly:true,damage:tier.damage,
        missile:this.weapon==='homing',homing:this.weapon==='homing',targetId:targets.length?targets[i%targets.length].id:null,
        pierce:tier.pierce||0,hitIds:new Set(),width:tier.width,weapon:this.weapon});
    }
    this.player.cooldown+=tier.interval;depletePower(this,tier.interval);this.emit('fire');
  }
  updateCampaignEnemy(enemy,dt){
    const oldX=enemy.x,oldY=enemy.y,player=this.player;
    let speed=enemy.kind==='gunship'?3.2:enemy.kind==='bomber'?3.6:enemy.kind==='supply'?4.4:5.4;
    if(enemy.kind==='interceptor'){
      if(enemy.age<1.05)enemy.x+=clamp(player.x-enemy.x,-3,3)*dt;
      else {enemy.dashX??=clamp(player.x,-7,7);enemy.dashY??=player.y;}
      if(enemy.age>1.85){speed=12;enemy.x+=clamp(enemy.dashX-enemy.x,-5,5)*dt;}
    }else if(enemy.path==='cross')enemy.x+=enemy.vx*dt;
    else if(enemy.path==='sweep')enemy.x=clamp(enemy.originX+Math.sin(enemy.age*1.1)*3,-8,8);
    else enemy.x=clamp(enemy.originX+Math.sin(enemy.age*1.3+enemy.phase)*.8,-8,8);
    if(enemy.path==='hold'&&enemy.y<=10&&enemy.age<6)speed=0;
    enemy.y-=speed*dt;enemy.angle=speed===0?-Math.atan2(player.x-enemy.x,player.y-enemy.y):-Math.atan2(enemy.x-oldX,enemy.y-oldY);
    if(enemy.cooldown>.35||enemy.aimX===undefined){enemy.aimX=player.x;enemy.aimY=player.y;}
    if(enemy.cooldown<=0&&enemy.y<16&&enemy.y>player.y+3&&Math.hypot(enemy.x-player.x,enemy.y-player.y)>4&&enemy.kind!=='supply'){
      const angle=Math.atan2(enemy.aimX-enemy.x,enemy.aimY-enemy.y);
      const spread=enemy.kind==='gunship'?[-.48,-.24,0,.24,.48]:enemy.kind==='bomber'?[-.22,.22]:enemy.volleys%2===0?[-.16,0,.16]:[0];
      for(const offset of spread)this.hostileShot(enemy.x,enemy.y-.7,Math.sin(angle+offset),Math.cos(angle+offset),enemy.kind==='bomber'?6:8,enemy.kind==='bomber');
      enemy.volleys++;enemy.cooldown=(enemy.kind==='gunship'?1.15:enemy.kind==='bomber'?1.35:1.1)*this.difficulty.fireInterval*this.mission.combat.fireInterval;
    }
    const contact=this.sceneryContact(oldX,oldY,enemy.x,enemy.y,enemy.kind==='gunship'?1.2:enemy.kind==='bomber'?.9:.6,0,0,enemy.age<enemy.entry+1?enemy.sourceBay:null,.2);
    if(contact.obstacle||enemy.y< -13||Math.abs(enemy.x)>15){this.finishFormation(enemy,false);enemy.active=false;if(contact.obstacle)this.burst(enemy.x,enemy.y,14);return;}
    if(segmentHits(oldX,oldY,enemy.x,enemy.y,player.x,player.y,.85)){this.damagePlayer();this.finishFormation(enemy,false);enemy.active=false;this.burst(enemy.x,enemy.y);}
  }
  update(dt, input = { x: 0, y: 0 }) {
    if (this.status !== 'playing' || !(dt > 0)) return;
    input = { x: 0, y: 0, ...input };
    this.time += dt;
    if (this.time > this.chainUntil) this.chain = 0;
    this.previousDistance = this.distance;
    this.distance = this.routeDistance(this.time);
    this.activeObstacles = this.obstacles.filter(o=>!o.destroyed&&o.y-this.distance-o.d/2<27&&o.y-this.distance+o.d/2> -16);
    if(this.mission.campaign)for(const t of this.targets){
      if(Math.abs(t.anchorY-this.distance)>24)continue;
      this.activeObstacles.push({source:t.id,x:t.mountX??t.x,y:t.anchorY,w:t.radius*1.25,d:t.radius*1.25,bottom:t.mountY??-.55,top:t.destroyed?-.35:.6,hp:Infinity});
    }
    this.bombFlash = Math.max(0, this.bombFlash - dt * 2.5);
    const player = this.player;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    const inputLength = Math.max(1, Math.hypot(input.x, input.y));
    const oldPlayerX = player.x, oldPlayerY = player.y;
    const moveSpeed = (this.mission.pace?.moveSpeed ?? (this.mission.route ? 8.5 : 10)) * (input.focus ? .55 : 1);
    player.x = clamp(player.x + input.x / inputLength * moveSpeed * dt + (input.dragX || 0), FIELD.minX, FIELD.maxX);
    player.y = clamp(player.y + input.y / inputLength * moveSpeed * dt + (input.dragY || 0), FIELD.minY, FIELD.maxY);
    if(this.mission.campaign&&player.health>0){
      const hit=this.sceneryContact(oldPlayerX,oldPlayerY,player.x,player.y,.8,0,0,null,.2);
      if(hit.obstacle){
        this.damagePlayer();const t=Math.max(0,hit.time-.005);player.x=oldPlayerX+(player.x-oldPlayerX)*t;player.y=clamp(oldPlayerY+(player.y-oldPlayerY)*t-(this.distance-this.previousDistance)*(1-t),FIELD.minY,FIELD.maxY);
        const box=hit.obstacle;
        if(Number.isFinite(sweepBox(player.x,player.y+this.distance,player.x,player.y+this.distance,box,.8,0,0,.2))){
          const candidates=[{x:box.x-box.w/2-.82,y:player.y},{x:box.x+box.w/2+.82,y:player.y},{x:player.x,y:box.y-box.d/2-.82-this.distance},{x:player.x,y:box.y+box.d/2+.82-this.distance}];
          candidates.sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
          const safe=candidates.find(p=>p.x>=FIELD.minX&&p.x<=FIELD.maxX&&p.y>=FIELD.minY&&p.y<=FIELD.maxY&&!this.activeObstacles.some(o=>!o.destroyed&&Number.isFinite(sweepBox(p.x,p.y+this.distance,p.x,p.y+this.distance,o,.8,0,0,.2))));
          if(safe){player.x=safe.x;player.y=safe.y;}
        }
      }
    }
    player.vx = (player.x-oldPlayerX) / Math.max(.001,dt);
    const sectorIndex = this.mission.sectors.findLastIndex(s => this.time >= s.at);
    if (sectorIndex !== this.sector) { this.sector = sectorIndex; this.emit('sector', this.mission.sectors[sectorIndex]); }
    for (const target of this.targets) {
      target.y = target.anchorY - this.distance;
      target.flash = Math.max(0, target.flash - dt);
      if (this.mission.campaign && !target.entered && this.targetVisible(target)) {
        target.entered = true; target.nextAt = this.time + 1.3;
      }
      if (target.kind === 'battery') { if (!target.destroyed) this.updateBattery(target, dt); continue; }
      if (target.kind === 'launcher') { if (!target.destroyed) this.updateLauncher(target); continue; }
      if (target.kind === 'coolant') continue;
      if (target.destroyed || this.time < target.nextAt) continue;
      // A destroyed bay never reaches this branch, even in the final encounter.
      if (target.kind === 'bay') {
        target.nextAt += target.interval;
        if (target.y > -10 && target.y < (this.mission.campaign ? 17 : 18)) {
          target.launches++;
          target.lastLaunchAt=this.time;
          for (let i = 0; i < target.squad; i++) {const enemy=this.spawnEnemy(target.x + (i - 0.5) * 1.2, target.y - i * 0.7);if(enemy)enemy.sourceBay=target.id;}
          this.emit('launch', { x: target.x, y: target.y });
        }
      } else if (this.targetVisible(target)) {
        if (target.kind === 'core' && this.mission.boss && this.bossState === 'transition') continue;
        target.nextAt = this.time + target.interval * (this.mission.route ? this.difficulty.fireInterval : 1);
        const disabledTurret = this.controllerDisabled(target);
        const supports = target.supportIds?.filter(id => !this.targetById(id)?.destroyed).length ?? 0;
        const count = target.kind === 'core' ? (disabledTurret ? 3 : 5) + (this.mission.boss ? this.bossPhase - 1 : 0) + supports : 3;
        const aim = target.kind === 'core' && this.mission.boss ? clamp((player.x-target.x) / Math.max(4,target.y-player.y),-.65,.65) : 0;
        for (let i = 0; i < count; i++) {
          const shot=this.hostileShot(target.x, target.y - 0.5, aim + (i - (count - 1) / 2) * (this.bossPhase === 2 ? .22 : .38), -1, target.attack === 'missiles' ? 4.5 : 6, target.attack === 'missiles' || this.mission.boss && target.kind === 'core' && this.bossPhase === 3 && i % 2 === 0);
          if(shot&&this.mission.campaign)Object.assign(shot,{source:target.id,height:.7,entry:.2});
        }
      }
    }
    while (this.waveIndex < (this.mission.waves?.length || 0) && this.time >= this.mission.waves[this.waveIndex].at) this.spawnWave(this.mission.waves[this.waveIndex++]);
    while (this.recoveryIndex < (this.mission.recovery?.length || 0) && this.time >= this.mission.recovery[this.recoveryIndex]) {
      this.recoveryIndex++; player.health = Math.min(this.maxHealth, player.health + 1); player.bombs = Math.min(3, player.bombs + 1);
      player.invulnerable = Math.max(player.invulnerable, 2);
      for (const shot of this.shots) if (!shot.friendly) shot.active = false;
      const delay = this.mission.pace?.supportDelay ?? 4;
      for (const target of this.targets) { target.nextAt = Math.max(target.nextAt, this.time + delay); target.burstLeft = 0; }
      for (const enemy of this.enemies) if (enemy.active) enemy.cooldown = Math.max(enemy.cooldown, delay);
      this.emit('recovery');
    }
    if (this.time >= this.nextPatrol && this.time < this.mission.patrol.stopAt) {
      this.nextPatrol += this.mission.patrol.interval;
      const x = (this.random() - 0.5) * 12;
      this.spawnEnemy(x, 17, this.time > 38 ? 'bomber' : 'scout');
      this.spawnEnemy(-x, 19, 'interceptor');
    }
    if (!this.mission.campaign && this.time >= this.reinforcementAt) {
      this.reinforcementAt += this.mission.boss?.reinforcementInterval ?? 7;
      for (const bay of this.targets) if (bay.kind === 'bay' && !bay.destroyed) this.spawnEnemy(bay.x, 17);
    }
    player.cooldown -= dt;
    if (player.cooldown <= 0 && player.health > 0) {
      if(this.mission.campaign)this.fireCampaignWeapon();
      else {
      const weapon = WEAPONS[this.weapon];
      player.cooldown += weapon.interval;
      for (const angle of weapon.spread) obtain(this.shots, { x: player.x, y: player.y + 0.6, vx: Math.sin(angle) * weapon.speed, vy: weapon.speed, friendly: true, damage: weapon.damage * (1 + (this.level - 1) * 0.2), missile: this.weapon === 'homing', homing: this.weapon === 'homing' });
      this.emit('fire');
      }
    }
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.age += dt; enemy.cooldown -= dt;
      if (enemy.age < enemy.entry) continue;
      if(this.mission.campaign){this.updateCampaignEnemy(enemy,dt);continue;}
      const speed = this.mission.pace ? (enemy.kind === 'bomber' ? 4.2 : enemy.kind === 'interceptor' && enemy.age > 1.5 ? 14 : 6.8) : enemy.kind === 'bomber' ? 2.5 : enemy.kind === 'interceptor' && enemy.age > 2 ? 7 : 3.6;
      const previousX = enemy.x;
      enemy.y -= speed * dt;
      if (enemy.path === 'cross') enemy.x += enemy.vx * dt;
      else if (this.mission.route && enemy.kind === 'interceptor' && enemy.age > (this.mission.pace ? 1.5 : 2)) {
        enemy.dashX ??= enemy.x; enemy.x = enemy.dashX;
      } else enemy.x = clamp(enemy.originX + Math.sin(enemy.age * 1.5 + enemy.phase) * 1.25, -8, 8);
      enemy.angle = -Math.atan2((enemy.x-previousX)/dt, -speed);
      if (enemy.cooldown <= 0 && enemy.y < 15 && enemy.y > player.y + 1) {
        this.hostileShot(enemy.x, enemy.y, player.x - enemy.x, player.y - enemy.y, enemy.kind === 'bomber' ? 5 : 6.5, enemy.kind === 'bomber');
        if (this.mission.route && enemy.kind === 'bomber') this.hostileShot(enemy.x + .8, enemy.y, player.x - enemy.x + 1.6, player.y - enemy.y, 5, true);
        enemy.cooldown = 2.6 * (this.mission.route ? this.difficulty.fireInterval : 1);
      }
      if (enemy.y < -13 || enemy.path === 'cross' && Math.abs(enemy.x)>14 && enemy.age>1) enemy.active = false;
      if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 0.9) { this.damagePlayer(); enemy.active = false; this.burst(enemy.x, enemy.y); }
    }
    const missileContacts=this.mission.campaign?this.shots.filter(s=>s.active&&!s.friendly&&s.missile):[];
    const enemyContacts=this.mission.campaign?this.enemies.filter(e=>e.active&&e.age>=e.entry):[];
    const targetContacts=this.mission.campaign?this.targets.filter(t=>this.targetVisible(t)):[];
    for (const shot of this.shots) {
      if (!shot.active) continue;
      shot.age += dt;
      if (shot.homing) {
        let target = null, nearest = Infinity;
        if(this.mission.campaign)target=[...this.enemies,...this.targets].find(t=>t.id===shot.targetId&&(t.active||this.targets.includes(t)&&this.targetVisible(t)&&!this.isTargetShielded(t))&&t.y>shot.y-1);
        if(!target){
        for (const enemy of this.enemies) if (enemy.active && enemy.y > shot.y) { const d = (enemy.x - shot.x) ** 2 + (enemy.y - shot.y) ** 2; if (d < nearest) { target = enemy; nearest = d; } }
        for (const part of this.targets) if (this.targetVisible(part) && part.y > shot.y) { const d = (part.x - shot.x) ** 2 + (part.y - shot.y) ** 2; if (d < nearest) { target = part; nearest = d; } }
        }
        if (target) { const d = Math.hypot(target.x - shot.x, target.y - shot.y) || 1; const speed=shot.speed||20;shot.vx += ((target.x - shot.x) / d * speed - shot.vx) * Math.min(1, dt * 6); shot.vy += ((target.y - shot.y) / d * speed - shot.vy) * Math.min(1, dt * 6); }
      }
      const oldX = shot.x, oldY = shot.y;
      shot.x += shot.vx * dt; shot.y += shot.vy * dt;
      if(this.mission.campaign){
        const height=age=>(shot.height||0)*Math.max(0,1-age/(shot.entry||1));
        const scenery=this.sceneryContact(oldX,oldY,shot.x,shot.y,.07,height(shot.age-dt),height(shot.age),shot.source);
        if(shot.friendly){
          const contacts=[];
          for(const enemy of enemyContacts)if(enemy.active&&!shot.hitIds?.has(`e${enemy.id}`)){const t=sweepCircle(oldX,oldY,shot.x,shot.y,enemy.x,enemy.y,.75);if(t!==Infinity)contacts.push({t,enemy,key:`e${enemy.id}`});}
          for(const target of targetContacts)if(!target.destroyed&&!shot.hitIds?.has(target.id)){const t=sweepCircle(oldX,oldY,shot.x,shot.y,target.x,target.y,target.radius);if(t!==Infinity)contacts.push({t,target,key:target.id});}
          for(const missile of missileContacts)if(missile.active){const t=sweepCircle(oldX,oldY,shot.x,shot.y,missile.x,missile.y,.55);if(t!==Infinity)contacts.push({t,missile});}
          if(scenery.obstacle)contacts.push({t:scenery.time,obstacle:scenery.obstacle});
          contacts.sort((a,b)=>a.t-b.t);
          for(const hit of contacts){
            if(!Number.isFinite(hit.t)||!shot.active)break;
            if(hit.obstacle){this.damageObstacle(hit.obstacle,shot.damage);shot.active=false;this.burst(oldX+(shot.x-oldX)*hit.t,oldY+(shot.y-oldY)*hit.t,3);}
            else if(hit.enemy){hit.enemy.hp-=shot.damage;if(hit.enemy.hp<=0)this.awardKill(hit.enemy);else this.burst(hit.enemy.x,hit.enemy.y,2);}
            else if(hit.target){this.damageTarget(hit.target,shot.damage);shot.active=false;}
            else if(hit.missile){hit.missile.active=false;this.score+=30;this.burst(hit.missile.x,hit.missile.y,6);}
            if(hit.key)(shot.hitIds??=new Set()).add(hit.key);
            if(shot.pierce>0&&!hit.obstacle&&!hit.target)shot.pierce--;else shot.active=false;
          }
        }else{
          const playerHit=shot.age>=shot.entry?sweepCircle(oldX,oldY,shot.x,shot.y,player.x,player.y,.4):Infinity;
          if(scenery.obstacle&&scenery.time<=playerHit){shot.active=false;this.damageObstacle(scenery.obstacle,shot.missile?2:1,false);this.burst(oldX+(shot.x-oldX)*scenery.time,oldY+(shot.y-oldY)*scenery.time,3);}
          else if(Number.isFinite(playerHit)){this.damagePlayer();shot.active=false;}
        }
      }else if (shot.friendly) {
        for (const enemy of this.enemies) if (enemy.active && enemy.age >= enemy.entry && segmentHits(oldX, oldY, shot.x, shot.y, enemy.x, enemy.y, 0.8)) {
          enemy.hp -= shot.damage; shot.active = false;
          if (enemy.hp <= 0) this.awardKill(enemy);
          else this.burst(enemy.x,enemy.y,3);
          break;
        }
        if (shot.active) for (const target of this.targets) if (this.targetVisible(target) && segmentHits(oldX, oldY, shot.x, shot.y, target.x, target.y, target.radius)) { this.damageTarget(target, shot.damage); shot.active = false; break; }
        if (shot.active) for (const missile of this.shots) if (missile.active && !missile.friendly && missile.missile && segmentHits(oldX, oldY, shot.x, shot.y, missile.x, missile.y, 0.6)) { missile.active = false; shot.active = false; this.score += 30; this.burst(missile.x, missile.y, 8); break; }
      } else if (shot.age >= shot.entry && segmentHits(oldX, oldY, shot.x, shot.y, player.x, player.y, 0.4)) { this.damagePlayer(); shot.active = false; }
      if (Math.abs(shot.x) > 15 || shot.y > 25 || shot.y < -15 || shot.age > 6) shot.active = false;
    }
    for (const particle of this.particles) if (particle.active) { particle.age += dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; if (particle.age >= particle.life) particle.active = false; }
    for (const pickup of this.pickups) if (pickup.active) {
      pickup.age += dt; pickup.y -= dt * (this.mission.campaign?4.2:1.2);
      const distance=Math.hypot(pickup.x-player.x,pickup.y-player.y);
      const changesWeapon=!!WEAPONS[pickup.pickupType]&&pickup.pickupType!==this.weapon;
      if(this.mission.campaign&&!changesWeapon&&player.health>0&&distance<3.2){pickup.x+=(player.x-pickup.x)*Math.min(1,dt*7);pickup.y+=(player.y-pickup.y)*Math.min(1,dt*7);}
      if (player.health > 0 && Math.hypot(pickup.x - player.x, pickup.y - player.y) < 1.3) this.collectPickup(pickup);
      if (pickup.age > pickup.life || pickup.y < -12) pickup.active = false;
    }
    for (const hazard of this.mission.hazards) if (this.hazardState(hazard) === 'active' && Math.abs(player.x - hazard.x) < hazard.width / 2 && (hazard.zone === 'full' || player.y < -2)) this.damagePlayer();
    if (!this.mission.campaign && this.time >= this.mission.duration && this.status === 'playing') { this.status = 'lost'; this.emit('lost', { reason: 'The jump drive charged. Focus your fire on the core in the final sector.' }); }
  }
}
