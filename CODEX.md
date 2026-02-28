# CODEX.md — AI Agent Instructions for Darkmoon

> Optimised for OpenAI Codex, GPT-4o, and similar code-completion agents.
> Concise, structured, machine-readable. See `CLAUDE.md` for the narrative version.

---

## IDENTITY

```yaml
project: darkmoon
type: browser-action-roguelike
language: typescript@5.4
build: vite@5
renderer: html5-canvas-2d
target: ES2020
entry: src/main.ts
license: GPL-3.0-only
```

---

## COMMANDS

```bash
npm install          # install deps
npm run dev          # dev server → http://localhost:3000
npm run typecheck    # tsc --noEmit (MUST pass after every change)
npm run build        # production build → dist/
npm run preview      # preview production build
```

---

## DIRECTORY MAP

```
src/
  main.ts              # Application bootstrap, DOM wiring
  Game.ts              # Canvas, game loop, state machine
  core/
    EventBus.ts        # Singleton pub/sub + GameEvents constants
    GameLoop.ts        # Fixed 60fps RAF loop, accumulator pattern
    Math.ts            # Vector2, easing, Direction type
  config/
    GameConfig.ts      # DefaultConfig + typed GameConfig class
    ConfigLoader.ts    # YAML → GameConfig
  assets/
    AssetLoader.ts     # Image + YAML loader
    AssetManifest.ts   # CoreAssetManifest (canonical asset list)
    SpriteSheet.ts     # Animation frame definitions
  ecs/
    Entity.ts          # Base entity: transform, velocity, components, tags
    Component.ts       # Base component: lifecycle hooks
    components/        # AnimatorComponent, ColliderComponent,
                       # HealthComponent, MovementComponent, SpriteComponent
  entities/
    Player.ts          # Stats, weapons, buffs, dash, shield
    Enemy.ts           # 6 types, knockback, sprites
    XPGem.ts           # Magnetic pickup
    Projectile.ts      # Homing, piercing
    PowerUpPickup.ts   # 7 pickup types
  graphics/
    Camera.ts          # Follow, shake, punch, bounds
    Renderer.ts        # Canvas wrapper
    AnimatedSprite.ts  # Frame animation
    TileMap.ts         # Layered tiles, frustum culled
  input/
    InputManager.ts    # Keyboard/mouse → action bindings
  systems/
    SpawnSystem.ts     # Wave difficulty, enemy spawning
    ParticleSystem.ts  # Pooled VFX, damage numbers
    UpgradeSystem.ts   # Level-up option generation
  weapons/
    Weapon.ts          # Base: leveling, cooldown, owner
    Sword.ts           # Auto melee arc
    Longsword.ts       # Manual slash (Space)
    MagicOrbs.ts       # Orbital contact damage
    MagicMissiles.ts   # Homing projectiles
    LightningStrike.ts # AoE branching bolt
  scenes/
    Scene.ts           # Base: onEnter/onExit lifecycle
    SceneManager.ts    # Scene stack, fade/wipe transitions
    GameScene.ts       # Main gameplay, world gen, collision
  ui/
    HUD.ts             # Health, XP, level, time, kills, buffs
    LevelUpScreen.ts   # Upgrade modal
    Minimap.ts         # 150×150 overview
  audio/
    AudioSystem.ts     # Web Audio API
    ProceduralAudioSystem.ts
  legacy/              # ⚠ EXCLUDED from TS — do not import
src/Resources/         # Vite publicDir → served at URL "/"
  game.yaml            # Main config
  SpiteSheets/         # PNG + YAML sprite definitions
  shaders/             # GLSL shaders
  Fonts/               # Renogare.ttf
  Sounds/              # Audio files
```

---

## ARCHITECTURE GRAPH

```
Application
└─ Game (canvas, config, state)
   ├─ GameLoop (RAF, fixed dt=1/60)
   ├─ EventBus (singleton)
   └─ SceneManager
      └─ GameScene
         ├─ InputManager
         ├─ Camera
         ├─ TileMap (ground + decoration layers)
         ├─ Player (Entity + ECS components)
         ├─ SpawnSystem (enemies, gems, powerups)
         ├─ ParticleSystem
         ├─ UpgradeSystem
         └─ HUD / LevelUpScreen
```

---

## TYPESCRIPT RULES

```typescript
// tsconfig: strict=true, noImplicitAny=true, isolatedModules=true
// useDefineForClassFields=false → fields assigned in constructor body

// NAMING
class MySystem {}           // PascalCase classes
interface MyData {}         // PascalCase interfaces
type MyAlias = string;      // PascalCase type aliases
const MY_CONST = 'value';   // SCREAMING_SNAKE_CASE constants
_privateMethod() {}         // underscore prefix for private methods

// IMPORTS — use path aliases
import { eventBus } from '@core/EventBus';
import type { Camera } from '@graphics/Camera';  // type-only imports

// GENERICS — always type component retrieval
const health = entity.getComponent<HealthComponent>('HealthComponent');

// NO any — use unknown + type guards
function process(data: unknown) {
    if (typeof data === 'number') { /* ... */ }
}
```

