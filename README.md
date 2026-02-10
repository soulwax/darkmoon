# Darkmoon

A browser-based action roguelike inspired by Vampire Survivors, built with TypeScript, HTML5 Canvas, and Vite.

Survive endless waves of enemies, collect XP, level up your weapons, and see how long you can last under the dark moon.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Add `?autostart=1` to skip the start screen.

## How to Play

| Input       | Action                          |
| ----------- | ------------------------------- |
| **WASD** | Move |
| **Space** | Longsword attack (manual) |
| **Shift** | Dash (brief burst of speed) |
| **Escape** | Pause |
| **M** | Toggle minimap |
| **1-3** | Select upgrade on level up |

Weapons auto-fire when enemies are in range (except the Longsword, which is manually triggered). Survive as long as possible, collect XP gems, and choose upgrades each level.

## Features

### Combat

- **5 weapons** with distinct mechanics: melee swings, orbiting shields, homing missiles, AoE lightning, and manual longsword strikes
- **Knockback physics** with squash/stretch hit reactions
- **Damage numbers** floating from every hit
- **Particle effects** for explosions, XP collection, lightning, and sword slashes

### Enemies

| Type | HP | Speed | Behaviour |
|------|----|-------|-----------|
| Slime | 22 | Slow | Sprite-animated, XP fodder |
| Skeleton | 30 | Medium | Sprite-animated, balanced threat |
| Basic | 26 | Medium | Standard chaser |
| Fast | 18 | High | Fragile but hard to outrun |
| Tank | 70 | Slow | Absorbs punishment |
| Elite | 90 | Medium | Late-game powerhouse |

Enemies unlock progressively through wave-based difficulty scaling. Waves advance every 30 seconds with increasing spawn rates and tougher enemies.

### Weapons

| Weapon | Type | Mechanic |
|--------|------|----------|
| Sword | Auto melee | Arc slash with knockback, targets nearest enemy |
| Longsword | Manual melee | Directional vertical slash (Space key), high damage |
| Magic Orbs | Passive | Rotating orbs dealing contact damage |
| Magic Missiles | Auto ranged | Homing projectiles with piercing |
| Lightning Strike | Auto AoE | Random area strikes with branching bolts |

All weapons level up through the upgrade system (max level 8), gaining damage, range, projectile count, and reduced cooldowns.

### Progression

- Collect XP gems from defeated enemies (color-coded by value)
- Choose from 3 random upgrades at each level-up: new weapons, weapon levels, or stat boosts
- **6 stat upgrades**: Swift Feet, Vitality, Magnetism, Power, Armor, Lucky Star
- **7 power-up pickups** drop from enemies: Heal, Shield, Haste, Rage, Magnet, XP Boost, Bomb

### World

- 1600x1600 procedurally generated tilemap (100x100 tiles)
- Grass terrain with water ponds, dirt paths, and scattered decorations
- Flowers, mushrooms, rocks, and other environmental details
- Camera with smooth follow, world bounds, and shake effects
- Minimap showing enemies, gems, and player position

## Architecture

TypeScript with a lightweight Entity-Component System, event-driven communication, and scene management.

