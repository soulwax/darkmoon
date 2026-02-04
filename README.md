# Darkmoon - Vampire Survivors Prototype

A browser-based vampire survivors-like game prototype built with HTML5 Canvas and JavaScript.

## 🎮 How to Play

1. Open `index.html` in a web browser
2. Click "Start Game" to begin
3. Use **WASD** keys to move your character
4. Survive as long as possible!

## 🎯 Game Mechanics

### Core Gameplay

- **Movement**: Use WASD keys for 8-directional movement
- **Auto-Attacking**: Weapons automatically attack nearby enemies
- **Survival**: Stay alive as long as possible while enemies spawn in increasing waves
- **Progression**: Collect XP gems from defeated enemies to level up

### Weapons

1. **Magic Orbs** - Orbs that rotate around the player, damaging enemies on contact
2. **Magic Missiles** - Auto-targeting projectiles that shoot at the nearest enemy
3. **Lightning Strike** - Area-of-effect attacks that strike random enemies

### Enemy Types

- **Basic (Red)**: Standard enemy with balanced stats
- **Fast (Green)**: Quick but fragile enemies
- **Tank (Blue)**: Slow but very durable enemies
- **Elite (Purple)**: Powerful enemies with high health and damage

### Upgrades

When you level up, choose from 3 random upgrades:

- **New Weapons**: Unlock Magic Orbs, Magic Missiles, or Lightning Strike
- **Weapon Upgrades**: Increase damage, count, and effectiveness of existing weapons
- **Stat Boosts**:
  - Speed Boost (+15% movement speed)
  - Max Health (+20% maximum health)
  - Pickup Range (+25% XP collection range)
  - Damage Boost (+10% to all weapons)

## 🎨 Features

- **Dynamic Difficulty**: Enemy spawn rate and variety increase over time
- **Visual Effects**: Particle explosions, damage numbers, and visual feedback
- **Magnetic XP**: XP gems are attracted to the player when in range
- **Invulnerability Frames**: Brief invulnerability after taking damage
- **Progressive Waves**: Enemies get stronger and more numerous as time passes

## 🛠️ Technical Details

### File Structure

```shell
├── index.html          # Main HTML file
├── style.css           # Game styling and UI
├── game.js             # Core game loop and management
├── player.js           # Player character logic
├── enemy.js            # Enemy AI and spawning system
├── weapon.js           # Weapon systems (Orbs, Projectiles, Area)
├── particle.js         # Particle effects and XP gems
├── ui.js               # UI management and upgrade system
└── README.md           # This file
```

### Technologies Used

- HTML5 Canvas for rendering
- Vanilla JavaScript (ES6+)
- CSS3 for UI styling

## 🎯 Game Tips

1. **Keep Moving**: Standing still makes you an easy target
2. **Prioritize Upgrades**: Get at least one weapon early, then focus on damage/speed
3. **Watch Your Health**: The health bar is in the top-left corner
4. **Collect XP Quickly**: XP gems disappear if left too long
5. **Balance Your Build**: Mix offensive weapons with defensive stat upgrades

## 🚀 Future Enhancements

Potential features for future versions:

- More weapon types and combinations
- Boss enemies at specific time intervals
- Power-ups and temporary buffs
- Multiple character classes
- Sound effects and music
- Persistent high scores
- More enemy varieties
- Environmental hazards

## 📝 Credits

Created as a Vampire Survivors-inspired prototype for the Darkmoon game project.

## 🎮 Controls Summary

| Key | Action |
| ----- | -------- |
| W | Move Up |
| A | Move Left |
| S | Move Down |
| D | Move Right |
| Mouse | Click to select upgrades |

---

**Enjoy the game and see how long you can survive!** 🧛‍♂️

License: GPL-3.0-only see: [LICENSE](LICENSE.md)
