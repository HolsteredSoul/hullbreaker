import { WEAPONS, DIFFICULTIES, seededRandom } from './content.js';

export const FIELD = Object.freeze({ minX: -8, maxX: 8, minY: -9, maxY: 12 });
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const pool = (count) => Array.from({ length: count }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0 }));
function obtain(items, values) {
  const item = items.find(entry => !entry.active);
  if (item) Object.assign(item, { active: true, age: 0, vx: 0, vy: 0, entry: 0, height: 0, source: null }, values);
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
    this.random = seededRandom(mission.environment.seed);
    this.player = { x: 0, y: -6, health: this.maxHealth, bombs: 2, invulnerable: 1.5, cooldown: 0 };
    this.targets = mission.targets.map(target => ({ ...target, anchorY: target.y, maxHp: target.hp, destroyed: false, nextAt: target.startAt, launches: 0, flash: 0 }));
    this.enemies = pool(64); this.shots = pool(480); this.particles = pool(450); this.pickups = pool(12);
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
    const exposed = this.targets.some(t => t.kind === 'coolant' && t.destroyed) ? boss.weakenedExposure : boss.exposed;
    return (this.time - this.phaseStarted) % boss.shieldPeriod < boss.shieldPeriod - exposed ? 'shielded' : 'exposed';
  }
  hazardState(hazard) {
    if (this.time < (hazard.from || 0) || this.time >= hazard.until) return 'off';
    return (this.time - (hazard.from || 0)) % hazard.period > (hazard.activeAfter ?? 3.2) ? 'active' : 'warning';
  }
  spawnWave(wave) {
    if (wave.sourceBay && this.targets.find(t => t.id === wave.sourceBay)?.destroyed) return;
    const side = wave.side || 1;
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
      target.burstLeft = this.targets.some(t => t.kind === 'turret' && t.destroyed) ? 1 : 3;
      target.burstAt = this.time;
    }
    if (target.burstLeft && this.time >= target.burstAt) {
      const dx = target.aimX - target.mountX, dy = target.aimY - target.y, length = Math.hypot(dx,dy) || 1;
      const shot = this.hostileShot(target.mountX + dx / length * 2.4, target.y + dy / length * 2.4, dx, dy, 6);
      if (shot) Object.assign(shot, { source: target.id, height: 1.2, entry: .35 });
      target.burstLeft--; target.burstAt += .18;
      if (!target.burstLeft) target.nextAt = this.time + target.interval * this.difficulty.fireInterval * (this.targets.some(t => t.kind === 'turret' && t.destroyed) ? 1.5 : 1);
    }
  }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  burst(x, y, count = 20, color = 'orange') {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2, speed = 1 + this.random() * 6;
      obtain(this.particles, { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.25 + this.random() * 0.6, color });
    }
  }
  spawnEnemy(x, y, kind = 'scout') {
    if (this.mission.route && this.enemies.filter(e => e.active).length >= 18) return null;
    const enemy = obtain(this.enemies, { x: clamp(x, -7.5, 7.5), y, originX: x, kind, hp: kind === 'bomber' ? 4 : 2, cooldown: 1.2 + this.random(), phase: this.random() * 6.28, dash: false });
    if (enemy) { enemy.entry = this.mission.route && y < 16 ? .7 : 0; enemy.dashX = null; enemy.path = 'forward'; enemy.angle = Math.PI; if (this.mission.route && kind === 'bomber') enemy.hp = 6; }
    return enemy;
  }
  hostileShot(x, y, dx, dy, speed = 7, missile = false) {
    const length = Math.hypot(dx, dy) || 1;
    speed *= this.mission.route ? this.difficulty.bulletSpeed : 1;
    return obtain(this.shots, { x, y, vx: dx / length * speed, vy: dy / length * speed, friendly: false, damage: 1, missile, homing: false, height: 0, entry: 0, source: null });
  }
  damageTarget(target, damage) {
    if (target.destroyed) return;
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
    if (target.kind === 'bay') obtain(this.pickups, { x: target.x, y: target.y, life: 14 });
    if (target.kind === 'core') { this.status = 'won'; this.score += this.player.health * 1000; this.emit('won'); }
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
    if (this.status !== 'playing' || this.player.bombs <= 0) return false;
    this.player.bombs--; this.player.invulnerable = Math.max(1.2, this.player.invulnerable); this.bombFlash = 1;
    for (const shot of this.shots) if (!shot.friendly) shot.active = false;
    for (const enemy of this.enemies) if (enemy.active) { enemy.active = false; this.score += 100; this.kills++; this.burst(enemy.x, enemy.y, 12); }
    for (const target of this.targets) if (this.targetVisible(target)) this.damageTarget(target, 13);
    this.emit('bomb'); return true;
  }
  targetVisible(target) { return !target.destroyed && target.y < 17 && target.y > -11 && this.time >= (this.mission.route || target.kind === 'core' ? target.startAt : 0); }
  awardKill(enemy) {
    enemy.active = false; this.kills++;
    if (this.mission.pace) { this.chain++; this.chainUntil = this.time + this.mission.pace.chainWindow; }
    this.score += 120 * Math.min(4, 1 + Math.floor(this.chain / 5));
    this.burst(enemy.x, enemy.y, 24); this.emit('kill');
    if (this.mission.pace && this.kills % 10 === 0) obtain(this.pickups, { x: clamp(enemy.x,-7,7), y: enemy.y, life: 12 });
  }
  update(dt, input = { x: 0, y: 0 }) {
    if (this.status !== 'playing') return;
    this.time += dt;
    if (this.time > this.chainUntil) this.chain = 0;
    this.distance = this.routeDistance(this.time);
    this.bombFlash = Math.max(0, this.bombFlash - dt * 2.5);
    const player = this.player;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    const inputLength = Math.max(1, Math.hypot(input.x, input.y));
    const oldPlayerX = player.x;
    const moveSpeed = (this.mission.pace?.moveSpeed ?? (this.mission.route ? 8.5 : 10)) * (input.focus ? .55 : 1);
    player.x = clamp(player.x + input.x / inputLength * moveSpeed * dt + (input.dragX || 0), FIELD.minX, FIELD.maxX);
    player.y = clamp(player.y + input.y / inputLength * moveSpeed * dt + (input.dragY || 0), FIELD.minY, FIELD.maxY);
    player.vx = (player.x-oldPlayerX) / Math.max(.001,dt);
    const sectorIndex = this.mission.sectors.findLastIndex(s => this.time >= s.at);
    if (sectorIndex !== this.sector) { this.sector = sectorIndex; this.emit('sector', this.mission.sectors[sectorIndex]); }
    for (const target of this.targets) {
      target.y = target.anchorY - this.distance;
      target.flash = Math.max(0, target.flash - dt);
      if (target.kind === 'battery') { if (!target.destroyed) this.updateBattery(target, dt); continue; }
      if (target.kind === 'coolant') continue;
      if (target.destroyed || this.time < target.nextAt) continue;
      // A destroyed bay never reaches this branch, even in the final encounter.
      if (target.kind === 'bay') {
        target.nextAt += target.interval;
        if (target.y > -10 && target.y < 18) {
          target.launches++;
          for (let i = 0; i < target.squad; i++) this.spawnEnemy(target.x + (i - 0.5) * 1.2, target.y - i * 0.7);
          this.emit('launch', { x: target.x, y: target.y });
        }
      } else if (this.targetVisible(target)) {
        if (target.kind === 'core' && this.mission.boss && this.bossState === 'transition') continue;
        target.nextAt = this.time + target.interval * (this.mission.route ? this.difficulty.fireInterval : 1);
        const disabledTurret = this.targets.some(t => t.kind === 'turret' && t.destroyed);
        const count = target.kind === 'core' ? (disabledTurret ? 3 : 5) + (this.mission.boss ? this.bossPhase - 1 : 0) : 3;
        const aim = target.kind === 'core' && this.mission.boss ? clamp((player.x-target.x) / Math.max(4,target.y-player.y),-.65,.65) : 0;
        for (let i = 0; i < count; i++) this.hostileShot(target.x, target.y - 0.5, aim + (i - (count - 1) / 2) * (this.bossPhase === 2 ? .22 : .38), -1, 6, this.mission.boss && target.kind === 'core' && this.bossPhase === 3 && i % 2 === 0);
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
    if (this.time >= this.reinforcementAt) {
      this.reinforcementAt += this.mission.boss?.reinforcementInterval ?? 7;
      for (const bay of this.targets) if (bay.kind === 'bay' && !bay.destroyed) this.spawnEnemy(bay.x, 17);
    }
    player.cooldown -= dt;
    if (player.cooldown <= 0) {
      const weapon = WEAPONS[this.weapon];
      player.cooldown += weapon.interval;
      for (const angle of weapon.spread) obtain(this.shots, { x: player.x, y: player.y + 0.6, vx: Math.sin(angle) * weapon.speed, vy: weapon.speed, friendly: true, damage: weapon.damage * (1 + (this.level - 1) * 0.2), missile: this.weapon === 'homing', homing: this.weapon === 'homing' });
      this.emit('fire');
    }
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.age += dt; enemy.cooldown -= dt;
      if (enemy.age < enemy.entry) continue;
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
    for (const shot of this.shots) {
      if (!shot.active) continue;
      shot.age += dt;
      if (shot.homing) {
        let target = null, nearest = Infinity;
        for (const enemy of this.enemies) if (enemy.active && enemy.y > shot.y) { const d = (enemy.x - shot.x) ** 2 + (enemy.y - shot.y) ** 2; if (d < nearest) { target = enemy; nearest = d; } }
        for (const part of this.targets) if (this.targetVisible(part) && part.y > shot.y) { const d = (part.x - shot.x) ** 2 + (part.y - shot.y) ** 2; if (d < nearest) { target = part; nearest = d; } }
        if (target) { const d = Math.hypot(target.x - shot.x, target.y - shot.y) || 1; shot.vx += ((target.x - shot.x) / d * 20 - shot.vx) * Math.min(1, dt * 6); shot.vy += ((target.y - shot.y) / d * 20 - shot.vy) * Math.min(1, dt * 6); }
      }
      const oldX = shot.x, oldY = shot.y;
      shot.x += shot.vx * dt; shot.y += shot.vy * dt;
      if (shot.friendly) {
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
      pickup.age += dt; pickup.y -= dt * 1.2;
      if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 1.3) { pickup.active = false; player.health = Math.min(this.maxHealth, player.health + 1); this.level = Math.min(3, this.level + 1); this.score += 500; this.emit('pickup'); }
      if (pickup.age > pickup.life || pickup.y < -12) pickup.active = false;
    }
    for (const hazard of this.mission.hazards) if (this.hazardState(hazard) === 'active' && Math.abs(player.x - hazard.x) < hazard.width / 2 && (hazard.zone === 'full' || player.y < -2)) this.damagePlayer();
    if (this.time >= this.mission.duration && this.status === 'playing') { this.status = 'lost'; this.emit('lost', { reason: 'The jump drive charged. Focus your fire on the core in the final sector.' }); }
  }
}
