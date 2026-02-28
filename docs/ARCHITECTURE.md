# Darkmoon — Technical Architecture Reference

> Deep technical reference for AI agents, senior contributors, and onboarding engineers.
> For quick-start instructions see [`CLAUDE.md`](../CLAUDE.md) (narrative) or [`CODEX.md`](../CODEX.md) (code-first).

---

## Documentation Index

> Every AI agent working on this codebase should be aware of all documentation files.

| File | Audience | Purpose |
|------|----------|---------|
| [`CLAUDE.md`](../CLAUDE.md) | Claude / narrative agents | Conventions, patterns, gotchas, workflow in prose |
| [`CODEX.md`](../CODEX.md) | Codex / GPT agents | Machine-readable, code-first quick reference |
| [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | **This file** — all agents | Deep system-by-system technical breakdown |
| [`docs/RESOURCES.md`](./RESOURCES.md) | All agents | Asset pipeline, sprite sheets, shaders, config |
| [`TODO.md`](../TODO.md) | All agents | 7-phase development roadmap |
| [`README.md`](../README.md) | Players / contributors | Game overview, controls, feature list |

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Bootstrap & Initialization](#2-bootstrap--initialization)
3. [Game Loop](#3-game-loop)
4. [Event System](#4-event-system)
5. [Configuration System](#5-configuration-system)
6. [Asset Pipeline](#6-asset-pipeline)
7. [Entity-Component System](#7-entity-component-system)
8. [Scene Management](#8-scene-management)
9. [Input System](#9-input-system)
10. [Camera System](#10-camera-system)
11. [Tile Map System](#11-tile-map-system)
12. [Player Architecture](#12-player-architecture)
13. [Enemy Architecture](#13-enemy-architecture)
14. [Weapon System](#14-weapon-system)
15. [Spawn System](#15-spawn-system)
16. [Particle System](#16-particle-system)
17. [Upgrade System](#17-upgrade-system)
18. [Audio System](#18-audio-system)
19. [UI Architecture](#19-ui-architecture)
20. [Rendering Pipeline](#20-rendering-pipeline)
21. [Collision System](#21-collision-system)
22. [Data Flow Diagrams](#22-data-flow-diagrams)
23. [Extension Points](#23-extension-points)

---

## 1. System Overview

Darkmoon is a single-page browser game with no external runtime dependencies beyond `js-yaml`. The architecture is deliberately minimal — no React, no Pixi.js, no physics engine. Every system is hand-rolled TypeScript targeting HTML5 Canvas 2D.

### Technology Decisions

| Decision | Rationale |
|----------|-----------|
| Vanilla Canvas 2D | Full control, no abstraction overhead, pixel-perfect rendering |
| Custom ECS | Lightweight, no registry overhead, components are plain classes |
| EventBus over direct refs | Decouples systems; weapons don't need a reference to the HUD |
| Fixed timestep | Deterministic physics, reproducible gameplay, easy to pause |
| YAML config | Human-readable, version-control friendly, hot-reloadable |
| Vite | Fast HMR, native ESM, zero-config TypeScript |
| No test runner (yet) | Vitest is the intended choice when tests are added |

### Dependency Graph (simplified)

```
main.ts
  ├── Game.ts
  │     ├── core/GameLoop.ts
  │     ├── core/EventBus.ts          (singleton, imported everywhere)
  │     └── scenes/SceneManager.ts
  │           └── scenes/GameScene.ts
  │                 ├── entities/Player.ts
  │                 │     ├── ecs/components/AnimatorComponent.ts
  │                 │     ├── ecs/components/HealthComponent.ts
  │                 │     ├── ecs/components/MovementComponent.ts
  │                 │     └── ecs/components/ColliderComponent.ts
  │                 ├── entities/Enemy.ts
  │                 ├── graphics/Camera.ts
  │                 ├── graphics/TileMap.ts
  │                 ├── systems/SpawnSystem.ts
  │                 ├── systems/ParticleSystem.ts
  │                 ├── systems/UpgradeSystem.ts
  │                 ├── ui/HUD.ts
  │                 └── ui/LevelUpScreen.ts
  ├── assets/AssetLoader.ts           (singleton)
  ├── config/ConfigLoader.ts
  └── audio/AudioSystem.ts
```

---

## 2. Bootstrap & Initialization

**File**: `src/main.ts`

The `Application` class owns the top-level lifecycle. It is instantiated once on `DOMContentLoaded` and never destroyed during a session.

```
DOMContentLoaded
  └─ Application.init()
       ├─ assetLoader.setBasePath(import.meta.env.BASE_URL)
       ├─ ConfigLoader.loadGameConfig('game.yaml') → GameConfig
       ├─ assetLoader.loadManifest(CoreAssetManifest)
       │     ├─ loads all sprite sheet YAMLs + PNGs
       │     └─ loads game.yaml, keybindings.yaml, enemySpritePack.yaml
       ├─ new Game(canvas, config)
       ├─ new SceneManager(game)
       ├─ sceneManager.register('game', new GameScene(game, config, assetLoader))
       ├─ game.init({ assetLoader, sceneManager, ... })
       └─ setupUI()
            ├─ wire #startButton → startGame()
            ├─ wire #restartButton → eventBus.emit(GAME_RESTART)
            ├─ wire #pauseResumeButton → eventBus.emit(GAME_RESUME)
            ├─ subscribe GAME_OVER → showGameOver(data)
            ├─ subscribe GAME_PAUSE → showPauseOverlay()
            └─ setupAudioOptionsUI()
```

### Audio Initialization

Audio is deferred until the first user interaction (pointer/key) to comply with browser autoplay policies. `AudioSystem.unlock()` is called on the first `pointerdown` or `keydown` event via a one-time listener.

Audio preferences are persisted to `localStorage` under key `darkmoon.audio.preferences.v1` as JSON with shape `{ mode, enabled, masterVolume, musicVolume, sfxVolume }`.

### URL Parameters

| Parameter | Effect |
|-----------|--------|
| `?autostart=1` | Skips start screen, immediately starts game |

---

## 3. Game Loop

**File**: `src/core/GameLoop.ts`

### Algorithm: Semi-fixed Timestep with Interpolation

```
each RAF frame:
  deltaTime = (now - lastTime) / 1000
  deltaTime = min(deltaTime, maxDeltaTime)  // spiral-of-death cap (0.1s)

  accumulator += deltaTime

  while accumulator >= fixedDeltaTime (1/60):
    update(fixedDeltaTime)
    gameTime += fixedDeltaTime
    accumulator -= fixedDeltaTime

  alpha = accumulator / fixedDeltaTime      // interpolation factor [0,1]
  draw(alpha)
```

### Key Properties

| Property | Value | Purpose |
|----------|-------|---------|
| `targetFPS` | 60 | Fixed update rate |
| `fixedDeltaTime` | 1/60 ≈ 0.01667s | Passed to every `update()` call |
| `maxDeltaTime` | 0.1s | Prevents spiral of death on tab switch |
| `alpha` | [0, 1] | Interpolation factor for smooth rendering |

### State Machine

```
stopped ──start()──► running
running ──pause()──► paused   (RAF continues, update skipped, draw fires)
paused  ──resume()─► running  (lastTime reset to avoid time jump)
running ──stop()───► stopped  (RAF cancelled entirely)
```

### Game Time

`gameTime` accumulates only during non-paused updates. It is reset via `resetGameTime()` on game start/restart. **Always use `deltaTime` from the loop for game logic — never `Date.now()` or `performance.now()`.**

---

## 4. Event System

**File**: `src/core/EventBus.ts`

### Design

Single global singleton (`export const eventBus`). All cross-system communication goes through it. Systems never hold direct references to each other — they communicate via events.

### API

```typescript
// Subscribe — returns unsubscribe function
const unsub = eventBus.on(GameEvents.PLAYER_DIED, handler);
eventBus.once(GameEvents.GAME_START, handler);  // auto-unsubscribes after first call

// Emit
eventBus.emit(GameEvents.ENEMY_KILLED, { enemy, killer });

// Unsubscribe
unsub();                                         // via returned function
eventBus.off(GameEvents.PLAYER_DIED, handler);  // explicit

// Cleanup
eventBus.clear('player:died');  // remove all handlers for one event
eventBus.clear();               // ⚠ remove ALL handlers — only in Game.destroy()
```

### Event Payload Conventions

Event payloads are plain objects. Handlers should use optional chaining for safety since payloads may be `undefined`:

```typescript
eventBus.on(GameEvents.PLAYER_DAMAGED, (data?: { source?: Entity }) => {
    const source = data?.source;
});
```

### GameEvents Constants

All event names are defined in `GameEvents` as `as const`. This provides autocomplete, compile-time typo detection, and a single source of truth.

```typescript
export const GameEvents = {
    PLAYER_DAMAGED:      'player:damaged',
    PLAYER_HEALED:       'player:healed',
    PLAYER_DIED:         'player:died',
    PLAYER_LEVELUP:      'player:levelup',
    PLAYER_XP_GAINED:    'player:xp_gained',
    ENEMY_SPAWNED:       'enemy:spawned',
    ENEMY_DAMAGED:       'enemy:damaged',
    ENEMY_KILLED:        'enemy:killed',
    WEAPON_FIRED:        'weapon:fired',
    WEAPON_UPGRADED:     'weapon:upgraded',
    WEAPON_ACQUIRED:     'weapon:acquired',
    XP_COLLECTED:        'xp:collected',
    ITEM_COLLECTED:      'item:collected',
    POWERUP_COLLECTED:   'powerup:collected',
    GAME_START:          'game:start',
    GAME_PAUSE:          'game:pause',
    GAME_RESUME:         'game:resume',
    GAME_OVER:           'game:over',
    GAME_RESTART:        'game:restart',
    SCENE_CHANGE:        'scene:change',
    SCENE_READY:         'scene:ready',
    UI_UPGRADE_SELECTED: 'ui:upgrade_selected',
    UI_MENU_OPEN:        'ui:menu_open',
    UI_MENU_CLOSE:       'ui:menu_close',
} as const;
```

---

## 5. Configuration System

**Files**: `src/config/GameConfig.ts`, `src/config/ConfigLoader.ts`

### DefaultConfig

A large typed object literal defining all game parameters with sensible defaults. Organized into sections:

| Section | Key Fields |
|---------|-----------|
| `window` | 1280×720, fullscreen, vsync |
| `graphics` | 60 FPS target, renderScale, postProcessing |
| `world` | 100×100 tiles, 16px tileSize → 1600×1600px world |
| `player` | speed 120, maxHealth 150, dash, shield, pickupRange 50 |
| `camera` | followSmoothing 0.15, shake, world bounds |
| `physics` | top-down (no gravity), friction 0.85 |
| `input` | WASD, Space, Shift, Escape, E, M |
| `audio` | masterVolume 1.0, musicVolume 0.7, sfxVolume 0.8 |
| `debug` | showFPSCounter, showCollisionBoxes, logLevel |
| `particles` | maxParticles 1000, poolSize 500 |
| `progression` | baseXPToLevel 10, xpScaling 1.5, healthRecoveryOnLevelUp 20 |

### GameConfig Class

Wraps `DefaultConfig` with:
- **Deep merge** of user-supplied overrides (from `game.yaml`)
- **Typed getters** for each section (`config.player`, `config.world`, etc.)
- **Path-based access** via `config.get('player.speed')` → `unknown`
- **Computed helpers**: `config.worldWidth`, `config.worldHeight`

```typescript
// Deep merge preserves nested defaults when only some keys are overridden
const config = new GameConfig({ player: { speed: 200 } });
// config.player.maxHealth is still 150 (from DefaultConfig)
// config.player.speed is 200 (overridden)
```

### ConfigLoader

Fetches `game.yaml` via `fetch()`, parses with `js-yaml`, and constructs a `GameConfig`. Falls back to `new GameConfig()` (all defaults) if the fetch fails.

---

## 6. Asset Pipeline

**Files**: `src/assets/AssetLoader.ts`, `src/assets/AssetManifest.ts`, `src/assets/SpriteSheet.ts`

### Critical Path Rule

```
Vite publicDir = src/Resources/
Assets served at URL root "/"

✅ '/SpiteSheets/characters/player.yaml'
❌ '/Resources/SpiteSheets/characters/player.yaml'
```

### AssetLoader

Singleton (`assetLoader`). Manages:
- **Image loading**: `HTMLImageElement` cache keyed by URL
- **YAML loading**: parsed objects cache keyed by URL
- **SpriteSheet loading**: YAML → `SpriteSheet` instance cache
- **Base path**: set via `setBasePath(import.meta.env.BASE_URL)` for `./` production builds
- **Manifest loading**: `loadManifest(manifest)` loads all entries in parallel

```typescript
// Load a manifest (parallel)
await assetLoader.loadManifest(CoreAssetManifest);

// Retrieve loaded assets
const sheet = assetLoader.getSpriteSheet('player');   // SpriteSheet | null
const img   = assetLoader.getImage('enemySheetBasic'); // HTMLImageElement | null
const yaml  = assetLoader.getYaml('gameConfig');       // unknown
```

### CoreAssetManifest

The canonical asset list used at startup. Defined in `src/assets/AssetManifest.ts`:

```typescript
export const CoreAssetManifest: AssetManifest = {
    spriteSheets: {
        'player':    '/SpiteSheets/characters/player.yaml',
        'skeleton':  '/SpiteSheets/characters/skeleton.yaml',
        'slime':     '/SpiteSheets/characters/slime.yaml',
        'grass':     '/SpiteSheets/grass.yaml',
        'dirtGrass': '/SpiteSheets/dirt-grass.yaml',
        'water':     '/SpiteSheets/water-sheet.yaml',
        // ... more terrain and object sheets
    },
    images: {
        'enemySheetBasic': '/SpiteSheets/characters/enemies/enemy_basic_sheet.png',
        // ...
    },
    yaml: {
        'gameConfig':     '/game.yaml',
        'keybindings':    '/keybindings.yaml',
        'enemySpritePack':'/SpiteSheets/characters/enemies/enemies_spritesheets.yaml'
    }
};
```

### SpriteSheet Format

Each sprite sheet is a YAML file paired with a PNG:

```yaml
meta:
  tile_size: 48
  frames: 4
  file: ["player.png"]

tiles:
  - id: 0
    type: "idle_down"
    atlas_x: 0
    atlas_y: 0
    layer: "characters"
    walkable: false
```

`SpriteSheet` parses this into animation frame maps used by `AnimatorComponent`.

---

## 7. Entity-Component System

**Files**: `src/ecs/Entity.ts`, `src/ecs/Component.ts`, `src/ecs/components/`

### Design Philosophy

This is a **lightweight ECS** — not a data-oriented ECS with archetype storage. Components are plain class instances stored in a `Map<string, Component>` on each entity. There is no system registry; systems are plain classes that operate on entities they hold references to.

### Entity

Base class for all game objects. Built-in fields:

```typescript
id: number          // auto-incremented global counter
active: boolean     // if false, update/draw skipped
destroyed: boolean  // marked for removal
x, y: number        // world position
rotation: number    // radians
scaleX, scaleY: number
vx, vy: number      // velocity
components: Map<string, Component>
tags: Set<string>
parent: Entity | null
children: Entity[]
```

Key methods:
```typescript
addComponent<T extends Component>(component: T): this
getComponent<T extends Component>(classOrName): T | null
hasComponent(classOrName): boolean
removeComponent(classOrName): void
addTag(tag: string): this
hasTag(tag: string): boolean
destroy(): void          // sets destroyed=true, clears components, removes from parent
applyVelocity(dt): void  // x += vx*dt, y += vy*dt
distanceTo(other): number
distanceToSquared(other): number
```

### Component

Base class for all components:

```typescript
abstract class Component {
    entity: Entity | null = null;
    active: boolean = true;

    onAdd?(entity: Entity): void;
    update?(deltaTime: number): void;
    draw?(ctx: CanvasRenderingContext2D, camera: Camera): void;
    onRemove?(entity: Entity): void;
}
```

### Built-in Components

| Component | Purpose | Key Fields |
|-----------|---------|-----------|
| `AnimatorComponent` | Sprite animation state machine | `spriteSheet`, `currentState`, `currentDirection`, `frameTimer` |
| `ColliderComponent` | Collision shape definition | `type: 'circle'\|'rect'`, `radius`, `offsetX/Y`, `layer` |
| `HealthComponent` | HP, damage, death, invulnerability | `health`, `maxHealth`, `isDead`, `invulnerable`, `invulnerabilityTimer` |
| `MovementComponent` | Physics-based movement, dash | `speed`, `vx/vy`, `isDashing`, `facingDirection`, `dashCooldown` |
| `SpriteComponent` | Static sprite rendering | `image`, `frameX/Y`, `frameWidth/Height` |

### Component Retrieval Pattern

```typescript
// Always use the typed generic overload
const health = entity.getComponent<HealthComponent>('HealthComponent');
if (!health) return; // always guard — component may not exist

// By constructor reference (also valid, same result)
const health = entity.getComponent(HealthComponent);
```

---

## 8. Scene Management

**Files**: `src/scenes/Scene.ts`, `src/scenes/SceneManager.ts`, `src/scenes/GameScene.ts`

### Scene Lifecycle

```
register(name, scene)
  └─ stores scene in registry

switchTo(name, data, restart, transition)
  ├─ current?.onExit()
  ├─ [optional] transition animation (fade/wipe)
  ├─ next.onEnter(data)
  └─ sets current = next

restart()
  ├─ current.onExit()
  └─ current.onEnter({})
```

### Scene Base Class

```typescript
abstract class Scene {
    game: Game;
    active: boolean;

    onEnter(data: Record<string, unknown>): void  // setup
    update(deltaTime: number): void               // game logic
    draw(ctx: CanvasRenderingContext2D, alpha: number): void  // rendering
    onExit(): void                                // cleanup
}
```

### GameScene

The only scene currently registered. Owns:
- `InputManager` — keyboard/mouse input
- `Camera` — world viewport
- `TileMap` — procedurally generated world
- `Player` — the player entity
- `SpawnSystem` — enemies, XP gems, power-ups
- `ParticleSystem` — VFX
- `UpgradeSystem` — level-up options
- `HUD` + `LevelUpScreen` — UI

**World generation** happens in `_generateWorld()` called from `onEnter()`. Uses a seeded PRNG (`mulberry32`) for deterministic placement of ponds, paths, decorations, and chests.

---

## 9. Input System

**File**: `src/input/InputManager.ts`

### Action Map

Input is abstracted into named actions. The default bindings (from `GameConfig.input.keyboard`):

| Action | Default Key |
|--------|------------|
| `moveUp` | W |
| `moveDown` | S |
| `moveLeft` | A |
| `moveRight` | D |
| `jump` | Space |
| `dash` | ShiftLeft |
| `interact` | E |
| `attack` | J |
| `special` | K |
| `pause` | Escape |
| `inventory` | I |
| `map` | M |

### API

```typescript
inputManager.setCanvas(canvas);     // attach keyboard/mouse listeners
inputManager.setCamera(camera);     // for mouse world-space conversion
inputManager.update();              // call once per fixed update tick

// Queries
inputManager.isActionPressed('dash')        // true only on the frame it was pressed
inputManager.isActionHeld('moveUp')         // true while held
inputManager.isActionReleased('attack')     // true only on the frame released
inputManager.getMovementVector()            // { x: [-1,0,1], y: [-1,0,1] } normalized
inputManager.getMouseWorldPosition()        // { x, y } in world space
```

---

## 10. Camera System

**File**: `src/graphics/Camera.ts`

### Features

- **Follow**: smooth lerp toward target entity (`followSmoothing` = 0.15)
- **World bounds**: clamps viewport to `[minX, maxX] × [minY, maxY]`
- **Shake**: radial shake with intensity decay over duration
- **Punch**: directional impulse (used on player damage)
- **Zoom**: uniform scale (default 1.0)

### Transform API

```typescript
camera.applyTransform(ctx);   // save + translate + scale
camera.resetTransform(ctx);   // restore

// Shake
camera.shake(intensity: number, duration: number);
camera.punch(dx: number, dy: number, strength: number);

// Follow
camera.follow(entity);        // sets follow target
camera.update(deltaTime);     // lerp toward target, apply shake decay
```

### Coordinate Conversion

```typescript
// World → screen
const screenX = (worldX - camera.x) * camera.zoom + canvas.width / 2;

// Screen → world (for mouse input)
const worldX = (screenX - canvas.width / 2) / camera.zoom + camera.x;
```

---

## 11. Tile Map System

**File**: `src/graphics/TileMap.ts`

### Layers

The tile map has two logical layers:
- `'ground'` — base terrain (grass, water)
- `'decoration'` — overlaid objects (paths, flowers, rocks, chests)

### Tile Definition

```typescript
tileMap.defineTileType(id, {
    spriteSheet: 'grass',   // registered sheet name
    tileId: 0,              // frame index within sheet
    walkable: true,         // collision flag
    color: '#2d5a27'        // fallback if no sheet
});
```

### Rendering

`TileMap.draw(ctx, camera, gameTime)` performs **frustum culling** — only tiles within the camera viewport are drawn. This is critical for the 100×100 tile world (10,000 tiles total).

### Collision

`tileMap.isWalkable(tileX, tileY)` returns `false` for water, rocks, and other blocked tiles. `GameScene._circleIntersectsBlockedTiles()` uses this for entity-tile collision resolution.

---

## 12. Player Architecture

**File**: `src/entities/Player.ts`

### Inheritance

```
Entity
  └─ Player
       ├─ AnimatorComponent   (sprite animation)
       ├─ HealthComponent      (HP, invulnerability)
       ├─ MovementComponent    (velocity, dash, bounds)
       └─ ColliderComponent    (circle r=16, offsetY=8)
```

### Stats System

`PlayerStats` holds **multipliers** (not absolute values) for most stats:

```typescript
interface PlayerStats {
    moveSpeed: number;        // multiplier, default 1.0
    maxHealth: number;        // multiplier, default 1.0
    pickupRange: number;      // multiplier, default 1.0
    damageMultiplier: number; // multiplier, default 1.0
    armor: number;            // additive reduction [0, 0.8], default 0
    luck: number;             // additive bonus, default 0
    shieldCapacity: number;   // multiplier, default 1.0
}
```

Effective values are computed at use time:
```typescript
player.getDamageMultiplier()    // stats.damageMultiplier * effect multipliers
player.getPickupRange()         // basePickupRange * stats.pickupRange * effects
player.getDamageTakenMultiplier() // 1 - armor (clamped to [0.2, 1.0])
```

### Shield System

Secondary health pool separate from `HealthComponent`. Properties:
- `shield` — current shield HP
- `baseShieldCapacity` — 45 (from config)
- `shieldRechargeRate` — 16 HP/s
- `shieldRechargeDelay` — 2.5s delay after last hit before regen starts
- `shieldRechargeDelayTimer` — countdown timer

Damage flow: `absorbShieldDamage(amount)` → returns remaining damage after shield absorption → passed to `HealthComponent.takeDamage()`.

### Timed Effects (Power-ups)

`PlayerEffect[]` array. Each effect has `id`, `duration`, `remaining`, and `multipliers`. Effects are ticked in `Player.update()` and removed when `remaining <= 0`. `_syncMovementSpeed()` is called whenever effects change.

### Weapon Management

```typescript
player.addWeapon(Sword)                    // instantiates and pushes to weapons[]
player.getWeapon(Longsword)               // T | null
player.hasWeapon(MagicOrbs)              // boolean
// weapons[] is iterated in update() and draw()
```

---

## 13. Enemy Architecture

**File**: `src/entities/Enemy.ts`

### Enemy Types

| Type | HP | Speed | Wave Unlock | Notes |
|------|----|-------|-------------|-------|
| `basic` | 26 | medium | 0 | Standard chaser |
| `fast` | 18 | high | 1 | Fragile, hard to outrun |
| `tank` | 70 | slow | 2 | Absorbs punishment |
| `elite` | 90 | medium | 4 | Late-game powerhouse |
| `skeleton` | 30 | medium | 0 | Sprite-animated |
| `slime` | 22 | slow | 0 | Sprite-animated, XP fodder |

### Behavior

All enemies use simple **seek** AI: move toward the player each tick. No pathfinding. Tile collision is resolved by `GameScene._resolveEntityTileCollision()`.

### Knockback

`enemy.applyKnockback(vx, vy)` sets `knockbackVx/Vy`. These decay via friction each frame. The `MovementComponent` velocity and knockback are summed for final movement.

### Hit Flash

Enemy hit flash is implemented via sprite draw options (alpha/tint) — **not** `ctx.filter`. This avoids the full canvas repaint cost.

### Sprite Rendering

Enemies use either:
1. `SpriteSheet` + `AnimatorComponent` (skeleton, slime) — frame-based animation
2. Metadata-driven sheet from `enemies_spritesheets.yaml` (basic, fast, tank, elite) — single-row walk cycle

---

## 14. Weapon System

**File**: `src/weapons/Weapon.ts` + individual weapon files

### Base Class

```typescript
abstract class Weapon {
    owner: Player;
    name: string;
    level: number;
    maxLevel: number;
    cooldown: number;       // current cooldown timer
    baseCooldown: number;   // cooldown at level 1
    damage: number;
    baseDamage: number;

    update(deltaTime: number): void  // ticks cooldown — call super.update()
    isReady(): boolean               // cooldown <= 0
    resetCooldown(): void            // resets to baseCooldown * cooldownMultiplier(level)
    levelUp(): void                  // increments level, recalculates stats
    getDamageContext(): DamageContext // damage + crit + multipliers
}
```

### Damage Formula

```
effectiveDamage = baseDamage * (1 + (level - 1) * 0.2) * player.getDamageMultiplier()
critRoll        = Math.random() < player.getCritChance()
finalDamage     = critRoll ? effectiveDamage * player.getCritDamageMultiplier() : effectiveDamage
```

### Weapons

| Weapon | Type | Trigger | Key Mechanic |
|--------|------|---------|-------------|
| `Sword` | Auto melee | Nearest enemy in range | Arc slash, knockback |
| `Longsword` | Manual melee | Space key | Directional vertical slash, high damage |
| `MagicOrbs` | Passive | Continuous | Rotating orbs at fixed radius, contact damage |
| `MagicMissiles` | Auto ranged | Nearest enemy | Homing projectiles, piercing |
| `LightningStrike` | Auto AoE | Random position | Branching bolt VFX, area damage |

### Adding a Weapon

1. Create `src/weapons/MyWeapon.ts` extending `Weapon`
2. Call `super.update(deltaTime)` first in `update()` to tick cooldown
3. Check `this.isReady()` before firing
4. Call `this.resetCooldown()` after firing
5. Emit `GameEvents.WEAPON_FIRED` with `{ weapon: this }`
6. Register in `UpgradeSystem` upgrade pool
7. Add camera shake preset in `GameScene._setupEventListeners()`

---

## 15. Spawn System

**File**: `src/systems/SpawnSystem.ts`

### Wave System

- Wave duration: **30 seconds**
- Each wave increases difficulty tier
- Spawn interval decreases with wave number
- Enemy type unlock thresholds: basic(0), fast(1), tank(2), elite(4)
- Hard cap: **50 enemies** on screen simultaneously

### Spawn Logic

```
update(deltaTime):
  spawnTimer -= deltaTime
  if spawnTimer <= 0:
    spawnTimer = baseInterval * difficultyMultiplier(wave)
    if enemies.length < MAX_ENEMIES:
      type = weightedRandom(unlockedTypes, wave)
      position = randomOffscreen(camera)
      spawnEnemy(type, position)
```

### XP Gems & Power-ups

`SpawnSystem` also manages `XPGem[]` and `PowerUpPickup[]` arrays. XP gems are spawned on enemy death (via `spawnXPGem(x, y, value)`). Power-ups are spawned from chests and occasionally from enemies.

Sprite images and SpriteSheets are cached in `spriteImages` / `spriteSheets` records on the SpawnSystem — avoid re-loading assets per-spawn.

---

## 16. Particle System

**File**: `src/systems/ParticleSystem.ts`

### Design

Object pool of `Particle` instances. Particles are never garbage-collected during gameplay — dead particles are recycled from the pool. Pool size is configured via `config.particles.poolSize` (default 500).

### Particle Types

```typescript
particleSystem.createHitEffect(x, y, color)           // burst of sparks
particleSystem.createDamageNumber(x, y, amount, color) // floating damage text
particleSystem.createXPParticles(x, y)                 // XP gem burst
particleSystem.createLightningEffect(x, y, radius)     // lightning AoE VFX
particleSystem.createExplosion(x, y, color, count)     // generic explosion
```

### Update/Draw

```typescript
particleSystem.update(deltaTime);  // tick all active particles, recycle dead ones
particleSystem.draw(ctx);          // draw all active particles (no camera transform needed)
particleSystem.clear();            // reset all particles (called in GameScene.onExit)
```

---

## 17. Upgrade System

**File**: `src/systems/UpgradeSystem.ts`

### UpgradeOption Type

```typescript
type UpgradeOption =
  | { type: 'new_weapon';     weaponClass: WeaponClass; name: string; description: string; rarity: Rarity }
  | { type: 'weapon_upgrade'; weapon: Weapon;           name: string; description: string; rarity: Rarity }
  | { type: 'stat';           stat: keyof PlayerStats;  value: number; name: string; description: string; rarity: Rarity }
```

Always use a `switch` on `type` for exhaustive handling — TypeScript will enforce it.

### Generation

`generateOptions(count: number)` returns `count` options via **weighted random selection without replacement**:

| Rarity | Weight |
|--------|--------|
| `common` | 3 |
| `uncommon` | 2 |
| `rare` | 1 |
| `weapon_upgrade` | 4 (if player has the weapon and it's not max level) |

New weapons are only offered if the player doesn't already have them. Weapon upgrades are only offered for weapons the player owns that are below max level.

### Applying Upgrades

```typescript
upgradeSystem.applyUpgrade(option);
// Internally calls:
//   player.addWeapon(weaponClass)   for new_weapon
//   weapon.levelUp()                for weapon_upgrade
//   player.applyStat(stat, value)   for stat
```

---

## 18. Audio System

**Files**: `src/audio/AudioSystem.ts`, `src/audio/ProceduralAudioSystem.ts`

### Two Backends

| Backend | Class | Description |
|---------|-------|-------------|
| `authored` | `AudioSystem` | Web Audio API with authored sound design |
| `procedural` | `ProceduralAudioSystem` | Algorithmically generated sounds |

The active backend is selected via `AudioPreferences.mode` and persisted to localStorage. Both implement the same `AudioBackend` interface:

```typescript
interface AudioBackend {
    unlock(): Promise<boolean> | boolean;
    destroy(): void;
    setEnabled(enabled: boolean): void;
    setVolumes(settings: AudioSettingsLike): void;
    playUiSelect(): void;
}
```

### Unlock Flow

Browser autoplay policy requires a user gesture before audio can play. `unlock()` is called:
1. On first `pointerdown` or `keydown` (one-time listener in `Application.setupUI()`)
2. On every button click that starts/resumes gameplay

### Volume Hierarchy

```
masterVolume
  ├─ musicVolume   (background music / ambient)
  └─ sfxVolume     (weapon sounds, hit sounds, UI)
```

---

## 19. UI Architecture

**Files**: `src/ui/HUD.ts`, `src/ui/LevelUpScreen.ts`, `src/ui/Minimap.ts`

### HUD

Drawn directly to canvas in screen space (after `camera.resetTransform()`). Renders:
- Health bar (with shield overlay)
- XP bar + level indicator
- Elapsed time
- Kill count
- Active effect icons (haste, rage, magnet, etc.)
- Weapon list with cooldown indicators

`hud.update(player, gameTime, killCount)` — call once per fixed tick.
`hud.draw(ctx)` — call once per frame after camera reset.

### LevelUpScreen

Modal overlay drawn in screen space. Shown when `GameScene.showingLevelUp === true`. Pauses the game loop via `game.pause()`. Calls the selection callback with the chosen `UpgradeOption`, then resumes via `game.resume()`.

### Minimap

Optional 150×150 pixel overview in the corner. Shows:
- Terrain (simplified color blocks)
- Player position (white dot)
- Enemy positions (red dots)
- XP gem positions (yellow dots)

Toggle with `M` key.

### DOM UI

The start screen, pause overlay, game-over screen, and audio options are **HTML elements** in `index.html`, not canvas-drawn. They are wired to `EventBus` events in `Application.setupUI()`. Game systems should never call `document.getElementById()` — use `EventBus` to communicate state changes to the DOM layer.

---

## 20. Rendering Pipeline

### Per-Frame Draw Order

```typescript
// Game.draw(alpha) — called every RAF frame
ctx.imageSmoothingEnabled = false;          // 1. enforce pixel art (re-asserted every frame)
ctx.fillStyle = '#1a1a2e';
ctx.fillRect(0, 0, canvas.width, canvas.height); // 2. clear

camera.applyTransform(ctx);                 // 3. enter world space (translate + scale)

  tileMap.draw(ctx, camera, gameTime);      //    ground layer (frustum culled)
                                            //    decoration layer (frustum culled)
  spawnSystem.draw(ctx, camera);            //    XP gems, power-ups, enemies
  player.draw(ctx, camera);                 //    player sprite + weapons + shield orb
  gameScene._drawChestPrompt(ctx);          //    world-space UI (chest interaction hint)
  particleSystem.draw(ctx);                 //    particles (damage numbers, sparks, etc.)
  [debug] tileMap.drawCollisionDebug(ctx);  //    collision boxes (if debug.showCollisionBoxes)

camera.resetTransform(ctx);                 // 4. exit world space (restore)

  gameScene._drawLowHealthVignette(ctx);    //    screen-space vignette
  hud.draw(ctx);                            //    HUD overlay
  [if showingLevelUp] levelUpScreen.draw(ctx); // level-up modal
```

### Pixel Art Rendering

`ctx.imageSmoothingEnabled = false` is set:
1. Once in `Game` constructor
2. Re-asserted at the start of every `Game.draw()` call

This is necessary because some browser APIs (notably `ctx.drawImage` with certain parameters) can reset it.

### Camera Transform

```typescript
camera.applyTransform(ctx):
  ctx.save()
  ctx.translate(canvas.width/2 - camera.x * zoom, canvas.height/2 - camera.y * zoom)
  ctx.scale(zoom, zoom)
  // + shake offset applied here

camera.resetTransform(ctx):
  ctx.restore()
```

---

## 21. Collision System

### Tile Collision

Handled in `GameScene._resolveEntityTileCollision(entity, prevX, prevY)`:

1. Try moving on X axis only → if blocked, revert X and zero X velocity
2. Try moving on Y axis only → if blocked, revert Y and zero Y velocity

This axis-separation approach allows sliding along walls.

`_circleIntersectsBlockedTiles(cx, cy, radius)` checks all tiles in the AABB of the circle against `tileMap.isWalkable()`.

### Entity-Entity Collision

`Enemy.checkCollision(player)` uses circle-circle overlap test:

```typescript
const dx = player.x - enemy.x;
const dy = player.y - enemy.y;
const dist = Math.sqrt(dx*dx + dy*dy);
return dist < (playerRadius + enemyRadius);
```

### Contact Damage Cooldowns

`GameScene.enemyContactCooldowns: Map<number, number>` (key = enemy entity ID, value = remaining cooldown seconds). Prevents frame-rate-dependent damage from sustained contact. Per-enemy cooldown is set by `player.getProximityContactInterval()` (0.38s).

A global `playerContactDamageCooldown` (0.6s) prevents swarm stacking — only one enemy can deal contact damage per interval.

### Projectile Collision

Projectiles check distance to each enemy each tick. On hit:
1. `enemy.takeDamage(damage, source)` — emits `ENEMY_DAMAGED`
2. If `piercing === false`, projectile is destroyed
3. If enemy HP ≤ 0, `enemy.destroy()` — emits `ENEMY_KILLED`

---

## 22. Data Flow Diagrams

### Player Takes Damage

```
Enemy contacts Player
  └─ GameScene._resolvePlayerEnemyContact(enemy)
       ├─ check enemyContactCooldowns[enemy.id] > 0 → skip
       ├─ check playerSpawnInvulnerabilityTimer > 0 → skip
       ├─ enemy.takeDamage(proximityDamage, player)
       │    └─ eventBus.emit(ENEMY_DAMAGED, { enemy, amount })
       │         └─ GameScene: damageDealt += amount, createHitEffect()
       └─ if playerContactDamageCooldown <= 0:
            ├─ player.absorbShieldDamage(incomingDamage) → remainingDamage
            ├─ health.takeDamage(remainingDamage, enemy)
            │    ├─ health.health -= damage
            │    ├─ health.invulnerable = true (for invulnerabilityDuration)
            │    └─ eventBus.emit(PLAYER_DAMAGED, { source: enemy })
            │         ├─ GameScene: camera.shake() + camera.punch()
            │         └─ Application: (no handler — DOM handles via GAME_OVER)
            └─ if health.isDead:
                 └─ eventBus.emit(PLAYER_DIED)
                      └─ GameScene._emitGameOver()
                           ├─ game.endGame()
                           └─ eventBus.emit(GAME_OVER, stats)
                                └─ Application.showGameOver(data)
```

### Enemy Killed → XP Collected → Level Up

```
Weapon hits Enemy
  └─ enemy.takeDamage(damage, weapon)
       ├─ eventBus.emit(ENEMY_DAMAGED, { enemy, amount })
       └─ if hp <= 0:
            ├─ enemy.destroy()
            ├─ spawnSystem.spawnXPGem(x, y, xpValue)
            └─ eventBus.emit(ENEMY_KILLED)
                 └─ Game.killCount++, GameScene.killCount++

XPGem enters player pickup range
  └─ spawnSystem.update() detects overlap
       └─ eventBus.emit(XP_COLLECTED, { value, x, y })
            └─ GameScene handler:
                 ├─ gemsCollected++
                 ├─ player.gainXP(value)
                 │    ├─ xp += value
                 │    └─ while xp >= xpToNextLevel: player.levelUp()
                 │         ├─ level++
                 │         ├─ health.heal(healthRecoveryOnLevelUp)
                 │         └─ eventBus.emit(PLAYER_LEVELUP, { player, level, xpToNext })
                 │              └─ GameScene._showLevelUpScreen()
                 │                   ├─ game.pause()
                 │                   ├─ upgradeSystem.generateOptions(3)
                 │                   └─ levelUpScreen.show(options, callback)
                 │                        └─ on selection: upgradeSystem.applyUpgrade(option)
                 │                             └─ game.resume()
                 └─ particleSystem.createXPParticles(x, y)
```

---

## 23. Extension Points

### Adding a New System

1. Create `src/systems/MySystem.ts`
2. Instantiate in `GameScene.onEnter()`
3. Call `mySystem.update(deltaTime)` in `GameScene.update()`
4. Call `mySystem.draw(ctx, camera)` in `GameScene.draw()` at the correct z-order
5. Call `mySystem.destroy()` or `mySystem.clear()` in `GameScene.onExit()`
6. Communicate with other systems via `EventBus` — do not hold direct references

### Adding a New GameEvent

1. Add to `GameEvents` in `src/core/EventBus.ts`:
   ```typescript
   MY_NEW_EVENT: 'my:new_event',
   ```
2. Define a payload interface if the event carries data
3. Emit: `eventBus.emit(GameEvents.MY_NEW_EVENT, payload)`
4. Subscribe: `eventBus.on(GameEvents.MY_NEW_EVENT, handler)`

### Adding a New Config Section

1. Add to `DefaultConfig` in `src/config/GameConfig.ts`
2. Add a typed getter to `GameConfig` class:
   ```typescript
   get mySection() { return this.data.mySection; }
   ```
3. Update `game.yaml` with the new section and defaults

### Adding a New Asset Type

1. Add to `CoreAssetManifest` in `src/assets/AssetManifest.ts`
2. If it's a new asset category (not image/yaml/spriteSheet), extend `AssetLoader`
3. Follow the asset path rule: `/MyAssets/file.ext` (no `/Resources/` prefix)

### Adding a New Power-up Type

1. Add the type string to the union in `PowerUpPickup.ts`
2. Add a `case` in `Player.applyPowerUp()`
3. Add spawn logic in `SpawnSystem`
4. Handle `POWERUP_COLLECTED` in `GameScene._setupEventListeners()`

---

## Related Documentation

| File | Purpose |
|------|---------|
| [`CLAUDE.md`](../CLAUDE.md) | Narrative conventions, patterns, gotchas, workflow for Claude agents |
| [`CODEX.md`](../CODEX.md) | Machine-readable quick reference for Codex/GPT agents |
| [`docs/RESOURCES.md`](./RESOURCES.md) | Asset pipeline, sprite sheet format, shader catalogue |
| [`TODO.md`](../TODO.md) | 7-phase development roadmap — check before proposing new features |
| [`README.md`](../README.md) | Player-facing documentation, controls, feature list |
