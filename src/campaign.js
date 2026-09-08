import { CAMPAIGN, compileCampaign, seededRandom } from './content.js';
import { Simulation, clamp } from './simulation.js';
import { RETURN_TURN_SECONDS } from './flight-path.js';
import { upgradeWeapon } from './weapon-progression.js';
import { sweepBox } from './collision.js';

// The run owns supplies and score. A simulation owns one level and its persistent
// targets; entering a segment only resets transient combat and the local clock.
export class CampaignRun {
  constructor({ seed = 417, weapon = 'vulcan', difficulty = 'pilot', practiceLevel = null, practiceSegment = 0 } = {}) {
    this.seed = seed >>> 0; this.weapon = weapon; this.difficulty = difficulty;
    this.levels = compileCampaign(this.seed); this.levelIndex = practiceLevel ?? 0;
    this.practice = practiceLevel !== null; this.practiceSegment = practiceSegment;
    this.score = 0; this.lives = 3; this.weaponLevel = 1; this.bombs = 2;
    this.extraLivesAwarded = []; this.elapsed = 0; this.status = 'playing';
    this.sim = new CampaignSimulation(this.levels[this.levelIndex], this, practiceSegment);
  }
  capture(sim = this.sim) {
    this.score = sim.score; this.lives = sim.lives; this.bombs = sim.player.bombs;
    this.weaponLevel = sim.level; this.extraLivesAwarded = [...sim.extraLivesAwarded];
  }
  nextLevel() {
    if (this.sim.status !== 'won' || this.practice || this.levelIndex >= this.levels.length - 1) return false;
    this.capture(); this.elapsed += this.sim.levelTime; this.levelIndex++;
    this.sim = new CampaignSimulation(this.levels[this.levelIndex], this); return true;
  }
}

