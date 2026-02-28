# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 - 2026-02-28

### Added
- Structured debug logging with persistent log capture to `logs/` (JSONL) and browser console formatting.
- Detailed gameplay diagnostics for enemy proximity, contact resolution, and damage/debug tracing.

### Changed
- Reworked runtime lifecycle to a strict `menu -> playing -> gameover -> restart` flow.
- Moved in-game debug overlay to bottom-left for better visibility during combat.

### Removed
- Pause feature from active gameplay flow, UI overlay, and pause key bindings.
