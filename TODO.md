# Darkmoon — Development Roadmap

## Phase 1: The Polish (Foundation Hardening)

Make what exists feel *good* before adding more.

### Audio

- [x] Add audio engine (Web Audio API or Howler.js)
- [x] Ambient dungeon drone / background music
- [x] Weapon impact sounds (slash, lightning crack, orb hum)
- [x] XP gem collection chimes
- [x] Level-up fanfare
- [x] Enemy death sounds per type
- [x] Player damage hit sound
- [x] UI interaction sounds (menu select, pause)

### Screen Flow

- [ ] Main menu scene (game world dimly visible behind it)
- [ ] Pause overlay scene (not just frozen frame)
- [ ] Death / game-over screen with run stats (kills, time, damage dealt, gems collected)
- [ ] Transition effects between scenes (fade, wipe)

### Juice Pass

- [ ] Hitstop — 2-3 frame freeze on heavy hits
- [ ] Camera punch on player damage
- [ ] Low-health vignette (red edge darkening)
- [ ] XP gems burst outward before magnetizing in
- [ ] Wire up the `armor` stat to actual damage reduction
- [ ] Wire up the `luck` stat to actual RNG modifiers (drop rates, crit chance)
- [ ] Screen shake presets per weapon type

### Cleanup

- [ ] Move debug overlays behind `?debug=1` URL flag or `F3` hotkey
- [ ] Remove hardcoded debug rectangles from GameScene.draw()
- [ ] Extract magic numbers into config (spawn rates, particle counts, etc.)
- [ ] Fix config vs code stat drift (player speed 120 in YAML vs 150 in code)

---

## Phase 2: The Bestiary (Enemy Depth)

Enemies stop being moving hitboxes and start being *problems to solve*.

### Sprites

- [ ] Create/commission sprite sheets for basic, fast, tank, and elite enemies
- [ ] Convert all enemy rendering to SpriteSheet + AnimatorComponent pipeline
- [ ] Add consistent shadow sizing using sprite frame dimensions
- [ ] Add enemy hit flash via sprite draw options (avoid ctx.filter)

### New Enemy Behaviors

- [ ] **Skeleton Archer** — Stops at range, fires bone projectiles, retreats if player closes distance
- [ ] **Wraith** — Phases through terrain, brief invulnerability windows, ambushes from behind
- [ ] **Necromancer** — Hangs back, resurrects fallen enemies as weaker ghosts; high kill priority
- [ ] **Swarm Bat** — Spawns in clusters of 5-8, individually weak but overwhelming in groups

### Mini-Bosses

- [ ] **Slime King** — Appears every 5 waves, splits into smaller slimes on death
- [ ] Boss health bar at top of screen
- [ ] Unique attack patterns per boss (telegraphed AoE, charge, summon)
- [ ] Guaranteed rare drop on boss kill

### Boss Waves

- [ ] Every 10 waves, trigger a named boss encounter
- [ ] Boss intro sequence (brief camera focus, name reveal)
- [ ] Distinct boss music track
- [ ] Boss loot table with exclusive weapon drops

---

## Phase 3: The Arsenal (Weapon Expansion)

Every run should feel different based on weapon combinations.

### New Weapons

- [ ] **Flame Tongue** — Cone AoE leaving burning ground; upgrades widen cone and add DOT
- [ ] **Frost Nova** — Periodic pulse slowing nearby enemies; max level freezes them
- [ ] **Blood Scythe** — Melee sweep healing 5% of damage dealt; short range risk/reward
- [ ] **Chain Lightning** — Bounces between enemies with diminishing damage; upgrades add bounces
- [ ] **Bone Wall** — Rotating bone barriers that block projectiles and damage on contact
- [ ] **Shadow Dagger** — Throws daggers at nearest enemy from behind (backstab bonus)

### Weapon Synergies

Specific weapon pairs unlock passive bonuses:

- [ ] Sword + Blood Scythe = **Crimson Dance** (+15% lifesteal)
- [ ] Lightning Strike + Frost Nova = **Superconductor** (frozen enemies take 2x lightning damage)
- [ ] Magic Orbs + Bone Wall = **Orbital Fortress** (orbs and walls orbit faster)
- [ ] Magic Missiles + Chain Lightning = **Arc Salvo** (missiles chain on impact)
- [ ] Synergy discovery UI — show unlocked/locked synergies

### Weapon Evolution

- [ ] At max level + stat threshold, weapons can transform
- [ ] Magic Missiles -> **Arcane Barrage** (triple volley, seeking)
- [ ] Sword -> **Void Cleaver** (wider arc, pulls enemies inward)
- [ ] Lightning Strike -> **Storm Caller** (persistent storm cloud follows player)
- [ ] Evolution UI indicator and transformation animation

---

## Phase 4: The World (Biome System)

The world is no longer a flat grass field.

### Biome Tiles

- [ ] **Darkwood Forest** — Dense trees blocking line of sight, mushroom clusters that explode when enemies walk over them
- [ ] **Flooded Crypt** — Water tiles slow movement, narrow walkways create chokepoints, skeletons rise from water
- [ ] **Ruined Chapel** — Interior tileset (wooden floors, carpets), tight corridors, treasure chests, fences as destructible cover
- [ ] Add more terrain variants (cliffs, fences, carpets/floors) into world gen

### Procedural Generation v2

- [ ] Room-based dungeon generation connected by corridors
- [ ] Biome themes per floor / zone
- [ ] Seeded generation for reproducible layouts
- [ ] Safe spawn zone guarantee

