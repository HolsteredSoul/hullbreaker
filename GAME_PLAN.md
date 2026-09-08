# Raiden: Hullbreaker — proposed game plan

This document retains the broader release design below. Current implementation: a complete six-sector Nesis assault with a 110-second deadline, four active side batteries, support windows, two difficulty settings, unlocked practice starts and a three-phase boss. See GAMEPLAY_PHASE.md and DEVELOPMENT.md for exact implemented behavior. Features in the original design below that are not listed there remain proposals.

September 2026 pathway: Nesis art and gameplay passes complete → human balance review and physical-device validation → deep-space sortie plus mission selection → station assault → moon-base and nebula missions. New environments should introduce distinct objectives and hazards rather than stretch the Nesis timeline. No additional environment is included in this pass. The rejected six-minute pacing is superseded by a 64-second approach and 110-second deadline.

Accepted refinements: around 40 FPS is acceptable, with 60 FPS aspirational. Gameplay now uses a perspective camera at 60 degrees above the hull to strengthen depth. Keep future capital ships and space stations separate from reusable combat systems.

## Concept and scope

A browser arcade shooter for PC and mobile. Fly in the exhaust and shadow of a fleeing capital ship, advance from its engines toward its command core, and dismantle the systems defending it before it jumps away. One continuous Blender-authored capital ship is the level and final boss.

The existing Raiden project supplies useful design foundations: Vulcan, laser and homing weapons, bombs, combos, health, pause, mute and local high scores. Build the 3D version as a separate application; use the current game as a reference for feel and balance.

Target one polished, approximately eight-minute mission for the first release. The first playable milestone is a 90-second slice. Additional capital ships, online leaderboards, multiplayer, procedural geometry and native app packaging sit outside that release.

## Core experience

Advance automatically along a authored route over the hull. The player steers laterally and forward/back within a bounded combat plane. There is no manual altitude or camera control. Keep the player near the local origin and move the capital-ship root along the route to convey travel.

Every encounter combines three decisions: dodge a readable threat, choose between fighters and a hull subsystem, then collect the reward without losing safe positioning. The hull must create tactical choices as well as visual variety.

Normal flight uses one combat plane for ships and projectiles. Decorative pipes, plating and mid-depth objects do not cause unexplained collisions. Only clearly marked protrusions and exhaust lanes intersect the playable corridor. Shootable hull hardpoints have visible target markers mapped to that same combat space; bolts connect visually to their physical mounts. Define this mapping before creating detailed art.

The camera stays slightly above and behind, looking forward along the hull. Begin with a maximum three-degree visual bank. Movement, hitboxes and warnings remain stable in screen space. Offer zero bank, reduced shake and reduced flashes.

## Weapons, survival and rewards

- Vulcan: broad coverage and forgiving bay attacks.
- Laser: focused damage against turret rings and armored weak points.
- Homing: lower sustained damage, useful while concentrating on dodging.
- Pulse bomb: clears hostile projectiles, damages nearby enemies and provides a brief escape window. Begin with two charges; award a replacement at a major section clear.
- Three health segments and approximately 1.5 seconds of invulnerability after a hit. Preserve weapon upgrades on damage.
- Pickups improve the equipped weapon; choose the starting weapon before launch. Avoid requiring small weapon-switch buttons during mobile combat.
- Score rewards subsystem destruction, fast encounter clears, survival and fighter kills. Give a bay destruction bonus that compensates for the enemies it prevents, so optimal scoring does not encourage farming an intact bay.

Use a mission progress strip with subsystem icons. Destroying a bay changes its icon and announces the reduction in reinforcements. Keep score, health and bomb count readable without covering incoming threats.

## Destructible bays and enemies

Each launch bay owns an explicit spawn schedule and a persistent alive/destroyed state. Telegraph door opening before a launch. Destruction cancels that bay's future launches; fighters already in flight remain active. Detached hull sections must not reset bay state.

