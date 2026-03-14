# Changelog

All notable changes to this project will be documented in this file.

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
