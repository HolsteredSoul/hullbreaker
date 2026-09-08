import './style.css';
import { CAMPAIGN, WEAPONS, DIFFICULTIES } from './content.js';
import { CampaignRun } from './campaign.js';
import { GameRenderer } from './renderer.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { weaponTier } from './weapon-progression.js';

const $ = selector => document.querySelector(selector);
const saveKey = 'raiden-hullbreaker-v1';
let saved = {};
try { const value = JSON.parse(localStorage.getItem(saveKey) || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) saved = value; } catch { /* Storage is optional. */ }
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const settings = { ...saved,
  quality: ['auto', 'high', 'low'].includes(saved.quality) ? saved.quality : 'auto',
  reducedMotion: typeof saved.reducedMotion === 'boolean' ? saved.reducedMotion : matchMedia('(prefers-reduced-motion: reduce)').matches,
  muted: saved.muted !== false, difficulty: DIFFICULTIES[saved.difficulty] ? saved.difficulty : 'pilot',
  campaignBest: record(saved.campaignBest), reached: record(saved.reached), ranks: record(saved.ranks),
};
const persist = () => { try { localStorage.setItem(saveKey, JSON.stringify(settings)); } catch { /* Play works without storage. */ } };
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
let selectedWeapon = 'vulcan', run = new CampaignRun({ practiceLevel: 0, practiceSegment: 3 }), sim = run.sim;
let mode = 'menu', renderer;
try { renderer = new GameRenderer($('#scene'), sim.mission, settings); } catch (error) { $('#error').hidden = false; console.error(error); }