Example encounter: two bays each launch a three-fighter squad every eight seconds. Destroy one to halve this encounter's bay-generated reinforcements; destroy both to stop them. Separate authored patrols remain clearly independent. Do not secretly replace canceled spawns to keep difficulty constant.

Closed doors take reduced damage; exposed launch mechanisms take full damage. A bay can always be damaged so waiting for the next opening is a tactical option, not a mandatory pause. Its destruction grants an upgrade or repair pickup at a reachable location.

Enemy roster for release:

| Enemy | Behavior | Player response |
|---|---|---|
| Scout | Launches in a formation with gaps | Sweep the formation or pass through |
| Interceptor | Shows a charge line, then dashes | Move perpendicular to the warning |
| Bomber | Launches slow, destructible missiles | Shoot missiles or evade their lane |
| Turret ring | Rotates through a telegraphed firing arc | Find the gap or destroy its emitter |

Start with 0.8–1.2 seconds of visible warning for major attacks, then tune on real phones. Distinguish hostile bullets using bright cores, outlines and shapes. Color alone must not carry threat information. Enemies emerging from deep bays cannot hit or be hit until their combat-plane entry cue finishes.

## Mission sequence

| Time | Hull section | Encounter purpose |
|---|---|---|
| 0:00–1:00 | Engine wake | Teach steering, firing and pulsing exhaust hazards |
| 1:00–2:30 | Hangar trench | Introduce two destroyable bays and their spawn reduction |
| 2:30–4:00 | Defense spine | Combine turret rings with surviving reinforcements |
| 4:00–5:30 | Broken armor | Telegraph debris crossings; expose a coolant subsystem |
| 5:30–7:00 | Command approach | Test weapon use and positioning under mixed attacks |
| 7:00–8:00 | Jump core | Stop scrolling for a multi-phase capital-ship boss finish |

The final battle uses the same ship asset. Earlier bay destruction reduces reinforcements, disabled turret controllers remove corresponding attacks, and destroyed coolant equipment extends a core damage window. The boss remains beatable with no optional systems destroyed. Winning disables the drive before the final jump charge completes. Failure offers a fast retry.

Practice mode restarts at section checkpoints. Arcade mode uses a full-run score. Save settings, best scores and unlocked practice sections locally; pause on loss of focus and require a clear resume action.

## PC and mobile controls

| Action | PC | Mobile |
|---|---|---|
| Move | WASD/arrows; optional mouse follow | Relative drag anywhere outside HUD buttons |
| Fire | Auto-fire default; Space for manual mode | Auto-fire default |
| Bomb | Shift or configurable key | Large thumb-accessible button |
| Pause | Escape | Persistent pause button |

Use a visible finger-to-ship offset, configurable sensitivity and a mirrored button layout. Relative touch movement must not teleport the ship on initial contact. Handle simultaneous drag and bomb input, pointer cancellation, safe-area insets and browser interruptions. Unlock audio after the Start gesture.

Use one fixed 3:4 combat viewport for the initial release. Center it on desktop and landscape screens with decorative side space; use the remaining vertical space on tall phones for controls and status. Extra screen area must not expose additional threats or alter travel distances. Verify this framing in the graybox before committing to art. Layout should follow available space and input capabilities rather than assuming width identifies a phone.

## Art and asset pipeline

Author the ship as one coherent Blender scene and export one capital-ship GLB. Preserve named nodes for doors, rotating turrets, damage variants, spawn sockets, target anchors and simple collision proxies. Merge static hull geometry by material within a few longitudinal sections; keep only a few sections visible at a time. A single monolithic mesh would undermine useful culling and independently destructible parts.

Use baked ambient occlusion and hull shadowing, a restrained directional light, texture atlases and emissive engine materials. Avoid full-scene real-time shadows on the mobile baseline.

Depth composition:

- Far: sparse stars and a subtle planetary limb, with very little apparent movement.
- Mid: hull silhouette, hangar doors, turret rings and broken plating.
- Combat: high-contrast player, enemies, bullets and subsystem target cues.
- Near: engine glare, occasional fast sparks and localized heat distortion.

