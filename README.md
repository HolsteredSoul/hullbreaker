# Raiden: Hullbreaker — arcade campaign

A five-level 3D arcade campaign for keyboard and touch. Fight through deep space, wreckage, capital-ship flyovers, station canyons and lunar fortifications. Major installations allow repeated attack passes with an animated breakaway and re-approach. Damage and disabled defenses persist.

Run `npm install`, then `npm run dev -- --port 5187 --strictPort` and open **http://127.0.0.1:5187**. `npm test`, `npm run build` and `npm run asset:verify` validate the simulation, production bundle and existing Blender packages.

- **Move:** WASD / arrows or relative touch drag. Weapons fire automatically. Space gives precision steering; Shift / PULSE clears danger; Escape pauses.
- **Campaign:** three lives, one hit per fighter, protected respawns and weapon downgrades on death. Weapons, pulses, score and surviving lives carry between levels. The last death ends the run.
- **Progression:** Carrier Screen → Station Breach → Lunar Battery → Fleet Anchorage → Nesis. Each route has about four minutes of first-pass content; strong clears can finish sooner and return passes extend a level.
- **Mastery:** clean clears and first-pass finishes earn bonuses and ranks. Extra lives arrive at 50,000 and 150,000 points, once each. Return passes raise surviving defenses' pressure up to a fixed cap without shortening warnings.
- **Replay:** seeded approaches vary formations and scenery. Major assaults remain authored. Reached routes unlock practice, which does not affect campaign records. Choose Pilot or Rookie's slower fire.

Settings, campaign scores, ranks and practice unlocks save locally. A live campaign lasts for the current session. Older Nesis scores are retained separately. New scenery uses reusable geometry modules; Nesis and the shared combat library keep their editable Blender sources and independent loading fallbacks.

See [GAME_PLAN.md](GAME_PLAN.md) for the implemented design, [DEVELOPMENT.md](DEVELOPMENT.md) for extension contracts, and [CAMPAIGN_VERIFICATION.md](CAMPAIGN_VERIFICATION.md) for verification and remaining human/device checks. [PACING_REVISION.md](PACING_REVISION.md), [GAMEPLAY_PHASE.md](GAMEPLAY_PHASE.md) and [ART_SLICE.md](ART_SLICE.md) record earlier Nesis milestones.

The [public site](https://holsteredsoul.github.io/hullbreaker/) is published by GitHub Actions when changes are pushed to main. This local campaign implementation has not been published by this task.

The older game below remains preserved in `Raiden_Enhanced.html` as a gameplay reference.

---
# Voxel Raiden V13: Nemesis - Enhanced Edition

## 🎮 What's New

### 🐛 Bug Fixes
- ✅ **Fixed boss positioning** - Boss no longer goes off-screen on mobile devices
- ✅ **Fixed touch controls** - Proper coordinate scaling for different screen sizes
- ✅ **Fixed enemy boundaries** - Enemies now stay within screen bounds
- ✅ **Fixed audio throttling** - Better audio feedback during intense action
- ✅ **Fixed shadow system** - Consistent shadow rendering for all objects

### ⭐ New Features

#### Controls & UX
- **Pause System** - Press ESC to pause/resume the game
- **Mute Toggle** - Press M or click the speaker icon to mute/unmute
- **High Score Persistence** - Your best score is saved automatically
- **Max Combo Tracking** - See your highest combo on the game over screen

#### Gameplay Improvements
- **Boss Entrance** - Dramatic "WARNING" sequence before boss fights
- **Boss Rewards** - Boss drops 3 powerups after defeat
- **Wave Clear Bonus** - Earn bonus points for defeating the boss
- **Combo Break Notification** - "COMBO LOST!" warning when combo expires
- **Infinite Waves** - Game continues with random enemy spawns after beating boss
- **Powerup Drops** - 8% chance for enemies to drop weapon powerups
- **Low Health Warning** - Screen pulses red when at 1 HP

#### Visual Enhancements
- **Bullet Trails** - All player shots leave colorful trails
- **Screen Freeze** - 0.3s freeze frame on boss destruction for impact
- **Pulsing Powerups** - Powerups have a breathing animation
- **Better Explosions** - Enhanced particle effects
- **Improved UI** - High score display always visible

### ⚖️ Balance Changes

#### Player Buffs
- Start with **3 bombs** instead of 2
- **Weapon level preserved on hit** (only reset on death)
- Combo timer increased to **3.5 seconds** (was 2s)
- Max combo multiplier increased to **10x** (was 5x)

#### Enemy Adjustments
- **Scout fire rate**: 1.5% (was 0.5%) - 3x more threatening
- **Heavy fire rate**: 4% (was 2%) - 2x more threatening  
- **Interceptor**: Added dash attack warning system
- **Boss**: Slightly constrained movement for fairness

#### Weapon Tweaks
- **Blue Laser**: Pierce reduced to 3 at level 2 (was unlimited), size 2.5 at max
- **Green Homing**: Now fires 5 missiles at level 3 (was 4)

### 🎆 Enhanced Juice
- Screen shake variations
- Combo size scales with combo count
- Boss name shake animation
- Warning sound effects
- Combo break sound
- Wave clear fanfare
- Low health heartbeat effect

## 🕹️ How to Play

### Controls
- **WASD / Arrow Keys** - Move ship
- **SPACE** - Fire weapons
- **SHIFT / Bomb Button** - Use bomb (clears screen)
- **ESC** - Pause/Resume
- **M** - Toggle mute

### Weapons
- **RED (Vulcan)** - Wide spread shot, great for crowds
- **BLUE (Laser)** - Penetrating beam, great for lines
- **GREEN (Homing)** - Lock-on missiles, great for dodging

### Tips
- Keep your combo going for massive score multipliers!
- Don't lose weapon levels - they only reset on death now
- Save bombs for emergencies or boss phases
- Powerups give you a bomb and upgrade your current weapon
- Boss fights drop 3 powerups - collect them all!

## 📊 Scoring
- Scout: 100 points
- Interceptor: 200 points  
- Heavy: 300 points
- Boss: 5,000 points
- Boss Clear Bonus: 10,000+ (scales with completions)
- Combo Multiplier: Up to 10x
- Powerup Collection: 500-1000 points

## 🏆 High Score
Your best score is automatically saved in your browser!

## 🎨 Technical Improvements
- Organized code with CONFIG object
- Better particle system with trails
- Improved collision detection
- Smoother animations
- Better performance

---

**Version**: V13: Nemesis  
**Release Date**: 2025  
**Original**: Voxel Raiden V12: Hyperion  

Enjoy the enhanced arcade experience! 🚀
