# Strike pacing correction — 8 September 2026

The six-minute Nesis build stretched 45 units of hull traversal across 250 seconds. Patrols arrived seven to ten seconds apart. User playtesting rejected that pacing; the longer timer had added waiting instead of gameplay.

## Current revision

| Element | Rejected build | Strike revision |
|---|---|---|
| Core arrival | 250 seconds | 64 seconds |
| Escape deadline | 360 seconds | 110 seconds |
| Opening wake traversal | 35 seconds | 6 seconds |
| First patrol | 5 seconds | 0.8 seconds |
| Main patrol interval | 7–10 seconds | About 3 seconds |
| Player movement | 8.5 units/second | 13 units/second |
| Scout / bomber speed | 3.6 / 2.5 | 6.8 / 4.2 |
| Interceptor dive | 7 units/second | 14, after a warning |
| Core health | 360 | 225, still three phases |
| Normal shield downtime | 4 seconds | 1.2 seconds |
| Phase transition | 2 seconds | 0.75 seconds |

Crossing scout formations sweep in from the flanks and orient along their flight path. Kill chains expire after three seconds without a kill, reset on damage, and increase score up to ×4. Every tenth projectile kill drops a repair/upgrade pickup. Two support windows replace five prolonged recovery gaps. Bays, coolant and battery links have less health to match their shorter attack opportunities; their destruction still affects subsequent attacks and the finale.

The player's visual model is 18% smaller relative to the hull. Steering banks the fighter while moving rather than holding a bank merely because it is off-centre. Faster nearby debris and sparse peripheral slipstream lines provide motion reference while preserving the 60° camera. Reduced motion disables those effects. Physical hull dimensions and socket coordinates have not been re-authored in this revision; deeper scale/art changes remain a separate design decision.

The new `nesis-strike-v4` mission ID separates scores from the earlier six-minute run. Practice checkpoints use the revised sector times: 0:06, 0:30, 0:40, 0:52 and 1:04.

## Clock correction

An additional real-time check found Chrome rendering an occluded test window at roughly one frame per second. The old frame loop capped elapsed time to 0.1 seconds, making 25 wall-clock seconds advance only 2.5 simulation seconds. This was a separate source of slow motion, not evidence that the user's active browser had the same throttling condition.

The loop now preserves elapsed time using bounded 60 Hz catch-up. A frame gap exceeding 0.5 seconds pauses the sortie with a browser-stall explanation instead of silently continuing in slow motion. Resume resets the clock. Development fast-forward also resets its frame clock so deliberate QA advancement does not trigger this guard.

## Verification

- 22 Node tests pass, including immediate opening combat, crossing trajectories, chain expiry/damage reset, all-weapon boss completion and existing subsystem/collision regressions.
- Desktop/mobile browser checks pass for six revised sections, victory, retry, pause/resume, Rookie practice, battery bursts/wrecks, relative drag plus pulse, low quality, reduced motion and independent GLB failures. A deliberate 650 ms main-thread block verifies the stall guard.
- A scripted normal-speed keyboard run used 25.009 wall-clock seconds and advanced 25.017 simulation seconds. It registered 21 kills by 24 seconds, destroyed both bays and survived with two hull segments. This verifies timing and encounter activity, not human difficulty balance or fun.
- That opening sample recorded 16.7 ms median and 17.2 ms p95 across 1,427 frames in desktop Chrome on this PC. Background throttling was disabled specifically for the measurement. It is not a physical-phone or sustained thermal benchmark.
- Production build and asset verification pass. Blender sources and GLBs are unchanged from the preceding art integration; combined GLBs remain 5,106,528 bytes.

QA artifacts: `output/playwright/strike-realtime-active.txt`, `strike-verification.txt`, `strike-live-normal-speed.png`, `strike-*-mobile.png` and the corresponding scripts. `GAMEPLAY_PHASE.md` is retained as a historical record of the rejected v3 timing.

Next acceptance is a human pacing/feel review. Extra mission duration should come from additional encounters and environments, not reduced traversal speed.