Keep haze away from threat silhouettes and render essential indicators after distortion. Use deterministic broken/intact mesh swaps and pooled debris rather than runtime hull fracture. Sound layers combine an engine bed, bay alarms, distinct weapon signatures and a restrained music escalation.

Load GLB assets with Three.js GLTFLoader and evaluate KTX2 texture compression using its KTX2Loader integration. Official references: [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html).

## Runtime and performance plan

Use Three.js with modular JavaScript, separating input, fixed-step simulation, collision, encounter scheduling, rendering, audio and UI. Store hull events and spawn schedules as data driven by route distance and encounter time. Never use per-render-frame random spawn probabilities.

Pool fighters, missiles, bullets and sparks. Use InstancedMesh batches per shared geometry/material, update active instance transforms and counts, and maintain valid batch bounds as objects move. Instancing reduces draw calls for shared geometry/material; it does not remove simulation or collision costs. See [InstancedMesh documentation](https://threejs.org/docs/pages/InstancedMesh.html).

Use simple circles/capsules and a spatial grid for combat collision; swept checks protect fast projectiles against tunneling. Do not raycast every projectile against detailed hull triangles. Simulate at a fixed 60 Hz with bounded catch-up work, interpolate rendering, and pause instead of simulating a backlog after backgrounding.

Initial rendering budgets, subject to profiling:

| Metric | Mobile baseline | PC high |
|---|---|---|
| Sustained frame target | Around 40 FPS acceptable; 60 aspirational | Around 40 FPS acceptable; 60 aspirational |
| Visible triangles | 150k–250k | Up to 600k |
| Draw calls, including effects | Under 80 | Under 120 |
| Initial render pixel ratio cap | 1.25 | 1.75 |
| Effects | Emissive glow, limited sparks, haze off | Optional bloom and local haze |
| First playable asset transfer | At most 15 MB compressed | Same core package |

Start the stress scene at 40 fighters, 200 hostile projectiles, 80 player projectiles and 300 decorative sparks. These are test loads, not guaranteed safe capacities. Gameplay population and attack patterns remain identical across visual quality levels.

The 60 FPS frame interval is about 16.7 ms. Profile CPU, GPU, draw calls, memory and frame-time percentiles. Reduce resolution, haze, bloom, particles and distant detail when performance drops; restore quality slowly to avoid oscillation. Transparent exhaust overdraw and postprocessing need particular attention. Offer an explicit stable 30 FPS fallback for devices that cannot sustain the target after visual reductions.

## Delivery and acceptance gates

1. Graybox: placeholder hull, stable camera, fixed combat viewport, keyboard/touch movement and one enemy. Accept only after dodging feels predictable on PC and phone.
2. Tactical slice: a 90-second route, two bays, turret, one weapon, bomb and HUD. Verify that destroying a bay prevents all its scheduled future launches and awards the correct score.
3. Art/performance slice: replace graybox with one finished Blender hull section, add instancing and a worst-case effects scene. Profile on physical midrange Android, an older supported iPhone and an integrated-GPU PC before expanding content. Record exact devices, browser versions and resolution.
4. Full mission: complete the hull, four enemy types, three weapons, progression rewards and boss consequences. Balance both intact-bay and destroyed-bay routes.
5. Release hardening: test a full run and at least 15 minutes of repeated play for heat-related slowdown, touch input loss, orientation changes, background/resume, audio, save recovery and GPU context loss. Cover desktop Chrome/Edge/Firefox/Safari as available, Android Chrome and iOS Safari.

On baseline devices, aim for median frame time at or below 25 ms, with 16.7 ms aspirational, and avoid recurring 50 ms stalls. Profile percentile behaviour during sustained play to tune visual quality or revise supported-device expectations; these are targets, not performance claims.

The Nesis gameplay milestone is implemented. Next, review human difficulty and test physical devices, then build the first deep-space sortie and mission-selection flow. Station, moon-base and nebula content follows as separate authored missions.