```
src/
├── main.ts                  # Entry point, Application class
├── Game.ts                  # Main game orchestrator
├── core/                    # Engine fundamentals
│   ├── EventBus.ts          # Pub/sub event system
│   ├── GameLoop.ts          # Fixed timestep (60 FPS) with interpolation
│   └── Math.ts              # Vector2, easing, utilities
├── assets/                  # Asset pipeline
│   ├── AssetLoader.ts       # Image + YAML loading
│   ├── SpriteSheet.ts       # Sprite animation definitions
│   └── AssetManifest.ts     # Asset registry
├── config/                  # Configuration
│   ├── ConfigLoader.ts      # YAML config loading
│   └── GameConfig.ts        # Typed config with defaults
├── graphics/                # Rendering
│   ├── Camera.ts            # Follow, zoom, shake, world bounds
│   ├── Renderer.ts          # Canvas wrapper
│   ├── AnimatedSprite.ts    # Frame-based animation
│   └── TileMap.ts           # Layered tile rendering with culling
├── input/
│   └── InputManager.ts      # Keyboard/mouse + configurable bindings
├── ecs/                     # Entity-Component System
│   ├── Entity.ts            # Transform, velocity, tags, hierarchy
│   ├── Component.ts         # Base with lifecycle hooks
│   └── components/
│       ├── AnimatorComponent.ts
│       ├── ColliderComponent.ts
│       ├── HealthComponent.ts
│       ├── MovementComponent.ts
│       └── SpriteComponent.ts
├── entities/
│   ├── Player.ts            # Stats, weapons, buffs, dash, animations
│   ├── Enemy.ts             # 6 types with knockback and sprites
│   ├── XPGem.ts             # Magnetic collection, value-based visuals
│   ├── Projectile.ts        # Homing, piercing, trails
│   └── PowerUpPickup.ts     # 7 pickup types with timed effects
├── systems/
│   ├── SpawnSystem.ts       # Wave difficulty, weighted enemy selection
│   ├── ParticleSystem.ts    # Explosions, sparks, damage numbers
│   └── UpgradeSystem.ts     # Weapon + stat upgrade generation
├── weapons/
│   ├── Weapon.ts            # Base class with leveling
│   ├── Sword.ts             # Auto melee with arc animation
│   ├── Longsword.ts         # Manual directional slash
│   ├── MagicOrbs.ts         # Orbital contact damage
│   ├── MagicMissiles.ts     # Homing multi-target projectiles
│   └── LightningStrike.ts   # AoE with branching bolt visuals
├── scenes/
│   ├── Scene.ts             # Base with enter/exit lifecycle
│   ├── SceneManager.ts      # Scene stack management
│   └── GameScene.ts         # Main gameplay, world gen, collision
├── ui/
│   ├── HUD.ts               # Health, XP, level, time, kills, buffs
│   ├── LevelUpScreen.ts     # Upgrade selection modal
│   └── Minimap.ts           # 150x150 overview with entity markers
└── types/
    └── js-yaml.d.ts
```

### Key Patterns

- **Event-driven**: `EventBus` decouples systems via `GameEvents` constants
- **ECS**: Entity/Component base classes with tags and hierarchy
- **Scene management**: SceneManager with enter/exit lifecycle
- **Fixed timestep**: 60 FPS target with delta time interpolation
- **YAML config**: All game settings loaded from `game.yaml`

## Configuration

Game settings live in `Resources/game.yaml`:

- **World**: tile size (16px), grid (100x100), total size (1600x1600)
- **Player**: speed, dash, health, pickup range
- **Camera**: follow smoothing (0.15), bounds, shake
- **Collision layers**: world (1), player (2), enemies (4), items (8), projectiles (16)
- **Input**: customizable keybindings
- **Particles**: max count, system settings

## Development

### Prerequisites

- Node.js 18+
- npm

### Scripts

```bash
npm run dev        # Dev server with hot reload
npm run build      # Production build to dist/
npm run preview    # Preview production build
npm run typecheck  # TypeScript type checking
```

### Asset Paths

Assets in `Resources/` are served by Vite's publicDir at root:

```typescript
// Correct — served from publicDir
"/SpiteSheets/characters/player.yaml"

// Wrong — includes the source directory
"Resources/SpiteSheets/characters/player.yaml"
```

### Resources

The `Resources/` directory contains:

- `SpiteSheets/` — Character and tile sprites with YAML animation definitions
- `game.yaml` — Main game configuration
- `shaders/` — GLSL vertex/fragment shaders (for Runa2 engine companion)

## Tech Stack

- **Language**: TypeScript
- **Build**: Vite 5
- **Rendering**: HTML5 Canvas 2D
- **Config**: js-yaml for YAML parsing
- **No frameworks** — vanilla TypeScript with custom ECS

## Roadmap

See [TODO.md](TODO.md) for the full development roadmap, organized in 7 phases:

1. **The Polish** — Audio, menus, game feel, cleanup
2. **The Bestiary** — Smart enemies, new behaviors, bosses
3. **The Arsenal** — New weapons, synergies, evolutions
4. **The World** — Biomes, procedural dungeons, interactables, hazards
5. **The Meta** — Persistent progression, characters, achievements
6. **The Atmosphere** — Day/night, lighting, weather, screen effects
7. **The Community** — Seeded runs, leaderboards, modding

## Tips

1. **Keep moving** — standing still is death
2. **Longsword for burst** — Space key for big hits on tough enemies
3. **Balance offense and defense** — speed saves lives
4. **Watch the minimap** — see threats before they reach you
5. **Chain knockbacks** — sword pushes enemies into orbs and lightning

## License

GPL-3.0-only — See [LICENSE](LICENSE.md)

---

**Survive the Darkmoon.**
