import './style.css';
import { FIRST_MISSION, WEAPONS, DIFFICULTIES } from './content.js';
import { Simulation } from './simulation.js';
import { GameRenderer } from './renderer.js';
import { Input } from './input.js';
import { Audio } from './audio.js';

const $ = selector => document.querySelector(selector);
const saveKey = 'raiden-hullbreaker-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(saveKey) || '{}') || {}; } catch { /* Private or invalid storage falls back to defaults. */ }
const settings = { quality: ['auto', 'high', 'low'].includes(saved.quality) ? saved.quality : 'auto', reducedMotion: saved.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches, muted: saved.muted !== false, best: Number.isFinite(saved.best) ? saved.best : 0 };
const persist = () => { try { localStorage.setItem(saveKey, JSON.stringify(settings)); } catch { /* Optional persistence. */ } };
settings.difficulty = DIFFICULTIES[saved.difficulty] ? saved.difficulty : 'pilot';
settings.missionBest = saved.missionBest && typeof saved.missionBest === 'object' ? saved.missionBest : {};
settings.unlocked = Math.max(0, Math.min(5, Number(saved.unlocked) || 0));
let practice = false, sortieStart = 0;
const bestKey = () => `${FIRST_MISSION.id}:${settings.difficulty}`;
let sim = new Simulation(FIRST_MISSION), mode = 'menu', selectedWeapon = 'vulcan', renderer;
try { renderer = new GameRenderer($('#scene'), FIRST_MISSION, settings); } catch (error) { $('#error').hidden = false; console.error(error); }

