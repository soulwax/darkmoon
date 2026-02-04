# Darkmoon

A browser-based action roguelike game inspired by Vampire Survivors, built with HTML5 Canvas and modern JavaScript.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## How to Play

- **WASD** - Move your character
- **Space** - Dash (brief invulnerability)
- **ESC** - Pause game
- **1-3** - Quick select upgrades on level up

Weapons attack automatically when enemies are in range. Survive as long as possible!

## Features

### Combat System

- **Melee Combat**: Sword weapon with swing animation and knockback physics
- **Magic Weapons**: Orbs, missiles, and lightning for ranged damage
- **Knockback Physics**: Hit enemies and watch them fly back with satisfying physics
- **Damage Numbers**: Visual feedback for every hit

### Enemies

| Type | Description |
| ------ | ------------- |
| Slime | Slow, bouncy enemies - great XP fodder |
| Skeleton | Animated skeletal warriors with moderate stats |
| Basic | Standard balanced enemies |
| Fast | Quick but fragile |
| Tank | Slow and heavily armored |
| Elite | Powerful late-game threats |

### Progression

- Collect XP gems from defeated enemies
- Level up to choose from random upgrades
- Unlock new weapons or upgrade existing ones
- Boost stats like speed, health, damage, and pickup range

### Weapons

| Weapon | Type | Description |
| -------- | ------ | ------------- |
| Sword | Melee | Sweeping arc attack with knockback |
| Magic Orbs | Passive | Rotating damage field |
| Magic Missiles | Ranged | Auto-targeting projectiles |
| Lightning Strike | AoE | Random area lightning |

## Architecture

The game uses a modern ES6 module architecture with Vite as the build tool.

```shell
src/
├── main.js              # Application entry point
├── Game.js              # Main game orchestrator
├── core/                # Core engine systems
│   ├── EventBus.js      # Pub/sub event system
│   ├── GameLoop.js      # Fixed timestep game loop
│   └── Math.js          # Vector2 and math utilities
├── assets/              # Asset management
│   ├── AssetLoader.js   # Image and YAML loading
│   ├── SpriteSheet.js   # Sprite animation support
│   └── AssetManifest.js # Asset registry
├── graphics/            # Rendering systems
│   ├── Camera.js        # Smooth follow camera
│   ├── TileMap.js       # World tile rendering
│   └── AnimatedSprite.js
├── input/               # Input handling
│   └── InputManager.js  # Keyboard/mouse input
├── ecs/                 # Entity-Component System
│   ├── Entity.js        # Base entity class
│   └── components/      # Reusable components
├── entities/            # Game entities
│   ├── Player.js        # Player with sprites/animations
│   ├── Enemy.js         # Enemy types with knockback
│   └── XPGem.js         # Collectible experience
├── systems/             # Game systems
│   ├── SpawnSystem.js   # Enemy/XP spawning
│   └── ParticleSystem.js
├── weapons/             # Weapon implementations
│   ├── Sword.js         # Melee with knockback
│   ├── MagicOrbs.js
│   ├── MagicMissiles.js
│   └── LightningStrike.js
├── scenes/              # Scene management
│   ├── SceneManager.js
│   └── GameScene.js
├── ui/                  # User interface
│   ├── HUD.js
│   ├── Minimap.js
│   └── LevelUpScreen.js
└── config/              # Configuration
    ├── ConfigLoader.js  # YAML config loading
    └── GameConfig.js
```

## Configuration

Game settings are loaded from `Resources/game.yaml`:

- Window size, target FPS
- Player stats (speed, health, dash)
- Camera settings (follow smoothing, shake)
- World size (tile dimensions)
- Input bindings

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Scripts

```bash
npm run dev      # Development server with hot reload
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

### Path Aliases

Vite is configured with path aliases for cleaner imports:

```javascript
import { EventBus } from '@core/EventBus.js';
import { Player } from '@entities/Player.js';
```

## Resources

The `Resources/` folder contains:

- `SpriteSheets/` - Character and tile sprites with YAML definitions
- `game.yaml` - Main game configuration
- `keybindings.yaml` - Input bindings
- `shaders/` - GLSL shaders (for Runa2 engine)

## Tech Stack

- **Runtime**: Vanilla JavaScript (ES6 modules)
- **Build**: Vite 5
- **YAML**: js-yaml for configuration
- **Rendering**: HTML5 Canvas 2D

## Controls

| Input | Action |
| ------- | -------- |
| W/Up | Move up |
| A/Left | Move left |
| S/Down | Move down |
| D/Right | Move right |
| Space | Dash |
| Escape | Pause |
| M | Toggle minimap |
| 1-3 | Select upgrade |

## Tips

1. **Keep moving** - Standing still is death
2. **Get the sword early** - Knockback creates breathing room
3. **Balance offense and defense** - Speed helps you survive
4. **Watch the minimap** - See enemies before they reach you
5. **Chain knockbacks** - Sword + magic creates deadly combos

## License

GPL-3.0-only - See [LICENSE](LICENSE.md)

---

**Survive the Darkmoon!**
