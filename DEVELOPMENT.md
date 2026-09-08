# Hullbreaker development

## Run and verify

Node.js 22.12+ is required (development uses Node 24).

```sh
npm install
npm run dev -- --port 5187 --strictPort
npm test
npm run asset:verify
npm run build
```

Vite serves the game on http://127.0.0.1:5187. The production bundle is `dist`; `npm run preview` serves it. GitHub Actions builds and publishes pushes to main. The original `Raiden_Enhanced.html` remains independent.

## Runtime ownership

| Module | Responsibility |
|---|---|
| `src/content.js` | Weapons/difficulties, legacy missions, campaign metadata, authored segment blueprints and seeded wave compilation |
| `src/simulation.js` | Shared combat, fixed-step movement, collision, target attacks, shielding, projectiles and effects |
| `src/campaign.js` | Run supplies, level progression, persistent target state, lives, respawn, pass loops, rewards and mastery ranks |
| `src/environments.js` | Scenery factory registry and guarded Nesis GLB loading |
| `src/sector-scenery.js` | Batched procedural space, ship, station and moon modules |
| `src/flight-path.js` | Continuous return trajectory, tangent-derived heading, climb/descent and curvature-based bank |
| `src/renderer.js` | One renderer/canvas, mission switching, incoming/outgoing scenery, target visuals and visual-only turn animation |
| `src/scene-effects.js` | Reusable debris, glow and surface-aware contact shadows |
| `src/scene-resources.js` | Disposal of scene-owned geometry, materials and textures |
| `src/combat-assets.js` | Shared GLB registry and instancing geometry |
| `src/main.js` | Campaign/practice UI, records, focus/pause lifecycle and diagnostics |

`CampaignRun` compiles all five levels for a seed, owns carried supplies and creates a `CampaignSimulation` for one level. `nextLevel()` only succeeds after a non-practice clear before the finale. Active run state stays in memory. Local storage retains settings and the new campaign records while preserving older Nesis fields.

`CampaignSimulation` extends the existing renderer-independent `Simulation`. `mission` is the current segment, while `definition` is the level. `time` and `distance` are segment/pass-local; `levelTime` and `campaignTime` never rewind on a pass. `targetStates` retains objects by stable ID across segments. `enterSegment(index, repeat)` resets only local schedules/transients; repeat keeps core phase and damage. UI listens for `segment-enter`, `turnaround`, `life-lost`, `respawn`, `extra-life`, `level-clear` and `game-over`.

## Content contract

`compileCampaign(seed)` returns levels with `id`, `title`, `index`, `seed`, `duration` and `segments`. Each segment contains scenery, local route keyframes, target definitions, warnings/hazards, explicit waves, a duration, and optional `assault`, `completion`, and `boss` data. The existing base simulation shape (`pace`, `sectors`, `patrol`, `recovery`) is compiled alongside them.

Targets use level-wide unique IDs, qualified with the level ID during compilation. `gates` names targets that must be destroyed before damage is allowed. `controllerId` identifies a specific controller that weakens attacks. `supportIds` controls the lunar bunker's additional salvos. Wave `sourceBay` references also resolve through persistent level state, so earlier dock destruction affects later segments. A target's `kind` describes combat; it does not automatically win a campaign level. Only all IDs in `completion` being destroyed triggers a clear.

Target kinds: `bay`, `turret`, `battery`, `coolant`, `launcher`, `core`. Launchers use warned, aim-locked salvos of destructible missiles and cancel on destruction. Nesis retains its shield cycle and three damage phases; other final targets can use dependency gates or independent objectives.

Keep combat target `x`/`y` separate from optional physical `mountX`/`mountY`. Route distance maps both scenery and target anchors into the same combat view. Models are Y-up, bow toward -Z, and target scenery anchors use `z = -target.y`. `socketId` preserves original GLB node names after campaign ID qualification. Required target positions must remain within the existing shooting bounds.

Approach wave choices use a combat seed and compile once. Authored assault schedules use fixed per-level seeds. Particle effects use a separate generator; scenery seed and visual quality cannot alter enemy behavior. Do not introduce per-frame random spawn probabilities.

## Renderer and asset lifecycle

Environment factories return `{ group, targetBindings, update(time, distance, menu), dispose() }`. `group.userData.surfaceY` is null for space. Optional engine sockets specify local position, direction and radius. Target bindings validate imported socket positions against content. New providers must own their disposal and ignore/dispose async results after retirement.

Incoming scenery is constructed near a segment's end, positioned using the next route's starting distance, and reused at the boundary. Retired outgoing scenery scrolls out and releases after six seconds. Changing runs disposes all retired and preview environments immediately. Repeated passes reuse the current environment and target visuals.

Combat-library geometry/materials carry `userData.sharedCombat` and live for the renderer's lifetime. Target clones share those resources; disposing a target must not dispose its siblings' assets. The long-lived glow texture has `keepAlive`; per-environment generated textures are disposed normally. Effects bind to new environments without recreating debris pools.

Editable Blender sources and export contracts remain in `assets/blender/nesis-assault-v3.blend` and `assets/blender/combat-arcade-v2.blend`. `npm run asset:export` reads saved sources; `npm run asset:verify` validates the existing packages. Scenery variants and missile racks are code-authored geometry and do not modify the Blender sources. See `ART_SLICE.md` for the original art pipeline.

## Validation and diagnostics

`tests/campaign.test.js` exercises route compilation, persistent passes, gates, cross-segment reinforcements, lives, rewards, difficulty pressure, practice isolation and all 15 weapon/assault combinations. Protected-pilot checks use ordinary shots; they do not claim human difficulty validation. Legacy assault and simulation tests remain in place.

Development builds expose `window.__hullbreaker`: read `sim`, `run`, `renderer`, `stats`, `asset`, `combatAsset`; use `practice(level, segment, weapon)` and `advance(seconds, input, protect)` for repeatable QA. Production builds omit these diagnostics. The real frame loop keeps fixed 60 Hz simulation, pauses after a >0.5-second browser stall and resets the clock after diagnostic fast-forward.

Browser QA scripts and screenshots live under ignored `output/playwright/`. Use the installed Playwright CLI directly with Node for long Windows `run-code` scripts, avoiding cmd.exe's argument-length limit. Physical-device behavior and human pacing remain separate validation steps.