### Path Aliases
```
@/        → src/
@core/    → src/core/
@entities/→ src/entities/
@systems/ → src/systems/
@graphics/→ src/graphics/
@ui/      → src/ui/
```

---

## ASSET PATH RULE ⚠ CRITICAL

```
publicDir = src/Resources/  →  served at URL root "/"

✅ '/SpiteSheets/characters/player.yaml'
❌ '/Resources/SpiteSheets/characters/player.yaml'
❌ 'src/Resources/SpiteSheets/characters/player.yaml'
```

---

## EVENTBUS USAGE

```typescript
import { eventBus, GameEvents } from '@core/EventBus';

// Emit
eventBus.emit(GameEvents.PLAYER_DAMAGED, { source: enemy });

// Subscribe (store handle for cleanup)
const unsub = eventBus.on(GameEvents.ENEMY_KILLED, (data) => { ... });
unsub(); // call in onExit() or destroy()

// One-shot
eventBus.once(GameEvents.GAME_START, () => { ... });

// ❌ NEVER raw strings
eventBus.emit('player:damaged', data);
```

### GameEvents Reference
```typescript
// Player
PLAYER_DAMAGED | PLAYER_HEALED | PLAYER_DIED | PLAYER_LEVELUP | PLAYER_XP_GAINED
// Enemy
ENEMY_SPAWNED | ENEMY_DAMAGED | ENEMY_KILLED
// Weapon
WEAPON_FIRED | WEAPON_UPGRADED | WEAPON_ACQUIRED
// Items
XP_COLLECTED | ITEM_COLLECTED | POWERUP_COLLECTED
// Game state
GAME_START | GAME_PAUSE | GAME_RESUME | GAME_OVER | GAME_RESTART
// Scene
SCENE_CHANGE | SCENE_READY
// UI
UI_UPGRADE_SELECTED | UI_MENU_OPEN | UI_MENU_CLOSE
```

---

## ECS PATTERNS

```typescript
// Add component
const health = new HealthComponent(maxHp);
entity.addComponent(health);

// Get component (always guard null)
const health = entity.getComponent<HealthComponent>('HealthComponent');
if (!health) return;

// Component lifecycle
class MyComponent extends Component {
    onAdd(entity: Entity) {}
    update(deltaTime: number) {}
    draw(ctx: CanvasRenderingContext2D, camera: Camera) {}
    onRemove(entity: Entity) {}
}

// Tags
entity.addTag('player');
entity.hasTag('enemy'); // boolean
```

---

## NEW WEAPON TEMPLATE

```typescript
// File: src/weapons/MyWeapon.ts
import { Weapon } from './Weapon';
import { eventBus, GameEvents } from '@core/EventBus';
import type { Player } from '@entities/Player';
import type { Enemy } from '@entities/Enemy';

export class MyWeapon extends Weapon {
    constructor(owner: Player, options: Record<string, unknown> = {}) {
        super(owner, { name: 'My Weapon', maxLevel: 8, ...options });
    }

    update(deltaTime: number, enemies: Enemy[] = []) {
        super.update(deltaTime); // ticks cooldown
        if (!this.isReady()) return;
        // attack logic here
        this.resetCooldown();
        eventBus.emit(GameEvents.WEAPON_FIRED, { weapon: this });
    }

    draw(ctx: CanvasRenderingContext2D) { /* VFX */ }
}
```

---

## NEW SCENE TEMPLATE

```typescript
// File: src/scenes/MyScene.ts
import { Scene } from './Scene';
import type { Game } from '../Game';

export class MyScene extends Scene {
    constructor(game: Game) { super(game); }

    onEnter(data: Record<string, unknown> = {}) {
        super.onEnter(data);
        // setup
    }

    update(deltaTime: number) { /* logic */ }

    draw(ctx: CanvasRenderingContext2D, alpha: number) { /* render */ }

    onExit() {
        super.onExit();
        // cleanup
    }
}

// Register in main.ts:
// sceneManager.register('myScene', new MyScene(game));
// sceneManager.switchTo('myScene', {}, false, 'fade');
```

---

## GAMECONFIG ACCESS

```typescript
// Typed getters (preferred)
config.player.speed          // number
config.world.tileSize        // number
config.graphics.targetFPS    // number
config.worldWidth            // computed: widthTiles * tileSize
config.worldHeight           // computed: heightTiles * tileSize

// Dynamic path access
config.get('player.speed')   // returns unknown
config.set('debug.showFPSCounter', true)
```

