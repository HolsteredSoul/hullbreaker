# Hullbreaker arcade art slice

Implemented 7 September 2026. The 90-second mission now uses the selected stylised heavy-battleship direction. Gameplay parameters and collision rules remain the prototype values.

## Delivered assets

| Asset | Content |
|---|---|
| Nesis | Thick wedge keel, aft shoulders, five engines, service trench, stepped armour, hangar collars, flank batteries, offset bridge, reactor supports and tapered bow |
| Player | Ivory/cyan split-wing arrowhead, raised cockpit, twin engines and persistent hit marker |
| Enemies | Swept scout, fork-nosed interceptor, broad twin-pod bomber; separate instanced geometry per class |
| Targets | Sliding split bay doors, turret pivot, core rotor; intact/moving/destroyed hierarchies and hit glow |
| Effects assets | Finned missile and six instanced wreckage shapes; socket-oriented exhaust, simple readable bullets and pickups retained |

Sources: `assets/blender/nesis-arcade-v2.blend` and `combat-arcade-v2.blend`. `hullbreaker-art-review.blend` is a generated viewing assembly. Run `npm run asset:export` after editing sources; export preserves the source files. Run `npm run asset:verify` and `npm run build` afterwards.

## Budgets and measurements

| Package | GLB bytes | Triangles | Mesh batches | Materials | AO |
|---|---:|---:|---:|---:|---:|
| Battleship | 3,524,784 | 35,392 | 27 | 6 | 2048² |
| Combat library | 1,875,084 | 15,644 | 27 across all 14 assets | 2 | 1024² |

Combined GLBs: **5,399,868 bytes**. Every enemy class uses two material batches. Runtime draw calls depend on visible ship sections and active populations.

Desktop sample: Windows 10/11 user agent, Chrome 152, Intel Iris Xe through ANGLE/D3D11, 1440×960 viewport and drawing buffer, pixel ratio 1, High setting. After warm-up, 479 measured frame intervals in each sample:

| Scenario | Median | 95th percentile | Draw calls at sample end | Visible triangles |
|---|---:|---:|---:|---:|
| Live representative combat | 10.0 ms | 10.2 ms | 55 | 67,360 |
| Fixed stress population | 10.0 ms | 10.2 ms | 59 | 145,836 |

Stress population: 40 fighters, 200 hostile projectiles including missiles, 80 friendly projectiles and 300 sparks. Stress freezes the simulation to hold those populations constant and measures rendering cost; the live sample includes simulation. These are short local samples, not sustained thermal or physical-phone benchmarks. Around 40 FPS remains acceptable and 60 aspirational.

## Verified behaviour

- Both GLBs load and validate; no uncaught browser errors during the completed check.
- Hull failure, combat failure and both failures preserve playable procedural fallbacks. Deliberately aborted requests produce expected network warnings.
- Distinct enemy batches, visible missiles, opening bay doors, intact-to-wreck swaps, victory and clean retry.
- Keyboard movement, pause/resume, relative touch drag, simultaneous drag/bomb, low quality and reduced motion.
- All nine existing simulation tests pass; asset checks and production build pass. Vite reports its existing large-chunk advisory.
- Visual review covers desktop wake, bays, opening/destroyed bay, defence, roster and core; mobile wake/bays/core; whole-ship and studio views. Images and repeatable browser QA scripts are under `output/playwright/`.

The first render still had oversized empty deck slabs. A second authored pass replaced that reading with dark service trenches, articulated armour, hangar collars and reactor supports. Final aesthetic approval is the user's judgment.

## Next milestones

1. Tune gameplay feel, difficulty, warning readability, weapons and rewards.
2. Expand the longer mission and boss consequences.
3. Test real Android/iPhone hardware, browser compatibility and sustained sessions.
4. Add another capital ship or a station through environment registration, full engine sockets and stable mission target bindings.

No second environment, new enemy behaviour, music, deployment or framework migration was included in this slice.
