# Hullbreaker development

## Run

Requires Node.js 22.12+ (developed with Node 24).

```sh
npm install
npm run dev -- --port 5187 --strictPort
```

Open http://127.0.0.1:5187. On a phone on the same network, use the LAN URL printed by Vite. `npm run build` creates the static website in `dist`; `npm run preview` serves that build. Deploy `dist` to any static host. The old `Raiden_Enhanced.html` remains available separately.

```sh
npm test
npm run build
```

## Current playable scope

The current Nesis strike replaces the rejected six-minute pacing with a 110-second deadline. The hull approach takes 64 seconds. Patrols start at 0.8 seconds and recur roughly every three seconds, including crossing scouts, diving interceptors and bomber escorts. Player steering is 13 units/second with Space precision at 55%. Kill chains last three seconds, give up to x4 score and reset on a hit. Every tenth projectile kill drops a repair/upgrade pickup.

Bays have 32 health, the controller 45, coolant 30 and side links 32. Four side batteries retain warnings, aim lock and physical muzzle origins. The core starts at 1:04 with 225 health across three phases. Exposure is 4.8 of every six seconds, or 5.5 seconds with coolant destroyed; transitions last 0.75 seconds. Two support windows at 0:28 and 1:02 provide hull and pulse, with a 1.5-second firing respite. Earlier subsystem consequences remain intact.

Pilot starts with four hull; Rookie has five and slower hostile shots. Reached sectors unlock practice with fresh supplies and intact systems. Full-run scores use the new nesis-strike-v4 mission ID; previous records remain separate. The original PROTOTYPE_MISSION remains for regression coverage. See PACING_REVISION.md for current verification; GAMEPLAY_PHASE.md records the superseded six-minute build.

The frame loop preserves elapsed time through bounded fixed-step catch-up. Gaps exceeding 0.5 seconds pause instead of silently running in slow motion. Intentional development fast-forward resets the frame clock.

The gameplay camera uses perspective at 60 degrees above the hull, with a small optional bank. Framing adapts to aspect ratio while preserving the same movement bounds. The hangar menu uses an orthographic ship overview. Reduced motion removes bank and the expanding pulse effect.

The presentation pass adds soft engine/core glow, depth-separated drifting debris, approximate ship contact shadows, authored deck markings, smooth bay doors, and persistent scorched wreckage on destroyed targets. Low quality reduces debris count and engine glow; reduced motion hides drifting debris and freezes glow pulsing. New encounter schedules, survival settings and boss consequences now accompany this presentation; human playtesting will refine their balance.

Performance priorities are responsiveness and readable depth. Around 40 FPS is acceptable; 60 FPS is aspirational. Auto quality lowers resolution after several slow measurement windows. No phone performance claim is made without testing physical devices. Browser resizing and touch emulation only verify layout/input behavior.

The complete arcade art slice is integrated: a new heavy battleship with a recessed service spine, layered armour, five engines, flank batteries and an offset command tower; distinct player/scout/interceptor/bomber models; sliding bay doors, rotating turret/core parts, complete damage swaps, a missile and six debris shapes. Two Blender GLBs use embedded baked AO. The full Nesis gameplay pass now follows that art milestone. Heat distortion, postprocessing bloom, music, campaign progression and additional environments remain future work. The current strike uses a 110-second deadline. More duration must come from more encounters and environments. See ART_SLICE.md for verification and measured budgets.

## Extension boundaries

| Module | Responsibility |
|---|---|
| `src/content.js` | Mission definitions, weapon parameters, stable content IDs |
| `src/simulation.js` | Pure combat rules, fixed-step movement, collision, spawn schedules and persistent target damage |
| `src/environments.js` | Environment factories and optional GLB loading |
| `src/capital-hull.js` | Sectioned procedural armor, variable-width silhouette, engine shoulders, docking arms and command superstructure |
| `src/renderer.js` | Cameras, instanced dynamic objects, visual target representations and target labels |
| `src/combat-assets.js` | Shared combat GLB registry, hierarchy validation and geometry extraction for instancing |
| `src/scene-effects.js` | Reusable cosmetic glow, instanced debris/shadows and per-environment deck markings |
| `src/input.js` | Keyboard and relative multitouch input |
| `src/audio.js` | Optional synthesized sound service |
| `src/main.js` | Lifecycle, settings, HUD, menu and score persistence |

Add a second capital ship by registering another mission with a unique ID, its own sectors, target anchors, patrol timings, hazards and environment seed/model. Point the application at that mission; the current menu launches only Nesis. A future mission-selection screen can enumerate the exported `missions` map. Do not re-use target IDs within a mission.

Add a station by registering a scenery factory with `registerEnvironment('station', factory)`. A factory returns `{ group, update(time, distance, menu) }`. Set the mission's `environment.type` to `station`; a linear docking-trench assault can immediately reuse the simulation. Orbital routes, branching approaches or free flight would require a separate route/movement extension. They are not implemented by naming an environment type.

The current target behaviors are `bay`, `turret`, `battery`, `coolant` and `core`. New target behaviors require simulation and visual implementations. Existing bay rules can represent station fighter docks without a new behavior. The HUD still contains Nesis-specific copy and two bay indicators; adapt that presentation when adding a mission with a different target count.

Environment factories expose `group.userData.engineSockets` containing `{ position: [x,y,z], direction: [x,y,z], radius }` in environment-local game coordinates. SceneEffects owns glow/exhaust and refreshes when that socket array changes. Engine geometry belongs to the GLB or procedural fallback, so it is never doubled. Omit sockets for environments without engines. The capital provider also exposes `targetBindings`, a map from mission target ID to validated local position and imported socket node. Put deck text in `environment.markings` (x/z, text, sub, width/height); custom deck heights still need matching text placement.