if (renderer) {
  const audio = new Audio(settings.muted);
  let accumulator = 0, lastTime = performance.now(), noticeUntil = 0, uiAt = 0;
  let frameCount = 0, frameStart = performance.now(), fps = 0, slowWindows = 0;
  const input = new Input(renderer.renderer.domElement, renderer, () => mode === 'playing' && sim.controlsEnabled, togglePause, bomb);
  const scoreKey = () => `${CAMPAIGN.id}:${run.difficulty}`;
  const clock = time => `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
  function notice(message) { $('#announcement').textContent = message; $('#announcement').classList.add('visible'); noticeUntil = performance.now() + 3400; }
  function updateHud() {
    $('#health').textContent = '◆ '.repeat(Math.max(0, sim.lives)); $('#health').setAttribute('aria-label', `${sim.lives} lives remaining`);
    $('#score').textContent = String(sim.score).padStart(6, '0');
    $('#chain').textContent = sim.chain ? `${sim.chain} CHAIN · ×${Math.min(4, 1 + Math.floor(sim.chain / 5))}` : 'CLEAN CLEAR +3000 · FIRST PASS +1500';
    $('#timer').textContent = clock(sim.campaignTime); $('#progress').style.width = `${sim.progress * 100}%`;
    $('#weapon-label').textContent = `${WEAPONS[sim.weapon].name} ${'▰'.repeat(sim.level)}${'▱'.repeat(3-sim.level)}`;
    $('#power-detail').textContent=weaponTier(sim.weapon,sim.level).name;
    $('#bomb-count').textContent = sim.player.bombs; $('#bomb').disabled = !sim.controlsEnabled || sim.player.bombs <= 0;
    $('#sector').textContent = `${String(run.levelIndex + 1).padStart(2, '0')} / 05 · ${sim.definition.title.toUpperCase()}`;
    $('#bay-a').textContent = sim.mission.name;
    $('#bay-b').textContent = sim.mission.assault ? `ATTACK PASS ${sim.pass}${sim.pass > 1 ? ' · DEFENSES ALERT' : ''}` : `${sim.segmentIndex + 1} / ${sim.definition.segments.length} ROUTE`;
    const objectives = (sim.mission.completion || []).map(id => sim.targetById(id)), remaining = objectives.filter(t => !t?.destroyed);
    const core = sim.targets.find(t => t.kind === 'core');
    let objective = sim.definition.description;
    if (objectives.length) objective = `${objectives.length - remaining.length}/${objectives.length} OBJECTIVES · ${remaining.map(t => t.label).join(' / ') || 'ASSAULT COMPLETE'}`;
    if (core && sim.mission.boss) objective = `CORE ${sim.bossPhase}/3 · ${sim.bossState.toUpperCase()} · ${Math.ceil(core.hp)} HP`;
    if (core?.gates) objective = `FEEDERS ${core.gates.filter(id => sim.targetById(id)?.destroyed).length}/${core.gates.length} · HUB ${sim.isTargetShielded(core) ? 'SHIELDED' : 'EXPOSED'}`;
    if (sim.turnRemaining > 0) objective = `BREAKAWAY · RETURNING FOR PASS ${sim.pass + 1} · DAMAGE PRESERVED`;
    if (sim.respawnRemaining > 0) objective = 'REPLACEMENT FIGHTER INBOUND';
    $('#objective').textContent = objective;
    $('#objective').dataset.state = core && !sim.isTargetShielded(core) ? 'exposed' : 'active';
  }
  function updateMenu() {
    const value = $('#checkpoint').value;
    $('#checkpoint').replaceChildren(new Option('FULL CAMPAIGN · 3 LIVES', 'campaign'));
    for (const level of run.levels) {
      const reached = level.index === 0 ? Math.max(0, Number(settings.reached[level.id]) || 0) : Number(settings.reached[level.id]);
      if (!Number.isFinite(reached)) continue;
      for (let i = 0; i <= Math.min(reached, level.segments.length - 1); i++) $('#checkpoint').add(new Option(`PRACTICE ${level.index + 1}.${i + 1} · ${level.segments[i].name}`, `${level.index}:${i}`));
    }
    if ([...$('#checkpoint').options].some(option => option.value === value)) $('#checkpoint').value = value;
    $('#campaign-map').innerHTML = CAMPAIGN.levels.map((level, i) => {
      const reached = i === 0 || Number.isFinite(Number(settings.reached[level.id])), rank = settings.ranks[`${level.id}:${settings.difficulty}`];
      return `<button class="route-card ${reached ? 'unlocked' : ''}" data-level="${i}" ${reached ? '' : 'disabled'}><span>0${i + 1}</span><strong>${level.title}</strong><small>${rank ? `RANK ${rank}` : reached ? 'PRACTICE AVAILABLE' : 'CLEAR PREVIOUS LEVEL'}</small></button>`;
    }).join('');
    $('#campaign-best').textContent = Number(settings.campaignBest[`${CAMPAIGN.id}:${settings.difficulty}`] || 0).toLocaleString();
  }
  function begin(options) {
    audio.unlock(); run = new CampaignRun(options); sim = run.sim; mode = 'playing'; input.clear();
    accumulator = 0; lastTime = performance.now(); slowWindows = 0;
    $('#menu').hidden = true; $('#dialog').hidden = true; $('#hud').hidden = false; $('#pause').hidden = false;
    document.body.classList.add('playing'); $('#pause').textContent = 'Ⅱ'; $('#pause').setAttribute('aria-label', 'Pause game');
    $('#flight-hint').textContent = matchMedia('(pointer: coarse)').matches ? 'DRAG TO MOVE · AUTO-FIRE ON' : 'WASD / ARROWS · SPACE PRECISION · SHIFT PULSE';
    processEvents(); updateHud(); $('#launch').blur();
  }
  function start(retry = false) {
    let practiceLevel = null, practiceSegment = 0;
    if (retry && run.practice) { practiceLevel = run.levelIndex; practiceSegment = run.practiceSegment; }
    else if (!retry && $('#checkpoint').value !== 'campaign') [practiceLevel, practiceSegment] = $('#checkpoint').value.split(':').map(Number);
    begin({ seed: retry && run.practice ? run.seed : newSeed(), weapon: selectedWeapon, difficulty: settings.difficulty, practiceLevel, practiceSegment });
  }
  function bomb() { if (mode === 'playing') { audio.unlock(); sim.bomb(); processEvents(); updateHud(); } }
  function openDialog(title, copy, paused = false) {
    input.clear(); $('#dialog').hidden = false; $('#dialog-title').textContent = title; $('#dialog-copy').textContent = copy;
    $('#dialog-eyebrow').textContent = paused ? 'FLIGHT SUSPENDED' : run.practice ? 'PRACTICE' : sim.status === 'won' ? 'LEVEL COMPLETE' : 'GAME OVER';
    $('#resume').hidden = !paused; $('#result-stats').hidden = paused;
    $('#next-level').hidden = paused || sim.status !== 'won' || run.practice || run.levelIndex === 4;
    $('#retry').textContent = run.practice ? 'RETRY PRACTICE' : 'NEW CAMPAIGN';
    if (!paused) $('#result-stats').innerHTML = `<div>${run.practice ? 'PRACTICE SCORE' : 'CAMPAIGN SCORE'}<strong>${sim.score.toLocaleString()}</strong></div><div>${sim.status === 'won' ? 'RANK / BONUS' : 'MAX CHAIN'}<strong>${sim.status === 'won' ? `${sim.rank} / +${sim.clearBonus}` : sim.maxChain}</strong></div><div>LIVES<strong>${sim.lives}</strong></div>`;
    $('#reward-breakdown').hidden=paused||sim.status!=='won';
    if(sim.clearRewards){const r=sim.clearRewards;$('#reward-breakdown').textContent=`Clear +${r.base} · Lives +${r.lives} · No deaths +${r.clean} · First pass +${r.firstPass}. ${r.power?`Maximum power +${r.power}`:`${weaponTier(sim.weapon,sim.level).name} unlocked`}${r.pulse?' · +1 pulse':' · Pulses full'}`;}
    (paused ? $('#resume') : !$('#next-level').hidden ? $('#next-level') : $('#retry')).focus();
  }
  function pause(reason) {
    if (mode !== 'playing') return;
    mode = 'paused'; accumulator = 0; $('#pause').textContent = '▶'; $('#pause').setAttribute('aria-label', 'Resume game');
    openDialog('HOLD POSITION.', reason || 'Your fighter, attack pass and remaining lives are held here.', true);
  }
  function resume() {
    if (mode !== 'paused') return;
    mode = 'playing'; audio.unlock(); $('#dialog').hidden = true; $('#pause').textContent = 'Ⅱ'; $('#pause').setAttribute('aria-label', 'Pause game');
    input.clear(); accumulator = 0; lastTime = performance.now(); $('#resume').blur();
  }
  function togglePause() { if (mode === 'playing') pause(); else if (mode === 'paused') resume(); }
  function processEvents() {
    for (const event of sim.events) {
      audio.play(event.type);
      if (event.type === 'segment-enter') {
        notice(event.repeat ? `ATTACK PASS ${sim.pass} · SURVIVING DEFENSES ON ALERT` : event.assault ? 'WARNING · MAJOR ASSAULT INBOUND' : event.name);
        if (event.repeat) input.clear();
        if (!run.practice) { settings.reached[sim.definition.id] = Math.max(Number(settings.reached[sim.definition.id]) || 0, sim.segmentIndex); persist(); }
      }
      if (event.type === 'turnaround') { input.clear(); notice('BANKING OUT · RE-APPROACH · DAMAGE PRESERVED'); }
      if (event.type === 'life-lost') { input.clear(); notice(`${event.lives} ${event.lives === 1 ? 'LIFE' : 'LIVES'} REMAINING · WEAPON RECOVERING`); }
      if (event.type === 'respawn') { input.clear(); notice('REPLACEMENT READY · BRIEF SHIELD PROTECTION'); }
      if (event.type === 'extra-life') notice(`EXTRA LIFE · ${event.threshold.toLocaleString()} POINTS`);
      if (event.type === 'boss-phase') notice(`CORE PHASE ${event.phase}/3 · SHIELD REBUILDING`);
      if (event.type === 'target-destroyed') notice(event.kind === 'bay' ? `${event.label} DISABLED · FEWER REINFORCEMENTS` : `${event.label} DESTROYED`);
      if (event.type === 'pickup') notice(sim.level === 3 ? 'WEAPON AT FULL POWER · SCORE BONUS' : 'WEAPON UPGRADED');
      if(event.type==='power-up'){
        notice(event.maxed?`MAX POWER BONUS +${event.bonus}`:`POWER ${event.previous} → ${event.level} · ${event.name}`);
        renderer.showReward(event.maxed?`MAX +${event.bonus}`:`POWER ${event.level} · ${event.name}`,sim.player.x,sim.player.y);
      }
      if(event.type==='pulse-pickup'){notice(event.maxed?'PULSES FULL · +1000':'PULSE RESTORED');renderer.showReward(event.maxed?'+1000':'PULSE +1',sim.player.x,sim.player.y);}
      if(event.type==='formation-clear')renderer.showReward(`SQUAD CLEAR +${event.bonus}`,Math.max(-5,Math.min(5,event.x)),Math.max(-5,Math.min(10,event.y)));
      if (event.type === 'level-clear' || event.type === 'game-over') {
        mode = 'ended'; $('#pause').hidden = true;
        if (!run.practice) {
          settings.campaignBest[scoreKey()] = Math.max(Number(settings.campaignBest[scoreKey()]) || 0, sim.score);
          if (event.type === 'level-clear') {
            if (!event.final) settings.reached[CAMPAIGN.levels[run.levelIndex + 1].id] ??= 0;
            const key = `${sim.definition.id}:${run.difficulty}`, order = 'CBAS';
            if (order.indexOf(sim.rank) > order.indexOf(settings.ranks[key])) settings.ranks[key] = sim.rank;
          }
          persist();
        }
        const title = event.type === 'game-over' ? 'GAME OVER.' : event.final && !run.practice ? 'FLEET BROKEN.' : `${sim.definition.title.toUpperCase()} CLEARED.`;
        const copy = event.type === 'game-over' ? 'Your last fighter is gone. Start a fresh campaign, or learn the reached routes in practice.' : run.practice ? 'Practice complete. Campaign scores and unlocks are unchanged.' : event.final ? 'Five battlefields cleared. Replay for a cleaner route, higher rank and a stronger score.' : `${sim.clearRewards.power?'Full power converted to score.':'Weapon upgraded.'} ${sim.clearRewards.pulse?'One pulse supplied.':'Pulses are full.'} Your remaining lives and score carry into the next level.`;
        openDialog(title, copy);
      }
    }
    sim.events.length = 0;
  }
  $('#launch').addEventListener('click', () => start()); $('#retry').addEventListener('click', () => start(true));
  $('#next-level').addEventListener('click', () => {
    if (!run.nextLevel()) return;
    sim = run.sim; mode = 'playing'; input.clear(); accumulator = 0; lastTime = performance.now();
    $('#dialog').hidden = true; $('#pause').hidden = false; processEvents(); updateHud();
  });
  $('#pause').addEventListener('click', togglePause); $('#resume').addEventListener('click', resume);
  $('#bomb').addEventListener('pointerdown', event => { event.preventDefault(); bomb(); });
  $('#bomb').addEventListener('click', event => { if (event.detail === 0) bomb(); });
  $('#return-menu').addEventListener('click', () => {
    mode = 'menu'; input.clear(); accumulator = 0;
    run = new CampaignRun({ practiceLevel: 0, practiceSegment: 3, weapon: selectedWeapon }); sim = run.sim;
    $('#menu').hidden = false; $('#dialog').hidden = true; $('#hud').hidden = true; $('#pause').hidden = true;
    document.body.classList.remove('playing'); updateMenu(); $('#launch').focus();
  });
  $('#campaign-map').addEventListener('click', event => {
    const button = event.target.closest('[data-level]'); if (!button || button.disabled) return;
    $('#checkpoint').value = `${button.dataset.level}:0`; $('#launch').focus();
  });
  document.querySelectorAll('[data-weapon]').forEach(button => button.addEventListener('click', () => {
    selectedWeapon = button.dataset.weapon;
    document.querySelectorAll('[data-weapon]').forEach(item => { const selected = item === button; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); });
  }));
  $('#difficulty').value = settings.difficulty;
  $('#difficulty').addEventListener('change', event => { settings.difficulty = event.target.value; persist(); updateMenu(); });
  function soundLabel() { $('#sound').textContent = settings.muted ? 'SOUND OFF' : 'SOUND ON'; $('#sound').setAttribute('aria-label', settings.muted ? 'Enable sound' : 'Mute sound'); }
  $('#sound').addEventListener('click', () => { audio.unlock(); settings.muted = !settings.muted; audio.setMuted(settings.muted); soundLabel(); persist(); }); soundLabel();
  $('#quality').value = settings.quality;
  $('#quality').addEventListener('change', event => { settings.quality = event.target.value; renderer.setQuality(settings.quality); slowWindows = 0; persist(); });
  $('#motion').checked = settings.reducedMotion;
  $('#motion').addEventListener('change', event => { settings.reducedMotion = event.target.checked; persist(); });
  $('#dialog').addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...$('#dialog').querySelectorAll('button')].filter(button => !button.hidden), first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.addEventListener('blur', () => { input.clear(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('resize', () => { input.clear(); renderer.resize(); });
  renderer.renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); pause(); $('#error-copy').textContent = 'The graphics connection was interrupted. Reload to start a fresh run; saved records are retained.'; $('#error').hidden = false; });
  updateMenu();
  function loop(now) {
    requestAnimationFrame(loop);
    const elapsed = (now - lastTime) / 1000; lastTime = now;
    if (mode === 'playing' && elapsed > .5) pause('The browser stopped drawing frames. Resume when the window is active; the campaign is held here.');
    if (mode === 'playing') {
      accumulator += Math.min(elapsed, .5); let steps = 0;
      while (accumulator >= 1 / 60 && steps < 30 && mode === 'playing') { sim.update(1 / 60, input.read()); processEvents(); accumulator -= 1 / 60; steps++; }
      if (steps === 30) accumulator %= 1 / 60;
    }
    renderer.render(sim, now / 1000, mode === 'menu');
    if (now > uiAt) { if (mode !== 'menu') updateHud(); uiAt = now + 100; if (now > noticeUntil) $('#announcement').classList.remove('visible'); }
    frameCount++;
    if (now - frameStart >= 1000) {
      fps = Math.round(frameCount * 1000 / (now - frameStart)); frameCount = 0; frameStart = now;
      $('#performance').textContent = mode === 'menu' ? 'CAMPAIGN ONLINE' : `${fps} FPS`;
      if (mode === 'playing' && settings.quality === 'auto') {
        slowWindows = fps < 38 ? slowWindows + 1 : Math.max(0, slowWindows - 1);
        if (slowWindows >= 3 && renderer.quality !== 'low') renderer.setQuality('low');
      }
    }
  }
  requestAnimationFrame(loop);
  if (import.meta.env.DEV) window.__hullbreaker = {
    get sim() { return sim; }, get run() { return run; }, get mode() { return mode; }, get fps() { return fps; },
    get asset() { return renderer.environment.group.userData.asset; }, get combatAsset() { return renderer.combatAsset; }, get renderer() { return renderer; },
    get campaignAsset(){return renderer.campaignAsset;},
    get stats() { return { calls: renderer.renderer.info.render.calls, triangles: renderer.renderer.info.render.triangles, geometries: renderer.renderer.info.memory.geometries, textures: renderer.renderer.info.memory.textures, retired: renderer.retiredEnvironments.length }; },
    practice(level, segment = 0, weapon = 'vulcan') { begin({ seed: 417, weapon, difficulty: settings.difficulty, practiceLevel: level, practiceSegment: segment }); renderer.render(sim, performance.now() / 1000); },
    advance(seconds, state = { x: 0, y: 0 }, protect = false) {
      for (let i = 0; i < seconds * 60 && mode === 'playing'; i++) { if (protect) sim.player.invulnerable = 100; sim.update(1 / 60, state); processEvents(); }
      lastTime = performance.now(); accumulator = 0; renderer.render(sim, lastTime / 1000); updateHud();
    },
  };
}
