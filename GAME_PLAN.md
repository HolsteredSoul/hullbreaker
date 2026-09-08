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

Approaches compile once from the campaign seed into explicit wave schedules. Formation choice and mirroring vary; assault layouts and schedules remain authored. Scenery and combat use separate random streams, including a separate effects stream. First combat arrives at 0.8 seconds, with a brief recovery gap after every fifth formation. Higher levels introduce interceptors/bombers and shorten formation intervals while keeping the 18-fighter cap.

## Repeated attack passes

Reaching an assault's end with a surviving objective triggers a continuous climb, banking turn, outside return leg, second banking turn and descent onto the same entrance. Combat stops for six seconds; transient projectiles, fighters and pickups are cleared. The fighter stays visible within the viewport, then returns to its previous steering position with a protected approach and cleared input.

Target damage, destruction and core phase progress persist. Surviving defenses reset their local schedules and receive fresh entry warnings. Disabled launch bays remain disabled, including bays in earlier segments that own finale reinforcements. Destruction and clear rewards are awarded once.

Every extra pass raises bullet speed by 4% and reduces firing intervals by 8%, capped after three increments: 112% speed and 76% interval relative to the selected difficulty. Entry warnings remain 1.3 seconds and battery aim lock remains 0.35 seconds. The camera follows the actual world-space flight path; position, heading, pitch and bank agree, and the battlefield remains fixed. The final coordinate rebase preserves its projected position. Reduced motion uses a fade instead of the camera maneuver.

## Lives, score and mastery

Start with three lives, a level-one selected weapon and two pulses. One unprotected hit destroys the fighter. A replacement arrives after one second with 2.5 seconds of invulnerability, one weapon-level downgrade (minimum one) and at least two pulses. Combat continues during the replacement interval. The final death ends the run.

Supply and score carry between levels. Level clear gives one weapon upgrade, one pulse (cap three), 5,000 points plus 500 per surviving life, 3,000 for no deaths, and 1,500 for a first-pass clear. An upgrade at full power gives another 1,000 points. Extra lives at 50,000 and 150,000 points are awarded once each per run.

Clear rank: S for no deaths and a first-pass finish; A for at most one death and two passes; B for at most two deaths; otherwise C. Kill chains expire after three seconds, reset on damage and score up to ×4. Every tenth projectile kill drops a weapon pickup. Pilot uses normal fire; Rookie retains 80% hostile shot speed and 125% firing intervals. All three loadouts are available from the start.

Reached levels and segments unlock practice. Practice starts with fresh supplies and intact defenses, does not award campaign unlocks or records, and retries the same seed. Campaign runs remain session-based; settings, best campaign scores, best ranks and practice unlocks persist locally.

## Presentation and controls

Preserve the 60-degree perspective, fixed combat-space bounds, keyboard precision movement and relative multitouch drag plus pulse. Space has no contact-shadow surface. Ships, stations and moons supply mounting and shadow surfaces. Scenery scrolls under the fighter; only explicit warned hazard lanes cause environmental damage. Decorative walls and rocks are not invisible collision volumes.

Modular scenery creates distinct cruisers, carriers, station structures and moon installations. The existing Nesis GLB remains the flagship; shared combat art remains reusable. Incoming scenery is previewed and reused at the transition. Outgoing scenery retires and is disposed; late GLB responses cannot attach to retired environments.

Around 40 FPS remains the baseline target, with 60 aspirational. Visual quality reduces resolution and decorative effects without changing combat. Human pacing/difficulty review and physical-device performance remain acceptance work; automated protected-pilot tests establish weapon feasibility rather than human mastery.
