# Nesis gameplay phase — September 2026

**Historical v3 record.** The six-minute pacing was rejected in playtesting. [PACING_REVISION.md](PACING_REVISION.md) describes the current build. Values and measurements below belong to that earlier version.

Implemented on top of the approved arcade art. The former 90-second prototype is now a six-sector mission with a six-minute jump deadline. Strong core-focused runs can finish around five minutes. It remains a single Nesis mission; deep space, stations, moon bases and nebulae are subsequent content.

## Encounter sequence

| Time | Section | Play |
|---|---|---|
| 0:00–0:35 | Engine wake | Scout formations and alternating exhaust lanes |
| 0:35–1:45 | Hangar trench | Two destroyable launch bays; interceptor pairs join the screen |
| 1:45–2:35 | Forward batteries | Port/starboard aimed bursts, reachable control links, central fire controller |
| 2:35–3:20 | Broken armour | Telegraphing salvage lanes, fast interceptors and optional coolant pump |
| 3:20–4:10 | Command approach | A second battery pair, bombers with twin destructible missiles, mixed escorts |
| 4:10–6:00 | Jump core | Three damage phases: broad aimed fan, tighter fan, then mixed missile salvos |

Five support windows at 0:31, 1:39, 2:30, 3:16 and 4:05 restore one hull segment and one pulse, capped at three pulses. They clear hostile projectiles and delay surviving guns and fighters' next attacks. Wave patterns are authored explicitly and the route uses interpolated distance keyframes. Enemy population is capped at 18 during play; the underlying pools still support stress testing.

## Combat consequences

- **Bays:** destruction permanently cancels that bay's local launches and its finale reinforcements. Independent patrol waves continue. Launching fighters rise from the bay with 0.7 seconds of collision protection.
- **Side batteries:** four actual gun mounts aim toward the player. A line warns for 1.2 seconds; aim locks in the last 0.35 seconds. Each fires three rounds 0.18 seconds apart, with port/starboard schedules staggered. Destroy the amber link at x ±7.2 to disable its physical gun at x ±11.1. Shots leave the rotated muzzle and enter the combat plane over 0.35 seconds before becoming harmful.
- **Fire controller:** destruction cuts surviving batteries to one shot and increases their interval by 50%; it also reduces the core fan's projectile count.
- **Coolant:** destruction increases core exposure from five to seven seconds in each nine-second cycle.
- **Core:** 360 health split into three 120-health phases. Shields reject damage, phase boundaries prevent damage spilling into the next phase, and two-second transitions clear hostile shots. A visible shield cage and HUD state distinguish protected/exposed periods.

Pilot starts at four hull. Rookie starts at five, reduces hostile projectile speed to 80%, and increases gun/enemy firing intervals to 125%. Three loadouts remain available; Space provides 55% keyboard movement speed for precision. Relative touch controls, pulse, pause, reduced motion and automatic quality remain available. The hit marker stays visible while the fighter flashes during invulnerability.

Reached sectors unlock practice starts. Practice uses fresh supplies and intact systems, skips elapsed encounter/recovery events and cannot update full-sortie scores. Scores are stored separately for each mission and difficulty. It is a checkpoint exercise, not a saved combat-state continuation.

## Art integration

`assets/blender/nesis-assault-v3.blend` derives from the approved v2 hull. Its baked side guns have been removed; runtime combat-library turrets occupy the retained sponsons. Nine validated target sockets now include four physical battery mounts and coolant. The v2 source and GLB remain preserved. The shared combat pack is unchanged, reusing turret/core geometry for batteries/coolant.

| Runtime package | Bytes | Triangles | Mesh batches |
|---|---:|---:|---:|
| nesis-assault-v3.glb | 3,231,444 | 31,536 | 27 |
| combat-arcade-v2.glb | 1,875,084 | 15,644 | 27 |
| Combined | 5,106,528 | | |

Both packages retain embedded baked AO and independent procedural fallbacks. Export reads saved editable Blender sources and never overwrites them. Target `x`/`y` remain combat coordinates; optional `mountX`/`mountY` define the physical socket. This separation supports later stations and larger ships without widening the player's movement bounds.

## Verification

Twenty Node tests cover original-slice regressions and the expanded route, shields/phase transitions, all-weapon completion, battery aim lock/volleys/origins/cancellation, bay consequences, supplies, hazard warnings, launch protection, pooled projectile reset, difficulty, precision movement, timeout and clean restart. Both fully weakened and initially intact-system core encounters complete with every weapon in damage-throughput checks. Those checks protect the test pilot from damage; they establish timing feasibility, not human difficulty balance.

Desktop Chrome browser checks covered all six sectors, both bay views, core protected/exposed states, three-phase victory, retry, pause/resume, difficulty selection, unlocked practice starts, firing and destroyed batteries, low quality, reduced motion and each GLB package failing independently. There were no uncaught page errors; intentionally aborted asset loads produced expected network errors and fallback warnings.

Mobile layout checked at 390×844; landscape menu checked at 844×390. Chrome touch-event injection verified relative drag with a simultaneous second-finger pulse, followed by continued first-finger steering. This does not establish behavior or performance on physical Android/iOS devices.

Screenshots and reproducible browser scripts are under ignored `output/playwright/`: `verify-assault.js`, `verify-assault-touch.js`, `profile-assault.js`, `assault-verification.txt`, `assault-touch.txt`, `assault-profile.txt` and `assault-*.png`.

### Frame-time sample

Windows desktop, Chrome 152, Intel Iris Xe through ANGLE/Direct3D11; viewport and drawing buffer 1440×900, pixel ratio 1, High quality, reduced motion off. Two 359-frame samples after warm-up:

| Scene | Median | p95 | p99 | Draw calls | Triangles |
|---|---:|---:|---:|---:|---:|
| Active battery-sector combat | 19.9 ms | 30.2 ms | 50.0 ms | 71 | 69,058 |
| Rendering stress | 19.9 ms | 40.0 ms | 50.1 ms | 73 | 144,974 |

Stress holds 40 fighters, 200 hostile projectiles, 80 friendly projectiles and 300 sparks constant with simulation paused; it measures rendering load. The combat sample runs the simulation. Median is roughly 50 FPS; occasional slower frames remain. These short desktop samples are not sustained thermal or physical-phone results.

## Next

Human playtesting should refine enemy density, warnings, weapon feel and rewards without padding the route. Then add a deep-space sortie with its own objective and mission selection, followed by station assaults. Moon bases and nebulae should introduce their own navigation and visibility mechanics in later passes. Physical-device testing and release hardening remain outstanding; no deployment or additional environment was part of this phase.
