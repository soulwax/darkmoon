# Sandbox Survival Top‑Down Multiplayer RPG — Expanded TODO

## 1) Project Foundations
- [ ] Decide stack (client, server, shared libs)
- [ ] Define authoritative server model (lockstep vs. server‑authoritative)
- [ ] Establish repo structure (`client/`, `server/`, `shared/`, `tools/`)
- [ ] Add build + lint + typecheck pipelines
- [ ] Add CI for tests, builds, and game server health

## 2) Core Multiplayer
- [ ] Network protocol spec (messages, tick rate, compression)
- [ ] Deterministic world step on server
- [ ] Client prediction + reconciliation
- [ ] Entity interpolation/extrapolation
- [ ] Interest management (AOI) + culling
- [ ] Matchmaking / lobby flow
- [ ] Reconnect + state resync
- [ ] Server admin tools (kick, ban, broadcast)

## 3) World & Simulation
- [ ] Procedural world generation (biomes, POIs)
- [ ] Chunk streaming (server + client)
- [ ] Tile metadata system (walkable, harvestable, buildable)
- [ ] Day/night cycle + weather
- [ ] World events (storms, raids, supply drops)
- [ ] Navmesh / pathing grid for AI

## 4) Player Systems
- [ ] Player stats (health, stamina, hunger, thirst, temperature)
- [ ] Inventory with stacks, weights, durability
- [ ] Equipment slots + armor calculation
- [ ] Status effects (poison, bleed, burn, freeze, shock)
- [ ] Skill trees / perks
- [ ] Death & respawn rules (drop items vs. retain)

## 5) Combat
- [ ] Melee hit detection (arc + thrust)
- [ ] Ranged weapons (projectiles, ammo types)
- [ ] Magic/abilities (cooldowns, mana)
- [ ] Damage types + resistances
- [ ] Hit reactions + knockback
- [ ] Combat log + damage numbers

## 6) AI & Enemies
- [ ] Enemy archetypes per biome
- [ ] Aggro, leash, and threat system
- [ ] Group behavior (packs, leaders)
- [ ] Boss encounters + telegraphed attacks
- [ ] Loot tables + rare drops

## 7) Crafting & Building
- [ ] Resource harvesting (trees, rocks, plants)
- [ ] Crafting recipes + stations
- [ ] Base building (placement, rotation, snapping)
- [ ] Building permissions (owners, clans)
- [ ] Decay/maintenance system

## 8) Economy & Progression
- [ ] XP and leveling curve
- [ ] Quests / contracts
- [ ] NPC vendors + buy/sell
- [ ] Currency + sinks
- [ ] Blueprint / tech unlocks

## 9) Social & Multiplayer Features
- [ ] Party system + shared XP
- [ ] Guilds / clans (roles, permissions)
- [ ] Proximity + global chat
- [ ] Trading + secure trade UI
- [ ] PvP ruleset (zones, duels, opt‑in)

## 10) UI/UX
- [ ] HUD redesign for survival stats
- [ ] Minimap + world map
- [ ] Inventory + crafting UI
- [ ] Quest log
- [ ] Settings (controls, audio, graphics)
- [ ] Accessibility (color‑blind mode, text size)

## 11) Graphics & Audio
- [ ] Consistent art direction + palette
- [ ] Animation set for player & enemies
- [ ] VFX for combat, weather, abilities
- [ ] Ambient audio per biome
- [ ] SFX for actions (harvest, craft, hit, build)

## 12) Persistence & Live Ops
- [ ] Server persistence layer (world, players, bases)
- [ ] Backups + migrations
- [ ] Anti‑cheat heuristics (speed, teleport, duping)
- [ ] Metrics + telemetry (combat, retention)
- [ ] Live config tuning

## 13) Performance & Scaling
- [ ] Server tick profiling
- [ ] Client render optimizations
- [ ] Network bandwidth budget
- [ ] Sharding / region servers
- [ ] Load testing with bots

## 14) QA & Release
- [ ] Unit + integration tests
- [ ] Automated regression suite
- [ ] Playtest plan + feedback loop
- [ ] Release checklist (patch notes, rollback plan)

## 15) Milestone Plan (Draft)
- [ ] M1: Multiplayer movement + combat prototype
- [ ] M2: Survival loop + crafting + base building
- [ ] M3: Content (biomes, enemies, quests)
- [ ] M4: Social systems + economy
- [ ] M5: Performance + polish + release
