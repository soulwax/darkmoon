# Changelog

All notable changes to this project will be documented in this file.

## 0.4.0 - 2026-03-15

### Added
- Added a reusable combat foundation with explicit run phases, attack timelines, duplicate-hit protection, combat-state tracking, and a shared damage resolver.
- Added deterministic gameplay tests covering attack timing, damage resolution, spawn safety, and run-state transitions.

### Changed
- Rebuilt melee, projectile, orbiting, and lightning weapons to use the same damage contracts and timing-driven combat flow.
- Reworked enemy pressure into telegraphed contact attacks with windup, active, recovery, and cooldown states instead of overlap-driven damage spam.
- Replaced interval-only spawning with a threat-budget director that respects spawn grace time, off-screen placement, safe distances, and wave-based enemy unlock rules.
- Moved the game scene onto an explicit `starting -> playing -> levelup -> dying -> gameover` lifecycle with observable run-phase events.

### Fixed
- Restored armor and shield mitigation as part of the centralized damage pipeline so player defense behaves consistently across every attack source.
- Prevented repeated multi-hit edge cases by making per-attack and per-orb hit ownership explicit instead of relying on ad hoc collision loops.

## 0.3.0 - 2026-03-14

### Changed
- Reworked the core gameplay lifecycle so runs now move through a single scene-owned `playing -> dying -> gameover` flow instead of overlapping fail-safes across gameplay and UI layers.
- Moved player defense resolution into the player entity so shield absorption, health loss, invulnerability, and death state are handled in one place.
- Switched the manual melee strike to the configured `attack` input and updated weapon execution to run exactly once per frame.

### Fixed
- Removed duplicate weapon update paths that could desync cooldowns, attack timing, and hit windows.
- Removed duplicated game-over forcing between the scene and application layers, making restart behavior deterministic again.
- Replaced the old player-enemy contact auto-damage loop with cleaner collision separation plus damage intake, preventing contact from acting like both attack and defense at once.

## 0.2.1 - 2026-03-14

### Changed
- Updated spritesheet parsing to honor shared character metadata for default sprite sizing and descriptive animation names.

### Fixed
- Restored enemy animation resolution for concise skeleton and slime sheets, including `*_sideways` rows with flip-based left/right playback.
- Added left-to-right `sprite_count` frame expansion so upper-left frame coordinates can define multi-frame animations more compactly.

## 0.2.0 - 2026-03-14

### Added
- Browser-accessible self-play playtesting with built-in `smoke` and `endurance` scenarios.
- Structured playtest snapshots and reports exposed through `window.Darkmoon.playtest` for automation and debugging.
- Virtual input injection so automated runners can drive the live game scene without bypassing normal gameplay systems.

### Changed
- Documented URL-driven playtest launch and console-based playtest controls in the README.
- Exposed stable gameplay telemetry from the active scene, including nearby enemies, pickups, upgrade options, and end-of-run state.

## 0.1.0 - 2026-02-28

### Added
- Structured debug logging with persistent log capture to `logs/` (JSONL) and browser console formatting.
- Detailed gameplay diagnostics for enemy proximity, contact resolution, and damage/debug tracing.

### Changed
- Reworked runtime lifecycle to a strict `menu -> playing -> gameover -> restart` flow.
- Moved in-game debug overlay to bottom-left for better visibility during combat.

### Removed
- Pause feature from active gameplay flow, UI overlay, and pause key bindings.