if (renderer) {
  const audio = new Audio(settings.muted);
  let accumulator = 0, lastTime = performance.now(), noticeUntil = 0, uiAt = 0, frameCount = 0, frameStart = performance.now(), fps = 0, slowWindows = 0;
  const input = new Input(renderer.renderer.domElement, renderer, () => mode === 'playing', togglePause, bomb);
  function notice(message) { $('#announcement').textContent = message; $('#announcement').classList.add('visible'); noticeUntil = performance.now() + 3600; }
  function updateHud() {
    $('#health').textContent = '▰ '.repeat(Math.max(0, sim.player.health)) + '▱ '.repeat(Math.max(0, sim.maxHealth - sim.player.health));
    $('#health').setAttribute('aria-label', `${sim.player.health} health`);
    $('#score').textContent = String(sim.score).padStart(6, '0');
    $('#chain').textContent = sim.chain ? `${sim.chain} CHAIN · ×${Math.min(4,1+Math.floor(sim.chain/5))}` : 'CHAIN KILLS FOR BONUS';
    const remaining = Math.max(0, Math.ceil(FIRST_MISSION.duration - sim.time));
    $('#timer').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    $('#progress').style.width = `${Math.min(100, sim.time / FIRST_MISSION.duration * 100)}%`;
    $('#weapon-label').textContent = `${WEAPONS[sim.weapon].name} / LV ${sim.level}`;
    $('#bomb-count').textContent = sim.player.bombs; $('#bomb').disabled = sim.player.bombs <= 0;
    for (const id of ['bay-a', 'bay-b']) {
      const target = sim.targets.find(t => t.id === id), element = $(`#${id}`);
      element.textContent = `${id === 'bay-a' ? 'A' : 'B'} / ${target.destroyed ? 'DISABLED' : 'ACTIVE'}`; element.classList.toggle('destroyed', target.destroyed);
    }
    $('#sector').textContent = FIRST_MISSION.sectors[Math.max(0, sim.sector)].name;
    const guns = sim.targets.filter(t => t.kind === 'battery' && t.destroyed).length;
    const core = sim.targets.find(t => t.kind === 'core');
    $('#objective').textContent = sim.time >= FIRST_MISSION.boss.at ? `CORE ${sim.bossPhase}/3 · ${sim.bossState.toUpperCase()} · ${Math.ceil(core.hp)} HP` : sim.sector < 2 ? 'BREAK THE SCREEN · DESTROY LAUNCH BAYS' : `BATTERIES ${guns}/4 · ${sim.targets.find(t => t.kind === 'coolant').destroyed ? 'COOLANT OFFLINE' : 'SHOOT AMBER CONTROL LINKS'}`;
    $('#objective').dataset.state = sim.bossState;
  }
  function start(retry = false) {
    if (!retry) sortieStart = Number($('#checkpoint').value);
    practice = sortieStart > 0;
    audio.unlock(); sim = new Simulation(FIRST_MISSION, selectedWeapon, settings.difficulty);
    sim.time = sortieStart; sim.distance = sim.routeDistance(sortieStart);
    sim.waveIndex = FIRST_MISSION.waves.filter(w => w.at < sortieStart).length;
    sim.recoveryIndex = FIRST_MISSION.recovery.filter(at => at < sortieStart).length;
    sim.targets.forEach(t => { t.y = t.anchorY-sim.distance; t.nextAt = Math.max(t.nextAt,sortieStart+2); });
    mode = 'playing'; input.clear(); accumulator = 0;
    $('#menu').hidden = true; $('#dialog').hidden = true; $('#hud').hidden = false; $('#pause').hidden = false;
    document.body.classList.add('playing'); $('#pause').textContent = 'Ⅱ'; $('#pause').setAttribute('aria-label', 'Pause game');
    $('#flight-hint').textContent = matchMedia('(pointer: coarse)').matches ? 'DRAG TO MOVE · AUTO-FIRE ON' : 'WASD / ARROWS · SPACE PRECISION · SHIFT PULSE';
    updateHud(); $('#launch').blur();
  }
  function bomb() { if (mode === 'playing') { audio.unlock(); sim.bomb(); processEvents(); updateHud(); } }
  function openDialog(title, copy, paused) {
    input.clear(); $('#dialog').hidden = false; $('#dialog-title').textContent = title; $('#dialog-copy').textContent = copy;
    $('#dialog-eyebrow').textContent = paused ? 'FLIGHT SUSPENDED' : sim.status === 'won' ? 'MISSION COMPLETE' : 'MISSION ENDED';
    $('#resume').hidden = !paused; $('#result-stats').hidden = paused;
    if (!paused) {
      const bays = sim.targets.filter(t => t.kind === 'bay' && t.destroyed).length;
      const guns = sim.targets.filter(t => t.kind === 'battery' && t.destroyed).length;
      $('#result-stats').innerHTML = `<div>${practice ? 'PRACTICE' : 'SCORE'}<strong>${sim.score.toLocaleString()}</strong></div><div>BAYS / GUNS<strong>${bays}/2 · ${guns}/4</strong></div><div>BEST (${settings.difficulty})<strong>${Number(settings.missionBest[bestKey()] || 0).toLocaleString()}</strong></div>`;
    }
    (paused ? $('#resume') : $('#retry')).focus();
  }
  function pause(reason) {
    if (mode !== 'playing') return;
    mode = 'paused'; accumulator = 0; $('#pause').textContent = '▶'; $('#pause').setAttribute('aria-label', 'Resume game');
    openDialog('HOLD POSITION.', reason || 'Take a breath. Your sortie will resume from this exact moment.', true);
  }
  function resume() { if (mode !== 'paused') return; mode = 'playing'; audio.unlock(); $('#dialog').hidden = true; $('#pause').textContent = 'Ⅱ'; $('#pause').setAttribute('aria-label', 'Pause game'); input.clear(); accumulator = 0; lastTime = performance.now(); $('#resume').blur(); }
  function togglePause() { if (mode === 'playing') pause(); else if (mode === 'paused') resume(); }
  function processEvents() {
    for (const event of sim.events) {
      audio.play(event.type);
      if (event.type === 'sector') {
        notice(event.message);
        if (!practice && sim.sector > settings.unlocked) { settings.unlocked = sim.sector; persist(); updateCheckpoints(); }
      }
      if (event.type === 'recovery') notice('SUPPORT WINDOW · +1 HULL · +1 PULSE');
      if (event.type === 'boss-phase') notice(`CORE PHASE ${event.phase}/3 · SHIELD REBUILDING`);
      if (event.type === 'target-destroyed') notice(event.kind === 'bay' ? `${event.label} DISABLED · REINFORCEMENTS REDUCED` : `${event.label} DESTROYED`);
      if (event.type === 'pickup') notice('HULL REPAIRED · WEAPON UPGRADED');
      if (event.type === 'hit') notice(sim.player.health === 1 ? 'HULL CRITICAL · USE YOUR PULSE' : 'HULL HIT · SHIELDS RECOVERING');
      if (event.type === 'won' || event.type === 'lost') {
        mode = 'ended'; if (!practice) settings.missionBest[bestKey()] = Math.max(Number(settings.missionBest[bestKey()]) || 0, sim.score); persist(); $('#pause').hidden = true;
        openDialog(event.type === 'won' ? 'JUMP DRIVE BROKEN.' : 'SORTIE ENDED.', event.type === 'won' ? 'Nesis is going nowhere. The fleet has a fighting chance.' : event.reason, false);
      }
    }
    sim.events.length = 0;
  }
  function updateCheckpoints() {
    const value = $('#checkpoint').value;
    $('#checkpoint').innerHTML = '<option value="0">FULL SORTIE</option>' + FIRST_MISSION.sectors.slice(1,settings.unlocked+1).map(s => `<option value="${s.at}">PRACTICE · ${s.name.slice(5)}</option>`).join('');
    if ([...$('#checkpoint').options].some(o => o.value === value)) $('#checkpoint').value = value;
  }
  updateCheckpoints();
  $('#difficulty').value = settings.difficulty;
  $('#difficulty').addEventListener('change',event => { settings.difficulty = event.target.value; persist(); });
  $('#launch').addEventListener('click', () => start()); $('#retry').addEventListener('click', () => start(true));
  $('#pause').addEventListener('click', togglePause); $('#resume').addEventListener('click', resume);
  $('#bomb').addEventListener('pointerdown', event => { event.preventDefault(); bomb(); });
  $('#bomb').addEventListener('click', event => { if (event.detail === 0) bomb(); });
  $('#return-menu').addEventListener('click', () => {
    mode = 'menu'; input.clear(); sim = new Simulation(FIRST_MISSION, selectedWeapon); accumulator = 0;
    $('#menu').hidden = false; $('#dialog').hidden = true; $('#hud').hidden = true; $('#pause').hidden = true; document.body.classList.remove('playing'); $('#launch').focus();
  });
  document.querySelectorAll('[data-weapon]').forEach(button => button.addEventListener('click', () => {
    selectedWeapon = button.dataset.weapon;
    document.querySelectorAll('[data-weapon]').forEach(item => { const selected = item === button; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); });
  }));
  function soundLabel() { $('#sound').textContent = settings.muted ? 'SOUND OFF' : 'SOUND ON'; $('#sound').setAttribute('aria-label', settings.muted ? 'Enable sound' : 'Mute sound'); }
  $('#sound').addEventListener('click', () => { audio.unlock(); settings.muted = !settings.muted; audio.setMuted(settings.muted); soundLabel(); persist(); }); soundLabel();
  $('#quality').value = settings.quality;
  $('#quality').addEventListener('change', event => { settings.quality = event.target.value; renderer.setQuality(settings.quality); slowWindows = 0; persist(); });
  $('#motion').checked = settings.reducedMotion;
  $('#motion').addEventListener('change', event => { settings.reducedMotion = event.target.checked; persist(); });
  // Keep focus inside the pause/result dialog while it is open.
  $('#dialog').addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...$('#dialog').querySelectorAll('button')].filter(button => !button.hidden);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.addEventListener('blur', () => { input.clear(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('resize', () => { input.clear(); renderer.resize(); });
  renderer.renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); pause(); $('#error-copy').textContent = 'The graphics connection was interrupted. Reload to restart the sortie; your saved best score is retained.'; $('#error').hidden = false; });
  function loop(now) {
    requestAnimationFrame(loop);
    const elapsed = (now - lastTime) / 1000; lastTime = now;
    // Do not turn an occluded/throttled browser into silent slow-motion play.
    if (mode === 'playing' && elapsed > .5) pause('The browser stopped drawing frames. Resume when this window is active; your sortie has been held in place.');
    const delta = Math.min(elapsed, .5);
    if (mode === 'playing') {
      accumulator += delta;
      let steps = 0;
      while (accumulator >= 1 / 60 && steps < 30 && mode === 'playing') { sim.update(1 / 60, input.read()); processEvents(); accumulator -= 1 / 60; steps++; }
      if (steps === 30) accumulator %= 1 / 60;
    }
    renderer.render(sim, now / 1000, mode === 'menu');
    if (now > uiAt) { if (mode !== 'menu') updateHud(); uiAt = now + 100; if (now > noticeUntil) $('#announcement').classList.remove('visible'); }
    frameCount++;
    if (now - frameStart >= 1000) {
      fps = Math.round(frameCount * 1000 / (now - frameStart)); frameCount = 0; frameStart = now;
      $('#performance').textContent = mode === 'menu' ? 'SYSTEM ONLINE' : `${fps} FPS`;
      if (mode === 'playing' && settings.quality === 'auto') {
        slowWindows = fps < 38 ? slowWindows + 1 : Math.max(0, slowWindows - 1);
        if (slowWindows >= 3 && renderer.quality !== 'low') renderer.setQuality('low');
      }
    }
  }
  requestAnimationFrame(loop);
  // Development-only diagnostics for reproducible browser checks; absent in build.
  if (import.meta.env.DEV) window.__hullbreaker = {
    get sim() { return sim; }, get mode() { return mode; }, get fps() { return fps; },
    get asset() { return renderer.environment.group.userData.asset; },
    get combatAsset() { return renderer.combatAsset; },
    get renderer() { return renderer; },
    get stats() { return { calls: renderer.renderer.info.render.calls, triangles: renderer.renderer.info.render.triangles, geometries: renderer.renderer.info.memory.geometries }; },
    advance(seconds, state = { x: 0, y: 0 }) { for (let i = 0; i < seconds * 60 && mode === 'playing'; i++) { sim.update(1 / 60, state); processEvents(); } lastTime = performance.now(); accumulator = 0; updateHud(); },
  };
}