---

## FORBIDDEN PATTERNS

```typescript
// ❌ ctx.filter — slow, repaints canvas
ctx.filter = 'brightness(2)';
// ✅ Use alpha overlay or sprite tint options

// ❌ Raw event strings
eventBus.emit('player:died');
// ✅ GameEvents constants

// ❌ Import from legacy/
import { something } from '../legacy/game.js';
// ✅ Rewrite in TypeScript

// ❌ any type
function foo(x: any) {}
// ✅ unknown + type guard or proper generic

// ❌ imageSmoothingEnabled = true
ctx.imageSmoothingEnabled = true;
// ✅ Always false for pixel art

// ❌ Date.now() in game logic
const now = Date.now();
// ✅ Use deltaTime from GameLoop (fixed 1/60s)

// ❌ document.getElementById in game systems
const el = document.getElementById('hud');
// ✅ Pass DOM refs via constructor or use EventBus
```

---

## CANVAS DRAW ORDER

```typescript
// Per frame in Game.draw(alpha):
ctx.imageSmoothingEnabled = false;   // 1. enforce pixel art
ctx.fillRect(0, 0, w, h);            // 2. clear
camera.applyTransform(ctx);          // 3. world space
  tileMap.draw(ctx, camera, time);   //    tiles
  spawnSystem.draw(ctx, camera);     //    enemies, gems
  player.draw(ctx, camera);          //    player
  particleSystem.draw(ctx);          //    particles
camera.resetTransform(ctx);          // 4. screen space
  hud.draw(ctx);                     //    UI overlay
```

---

## PERFORMANCE RULES

| Rule | Detail |
|------|--------|
| Tile culling | TileMap handles it — never draw tiles manually |
| Particle pooling | Always use ParticleSystem — no raw particle objects |
| Entity cleanup | Call `entity.destroy()` — sets `destroyed=true`, clears components |
| Fixed dt | `update(dt)` receives fixed 1/60s — no `Date.now()` in logic |
| Avoid ctx.filter | Use alpha/tint tricks instead |

---

## GOTCHAS

1. **`useDefineForClassFields: false`** — subclass fields set AFTER `super()`. Always call `super()` first.
2. **Asset base path** — `assetLoader.setBasePath(import.meta.env.BASE_URL)` in `main.ts`. All paths absolute from `/`.
3. **`eventBus.clear()`** — no-arg call removes ALL listeners. Only in `Game.destroy()`.
4. **`GameLoop.pause()` vs `stop()`** — `pause()` keeps RAF running (draw fires). `stop()` cancels RAF.
5. **`Entity.id`** — global auto-increment. Never assume contiguous IDs after restart.
6. **`imageSmoothingEnabled`** — re-asserted every frame in `Game.draw()`. Do not rely on one-time set.
7. **`GameConfig` proxy** — `config.player` returns `config.data.player`. Not reactive.

---

## AGENT WORKFLOW CHECKLIST

```
[ ] Read target file + direct imports before editing
[ ] Check if feature needs EventBus communication
[ ] Verify asset paths use /SpiteSheets/... not /Resources/...
[ ] Run: npm run typecheck (zero errors required)
[ ] No any types introduced
[ ] No raw event strings
[ ] imageSmoothingEnabled stays false
[ ] Update CLAUDE.md / docs/ARCHITECTURE.md if adding new system
[ ] File header: // File: src/path/to/File.ts
```

---

## RELATED DOCS

> Every AI agent working on this codebase should read all four documentation files.
> They are complementary, not redundant.

| File | Audience | Purpose |
|------|----------|---------|
| [`CLAUDE.md`](../CLAUDE.md) | Claude / narrative agents | Full conventions, patterns, gotchas in prose |
| [`CODEX.md`](../CODEX.md) | **This file** — Codex / GPT agents | Machine-readable, code-first reference |
| [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | All agents | Deep system-by-system technical breakdown |
| [`docs/RESOURCES.md`](./RESOURCES.md) | All agents | Asset pipeline, sprite sheets, shaders, config |
| [`TODO.md`](../TODO.md) | All agents | 7-phase development roadmap — check before adding features |
| [`README.md`](../README.md) | Players / contributors | Game overview, controls, feature list |

```
Reading order for a new agent:
  1. CODEX.md (this file)     ← start here for quick orientation
  2. CLAUDE.md                ← narrative context and workflow
  3. docs/ARCHITECTURE.md     ← deep dive before touching a system
  4. docs/RESOURCES.md        ← before touching any asset path
  5. TODO.md                  ← before proposing new features
```