Weapons are data-driven for cadence, damage, speed, spread and color. New firing mechanics need a simulation change; the registry is not a scripting engine. Add corresponding loadout controls and accessible descriptions to the menu.

## Blender asset contract

The current editable sources are `assets/blender/nesis-assault-v3.blend` and `assets/blender/combat-arcade-v2.blend`. Browser assets use matching names under `public/assets/`. The battleship has 27 section/material batches, six materials, 31,536 triangles, a 2048px AO atlas, nine target sockets and five full-position engine sockets. The combat pack has 27 mesh batches across 14 asset roots, two shared vertex-colour materials and a 1024px AO atlas. Every enemy class uses two instanced batches. Combined GLBs total 5,106,528 bytes.

Source forms retain bevel modifiers. Named `intact`, `moving`, `destroyed`, `door_left`, `door_right` and `rotor` hierarchies are the target animation contract. Engine emission sockets belong to each craft. Export copies are built in memory and never saved over editable source files. `hullbreaker-art-review.blend` is the earlier v2 art review assembly; make lasting edits in the source files. The v3 hull retains the sponsons but removes baked battery rings, housings, barrels and muzzles, replacing them with dynamic combat-library turret instances. Approved v2 art and its source remain intact. `scripts/create-assault-source.py` records this one-time derivation and refuses to overwrite the new editable source. The original `nesis-capital.blend`, v1 GLB and builder remain as the previous blockout.

Rebuild with Node and Blender 5.2 from the repository root:

```powershell
npm run asset:export
npm run asset:verify
npm run build
```

Export uses an isolated Blender process, reads the saved sources, applies modifiers to copies, merges by section/material or combat pivot, packs UVs, bakes AO with Cycles and exports GLBs. It does not save either source. `scripts/create-arcade-source.py` is the one-time authoring history and refuses to overwrite existing sources; `scripts/refine-arcade-source.py` records the completed camera-review refinement. Neither is part of routine export. The old `asset:source` command is for the retained v1 procedural blockout only.

Asset verification checks both GLBs, embedded textures, UVs, occlusion materials, finite bounds, section/triangle budgets, exact target alignment, required hierarchies and enemy material-batch counts. Browser verification covers each package failing separately and both failing together. Development diagnostics `window.__hullbreaker.asset` and `.combatAsset` report loading/ready/fallback; `.renderer` exposes the live renderer for art QA only and is excluded from production.

1. Author in meters, Y-up on glTF export, bow toward -Z. The current hull is roughly 100 units long, with varying widths up to about 30 units including outriggers, aft armor at Z=14. Its top deck sits around Y=-1.5; the combat plane is Y=0. Keep raised structures outside the combat corridor; the prototype passes hardpoint footprints to the scenery builder to leave target areas clear.
2. Export the static ship skin as GLB. Merge by material within longitudinal sections so off-screen sections can be culled. Keep texture/material counts modest.
3. Place the asset under `public/assets/`, then set the mission's `environment.model` to `/assets/your-ship.glb`. GLTFLoader swaps the procedural static hull out after loading. If loading fails, the procedural hull stays playable.
4. Static engine casings are in the hull GLB; SceneEffects adds socket-aligned flames. Target models live in the shared combat GLB, including moving and damaged parts. The renderer replaces procedural target assemblies only after the whole combat package validates. New visual asset IDs belong in the combat registry; new target behaviours still require simulation changes. Never include duplicate target machinery in the hull export.
5. `mountX`/`mountY` optionally bind a target to a physical asset socket while `x` remains its reachable combat link. Socket validation uses the physical mount. Battery projectiles begin at the rotated muzzle and enter the combat plane over 0.35 seconds; collision is disabled during entry. Target anchors are authored in mission data: `x` is lateral, `y` is forward along the route. Rendering maps forward to -Z. `anchorY - distance` determines the current combat position. Validate imported anchors and collision readability before adjusting detail.

This keeps combat behavior independent from the art file. Loading a GLB alone does not automatically import its bay behavior, animations or spawn schedules.

## Verification and limitations

Twenty-two Node tests cover the original slice and expanded mission: route continuity, three boss phases and shields, battery aim/volleys/cancellation, physical shot origins, all-weapon target damage and boss completion, support windows, hazard telegraphs, entry protection, Rookie settings, precision movement, and canceled bay spawns, final reinforcement consequences, alternate environment data, fixed-step consistency, pulse behavior, damage invulnerability, mission outcome, weapon damage and swept collision. The browser checks exercise launch, keyboard movement, pause/resume, real browser touch events, simultaneous drag/bomb, score persistence, victory and clean restart.

Development builds expose `window.__hullbreaker` for diagnostics and deterministic time advancement. This hook is excluded from the production build. Fast-forwarding causes artificial frame-time spikes, so do not use the FPS label during those checks as a benchmark.

UI screenshots and one-off Playwright scripts are written to ignored `output/playwright/`. Validate real iOS Safari and Android Chrome, heating over longer sessions, audio policy and input latency before release. All gameplay is local, with no accounts or online leaderboard. Google Fonts supplies optional typography; system font fallbacks work without that request.


## Public deployment

The live game is https://holsteredsoul.github.io/hullbreaker/. Push `main` to the public HolsteredSoul/hullbreaker repository to run `.github/workflows/pages.yml`: dependency installation, simulation tests, asset validation, Vite build and Pages deployment. Pages uses GitHub Actions as its source. Vite emits relative URLs and the GLB loaders resolve against `BASE_URL`, so both local development and the project subdirectory work. Blender is not required in CI because exported assets are versioned.
