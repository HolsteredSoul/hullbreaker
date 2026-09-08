# Raiden: Hullbreaker — new playable 3D slice

**[Play on mobile or desktop](https://holsteredsoul.github.io/hullbreaker/)** · [Public repository](https://github.com/HolsteredSoul/hullbreaker)

GitHub Actions tests, builds and publishes the game to GitHub Pages on each push to `main`.

Run `npm install`, then `npm run dev -- --port 5187 --strictPort` and open **http://127.0.0.1:5187**. The new `index.html` launches a six-sector capital-ship assault with a 110-second deadline with keyboard/touch controls and a 60-degree perspective camera.

Use **WASD / arrows** or **drag** to move. Weapons fire automatically. **Shift / PULSE** uses a bomb; **Space** slows keyboard movement for precision; **Escape** pauses. Destroy bays to cut reinforcements and amber inner links to silence side batteries. Disable fire control and coolant to weaken the three-phase jump core. Choose Pilot or Rookie; reaching sectors unlocks practice starts. Choose Vulcan, Lance or Seeker before launch.

The arcade art slice includes a Blender-built heavy battleship, player fighter, three enemy silhouettes, sliding bay doors, rotating targets, damage variants, missiles and six debris shapes. Editable sources are `assets/blender/nesis-assault-v3.blend` and `assets/blender/combat-arcade-v2.blend`; the earlier `hullbreaker-art-review.blend` preserves the v2 art review assembly. Both GLBs retain procedural loading/failure fallbacks. See [PACING_REVISION.md](PACING_REVISION.md) for current pacing and [GAMEPLAY_PHASE.md](GAMEPLAY_PHASE.md) for the historical gameplay phase and [ART_SLICE.md](ART_SLICE.md) for assets and measured results, [DEVELOPMENT.md](DEVELOPMENT.md) for extension contracts, and [GAME_PLAN.md](GAME_PLAN.md) for the broader design.

The original game is preserved below and in `Raiden_Enhanced.html`.

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
