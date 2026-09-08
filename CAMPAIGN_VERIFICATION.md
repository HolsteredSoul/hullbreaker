# Campaign verification — 8 September 2026

Implemented locally in the Hullbreaker Vite application. The original `Raiden_Enhanced.html` and legacy Nesis content remain available. This change has not been published.

## Automated checks

- `npm test`: **42 passed, 0 failed**, including all 22 original combat tests, campaign progression tests and nine focused arcade/collision/reward tests.
- `npm run build`: passed; production output is `dist/`.
- `npm run asset:verify`: passed for all three GLBs; combined payload 6,170,784 bytes. The new Blender library contains seven assets, 14 batches and 11,312 triangles. Editable source: `assets/blender/campaign-modules-v1.blend`.
- All 15 weapon/assault combinations finish using ordinary simulated weapon shots with a protected targeting pilot. Targets can survive into return passes. No direct objective damage is used in this feasibility test.
- Campaign tests cover seeded generation, 240-second authored routes, immediate formations, reachable target coordinates, dependency references, hazard warning windows, the campaign's 30-fighter population limit, persistent damage, canceled bay launches, gated objectives, Nesis phase persistence, lives/respawn/protection, downgrade, game over, once-only rewards, extra-life thresholds, carry-over and practice isolation. Legacy missions retain their 18-fighter cap.
- Focused arcade tests verify 3/5/7 Vulcan streams, 1/2/3 piercing lances, 2/4/6 seekers, split locks, no repeated piercing hits, reachable power/pulse drops, full-supply score conversion, formation bonuses, fast projectiles stopped by cover before targets, persistent destructible debris, flight-height clearance, body collision bounds and safe muzzle/bay clearance.
- Return trajectory tests sample 1,000 points for each of three starting positions. Heading follows the path tangent; the fighter climbs before crossing structures and reaches the correct entry location and direction. Defense entry warnings remain intact on repeat passes.

## Browser checks

Chrome 152 on Windows, using the local Vite server and an isolated Playwright profile:

- Desktop campaign menu, weapon selection, keyboard steering, pause/resume, level-clear progression through all five levels, campaign victory, game over, unlock persistence and practice record isolation.
- Space, wreckage, cruiser/carrier, station, moon/fortress, command ship and imported Nesis rendering.
- Incoming environment reused at the boundary (same group ID); outgoing environment released after its retirement interval. Repeated moon/station changes stabilized at 67 geometries, 3 textures and 3 target labels in the sampled scene across four cycles.
- A Nesis scene disposed while its model was loading remained detached after the response arrived; the current space scene stayed procedural.
- Six-second return completed in real time with the fighter in view throughout and pass two active afterward. The installation remained fixed during the full-motion flight. Projected installation coordinates immediately before/after the final rebase differed by less than 0.001 normalized screen units.
- Reduced-motion return reached a fully faded midpoint without yaw rotation, restored full opacity and enabled steering on pass two.
- Portrait 390×844 and landscape 844×390 layout checks. A portrait sweep crossed every authored segment boundary and returned for pass two on all five assaults, reusing the same assault scenery and keeping the fighter framed. Emulated simultaneous touch drag and pulse moved the fighter while consuming exactly one pulse; movement continued after the second finger lifted.
- Deliberately unavailable combat and Nesis GLBs retained playable procedural fallbacks. No application exceptions were emitted; the deliberately blocked requests produced expected network errors and fallback warnings.
- The arcade revision was checked in Chrome at desktop and portrait dimensions: all weapon families visibly changed between tiers one and three; the HUD named the new pattern; clear rewards itemized the full-power 1,500-point bonus; practice left stored records unchanged. A blocked supplementary GLB retained collision-matched fallback machinery and the legacy fighter visuals. Four moon/station changes stabilized at 78 geometries, 3 textures, 10 reward labels and 12 pickup labels.

Scripts, screenshots and a real-time return recording are in ignored `output/playwright/`. The recording is `return-pass.webm`. Browser progression checks use development controls where necessary to isolate UI state; they are distinct from the ordinary-shot simulation completion checks.

## Performance sample

High quality, motion enabled, 1440×900 drawing buffer at pixel ratio 1, Intel Iris Xe through ANGLE/D3D11. Each scene warmed up before collecting 300 animation-frame intervals while the game remained playing.

| Scene | Average FPS | Median / 95th / 99th percentile frame interval | Draw calls | Triangles |
|---|---:|---|---:|---:|
| Station docking canyon | 76.7 | 10.0 / 20.1 / 39.8 ms | 64 | 49,540 |
| Lunar fortress | 77.9 | 10.0 / 20.1 / 30.0 ms | 64 | 43,631 |
| Nesis assault | 79.7 | 10.0 / 20.1 / 30.1 ms | 76 | 69,998 |

These short desktop samples with the supplementary assets and denser combat exceed the approximately 40 FPS average target, with occasional longer frames shown above. They do not establish sustained thermal performance or performance on physical phones. The existing automatic quality reduction remains available. Scenery switching can still produce initial shader-compilation stalls; the existing stall-pause safeguard prevents lost lives during a prolonged stall.

## Human acceptance still needed

Play full unprotected campaigns with all three weapons on Pilot and Rookie. Assess whether mixed formations, optional subsystem routes, one-hit lives and bounded repeat-pass escalation reward learning without producing unavoidable overlaps. Check whether clean-clear and first-pass bonuses create useful routing decisions.

Measure actual level times and deaths for new and experienced players before treating the 4–5 minute pacing and 50,000/150,000 extra-life thresholds as balanced. Review the return animation in play, especially after moving to the edges of the steering area. Test physical touch devices and longer sessions for responsiveness, thermal slowdown and sustained memory behavior. Automated completion establishes feasibility; it does not establish enjoyable difficulty.