export class CampaignSimulation extends Simulation {
  constructor(definition, run, startSegment = 0) {
    super(definition.segments[startSegment], run.weapon, run.difficulty);
    this.definition = definition; this.run = run; this.segmentIndex = startSegment;
    this.targetStates = new Map(); this.obstacleStates = new Map(); this.maxHealth = 1; this.player.health = 1;
    this.score = run.score; this.lives = run.lives; this.level = run.weaponLevel; this.player.bombs = run.bombs;
    this.extraLivesAwarded = [...run.extraLivesAwarded];
    this.levelTime = 0; this.pass = 1; this.turnRemaining = 0; this.respawnRemaining = 0;
    this.deaths = 0; this.maxChain = 0;
    this.revision = 0; this.enterSegment(startSegment);
  }
  get campaignTime() { return this.run.elapsed + this.levelTime; }
  get nextMission() { return this.definition.segments[this.segmentIndex + 1]; }
  get controlsEnabled() { return this.status === 'playing' && this.turnRemaining <= 0 && this.respawnRemaining <= 0; }
  get progress() {
    const completed = this.definition.segments.slice(0, this.segmentIndex).reduce((n, s) => n + s.duration, 0);
    return this.status === 'won' ? 1 : (completed + Math.min(this.time, this.mission.duration)) / this.definition.duration;
  }
  targetById(id) { return this.targetStates?.get(id) ?? super.targetById(id); }
  clearTransient() {
    for (const items of [this.enemies, this.shots, this.pickups, this.particles]) for (const item of items) item.active = false;
    this.bombFlash = 0;
    this.formations.clear();
  }
  enterSegment(index, repeat = false) {
    this.segmentIndex = index; this.mission = this.definition.segments[index];
    this.time = 0; this.distance = this.routeDistance(0); this.waveIndex = 0; this.recoveryIndex = 0;
    this.sector = -1; this.nextPatrol = Infinity; this.reinforcementAt = Infinity;
    this.phaseStarted = 0; this.transitionUntil = 0;
    if (!repeat) { this.bossPhase = 1; this.pass = 1; }
    // Escalation is bounded; telegraph and aim-lock durations never shrink.
    const base = this.run.difficulty === 'rookie' ? { bulletSpeed: .8, fireInterval: 1.25 } : { bulletSpeed: 1, fireInterval: 1 };
    const pressure = Math.min(3, this.pass - 1);
    this.difficulty = { ...this.difficulty, bulletSpeed: base.bulletSpeed * (1 + pressure * .04), fireInterval: base.fireInterval * (1 - pressure * .08) };
    this.random = seededRandom(this.mission.combatSeed);
    this.fxRandom = seededRandom(this.mission.environment.seed);
    this.targets = this.mission.targets.map(definition => {
      let state = this.targetStates.get(definition.id);
      if (!state) { state = { ...definition, anchorY: definition.y, maxHp: definition.hp, destroyed: false, launches: 0 }; this.targetStates.set(state.id, state); }
      Object.assign(state, { y: state.anchorY - this.distance, nextAt: definition.startAt, lastLaunchAt:-Infinity, burstLeft: 0, burstAt: 0, aimX: undefined, aimY: undefined, aimAngle: 0, flash: 0, entered: false });
      return state;
    });
    this.obstacles=(this.mission.obstacles||[]).map(o=>{
      if(!this.obstacleStates.has(o.id))this.obstacleStates.set(o.id,{...o,maxHp:o.hp,destroyed:false});
      return this.obstacleStates.get(o.id);
    });
    this.previousDistance=this.distance;this.activeObstacles=[];
    this.clearTransient(); this.chain = 0; this.chainUntil = 0;
    this.player.cooldown = .2; this.player.vx = 0;
    this.player.invulnerable = Math.max(this.player.invulnerable, 1.5);
    this.revision++;
    this.emit('segment-enter', { index, name: this.mission.name, repeat, assault: !!this.mission.assault });
  }
  damageTarget(target, damage) {
    if (this.status !== 'playing' || this.turnRemaining > 0) return;
    super.damageTarget(target, damage);
    if (this.mission.completion?.every(id => this.targetById(id)?.destroyed)) this.completeLevel();
  }
  completeLevel() {
    if (this.status !== 'playing') return;
    this.status = 'won'; this.chain = 0;
    this.clearBonus = 5000 + this.lives * 500 + (this.deaths === 0 ? 3000 : 0) + (this.pass === 1 ? 1500 : 0);
    this.rank = this.deaths === 0 && this.pass === 1 ? 'S' : this.deaths <= 1 && this.pass <= 2 ? 'A' : this.deaths <= 2 ? 'B' : 'C';
    this.score += this.clearBonus;
    this.clearRewards={base:5000,lives:this.lives*500,clean:this.deaths===0?3000:0,firstPass:this.pass===1?1500:0,power:upgradeWeapon(this,'clear'),pulse:this.player.bombs<3};
    this.player.bombs = Math.min(3, this.player.bombs + 1);
    this.awardExtraLives(); this.clearTransient(); this.run.capture(this);
    this.emit('level-clear', { levelIndex: this.definition.index, final: this.definition.index === CAMPAIGN.levels.length - 1 });
  }
  awardExtraLives() {
    if (this.status === 'lost') return;
    for (const threshold of CAMPAIGN.extraLives) if (this.score >= threshold && !this.extraLivesAwarded.includes(threshold)) {
      this.extraLivesAwarded.push(threshold); this.lives++; this.emit('extra-life', { threshold });
    }
  }
  damagePlayer() {
    if (!this.controlsEnabled || this.player.invulnerable > 0 || this.player.health <= 0) return;
    this.lives--; this.deaths++; this.player.health = 0; this.player.invulnerable = 0;
    this.chain = 0; this.level = Math.max(1, this.level - 1); this.player.bombs = Math.max(2, this.player.bombs);
    for (const shot of this.shots) if (!shot.friendly) shot.active = false;
    this.burst(this.player.x, this.player.y, 45); this.emit('life-lost', { lives: this.lives });
    if (this.lives <= 0) {
      this.status = 'lost'; this.run.capture(this); this.emit('game-over', { reason: 'All three fighters are lost. Launch a new campaign or practice a reached route.' });
    } else this.respawnRemaining = 1;
  }
  beginTurn() {
    this.turnDuration = RETURN_TURN_SECONDS;
    this.turnRemaining = this.turnDuration; this.turnOrigin = { x: this.player.x, y: this.player.y };
    this.turnDistance = this.distance; this.clearTransient(); this.chain = 0;
    this.emit('turnaround', { nextPass: this.pass + 1 });
  }
  update(dt, input = { x: 0, y: 0 }) {
    if (this.status !== 'playing') return;
    this.levelTime += dt;
    if (this.respawnRemaining > 0) {
      this.respawnRemaining = Math.max(0, this.respawnRemaining - dt);
      if (this.respawnRemaining <= 0) {
        this.player.health = 1; this.player.x = clamp(this.player.x, -6, 6); this.player.y = -6;
        for(const x of [this.player.x,0,-3,3,-6,6])if(!this.obstacles.some(o=>!o.destroyed&&Number.isFinite(sweepBox(x,-6+this.distance,x,-6+this.distance,o,.8,0,0,.2)))){this.player.x=x;break;}
        this.player.invulnerable = 2.5; this.player.cooldown = .15; this.emit('respawn');
      }
    }
    if (this.turnRemaining > 0) {
      this.turnRemaining = Math.max(0, this.turnRemaining - dt);
      if (this.turnRemaining <= 1e-7) {
        this.turnRemaining = 0;
        this.pass++; this.enterSegment(this.segmentIndex, true);
        this.player.x = this.turnOrigin.x; this.player.y = this.turnOrigin.y;
      }
      return;
    }
    const activeInput = this.controlsEnabled ? input : { x: 0, y: 0 };
    super.update(Math.min(dt, Math.max(0, this.mission.duration - this.time)), activeInput);
    this.maxChain = Math.max(this.maxChain, this.chain);
    this.awardExtraLives();
    if (this.status === 'playing' && this.time >= this.mission.duration - 1e-7) {
      if (this.mission.assault) this.beginTurn();
      else this.enterSegment(this.segmentIndex + 1);
    }
  }
}