### Interactables

- [ ] Treasure chests (sprites already exist: chest_02.yaml) with loot tables
- [ ] Shrines granting temporary buffs (damage, speed, invulnerability)
- [ ] Destructible barrels/crates dropping minor loot
- [ ] Torches that light up dark areas

### World Hazards

- [ ] Lava tiles — damage over time on contact
- [ ] Spike traps — periodic activation, telegraphed
- [ ] Poison swamp — slow + DOT
- [ ] Collapsing floor tiles — break after player walks over them

---

## Phase 5: The Meta (Persistence & Progression)

Give players a reason to come back.

### Run Currency

- [ ] "Moon Shards" — dropped by bosses, found in chests, persist across runs
- [ ] Moon Shard counter in HUD and run summary

### Permanent Upgrades

- [ ] Between-run skill tree / upgrade shop
- [ ] Starting health/speed bonuses
- [ ] Unlock new starting weapons
- [ ] Increase upgrade choices from 3 to 4
- [ ] Start at higher wave with bonus levels

### Character Unlocks

- [ ] **Knight** — Starts with Sword, +20% melee damage, -10% move speed
- [ ] **Mage** — Starts with Magic Missiles, +15% cooldown reduction, -15% max health
- [ ] **Rogue** — Starts with Shadow Dagger, +25% move speed, no starting armor
- [ ] **Necromancer** — Starts with Bone Wall, killed enemies have 5% chance to fight for you
- [ ] Character select screen with stat previews

### Achievements

- [ ] "Survive 10 minutes"
- [ ] "Kill 1000 enemies in one run"
- [ ] "Collect 500 XP gems without taking damage"
- [ ] "Defeat a boss with only melee weapons"
- [ ] Achievement notification popup
- [ ] Each achievement unlocks a cosmetic or gameplay reward

### Save System

- [ ] localStorage persistence for permanent upgrades and unlocks
- [ ] Save/load run currency and achievement progress
- [ ] Settings persistence (audio, controls, display)

---

## Phase 6: The Atmosphere (Immersion)

Darkmoon should *feel* like a dark moon.

### Day/Night Cycle

- [ ] Implement the cycle (config placeholder already exists)
- [ ] Color overlay shifting from twilight amber to deep indigo
- [ ] Enemies get stronger at night
- [ ] Some enemies only spawn in darkness

### Dynamic Lighting

- [ ] Player emits soft radial light (canvas composite operations)
- [ ] Torches cast warm light pools
- [ ] Lightning strikes briefly illuminate everything
- [ ] Flame Tongue weapon lights up surrounding area
- [ ] Darkness outside light radius in night/crypt biomes

### Weather

- [ ] Rain particles (particle system already robust enough)
- [ ] Fog — reduced visibility radius
- [ ] Blood Moon events — all enemies buffed, double XP

### Screen Effects

- [ ] Chromatic aberration on low health
- [ ] Optional CRT scanline filter
- [ ] Death screen desaturation
- [ ] Damage flash (brief red overlay)
- [ ] Vignette intensity tied to health percentage

---

## Phase 7: The Community (Shareability)

Let players compete and share.

### Run Summary

- [ ] On death, generate a shareable stats card (character, weapons, stats, time, wave)
- [ ] Copy-to-clipboard or download as image

### Seeded Runs

- [ ] Same seed = same world layout + enemy spawns
- [ ] Seed display in HUD and run summary
- [ ] Seed input on main menu for challenge runs

### Daily Challenge

- [ ] Fixed seed rotating every 24 hours
- [ ] Local leaderboard (localStorage)
- [ ] Optional serverless leaderboard (Cloudflare Workers + KV or similar)

### Modding Support

- [ ] "Custom Game" mode exposing game.yaml values in a settings screen
- [ ] Tweak enemy speed, spawn rates, starting weapons, player stats
- [ ] Share custom configs as exportable YAML snippets

---

## Priority Order

| Priority       | Phase | Focus  | Deliverable                                       |
| -------------- | ----- | ------ | ------------------------------------------------- |
| **Now**        | 1     | Polish | Playable, polished core loop with audio and menus |
| **Next**       | 2 + 3 | Combat | Deep combat with 10+ weapons and smart enemies    |
| **Then**       | 4     | World  | Procedural dungeons replace the flat field         |
| **Later**      | 5 + 6 | Meta   | Persistence and atmosphere make it addictive       |
| **Eventually** | 7     | Social | Community features for organic growth              |

---

## Graphics TODO (Carried Forward)

### World Rendering

- [ ] Add more terrain variants (cliffs, fences, carpets/floors) into world gen
- [ ] Add optional debug overlays: collision tiles, spawn bounds, camera bounds

### Characters / Enemies

- [ ] Convert enemy sprite rendering to SpriteSheet + AnimatorComponent (match player approach)
- [ ] Add enemy hit flash / tint via sprite draw options (avoid ctx.filter)
- [ ] Add consistent shadow sizing using sprite frame dimensions

### VFX and Weapons

- [ ] Add sprite-based projectile and impact effects (missiles/orbs/lightning)
- [ ] Add screen-space post FX: vignette, mild CRT/scanlines toggle, damage flash
- [ ] Add camera shake presets per weapon/enemy hit

### Performance

- [ ] Batch/dedupe draw calls where possible (tile culling already present)
- [ ] Add simple sprite/particle culling bounds per system
