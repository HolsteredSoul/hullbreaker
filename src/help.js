import { PICKUPS, POWER_RESERVE } from './weapon-progression.js';

const details = {
  vulcan: ['Wide spread', '3 → 5 → 7 streams. Best for formations and broad coverage.'],
  laser: ['Piercing lance', '1 → 2 → 3 beams. Higher tiers pierce additional fighters; solid scenery still stops them.'],
  homing: ['Guided seekers', '2 → 4 → 6 missiles, split across targets. Useful while concentrating on dodging.'],
  power: ['Power and recharge', `Adds one tier, up to 3, and refills ${POWER_RESERVE} seconds of boosted firing. At tier 3 it recharges and awards 1,500 points.`],
  shield: ['One shield charge', 'Absorbs one hit before hull damage and protects weapon power. Holds up to 2 charges; a full shield gives 1,000 points.'],
  hull: ['Hull upgrade and repair', 'Increases maximum hull by 1, up to 3, and fully repairs it. At full capacity it still repairs damage; already full gives 1,000 points.'],
  pulse: ['One pulse bomb', 'Adds a pulse, up to 3. Pulses clear hostile shots, destroy fighters and damage visible defenses. Already full gives 1,000 points.'],
};

export function installHelp(beforeOpen, afterClose) {
  const dialog=document.createElement('dialog');dialog.id='help-screen';dialog.setAttribute('aria-labelledby','help-title');
  dialog.innerHTML=`<header class="help-heading"><div><div class="eyebrow">PILOT HANDBOOK</div><h2 id="help-title">HOW TO PLAY</h2></div><button class="icon-button" id="close-help" aria-label="Close help">CLOSE ×</button></header>
    <div class="help-content"><section><h3>Fly, aim, survive</h3><p>Fire is automatic. Move with <b>WASD or arrow keys</b>; hold <b>Space</b> for precision steering. Press <b>Shift</b> to pulse and <b>Escape</b> to pause. On touch, drag anywhere in the playfield; tap PULSE with a second finger while steering.</p></section>
    <section><h3>Choose your weapon</h3><p><b>Matching V / L / M crates increase power and recharge it.</b> Collecting a different weapon switches type and resets power to 1. Different weapon crates do not attract toward you: collect them deliberately, or fly past to keep your current weapon.</p><div class="help-pickups">${['vulcan','laser','homing','power','shield','hull','pulse'].map(type=>`<article style="--pickup:#${PICKUPS[type].color.toString(16)}"><span class="help-token">${PICKUPS[type].label[0]}</span><div><h4>${PICKUPS[type].label.slice(4)} · ${details[type][0]}</h4><p>${details[type][1]}</p></div></article>`).join('')}</div></section>
    <section><h3>Why power goes down</h3><p>Each boosted tier has <b>${POWER_RESERVE} seconds of firing reserve</b>. When it empties, power drops one tier. Tier 1 has unlimited fire. P or a matching weapon crate restores the reserve. The bar and countdown show what remains; pause and return turns do not drain it.</p></section>
    <section><h3>Shields, hull and lives</h3><p>You start with <b>3 lives, 1 hull point and no shield</b>. Shields absorb hits first. Hull damage lowers power by one tier. Losing a fighter resets power to 1 and hull capacity to 1, removes shields, and restores at least 2 pulses. A replacement arrives after 1 second with 2.5 seconds of protection. The last death ends the run.</p></section>
    <section><h3>Assaults and rewards</h3><p>Destroy the marked objectives. If one survives, your fighter returns for another pass; damage and destroyed systems stay destroyed. Gun batteries are armoured and fire locked bursts. Missile turrets launch two pairs in succession; their missiles can be shot down. Dodge after the warning locks, or use a pulse.</p><p>Supply escorts drop upgrades. Destroy whole formations for a bonus; escapes cancel it. Chain kills build a score multiplier. Level clears give a power upgrade, one pulse and score bonuses. Your current equipment and lives carry forward. Extra lives arrive at <b>50,000 and 150,000 points</b>, once each. Practice uses fresh supplies and does not change campaign records.</p></section></div>`;
  document.body.append(dialog);
  let trigger=null;
  const open=()=>{if(dialog.open)return;trigger=document.activeElement;beforeOpen();dialog.showModal();dialog.querySelector('#close-help').focus();dialog.scrollTop=0;};
  dialog.querySelector('#close-help').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{afterClose();if(trigger?.isConnected)trigger.focus();});
  document.querySelectorAll('[data-open-help]').forEach(button=>button.addEventListener('click',open));
  return dialog;
}
