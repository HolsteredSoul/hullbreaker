# Hullbreaker — implemented campaign direction

The level is a journey through several battlefields. A capital ship or installation is an assault encounter within that journey. Reusable combat operates independently of scenery; the older Raiden supplies pacing, formation variety, weapon growth and arcade reward ideas.

## Five playable levels

| Level | Approach | Final assault |
|---|---|---|
| Carrier Screen | Space screen, wreckage interception, cruiser flyover | Carrier command bridge; two bays own reinforcements |
| Station Breach | Space approach, picket cruiser, docking canyons | Two shield feeders must be destroyed before the defense hub |
| Lunar Battery | Orbital screen, crater fields, fortified trench | Missile-command bunker; radar and silo destruction reduce its attacks |
| Fleet Anchorage | Space interception, cruiser, supply carrier, station docks | Both command nodes; earlier docks own later reinforcements |
| Nesis | Fleet screen, lunar relay, station gateway | Three-phase flagship core; bays, fire control and coolant retain consequences |

Each level has 240 seconds of authored first-pass route content. A skilled player can destroy the final objective before the route ends. Further passes extend the encounter by its assault duration plus a six-second maneuver. There is no campaign jump-drive timeout.

Approaches compile once from the campaign seed into explicit wave schedules. Formation choice and mirroring vary; assault layouts and schedules remain authored. Scenery and combat use separate random streams. First combat arrives at 0.8 seconds. Squads combine double vees, pincers, sweeping columns, crossing gunships, bomber walls and supply escorts. Brief gaps follow every sixth formation. Campaign populations cap at 30; legacy missions retain their original cap of 18.

Scouts alternate aimed and fan volleys; gunships can hold position and fire five-shot fans; bombers launch paired missiles; interceptors lock a warned charge. Hostile shot speed and formation/firing cadence increase through the levels. Target entry warnings and 0.35-second aim locks remain intact. Pilot is intended for active dodging and target prioritization; Rookie slows shots and firing cadence.

## Repeated attack passes

Reaching an assault's end with a surviving objective triggers a continuous climb, banking turn, outside return leg, second banking turn and descent onto the same entrance. Combat stops for six seconds; transient projectiles, fighters and pickups are cleared. The fighter stays visible within the viewport, then returns to its previous steering position with a protected approach and cleared input.

Target damage, destruction and core phase progress persist. Surviving defenses reset their local schedules and receive fresh entry warnings. Disabled launch bays remain disabled, including bays in earlier segments that own finale reinforcements. Destruction and clear rewards are awarded once.

Every extra pass raises bullet speed by 4% and reduces firing intervals by 8%, capped after three increments: 112% speed and 76% interval relative to the selected difficulty. Entry warnings remain 1.3 seconds and battery aim lock remains 0.35 seconds. The camera follows the actual world-space flight path; position, heading, pitch and bank agree, and the battlefield remains fixed. The final coordinate rebase preserves its projected position. Reduced motion uses a fade instead of the camera maneuver.

## Lives, score and mastery

Start with three lives, a level-one selected weapon and two pulses. One unprotected hit destroys the fighter. A replacement arrives after one second with 2.5 seconds of invulnerability, one weapon-level downgrade (minimum one) and at least two pulses. Combat continues during the replacement interval. The final death ends the run.

Supply and score carry between levels. Level clear gives one weapon upgrade, one pulse (cap three), 5,000 points plus 500 per surviving life, 3,000 for no deaths, and 1,500 for a first-pass clear. An upgrade at full power gives another 1,500 points. The clear screen itemizes the award. Extra lives at 50,000 and 150,000 points are awarded once each per run.

Clear rank: S for no deaths and a first-pass finish; A for at most one death and two passes; B for at most two deaths; otherwise C. Kill chains expire after three seconds, reset on damage and score up to ×4. Destroying an entire authored squad earns 400–800 points once; escapes, terrain crashes and incomplete spawns cancel that squad bonus. Enemy classes have different kill values.

Supply craft carry alternating power/pulse rewards; bays drop power. A power cell also drops after 18 kills without a supply-craft power award. Cells move toward the player at a reachable speed and attract within 3.2 units. Green P upgrades the selected weapon and gives 500 points, or 1,500 at maximum power. Amber B restores a pulse and gives 250 points, or 1,000 when pulses are full. Collection is once-only. Pulse kills use the same kill accounting as normal fire.

Vulcan tiers fire 3/5/7 streams with increasing spread and cadence. Lance tiers fire 1/2/3 thicker parallel beams; higher tiers pierce additional fighters once each. Seeker tiers launch 2/4/6 missiles and split their target locks. Piercing weapons still stop at solid terrain. The HUD shows the current tier and firing pattern.

Reached levels and segments unlock practice. Practice starts with fresh supplies and intact defenses, does not award campaign unlocks or records, and retries the same seed. Campaign runs remain session-based; settings, best campaign scores, best ranks and practice unlocks persist locally.

## Presentation and controls

Preserve the 60-degree perspective, fixed combat-space bounds, keyboard precision movement and relative multitouch drag plus pulse. Space has no contact-shadow surface. Ships, stations and moons supply mounting and shadow surfaces. Solid hull components, machinery and wreckage have collision volumes matching the shared scenery layout or Blender source bounds. Ships and both sides' projectiles collide with them; surfaces below flight altitude can be overflown. Marked wreckage is destructible and remains cleared on return passes. Distant cosmetic fragments stay below and outside the flight corridor. Explicit timed hazard lanes remain warned.

Modular scenery creates distinct cruisers, carriers, station structures and moon installations. Blender supplies seven additional assets: bridge, pylon, refinery, radar, wreck, gunship and supply craft. The existing Nesis GLB remains the flagship. Incoming scenery is previewed and reused at the transition. Outgoing scenery retires and is disposed; late GLB responses cannot attach to retired environments.

Around 40 FPS remains the baseline target, with 60 aspirational. Visual quality reduces resolution and decorative effects without changing combat. Human pacing/difficulty review and physical-device performance remain acceptance work; automated protected-pilot tests establish weapon feasibility rather than human mastery.
